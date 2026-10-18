import {EASE, mix} from "../../core/motion.ts";
import {SURFACE_INSET, mainBottom, roundRect, type ConceptBox, type Rect} from "../geometry.ts";
import {segBeat, type Beat} from "../timeline.ts";
import type {ConceptMode} from "../types.ts";
import {identityFilteringSchema, type FilteringCriterion, type IdentityFilteringData} from "./schema.ts";

export const MIN_FRAMES = 270;
export const DEFAULT_FRAMES = 330;

export type FilteringStage = {criterionId: string; inputIds: string[]; retainedIds: string[]; rejectedIds: string[]};
export type FilteringResult = {stages: FilteringStage[]; retainedIds: string[]; rejectedIds: string[]};

/** Predicates never coerce values and never evaluate caller code. */
export const evaluatePredicate = (attributes: Record<string, number | boolean>, criterion: Pick<FilteringCriterion, "field" | "op" | "value">): boolean => {
  if (!Object.hasOwn(attributes, criterion.field)) throw new TypeError(`identity-filtering: missing attribute ${criterion.field}`);
  const actual = attributes[criterion.field];
  if (typeof actual !== typeof criterion.value) throw new TypeError(`identity-filtering: attribute type mismatch for ${criterion.field}`);
  if (typeof actual === "number" && !Number.isFinite(actual)) throw new TypeError("identity-filtering: numeric attributes must be finite");
  if (typeof criterion.value === "number" && !Number.isFinite(criterion.value)) throw new TypeError("identity-filtering: criterion number must be finite");
  if (criterion.op === "eq") return actual === criterion.value;
  if (typeof actual !== "number" || typeof criterion.value !== "number") throw new TypeError("identity-filtering: gte/lte require numbers");
  if (criterion.op === "gte") return actual >= criterion.value;
  if (criterion.op === "lte") return actual <= criterion.value;
  throw new TypeError(`identity-filtering: unknown predicate ${String(criterion.op)}`);
};

export const evaluateFiltering = (input: IdentityFilteringData): FilteringResult => {
  const data = identityFilteringSchema.parse(input);
  let remaining = data.cards;
  const stages = data.criteria.map((criterion): FilteringStage => {
    const inputIds = remaining.map(({id}) => id);
    const retained = remaining.filter(({attributes}) => evaluatePredicate(attributes, criterion));
    const retainedSet = new Set(retained.map(({id}) => id));
    const rejectedIds = remaining.filter(({id}) => !retainedSet.has(id)).map(({id}) => id);
    remaining = retained;
    return {criterionId: criterion.id, inputIds, retainedIds: retained.map(({id}) => id), rejectedIds};
  });
  const retainedIds = remaining.map(({id}) => id);
  const retainedSet = new Set(retainedIds);
  return {stages, retainedIds, rejectedIds: data.cards.filter(({id}) => !retainedSet.has(id)).map(({id}) => id)};
};

export type StageBeats = {read: Beat; inspect: Beat; route: Beat};
export type FilteringBeats = {enter: Beat; stages: StageBeats[]; resolve: Beat; hold: Beat};
export const beatsFor = (duration: number, criteriaCount: number): FilteringBeats => {
  if (!Number.isInteger(duration) || duration < 1) throw new RangeError("identity-filtering: duration must be a positive whole frame count");
  if (!Number.isInteger(criteriaCount) || criteriaCount < 1 || criteriaCount > 3) throw new RangeError("identity-filtering: criteria count must be 1 to 3");
  const beat = (from: number, to: number): Beat => ({from: Math.round(from * duration), to: Math.round(to * duration)});
  const span = .60 / criteriaCount;
  return {
    enter: beat(0, .08),
    stages: Array.from({length: criteriaCount}, (_, i) => {
      const start = .10 + i * span;
      return {read: beat(start, start + .22 * span), inspect: beat(start + .22 * span, start + .48 * span), route: beat(start + .50 * span, start + .87 * span)};
    }),
    resolve: beat(.71, .78),
    hold: beat(.78, 1),
  };
};

export const settledFrame = (_mode: ConceptMode, duration: number): number => beatsFor(duration, 3).hold.from;

export type FilteringLayout = {
  region: Rect; title: Rect; criteria: Rect[]; laneLabels: Rect[]; footer: Rect;
  rows: Rect[]; rejectedX: number; retainedX: number; inspectionX: number; gateX: number; cardWidth: number;
};

/** Each original item owns its row for the entire scene, so rejection paths cannot collide. */
export const layoutFor = (box: ConceptBox, cardCount: number, criteriaCount: number, rtl = true): FilteringLayout => {
  if (!Number.isInteger(cardCount) || cardCount < 3 || cardCount > 6) throw new RangeError("identity-filtering: card count must be 3 to 6");
  if (!Number.isInteger(criteriaCount) || criteriaCount < 1 || criteriaCount > 3) throw new RangeError("identity-filtering: criteria count must be 1 to 3");
  const region: Rect = {x: box.left + SURFACE_INSET, y: box.top + SURFACE_INSET, width: box.width - 2 * SURFACE_INSET, height: mainBottom(box) - box.top - 2 * SURFACE_INSET};
  if (region.width < 750 || region.height < 780) throw new RangeError("identity-filtering: requires the full portrait concept region");
  const r = (x: number, y: number, width: number, height: number): Rect => roundRect({x: region.x + x, y: region.y + y, width, height});
  const w = region.width;
  const cardWidth = Math.floor(w * .44);
  const leftX = region.x;
  const rightX = region.x + w - cardWidth;
  const inspectionX = region.x + (w - cardWidth) / 2;
  const rejectedX = rtl ? rightX : leftX;
  const retainedX = rtl ? leftX : rightX;
  const rowH = 72;
  const rowsY = 280;
  const rowsBottom = region.height - 80;
  const availableH = rowsBottom - rowsY;
  const pitch = Math.min(84, (availableH - rowH) / (cardCount - 1));
  const occupiedH = (cardCount - 1) * pitch + rowH;
  const y0 = rowsY + (availableH - occupiedH) / 2;
  const chipGap = 14;
  const chipW = (w - chipGap * (criteriaCount - 1)) / criteriaCount;
  return {
    region,
    title: r(0, 0, w, 72),
    criteria: Array.from({length: criteriaCount}, (_, i) => r((rtl ? criteriaCount - 1 - i : i) * (chipW + chipGap), 92, chipW, 126)),
    laneLabels: [r(retainedX - region.x, 236, cardWidth, 36), r(rejectedX - region.x, 236, cardWidth, 36)],
    footer: r(0, region.height - 58, w, 54),
    rows: Array.from({length: cardCount}, (_, i) => r(inspectionX - region.x, y0 + i * pitch, cardWidth, rowH)),
    rejectedX, retainedX, inspectionX, gateX: region.x + w / 2, cardWidth,
  };
};

export type FilteringCardState = {
  id: string; rect: Rect; presence: number; status: "pending" | "checking" | "retained" | "rejected";
  rejectedAt: number; criterionIndex: number; value: number | boolean; passed: boolean; route: number;
};
export type IdentityFilteringState = {
  presence: number; cards: FilteringCardState[]; criteria: {presence: number; progress: number; active: boolean; completed: boolean; retainedCount: number; inputCount: number}[];
  activeCriterion: number; remainingCount: number; rejectedCount: number; resolved: number; rects: Rect[];
};
export type IdentityFilteringParams = {data: IdentityFilteringData; box: ConceptBox; mode: ConceptMode; rtl?: boolean};

export const stateAt = (frame: number, duration: number, params: IdentityFilteringParams): IdentityFilteringState => {
  if (!Number.isFinite(frame)) throw new RangeError("identity-filtering: frame must be finite");
  if (params.mode !== "once") throw new RangeError("identity-filtering supports once mode; loop would reset the filtering explanation");
  const data = params.data;
  const result = evaluateFiltering(data);
  const B = beatsFor(duration, data.criteria.length);
  const L = layoutFor(params.box, data.cards.length, data.criteria.length, params.rtl ?? true);
  const presence = segBeat(frame, B.enter, EASE.out);
  let activeCriterion = 0;
  B.stages.forEach((stage, i) => {if (frame >= stage.read.from) activeCriterion = i;});
  const cards = data.cards.map((card, cardIndex): FilteringCardState => {
    let x = L.inspectionX;
    let rejectedAt = -1;
    let criterionIndex = 0;
    let status: FilteringCardState["status"] = "pending";
    let passed = false;
    let route = 0;
    for (let i = 0; i < B.stages.length; i++) {
      const beats = B.stages[i];
      if (frame < beats.read.from || rejectedAt >= 0) break;
      criterionIndex = i;
      const progress = segBeat(frame, beats.inspect, EASE.inOut);
      route = segBeat(frame, beats.route, EASE.bezierMorph);
      passed = result.stages[i].retainedIds.includes(card.id);
      const from = i === 0 ? L.inspectionX : L.retainedX;
      x = mix(mix(from, L.inspectionX, progress), passed ? L.retainedX : L.rejectedX, route);
      status = frame >= beats.route.to ? (passed ? "retained" : "rejected") : "checking";
      if (status === "rejected") rejectedAt = i;
    }
    return {id: card.id, rect: {...L.rows[cardIndex], x}, presence, status, rejectedAt, criterionIndex, value: card.attributes[data.criteria[criterionIndex].field], passed, route};
  });
  let remainingCount = data.cards.length;
  B.stages.forEach((stage, i) => {if (frame >= stage.route.to) remainingCount = result.stages[i].retainedIds.length;});
  const criteria = B.stages.map((stage, i) => ({
    presence,
    progress: segBeat(frame, stage.route, EASE.inOut),
    active: frame >= stage.read.from && frame < stage.route.to,
    completed: frame >= stage.route.to,
    retainedCount: result.stages[i].retainedIds.length,
    inputCount: result.stages[i].inputIds.length,
  }));
  const resolved = segBeat(frame, B.resolve, EASE.inOut);
  return {presence, cards, criteria, activeCriterion, remainingCount, rejectedCount: data.cards.length - remainingCount, resolved, rects: [L.title, ...L.criteria, ...L.laneLabels, ...cards.map(({rect}) => rect), L.footer]};
};
