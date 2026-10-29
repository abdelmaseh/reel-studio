import React from "react";
import { AbsoluteFill } from "remotion";
import { FRAME } from "../core/safe";
import { BLUEPRINT, BLUEPRINT_LINE, blueprintFillValues, blueprintGreyValues, blueprintLineValues, blueprintMarks, num } from "./math.ts";
import { NOISE_TILE, noiseDataUri } from "./noise.ts";

const safeId = (raw: string, prefix: string): string => `${prefix}-${raw.replace(/[^a-zA-Z0-9_-]/g, "") || "x"}`;
/** Paper grain: the cached noise tile, faint, multiplied over the drawing. */
const SPECKLE_OPACITY = 0.08;
const SPECKLE_SCALE = 2;

/**
 * Blueprint: the picture becomes a cyanotype. Brightness is mapped between the deep paper blue and a lighter blue, white line work
 * is drawn where the picture differs from a softened copy of itself (a difference of Gaussians: two sides of every edge, cheap
 * compared with a convolution over the whole frame), and a faint paper grain is multiplied on top. Six filter primitives.
 */
export const BlueprintLook: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const id = safeId(React.useId(), "look-blueprint");
  return (
    <>
      <AbsoluteFill style={{ isolation: "isolate", background: BLUEPRINT.paper }}>
        <AbsoluteFill style={{ filter: `url(#${id})` }}>{children}</AbsoluteFill>
        <AbsoluteFill style={{ mixBlendMode: "multiply", opacity: SPECKLE_OPACITY, backgroundImage: `url(${noiseDataUri()})`,
          backgroundSize: `${NOISE_TILE * SPECKLE_SCALE}px ${NOISE_TILE * SPECKLE_SCALE}px`, imageRendering: "pixelated" }} />
      </AbsoluteFill>
      <svg aria-hidden width={0} height={0} style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}>
        <defs>
          <filter id={id} filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="matrix" values={blueprintFillValues()} result="fill" />
            <feColorMatrix in="SourceGraphic" type="matrix" values={blueprintGreyValues()} result="grey" />
            <feGaussianBlur in="grey" stdDeviation={num(BLUEPRINT_LINE.blur)} edgeMode="duplicate" result="soft" />
            <feBlend in="grey" in2="soft" mode="difference" result="detail" />
            <feColorMatrix in="detail" type="matrix" values={blueprintLineValues()} result="lines" />
            <feComposite in="lines" in2="fill" operator="over" />
          </filter>
        </defs>
      </svg>
    </>
  );
};

/** A fine grid with heavier lines every fifth, corner brackets, dimension lines and registration targets. Decoration only. */
export const BlueprintOverlay: React.FC = () => {
  const id = safeId(React.useId(), "look-grid");
  const { segments, circles } = React.useMemo(() => blueprintMarks(), []);
  const minor = BLUEPRINT.gridMinor, major = BLUEPRINT.gridMajor;
  return (
    <svg aria-hidden width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
      style={{ position: "absolute", left: 0, top: 0, width: FRAME.width, height: FRAME.height, pointerEvents: "none", mixBlendMode: "screen" }}>
      <defs>
        <pattern id={`${id}-minor`} width={minor} height={minor} patternUnits="userSpaceOnUse">
          <path d={`M${minor} 0H0V${minor}`} fill="none" stroke={BLUEPRINT.grid} strokeWidth={1} opacity={0.14} />
        </pattern>
        <pattern id={`${id}-major`} width={major} height={major} patternUnits="userSpaceOnUse">
          <path d={`M${major} 0H0V${major}`} fill="none" stroke={BLUEPRINT.grid} strokeWidth={1.5} opacity={0.26} />
        </pattern>
      </defs>
      <rect width={FRAME.width} height={FRAME.height} fill={`url(#${id}-minor)`} />
      <rect width={FRAME.width} height={FRAME.height} fill={`url(#${id}-major)`} />
      <g stroke={BLUEPRINT.line} strokeWidth={1.6} strokeLinecap="square" fill="none" opacity={0.5}>
        {segments.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
        {circles.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} />)}
      </g>
    </svg>
  );
};
