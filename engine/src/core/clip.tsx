import React from "react";
import { Footage } from "./plate";
import { useClock } from "./motion";
import { clipEnlargementIssue, type ClipValue } from "./clip-schema";

export type SceneClipProps = {
  clip: ClipValue;
  /** The box the clip fills, in canvas pixels. */
  width: number;
  height: number;
  style?: React.CSSProperties;
};

/**
 * The one way a scene draws a clip. It plays the verified, silent file through the same Footage component the presenter uses, so the
 * safe-zone probe, the WebCodecs switch and the preview proxies apply. The fill mode goes to Footage as its objectFit prop, never as a style,
 * because the WebCodecs engine overwrites a style objectFit. A clip enlarged beyond CLIP_MAX_ENLARGEMENT in its box fails the render instead
 * of going soft; the refusal is the same function (and wording) the manifest rule uses.
 */
export const SceneClip: React.FC<SceneClipProps> = ({ clip, width, height, style }) => {
  const { fps } = useClock();
  const issue = clipEnlargementIssue(clip, { width, height }, `SceneClip ${clip.src}`, { contain: clip.fit === "contain" });
  if (issue) throw new Error(issue);
  const focus = clip.focus ?? { x: 0.5, y: 0.5 };
  return (
    <div style={{ position: "relative", width, height, overflow: "hidden", ...style }}>
      <Footage src={clip.src} muted startFromSec={clip.trimBeforeFrame / fps} objectFit={clip.fit} style={{ objectPosition: `${focus.x * 100}% ${focus.y * 100}%` }} />
    </div>
  );
};
