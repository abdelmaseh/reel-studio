import {designSet} from '../../../style-kit/design-safety';
import React from 'react';
import type {FamilyDesignProps} from '../../family-designs';
import {IntroScene,ProofScene,ProcessScene,ComparisonScene,CommentGateScene,FollowScene} from '../../../creative-kit/scenes';
import {SemanticSceneRenderer} from '../../../creative-kit/semantic/scenes';
import {semanticSceneSchema} from '../../../creative-kit/semantic/schema';
import {Intro} from './intro';
import {Proof} from './proof';
import {Process} from './process';
import {Checklist} from './checklist';
import {Comparison} from './comparison';
import {Statement} from './statement';
import {CountSplit} from './count';
import {Comment} from './comment';
import {Follow} from './follow';
import {ChapterQuote} from './chapter-quote';
import {Verdict} from './verdict';
import {Figures} from './figures';
import {ChatThread} from './chat-thread';
import {ProofScreen} from './proof-screen';

// As in section-deck, classic split scenes keep the shared presenter-safe panel.
const takeover=(Design:React.FC<FamilyDesignProps>,Shared:React.ComponentType<any>):React.FC<FamilyDesignProps>=>
  props=>props.scene.layout==='takeover'?React.createElement(Design,props)
    :React.createElement(Shared,{style:props.style,layout:props.scene.layout,motion:props.scene.motion,showCaption:false,data:props.scene.data});

export const MAGAZINE_INTERVIEW_DESIGNS:Partial<Record<string,React.FC<FamilyDesignProps>>>=designSet({
  'intro':takeover(Intro,IntroScene),
  'proof':takeover(Proof,ProofScene),
  'process':takeover(Process,ProcessScene),
  'checklist':Checklist,
  'comparison':takeover(Comparison,ComparisonScene),
  'statement':Statement,
  'count':CountSplit,
  'comment':takeover(Comment,CommentGateScene),
  'follow':takeover(Follow,FollowScene),
  'chapter-quote':props=>props.scene.layout==='takeover'?React.createElement(ChapterQuote,props)
    :React.createElement(SemanticSceneRenderer,{scene:semanticSceneSchema.parse(props.scene),style:props.style}),
  'verdict':Verdict,
  'figures':Figures,
  'chat-thread':ChatThread,
  'proof-screen':ProofScreen,
});
