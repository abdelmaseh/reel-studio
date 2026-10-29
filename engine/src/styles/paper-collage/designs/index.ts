import {designSet} from '../../../style-kit/design-safety';
import React from 'react';
import type {FamilyDesignProps} from '../../family-designs';
import {IntroScene, ProofScene, ProcessScene, ComparisonScene, CommentGateScene, FollowScene} from '../../../creative-kit/scenes';
import {Intro} from './intro';
import {Proof} from './proof';
import {Process} from './process';
import {Checklist} from './checklist';
import {Comparison} from './comparison';
import {Statement} from './statement';
import {CountSplit} from './count';
import {Comment} from './comment';
import {Follow} from './follow';
import {MessageBoard} from './message-board';
import {EvidenceWipe} from './evidence-wipe';
import {Figures} from './figures';
import {ChatThread} from './chat-thread';
import {ProofScreen} from './proof-screen';

const takeover = (Design: React.FC<FamilyDesignProps>, Shared: React.ComponentType<any>): React.FC<FamilyDesignProps> =>
  p => p.scene.layout === 'takeover' ? React.createElement(Design, p)
    : React.createElement(Shared, {style: p.style, layout: p.scene.layout, motion: p.scene.motion, showCaption: false, data: p.scene.data});
export const PAPER_COLLAGE_DESIGNS: Partial<Record<string, React.FC<FamilyDesignProps>>> = designSet({
  intro: takeover(Intro, IntroScene), proof: takeover(Proof, ProofScene), process: takeover(Process, ProcessScene),
  checklist: Checklist, comparison: takeover(Comparison, ComparisonScene), statement: Statement, count: CountSplit,
  comment: takeover(Comment, CommentGateScene), follow: takeover(Follow, FollowScene),
  'message-board': MessageBoard, 'evidence-wipe': EvidenceWipe,
  figures: Figures, 'chat-thread': ChatThread, 'proof-screen': ProofScreen,
});
