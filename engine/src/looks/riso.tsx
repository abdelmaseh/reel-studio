import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FRAME } from "../core/safe";
import { RISO_BLEED, RISO_PAPER, RISO_REGISTRATION, grainOffsetAt, inkMatrixValues, num, plateMatrixValues } from "./math.ts";
import { NOISE_TILE, noiseDataUri } from "./noise.ts";

/** Ink plates never print solid: a little paper shows through, like a real drum print. */
const INK_DENSITY = 0.95;
/** How much of the grainy tone image is noise (the rest is the picture). The tone is (1 - w) * coverage + w * noise, thresholded at 0.5. */
const GRAIN_WEIGHT = 0.3;
/** Each grain cell covers this many screen pixels per side. */
const GRAIN_SCALE = 2;
/** Steepness of the ink threshold: high = crisp grain, low = soft tones. */
const THRESHOLD_SLOPE = 14;
/** Levels on the coverage before the grain: pale tones print as clean paper, dark tones as solid ink; only the mid-tones are grainy. */
const LEVELS = { slope: 1.3, intercept: -0.12 } as const;
/** Paper fibre: the same noise, large and faint, multiplied over the whole print. */
const FIBRE_OPACITY = 0.07;
const FIBRE_SCALE = 5;

const safeId = (raw: string, prefix: string): string => `${prefix}-${raw.replace(/[^a-zA-Z0-9_-]/g, "") || "x"}`;

/**
 * Riso: the picture is separated into two ink plates (least-squares unmixing in one feColorMatrix), a tile of seeded noise is mixed
 * into the tone image so each plate breaks into grain, and a second small filter turns each plate into its ink colour, shifts the
 * plates a couple of pixels the opposite way (hand feeding) and multiplies them onto warm paper. The expensive parts of the obvious
 * way to do this (turbulence and long filter chains over the whole frame) are avoided on purpose: the noise is a cached bitmap and
 * the filters have a handful of primitives, which keeps a frame in the same cost class as the plain render. The grain tile moves to a
 * new place every few frames, so a frame is a pure function of its number.
 */
export const RisoLook: React.FC<{ inks: readonly [string, string]; paper?: string; children?: React.ReactNode }> = ({ inks, paper = RISO_PAPER, children }) => {
  const frame = useCurrentFrame();
  const id = safeId(React.useId(), "look-riso");
  const scale = 1 + (2 * RISO_BLEED) / FRAME.width;
  // The sheet is a little larger than the frame on every side and the picture is scaled to cover it, so the shifted plates and the
  // blurred grain never expose an edge; the frame crops the sheet.
  const sheet = { position: "absolute", left: -RISO_BLEED, top: -RISO_BLEED, width: FRAME.width + 2 * RISO_BLEED, height: FRAME.height + 2 * RISO_BLEED } as const;
  const noise = `url(${noiseDataUri()})`;
  const grain = grainOffsetAt(frame, NOISE_TILE * GRAIN_SCALE);
  const fibre = grainOffsetAt(0, NOISE_TILE * FIBRE_SCALE);
  return (
    <>
      <AbsoluteFill style={{ isolation: "isolate", overflow: "hidden", background: paper }}>
        <div style={{ ...sheet, mixBlendMode: "multiply", filter: `url(#${id}-plates)` }}>
          <div style={{ position: "absolute", inset: 0, background: "#ffffff", filter: `url(#${id}-separate)` }}>
            <div style={{ position: "absolute", left: RISO_BLEED, top: RISO_BLEED, width: FRAME.width, height: FRAME.height, transform: `scale(${num(scale)})`, transformOrigin: "50% 50%" }}>{children}</div>
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: GRAIN_WEIGHT, backgroundImage: noise, backgroundSize: `${NOISE_TILE * GRAIN_SCALE}px ${NOISE_TILE * GRAIN_SCALE}px`,
            backgroundPosition: `${grain.x}px ${grain.y}px`, imageRendering: "pixelated" }} />
        </div>
        <AbsoluteFill style={{ mixBlendMode: "multiply", opacity: FIBRE_OPACITY, backgroundImage: noise, backgroundSize: `${NOISE_TILE * FIBRE_SCALE}px ${NOISE_TILE * FIBRE_SCALE}px`,
          backgroundPosition: `${fibre.x}px ${fibre.y}px` }} />
      </AbsoluteFill>
      <svg aria-hidden width={0} height={0} style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}>
        <defs>
          {/* 1. The picture as ink coverage: red = plate 1, green = plate 2. */}
          <filter id={`${id}-separate`} filterUnits="objectBoundingBox" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={inkMatrixValues(inks, LEVELS)} />
          </filter>
          {/* 2. The grainy tone image becomes two ink plates, shifted against each other and multiplied. */}
          <filter id={`${id}-plates`} filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="matrix" values={plateMatrixValues(inks[0], "r", THRESHOLD_SLOPE, INK_DENSITY)} result="plate1" />
            <feOffset in="plate1" dx={num(RISO_REGISTRATION.a.dx)} dy={num(RISO_REGISTRATION.a.dy)} result="plate1s" />
            <feColorMatrix in="SourceGraphic" type="matrix" values={plateMatrixValues(inks[1], "g", THRESHOLD_SLOPE, INK_DENSITY)} result="plate2" />
            <feOffset in="plate2" dx={num(RISO_REGISTRATION.b.dx)} dy={num(RISO_REGISTRATION.b.dy)} result="plate2s" />
            <feBlend in="plate2s" in2="plate1s" mode="multiply" />
          </filter>
        </defs>
      </svg>
    </>
  );
};
