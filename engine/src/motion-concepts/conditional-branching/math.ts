import { EASE, clamp01, mix } from "../../core/motion.ts";
import { SURFACE_INSET, centerRect, mainBottom, type ConceptBox, type Rect } from "../geometry.ts";
import { beatFrames, beatIssues, segBeat, type BeatSpec, type Beats } from "../timeline.ts";
import type { ConceptMode } from "../types.ts";
import { conditionalBranchingSchema, type ConditionalBranchingData } from "./schema.ts";

export const MIN_FRAMES = 210;
export const DEFAULT_FRAMES = 270;
export type BranchKey = "whenTrue" | "whenFalse";
type BeatName = "reveal" | "approach" | "evaluate" | "route" | "resolve" | "hold";
const SPEC: BeatSpec<BeatName> = {
  reveal: [0, 0.11], approach: [0.18, 0.32], evaluate: [0.32, 0.48],
  route: [0.49, 0.70], resolve: [0.70, 0.74], hold: [0.74, 1],
};
export const beatsFor = (duration: number): Beats<BeatName> => beatFrames(SPEC, duration);
export const modeIssues = (duration: number): string[] => beatIssues(beatsFor(duration), duration, {
  hold: "hold", minHoldFraction: 0.25, order: ["reveal", "approach", "evaluate", "route", "resolve", "hold"],
});
export const settledFrame = (duration: number): number => beatsFor(duration).hold.from;

export const evaluateCondition = (supplied: ConditionalBranchingData): boolean => {
  const data = conditionalBranchingSchema.parse(supplied);
  return data.condition.kind === "boolean-equals"
    ? data.input.value === data.condition.equals
    : (data.input.value as number) >= data.condition.threshold;
};

export type Pt = { x: number; y: number };
type Segment = { a: Pt; b: Pt; c?: Pt; d?: Pt };
export type RoutePath = { d: string; points: Pt[]; distances: number[]; length: number };
export type BranchLayout = { key: BranchKey; rect: Rect; label: Rect; dock: Pt; path: RoutePath; arrow: Pt };
export type BranchingLayout = {
  region: Rect; title: Rect; condition: Rect; gate: Pt; fork: Pt; home: Pt;
  token: { width: number; height: number }; approach: RoutePath; trunk: RoutePath; branches: BranchLayout[];
};

const cubic = (s: Segment, t: number): Pt => {
  if (!s.c || !s.d) return { x: mix(s.a.x, s.b.x, t), y: mix(s.a.y, s.b.y, t) };
  const q = 1 - t;
  return { x: q ** 3 * s.a.x + 3 * q ** 2 * t * s.c.x + 3 * q * t ** 2 * s.d.x + t ** 3 * s.b.x,
    y: q ** 3 * s.a.y + 3 * q ** 2 * t * s.c.y + 3 * q * t ** 2 * s.d.y + t ** 3 * s.b.y };
};
const pathFrom = (segments: Segment[]): RoutePath => {
  const points: Pt[] = [segments[0].a];
  let d = `M${points[0].x} ${points[0].y}`;
  for (const s of segments) {
    d += s.c && s.d ? ` C${s.c.x} ${s.c.y} ${s.d.x} ${s.d.y} ${s.b.x} ${s.b.y}` : ` L${s.b.x} ${s.b.y}`;
    const count = s.c ? 48 : 1;
    for (let i = 1; i <= count; i++) points.push(cubic(s, i / count));
  }
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  return { d, points, distances, length: distances[distances.length - 1] };
};
export const pointOnPath = (path: RoutePath, progress: number): Pt => {
  if (progress <= 0) return { ...path.points[0] };
  if (progress >= 1) return { ...path.points[path.points.length - 1] };
  const distance = clamp01(progress) * path.length;
  let index = 1;
  while (index < path.distances.length - 1 && path.distances[index] < distance) index++;
  const previous = path.distances[index - 1];
  const fraction = (distance - previous) / Math.max(1e-9, path.distances[index] - previous);
  return { x: mix(path.points[index - 1].x, path.points[index].x, fraction), y: mix(path.points[index - 1].y, path.points[index].y, fraction) };
};

/** The condition owns a side panel; the token has a separate lane, so text never crosses. */
export const layoutFor = (box: ConceptBox, rtl = false): BranchingLayout => {
  const region = { x: box.left + SURFACE_INSET, y: box.top + SURFACE_INSET,
    width: box.right - box.left - 2 * SURFACE_INSET, height: mainBottom(box) - box.top - 2 * SURFACE_INSET };
  if (region.width < 700 || region.height < 700) throw new RangeError("conditional-branching needs the full native takeover canvas");
  const W = region.width, H = region.height;
  const pt = (x: number, y: number): Pt => ({ x: region.x + (rtl ? W - x : x), y: region.y + y });
  const rect = (x: number, y: number, width: number, height: number): Rect => ({ x: region.x + (rtl ? W - x - width : x), y: region.y + y, width, height });
  const token = { width: 280, height: 136 };
  const home = pt(W * 0.5, H * 0.18);
  const gate = pt(W * 0.84, H * 0.425);
  const fork = pt(W * 0.5, H * 0.68);
  const elbow = pt(W * 0.84, H * 0.60);
  const approach = pathFrom([
    { a: home, b: pt(W * 0.84 - 42, H * 0.18) },
    { a: pt(W * 0.84 - 42, H * 0.18), b: pt(W * 0.84, H * 0.18 + 42), c: pt(W * 0.84, H * 0.18), d: pt(W * 0.84, H * 0.18) },
    { a: pt(W * 0.84, H * 0.18 + 42), b: gate },
  ]);
  const trunk = pathFrom([
    { a: gate, b: elbow },
    { a: elbow, b: fork, c: pt(W * 0.84, H * 0.68), d: pt(W * 0.5, H * 0.60) },
  ]);
  const cardWidth = W * 0.45;
  const branches = (["whenTrue", "whenFalse"] as const).map((key, i): BranchLayout => {
    const x = i === 0 ? 16 : W - 16 - cardWidth;
    const cx = x + cardWidth / 2;
    const dock = pt(cx, H * 0.74 + token.height / 2 + 12);
    const arrival = pt(cx, H * 0.79);
    return { key, rect: rect(x, H * 0.74, cardWidth, H * 0.26), label: rect(x + 84, H * 0.74 + 158, cardWidth - 100, 58), dock,
      arrow: pt(cx, H * 0.74 - 14),
      path: pathFrom([{ a: fork, b: arrival, c: pt(W * 0.5, H * 0.74), d: pt(cx, H * 0.72) }, { a: arrival, b: dock }]),
    };
  });
  return { region, title: rect(0, 0, W, 64), condition: rect(16, H * 0.31, W * 0.53, H * 0.23), gate, fork, home, token, approach, trunk, branches };
};

export type ConditionalBranchingParams = { data: ConditionalBranchingData; box: ConceptBox; rtl: boolean; mode?: ConceptMode };
export type ConditionalBranchingState = {
  presence: number; selected: BranchKey | null; condition: { evaluation: number; result: boolean | null };
  token: { id: string; label: string; value: number | boolean; x: number; y: number; width: number; height: number; presence: number };
  approach: number; trunk: number; resolved: number;
  branches: { key: BranchKey; presence: number; active: boolean; progress: number }[]; rects: Rect[];
};

export const stateAt = (frame: number, duration: number, params: ConditionalBranchingParams): ConditionalBranchingState => {
  if (!Number.isFinite(frame)) throw new RangeError("conditional-branching frame must be finite");
  if (params.mode === "loop") throw new RangeError("conditional-branching supports once mode only; a replay is not a new decision");
  const B = beatsFor(duration), L = layoutFor(params.box, params.rtl);
  const f = Math.max(0, Math.min(frame, duration));
  const result = evaluateCondition(params.data);
  const presence = segBeat(f, B.reveal, EASE.land);
  const evaluated = f >= B.evaluate.to;
  const selected: BranchKey | null = evaluated ? (result ? "whenTrue" : "whenFalse") : null;
  const approach = segBeat(f, B.approach, EASE.inOut);
  const progress = segBeat(f, B.route, EASE.inOut);
  const target = L.branches.find((branch) => branch.key === (result ? "whenTrue" : "whenFalse"))!;
  const routeLength = L.trunk.length + target.path.length;
  const distance = progress * routeLength;
  let position = pointOnPath(L.approach, approach);
  if (f >= B.route.from) position = distance <= L.trunk.length ? pointOnPath(L.trunk, distance / L.trunk.length) : pointOnPath(target.path, (distance - L.trunk.length) / target.path.length);
  if (progress >= 1) position = { ...target.dock };
  const trunk = clamp01(distance / L.trunk.length);
  const branchProgress = progress >= 1 ? 1 : clamp01((distance - L.trunk.length) / target.path.length);
  const branches = L.branches.map((branch) => ({ key: branch.key, presence, active: branch.key === selected, progress: branch.key === selected ? branchProgress : 0 }));
  const token = { ...params.data.input, ...position, ...L.token, presence };
  const rects: Rect[] = [L.title, L.condition, ...L.branches.map((branch) => branch.rect), centerRect(token.x, token.y, token.width + 2 * 8, token.height + 2 * 8)];
  return { presence, selected, condition: { evaluation: segBeat(f, B.evaluate), result: evaluated ? result : null }, token, approach, trunk,
    resolved: segBeat(f, B.resolve, EASE.land), branches, rects };
};
