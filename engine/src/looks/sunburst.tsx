import React from "react";
import { AbsoluteFill, Solid } from "remotion";
import { starburst } from "@remotion/effects/starburst";
import { useClock } from "../core/motion";
import { FRAME, useProbe } from "../core/safe";
import { SUNBURST, sunburstRotation, sunburstTones } from "./effects.ts";

export type SunburstBackdropProps = {
  /** The tint of the rays: the style's accent. */
  colour?: string;
  /** The ground the rays are tinted from: the style's background. The two ray tones stay close to it, so text keeps its contrast. */
  ground?: string;
  /** How fast the rays turn: 1 = 3 degrees per second. */
  speed?: number;
};

/**
 * A sunburst behind a scene: sixteen rays in two tones of the style's own ground, tinted toward its accent, turning slowly. It is one <Solid>
 * with the starburst effect, a layer of its own, so nothing is applied to the scene. Decoration: it draws nothing under the safe-zone probe.
 * A frame is a pure function of the frame number and the props, and the rotation is never zero (at zero the ray phase differs between GL backends).
 */
export const SunburstBackdrop: React.FC<SunburstBackdropProps> = ({ colour, ground, speed = 1 }) => {
  const probe = useProbe();
  const { t } = useClock();
  if (probe) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Solid width={FRAME.width} height={FRAME.height} color="#ffffff"
        effects={[starburst({ rays: SUNBURST.rays, colors: sunburstTones(colour, ground), rotation: sunburstRotation(t, speed), smoothness: SUNBURST.smoothness })]}
        style={{ position: "absolute", left: 0, top: 0 }} />
    </AbsoluteFill>
  );
};
