import {displayWeight, fittedSize} from '../../../style-kit/design-safety';
// Approved V4 pilot; parsed data and direction adapter.
import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {C, BODY, W, ramp, cut, rectShape, polyShape, circleVerts, hillVerts, fit, Stage, Piece, Tape, Headline, DesignProvider, useKit, type Pt, type ShapeFn, type Track} from './kit';

export const Comparison: React.FC<FamilyDesignProps> = p => {
  if (p.scene.family !== 'comparison') return null;
  return <DesignProvider data={p.scene.data} sectionIndex={p.sectionIndex}><ComparisonDrawing d={p.scene.data}/></DesignProvider>;
};

const ComparisonDrawing: React.FC<{d: {title: string; beforeTitle: string; beforeDetail: string; afterTitle: string; afterDetail: string}}> = ({d}) => {
  const {HEAD, copy, word} = useKit();
  const f = useCurrentFrame();
  const OX = 65, OY = 628, CW = 620, CH = 440;
  const LX = 700, LW = 315;
  const j0 = 310;
  const joint: Pt[] = [[j0, 0], [j0 - 7, CH * 0.17], [j0 + 7, CH * 0.34], [j0 - 6, CH * 0.51], [j0 + 8, CH * 0.68], [j0 - 5, CH * 0.85], [j0 + 2, CH]];
  const jx = j0 - 8;
  // sky halves share the joint, so they tile exactly when they meet
  const skyL: ShapeFn = (w, h, id) => ({pts: cut([[0, 0], ...joint, [0, CH]], id, 1.1, 9999)});
  const skyR: ShapeFn = (w, h, id) => ({pts: cut([...joint.map(([x, y]) => [x - jx, y] as Pt), [CW - jx, CH], [CW - jx, 0]], id, 1.1, 9999)});
  // Fallback fitting preserves words, but can exceed its minimum size's width.
  // Measure the returned whole lines too, so every line stays inside the card.
  const cardFit = (text: string, family: string, weight: number, size: number, min: number, lines: number, lh: number) => {
    const t = fit(text, {width: LW - 56, family, weight, size, min, lines, lh});
    const fitted = Math.min(t.size, ...t.lines.map(line => fittedSize(line, family, displayWeight(family, 'Reem Kufi', weight), t.size, LW - 56)));
    return {...t, size: fitted, box: t.box * fitted / t.size};
  };
  const lf = (title: string, detail: string) => ({t: cardFit(title, HEAD, 700, 62, 32, 1, 1.2), dd: cardFit(detail, BODY, 600, 42, 26, 2, 1.25)});
  const before = lf(d.beforeTitle, d.beforeDetail), after = lf(d.afterTitle, d.afterDetail);
  const labelH = (q: typeof before) => Math.round(26 + q.t.box + 8 + q.dd.lines.length * q.dd.box + 24);
  const settle = 1 + 0.012 * Math.max(0, 1 - Math.abs(f - 90) / 6) * (f >= 86 ? 1 : 0);
  // scattered pose -> assembled pose
  const T = (at: number, dx: number, dy: number, rot: number): Track => ({at, dur: 18, from: [dx, dy], rot, lift: 0.9});
  const label = (id: string, y: number, at: number, color: string, q: typeof before, title: string, detail: string, rot: number, dim = 1) => {
    const h = labelH(q);
    return <Piece id={id} x={LX} y={y} w={LW} h={h} rot={rot} color={color} shape={rectShape(6)} enter={{at, from: [260, -40], dur: 14}} z={6} depth={0.6}>
      <div data-comparison-card={id} style={{position: 'absolute', left: 28, top: 26, width: LW - 56, direction: copy.dir, textAlign: 'center'}}>
        <div style={{height: q.t.box, lineHeight: `${q.t.box}px`, fontFamily: HEAD, fontWeight: displayWeight(HEAD,'Reem Kufi',700), fontSize: q.t.size, color: `rgba(40,50,46,${dim})`, whiteSpace: 'nowrap'}}>{title}</div>
        {q.dd.lines.map((l, i) => <div key={i} style={{height: q.dd.box, lineHeight: `${q.dd.box}px`, fontFamily: BODY, fontWeight: 600, fontSize: q.dd.size, color: `rgba(40,50,46,${dim})`, whiteSpace: 'nowrap', marginTop: i === 0 ? 8 : 0}}>{l}</div>)}
      </div>
      <Tape cx={LW - 30} cy={16} len={104} h={42} rot={34} at={at + 14} id={id}/>
    </Piece>;
  };
  const dimBefore = 1 - 0.28 * ramp(f, 66, 12);
  const afterY = OY - 2 + labelH(before) + 30;
  return <Stage offcuts={{family: 'pills', colors: [C.terra, C.mustard, C.teal]}}>
    <Headline text={d.title} top={284} at={2} id="cmp-h" keyWord={word('different')} keyColor={C.terra} keyInk={C.card} size={118}/>
    {label('cmp-lb', OY - 2, 8, C.card, before, d.beforeTitle, d.beforeDetail, -1.6, dimBefore)}
    {label('cmp-la', afterY, 66, C.mustard, after, d.afterTitle, d.afterDetail, 1.4)}
    <Tape cx={OX + CW + 4} cy={afterY + 56} len={124} h={48} rot={-10} at={90} id="cmp-join"/>
    <div data-comparison-picture={copy.dir} style={{position: 'absolute', inset: 0, zIndex: 2, transform: copy.ar ? undefined : 'scaleX(-1)'}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: 1920, transform: `scale(${settle})`, transformOrigin: `${OX + CW / 2}px ${OY + CH / 2}px`}}>
      {/* Mirror the assembled picture once, including its polygon shapes and motion. */}
      <Piece dir="rtl" id="cmp-skyL" x={OX} y={OY} w={j0 + 10} h={CH} rot={0} color={C.teal} shape={skyL} enter={{at: 10, from: [-300, -40], dur: 15}} track={T(48, -34, 28, -9)} z={2} depth={0.8}/>
      <Piece dir="rtl" id="cmp-skyR" x={OX + jx} y={OY} w={CW - jx} h={CH} rot={0} color={C.teal} shape={skyR} enter={{at: 15, from: [300, -40], dur: 15}} track={T(52, 18, -14, 7)} z={3} depth={0.8}/>
      <Piece dir="rtl" id="cmp-hillB" x={OX} y={OY + 190} w={CW} h={CH - 190} rot={0} color={C.card} shape={polyShape(hillVerts('hillb', 44, 22, 6), 1.2)} enter={{at: 20, from: [0, 220], dur: 15}} track={T(58, 24, -150, -6)} z={4} depth={0.6}/>
      <Piece dir="rtl" id="cmp-hillF" x={OX + 130} y={OY + 300} w={CW - 130} h={CH - 300} rot={0} color={C.terra} shape={polyShape(hillVerts('hillf', 38, 16, 5, 0.55), 1.2)} enter={{at: 25, from: [260, 120], dur: 15}} track={T(64, -90, -290, 7)} z={5} depth={0.5}/>
      <Piece dir="rtl" id="cmp-sun" x={OX + 395} y={OY + 50} w={148} h={148} rot={0} color={C.mustard} shape={polyShape(circleVerts, 1.5)} enter={{at: 30, from: [-60, -200], dur: 15}} track={T(70, -290, 230, 0)} z={6} depth={0.5}/>
      <Tape cx={copy.ar ? OX + CW / 2 : W - OX - CW / 2} cy={OY + 6} len={210} h={56} rot={copy.ar ? -3 : 3} at={90} id="cmp-tape"/>
    </div>
    </div>
  </Stage>;
};

