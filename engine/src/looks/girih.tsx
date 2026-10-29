import React from "react";
import { AbsoluteFill } from "remotion";
import { useClock } from "../core/motion";
import { FRAME, useProbe } from "../core/safe";
import { GIRIH_DELAY_RADIUS, closedPath, girihCells, girihOpacity, girihProgress, girihRotation, num, type GirihFold, type Pt } from "./math.ts";

/** Pitch (flat-to-flat width of the main polygon) at density 1, in px. */
export const GIRIH_PITCH = 240;
/** Where the pattern grows from and turns about. */
export const GIRIH_CENTRE: Pt = { x: 540, y: 760 };

export type GirihBackdropProps = {
  /** Line colour. */
  colour?: string;
  /** How fast it draws and turns: 1 = 0.6 s per cell and 2 degrees per second. */
  speed?: number;
  /** Cells per unit area relative to the default; 2 gives half the pitch. */
  density?: number;
  /** 8 = octagons and eight-point stars (the classic), 6 = hexagrams, 12 = twelve-point stars. */
  fold?: GirihFold;
  centre?: Pt;
  /** Opacity while it draws, and the faint texture it settles to. */
  base?: number;
  rest?: number;
  /** Seconds before the opacity eases from `base` to `rest`. */
  settle?: number;
  /** Second at which it fades out, if the scene ends before the backdrop does. */
  out?: number;
  strokeWidth?: number;
};

/**
 * An animated star pattern in the girih manner, constructed in code (see hankinStar in math.ts): every cell draws its outline and its
 * star line from the centre outwards, the whole pattern turns slowly and then settles to a faint texture. SVG stroke-dash only.
 * Decoration: it draws nothing under the safe-zone probe. A frame is a pure function of the frame number and the props.
 */
export const GirihBackdrop: React.FC<GirihBackdropProps> = ({
  colour = "#ffffff", speed = 1, density = 1, fold = 8, centre = GIRIH_CENTRE, base = 0.5, rest = 0.15, settle = 1.5, out, strokeWidth = 3,
}) => {
  const probe = useProbe();
  const { t } = useClock();
  const pitch = GIRIH_PITCH / Math.max(0.2, density);
  const cx = centre.x, cy = centre.y;
  // Far enough to cover the frame corners after the slow rotation, plus one cell so the rim never shows a gap.
  const reach = Math.ceil(Math.max(Math.hypot(Math.max(cx, FRAME.width - cx), Math.max(cy, FRAME.height - cy)) + pitch, 0));
  const cells = React.useMemo(() => girihCells({ fold, pitch, radius: Math.min(reach, GIRIH_DELAY_RADIUS + pitch), centre: { x: cx, y: cy } }), [fold, pitch, reach, cx, cy]);
  if (probe) return null;
  const opacity = girihOpacity(t, { base, rest, settle, out });
  if (opacity <= 0) return null;
  const spin = girihRotation(t, speed);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg aria-hidden width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
        style={{ position: "absolute", left: 0, top: 0, width: FRAME.width, height: FRAME.height }}>
        <g opacity={num(opacity, 4)} transform={`rotate(${num(spin, 3)} ${num(cx, 2)} ${num(cy, 2)})`} fill="none" stroke={colour}
          strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round">
          {cells.map((cell) => {
            const dashOffset = num(1 - girihProgress(cell, { x: cx, y: cy }, t, speed), 3);
            return (
              <React.Fragment key={cell.id}>
                <path d={closedPath(cell.outline)} pathLength={1} strokeDasharray="1 1" strokeDashoffset={dashOffset} strokeWidth={strokeWidth / 2} strokeOpacity={0.45} />
                <path d={closedPath(cell.star)} pathLength={1} strokeDasharray="1 1" strokeDashoffset={dashOffset} />
              </React.Fragment>
            );
          })}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
