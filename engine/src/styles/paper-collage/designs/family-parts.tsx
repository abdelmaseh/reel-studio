// Furniture shared by the three paper-collage family designs: the content zone, the settled-state probe,
// headline strips cut from coloured paper, the taped unit slip and small number helpers.
import React from 'react';
import {Sequence} from 'remotion';
import {useProbe} from '../../../core/safe';
import {displayWeight} from '../../../style-kit/design-safety';
import {fitOnLines} from '../../../core/type';
import {C, BODY, W, X1, fit, textW, rectShape, Piece, PieceText, Tape, useKit} from './kit';

/** Nothing important above y 250; the caption line is y 1240, so content ends 90 px above it. */
export const ZONE_TOP = 292;
export const ZONE_BOTTOM = 1150;
/** Right edge of the content in the right-to-left frame, and the left margin. */
export const X0 = 65;
/** The sticker slot of figures and chat-thread occupies x 848 to 1008 from y 340. */
export const STICKER_EDGE = 828;
const SETTLED_FRAME = 4000;

/** Under the safe-zone probe every scene shows its final, settled state. */
export const Settled: React.FC<{children?: React.ReactNode}> = ({children}) => {
  const probe = useProbe();
  return probe === null ? <>{children}</> : <Sequence from={-SETTLED_FRAME} layout="none">{children}</Sequence>;
};

/** Physical left edge of a box that is laid out left to right in every language (digits keep their order). */
export const useFixedX = () => {
  const {copy} = useKit();
  return (x: number, w: number) => (copy.ar ? x : W - x - w);
};

export const decimalsOf = (n: number) => n.toFixed(6).split('.')[1].replace(/0+$/, '').length;
/** A number with a fixed count of decimals, never "-0". */
export const fixed = (n: number, decimals: number) => {
  const s = n.toFixed(decimals);
  return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s;
};
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---------- headline strips ----------
const HEAD_PAD_X = 46;
const STRIP_FILLS = [C.teal, C.card, C.mustard, C.terra];
const STRIP_INKS = [C.card, C.ink, C.ink, C.card];
const STRIP_ROT = [-1.5, 1.2, -1, 1.1];
const STRIP_SHIFT = [0, 46, 10, 34];

export type HeadPlan = {lines: string[]; size: number; ph: number; step: number; height: number; widths: number[]; weight: number; font: string};

/** The label cut into one paper strip per line: display type, each strip as wide as its text. */
export function useHeadPlan(text: string | undefined, o: {width?: number; size?: number; min?: number; lines?: number} = {}): HeadPlan | null {
  const {HEAD} = useKit();
  if (!text) return null;
  const width = o.width ?? 950;
  const t = fit(text, {width: width - 2 * HEAD_PAD_X, size: o.size ?? 124, min: o.min ?? 84, lines: o.lines ?? 3, weight: 700, family: HEAD, lh: 1.1});
  const weight = displayWeight(HEAD, 'Reem Kufi', 700);
  const ph = Math.round(t.box + 20), step = ph + 2;
  const widths = t.lines.map(line => Math.min(width, Math.round(textW(line, HEAD, t.size, weight)) + 2 * HEAD_PAD_X));
  return {lines: t.lines, size: t.size, ph, step, height: (t.lines.length - 1) * step + ph, widths, weight, font: HEAD};
}

/** Where strip i of a headline sits: its left and right edges and its top. Strips step inwards a little so the stack never looks machine-made. */
export const stripBox = (plan: HeadPlan, i: number, top: number, right = X1) => {
  const width = plan.widths[i], edge = right - Math.min(STRIP_SHIFT[i % 4], Math.max(0, right - X0 - width));
  return {left: edge - width, right: edge, width, top: top + i * plan.step};
};

export const StripHeadline: React.FC<{plan: HeadPlan; top: number; at: number; id: string; right?: number}> = ({plan, top, at, id, right = X1}) => {
  const soft = plan.lines.length > 2 ? 0.8 : 1;
  const last = plan.lines.length - 1;
  return <>{plan.lines.map((line, i) => {
    const box = stripBox(plan, i, top, right), w = box.width;
    return <Piece key={i} id={`${id}-l${i}`} x={box.left} y={box.top} w={w} h={plan.ph} rot={STRIP_ROT[i % 4] * soft} color={STRIP_FILLS[i % 4]} shape={rectShape(10)}
      enter={{at: at + i * 8, from: [i % 2 ? -300 : 300, -70], dur: 15}} depth={0.55} z={5 + plan.lines.length - i}>
      <PieceText text={line} h={plan.ph} size={plan.size} family={plan.font} weight={plan.weight} color={STRIP_INKS[i % 4]} dy={-Math.round(plan.size * 0.02)}/>
      {i === 0 ? <Tape cx={16} cy={12} len={104} h={42} rot={-38} at={at + 22} id={`${id}-t0`}/> : null}
      {i === last && last > 0 ? <Tape cx={w - 16} cy={plan.ph - 10} len={104} h={42} rot={-36} at={at + 28} id={`${id}-t1`}/> : null}
    </Piece>;
  })}</>;
};

// ---------- unit slip ----------
export type UnitPlan = {text: string; size: number; w: number; h: number};
export const UNIT_H = 84;
/** Visible part of the unit slip below the hero it overlaps. */
export const UNIT_OVERHANG = 54;

export function planUnit(unit: string | undefined): UnitPlan | null {
  if (!unit) return null;
  const t = fit(unit, {width: 640, size: 58, min: 38, lines: 1, weight: 800, family: BODY});
  return {text: unit, size: t.size, w: Math.round(textW(unit, BODY, t.size, 800)) + 100, h: UNIT_H};
}

/** The unit on a mustard slip with a strip of tape: it lands on the lower edge of its hero. */
export const UnitSlip: React.FC<{plan: UnitPlan; right: number; top: number; at: number; id: string; rot?: number}> = ({plan, right, top, at, id, rot = 1.8}) =>
  <Piece id={id} x={right - plan.w} y={top} w={plan.w} h={plan.h} rot={rot} color={C.mustard} shape={rectShape(8)} enter={{at, from: [-220, 60], dur: 14}} depth={0.5} z={14}>
    <PieceText text={plan.text} h={plan.h} size={plan.size} family={BODY} weight={800} color={C.ink} dy={-1}/>
    <Tape cx={plan.w - 22} cy={12} len={96} h={40} rot={34} at={at + 14} id={`${id}-t`}/>
  </Piece>;

/** One line of the given text at the largest size that fits, or null. Unlike the kit's fit it never warns, so it can probe. */
export const oneLine = (text: string, family: string, weight: number, o: {width: number; size: number; min: number}) => {
  const t = fitOnLines(text, {fontFamily: family, fontSize: o.size, fontWeight: weight}, {maxBoxWidth: o.width, maxLines: 1, min: o.min, max: o.size, lineHeight: 1.25});
  return t.fits ? {size: t.fontSize, lines: t.lines, box: t.lineBox} : null;
};

/** Wrapped lines at the largest size (down to `min`) that fits `lines` lines in `width`. Never warns, so it can probe. */
export const fitLines = (text: string, family: string, weight: number, o: {width: number; size: number; min: number; lines: number; lh?: number}) => {
  const t = fitOnLines(text, {fontFamily: family, fontSize: o.size, fontWeight: weight}, {maxBoxWidth: o.width, maxLines: o.lines, min: o.min, max: o.size, lineHeight: o.lh ?? 1.3});
  return {size: t.fontSize, lines: t.lines, box: t.lineBox, width: t.width, fits: t.fits};
};

/** The same words in the same number of lines, with the line widths evened out so no line is left with one stray word. */
export const balancedLines = (text: string, family: string, weight: number, size: number, width: number): {lines: string[]; width: number} => {
  const words = text.trim().split(/\s+/);
  const wordW = words.map(word => textW(word, family, size, weight));
  const space = textW('ن ن', family, size, weight) - 2 * textW('ن', family, size, weight);
  const wrap = (limit: number) => {
    const out: string[] = [];
    let line: string[] = [], used = 0;
    words.forEach((word, i) => {
      const add = line.length ? space + wordW[i] : wordW[i];
      if (line.length && used + add > limit) { out.push(line.join(' ')); line = [word]; used = wordW[i]; } else { line.push(word); used += add; }
    });
    if (line.length) out.push(line.join(' '));
    return out;
  };
  const count = wrap(width).length;
  let lo = Math.max(...wordW), hi = Math.max(width, lo);
  for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (wrap(mid).length <= count) hi = mid; else lo = mid; }
  const lines = wrap(hi);
  return {lines, width: Math.ceil(Math.max(...lines.map(line => textW(line, family, size, weight))))};
};

/** fitLines, then the lines evened out. */
export const fitBalanced = (text: string, family: string, weight: number, o: {width: number; size: number; min: number; lines: number; lh?: number}) => {
  const t = fitLines(text, family, weight, o);
  const b = balancedLines(text, family, weight, t.size, o.width);
  return {...t, lines: b.lines.length === t.lines.length ? b.lines : t.lines, width: b.lines.length === t.lines.length ? b.width : t.width};
};
