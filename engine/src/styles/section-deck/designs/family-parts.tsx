// Shared furniture of the section-deck family designs: the content zone, the settled-state clock, counting numbers,
// the outlined hero numeral and the accent chip.
import React from 'react';
import {Sequence} from 'remotion';
import {useProbe} from '../../../core/safe';
import {measure} from '../../../core/type';
import {useDesignText} from '../../../style-kit/digits';
import {W, X0, X1, CW, fit, mix, pop, ramp, sceneCopy, usePalette} from './kit';

/** Nothing above y 250; 90 px of air above the caption line at y 1330, and the platform rail starts at y 1150. */
export const ZONE_TOP = 292;
export const ZONE_BOTTOM = 1146;
/** The sticker slot (x 848 to 1008, y 340 to 500) sits on the right; Arabic copy steps left of it and hero objects start below it. */
export const STICKER_EDGE = 828;
export const STICKER_FLOOR = 524;
const SETTLED_FRAME = 4000;

/** Under the safe-zone probe every scene shows its final, settled state. */
export const Settled: React.FC<{children?: React.ReactNode}> = ({children}) => {
  const probe = useProbe();
  return probe === null ? <>{children}</> : <Sequence from={-SETTLED_FRAME} layout="none">{children}</Sequence>;
};

/** Copy language, palette and digit display of one scene. */
export const useDeck = (data: unknown) => {
  const copy = sceneCopy(data);
  return {copy, P: usePalette(copy.ar), shown: useDesignText()};
};
export type Deck = ReturnType<typeof useDeck>;

/** Where a start-aligned block sits: the right edge for Arabic, the left edge otherwise. */
export const startEdge = (hasSticker: boolean, ar: boolean) => (hasSticker && ar ? W - STICKER_EDGE : W - X1);
export const headWidth = (hasSticker: boolean) => (hasSticker ? STICKER_EDGE - X0 : CW);

export const decimalsOf = (n: number) => n.toFixed(6).split('.')[1].replace(/0+$/, '').length;
/** A number with a fixed count of decimals, never "-0". */
export const fixed = (n: number, decimals: number) => {
  const s = n.toFixed(decimals);
  return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s;
};
const isDigit = (c: string) => /\p{Nd}/u.test(c);

/** Digits of the deck face sit between these fractions of the em box when the line box equals the font size. */
export const GLYPH_TOP = 0.185, GLYPH_BOTTOM = 0.835;
export const GLYPH = GLYPH_BOTTOM - GLYPH_TOP;
/** How far a digit sits below the centre of its line box, per px of font size. */
export const GLYPH_DROP = (GLYPH_TOP + GLYPH_BOTTOM) / 2 - 0.5;

export type NumberPlan = {total: number; widths: number[]; at: (progress: number) => string[]; digit: number};

/** A counting number set in fixed digit cells so it never jitters. Widths are per 100 px of font size. */
export function numberPlan(value: number, from: number, shown: (t: string | number) => string, font: string): NumberPlan {
  const decimals = Math.max(decimalsOf(value), decimalsOf(from));
  const render = (n: number) => Array.from(shown(fixed(n, decimals)));
  const end = render(value), start = render(from);
  const wide = (c: string) => measure(c, {fontFamily: font, fontSize: 100, fontWeight: 900}).width;
  const digit = Math.max(...Array.from({length: 10}, (_, k) => wide(shown(k))));
  const cell = (c: string | undefined) => (c === undefined ? 0 : isDigit(c) ? digit : wide(c));
  const slots = Math.max(end.length, start.length);
  const widths = Array.from({length: slots}, (_, i) => {
    const j = slots - 1 - i;
    return Math.max(cell(end[end.length - 1 - j]), cell(start[start.length - 1 - j]));
  });
  return {total: widths.reduce((a, b) => a + b, 0), widths, digit, at: p => (p >= 1 ? end : render(from + (value - from) * p))};
}

/** One row of digit cells, left to right, with the last characters in the last cells. */
export const NumberRow: React.FC<{chars: string[]; plan: NumberPlan; size: number; font: string; style?: React.CSSProperties}> = ({chars, plan, size, font, style}) => {
  const pad = plan.widths.length - chars.length;
  return <div style={{display: 'flex', direction: 'ltr', fontFamily: font, fontWeight: 900, fontSize: size, lineHeight: `${size}px`, whiteSpace: 'nowrap', ...style}}>
    {plan.widths.map((w, i) => <span key={i} style={{display: 'inline-block', width: w * size / 100, textAlign: 'center'}}>{chars[i - pad] ?? ''}</span>)}
  </div>;
};

/** The numeral of the deck: it starts as a stroke only, then fills solid from the bottom to the top as the count rises. */
export const HeroNumber: React.FC<{plan: NumberPlan; chars: string[]; size: number; fill: number; font: string; ink: string; accent: string; stroke: string}> = ({plan, chars, size, fill, font, ink, accent, stroke}) => {
  const w = plan.total * size / 100, h = GLYPH * size;
  const row = (style: React.CSSProperties) => <div style={{position: 'absolute', left: 0, top: -GLYPH_TOP * size, width: w}}><NumberRow chars={chars} plan={plan} size={size} font={font} style={style}/></div>;
  const edge = fill > 0.01 && fill < 0.995;
  return <div style={{position: 'relative', width: w, height: h}}>
    {row({color: 'transparent', WebkitTextStroke: `${Math.max(3, Math.round(size / 90))}px ${stroke}`})}
    <div style={{position: 'absolute', inset: 0, clipPath: `inset(${(1 - fill) * 100}% -4% -6% -4%)`}}>{row({color: ink})}</div>
    {edge ? <div style={{position: 'absolute', left: -10, width: w + 20, height: 8, top: (1 - fill) * h - 4, background: accent}}/> : null}
  </div>;
};

export type ChipSpec = {text: string; size: number; w: number; h: number};
/** The unit of a figure as an accent chip: one line, as large as the room allows. */
export const chipSpec = (text: string, font: string, maxWidth: number, size: number): ChipSpec => {
  const t = fit(text, {width: maxWidth - 72, size, min: 36, lines: 1, weight: 900}, font);
  const width = Math.ceil(measure(text, {fontFamily: font, fontSize: t.size, fontWeight: 900}).width);
  return {text, size: t.size, w: width + 72, h: Math.round(t.size * 1.5)};
};
export const Chip: React.FC<{spec: ChipSpec; at: number; frame: number; font: string; fill: string; ink: string; dir: 'rtl' | 'ltr'; style: React.CSSProperties}> = ({spec, at, frame, font, fill, ink, dir, style}) => {
  const k = pop(frame, at, 13, 190), on = ramp(frame, at, 6);
  return <div style={{position: 'absolute', width: spec.w, height: spec.h, borderRadius: Math.round(spec.h * 0.3), background: fill, color: ink, fontFamily: font, fontWeight: 900, fontSize: spec.size,
    lineHeight: `${spec.h}px`, textAlign: 'center', whiteSpace: 'nowrap', direction: dir, opacity: on, transform: `scale(${mix(0.7, 1, k)})`, ...style}}>{spec.text}</div>;
};
