// Print furniture shared by the three kinetic-paper family designs: settled-state probe, printed card, unit strip, printed number.
import React from 'react';
import {Easing, Sequence, useCurrentFrame} from 'remotion';
import {useProbe} from '../../../core/safe';
import {CARD, CW, INK, LIME, MIS, PAPER, SANS, W, X1, HtPattern, SafeWord, Slam, dotTile, ramp, useDesign} from './kit';

/** Content zone of the three families: nothing above y 250, and 90 px of air above the caption line at y 1320 once the rail starts at y 1150. */
export const ZONE_TOP = 292;
export const ZONE_BOTTOM = 1146;
const SETTLED_FRAME = 4000;

/** Under the safe-zone probe every scene shows its final, settled state. */
export const Settled: React.FC<{children?: React.ReactNode}> = ({children}) => {
  const probe = useProbe();
  return probe === null ? <>{children}</> : <Sequence from={-SETTLED_FRAME} layout="none">{children}</Sequence>;
};

/** A printed card: halftone shadow that grows in, optional lime plate slipped down-left, opaque body with a hard ink border. */
export const Printed: React.FC<{w: number; h: number; at: number; fill?: string; border?: number; shadow?: number; dot?: number; plate?: string; children?: React.ReactNode}> = ({w, h, at, fill = CARD, border = 8, shadow = 16, dot = 4.2, plate, children}) => {
  const f = useCurrentFrame();
  const grow = ramp(f, at + 2, 12, Easing.out(Easing.quad));
  return <div style={{position: 'relative', width: w, height: h}}>
    {shadow > 0 ? <div style={{position: 'absolute', left: shadow, top: shadow, width: w, height: h, backgroundImage: dotTile(dot * grow), backgroundSize: '20px 20px'}}/> : null}
    {plate ? <div style={{position: 'absolute', left: -MIS, top: MIS, width: w, height: h, background: plate}}/> : null}
    <div style={{position: 'absolute', inset: 0, background: fill, border: `${border}px solid ${INK}`, boxSizing: 'border-box'}}/>
    <div style={{position: 'absolute', inset: 0}}>{children}</div>
  </div>;
};

/** A halftone patch on the closing end of an ink strip: paper dots that fade out toward the text. */
export const DotBand: React.FC<{width: number}> = ({width}) => {
  const {copy} = useDesign();
  const fade = `linear-gradient(${copy.ar ? 'to right' : 'to left'}, #000 15%, transparent)`;
  return <div style={{position: 'absolute', [copy.opposite]: 0, top: 0, bottom: 0, width, backgroundImage: dotTile(3.1, PAPER), backgroundSize: '20px 20px', WebkitMaskImage: fade, maskImage: fade}}/>;
};

/** The unit of a figure: a full-width ink strip with paper text and the lime plate slipped under it. */
export const STRIP_H = 96;
export const UnitStrip: React.FC<{text: string; top: number; at: number; height?: number; size?: number}> = ({text, top, at, height = STRIP_H, size = 54}) => {
  const {copy} = useDesign();
  return <Slam at={at} from={1.18} origin="50% 50%" style={{position: 'absolute', top, [copy.side]: W - X1, width: CW}}>
    <div style={{position: 'relative', height, background: INK, boxShadow: `${-MIS}px ${MIS}px 0 ${LIME}`, display: 'flex', alignItems: 'center', gap: 22, padding: '0 36px', direction: copy.dir, boxSizing: 'border-box'}}>
      <DotBand width={Math.round(CW * 0.36)}/>
      <div style={{position: 'relative', width: 20, height: 20, flex: 'none', background: LIME, transform: 'rotate(45deg)'}}/>
      <div style={{position: 'relative', fontFamily: SANS, fontWeight: 900, fontSize: size, lineHeight: `${height}px`, color: PAPER, whiteSpace: 'nowrap'}}><SafeWord text={text} width={CW - 36 * 2 - 42 - 120} size={size}/></div>
    </div>
  </Slam>;
};

export const decimalsOf = (n: number) => n.toFixed(6).split('.')[1].replace(/0+$/, '').length;
/** A number with a fixed count of decimals, never "-0". */
export const fixed = (n: number, decimals: number) => {
  const s = n.toFixed(decimals);
  return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s;
};
const isDigit = (c: string) => /\p{Nd}/u.test(c);

/** A counting number set in fixed digit cells so the print never jitters: `at(p)` gives the characters at progress p, padded to the final slots. */
export function numberPlan(value: number, from: number, shown: (t: string | number) => string, glyph: (c: string) => number) {
  const decimals = Math.max(decimalsOf(value), decimalsOf(from));
  const render = (n: number) => Array.from(shown(fixed(n, decimals)));
  const last = render(value), first = render(from);
  const slots = Math.max(last.length, first.length);
  const pad = (c: string[]): (string | null)[] => [...Array<null>(Math.max(0, slots - c.length)).fill(null), ...c];
  const cell = Math.max(glyph(shown('0')), ...[...last, ...first].filter(isDigit).map(glyph));
  const lastSlots = pad(last), firstSlots = pad(first);
  const widths = lastSlots.map((c, i) => { const ref = c ?? firstSlots[i]; return ref === null || isDigit(ref) ? cell : glyph(ref); });
  return {widths, total: widths.reduce((a, b) => a + b, 0), at: (p: number) => pad(render(from + (value - from) * p))};
}

/** Digits of Lalezar sit between 0.12 and 0.69 of the em box; the baseline puts that band on the vertical centre of the svg. */
const BAND_CENTER = 0.285;
/** A number printed in ink with an offset halftone twin, drawn as svg text so each digit keeps its own cell. */
export const PrintedNumber: React.FC<{id: string; chars: (string | null)[]; widths: number[]; size: number; width: number; height: number; ht: number; color?: string; progress?: number}> = ({id, chars, widths, size, width, height, ht, color = INK, progress}) => {
  const {HEAD, weight} = useDesign();
  const total = widths.reduce((a, b) => a + b, 0) * size / 100;
  const baseline = height / 2 + BAND_CENTER * size;
  const off = Math.round(Math.max(12, Math.min(30, size * 0.06)));
  let x = (width - total) / 2;
  const cells: {c: string; cx: number}[] = [];
  chars.forEach((c, i) => { const w = widths[i] * size / 100; if (c !== null) cells.push({c, cx: x + w / 2}); x += w; });
  const row = (fill: string, d: number) => <g transform={`translate(${d} ${d})`} fill={fill} fontFamily={HEAD} fontWeight={weight} fontSize={size} textAnchor="middle">
    {cells.map((cell, i) => <text key={i} x={cell.cx} y={baseline}>{cell.c}</text>)}</g>;
  return <svg aria-label={chars.join('')} data-count-progress={progress} width={width} height={height} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
    <defs><HtPattern id={id} r={4.4 * ht}/></defs>
    {ht > 0.02 ? row(`url(#${id})`, off) : null}
    {row(color, 0)}
  </svg>;
};
