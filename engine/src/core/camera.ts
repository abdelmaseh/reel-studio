import type { Cam } from "./plate";

export type Anchor = { x: number; y: number };

export type NormBox = { x: number; y: number; width: number; height: number };

export type PunchKey = { frame: number; scale: number; ax: number; ay: number };

export type ManifestCameraKey = { atFrame: number; scale: number; focusX: number; focusY: number };
export type PunchKind = "slow-push" | "snap-in" | "punch-step";

export const PUNCH_CAPS = { min: 1.03, max: 1.07, hard: 1.1 } as const;
export const PUNCH_KINDS: readonly PunchKind[] = ["slow-push", "snap-in", "punch-step"];

export const DEFAULT_ANCHOR: Anchor = { x: 0.5, y: 0.29 };

export const MANIFEST_FOCUS: Anchor = { x: 0.5, y: 0.4 };

type Common = { anchor?: Anchor; allowHard?: boolean };

const EPS = 1e-9;
const ceiling = (allowHard?: boolean): number => (allowHard ? PUNCH_CAPS.hard : PUNCH_CAPS.max);
const same = (a: number, b: number): boolean => Math.abs(a - b) < EPS;

const wholeFrame = (name: string, f: number): void => {
  if (!Number.isInteger(f) || f < 0) throw new RangeError(`${name} must be a whole frame >= 0, got ${f}`);
};
const level = (name: string, s: number, allowHard?: boolean): void => {
  if (!Number.isFinite(s) || s < 1 || s > ceiling(allowHard) + EPS) {
    throw new RangeError(`${name} ${s} is outside [1, ${ceiling(allowHard)}]`);
  }
};
const punch = (name: string, s: number, allowHard?: boolean): void => {
  if (!Number.isFinite(s) || s < PUNCH_CAPS.min - EPS || s > ceiling(allowHard) + EPS) {
    throw new RangeError(`${name} ${s} is outside the punch range [${PUNCH_CAPS.min}, ${ceiling(allowHard)}]`);
  }
};
const anchorOf = (a: Anchor | undefined): Anchor => {
  const v = a ?? DEFAULT_ANCHOR;
  if (!(v.x >= 0 && v.x <= 1 && v.y >= 0 && v.y <= 1)) throw new RangeError(`anchor (${v.x}, ${v.y}) must lie inside 0..1`);
  return v;
};
const key = (frame: number, scale: number, a: Anchor): PunchKey => ({ frame, scale, ax: a.x, ay: a.y });


export const capScale = (scale: number, allowHard = false): number => {
  if (!Number.isFinite(scale) || scale <= 1) return 1;
  return Math.min(ceiling(allowHard), Math.max(PUNCH_CAPS.min, scale));
};


export const slowPush = (o: Common & { fromFrame: number; toFrame: number; from?: number; to: number }): PunchKey[] => {
  const a = anchorOf(o.anchor);
  const from = o.from ?? 1;
  wholeFrame("fromFrame", o.fromFrame);
  wholeFrame("toFrame", o.toFrame);
  if (o.toFrame <= o.fromFrame) throw new RangeError(`slowPush needs toFrame > fromFrame (${o.fromFrame} -> ${o.toFrame})`);
  level("from", from, o.allowHard);
  level("to", o.to, o.allowHard);
  return [key(o.fromFrame, from, a), key(o.toFrame, o.to, a)];
};


export const snapIn = (o: Common & { atFrame: number; scale: number; from?: number; rampFrames?: number }): PunchKey[] => {
  const a = anchorOf(o.anchor);
  const from = o.from ?? 1;
  const ramp = o.rampFrames ?? 4;
  wholeFrame("atFrame", o.atFrame);
  if (!Number.isInteger(ramp) || ramp < 2) throw new RangeError(`snapIn rampFrames must be a whole number >= 2, got ${ramp} (use punchStep for a cut)`);
  if (o.atFrame - ramp < 0) throw new RangeError(`snapIn needs ${ramp} frames before atFrame ${o.atFrame}`);
  level("from", from, o.allowHard);
  punch("scale", o.scale, o.allowHard);
  if (o.scale <= from) throw new RangeError(`snapIn must land larger than it starts (${from} -> ${o.scale})`);
  return [key(o.atFrame - ramp, from, a), key(o.atFrame, o.scale, a)];
};


export const punchStep = (o: Common & { atFrame: number; scale: number; from?: number }): PunchKey[] => {
  const a = anchorOf(o.anchor);
  const from = o.from ?? 1;
  wholeFrame("atFrame", o.atFrame);
  if (o.atFrame < 1) throw new RangeError("punchStep needs one frame before atFrame");
  level("from", from, o.allowHard);
  punch("scale", o.scale, o.allowHard);
  if (o.scale <= from) throw new RangeError(`punchStep must land larger than it starts (${from} -> ${o.scale})`);
  return [key(o.atFrame - 1, from, a), key(o.atFrame, o.scale, a)];
};


export const snapBack = (o: Common & { atFrame: number; from: number; to?: number; rampFrames?: number }): PunchKey[] => {
  const a = anchorOf(o.anchor);
  const to = o.to ?? 1;
  const ramp = o.rampFrames ?? 1;
  wholeFrame("atFrame", o.atFrame);
  if (!Number.isInteger(ramp) || ramp < 1) throw new RangeError(`snapBack rampFrames must be a whole number >= 1, got ${ramp}`);
  if (o.atFrame - ramp < 0) throw new RangeError(`snapBack needs ${ramp} frame(s) before atFrame ${o.atFrame}`);
  level("from", o.from, o.allowHard);
  level("to", to, o.allowHard);
  if (to >= o.from) throw new RangeError(`snapBack must land smaller than it starts (${o.from} -> ${to})`);
  return [key(o.atFrame - ramp, o.from, a), key(o.atFrame, to, a)];
};







export const composeTrack = (parts: PunchKey[][]): PunchKey[] => {
  const out: PunchKey[] = [];
  parts.forEach((part, index) => {
    const prev = out[out.length - 1];
    const first = part[0];
    if (prev && first) {
      if (first.frame < prev.frame) throw new RangeError(`part ${index} starts at frame ${first.frame}, before the track's last key at ${prev.frame}`);
      if (!same(first.scale, prev.scale)) throw new RangeError(`part ${index} starts at scale ${first.scale} but the track holds scale ${prev.scale}`);
      if ((!same(first.ax, prev.ax) || !same(first.ay, prev.ay)) && !same(prev.scale, 1)) {
        throw new RangeError(`part ${index} moves the anchor while punched in at scale ${prev.scale}`);
      }
    }
    for (const k of part) {
      const last = out[out.length - 1];
      if (last && k.frame < last.frame) throw new RangeError(`part ${index} key at frame ${k.frame} is before ${last.frame}`);
      if (last && k.frame === last.frame) out[out.length - 1] = k;
      else out.push(k);
    }
  });
  return out;
};






export const emphasisPunch = (o: {
  kind: PunchKind;
  atFrame: number;
  scale: number;
  holdFrames: number;
  anchor?: Anchor;
  pushFrames?: number;
  releaseFrames?: number;
  allowHard?: boolean;
}): PunchKey[] => {
  if (!PUNCH_KINDS.includes(o.kind)) throw new RangeError(`unknown punch kind ${String(o.kind)}`);
  punch("scale", o.scale, o.allowHard);
  const release = o.releaseFrames ?? 1;
  if (!Number.isInteger(o.holdFrames) || o.holdFrames <= release) {
    throw new RangeError(`holdFrames must be a whole number > releaseFrames (${release}), got ${o.holdFrames}`);
  }
  const common = { anchor: o.anchor, allowHard: o.allowHard };
  const push = o.pushFrames ?? 30;
  const into =
    o.kind === "slow-push"
      ? slowPush({ ...common, fromFrame: o.atFrame - push, toFrame: o.atFrame, to: o.scale })
      : o.kind === "snap-in"
        ? snapIn({ ...common, atFrame: o.atFrame, scale: o.scale })
        : punchStep({ ...common, atFrame: o.atFrame, scale: o.scale });
  return composeTrack([into, snapBack({ ...common, atFrame: o.atFrame + o.holdFrames, from: o.scale, rampFrames: release })]);
};


export const toCamKeys = (keys: PunchKey[], fps: number): [number, Cam][] => {
  if (!(fps > 0)) throw new RangeError(`fps must be > 0, got ${fps}`);
  if (!keys.length) return [[0, { scale: 1 }]];
  keys.forEach((k, i) => {
    if (i > 0 && k.frame <= keys[i - 1].frame) throw new RangeError(`camera keys must be strictly increasing (frame ${k.frame} after ${keys[i - 1].frame})`);
  });
  return keys.map((k): [number, Cam] => [k.frame / fps, { scale: k.scale, ax: k.ax, ay: k.ay }]);
};


export const toManifestKeys = (keys: PunchKey[], focus: Anchor = MANIFEST_FOCUS): ManifestCameraKey[] => {
  const f = anchorOf(focus);
  return keys.map((k) => ({ atFrame: k.frame, scale: k.scale, focusX: f.x, focusY: f.y }));
};

const checkBox = (b: NormBox): void => {
  const ok =
    [b.x, b.y, b.width, b.height].every(Number.isFinite) &&
    b.x >= 0 && b.y >= 0 && b.width > 0 && b.height > 0 &&
    b.x + b.width <= 1 + EPS && b.y + b.height <= 1 + EPS;
  if (!ok) throw new RangeError(`box ${JSON.stringify(b)} must be a positive rectangle inside 0..1`);
};


export const boxAfterPunch = (box: NormBox, anchor: Anchor, scale: number): NormBox => ({
  x: anchor.x + scale * (box.x - anchor.x),
  y: anchor.y + scale * (box.y - anchor.y),
  width: box.width * scale,
  height: box.height * scale,
});







export const anchorForBox = (box: NormBox, scale: number): Anchor | null => {
  checkBox(box);
  if (!Number.isFinite(scale) || scale < 1) throw new RangeError(`scale must be >= 1, got ${scale}`);
  const axis = (u0: number, size: number): number | null => {
    const centre = u0 + size / 2;
    if (scale * size > 1 + EPS) return null;
    if (scale - 1 < EPS) return centre;
    const lo = Math.max(0, (scale * (u0 + size) - 1) / (scale - 1));
    const hi = Math.min(1, (scale * u0) / (scale - 1));
    return Math.min(hi, Math.max(lo, centre));
  };
  const x = axis(box.x, box.width);
  const y = axis(box.y, box.height);
  return x === null || y === null ? null : { x, y };
};

// ---------------------------------------------------------------------------------------------------------------------
// Scene camera moves. Slow or sudden camera work on a full-frame (takeover) scene or on the graphics panel of a split scene.
// A presenter scene keeps the camera[] track above and its head gates, and the presenter part of a split scene (footage,
// window, head gates) is never touched: nothing here may be applied to the presenter plate.
//
// Everything below is plain maths over progress or seconds, with no React and no runtime import, so that the manifest
// schema, the editor, the library inventory and the renderer read one source. The component that draws it is
// core/scene-camera.tsx; the organic shake of "handheld" lives in core/organic.ts and is mixed in there.

export const SCENE_CAMERA_MOVES = ["snap-zoom", "orbit", "dolly", "handheld"] as const;
export type SceneCameraMove = (typeof SCENE_CAMERA_MOVES)[number];
export const SCENE_CAMERA_STRENGTHS = ["soft", "normal", "strong"] as const;
export type SceneCameraStrength = (typeof SCENE_CAMERA_STRENGTHS)[number];
export const DEFAULT_SCENE_CAMERA_STRENGTH: SceneCameraStrength = "normal";

/** What a scene may carry: the move, how hard, and for snap-zoom the scene frame it lands on. */
export type SceneCameraSpec = { move: SceneCameraMove; strength?: SceneCameraStrength; at?: number };

/** The camera pose of one frame: a scale, a shift in pixels and a turn about the frame centre in degrees. */
export type ScenePose = { scale: number; x: number; y: number; rotateX: number; rotateY: number };

/** Distance, in pixels, of the imaginary lens from the scene plane whenever a move turns it. */
export const SCENE_CAMERA_PERSPECTIVE = 1800;

/**
 * The size of the part of the picture a move works on, in pixels: the whole 1080 x 1920 frame of a takeover scene, or the graphics
 * panel of a split scene (the full width, down to the seam). The move turns about the centre of that area, and a move that turns or
 * shakes it is scaled up just enough to cover this area, so a short panel needs a little more than the frame does.
 */
export type SceneCameraArea = { width: number; height: number };
export const SCENE_CAMERA_FRAME: SceneCameraArea = { width: 1080, height: 1920 };

/** Scene families that already move their own camera: a second one on top would double the motion and break their own laws. */
export const SCENE_CAMERA_REFUSED_FAMILIES = ["one-shot", "screen-recording", "screen-focus"] as const;

const SNAP_PEAK: Record<SceneCameraStrength, number> = { soft: 0.05, normal: 0.1, strong: 0.18 };
const DOLLY_PUSH: Record<SceneCameraStrength, number> = { soft: 0.04, normal: 0.08, strong: 0.14 };
const ORBIT_YAW: Record<SceneCameraStrength, number> = { soft: 3, normal: 5, strong: 8 };
/** The orbit tips its pitch against the yaw by this share, so the view arcs instead of panning flat. */
const ORBIT_PITCH_SHARE = 0.2;

/** Seconds a snap-zoom takes to arrive, to stay at its peak and to relax back to the resting frame. */
export const SNAP_RISE_SEC = 0.14;
export const SNAP_HOLD_SEC = 0.3;
export const SNAP_RELAX_SEC = 0.9;

const COVER_MARGIN = 0.002;

const unit = (n: number): number => Math.min(1, Math.max(0, n));
const smooth = (p: number): number => p * p * (3 - 2 * p);
const outCubic = (p: number): number => 1 - (1 - p) ** 3;
const inOutCubic = (p: number): number => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);

/** Adding zero turns a negative zero into a plain zero, so a resting frame compares equal to the rest pose. */
const pose = (p: ScenePose): ScenePose => ({ scale: p.scale + 0, x: p.x + 0, y: p.y + 0, rotateX: p.rotateX + 0, rotateY: p.rotateY + 0 });

/**
 * The smallest scale at which a plane turned by rotateX and rotateY (degrees) under CSS `perspective(P)` still covers a
 * width x height frame, so a turn never shows what lies behind the scene. The transform order is the one the component
 * writes: perspective, rotateX, rotateY, scale. Found by bisection on a fixed number of steps, so it is deterministic.
 */
export const coverScale3d = (
  rotateXDeg: number,
  rotateYDeg: number,
  perspective: number = SCENE_CAMERA_PERSPECTIVE,
  width = 1080,
  height = 1920,
): number => {
  if (Math.abs(rotateXDeg) < 1e-9 && Math.abs(rotateYDeg) < 1e-9) return 1;
  const a = (rotateXDeg * Math.PI) / 180;
  const b = (rotateYDeg * Math.PI) / 180;
  const hw = width / 2;
  const hh = height / 2;
  const corners: [number, number][] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  const covered = (s: number): boolean => {
    const quad = corners.map(([x, y]): [number, number] => {
      const turnedX = x * s * Math.cos(b);
      const depthY = -x * s * Math.sin(b);
      const tiltedY = y * s * Math.cos(a) - depthY * Math.sin(a);
      const depth = y * s * Math.sin(a) + depthY * Math.cos(a);
      const k = perspective / (perspective - depth);
      return [turnedX * k, tiltedY * k];
    });
    return corners.every(([cx, cy]) => quad.every(([px, py], i) => {
      const [qx, qy] = quad[(i + 1) % 4];
      return (qx - px) * (cy - py) - (qy - py) * (cx - px) >= 0;
    }));
  };
  let lo = 1;
  let hi = 2;
  if (!covered(hi)) return hi;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (covered(mid)) hi = mid;
    else lo = mid;
  }
  return hi + COVER_MARGIN;
};

/** Orbit: the view arcs round the scene from one side to the other. Progress 0..1 runs across the scene; 0.5 is the resting frame. */
export const orbitAt = (
  t: number,
  strength: SceneCameraStrength = DEFAULT_SCENE_CAMERA_STRENGTH,
  area: SceneCameraArea = SCENE_CAMERA_FRAME,
): ScenePose => {
  if (!(area.width > 0) || !(area.height > 0) || !Number.isFinite(area.width) || !Number.isFinite(area.height)) {
    throw new RangeError(`orbitAt needs a positive, finite area, got ${area.width} x ${area.height}`);
  }
  const eased = smooth(unit(t));
  const rotateY = ORBIT_YAW[strength] * (2 * eased - 1);
  const rotateX = -ORBIT_YAW[strength] * ORBIT_PITCH_SHARE * (2 * eased - 1);
  return pose({ scale: coverScale3d(rotateX, rotateY, SCENE_CAMERA_PERSPECTIVE, area.width, area.height), x: 0, y: 0, rotateX, rotateY });
};

/** Dolly: one slow, eased push in across the whole scene. Progress 0..1 runs across the scene. */
export const dollyAt = (t: number, strength: SceneCameraStrength = DEFAULT_SCENE_CAMERA_STRENGTH): ScenePose =>
  pose({ scale: 1 + DOLLY_PUSH[strength] * smooth(unit(t)), x: 0, y: 0, rotateX: 0, rotateY: 0 });

/**
 * Snap-zoom: a punch in on a cue. Still until the cue, in within a few frames, held for a beat, then relaxed back to
 * the resting frame so the scene ends uncropped. Both arguments are seconds from the start of the scene.
 */
export const snapZoomAt = (sec: number, atSec: number, strength: SceneCameraStrength = DEFAULT_SCENE_CAMERA_STRENGTH): ScenePose => {
  if (!Number.isFinite(sec) || !Number.isFinite(atSec)) throw new RangeError(`snapZoomAt needs finite seconds, got ${sec} and ${atSec}`);
  const u = sec - atSec;
  const peak = SNAP_PEAK[strength];
  let extra = 0;
  if (u <= 0) extra = 0;
  else if (u < SNAP_RISE_SEC) extra = peak * outCubic(u / SNAP_RISE_SEC);
  else if (u < SNAP_RISE_SEC + SNAP_HOLD_SEC) extra = peak;
  else if (u < SNAP_RISE_SEC + SNAP_HOLD_SEC + SNAP_RELAX_SEC) extra = peak * (1 - inOutCubic((u - SNAP_RISE_SEC - SNAP_HOLD_SEC) / SNAP_RELAX_SEC));
  return pose({ scale: 1 + extra, x: 0, y: 0, rotateX: 0, rotateY: 0 });
};

/** The scene frame a snap-zoom lands on when the scene names none: a little before the middle, leaving room to relax. */
export const defaultSnapAt = (durationInFrames: number): number => Math.round(durationInFrames * 0.4);

/** The CSS transform of a pose about the frame centre. "none" for the resting frame. `rotate` is the roll a handheld shake adds. */
export const sceneCameraTransform = (p: ScenePose & { rotate?: number }, perspective: number = SCENE_CAMERA_PERSPECTIVE): string => {
  const n = (v: number): number => Number(v.toFixed(4));
  const parts: string[] = [];
  if (n(p.x) !== 0 || n(p.y) !== 0) parts.push(`translate(${n(p.x)}px, ${n(p.y)}px)`);
  if (n(p.rotateX) !== 0 || n(p.rotateY) !== 0) parts.push(`perspective(${perspective}px)`, `rotateX(${n(p.rotateX)}deg)`, `rotateY(${n(p.rotateY)}deg)`);
  if (n(p.rotate ?? 0) !== 0) parts.push(`rotate(${n(p.rotate ?? 0)}deg)`);
  if (n(p.scale) !== 1) parts.push(`scale(${n(p.scale)})`);
  return parts.length ? parts.join(" ") : "none";
};

/** The reasons a scene may not carry its camera, in the manifest's English; the editor shows the same rules in Arabic (review-editor/ops/explain.ts). */
export const sceneCameraIssues = (scene: {
  id: string;
  family: string;
  layout: string;
  durationInFrames: number;
  camera?: { move: string; at?: number };
}): string[] => {
  const camera = scene.camera;
  if (!camera) return [];
  const out: string[] = [];
  if (scene.layout !== "takeover" && scene.layout !== "split") {
    out.push(`${scene.id}: camera moves apply only to takeover (full-frame) and split scenes; a presenter scene keeps the presenter camera track and its head gates.`);
  }
  if ((SCENE_CAMERA_REFUSED_FAMILIES as readonly string[]).includes(scene.family)) {
    out.push(`${scene.id}: ${scene.family} already moves its own camera; a scene camera would double it.`);
  }
  if (camera.at !== undefined) {
    if (camera.move !== "snap-zoom") out.push(`${scene.id}: the camera cue "at" applies only to snap-zoom.`);
    else if (camera.at >= scene.durationInFrames) out.push(`${scene.id}: the snap-zoom cue must land inside its scene.`);
  }
  return out;
};
