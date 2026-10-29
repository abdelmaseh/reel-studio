// Approved V4 pilot; parsed data and direction adapter.
import React from 'react';

import type {FamilyDesignProps} from '../../family-designs';
import {C, BODY, textW, rectShape, polyShape, bubbleVerts, fit, Stage, Piece, Tape, PieceText, Headline, DesignProvider, useKit} from './kit';

export const Comment: React.FC<FamilyDesignProps> = p => {
  if (p.scene.family !== 'comment') return null;
  return <DesignProvider data={p.scene.data} sectionIndex={p.sectionIndex}><CommentDrawing d={p.scene.data}/></DesignProvider>;
};

const CommentDrawing: React.FC<{d: {keyword: string; promise: string}}> = ({d}) => {
  const {HEAD, word} = useKit();

  const kw = fit(d.keyword, {width: 520, size: 210, min: 120, lines: 1, weight: 700, family: HEAD});
  const kwW = Math.max(380, Math.round(textW(d.keyword, HEAD, kw.size, 700)) + 150), kwH = Math.round(kw.box + 40);
  const BX = 90, BY = 616, BW = 900, BH = 410;
  const pr = fit(d.promise, {width: 560, size: 50, min: 36, lines: 1, weight: 700, family: BODY});
  const prW = Math.round(textW(d.promise, BODY, pr.size, 700)) + 130;
  return <Stage offcuts={{family: 'torn', colors: [C.mustard, C.teal, C.terra]}}>
    <Headline text={word('commentPrompt')} top={284} at={2} id="cm-h" keyWord={word('comments')} keyColor={C.teal} keyInk={C.card} size={124}/>
    <Piece id="cm-bubble" x={BX} y={BY} w={BW} h={BH} rot={-1.4} color={C.card} shape={polyShape(bubbleVerts({x: BW - 250, w: 96, tip: [BW - 130, BH + 112]}, 74), 1.6)}
      enter={{at: 8, from: [0, 220], dur: 18, rot: 4}} z={3} depth={1}>
      <Tape cx={BW - 70} cy={22} len={170} h={54} rot={34} at={32} from="r" id="cm-bt"/>
    </Piece>
    <Piece id="cm-tab" x={BX + 40} y={BY - 28} w={170} h={58} rot={-4} color={C.terra} shape={rectShape(5)} enter={{at: 26, from: [-80, -40], dur: 12}} z={9} depth={0.4}>
      <PieceText text={word('comment')} h={58} size={34} family={BODY} weight={800} color={C.card}/>
    </Piece>
    <Piece id="cm-kw" x={540 - kwW / 2} y={BY + 78} w={kwW} h={kwH} rot={1.8} color={C.mustard} shape={rectShape(9)} enter={{at: 30, from: [-120, -230], dur: 15, rot: -9}} z={8} depth={0.45}>
      <PieceText text={d.keyword} h={kwH} size={kw.size} color={C.ink} dy={-Math.round(kw.size * 0.03)}/>
      <div style={{position: 'absolute', left: 40, top: kwH * 0.24, width: 11, height: kwH * 0.52, background: C.terra, borderRadius: 3}}/>
      <Tape cx={30} cy={16} len={120} h={46} rot={-38} at={48} id="cm-t1"/>
      <Tape cx={kwW - 30} cy={kwH - 16} len={120} h={46} rot={-36} at={52} from="r" id="cm-t2"/>
    </Piece>
    <Piece id="cm-promise" railSafe x={65} y={1078} w={prW} h={90} rot={-1.2} color={C.teal} shape={rectShape(8)} enter={{at: 58, from: [-300, 80], dur: 15}} z={6} depth={0.7}>
      <PieceText text={d.promise} h={90} size={pr.size} family={BODY} weight={700} color={C.card} dy={-1}/>
      <Tape cx={prW - 24} cy={10} len={100} h={42} rot={34} at={74} id="cm-pt"/>
    </Piece>
  </Stage>;
};

