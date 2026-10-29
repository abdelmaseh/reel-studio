// Looks: the pure geometry and colour maths behind Riso, Blueprint and the girih backdrop.
// No React, no DOM and no clock in this file, so Node tests and the library inventory can import it. Everything is a pure
// function of its arguments; the only "randomness" is a hash of the frame number.
import { contrastRatio } from "../core/chapters.ts";

export type Pt = { x: number; y: number };
export type Rgb = readonly [number, number, number];

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const TAU = Math.PI * 2;
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
/** Short, stable numbers for SVG attributes: six decimals at most, never "-0" and never exponent notation. */
export const num = (n: number, digits = 6): string => {
  if (!Number.isFinite(n)) return "0";
  const rounded = Number(n.toFixed(digits));
  return String(Object.is(rounded, -0) ? 0 : rounded);
};

export const hexToRgb = (hex: string): Rgb => {
  if (!HEX6.test(hex)) throw new Error(`Expected a #RRGGBB colour, got ${JSON.stringify(hex)}.`);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as unknown as Rgb;
};

export const rgbToHex = (rgb: Rgb): string => `#${rgb.map((c) => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, "0")).join("")}`;

// ---------------------------------------------------------------------------------------------------- riso

/** Warm uncoated paper. Light areas of the picture print as paper, so this is also the lightest tone of the look. */
export const RISO_PAPER = "#f3ecdc";
/** Riso blue and fluorescent pink: the first ink carries the structure, the second the warm tones. */
export const DEFAULT_RISO_INKS = ["#0078bf", "#ff48b0"] as const;
/** The darker ink must reach this contrast on the paper, or text printed in it cannot be read. */
export const RISO_MIN_INK_CONTRAST = 3;
/** Two inks whose absorption vectors are closer than this (sine of the angle) cannot be unmixed into two layers. */
export const RISO_MIN_INK_SEPARATION = 0.2;

const absorption = (hex: string): Rgb => hexToRgb(hex).map((c) => 1 - c) as unknown as Rgb;
const dot = (a: Rgb, b: Rgb): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export type InkProblem = { code: "count" | "format" | "same" | "close" | "pale"; message: string };

/** What is wrong with an ink pair, with a stable code (the editor words each code in Arabic). Empty means the pair is usable. */
export function inkPairProblems(inks: readonly string[], paper: string = RISO_PAPER): InkProblem[] {
  if (!Array.isArray(inks) || inks.length !== 2) return [{ code: "count", message: "A riso look needs exactly two inks." }];
  const bad = inks.flatMap((ink, i): InkProblem[] => (typeof ink === "string" && HEX6.test(ink) ? [] : [{ code: "format", message: `Ink ${i + 1} must be a #RRGGBB colour.` }]));
  if (bad.length) return bad;
  if (inks[0].toLowerCase() === inks[1].toLowerCase()) return [{ code: "same", message: "The two inks must differ." }];
  const [a, b] = inks.map(absorption) as [Rgb, Rgb];
  const problems: InkProblem[] = [];
  const cross = Math.sqrt(Math.max(0, 1 - dot(a, b) ** 2 / (dot(a, a) * dot(b, b) || 1)));
  if (cross < RISO_MIN_INK_SEPARATION) problems.push({ code: "close", message: "The two inks are too close to separate into two layers." });
  if (Math.max(...inks.map((ink) => contrastRatio(ink, paper))) < RISO_MIN_INK_CONTRAST) problems.push({ code: "pale", message: "Both inks are too pale to read on the paper; one of them must be darker." });
  return problems;
}

/** Problems with an ink pair, in English (the schema shows them). Empty means the pair is usable. */
export const inkPairIssues = (inks: readonly string[], paper: string = RISO_PAPER): string[] => inkPairProblems(inks, paper).map((problem) => problem.message);

/**
 * The linear unmixing of a picture into two ink coverages: the least-squares solution of
 * (1 - rgb) = c1 * (1 - ink1) + c2 * (1 - ink2), the density model of overprinted translucent inks. Each row is [kR, kG, kB, offset]
 * so that coverage = clamp(kR*r + kG*g + kB*b + offset).
 */
export function inkSeparation(inks: readonly [string, string]): [[number, number, number, number], [number, number, number, number]] {
  const a = absorption(inks[0]), b = absorption(inks[1]);
  const aa = dot(a, a), ab = dot(a, b), bb = dot(b, b);
  const det = aa * bb - ab * ab;
  if (!(Math.abs(det) > 1e-9)) throw new Error("These two inks cannot be separated into two layers.");
  // W = (AᵀA)⁻¹ Aᵀ as a 2x3 matrix.
  const w0 = [0, 1, 2].map((j) => (bb * a[j] - ab * b[j]) / det);
  const w1 = [0, 1, 2].map((j) => (aa * b[j] - ab * a[j]) / det);
  const row = (w: number[]): [number, number, number, number] => [-w[0], -w[1], -w[2], w[0] + w[1] + w[2]];
  return [row(w0), row(w1)];
}

/** The coverage (0..1) of each ink for one picture colour, exactly what the SVG colour matrix computes. */
export function separateInks(inks: readonly [string, string], rgb: Rgb): [number, number] {
  const rows = inkSeparation(inks);
  return rows.map((r) => clamp01(r[0] * rgb[0] + r[1] * rgb[1] + r[2] * rgb[2] + r[3])) as [number, number];
}

/**
 * The 4x5 `values` of an feColorMatrix: red out = ink 1 coverage, green out = ink 2 coverage, blue 0, alpha 1. `levels` stretches the
 * coverages (slope * coverage + intercept) so pale tones print as clean paper and dark tones as solid ink.
 */
export function inkMatrixValues(inks: readonly [string, string], levels: { slope: number; intercept: number } = { slope: 1, intercept: 0 }): string {
  const [r, g] = inkSeparation(inks);
  const row = (v: [number, number, number, number]) => `${num(v[0] * levels.slope)} ${num(v[1] * levels.slope)} ${num(v[2] * levels.slope)} 0 ${num(v[3] * levels.slope + levels.intercept)}`;
  return [row(r), row(g), "0 0 0 0 0", "0 0 0 0 1"].join(" ");
}

/**
 * One ink plate as an feColorMatrix: the colour is the ink, the alpha is a steep threshold of the chosen channel of the grainy tone
 * image (red for plate 1, green for plate 2): alpha = density * (slope * (tone - 0.5) + 0.5), clamped. The result is premultiplied by
 * the filter, so the plate is the ink colour wherever the tone passes the threshold.
 */
export function plateMatrixValues(ink: string, channel: "r" | "g", slope: number, density: number): string {
  const [r, g, b] = hexToRgb(ink);
  const a = (c: "r" | "g") => (c === channel ? num(density * slope) : "0");
  return `0 0 0 0 ${num(r)} 0 0 0 0 ${num(g)} 0 0 0 0 ${num(b)} ${a("r")} ${a("g")} 0 0 ${num(density * (0.5 - 0.5 * slope))}`;
}

/** The two inks a riso look prints with: the chosen pair, else the default blue and pink. */
export const resolveInks = (look?: { inks?: readonly string[] } | null): [string, string] =>
  look?.inks && look.inks.length === 2 ? [look.inks[0], look.inks[1]] : [DEFAULT_RISO_INKS[0], DEFAULT_RISO_INKS[1]];

/** Each ink plate is shifted a little the other way: together a fixed 2 to 4 px misregistration, like a hand-fed print. */
export const RISO_REGISTRATION = { a: { dx: -1.5, dy: 1 }, b: { dx: 1.5, dy: -1 } } as const;
export const registrationDistance = (): number => Math.hypot(RISO_REGISTRATION.b.dx - RISO_REGISTRATION.a.dx, RISO_REGISTRATION.b.dy - RISO_REGISTRATION.a.dy);
/** The picture is drawn this many px larger on every side, so the shifted plates never expose an edge of the frame. */
export const RISO_BLEED = 6;

export const GRAIN_SEED_MAX = 30011;
/** The grain redraws every this many frames (a boiling print, not television noise). */
export const RISO_GRAIN_HOLD = 4;
/** feTurbulence seed for a frame: a hash of the hold index, so the same frame always draws the same grain. */
export function grainSeedAt(frame: number, hold: number = RISO_GRAIN_HOLD): number {
  const index = Math.floor(Math.max(0, frame) / Math.max(1, hold));
  const h = Math.imul(index + 1, 2654435761) >>> 0;
  return 1 + (h % (GRAIN_SEED_MAX - 1));
}

/**
 * Where the grain tile sits for a frame: a hash of the hold index, so the grain boils between holds and a frame is a pure function of
 * its number. Whole pixels inside one tile.
 */
export function grainOffsetAt(frame: number, tile: number, hold: number = RISO_GRAIN_HOLD): { x: number; y: number } {
  const index = Math.floor(Math.max(0, frame) / Math.max(1, hold));
  const a = Math.imul(index + 1, 2246822519) >>> 0;
  const b = Math.imul((a ^ (a >>> 15)) + 3266489917, 668265263) >>> 0;
  return { x: (a >>> 7) % tile, y: (b >>> 7) % tile };
}

// ----------------------------------------------------------------------------------------------- blueprint

/** Blue paper, white line work. `light` is the brightest fill the picture can reach and the line colour still reads on it. */
export const BLUEPRINT = {
  paper: "#0b3079",
  light: "#2f66c2",
  line: "#f2f7ff",
  grid: "#bcd4ff",
  gridMinor: 36,
  gridMajor: 180,
} as const;

const LUMA = { r: 0.2126, g: 0.7152, b: 0.0722 } as const; // the weights core/finish.tsx uses
/** Edge strength: the detail (difference between the picture and its softened copy) times this, minus the floor, becomes line opacity. */
export const BLUEPRINT_LINE = { blur: 1.8, gain: 6, floor: 0.07 } as const;

/** feColorMatrix values: brightness mapped between the deep paper blue and the lighter blue. Alpha stays 1. */
export function blueprintFillValues(): string {
  const paper = hexToRgb(BLUEPRINT.paper), light = hexToRgb(BLUEPRINT.light);
  const row = (c: number) => `${num(LUMA.r * (light[c] - paper[c]))} ${num(LUMA.g * (light[c] - paper[c]))} ${num(LUMA.b * (light[c] - paper[c]))} 0 ${num(paper[c])}`;
  return `${row(0)} ${row(1)} ${row(2)} 0 0 0 0 1`;
}
/** feColorMatrix values: the picture as grey (red = green = blue = luminance). */
export function blueprintGreyValues(): string {
  const row = `${num(LUMA.r)} ${num(LUMA.g)} ${num(LUMA.b)} 0 0`;
  return `${row} ${row} ${row} 0 0 0 0 1`;
}
/** feColorMatrix values: the line colour, with an alpha that grows with the detail in the red channel. */
export function blueprintLineValues(): string {
  const [r, g, b] = hexToRgb(BLUEPRINT.line);
  return `0 0 0 0 ${num(r)} 0 0 0 0 ${num(g)} 0 0 0 0 ${num(b)} ${num(BLUEPRINT_LINE.gain)} 0 0 0 ${num(-BLUEPRINT_LINE.gain * BLUEPRINT_LINE.floor)}`;
}

export type Segment = [number, number, number, number];
export type Circle = [number, number, number];

/**
 * Drawing marks: corner brackets, two dimension lines with end ticks and arrowheads, and four registration targets. No words and no
 * numbers, so nothing is claimed. Every point lies inside the organic safe zone (65 px sides, y 250 to 1470, clear of the action rail
 * at x >= 853 from y 1150), although the layer is decoration and disappears under the safe-zone probe.
 */
export function blueprintMarks(): { segments: Segment[]; circles: Circle[] } {
  const segments: Segment[] = [];
  const bracket = (x: number, y: number, dx: number, dy: number, len = 56) => segments.push([x, y, x + dx * len, y], [x, y, x, y + dy * len]);
  bracket(72, 258, 1, 1);
  bracket(1008, 258, -1, 1);
  bracket(72, 1462, 1, -1);
  bracket(846, 1462, -1, -1);
  // Top dimension line.
  const top = 284;
  segments.push([96, top, 984, top], [96, top - 9, 96, top + 9], [984, top - 9, 984, top + 9], [540, top - 7, 540, top + 7]);
  segments.push([96, top, 112, top - 5], [96, top, 112, top + 5], [984, top, 968, top - 5], [984, top, 968, top + 5]);
  // Left dimension line.
  const left = 90;
  segments.push([left, 350, left, 1380], [left - 9, 350, left + 9, 350], [left - 9, 1380, left + 9, 1380], [left - 7, 865, left + 7, 865]);
  segments.push([left, 350, left - 5, 366], [left, 350, left + 5, 366], [left, 1380, left - 5, 1364], [left, 1380, left + 5, 1364]);
  // Registration targets with a crosshair.
  const circles: Circle[] = [[160, 340, 14], [920, 340, 14], [160, 1380, 14], [760, 1380, 14]];
  for (const [cx, cy, r] of circles) segments.push([cx - r * 2, cy, cx + r * 2, cy], [cx, cy - r * 2, cx, cy + r * 2]);
  return { segments, circles };
}

// ---------------------------------------------------------------------------------------------------- girih

export const GIRIH_FOLDS = [6, 8, 12] as const;
export type GirihFold = (typeof GIRIH_FOLDS)[number];
export type GirihShape = "octagon" | "square" | "hexagon" | "dodecagon" | "triangle";
/** Contact angle of the star arms at each edge midpoint (Hankin's construction), per tiling. */
export const GIRIH_CONTACT: Readonly<Record<GirihFold, number>> = { 6: Math.PI / 3, 8: Math.PI / 4, 12: Math.PI / 3 };

export interface GirihCell {
  id: string;
  shape: GirihShape;
  sides: number;
  cx: number;
  cy: number;
  apothem: number;
  /** Angle of the first edge normal. */
  rot: number;
  /** The polygon, `sides` points. */
  outline: Pt[];
  /** The star line that runs through every edge midpoint, `2 * sides` points: edge midpoint, inner point, edge midpoint, ... */
  star: Pt[];
}

/** Shoelace area of a polygon (signed). */
export function polygonArea(points: readonly Pt[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/**
 * The star line of a regular polygon by "polygons in contact": at every edge midpoint (distance `apothem` from the centre, in the
 * direction of the edge normal) a ray leaves at the contact angle `theta` to the edge; the rays of neighbouring edges meet on the
 * bisector at radius r = a cos(theta) / cos(theta - PI/n). Two neighbouring polygons that share an edge meet at its midpoint and their
 * rays continue each other in one straight line, so the pattern runs across the whole tiling.
 */
export function hankinStar(n: number, apothem: number, rot: number, theta: number): { outer: Pt[]; inner: Pt[]; loop: Pt[] } {
  const r = (apothem * Math.cos(theta)) / Math.cos(theta - Math.PI / n);
  const outer: Pt[] = [], inner: Pt[] = [], loop: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const phi = rot + (TAU * k) / n;
    const o = { x: apothem * Math.cos(phi), y: apothem * Math.sin(phi) };
    const i = { x: r * Math.cos(phi + Math.PI / n), y: r * Math.sin(phi + Math.PI / n) };
    outer.push(o);
    inner.push(i);
    loop.push(o, i);
  }
  return { outer, inner, loop };
}

function polygonPoints(n: number, apothem: number, rot: number): Pt[] {
  const radius = apothem / Math.cos(Math.PI / n);
  return Array.from({ length: n }, (_, k) => {
    const phi = rot + (TAU * k) / n + Math.PI / n;
    return { x: radius * Math.cos(phi), y: radius * Math.sin(phi) };
  });
}

function makeCell(id: string, shape: GirihShape, n: number, cx: number, cy: number, apothem: number, rot: number, theta: number): GirihCell {
  const move = (p: Pt): Pt => ({ x: cx + p.x, y: cy + p.y });
  return { id, shape, sides: n, cx, cy, apothem, rot, outline: polygonPoints(n, apothem, rot).map(move), star: hankinStar(n, apothem, rot, theta).loop.map(move) };
}

/** The cells of the lattice anchors i in [i0, i1) and j in [j0, j1). `pitch` is the flat-to-flat width of the main polygon. */
export function girihLattice(fold: GirihFold, pitch: number, i0: number, i1: number, j0: number, j1: number, contact: number = GIRIH_CONTACT[fold]): GirihCell[] {
  if (!(GIRIH_FOLDS as readonly number[]).includes(fold)) throw new Error(`Unsupported girih fold ${fold}.`);
  const cells: GirihCell[] = [];
  const a = pitch / 2;
  const row = (pitch * Math.sqrt(3)) / 2;
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      if (fold === 8) {
        const x = i * pitch, y = j * pitch;
        const edge = pitch / (1 + Math.SQRT2);
        cells.push(makeCell(`8:octagon:${i},${j}`, "octagon", 8, x, y, a, 0, contact));
        cells.push(makeCell(`8:square:${i},${j}`, "square", 4, x + a, y + a, edge / 2, Math.PI / 4, contact));
      } else {
        const x = i * pitch + (j * pitch) / 2, y = j * row;
        if (fold === 6) {
          cells.push(makeCell(`6:hexagon:${i},${j}`, "hexagon", 6, x, y, a, 0, contact));
        } else {
          const edge = 2 * a * Math.tan(Math.PI / 12);
          const triangle = edge / (2 * Math.sqrt(3));
          cells.push(makeCell(`12:dodecagon:${i},${j}`, "dodecagon", 12, x, y, a, 0, contact));
          // The triangle above the anchor and the one below the next row: their edge normals point at the three dodecagons around them.
          cells.push(makeCell(`12:triangle:${i},${j}:up`, "triangle", 3, x + pitch / 2, y + row / 3, triangle, Math.PI / 2, contact));
          cells.push(makeCell(`12:triangle:${i},${j}:down`, "triangle", 3, x + pitch, y + (2 * row) / 3, triangle, Math.PI / 6, contact));
        }
      }
    }
  }
  return cells;
}

/** Every cell whose centre lies within `radius` of `centre`, in a fixed order (row by row). */
export function girihCells(options: { fold: GirihFold; pitch: number; radius: number; centre?: Pt; contact?: number }): GirihCell[] {
  const { fold, pitch, radius, contact } = options;
  const centre = options.centre ?? { x: 0, y: 0 };
  const margin = 2;
  const row = fold === 8 ? pitch : (pitch * Math.sqrt(3)) / 2;
  const j0 = Math.floor((centre.y - radius) / row) - margin, j1 = Math.ceil((centre.y + radius) / row) + margin;
  const cells: GirihCell[] = [];
  for (let j = j0; j < j1; j++) {
    const shift = fold === 8 ? 0 : (j * pitch) / 2;
    const i0 = Math.floor((centre.x - radius - shift) / pitch) - margin, i1 = Math.ceil((centre.x + radius - shift) / pitch) + margin;
    for (const cell of girihLattice(fold, pitch, i0, i1, j, j + 1, contact)) {
      if (Math.hypot(cell.cx - centre.x, cell.cy - centre.y) <= radius) cells.push(cell);
    }
  }
  return cells;
}

/** An SVG path for a closed polyline, two decimals. */
export function closedPath(points: readonly Pt[]): string {
  return `${points.map((p, i) => `${i === 0 ? "M" : "L"}${num(p.x, 2)} ${num(p.y, 2)}`).join("")}Z`;
}

const cubicOut = (p: number): number => 1 - (1 - p) ** 3;
const sineInOut = (p: number): number => (1 - Math.cos(Math.PI * clamp01(p))) / 2;

/** Seconds a cell waits per pixel of distance from the centre, and how long its lines take to draw. */
export const GIRIH_DELAY_PER_PX = 0.0008;
export const GIRIH_DRAW_SECONDS = 0.6;
export const GIRIH_DELAY_RADIUS = 1500;

/** Stroke progress (0..1) of a cell at time `t` seconds: cubic-out, starting later the farther the cell is from `centre`. */
export function girihProgress(cell: { cx: number; cy: number }, centre: Pt, t: number, speed = 1): number {
  const distance = Math.min(Math.hypot(cell.cx - centre.x, cell.cy - centre.y), GIRIH_DELAY_RADIUS);
  return cubicOut(clamp01((t * speed - distance * GIRIH_DELAY_PER_PX) / GIRIH_DRAW_SECONDS));
}

/** Opacity over time: bright while it draws, then it eases to a faint texture; an optional exit fades it out in 0.6 s. */
export function girihOpacity(t: number, o: { settle?: number; base?: number; rest?: number; out?: number }): number {
  const settle = o.settle ?? 1.5, base = o.base ?? 0.5, rest = o.rest ?? 0.15;
  let opacity = base + (rest - base) * sineInOut((t - settle) / 0.8);
  if (o.out !== undefined && t >= o.out) opacity *= 1 - clamp01((t - o.out) / 0.6) ** 3;
  return opacity;
}

/** Degrees of slow rotation: 2 degrees per second at speed 1. */
export const girihRotation = (t: number, speed = 1): number => 2 * t * speed;
