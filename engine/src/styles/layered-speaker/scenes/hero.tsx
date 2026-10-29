// The big word. It is drawn on a canvas, once as a bitmap and then in three parts (letters left of the bar, the bar, letters right of it),
// so only the kashida bar grows and the Arabic letters keep their joined shapes. Nothing here splits a word into per-letter elements.
//
// Behind the head, the bar covers the head plus a margin and the letters stay visible on both sides; the matte (drawn above this layer)
// then hides the bar wherever the speaker is. Without a matte the same word sits above the head instead.
import React from 'react';
import { continueRender, delayRender } from 'remotion';
import { kashidaSlots } from '../../../arabic/kashida.ts';
import { rasterLine } from '../../../arabic/segment.ts';
import { useFontsReady } from '../../../arabic/fonts.tsx';
import { clamp01, useClock } from '../../../core/motion';
import { useProbe } from '../../../core/safe';
import { MarkStroke } from '../../../creative-kit/marks/MarkStroke';
import type { RoughKind } from '../../../creative-kit/marks/rough.ts';
import { HERO_MARK_PAD, HERO_PAD, MATTE_MARGIN, TIMING, fitMark, frames, type HeroBand, type Zones } from './math.ts';
import { analyzeStretch, barLength, planAbove, planBehind, scaled, STRETCH_TATWEELS, type HeroPlan, type StretchMetrics } from './stretch.ts';

type Source = { metrics: StretchMetrics; raster: CanvasImageSource & { width: number; height: number }; fills: Map<string, HTMLCanvasElement> };

const sources = new Map<string, Source | null>();
const REFERENCE_SIZE = 200;
const TATWEEL = 'ـ';

/** True where a canvas can be made: a real browser page. Static markup in tests has no canvas. */
export const canvasAvailable = (): boolean => {
  try {
    return typeof document !== 'undefined' && typeof document.createElement === 'function' && typeof document.createElement('canvas').getContext === 'function';
  } catch {
    return false;
  }
};

/** The word drawn with a long bar at `slot` (the index of the letter the tatweels follow), cut into its parts. Cached per word, face, size and slot. */
export function buildSource(text: string, font: string, size: number, slot: number): Source | null {
  const key = `${font}|${size}|${slot}|${text}`;
  if (sources.has(key)) return sources.get(key) ?? null;
  let result: Source | null = null;
  const word = text.slice(0, slot + 1) + TATWEEL.repeat(STRETCH_TATWEELS) + text.slice(slot + 1);
  const scratch = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
  const raster = rasterLine(scratch, word, font, size);
  const image = (raster.canvas.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, raster.width, raster.height);
  const metrics = analyzeStretch(image, size, raster.baseline);
  if (metrics) result = { metrics, raster: raster.canvas as Source['raster'], fills: new Map() };
  sources.set(key, result);
  return result;
}

/**
 * Which connection the bar goes in. The kashida rules give the legal ones; of those, the one that leaves the two groups of letters
 * closest in width wins, because the larger group decides how big the word can be. The rules' own order breaks a tie.
 */
export function bestSlot(text: string, font: string): { slot: number; metrics: StretchMetrics } | null {
  let best: { slot: number; metrics: StretchMetrics; score: number } | null = null;
  kashidaSlots(text).forEach((candidate, rank) => {
    const source = buildSource(text, font, REFERENCE_SIZE, candidate.index);
    if (!source) return;
    const k = scaled(source.metrics, 1);
    const score = Math.max(k.leftW, k.rightW) + rank * 0.002;
    if (best === null || score < best.score) best = { slot: candidate.index, metrics: source.metrics, score };
  });
  return best === null ? null : { slot: (best as { slot: number }).slot, metrics: (best as { metrics: StretchMetrics }).metrics };
}

const fillFor = (source: Source, color: string): HTMLCanvasElement => {
  const hit = source.fills.get(color);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = source.raster.width;
  canvas.height = source.raster.height;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.drawImage(source.raster, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  source.fills.set(color, canvas);
  return canvas;
};

/** One copy of the word with a bar `length` pixels long, offset by dx, dy. */
function stamp(ctx: CanvasRenderingContext2D, tint: HTMLCanvasElement, m: StretchMetrics, plan: HeroPlan, length: number, dx: number, dy: number): void {
  const leftW = m.bar.x0 - m.ink.left;
  const rightW = m.ink.right - m.bar.x1;
  const x0 = Math.round(plan.cx - length / 2 - leftW + dx);
  const y0 = Math.round(plan.baselineY - m.baseline + dy);
  const mid = Math.floor((m.bar.x0 + m.bar.x1) / 2);
  ctx.drawImage(tint, m.ink.left, 0, leftW, m.height, x0, y0, leftW, m.height);
  // The middle of the bar is flat, so one thin slice of it, stretched, is the bar. A pixel of overlap each side hides the seam.
  ctx.drawImage(tint, mid, 0, 2, m.height, x0 + leftW - 1, y0, Math.round(length) + 2, m.height);
  ctx.drawImage(tint, m.bar.x1, 0, rightW, m.height, x0 + leftW + Math.round(length), y0, rightW, m.height);
}

export const HERO_COLORS = { outline: '#0B0E13', shadow: '#05070A' } as const;

function paint(ctx: CanvasRenderingContext2D, source: Source, plan: HeroPlan, length: number, fill: string, alpha: number, pop: number): void {
  const { metrics: m } = source;
  const outline = fillFor(source, HERO_COLORS.outline);
  const shadow = fillFor(source, HERO_COLORS.shadow);
  const ink = fillFor(source, fill);
  const r = Math.max(3, plan.size * 0.022);
  ctx.save();
  ctx.clearRect(0, 0, 1080, 1920);
  if (pop !== 1) {
    const px = plan.cx;
    const py = plan.baselineY - plan.size * 0.3;
    ctx.translate(px, py);
    ctx.scale(pop, pop);
    ctx.translate(-px, -py);
  }
  // Soft shadow, hard shadow, outline, fill: a heavy sticker that stays readable on any picture.
  ctx.filter = `blur(${Math.round(plan.size * 0.05)}px)`;
  ctx.globalAlpha = alpha * 0.35;
  stamp(ctx, shadow, m, plan, length, 0, plan.size * 0.07);
  ctx.filter = 'none';
  ctx.globalAlpha = alpha * 0.5;
  stamp(ctx, shadow, m, plan, length, plan.size * 0.03, plan.size * 0.05);
  ctx.globalAlpha = alpha;
  for (const [ring, count] of [[r, 16], [r * 0.5, 8]] as const) {
    for (let i = 0; i < count; i++) stamp(ctx, outline, m, plan, length, Math.cos((i * 2 * Math.PI) / count) * ring, Math.sin((i * 2 * Math.PI) / count) * ring);
  }
  stamp(ctx, ink, m, plan, length, 0, 0);
  ctx.restore();
}

export type HeroLayout = {
  plan: HeroPlan;
  source: Source;
  /** The rows the letters occupy at rest, for the words beside the head to keep out of. */
  band: HeroBand;
  /** The word's ink box at rest: letters, bar and letters. */
  box: { x: number; y: number; width: number; height: number };
};

/**
 * Measures the big word and plans where it goes. null until a browser can draw it (and while the fonts load); throws a plain-language
 * error when the word cannot be placed, so the render stops instead of drawing a broken word.
 */
export function useHeroLayout(text: string | null, mode: 'behind' | 'above', zones: Zones, family: string, marked = false): HeroLayout | null {
  const drawing = canvasAvailable();
  const ready = useFontsReady([family]);
  const font = `900 ${family}`;
  return React.useMemo(() => {
    if (text === null || !drawing || !ready) return null;
    const best = bestSlot(text, font);
    if (best === null) throw new Error(`layered-speaker: "${text}" has no connection to stretch; use an Arabic word of three letters or more whose letters join, in a font with a flat connection bar (Cairo is tested).`);
    const pad = marked ? HERO_MARK_PAD : HERO_PAD;
    const plan = mode === 'behind' ? planBehind(best.metrics, zones.head, MATTE_MARGIN, pad) : planAbove(best.metrics, zones.above, pad);
    if (plan.mode === 'none') {
      throw new Error(`layered-speaker: "${text}" does not fit ${mode === 'behind' ? 'around the head' : 'above the head'}: ${plan.reason}. Use a shorter word, or put it beside the head instead.`);
    }
    const source = buildSource(text, font, plan.size, best.slot);
    if (source === null) throw new Error(`layered-speaker: "${text}" could not be drawn at ${plan.size}px.`);
    const k = scaled(source.metrics, source.metrics.size);
    return {
      plan, source,
      band: { top: plan.baselineY - k.ascent, bottom: plan.baselineY + k.descent },
      box: { x: plan.cx - plan.barFinal / 2 - k.leftW, y: plan.baselineY - k.ascent, width: k.leftW + plan.barFinal + k.rightW, height: k.ascent + k.descent },
    };
  }, [text, mode, zones, font, drawing, ready, marked]);
}

export const HeroWord: React.FC<{
  text: string;
  mode: 'behind' | 'above';
  layout: HeroLayout | null;
  atFrame: number;
  fill: string;
  mark?: { kind: RoughKind; atFrame: number };
  markColor: string;
  seed: string;
}> = ({ text, mode, layout, atFrame, fill, mark, markColor, seed }) => {
  const { frame, fps } = useClock();
  const probe = useProbe();
  const drawing = canvasAvailable();
  const ref = React.useRef<HTMLCanvasElement>(null);
  const [handle] = React.useState<number | null>(() => (drawing ? delayRender(`layered-speaker: drawing "${text}"`) : null));
  const released = React.useRef(false);

  React.useLayoutEffect(() => {
    const canvas = ref.current;
    if (!drawing || !canvas || !layout) return;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const into = clamp01((frame - atFrame + 1) / frames(TIMING.landSeconds, fps));
    const barProgress = probe ? 1 : clamp01((frame - atFrame - 2) / frames(TIMING.barSeconds, fps));
    paint(ctx, layout.source, layout.plan, barLength(barProgress, layout.plan), fill, probe ? 1 : into, probe ? 1 : 0.92 + 0.08 * into);
    if (handle !== null && !released.current) {
      released.current = true;
      continueRender(handle);
    }
  });

  const markSeed = `${seed}:${text}:${mark?.kind}`;
  const placed = mark && layout ? fitMark(mark.kind, layout.box, 'rtl', markSeed) : null;
  if (mark && layout && placed === null) throw new Error(`layered-speaker: the ${mark.kind} on "${text}" would leave the safe area; use another mark.`);
  const stroke = mark && layout && placed ? <MarkStroke kind={mark.kind} target={layout.box} dir={placed.dir} from={placed.from} at={mark.atFrame} color={markColor} seed={markSeed} /> : null;
  return (
    <div data-layered-hero={mode} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }}>
      {/* A highlighter band goes under the word; every other mark goes over it. */}
      {mark?.kind === 'band' ? stroke : null}
      <canvas ref={ref} width={1080} height={1920} role="img" aria-label={text} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
      {mark?.kind === 'band' ? null : stroke}
    </div>
  );
};
