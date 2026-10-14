// Grid Glide motion law and material constants.
//
// Node-safe: no imports, no JSX, erasable TypeScript only, so plain Node 22 can load it before
// `npm ci` and the tests can exercise every number. All frames are SCENE-RELATIVE: 0 is the first
// frame of the scene that calls the function. A hard cut therefore has no maths of its own.
//
// The law is authored at 30 fps. Every frame count in this file is a 30 fps count, and every function
// that depends on one takes the edit's frame rate as its LAST parameter (default 30) and stretches the
// count by fps / 30. At 30 fps nothing changes, to the last digit. Pixel values never scale.

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/* ------------------------------------------------------------------ frame rate */

/** The frame rate the motion law is authored at. */
export const REFERENCE_FPS = 30;

const assertFps = (fps: number): void => {
  if (!Number.isFinite(fps) || fps <= 0) throw new Error(`grid-glide: the frame rate must be a positive number, got ${fps}.`);
};

/** A count of 30 fps frames at `fps`: 15 stays 15 at 30 fps and becomes 30 at 60 fps. */
export const scale = (n: number, fps: number = REFERENCE_FPS): number => {
  if (fps === REFERENCE_FPS) return n;
  assertFps(fps);
  return (n * fps) / REFERENCE_FPS;
};

/** The inverse of `scale`: a distance of `n` frames at `fps`, in 30 fps frames. */
export const unscale = (n: number, fps: number = REFERENCE_FPS): number => {
  if (fps === REFERENCE_FPS) return n;
  assertFps(fps);
  return (n * REFERENCE_FPS) / fps;
};

/** Whole frames a 30 fps count needs at `fps`, rounded up: the shortest scene that holds it. */
export const framesAtFps = (n: number, fps: number = REFERENCE_FPS): number => Math.ceil(scale(n, fps) - 1e-9);

/* ------------------------------------------------------------------ easing */

/** cubic-bezier(0,0,0,1) in closed form: the one entrance curve (words, scenes, pill). */
export const OUT = (t: number): number => {
  const x = clamp01(t);
  return 3 * Math.cbrt(x * x) - 2 * x;
};

/** cubic-bezier(1,0,1,1) in closed form: the one exit curve. */
export const IN = (t: number): number => 1 - OUT(1 - t);

const bezier = (x1: number, y1: number, x2: number, y2: number, x: number): number => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let lo = 0;
  let hi = 1;
  let u = x;
  for (let i = 0; i < 40; i++) {
    u = (lo + hi) / 2;
    const bx = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u;
    if (bx < x) lo = u;
    else hi = u;
  }
  return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
};

/** cubic-bezier(0.05, 0.15, 0.2, 1): the box-line wipe. */
export const WIPE = (t: number): number => bezier(0.05, 0.15, 0.2, 1, clamp01(t));

/** One continuous wipe: 7.5 frames per word plus half a frame (at 30 fps). */
export const wipeFrames = (words: number, fps: number = REFERENCE_FPS): number => scale(7.5 * words + 0.5, fps);

/* ------------------------------------------------------------------- timing */

/** Entrance and exit lengths in 30 fps frames. */
export const ENTER_FRAMES = 30;
export const EXIT_FRAMES = 15;

/** Rise per scene type: px of offset A at the first frame. */
export const RISE = { stack: 130, caption: 80 } as const;
/** Frames between two word starts, at 30 fps. */
export const CADENCE = { opening: 6, stack: 7, caption: 6.5, recap: 7.5, bullet: 5 } as const;
/** Scene travel in px: slide-in 400 (500 allowed), horizontal push 400, vertical push 200. */
export const SLIDE = { enter: 400, enterWide: 500, exitH: 400, exitV: 200 } as const;

/** Word progress. p(start) = 0 (invisible), the first drawn frame is floor(start) + 1. Settles after 30 x fps / 30 frames. */
export const wordProgress = (f: number, start: number, fps: number = REFERENCE_FPS): number =>
  OUT((f - start) / scale(ENTER_FRAMES, fps));

/** Start frames of `count` words: first, first + step, first + 2 step ... (fractions allowed). `step` is a 30 fps rhythm. */
export const cadence = (count: number, first: number, step: number, fps: number = REFERENCE_FPS): number[] => {
  const gap = scale(step, fps);
  return Array.from({ length: count }, (_, i) => first + i * gap);
};

/** Entering container offset in px at scene frame f. Frame 0 shows the full offset A. */
export const enterOffset = (f: number, A: number, fps: number = REFERENCE_FPS): number =>
  A * (1 - OUT(f / scale(ENTER_FRAMES, fps)));

/** Leaving container offset in px. t0 is the frame BEFORE the first moving frame; t0 + 15 x fps / 30 is the next scene. */
export const exitOffset = (f: number, t0: number, D: number, fps: number = REFERENCE_FPS): number =>
  D * IN((f - t0) / scale(EXIT_FRAMES, fps));

/** Bullet words slide horizontally toward the star by about one and a half times the font size. */
export const bulletSlide = (size: number): number => Math.round(1.5 * size);

/* ---------------------------------------------------------------------- dip */

/** Dip window in 30 fps frames: blur peaks at 15 px, five frames before and five frames after the boundary. */
export const DIP = { peak: 15, before: 5, after: 5 } as const;

/**
 * Dip boundary B = the first frame of the INCOMING scene. At 30 fps the outgoing scene renders B-5 .. B-1
 * (blur rising) and the incoming scene renders B .. B+4 (blur falling). The blur is
 * 15 sin(pi (v + 5) / 10), where v is the time from the boundary in 30 fps frames plus half a 30 fps frame
 * (v = f - B + 0.5 at 30 fps). At 30 fps that is 15 sin(pi (k + 0.5) / 10) with k = f - (B - 5), so the two
 * middle frames carry the 14.8 px peak. The half frame is a 30 fps half frame at every rate, so frame 2k at
 * 60 fps shows exactly what frame k shows at 30 fps (the same picture at the same second); the 60 fps window
 * is ten frames out and nine in.
 */
export const dipBlur = (f: number, boundary: number, fps: number = REFERENCE_FPS): number => {
  const v = unscale(f - boundary, fps) + 0.5;
  return v >= -DIP.before && v < DIP.after ? DIP.peak * Math.sin((Math.PI * (v + DIP.before)) / (DIP.before + DIP.after)) : 0;
};

/** Vignette bump as a fraction of its peak; index 0 is the frame B - 5, the peak is B - 1 (at 30 fps). */
export const VIGNETTE_BUMP = [0.12, 0.4, 0.69, 0.93, 1, 0.93, 0.7, 0.38, 0.14] as const;

/** The same table with a zero at each end: 11 steps for the frames B - 6 .. B + 4 at 30 fps. */
export const VIGNETTE_STEPS: readonly number[] = [0, ...VIGNETTE_BUMP, 0];

/**
 * Layer opacity of the vignette (the corner colour carries the 0.24 black). The 11-step table is sampled by
 * time with linear interpolation, on the same clock as the blur: the frame that is B - 1 at 30 fps reads the
 * peak step, and frame 2k at 60 fps reads what frame k reads at 30 fps. At 30 fps every frame lands exactly on a step.
 */
export const vignetteOpacity = (f: number, boundary: number, fps: number = REFERENCE_FPS): number => {
  const position = DIP.before + unscale(f - boundary, fps) + 1;
  if (position <= 0 || position >= VIGNETTE_STEPS.length - 1) return 0;
  const low = Math.floor(position);
  const fraction = position - low;
  return fraction === 0
    ? VIGNETTE_STEPS[low]
    : VIGNETTE_STEPS[low] + (VIGNETTE_STEPS[low + 1] - VIGNETTE_STEPS[low]) * fraction;
};

/* ------------------------------------------------------------- scene motion */

export type PushDir = 'left' | 'right' | 'up' | 'down';
export type EnterSpec =
  | { kind: 'cut' }
  | { kind: 'slide'; from: 'left' | 'right'; distance?: number }
  | { kind: 'dip' };
export type ExitSpec = { kind: 'cut' } | { kind: 'push'; dir: PushDir } | { kind: 'dip' };
export type SceneMotionState = { dx: number; dy: number; blur: number };

/** Direction of travel while leaving. Horizontal pushes travel 400 px, vertical pushes 200 px. */
export const pushVector = (dir: PushDir): { x: number; y: number; D: number } =>
  dir === 'left'
    ? { x: -1, y: 0, D: SLIDE.exitH }
    : dir === 'right'
      ? { x: 1, y: 0, D: SLIDE.exitH }
      : dir === 'up'
        ? { x: 0, y: -1, D: SLIDE.exitV }
        : { x: 0, y: 1, D: SLIDE.exitV };

/**
 * Translation and dip blur of a whole scene at scene frame f. A push moves the scene during its
 * last 15 frames (the 15th frame is the next scene); a slide-in covers the first 30 frames. Both counts
 * are 30 fps counts: at 60 fps the push takes 30 frames and the slide-in 60.
 */
export const sceneMotionState = (
  f: number,
  duration: number,
  enter: EnterSpec,
  exit: ExitSpec,
  fps: number = REFERENCE_FPS,
): SceneMotionState => {
  if (!Number.isInteger(duration) || duration < 1) {
    throw new Error(`grid-glide: a scene needs a positive whole number of frames, got ${duration}.`);
  }
  const pushFrames = framesAtFps(EXIT_FRAMES, fps);
  const dipFrames = framesAtFps(DIP.before, fps);
  if (exit.kind === 'push' && duration < pushFrames) {
    throw new Error(`grid-glide: a push exit needs at least ${pushFrames} frames, the scene has ${duration}.`);
  }
  if (exit.kind === 'dip' && duration < dipFrames) {
    throw new Error(`grid-glide: a dip exit needs at least ${dipFrames} frames, the scene has ${duration}.`);
  }
  let dx = 0;
  let dy = 0;
  let blur = 0;
  if (enter.kind === 'slide') {
    const offset = enterOffset(f, enter.distance ?? SLIDE.enter, fps);
    dx += enter.from === 'left' ? -offset : offset;
  } else if (enter.kind === 'dip') {
    blur = Math.max(blur, dipBlur(f, 0, fps));
  }
  if (exit.kind === 'push') {
    const t0 = duration - scale(EXIT_FRAMES, fps);
    if (f > t0) {
      const v = pushVector(exit.dir);
      const offset = exitOffset(f, t0, v.D, fps);
      dx += v.x * offset;
      dy += v.y * offset;
    }
  } else if (exit.kind === 'dip') {
    blur = Math.max(blur, dipBlur(f, duration, fps));
  }
  return { dx, dy, blur };
};

/* ------------------------------------------------------------------ box line */

export const BOX = { width: 830, fit: 0.95, height: 1.45, min: 48 } as const;

/** Percent of the box still hidden at frame f: 100 before the wipe starts, 0 when it has finished. */
export const boxHidePercent = (f: number, at: number, words: number, fps: number = REFERENCE_FPS): number =>
  f <= at ? 100 : (1 - WIPE((f - at) / wipeFrames(words, fps))) * 100;

/* --------------------------------------------------------------- pill, sparkle */

// Each side lists its 1 px layers from the outer edge inwards, as hex without '#'.
const bevel = (top: string, left: string, bottom: string, right: string): string => {
  const rows = (axis: 'top' | 'left' | 'bottom' | 'right', hexes: string): string[] =>
    hexes.split(' ').map((hex, i) => {
      const n = i + 1;
      return axis === 'top'
        ? `inset 0 ${n}px 0 0 #${hex}`
        : axis === 'left'
          ? `inset ${n}px 0 0 0 #${hex}`
          : axis === 'bottom'
            ? `inset 0 -${n}px 0 0 #${hex}`
            : `inset -${n}px 0 0 0 #${hex}`;
    });
  return [...rows('top', top), ...rows('left', left), ...rows('bottom', bottom), ...rows('right', right)].join(', ');
};

/** Bevelled slab: 827 px wide, 9 px bevel ring around a 15 px-radius screen, shadow right and below only. */
export const CARD = {
  x: 127,
  w: 827,
  radius: 24,
  inset: 9,
  innerRadius: 15,
  shadow: '15px 15px 27px -3px rgba(0,0,0,.255), 48px 48px 45px 7px rgba(0,0,0,.163)',
  bevel: bevel(
    'fefefe ffffff fefefe fefefe f8f8f8 e4e4e4 e2e2e2 e7e7e7',
    'ffffff ffffff ffffff fefefe efefef e4e4e4 e7e7e7 e8e8e8',
    '8d8d8d 8e8e8e 9b9b9b afafaf cecece e8e8e8 e7e7e7 e4e4e4 eaeaea',
    '5c5c5c 575757 666666 7b7b7b 949494 d4d4d4 e8e8e8 e4e4e4 e9e9e9',
  ),
} as const;

/** The screen area inside a card of the given outer size. */
export const cardInner = (w: number, h: number): { w: number; h: number } => ({
  w: w - 2 * CARD.inset,
  h: h - 2 * CARD.inset,
});

/** Tool pill: slides in from the left over 21.75 frames (30 fps), fades in linearly, label fitted 50-72 px. */
export const PILL = {
  x: 133,
  w: 814,
  h: 176,
  radius: 26,
  tile: 144,
  tileInset: 17,
  tileRadius: 18,
  logoScale: 0.62,
  labelGap: 22,
  /** 814 - 17 - 144 - 22 - 30: the room left for the label between the tile and the right edge. */
  labelSlot: 601,
  label: 72,
  labelMin: 50,
  slide: { from: -660.6, frames: 21.75 },
  fade: { delay: 2.5, frames: 10.8 },
  /** The pill starts this many 30 fps frames after the start of the hero word (see `pillStart`). */
  afterHero: 14.75,
  shadow: '32.2px 26.6px 44.6px 1px rgba(0,0,0,.245), 93.3px 104.3px 91.2px 23.1px rgba(0,0,0,.169)',
  bevel: bevel(
    'fefefe ffffff fefefe fefefe ffffff ffffff ffffff ffffff ffffff fefefe f6f6f6 e9e9e9',
    'fdfdfd ffffff ffffff ffffff ffffff ffffff ffffff ffffff ffffff fefefe f6f6f6 e9e9e9',
    '8d8d8d 8d8d8d 8e8e8e 8e8e8e 8e8e8e 9d9d9d a3a3a3 acacac b6b6b6 c2c2c2 d4d4d4 e0e0e0 e4e4e4',
    '535353 4a4a4a 545454 5d5d5d 616161 686868 747474 7c7c7c 858585 929292 a3a3a3 c4c4c4 e2e2e2',
  ),
} as const;

/** Horizontal offset of the pill in px at scene frame f, for a pill that starts at s. */
// `+ 0` turns the -0 of a settled pill into 0.
export const pillOffset = (f: number, s: number, fps: number = REFERENCE_FPS): number =>
  PILL.slide.from * (1 - OUT((f - s) / scale(PILL.slide.frames, fps))) + 0;

/** Linear opacity of the pill. */
export const pillOpacity = (f: number, s: number, fps: number = REFERENCE_FPS): number =>
  clamp01((f - (s + scale(PILL.fade.delay, fps))) / scale(PILL.fade.frames, fps));

/** Frame where the pill starts: `pillAt` when the scene sets it (already in frames of the edit), else the hero start plus 14.75 frames at 30 fps. */
export const pillStart = (heroAt: number, pillAt: number | undefined, fps: number = REFERENCE_FPS): number =>
  pillAt ?? heroAt + scale(PILL.afterHero, fps);

/** Four-point sparkle bullet marker. `lead` frames (at 30 fps) before its first word it starts to grow. */
export const STAR = { size: 72, gapToText: 52, pitch: 120, growFrames: 8.5, unwindDeg: 16, unwindFrames: 8, lead: 2 } as const;

/** Sparkle scale at t frames after its start: linear growth over 8.5 frames at 30 fps, 0 before the start. */
export const sparkleScale = (t: number, fps: number = REFERENCE_FPS): number =>
  t < 0 ? 0 : Math.min(1, (unscale(t, fps) + 0.5) / STAR.growFrames);

/** Clockwise rotation in degrees: 16 unwinding linearly to 0 at t = 8 frames at 30 fps. */
export const sparkleRotation = (t: number, fps: number = REFERENCE_FPS): number =>
  STAR.unwindDeg * Math.max(0, 1 - Math.max(0, unscale(t, fps)) / STAR.unwindFrames);

/** Bullet rows: star centre x for each reading direction and the smallest font the row may shrink to. */
export const BULLET = { starRtl: 790, starLtr: 200, min: 48 } as const;

/* ------------------------------------------------------------ type and colour */

export const SIZE = { lead: 70, leadSmall: 64, hero: 100, heroBig: 124, chapter: 142, cta: 150, box: 88, bullet: 64 } as const;
export const WEIGHT = { lead: 500, hero: 700, chapter: 680, accent: 650, box: 650, label: 700, watermark: 650 } as const;
/** Inter optical size. Applied the same way when measuring and when rendering. */
export const OPTICAL_SIZE = 20;
/** Word gap in em and the line-height every line, box and bullet row is laid out with. */
export const GAP = 0.26;
export const LINE_HEIGHT = 1.3;

export const COLOR = {
  canvas: '#F2F2F2',
  ink: '#242424',
  box: '#262626',
  boxText: '#F4F4F4',
  grid: '#CECECE',
  pillFace: '#E5E5E5',
  pillInk: '#191919',
  cardFace: '#F9F9F7',
  screen: '#FFFFFF',
  watermark: 'rgba(0,0,0,0.124)',
  vignette: 'rgba(0,0,0,0.24)',
} as const;

/** Faint centred text near the bottom edge. It never moves with the scene. Drawn at `size`, shrunk to `min` for a long text; wider than that fails the render. */
export const WATERMARK = { y: 1617, size: 75, min: 36, tracking: '-0.049em', weight: 650 } as const;

/* ---------------------------------------------------------------------- grid */

/** Dashed hook grid: 7 columns by 9 rows around the canvas centre, dots at the crossings. */
export const GRID = {
  spacing: 128,
  columns: 7,
  rows: 9,
  centerX: 540,
  centerY: 960,
  stroke: 2.5,
  dashV: '5 6',
  dashH: '6 6',
  dot: 6.5,
} as const;

export const gridGeometry = (
  spacing: number = GRID.spacing,
): { xs: number[]; ys: number[]; x0: number; x1: number; y0: number; y1: number } => {
  const xs = Array.from({ length: GRID.columns }, (_, i) => GRID.centerX + (i - (GRID.columns - 1) / 2) * spacing);
  const ys = Array.from({ length: GRID.rows }, (_, j) => GRID.centerY + (j - (GRID.rows - 1) / 2) * spacing);
  const over = spacing / 2;
  return { xs, ys, x0: xs[0] - over, x1: xs[xs.length - 1] + over, y0: ys[0] - over, y1: ys[ys.length - 1] + over };
};

/* --------------------------------------------------------------- card media */

/** Index of the clip on screen at frame f: the last clip whose cut is at or before f. Clip 0 is on screen from frame 0. */
export const clipIndexAt = (ats: readonly number[], f: number): number => {
  let index = 0;
  for (let i = 1; i < ats.length; i++) if (f >= ats[i]) index = i;
  return index;
};

/** Frames [start, end) during which clip i is on screen; the last clip ends at `until`. */
export const clipWindow = (ats: readonly number[], i: number, until: number): { start: number; end: number } => ({
  start: i === 0 ? 0 : ats[i],
  end: i + 1 < ats.length ? ats[i + 1] : until,
});

/** Scale a still so it covers the screen area; the overflow is centred sideways and scrollable down. */
export const coverFit = (
  srcW: number,
  srcH: number,
  boxW: number,
  boxH: number,
): { width: number; height: number; left: number; rangeY: number } => {
  if (!(srcW > 0 && srcH > 0 && boxW > 0 && boxH > 0)) {
    throw new Error(`grid-glide: cannot fit ${srcW}x${srcH} into ${boxW}x${boxH}.`);
  }
  const scale = Math.max(boxW / srcW, boxH / srcH);
  const width = srcW * scale;
  const height = srcH * scale;
  return { width, height, left: (boxW - width) / 2, rangeY: Math.max(0, height - boxH) };
};

/** Downward scroll in px of a still at frame f: linear from `scroll.from` to `scroll.to` of the scrollable range. */
export const scrollOffset = (
  range: number,
  scroll: { from: number; to: number } | undefined,
  f: number,
  span: { start: number; end: number },
): number => {
  if (!scroll || range <= 0) return 0;
  const t = clamp01((f - span.start) / Math.max(1, span.end - span.start));
  return range * (scroll.from + (scroll.to - scroll.from) * t);
};

/* -------------------------------------------------------------------- fitting */

/**
 * Largest whole font size in [min, max] whose measured width fits `within`. `fits` is false (and
 * `size` is `min`) when even the smallest size is too wide, so the caller can fail loudly.
 */
export const largestFit = (
  widthAt: (size: number) => number,
  within: number,
  min: number,
  max: number,
): { size: number; width: number; fits: boolean } => {
  let lo = Math.ceil(min);
  let hi = Math.floor(max);
  if (hi < lo) throw new Error(`grid-glide: the font range ${min}-${max} is empty.`);
  if (widthAt(lo) > within) return { size: lo, width: widthAt(lo), fits: false };
  while (lo < hi) {
    const mid = lo + Math.ceil((hi - lo) / 2);
    if (widthAt(mid) <= within) lo = mid;
    else hi = mid - 1;
  }
  return { size: lo, width: widthAt(lo), fits: true };
};
