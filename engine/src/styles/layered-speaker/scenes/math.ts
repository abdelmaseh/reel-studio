// Layered speaker: the constants, the zones around the head, the timing and the sound cues that the renderer, the scripts and the
// tests share. Node-safe (scripts import it before `npm ci`): no packages, no JSX, only Node-safe imports.
import { HEAD_CLEARANCE, type HeadBoxPx } from '../../../creative-kit/head-clear.ts';
import { ROUGH_KINDS, roughDrawFrames, roughMark, type RoughDir, type RoughKind } from '../../../creative-kit/marks/rough.ts';

export const LAYERED_FAMILIES = ['layered-speaker'] as const;
export type LayeredFamily = (typeof LAYERED_FAMILIES)[number];

/**
 * Where a word goes. `behind` is the big word whose bar passes behind the head (the speaker is cut out in front of it);
 * `above` is a line over the head; `left` and `right` sit beside the head, in front of the picture.
 */
export const PLACES = ['behind', 'above', 'left', 'right'] as const;
export type Place = (typeof PLACES)[number];
export const MARK_KINDS = ROUGH_KINDS;

export const LIMITS = { words: 4, marks: 2, behindChars: 12, lineChars: 26 } as const;

/** The Instagram Reels organic safe area the delivery gate checks (a test keeps these equal to the platform file). */
export const SAFE = { top: 250, bottom: 1470, left: 65, right: 1015, railX: 853, railY: 1150 } as const;

export type Box = { x: number; y: number; width: number; height: number };

/** Used when the head guide could not measure the scene. A close-up talking head sits about here. */
export const DEFAULT_HEAD: HeadBoxPx = { x: 360, y: 520, width: 360, height: 440 };

/** Words keep this far inside the safe zone, so the outline and the shadow stay inside it too. The big word keeps more (its shadow is larger). */
export const WORD_PAD = 14;
export const HERO_PAD = 30;
/** The extra room the big word keeps from the safe edge when a mark is drawn on it (an underline runs past the ends of the word). */
export const HERO_MARK_PAD = 60;

/** The bar passes this far beyond the head on each side. */
export const MATTE_MARGIN = 36;
export const SIDE = { gap: 28, minWidth: 150, maxWidth: 420, height: 170 } as const;
export const ABOVE = { height: 170 } as const;
export const HERO = { minSize: 140, minAboveSize: 120, maxSize: 340 } as const;
/** Everything the style draws stays above this row, clear of the caption band at y 1370. */
export const SIDE_FLOOR = 1100;

export const TIMING = { landSeconds: 0.2, barSeconds: 0.7, holdSeconds: 0.6, exitSeconds: 0.2 } as const;
export const frames = (seconds: number, fps: number): number => Math.max(1, Math.round(seconds * fps));

export type LayeredWord = { place: Place; text: string; atFrame: number; accent?: boolean; mark?: { kind: (typeof MARK_KINDS)[number]; atFrame: number } };
export type LayeredData = { words: LayeredWord[]; foreground?: unknown };

const headOrDefault = (head: HeadBoxPx | null | undefined): HeadBoxPx => head ?? DEFAULT_HEAD;

export type Zones = { head: HeadBoxPx; above: Box; left: Box; right: Box };

/** The free areas around the head box: the band above it and the two strips beside it. A zone with no room has width or height 0. */
export function zonesFor(headBox: HeadBoxPx | null | undefined): Zones {
  const head = headOrDefault(headBox);
  const left = SAFE.left + WORD_PAD;
  const right = SAFE.right - WORD_PAD;
  const topLimit = SAFE.top + WORD_PAD;
  const aboveHeight = Math.max(0, head.y - HEAD_CLEARANCE - topLimit);
  const top = topLimit;
  const bottom = SIDE_FLOOR;
  const leftWidth = Math.max(0, head.x - SIDE.gap - left);
  const rightX = head.x + head.width + SIDE.gap;
  return {
    head,
    above: { x: left, y: topLimit, width: right - left, height: aboveHeight },
    left: { x: left, y: top, width: leftWidth, height: Math.max(0, bottom - top) },
    right: { x: rightX, y: top, width: Math.max(0, right - rightX), height: Math.max(0, bottom - top) },
  };
}

/** The rows the big word's letters occupy; words beside the head keep out of them so the letters are never covered. */
export type HeroBand = { top: number; bottom: number };
/** Space kept between the big word's letters and a word beside them. */
export const BAND_GAP = 24;
/** The same, for a word that carries a mark: a circle or a band reaches about this far past the text. */
export const BAND_GAP_MARKED = 64;

/**
 * The box of a word beside the head, or null when the strip is too narrow to read in. Without a big word the left word rides at
 * the eyes and the right one lower, so two of them stagger. With a big word (its rows given as `band`) the left word sits above the
 * letters and the right one below them, each hugging the band, so the three words circle the head without touching.
 */
export function sideBox(zones: Zones, place: 'left' | 'right', band: HeroBand | null = null, marked = false): Box | null {
  const zone = zones[place];
  const width = Math.min(zone.width, SIDE.maxWidth);
  if (width < SIDE.minWidth || zone.height < SIDE.height) return null;
  const x = place === 'left' ? zone.x + zone.width - width : zone.x;
  if (band === null) {
    const centre = zones.head.y + zones.head.height * (place === 'left' ? 0.3 : 0.72);
    const y = Math.min(zone.y + zone.height - SIDE.height, Math.max(zone.y, centre - SIDE.height / 2));
    return { x, y, width, height: SIDE.height };
  }
  const gap = marked ? BAND_GAP_MARKED : BAND_GAP;
  const over = { from: zone.y, to: band.top - gap };
  const under = { from: band.bottom + gap, to: zone.y + zone.height };
  for (const slot of place === 'left' ? [over, under] : [under, over]) {
    if (slot.to - slot.from < SIDE.height) continue;
    return { x, y: slot === over ? slot.to - SIDE.height : slot.from, width, height: SIDE.height };
  }
  return null;
}

/** The box of a line above the head, or null when the band over the head is too low. */
export function aboveBox(zones: Zones, hasHero: boolean): Box | null {
  const zone = zones.above;
  if (zone.height < ABOVE.height * 0.6) return null;
  const height = Math.min(ABOVE.height, zone.height - HEAD_CLEARANCE);
  // With a hero word behind the head, the line over the head sits right above the head box; otherwise it takes the band's centre.
  const y = hasHero ? zones.head.y - HEAD_CLEARANCE - height : zone.y + (zone.height - height) / 2;
  return { x: zone.x, y: Math.max(zone.y, y), width: zone.width, height };
}

/** Frames the scene needs: every word on screen for the hold time, every mark fully drawn and held a moment. */
export function layeredMinFrames(data: LayeredData, fps: number): number {
  let need = frames(1.2, fps);
  for (const word of data.words) {
    need = Math.max(need, word.atFrame + frames(TIMING.holdSeconds, fps));
    if (word.mark) need = Math.max(need, word.mark.atFrame + roughDrawFrames(word.mark.kind, fps) + frames(0.3, fps));
  }
  return need;
}

export type LayeredCue = { frame: number; kind: 'reveal' | 'swap' };

/**
 * The real state changes that earn a sound: the big word landing (reveal) and a hand-drawn mark touching down (swap).
 * Words beside the head, and the bar growing, stay silent.
 */
export function layeredCues(data: LayeredData, _fps: number): LayeredCue[] {
  const cues: LayeredCue[] = [];
  // Called from scripts with loosely typed scene data, so every field is checked before it is trusted.
  const words: Partial<LayeredWord>[] = Array.isArray(data?.words) ? data.words : [];
  for (const word of words) {
    if (word?.place === 'behind' && Number.isFinite(word.atFrame)) cues.push({ frame: word.atFrame as number, kind: 'reveal' });
    if (word?.mark && Number.isFinite(word.mark.atFrame)) cues.push({ frame: word.mark.atFrame, kind: 'swap' });
  }
  return cues.sort((a, b) => a.frame - b.frame);
}

/**
 * Room kept beside the text of a marked word, on each side, for the stroke: a loop or a band reaches further past the text than a line does.
 * A marked word's text block is also no taller than MARKED_HEIGHT, because the loop and the band grow with the height of the text.
 */
const ROOM_BY_KIND: Record<RoughKind, number> = { circle: 44, band: 32, arrow: 36, strike: 24, underline: 24 };
export const markRoom = (kind: RoughKind): number => ROOM_BY_KIND[kind];
export const MARKED_HEIGHT = 112;

/** Marks that fit around the big word: a circle or an arrow would run past the sides of the safe area at that width. */
export const HERO_MARKS: readonly RoughKind[] = ['underline', 'band', 'strike'];

/** True when a stroke box stays inside the safe area, including the action rail on the right below y 1150. */
export function insideSafe(box: { left: number; top: number; width: number; height: number }): boolean {
  const right = box.left + box.width;
  const bottom = box.top + box.height;
  if (box.left < SAFE.left || box.top < SAFE.top || right > SAFE.right || bottom > SAFE.bottom) return false;
  return !(bottom > SAFE.railY && right > SAFE.railX);
}

/**
 * Where a hand-drawn mark can go: the reading direction first, then the mirrored one (an arrow swings in from the other side), and
 * for an arrow from below the word first, then from above it; whichever keeps the whole stroke inside the safe area and out of the rows
 * of the big word (`avoid`), so a mark on a side word never runs across the big letters. null when none does.
 */
export function fitMark(kind: RoughKind, rect: Box, dir: RoughDir, seed: string, avoid: HeroBand | null = null): { dir: RoughDir; from: 'below' | 'above'; box: { left: number; top: number; width: number; height: number } } | null {
  const sides: RoughDir[] = [dir, dir === 'rtl' ? 'ltr' : 'rtl'];
  const ways: ('below' | 'above')[] = kind === 'arrow' ? ['below', 'above'] : ['below'];
  for (const from of ways) {
    for (const side of sides) {
      const { box } = roughMark(kind, rect, side, { seed, from });
      const crosses = avoid !== null && box.top < avoid.bottom && box.top + box.height > avoid.top;
      if (insideSafe(box) && !crosses) return { dir: side, from, box };
    }
  }
  return null;
}
