import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  DEFAULT_SCENE_CAMERA_STRENGTH,
  SCENE_CAMERA_FRAME,
  defaultSnapAt,
  dollyAt,
  orbitAt,
  sceneCameraTransform,
  snapZoomAt,
  type SceneCameraArea,
  type SceneCameraSpec,
  type SceneCameraStrength,
  type ScenePose,
} from "./camera";
import { HANDHELD, handheld } from "./organic";
import { FRAME, useProbe } from "./safe";

/** A handheld shake per strength: the breathing, hand-held and walking presets of core/organic.ts. */
const HANDHELD_PRESET = { soft: HANDHELD.breath, normal: HANDHELD.hand, strong: HANDHELD.walk } as const;

/** The pose plus the roll that only a handheld shake adds. */
export type SceneCameraPose = ScenePose & { rotate?: number };

export type SceneCameraFrame = {
  /** Seeds the handheld shake: every scene shakes its own way, and the same scene always shakes the same way. */
  sceneId: string;
  /** The frame inside the scene (what `useCurrentFrame()` reports inside a Sequence). */
  frame: number;
  fps: number;
  durationInFrames: number;
  /** The part of the picture the move works on; the whole frame when left out. */
  area?: SceneCameraArea;
};

/**
 * The camera pose of one scene frame. A pure function of the move, the scene and the frame: no clock, no randomness.
 * Orbit and dolly run across the whole scene; snap-zoom lands on `camera.at` (a scene frame) and handheld is organic noise.
 * The turn and the shake are scaled up to cover `area` (the whole frame unless the scene works on a panel of it).
 */
export function sceneCameraPose(camera: SceneCameraSpec, { sceneId, frame, fps, durationInFrames, area = SCENE_CAMERA_FRAME }: SceneCameraFrame): SceneCameraPose {
  const strength: SceneCameraStrength = camera.strength ?? DEFAULT_SCENE_CAMERA_STRENGTH;
  const progress = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
  switch (camera.move) {
    case "orbit":
      return orbitAt(progress, strength, area);
    case "dolly":
      return dollyAt(progress, strength);
    case "snap-zoom":
      return snapZoomAt(frame / fps, (camera.at ?? defaultSnapAt(durationInFrames)) / fps, strength);
    case "handheld": {
      const shake = handheld(`scene-camera:${sceneId}`, frame, fps, { ...HANDHELD_PRESET[strength], width: area.width, height: area.height });
      return { scale: shake.scale, x: shake.x, y: shake.y, rotateX: 0, rotateY: 0, rotate: shake.rotate };
    }
  }
}

/** A rectangle of the frame in pixels. */
export type SceneCameraBox = { x: number; y: number; width: number; height: number };

/**
 * Moves a whole scene as if a camera filmed it. Mount it directly around the scene's layer, inside the scene's Sequence,
 * so that entrances and transitions wrap the moving scene and the frame number is the scene's own.
 * The safe-zone probe measures the resting layout, so under a probe the scene is drawn untouched.
 *
 * Without `area` the whole frame moves about its centre (a takeover scene). With `area` (the graphics panel of a split scene, down to
 * the seam) only that rectangle is the picture: the move turns about its centre, is scaled to cover it, and is clipped to it, so no
 * pixel of the moved scene can reach the presenter part below. The scene keeps its own frame-sized layout inside the clip.
 */
export const SceneCamera: React.FC<{
  camera: SceneCameraSpec;
  sceneId: string;
  durationInFrames: number;
  area?: SceneCameraBox;
  frameOverride?: number;
  children?: React.ReactNode;
}> = ({ camera, sceneId, durationInFrames, area, children, frameOverride }) => {
  const clock = useCurrentFrame();
  const frame = frameOverride ?? clock;
  const { fps } = useVideoConfig();
  if (useProbe() !== null) return <>{children}</>;
  const transform = sceneCameraTransform(sceneCameraPose(camera, { sceneId, frame, fps, durationInFrames, ...(area ? { area: { width: area.width, height: area.height } } : {}) }));
  if (!area) return <AbsoluteFill style={{ transform, transformOrigin: "50% 50%" }}>{children}</AbsoluteFill>;
  return (
    <div style={{ position: "absolute", left: area.x, top: area.y, width: area.width, height: area.height, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          left: -area.x,
          top: -area.y,
          right: "auto",
          bottom: "auto",
          width: FRAME.width,
          height: FRAME.height,
          transform,
          transformOrigin: `${area.x + area.width / 2}px ${area.y + area.height / 2}px`,
        }}
      >
        {children}
      </AbsoluteFill>
    </div>
  );
};
