import React from 'react';
import type {FamilyDesignProps} from '../../family-designs';
import {IntroScene, ProofScene, ProcessScene, ComparisonScene, CommentGateScene, FollowScene} from '../../../creative-kit/scenes';
import {Intro} from './intro';
import {Proof} from './proof';
import {Process} from './process';
import {Checklist} from './checklist';
import {Comparison} from './comparison';
import {Statement} from './statement';
import {Comment} from './comment';
import {Follow} from './follow';
import {CountSplit} from './count';
import {designSet} from '../../../style-kit/design-safety';
import {Figures} from './figures';
import {ChatThread} from './chat-thread';
import {ProofScreen} from './proof-screen';

// The approved full-frame designs leave the existing classic split layouts available.
const takeover = (Design: React.FC<FamilyDesignProps>, Shared: React.ComponentType<any>): React.FC<FamilyDesignProps> =>
  props => props.scene.layout === 'takeover' ? React.createElement(Design, props)
    : React.createElement(Shared, {style: props.style, layout: props.scene.layout, motion: props.scene.motion, showCaption: false, data: props.scene.data});

export const SECTION_DECK_DESIGNS = {
  intro: takeover(Intro, IntroScene), proof: takeover(Proof, ProofScene), process: takeover(Process, ProcessScene),
  comparison: takeover(Comparison, ComparisonScene), comment: takeover(Comment, CommentGateScene), follow: takeover(Follow, FollowScene),
  checklist: Checklist, statement: Statement, count: CountSplit,
  // The redesigned takeover families run inside designSet like the other rebuilt styles; the nine above stay unwrapped as approved.
  ...designSet({figures: Figures, 'chat-thread': ChatThread, 'proof-screen': ProofScreen}),
};
