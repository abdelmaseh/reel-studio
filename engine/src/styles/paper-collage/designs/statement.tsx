import {displayWeight} from '../../../style-kit/design-safety';
import {StatementBand} from '../../../style-kit/statement-band';
// Approved V4 pilot; parsed data and direction adapter.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {C, X1, rectShape, fit, PaperDefs, Piece, Tape, Kicker, DesignProvider, useKit, warnOnce} from './kit';

export const Statement: React.FC<FamilyDesignProps> = p => {
  if (p.scene.family !== 'statement') return null;
  return <DesignProvider data={p.scene.data} sectionIndex={p.sectionIndex}><StatementDrawing d={p.scene.data} head={p.headBox} props={p}/></DesignProvider>;
};

const StatementDrawing: React.FC<{d: {kicker: string; title: string}; head?: FamilyDesignProps['headBox'];props:FamilyDesignProps}> = ({d, head,props}) => {
  const {HEAD, copy} = useKit();
  // Keep the pilot without a head guide. With a guide, use only its approved
  // 100–120 px font range before deciding that no legal overlay band exists.
  let t = fit(d.title, {width: 790, size: 120, min: 100, lines: 2, weight: 700, family: HEAD, lh: 1.04});
  const bottom = (q: typeof t) => 282 + q.lines.length * Math.round(q.box + 8) - (q.lines.length > 1 ? 10 : 0) + 18;
  if(!head || bottom(t)>head.y-40)return <StatementBand {...props} font={HEAD}/>;
  if (head) for (let size = t.size - 1; bottom(t) > head.y - 40 + 14 && size >= 100; size--) {
    t = fit(d.title, {width: 790, size, min: size, lines: 2, weight: 700, family: HEAD, lh: 1.04});
  }
  const ph = Math.round(t.box + 8);
  const SW = 900, y1 = 282, y2 = y1 + ph - 10;
  const contentBottom = bottom(t);
  const shift = head ? Math.min(0, head.y - 40 - contentBottom) : 0;
  if (head && y1 + shift - 18 < 250) {
    warnOnce('paper-collage head-warning: no safe statement band above the measured head');
    return null;
  }
  const strip = (id: string, x: number, y: number, color: string, ink: string, text: string, rot: number, at: number, dir: number, tapes: React.ReactNode) =>
    <Piece id={id} x={x} y={y} w={SW} h={ph} rot={rot} color={color} shape={rectShape(12)} enter={{at, from: [0, -360], dur: 17, rot: dir * 6}} z={id === 'st-1' ? 4 : 5} depth={0.9}>
      <div style={{position: 'absolute', [copy.side]: 58, top: -Math.round(t.size * 0.02), height: ph, lineHeight: `${ph}px`, fontFamily: HEAD, fontWeight: displayWeight(HEAD,'Reem Kufi',700), fontSize: t.size, color: ink, whiteSpace: 'nowrap', direction: copy.dir}}>{text}</div>
      {tapes}
    </Piece>;
  return <AbsoluteFill>
    <PaperDefs/>

    <div data-statement-bottom={contentBottom + shift} style={{position: 'absolute', inset: 0, transform: `translateY(${shift}px)`}}>
    {strip('st-1', X1 - SW, y1, C.teal, C.card, t.lines[0], -1.1, 8, 1,
      <Tape cx={SW - 36} cy={32} len={120} h={46} rot={34} at={28} from="r" id="st-t1"/>)}
    {t.lines[1] ? strip('st-2', X1 - SW - 12, y2, C.mustard, C.ink, t.lines[1], 0.9, 18, -1, <>
      <Tape cx={16} cy={ph / 2} len={120} h={46} rot={-84} at={36} id="st-t2a"/>
      <Tape cx={SW - 16} cy={ph / 2} len={120} h={46} rot={84} at={40} from="r" id="st-t2b"/>
    </>) : null}
    </div>
    <Kicker text={d.kicker} x={65} y={270} at={4} id="st-kick"/>
  </AbsoluteFill>;
};

