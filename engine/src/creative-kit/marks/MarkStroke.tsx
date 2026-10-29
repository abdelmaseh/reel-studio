// A hand-drawn mark that draws itself on: circle, band, strike, arrow or underline over a word.
// The path comes from rough.ts (seeded, so every render draws the same hand); this component only moves the progress.
import React from "react";
import { DrawPath, VectorLayer, type ProbeRole } from "../../core/draw";
import { useClock } from "../../core/motion";
import { useProbe } from "../../core/safe";
import { passProgress, roughDrawFrames, roughMark, roughProgress, type RoughDir, type RoughKind, type RoughRect } from "./rough.ts";

export type MarkStrokeProps = {
  kind: RoughKind;
  /** The marked word's box, in the coordinates of the layer this component sits in. */
  target: RoughRect;
  dir: RoughDir;
  /** Scene frame where the pen touches down. */
  at: number;
  color: string;
  /** Same seed, same stroke: use something tied to the word, never to the frame. */
  seed: string;
  /** Frames the draw-on takes. Defaults to 0.3 to 0.5 s for the kind. */
  durFrames?: number;
  strokeWidth?: number;
  roughness?: number;
  /** An arrow comes in from below the word (default) or from above it. */
  from?: "below" | "above";
  /** Multiplies every pass opacity (a band is drawn at 0.6 per pass already). */
  opacity?: number;
  /** Content counts in the safe-zone probe; use "decoration" for a mark that must not be measured. */
  probeRole?: ProbeRole;
};

export const MarkStroke: React.FC<MarkStrokeProps> = ({ kind, target, dir, at, color, seed, durFrames, strokeWidth, roughness, from, opacity = 1, probeRole = "content" }) => {
  const { frame, fps } = useClock();
  const probe = useProbe();
  const { x, y, width, height } = target;
  const stroke = React.useMemo(
    () => roughMark(kind, { x, y, width, height }, dir, { seed, strokeWidth, roughness, from }),
    [kind, x, y, width, height, dir, seed, strokeWidth, roughness, from],
  );
  const progress = probe ? 1 : roughProgress(frame, at, durFrames ?? roughDrawFrames(kind, fps));
  if (progress <= 0) return null;
  return (
    <VectorLayer>
      {stroke.passes.map((pass, index) => {
        const drawn = passProgress(pass, progress);
        if (drawn <= 0) return null;
        return (
          <DrawPath
            key={index}
            d={pass.d}
            progress={drawn}
            stroke={color}
            strokeWidth={stroke.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={pass.opacity * opacity}
            probeRole={probeRole}
          />
        );
      })}
    </VectorLayer>
  );
};
