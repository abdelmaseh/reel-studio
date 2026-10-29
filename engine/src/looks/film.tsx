import React from "react";
import { AbsoluteFill, Solid, useCurrentFrame } from "remotion";
import { noise } from "@remotion/effects/noise";
import { vignette } from "@remotion/effects/vignette";
import { FRAME } from "../core/safe";
import { FILM, filmSeed } from "./effects.ts";

/**
 * Film: the picture, unchanged, with one layer over it that darkens the corners a little and moves a fine grain across the frame. The layer
 * is mid-grey with a vignette and a noise effect, blended in with `overlay`: mid-grey does nothing in an overlay, so only the corners and the
 * grain reach the picture, and the grain is strongest in the mid-tones, as it is on film. Captions are mounted by PreparedEdit above this
 * layer and are never touched. The grain is a pure function of the frame number: a new one every frame, the same one on every render.
 */
export const FilmLook: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ isolation: "isolate" }}>
      {children}
      <Solid width={FRAME.width} height={FRAME.height} color={FILM.base}
        effects={[vignette(FILM.vignette), noise({ amount: FILM.grain, seed: filmSeed(frame) })]}
        style={{ position: "absolute", left: 0, top: 0, mixBlendMode: FILM.blend, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
