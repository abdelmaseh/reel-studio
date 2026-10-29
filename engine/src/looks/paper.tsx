import React from "react";
import { AbsoluteFill, Solid } from "remotion";
import { paper } from "@remotion/effects/paper";
import { FRAME, useProbe } from "../core/safe";
import { PAPER_BACKDROP, PAPER_LOOK } from "./effects.ts";

/**
 * Paper, the look: the picture printed on a sheet. A sheet of paper texture (no folds) is multiplied over the picture at 50 % so skin and
 * type stay natural; the captions above are untouched. Nothing in the sheet depends on the frame, so it never flickers and the effect chain
 * is drawn once and kept. Paper is the heaviest of the effects (a few seconds for the first frame in the render browser, then free).
 */
export const PaperLook: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ isolation: "isolate" }}>
    {children}
    <Solid width={FRAME.width} height={FRAME.height} color={PAPER_LOOK.sheet} effects={[paper(PAPER_LOOK.texture)]}
      style={{ position: "absolute", left: 0, top: 0, mixBlendMode: PAPER_LOOK.blend, opacity: PAPER_LOOK.opacity, pointerEvents: "none" }} />
  </AbsoluteFill>
);

/**
 * Paper, the backdrop: a white sheet of paper grain multiplied over the scene's own ground (the style's background), so the ground keeps its hue
 * and is at most 17 % darker anywhere, and text that reads on the ground reads on the paper. Decoration: it draws nothing under the safe-zone probe.
 */
export const PaperBackdrop: React.FC = () => {
  const probe = useProbe();
  if (probe) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Solid width={FRAME.width} height={FRAME.height} color={PAPER_BACKDROP.sheet}
        effects={[paper({ ...PAPER_LOOK.texture, amount: PAPER_BACKDROP.amount, colorFront: PAPER_BACKDROP.front, colorBack: PAPER_BACKDROP.back })]}
        style={{ position: "absolute", left: 0, top: 0, mixBlendMode: PAPER_BACKDROP.blend }} />
    </AbsoluteFill>
  );
};
