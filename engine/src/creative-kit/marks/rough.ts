// Hand-drawn marks: a rough, seeded stroke for circle, band, strike, arrow and underline.
//
// Pure and Node-safe (no React, no imports): every number comes from the target rectangle and a seed, so the same word with
// the same seed is drawn the same way in the editor preview, a still and the final render. Frames never change the path;
// only `roughProgress` moves, which is how the stroke "draws on" (see MarkStroke.tsx).
//
// The ideal geometry of each kind (where the line sits, how far a circle reaches) follows `markGeometry` in
// kinetic-words-logic.ts, so a word marked with `Mark` or with `MarkStroke` is marked in the same place. What this module
// adds is the hand: smooth low-frequency wobble across the stroke, a small tilt, an overshoot, and for band and strike a
// second pass that comes back the other way.

export const ROUGH_KINDS = ["underline", "circle", "band", "strike", "arrow"] as const;
export type RoughKind = (typeof ROUGH_KINDS)[number];
export type RoughDir = "rtl" | "ltr";
export type RoughRect = { x: number; y: number; width: number; height: number };
export type RoughPoint = { x: number; y: number };

/** One continuous pen movement. It draws while the whole mark's progress is inside [from, to]. */
export type RoughPass = { d: string; from: number; to: number; opacity: number };

export type RoughStroke = {
  kind: RoughKind;
  passes: RoughPass[];
  strokeWidth: number;
  /** Every sampled point of every pass (on the curve), in canvas pixels. */
  points: RoughPoint[];
  /** Left, top, width and height of the ink including half the stroke width. */
  box: { left: number; top: number; width: number; height: number };
};

export type RoughOptions = {
  /** Same seed, same stroke. Required so that two marks on the same page never share a hand by accident. */
  seed: string;
  /** Pixels. Defaults to `defaultRoughStroke(kind, target.height)`. */
  strokeWidth?: number;
  /** 0 is the clean geometry, 1 a shaky hand. Default 0.5. */
  roughness?: number;
  /** Only an arrow reads this: it comes in from below the word (default) or from above it. */
  from?: 'below' | 'above';
};

/** The default stroke width for a target of this height, the same sizes the plain `Mark` uses. */
export const defaultRoughStroke = (kind: RoughKind, height: number): number => {
  switch (kind) {
    case "band":
      return Math.max(8, Math.round(height * 0.6));
    case "circle":
    case "arrow":
      return Math.max(4, Math.round(height * 0.06));
    default:
      return Math.max(4, Math.round(height * 0.08));
  }
};

/** Draw-on length in seconds. Every kind stays inside 0.3 to 0.5 s: long enough to read as a hand, short enough to keep up with speech. */
export const ROUGH_DRAW_SECONDS: Record<RoughKind, number> = { underline: 0.3, strike: 0.3, arrow: 0.4, band: 0.4, circle: 0.5 };

export function roughDrawFrames(kind: RoughKind, fps: number): number {
  if (!(ROUGH_KINDS as readonly string[]).includes(kind)) throw new Error(`marks: unknown mark kind ${JSON.stringify(kind)}; use one of ${ROUGH_KINDS.join(", ")}.`);
  if (!Number.isFinite(fps) || fps <= 0) throw new Error(`marks: fps must be a positive number, got ${fps}.`);
  return Math.max(1, Math.round(ROUGH_DRAW_SECONDS[kind] * fps));
}

/** 0 before `at`, then eases from slow start to slow end and is exactly 1 on the last draw frame (`at + durFrames - 1`). */
export function roughProgress(frame: number, at: number, durFrames: number): number {
  if (!(durFrames >= 1)) throw new Error(`marks: durFrames must be at least 1, got ${durFrames}.`);
  if (frame < at) return 0;
  const t = Math.min(1, (frame - at + 1) / durFrames);
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

/** How far one pass has been drawn when the whole mark is at `progress`. */
export function passProgress(pass: { from: number; to: number }, progress: number): number {
  if (!(pass.to > pass.from)) return progress >= pass.to ? 1 : 0;
  return Math.min(1, Math.max(0, (progress - pass.from) / (pass.to - pass.from)));
}

const hashSeed = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** A small seeded generator (mulberry32 over an FNV-1a hash of the seed). Values are in [0, 1). */
export function seededRandom(seed: string): () => number {
  let a = hashSeed(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const TAU = Math.PI * 2;
const round1 = (v: number): number => {
  const r = Math.round(v * 10) / 10;
  return r === 0 ? 0 : r;
};
const fmt = (p: RoughPoint): string => `${round1(p.x)} ${round1(p.y)}`;

/** Two sine waves with random phase: smooth along the stroke, different for every seed. `amp` is in pixels. */
const waveFrom = (rand: Rand, amp: number): ((t: number) => number) => {
  const p1 = rand() * TAU;
  const p2 = rand() * TAU;
  const f1 = 1.1 + rand() * 0.9;
  const f2 = 2.4 + rand() * 1.8;
  const mix = 0.7 + rand() * 0.25;
  return (t) => amp * (mix * Math.sin(TAU * f1 * t + p1) + (1 - mix) * Math.sin(TAU * f2 * t + p2));
};

/** An open Catmull-Rom spline through the points, written as cubic Bezier segments. */
function smoothPath(points: readonly RoughPoint[]): string {
  let d = `M ${fmt(points[0])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${fmt(c1)} ${fmt(c2)} ${fmt(p2)}`;
  }
  return d;
}

const count = (length: number, step: number): number => Math.max(6, Math.ceil(length / step));

/** Points along the segment a to b with a perpendicular wobble, a straight tilt and an end flick. */
function line(a: RoughPoint, b: RoughPoint, wave: (t: number) => number, flick: number): RoughPoint[] {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / length;
  const ny = (b.x - a.x) / length;
  const n = count(length, 26);
  const out: RoughPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = wave(t) + flick * Math.pow(t, 4);
    out.push({ x: a.x + (b.x - a.x) * t + nx * w, y: a.y + (b.y - a.y) * t + ny * w });
  }
  return out;
}

const assertInput = (kind: string, target: RoughRect, dir: string, options: RoughOptions): number => {
  if (!(ROUGH_KINDS as readonly string[]).includes(kind)) throw new Error(`marks: unknown mark kind ${JSON.stringify(kind)}; use one of ${ROUGH_KINDS.join(", ")}.`);
  const { x, y, width, height } = target ?? ({} as RoughRect);
  if (![x, y, width, height].every(Number.isFinite) || !(width > 0) || !(height > 0)) {
    throw new Error(`marks: the target rect must be finite with a positive size, got ${JSON.stringify(target)}.`);
  }
  if (dir !== "rtl" && dir !== "ltr") throw new Error(`marks: direction must be "rtl" or "ltr", got ${JSON.stringify(dir)}.`);
  if (typeof options?.seed !== "string" || options.seed === "") throw new Error("marks: a seed (non-empty text) is required so the stroke repeats exactly.");
  const strokeWidth = options.strokeWidth ?? defaultRoughStroke(kind as RoughKind, height);
  if (!Number.isFinite(strokeWidth) || strokeWidth <= 0) throw new Error(`marks: strokeWidth must be positive, got ${options.strokeWidth}.`);
  const roughness = options.roughness ?? 0.5;
  if (!Number.isFinite(roughness) || roughness < 0 || roughness > 1) throw new Error(`marks: roughness must be between 0 and 1, got ${options.roughness}.`);
  return strokeWidth;
};

/**
 * Builds the rough stroke for one mark. `target` is the word's box in the coordinates the stroke will be drawn in; `dir` is the
 * reading direction of the text (an Arabic word is marked from its right end to its left).
 */
export function roughMark(kind: RoughKind, target: RoughRect, dir: RoughDir, options: RoughOptions): RoughStroke {
  const strokeWidth = assertInput(kind, target, dir, options);
  const roughness = options.roughness ?? 0.5;
  const rand = seededRandom(`${options.seed}|${kind}`);
  const { x, y, width: w, height: h } = target;
  const s = dir === "rtl" ? -1 : 1;
  const x0 = dir === "rtl" ? x + w : x;
  const x1 = dir === "rtl" ? x : x + w;
  // Wobble in pixels: grows with the stroke and the word, never with the frame.
  const amp = (0.18 * strokeWidth + 0.012 * h) * roughness * 2;
  const passes: RoughPass[] = [];
  const all: RoughPoint[] = [];
  const push = (points: RoughPoint[], from: number, to: number, opacity = 1): void => {
    passes.push({ d: smoothPath(points), from, to, opacity });
    all.push(...points);
  };

  switch (kind) {
    case "underline": {
      // The stroke runs a little past each end of the word, but never more than 36 px: a long word is not given a longer overshoot.
      const ext = Math.min(36, w * (0.03 + 0.03 * rand()));
      const drop = (rand() - 0.5) * h * 0.1 * roughness * 2;
      const a = { x: x0 - s * ext, y: y + h + strokeWidth * 0.2 };
      const b = { x: x1 + s * ext, y: y + h + strokeWidth * 0.2 + drop };
      push(line(a, b, waveFrom(rand, amp), -h * 0.05 * roughness * 2), 0, 1);
      break;
    }
    case "strike": {
      const ext = Math.min(30, w * (0.02 + 0.03 * rand()));
      const ym = y + h * 0.58;
      const slant = (rand() - 0.5) * h * 0.16 * roughness * 2;
      const a = { x: x0 - s * ext, y: ym - slant / 2 };
      const b = { x: x1 + s * ext, y: ym + slant / 2 };
      push(line(a, b, waveFrom(rand, amp), 0), 0, 0.62);
      // The pen comes back over most of the first line, a little lower: crossed out, not ruled out.
      const along = (f: number): number => x0 + (x1 - x0) * f;
      const c = { x: along(0.96), y: ym + slant / 2 + strokeWidth * 0.8 };
      const d = { x: along(0.06 + 0.06 * rand()), y: ym - slant / 2 + strokeWidth * 0.8 };
      push(line(c, d, waveFrom(rand, amp), 0), 0.5, 1);
      break;
    }
    case "band": {
      // The stroke's round caps reach half its width past each end, so the centre line stops short of the word.
      const pad = h * (-0.2 + 0.06 * rand());
      const ym = y + h * 0.56;
      const tilt = (rand() - 0.5) * h * 0.06 * roughness * 2;
      const a = { x: x0 - s * pad, y: ym - tilt / 2 };
      const b = { x: x1 + s * pad, y: ym + tilt / 2 };
      push(line(a, b, waveFrom(rand, amp * 0.5), 0), 0, 0.62, 0.6);
      // A highlighter goes back and forth: the second pass is a hair lower and a little short, and it overlaps the first.
      const shift = strokeWidth * (0.12 + 0.1 * rand());
      const along = (f: number): number => x0 + (x1 - x0) * f;
      const c = { x: along(0.97), y: ym + tilt / 2 + shift };
      const d = { x: along(0.03 + 0.05 * rand()), y: ym - tilt / 2 + shift };
      push(line(c, d, waveFrom(rand, amp * 0.5), 0), 0.5, 1, 0.6);
      break;
    }
    case "circle": {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = w / 2 + Math.max(14, h * 0.24);
      const ry = h / 2 + Math.max(10, h * 0.3);
      const grow = 0.06 + 0.04 * rand();
      const theta0 = ((dir === "rtl" ? -25 : 205) + (rand() - 0.5) * 24) * (Math.PI / 180);
      const sweep = (392 + rand() * 26) * (Math.PI / 180) * (dir === "rtl" ? -1 : 1);
      const wave = waveFrom(rand, amp);
      const n = 34;
      const pts: RoughPoint[] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const th = theta0 + sweep * t;
        const k = 1 + grow * t + wave(t) / Math.max(rx, ry);
        pts.push({ x: cx + rx * k * Math.cos(th), y: cy + ry * k * Math.sin(th) });
      }
      push(pts, 0, 1);
      break;
    }
    case "arrow": {
      const len = Math.min(220, Math.max(48, h * 1.2));
      // Built as if it comes from below; an arrow from above is the same drawing turned over around the middle of the word.
      const flip = options.from === "above" ? (v: number): number => 2 * (y + h / 2) - v : (v: number): number => v;
      const tip = { x: x + w * (dir === "rtl" ? 0.62 : 0.38), y: y + h * 1.12 };
      const tail = { x: tip.x - s * len * 0.85, y: tip.y + len * 0.7 };
      const bend = (rand() - 0.5) * len * 0.5 + s * len * 0.1;
      const mid = { x: (tail.x + tip.x) / 2 + bend, y: (tail.y + tip.y) / 2 };
      const wave = waveFrom(rand, amp * 0.6);
      const n = 14;
      const shaft: RoughPoint[] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const u = 1 - t;
        // Quadratic curve tail -> tip bent through the mid point.
        const qx = u * u * tail.x + 2 * u * t * (2 * mid.x - (tail.x + tip.x) / 2) + t * t * tip.x;
        const qy = u * u * tail.y + 2 * u * t * (2 * mid.y - (tail.y + tip.y) / 2) + t * t * tip.y;
        shaft.push({ x: qx, y: flip(qy + wave(t)) });
      }
      push(shaft, 0, 0.72);
      const last = shaft[shaft.length - 1];
      const before = shaft[shaft.length - 3];
      const heading = Math.atan2(before.y - last.y, before.x - last.x);
      const barb = Math.max(14, len * 0.22);
      const spread = (26 + rand() * 8) * (Math.PI / 180);
      // The heading was measured on the turned-over shaft, so the barbs come out right either way.
      const b1 = { x: last.x + barb * Math.cos(heading + spread), y: last.y + barb * Math.sin(heading + spread) };
      const b2 = { x: last.x + barb * 0.92 * Math.cos(heading - spread), y: last.y + barb * 0.92 * Math.sin(heading - spread) };
      passes.push({ d: `M ${fmt(b1)} L ${fmt(last)} L ${fmt(b2)}`, from: 0.72, to: 1, opacity: 1 });
      all.push(b1, last, b2);
      break;
    }
  }

  const half = strokeWidth / 2 + 1;
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const left = Math.min(...xs) - half;
  const top = Math.min(...ys) - half;
  return {
    kind,
    passes,
    strokeWidth,
    points: all,
    box: { left, top, width: Math.max(...xs) + half - left, height: Math.max(...ys) + half - top },
  };
}
