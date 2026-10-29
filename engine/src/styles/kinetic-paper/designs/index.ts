import {designSet} from '../../../style-kit/design-safety';
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ChapterThemeProvider} from '../../../creative-kit/chapter-theme';
import {SemanticSceneRenderer} from '../../../creative-kit/semantic/scenes';
import {semanticSceneSchema} from '../../../creative-kit/semantic/schema';
import type {FamilyDesignProps} from '../../family-designs';
import {IntroScene,ProofScene,ProcessScene,ComparisonScene,CommentGateScene,FollowScene} from '../../../creative-kit/scenes';
import {ownSceneCopy as sceneCopy} from '../../../style-kit/design-safety';
import {CopyContext,InkFilterDefs,PaperFx} from './kit';
import {Intro} from './intro';
import {Proof} from './proof';
import {Process} from './process';
import {Checklist} from './checklist';
import {Comparison} from './comparison';
import {Statement} from './statement';
import {CountSplit} from './count';
import {Comment} from './comment';
import {Follow} from './follow';
import {TicketOffer} from './ticket-offer';
import {CommentStack} from './comment-stack';
import {Figures} from './figures';
import {ChatThread} from './chat-thread';
import {ProofScreen} from './proof-screen';
const paper = (Design:React.FC<FamilyDesignProps>, Shared?:React.ComponentType<any>):React.FC<FamilyDesignProps> => props => {
  if(Shared && props.scene.layout !== 'takeover')return React.createElement(ChapterThemeProvider,{chapter:null},React.createElement(Shared,{style:props.style,layout:props.scene.layout,motion:props.scene.motion,showCaption:false,data:props.scene.data}));
  const presenter = props.scene.family === 'statement' || props.scene.family === 'count';
  // No CSS filter around clipped text: Chromium headless can duplicate the text tile.
  return React.createElement(CopyContext.Provider,{value:sceneCopy(props.scene.data)},React.createElement(AbsoluteFill,null,React.createElement(InkFilterDefs),React.createElement(Design,props),presenter ? null : React.createElement(PaperFx)));
};
const semanticPaper = (Design:React.FC<FamilyDesignProps>):React.FC<FamilyDesignProps> => {
  const Takeover = paper(Design);
  return props => props.scene.layout === 'takeover' ? React.createElement(Takeover,props)
    : React.createElement(ChapterThemeProvider,{chapter:null},React.createElement(SemanticSceneRenderer,{scene:semanticSceneSchema.parse(props.scene),style:props.style,words:props.words}));
};
export const KINETIC_PAPER_DESIGNS:Partial<Record<string,React.FC<FamilyDesignProps>>> = designSet({
  intro:paper(Intro,IntroScene),proof:paper(Proof,ProofScene),process:paper(Process,ProcessScene),
  checklist:paper(Checklist),comparison:paper(Comparison,ComparisonScene),statement:paper(Statement),
  count:paper(CountSplit),comment:paper(Comment,CommentGateScene),follow:paper(Follow,FollowScene),
  'ticket-offer':semanticPaper(TicketOffer),'comment-stack':semanticPaper(CommentStack),
  figures:paper(Figures),'chat-thread':paper(ChatThread),'proof-screen':paper(ProofScreen),
});
