// The stretched hero word: where its kashida bar is, how big it can be and where it goes.
// Node-safe: it works on an ImageData-like bitmap and numbers, so the layout is tested without a browser.
//
// A word with a long tatweel is drawn once into a bitmap. The bitmap has three parts: the letters left of the bar, the bar and
// the letters right of the bar. Only the bar changes width, so the letters keep their shape (arabic/segment.ts kashidaBar).
import { INK_ALPHA, kashidaBar, type ImageLike } from '../../../arabic/segment.ts';
import { HEAD_CLEARANCE, type HeadBoxPx } from '../../../creative-kit/head-clear.ts';
import { HERO, HERO_PAD, SAFE, WORD_PAD, type Box } from './math.ts';

/** The word is drawn with this many tatweels at its best slot; the bar found in that bitmap is the part that is stretched. */
export const STRETCH_TATWEELS = 14;

export type StretchMetrics = {
  /** Font size the bitmap was drawn at. */
  size: number;
  width: number;
  height: number;
  baseline: number;
  /** Columns [x0, x1) and rows [top, bottom) of the bar. */
  bar: { x0: number; x1: number; top: number; bottom: number };
  /** First ink column, the column after the last, first ink row, the row after the last. */
  ink: { left: number; right: number; top: number; bottom: number };
};

/** Finds the bar and the ink box in a bitmap of the word, or null when there is no ink or no bar (a word with no legal slot). */
export function analyzeStretch(img: ImageLike, size: number, baseline: number): StretchMetrics | null {
  const { width, height, data } = img;
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[(y * width + x) * 4 + 3] as number) > INK_ALPHA) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return null;
  const bar = kashidaBar(img, size);
  if (bar === null) return null;
  return { size, width, height, baseline, bar, ink: { left, right: right + 1, top, bottom: bottom + 1 } };
}

/** Measures of the three parts at another font size. Everything scales with the size, except the bar's own length which is chosen. */
export function scaled(m: StretchMetrics, size: number) {
  const k = size / m.size;
  return {
    k,
    leftW: (m.bar.x0 - m.ink.left) * k,
    rightW: (m.ink.right - m.bar.x1) * k,
    ascent: (m.baseline - m.ink.top) * k,
    descent: (m.ink.bottom - m.baseline) * k,
    barThickness: (m.bar.bottom - m.bar.top) * k,
  };
}

export type HeroPlan = {
  mode: 'behind' | 'above';
  size: number;
  /** Bar length at rest, in canvas pixels. */
  barFinal: number;
  /** Horizontal centre of the whole word, and the canvas row of its baseline. */
  cx: number;
  baselineY: number;
};
export type HeroFail = { mode: 'none'; reason: string };

/** The bar is first drawn this many font sizes long (4% of the size) and grows to its rest length. */
export const BAR_START_EM = 0.04;
/** In the above mode the bar is never longer than this many font sizes, so a short word does not become a ruler. */
export const MAX_BAR_EM = 3.2;
/** The baseline sits this far down the head box, so the bar crosses the middle of the face. */
export const BASELINE_IN_HEAD = 0.6;
/** Letters never reach lower than this canvas row (the caption band starts near 1306). */
export const HERO_FLOOR = 1100;

const cap = (value: number): number => Math.floor(value);

/**
 * Word behind the speaker: the bar covers the head plus a margin each side, the letters stay visible left and right of it.
 * The size is the largest one for which both letter groups fit their side of the head, the whole word fits the safe width,
 * and the letters stay between the top of the safe zone and the floor.
 */
export function planBehind(m: StretchMetrics, head: HeadBoxPx, margin: number, pad: number = HERO_PAD): HeroPlan | HeroFail {
  const barFinal = head.width + 2 * margin;
  const cx = head.x + head.width / 2;
  const stripLeft = head.x - margin - (SAFE.left + pad);
  const stripRight = SAFE.right - pad - (head.x + head.width + margin);
  const per = scaled(m, 1);
  const baselineY = head.y + BASELINE_IN_HEAD * head.height;
  const limits = {
    left: per.leftW > 0 ? stripLeft / per.leftW : Infinity,
    right: per.rightW > 0 ? stripRight / per.rightW : Infinity,
    width: (SAFE.right - SAFE.left - 2 * pad - barFinal) / Math.max(per.leftW + per.rightW, 1e-6),
    top: (baselineY - SAFE.top - pad) / Math.max(per.ascent, 1e-6),
    bottom: (HERO_FLOOR - baselineY) / Math.max(per.descent, 1e-6),
  };
  const size = cap(Math.min(limits.left, limits.right, limits.width, limits.top, limits.bottom, HERO.maxSize));
  if (!(size >= HERO.minSize)) {
    const tight = (Object.entries(limits) as [string, number][]).sort((a, b) => a[1] - b[1])[0];
    return { mode: 'none', reason: `the word would be ${Math.max(0, size)}px (minimum ${HERO.minSize}px): ${tight[0]} is the tight side` };
  }
  return { mode: 'behind', size, barFinal, cx, baselineY };
}

/**
 * Word above the head, for a video without a matte: the same stretch, centred in the free band above the head box.
 * The bar grows until the word spans the band, never longer than MAX_BAR_EM font sizes.
 */
export function planAbove(m: StretchMetrics, band: Box, pad: number = HERO_PAD): HeroPlan | HeroFail {
  // The zone already keeps WORD_PAD from the safe edge; the big word's shadow is wider, so it keeps HERO_PAD (more when a mark is drawn on it).
  const inset = pad - WORD_PAD;
  const zone: Box = { x: band.x + inset, y: band.y + inset, width: band.width - 2 * inset, height: band.height - inset };
  const per = scaled(m, 1);
  const room = zone.height - 2 * HEAD_CLEARANCE;
  const limits = {
    height: room / Math.max(per.ascent + per.descent, 1e-6),
    width: zone.width / Math.max(per.leftW + per.rightW + 0.6, 1e-6),
  };
  const size = cap(Math.min(limits.height, limits.width, HERO.maxSize));
  if (!(size >= HERO.minAboveSize)) {
    return { mode: 'none', reason: `the free band above the head is ${Math.round(zone.height)}px high, the word would be ${Math.max(0, size)}px (minimum ${HERO.minAboveSize}px)` };
  }
  const k = scaled(m, size);
  const barFinal = Math.max(size * 0.6, Math.min(size * MAX_BAR_EM, zone.width - k.leftW - k.rightW));
  const inkHeight = k.ascent + k.descent;
  const top = zone.y + (zone.height - inkHeight) / 2;
  return { mode: 'above', size, barFinal, cx: zone.x + zone.width / 2, baselineY: top + k.ascent };
}

/** The bar's length at progress p (0 to 1): from a short stub to its rest length, fast at first and settling softly. */
export function barLength(progress: number, plan: Pick<HeroPlan, 'size' | 'barFinal'>): number {
  const p = Math.min(1, Math.max(0, progress));
  const eased = p >= 1 ? 1 : 1 - Math.pow(2, -10 * p);
  const start = BAR_START_EM * plan.size;
  return start + (plan.barFinal - start) * eased;
}
