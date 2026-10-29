import {designSet} from '../../../style-kit/design-safety';
import React from 'react';
import type {FamilyDesignProps} from '../../family-designs';
import {IntroScene, ProofScene, ProcessScene, ComparisonScene, CommentGateScene, FollowScene} from '../../../creative-kit/scenes';
import {SemanticSceneRenderer} from '../../../creative-kit/semantic/scenes';
import {semanticSceneSchema} from '../../../creative-kit/semantic/schema';
import {Intro, introLens} from './intro';
import {Proof, proofGeo} from './proof';
import {Process, procGeo} from './process';
import {Checklist, checkLens} from './checklist';
import {Comparison, cmpGeo} from './comparison';
import {Statement, stmtGeo} from './statement';
import {CountSplit, countGeo} from './count';
import {Comment} from './comment';
import {Follow} from './follow';
import {TokenLens, tokLens} from './token-lens';
import {MeterReceipt, meterLens} from './meter-receipt';
import {Figures} from './figures';
import {ChatThread} from './chat-thread';
import {ProofScreen} from './proof-screen';
import {sceneCopy, SANS, type LensState} from './kit';

const takeover = (Design: React.FC<FamilyDesignProps>, Shared: React.ComponentType<any>): React.FC<FamilyDesignProps> =>
  props => props.scene.layout === 'takeover' ? React.createElement(Design,props)
    : React.createElement(Shared,{style:props.style,layout:props.scene.layout,motion:props.scene.motion,showCaption:false,data:props.scene.data});
const semantic = (Design: React.FC<FamilyDesignProps>): React.FC<FamilyDesignProps> =>
  props => props.scene.layout === 'takeover' ? React.createElement(Design,props)
    : React.createElement(SemanticSceneRenderer,{scene:semanticSceneSchema.parse(props.scene),style:props.style,words:props.words});

// Pilot sequence order. Existing split layouts keep their shared drawings.
export const LIQUID_GLASS_DESIGNS: Partial<Record<string, React.FC<FamilyDesignProps>>> = designSet({
  intro:takeover(Intro,IntroScene),proof:takeover(Proof,ProofScene),process:takeover(Process,ProcessScene),
  checklist:Checklist,comparison:takeover(Comparison,ComparisonScene),statement:Statement,count:CountSplit,
  comment:takeover(Comment,CommentGateScene),follow:takeover(Follow,FollowScene),
  'token-lens':semantic(TokenLens),'meter-receipt':semantic(MeterReceipt),
  figures:Figures,'chat-thread':ChatThread,'proof-screen':ProofScreen,
});

/** Same hero-origin selection as pilot exitLens; pass the active saved font and geometry. */
export function liquidGlassExitLens(props: Pick<FamilyDesignProps,'scene'|'seam'|'headBox'> & {font?:string}): LensState {
  const {scene} = props, copy = sceneCopy(scene.data);
  let d: any = {...scene.data,copy,font:props.font ?? SANS,seam:props.seam,headTop:props.headBox?.y ?? null};
  if(scene.family==='token-lens') d={...d,note:scene.data.footer,groups:scene.data.groups.map(g=>({label:g.label,text:g.tokens.join(' ')}))};
  if(scene.family==='meter-receipt') d={...d,before:scene.data.rows[0],after:scene.data.rows[1],note:scene.data.source};
  const own = scene.family==='intro' ? introLens(120,d) : scene.family==='checklist' ? checkLens(120,d)
    : scene.family==='token-lens' ? tokLens(120,d) : scene.family==='meter-receipt' ? meterLens(120,d) : null;
  if(own) return {...own,cx:copy.ar ? own.cx : 1080-own.cx};
  let cx=540,cy=800;
  switch(scene.family) {
    case 'proof': {const g=proofGeo(d);cx=g.cx;cy=g.cy;break;}
    case 'process': {const g=procGeo(d)[2];cx=g.dcx;cy=g.dcy;break;}
    case 'comparison': {const g=cmpGeo(d);cy=g.after.y+g.after.h/2;break;}
    case 'statement': cy=stmtGeo(d).bottom-120;break;
    case 'count': {const g=countGeo(d);cx=g.cx;cy=g.cy;break;}
    case 'comment': cy=830;break;
    case 'follow': cy=992;break;
  }
  return {cx:copy.ar ? cx : 1080-cx,cy,r:140,zoom:1.5,blur:0,vis:1,spin:1.5};
}
