// The narrator's arms, places and gaze as pure maths. Node-safe. Figure units: 600 x 1150, head centre (300, 395),
// chin (300, 590) placed at canvas y 1450; canvas = 1080 x 1920. Shared by the renderer, the arm gate and the tests.
import {EASE, clamp01} from './math.ts';

export const RIG = {
  L1: 172, L2: 166, shoulder: {l: {x: 132, y: 738}, r: {x: 468, y: 738}},
  /** A raised aim swings out at least 0.5 rad (28.65 deg) from vertical so a hand never covers the face. */
  outMin: 0.5, raisedUy: -0.2,
  reach: {point: 0.96, open: 0.8, wide: 0.95, thumb: 0.8, fist: 0.5, wave: 0.9, rest: 0.5},
  handScale: 1.28, transition: {base: 0.28, perRad: 0.13}, slideSeconds: 0.5,
  headCentre: {x: 300, y: 395}, chin: {x: 300, y: 590}, baseY: 1450,
  /** Where a non-rest hand must not be: the face from the brows to the chin. */
  faceBox: {x0: 178, x1: 422, y0: 336, y1: 590},
  gate: {wristStep: 90, elbowStep: 80},
  /** Body-relative targets for the hand poses that do not aim at a card (right arm; the left arm mirrors them about x 300). */
  pose: {thumb: {x: 600, y: 600}, wave: {x: 560, y: 290}, fistChin: {x: 300, y: 618}, palmsR: {x: 548, y: 640}, palmsL: {x: 52, y: 640}},
} as const;

export type Pt = {x: number; y: number};
export type Place = {x: number; scale: number};
export type PlaceKey = Place & {startFrame: number};
export type HandKind = 'point' | 'open' | 'thumb' | 'fist' | 'wave' | 'rest';
export type Arm = 'l' | 'r';

export const toCanvas = (place: Place, pt: Pt): Pt => ({x: place.x + place.scale * (pt.x - RIG.chin.x), y: RIG.baseY + place.scale * (pt.y - RIG.chin.y)});
export const toFigure = (place: Place, pt: Pt): Pt => ({x: RIG.chin.x + (pt.x - place.x) / place.scale, y: RIG.chin.y + (pt.y - RIG.baseY) / place.scale});
export const headCanvas = (place: Place): Pt => toCanvas(place, RIG.headCentre);
const mirror = (pt: Pt): Pt => ({x: 600 - pt.x, y: pt.y});

/** Where the figure stands at a frame: the current place, eased from the previous one over slideSeconds. */
export function placeAt(frame: number, places: readonly PlaceKey[], fps: number): Place {
  let k = 0;
  places.forEach((p, i) => { if (p.startFrame <= frame) k = i; });
  const cur = places[k] ?? {x: 540, scale: 0.86, startFrame: 0}, prev = places[k - 1];
  const p = prev ? EASE.slide(clamp01((frame - cur.startFrame) / (RIG.slideSeconds * fps))) : 1;
  if (!prev || p >= 1) return {x: cur.x, scale: cur.scale};
  return {x: prev.x + (cur.x - prev.x) * p, scale: prev.scale + (cur.scale - prev.scale) * p};
}

export type ArmSolve = {a1: number; a2: number; elbow: Pt; wrist: Pt};
/** Two-bone IK in figure units. `bend` +1 bends the elbow one way, -1 the other; an unreachable target is pulled onto its aim line at full length. */
export function solveArm(shoulder: Pt, target: Pt, bend: 1 | -1): ArmSolve {
  const dx = target.x - shoulder.x, dy = target.y - shoulder.y, len = Math.hypot(dx, dy) || 1;
  const d = Math.max(Math.abs(RIG.L1 - RIG.L2) + 1, Math.min(len, RIG.L1 + RIG.L2 - 0.5));
  const goal = {x: shoulder.x + (dx / len) * d, y: shoulder.y + (dy / len) * d};
  const base = Math.atan2(dy, dx);
  const b = Math.acos(Math.max(-1, Math.min(1, (RIG.L1 * RIG.L1 + d * d - RIG.L2 * RIG.L2) / (2 * RIG.L1 * d))));
  const a1 = base + bend * b;
  const elbow = {x: shoulder.x + RIG.L1 * Math.cos(a1), y: shoulder.y + RIG.L1 * Math.sin(a1)};
  const a2 = Math.atan2(goal.y - elbow.y, goal.x - elbow.x);
  return {a1, a2, elbow, wrist: {x: elbow.x + RIG.L2 * Math.cos(a2), y: elbow.y + RIG.L2 * Math.sin(a2)}};
}

/** The resting hands hang just outside the torso by the hips, the elbows bent outward (canvas y about 1855 at scale 0.86). */
const REST: Record<Arm, Pt> = {l: {x: 62, y: 1060}, r: {x: 538, y: 1060}};
const REST_BEND: Record<Arm, 1 | -1> = {l: 1, r: -1};

export type GestureSpec = {frame: number; arm: Arm; kind: HandKind; anchor?: Pt | 'camera'; reach?: number};
export type ArmKey = {frame: number; kind: HandKind; target: Pt | null; aim: Pt | null; bend: 1 | -1};

/** The figure-space target of a spec: a body-relative pose, or the shoulder plus reach along the aim with the outward swing floor. */
export function armTarget(spec: GestureSpec, place: Place): Pt | null {
  const arm = spec.arm, shoulder = RIG.shoulder[arm], sign = arm === 'r' ? 1 : -1;
  const side = (pt: Pt): Pt => (arm === 'l' ? mirror(pt) : pt);
  if (spec.kind === 'rest') return null;
  if (spec.kind === 'thumb') return side(RIG.pose.thumb);
  if (spec.kind === 'wave') return side(RIG.pose.wave);
  if (spec.kind === 'fist') return RIG.pose.fistChin;
  if (!spec.anchor || spec.anchor === 'camera') return arm === 'r' ? RIG.pose.palmsR : RIG.pose.palmsL;
  const aim = toFigure(place, spec.anchor);
  const reach = (spec.reach ?? RIG.reach[spec.kind]) * (RIG.L1 + RIG.L2);
  let ux = aim.x - shoulder.x, uy = aim.y - shoulder.y;
  const len = Math.hypot(ux, uy) || 1;
  ux /= len; uy /= len;
  if (uy < RIG.raisedUy) {
    const outward = Math.atan2(sign * ux, -uy);          // angle from vertical, positive = away from the body
    if (outward < RIG.outMin) { ux = sign * Math.sin(RIG.outMin); uy = -Math.cos(RIG.outMin); }
  }
  return {x: shoulder.x + ux * reach, y: shoulder.y + uy * reach};
}

/** Keys per arm from the gesture list; each arm starts at rest at frame -1. */
export function armKeys(gestures: readonly GestureSpec[], fps: number, place: Place = {x: 540, scale: 0.86}): Record<Arm, ArmKey[]> {
  const keys: Record<Arm, ArmKey[]> = {l: [{frame: -1, kind: 'rest', target: null, aim: null, bend: REST_BEND.l}], r: [{frame: -1, kind: 'rest', target: null, aim: null, bend: REST_BEND.r}]};
  for (const g of [...gestures].sort((a, b) => a.frame - b.frame)) {
    const target = armTarget(g, place);
    const aim = g.anchor && g.anchor !== 'camera' ? toFigure(place, g.anchor) : null;
    // The bend sign is chosen per key, never per frame; a hand that crosses the neck line flips it.
    const crosses = target !== null && ((g.arm === 'r' && target.x < 300) || (g.arm === 'l' && target.x > 300));
    // A resting arm bends its elbow outward, so the arm hangs beside the body instead of folding across the shirt.
    const bend: 1 | -1 = g.kind === 'rest' ? REST_BEND[g.arm] : (g.arm === 'r') !== crosses ? 1 : -1;
    keys[g.arm].push({frame: g.frame, kind: g.kind, target, aim, bend});
  }
  void fps;
  return keys;
}


/** One arm at a frame. `since` is the frame its current gesture started (the gaze follows the newest aim). */
export type ArmState = {kind: HandKind; a1: number; a2: number; elbow: Pt; wrist: Pt; rot: number; aim: Pt | null; since: number};
const solveKey = (arm: Arm, key: ArmKey): ArmSolve => solveArm(RIG.shoulder[arm], key.target ?? REST[arm], key.bend);
const fingerRot = (wrist: Pt, aim: Pt | null): number => (aim ? (Math.atan2(aim.y - wrist.y, aim.x - wrist.x) * 180) / Math.PI + 90 : 0);
const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

type Shown = {a1: number; a2: number; key: ArmKey};
/**
 * The pose of both arms at a frame: angles morph between keys over 0.28 s + 0.13 s per radian of the biggest joint swing; the hand
 * kind and aim switch at the midpoint. A key that arrives while the previous move is still running starts from where the arm really
 * is at that frame, so an interrupted gesture never jumps.
 */
export function armStateAt(frame: number, keys: Record<Arm, ArmKey[]>, fps: number, place: Place): Record<Arm, ArmState> {
  const one = (arm: Arm): ArmState => {
    const list = keys[arm];
    let k = 0;
    list.forEach((key, i) => { if (key.frame <= frame) k = i; });
    // Walk the keys in order: each move starts from the shown pose of the previous move at its own first frame.
    const first = solveKey(arm, list[0]);
    let start: Shown = {a1: first.a1, a2: first.a2, key: list[0]};
    let shown: Shown = start;
    for (let i = 1; i <= k; i += 1) {
      const to = solveKey(arm, list[i]);
      const at = (f: number): Shown => {
        const swing = Math.max(Math.abs(wrapAngle(to.a1 - start.a1)), Math.abs(wrapAngle(to.a2 - start.a2)));
        const p = EASE.morph(clamp01((f - list[i].frame) / ((RIG.transition.base + RIG.transition.perRad * swing) * fps)));
        // The hand changes shape at the midpoint; a fist leaving the chin stays a fist until it has nearly arrived, so no open palm crosses the face.
        const switchAt = start.key.kind === 'fist' ? 0.95 : 0.5;
        return {a1: start.a1 + wrapAngle(to.a1 - start.a1) * p, a2: start.a2 + wrapAngle(to.a2 - start.a2) * p, key: p >= switchAt ? list[i] : start.key};
      };
      shown = at(i === k ? frame : list[i + 1].frame);
      if (i < k) start = shown;
    }
    if (k === 0) shown = start;
    const shoulder = RIG.shoulder[arm];
    const elbow = {x: shoulder.x + RIG.L1 * Math.cos(shown.a1), y: shoulder.y + RIG.L1 * Math.sin(shown.a1)};
    const wrist = {x: elbow.x + RIG.L2 * Math.cos(shown.a2), y: elbow.y + RIG.L2 * Math.sin(shown.a2)};
    const key = shown.key;
    return {kind: key.kind, a1: shown.a1, a2: shown.a2, elbow, wrist, rot: fingerRot(toCanvas(place, wrist), key.aim ? toCanvas(place, key.aim) : null), aim: key.aim, since: key.frame};
  };
  return {l: one('l'), r: one('r')};
}

export type Gaze = {gx: number; gy: number};
/** Where the eyes look: an explicit look wins, else the newest held aim (this gesture's own aim counts), else the camera. */
export function gazeAt(frame: number, gestures: readonly {frame: number; look?: 'camera' | Pt}[], arms: Record<Arm, ArmState>, place: Place): Gaze {
  const head = headCanvas(place);
  const toGaze = (pt: Pt): Gaze => ({gx: Math.max(-1, Math.min(1, (pt.x - head.x) / 380)), gy: Math.max(-1, Math.min(1, (pt.y - head.y) / 480)) * 0.8});
  let explicit: {frame: number; look: 'camera' | Pt} | undefined;
  for (const g of gestures) if (g.frame <= frame && g.look !== undefined && (!explicit || g.frame >= explicit.frame)) explicit = {frame: g.frame, look: g.look};
  const held = [arms.r, arms.l].filter((a) => a.aim !== null && a.kind !== 'rest').sort((a, b) => b.since - a.since)[0];
  // A later pointing gesture takes the eyes back from an earlier explicit look.
  if (explicit && (!held || explicit.frame >= held.since)) return explicit.look === 'camera' ? {gx: 0, gy: 0} : toGaze(explicit.look);
  return held?.aim ? toGaze(toCanvas(place, held.aim)) : {gx: 0, gy: 0};
}

export type GateSample = {frame: number; arms: Record<Arm, ArmState>; place: Place};
const inFace = (pt: Pt): boolean => pt.x >= RIG.faceBox.x0 && pt.x <= RIG.faceBox.x1 && pt.y >= RIG.faceBox.y0 && pt.y <= RIG.faceBox.y1;
/** The arm gate: no wrist step over 90 px or elbow step over 80 px per frame (at 50 fps; scaled by fps), no non-rest hand inside the face box, wrists on canvas. */
export function armGateIssues(samples: readonly GateSample[], fps: number): string[] {
  const issues: string[] = [];
  const stepLimit = (px: number) => (px * 50) / fps;
  for (let i = 1; i < samples.length; i += 1) {
    for (const arm of ['l', 'r'] as const) {
      const a = samples[i - 1].arms[arm], b = samples[i].arms[arm], s = samples[i].place.scale;
      const dw = Math.hypot(b.wrist.x - a.wrist.x, b.wrist.y - a.wrist.y) * s, de = Math.hypot(b.elbow.x - a.elbow.x, b.elbow.y - a.elbow.y) * s;
      if (dw > stepLimit(RIG.gate.wristStep) || de > stepLimit(RIG.gate.elbowStep)) issues.push(`frame ${samples[i].frame}: ${arm} arm pops (wrist ${dw.toFixed(0)} px, elbow ${de.toFixed(0)} px)`);
    }
  }
  for (const s of samples) for (const arm of ['l', 'r'] as const) {
    const a = s.arms[arm];
    if (a.kind !== 'rest' && a.kind !== 'fist') {
      const palm = {x: a.wrist.x + (a.wrist.x - a.elbow.x) * (38 / RIG.L2), y: a.wrist.y + (a.wrist.y - a.elbow.y) * (38 / RIG.L2)};
      if (inFace(a.wrist) || inFace(palm)) issues.push(`frame ${s.frame}: ${arm} hand over the face`);
    }
    const wrist = toCanvas(s.place, a.wrist);
    if (wrist.x < 0 || wrist.x > 1080) issues.push(`frame ${s.frame}: ${arm} wrist leaves the canvas (x ${wrist.x.toFixed(0)})`);
  }
  return issues;
}
