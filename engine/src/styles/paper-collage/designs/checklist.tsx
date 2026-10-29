import {displayWeight} from '../../../style-kit/design-safety';
import {useTiming} from '../../../style-kit/design-safety';
// Approved V4 pilot; parsed data and direction adapter.
import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {C, BODY, clamp01, ramp, rectShape, cornerTornShape, polyShape, checkVerts, fit, Stage, Piece, Tape, Headline, headBox, Kicker, DesignProvider, useKit} from './kit';

export const Checklist: React.FC<FamilyDesignProps> = p => {
  if (p.scene.family !== 'checklist') return null;
  return <DesignProvider data={p.scene.data} sectionIndex={p.sectionIndex}><ChecklistDrawing d={p.scene.data}/></DesignProvider>;
};

const ChecklistDrawing: React.FC<{d: {kicker: string; title: string; variant: string; items: {label: string; detail: string; atFrame: number}[]}}> = ({d}) => {
  const {HEAD, copy, word} = useKit();
  const f = useCurrentFrame();
  const missing = d.variant === 'missing';
  const n = d.items.length;
  const hb = headBox(d.title, {lines: missing ? 1 : 2, size: missing ? 112 : 124, min: 96, key: true}, HEAD);
  const headH = hb.lines.length * hb.box;
  const timing=useTiming();
  const at = (i: number) => timing.frame(d.items[i].atFrame,15+i*24);
  if (!missing) {
    const cardTop = 336 + headH + 24, cardH = 1160 - cardTop, rh = cardH / n;
    return <Stage offcuts={{family: 'quarter', colors: [C.terra, C.mustard, C.teal]}}>
      <Kicker text={d.kicker} x={65} y={284} at={2} color={C.mustard} id="chk-kick" rot={-2}/>
      <Headline text={d.title} top={336} at={4} id="chk-h" keyWord={word('clear')} keyColor={C.teal} keyInk={C.card} size={124} lines={2}/>
      <Piece id="chk-card" x={65} y={cardTop} w={950} h={cardH} rot={-0.7} color={C.card} shape={rectShape(5)} enter={{at: 10, from: [0, 200], dur: 18, rot: 3}} z={3} depth={1}>
        {d.items.map((it, i) => {
          const lt = fit(it.label, {width: 640, size: 96, min: 64, lines: 1, weight: 700, family: HEAD, lh: 1.15});
          const k = ramp(f, at(i), 14);
          const blockH = lt.box + 54;
          return <React.Fragment key={i}>
            {i > 0 ? <div style={{position: 'absolute', top: i * rh - 1, [copy.side]: 50, width: 850 * ramp(f, 16 + i * 6, 20), height: 3, background: 'rgba(40,50,46,0.14)', borderRadius: 2}}/> : null}
            <div style={{position: 'absolute', top: i * rh + (rh - blockH) / 2, [copy.side]: 214, width: 640, direction: copy.dir, opacity: clamp01(k * 1.8), transform: `translateX(${(1 - k) * -30}px)`}}>
              <div style={{height: lt.box, lineHeight: `${lt.box}px`, fontFamily: HEAD, fontWeight: displayWeight(HEAD,'Reem Kufi',700), fontSize: lt.size, color: C.ink, whiteSpace: 'nowrap'}}>{it.label}</div>
              <div style={{height: 54, lineHeight: '54px', fontFamily: BODY, fontWeight: 500, fontSize: 46, color: 'rgba(40,50,46,0.74)', whiteSpace: 'nowrap'}}>{it.detail}</div>
            </div>
          </React.Fragment>;
        })}
        <Tape cx={60} cy={26} len={190} h={56} rot={-36} at={30} id="chk-t1"/>
        <Tape cx={890} cy={26} len={190} h={56} rot={35} at={36} from="r" id="chk-t2"/>
      </Piece>
      {d.items.map((it, i) => <Piece key={i} id={`chk-check-${i}`} x={808} y={cardTop + i * rh + rh / 2 - 78} w={156} h={156} rot={i % 2 ? 4 : -3} color={C.terra} shape={polyShape(checkVerts, 1.3)}
        enter={{at: at(i) + 6, from: [50, -90], dur: 11, rot: 16}} z={10} depth={0.4}/>)}
    </Stage>;
  }
  // missing: every absent item is a slip with its corner torn off and a «ناقص» tape label
  const top = 364 + headH + 30;
  const slipH = 138, gap = (1150 - top - slipH * n) / Math.max(1, n - 1);
  return <Stage offcuts={{family: 'strips', colors: [C.mustard, C.terra, C.card]}}>
    <Kicker text={d.kicker} x={65} y={274} at={2} color={C.mustard} id="miss-kick" rot={-2}/>
    <Headline text={d.title} top={364} at={4} id="miss-h" keyWord={word('missingKey')} keyColor={C.mustard} lines={1} size={112} min={96}/>
    {d.items.map((it, i) => {
      const lt = fit(it.label, {width: 560, size: 62, min: 44, lines: 1, weight: 700, family: HEAD});
      const k = ramp(f, at(i) + 6, 12);
      const y = top + i * (slipH + gap);
      const rots = [-0.8, 0.9, -0.5, 0.7];
      return <Piece key={i} id={`miss-${i}`} x={80 + (i % 2) * 14} y={y} w={850} h={slipH} rot={rots[i % 4]} color={C.card} shape={cornerTornShape(78)}
        enter={{at: at(i), from: [i % 2 ? -260 : 260, -50], dur: 13}} z={4 + i} depth={0.8}>
        <div style={{position: 'absolute', top: 14, [copy.side]: 50, width: 560, direction: copy.dir, opacity: clamp01(k * 1.8), transform: `translateX(${(1 - k) * -24}px)`}}>
          <div style={{height: lt.box, lineHeight: `${lt.box}px`, fontFamily: HEAD, fontWeight: displayWeight(HEAD,'Reem Kufi',700), fontSize: lt.size, color: C.ink, whiteSpace: 'nowrap'}}>{it.label}</div>
          <div style={{height: 42, lineHeight: '42px', fontFamily: BODY, fontWeight: 500, fontSize: 34, color: 'rgba(40,50,46,0.68)', whiteSpace: 'nowrap'}}>{it.detail}</div>
        </div>
        <Tape cx={150} cy={slipH / 2 + 4} len={190} h={64} rot={-7} at={at(i) + 12} id={`miss-t${i}`}>
          <span style={{fontFamily: BODY, fontWeight: 800, fontSize: 40, color: C.terra, lineHeight: 1}}>{word('missing')}</span>
        </Tape>
      </Piece>;
    })}
  </Stage>;
};

