import {displayWeight} from '../../../style-kit/design-safety';
// Approved V4 pilot; parsed data and direction adapter.
import React from 'react';
import {Easing, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {C, BODY, LAT, W, clamp01, ramp, lighten, pstr, rectShape, polyShape, circleVerts, shadowFilter, fit, Stage, Piece, Tape, PieceText, Headline, headBox, DesignProvider, useKit, type Pt} from './kit';

export const Process: React.FC<FamilyDesignProps> = p => {
  if (p.scene.family !== 'process') return null;
  return <DesignProvider data={p.scene.data} sectionIndex={p.sectionIndex}><ProcessDrawing d={p.scene.data}/></DesignProvider>;
};

const StepCard: React.FC<{i: number; x: number; y: number; w: number; h: number; rot: number; at: number; step: {title: string; detail: string}}> = ({i, x, y, w, h, rot, at, step}) => {
  const {HEAD, copy} = useKit();
  const f = useCurrentFrame();
  const tt = fit(step.title, {width: 590, size: 74, min: 66, lines: 1, weight: 700, family: HEAD, lh: 1.1});
  const dd = fit(step.detail, {width: 590, size: 44, min: 36, lines: 1, weight: 500, family: BODY, lh: 1.25});
  const k = ramp(f, at + 8, 14);
  const top = (h - tt.box - dd.box - 4) / 2;
  return <>
    <Piece id={`step-${i}`} x={x} y={y} w={w} h={h} rot={rot} color={C.card} shape={rectShape(6)} enter={{at, from: [i % 2 ? -420 : 420, -50], dur: 16, arc: 0.12}} z={4} depth={1}>
      <div style={{position: 'absolute', top, [copy.side]: 104, width: 600, direction: copy.dir, textAlign: copy.align, opacity: clamp01(k * 1.6), transform: `translateX(${(1 - k) * 30}px)`}}>
        <div style={{height: tt.box, lineHeight: `${tt.box}px`, fontFamily: HEAD, fontWeight: displayWeight(HEAD,'Reem Kufi',700), fontSize: tt.size, color: C.ink, whiteSpace: 'nowrap'}}>{step.title}</div>
        <div style={{height: dd.box, lineHeight: `${dd.box}px`, fontFamily: BODY, fontWeight: 500, fontSize: dd.size, color: 'rgba(40,50,46,0.8)', whiteSpace: 'nowrap', marginTop: 4}}>{step.detail}</div>
      </div>
      <Tape cx={34} cy={26} len={110} h={44} rot={-38} at={at + 18} id={`step-t${i}`}/>
    </Piece>
    <Piece id={`badge-${i}`} x={x + w - 80} y={y + h / 2 - 62} w={124} h={124} rot={0} color={C.terra} shape={polyShape(circleVerts, 1.5)} enter={{at: at + 7, from: [0, -80], dur: 12, rot: 10}} z={8} depth={0.5}>
      <PieceText text={String(i + 1)} h={124} size={80} family={LAT} weight={700} color={C.card} dy={-3}/>
    </Piece>
  </>;
};

/** One leg of the zig-zag band: a thin teal strip that stretches out from its start point, behind the cards. */
const ZigSeg: React.FC<{id: string; a: Pt; b: Pt; thick: number; at: number; dur: number; color: string}> = ({id, a, b, thick, at, dur, color}) => {
  const {copy} = useKit();
  if (!copy.ar) {a = [W - a[0], a[1]]; b = [W - b[0], b[1]];}
  const f = useCurrentFrame();
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  const p = ramp(f, at, dur, Easing.out(Easing.cubic));
  if (p <= 0.001) return null;
  const pts = rectShape(0, 1.6, 120)(len, thick, id).pts;
  const lift = Math.sin(Math.PI * clamp01((f - at) / dur)) * 0.6;
  return <div style={{position: 'absolute', left: a[0], top: a[1] - thick / 2, width: len, height: thick, zIndex: 2, transformOrigin: '0 50%', transform: `rotate(${ang}deg) scaleX(${p})`, filter: shadowFilter(lift, 0.35)}}>
    <svg width={len} height={thick} viewBox={`0 0 ${len} ${thick}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <polygon points={pstr(pts)} fill={color}/>
      <polygon points={pstr(pts)} fill="#fff" filter="url(#rs-tooth)" style={{mixBlendMode: 'overlay'}} opacity={0.3}/>
      <polygon points={pstr(pts)} fill="none" stroke={lighten(color, 0.5)} strokeWidth={1.5} opacity={0.85}/>
    </svg>
  </div>;
};

const ProcessDrawing: React.FC<{d: {title: string; steps: {title: string; detail: string}[]}}> = ({d}) => {
  const {HEAD, word} = useKit();
  const CARDW = 760, CARDH = 160;
  const one = headBox(d.title, {size: 104, min: 80, lines: 1, key: true}, HEAD);
  const hLines = one.fits ? 1 : 2;
  const hb = hLines === 1 ? one : headBox(d.title, {size: 112, min: 84, lines: 2, key: true}, HEAD);
  const headTop = 268;
  const first = headTop + hLines * hb.box + 30;
  const gap = (1162 - first - 3 * CARDH) / 2;
  const tops = [0, 1, 2].map((i) => Math.round(first + i * (CARDH + gap)));
  const xs = [200, 65, 200], rots = [-1.4, 1.2, -1.0], ats = [16, 30, 44];
  const yc = tops.map((t) => t + CARDH / 2);
  // the band zig-zags behind the cards: under card 1, down-right under card 2, down-left under card 3
  const P: Pt[] = [[xs[0] + 120, yc[0]], [xs[1] + CARDW - 70, yc[1]], [xs[2] + 120, yc[2]]];
  return <Stage offcuts={{family: 'torn', colors: [C.mustard, C.terra, C.teal]}}>
    <Headline text={d.title} top={headTop} at={2} id="proc-h" keyWord={word('step')} keyColor={C.mustard} size={hLines === 1 ? 104 : 112} min={hLines === 1 ? 80 : 84} lines={hLines}/>
    <ZigSeg id="zig-a" a={P[0]} b={P[1]} thick={54} at={58} dur={18} color={C.teal}/>
    <ZigSeg id="zig-b" a={P[1]} b={P[2]} thick={54} at={72} dur={18} color={C.teal}/>
    {d.steps.map((s, i) => <StepCard key={i} i={i} x={xs[i]} y={tops[i]} w={CARDW} h={CARDH} rot={rots[i]} at={ats[i]} step={s}/>)}
  </Stage>;
};

