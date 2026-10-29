// Captions under a look. The caption track is drawn after the look and is never filtered, but a caption with no backing of its own
// (the minimal presentation, and the pill of the styles whose pill is transparent) would sit straight on the filtered picture: speckled
// grain under riso, mid blue under blueprint. For those the caption gets a plain chip in the look's own colours, so its contrast is
// fixed by construction and does not depend on what happens to be behind it. Captions that already have an opaque backing are untouched.
import { contrastRatio, mixToHex } from "../core/chapters.ts";
import { BLUEPRINT, RISO_PAPER, hexToRgb, resolveInks, rgbToHex } from "./math.ts";
import type { LookKind } from "./index.ts";

export const CAPTION_MIN_CONTRAST = 4.5;

export type CaptionGuard = { background: string; wordColor: string };

/** The ink the caption text is printed in: the two inks overprinted, or the darker single ink, whichever reads on the paper at 7:1. */
export function risoCaptionInk(inks: readonly [string, string]): string {
  const [a, b] = inks.map(hexToRgb);
  const overprint = rgbToHex([a[0] * b[0], a[1] * b[1], a[2] * b[2]]);
  const candidates = [overprint, ...inks, mixToHex(overprint, "#000000", 0.5), "#14120f"];
  return candidates.find((ink) => contrastRatio(ink, RISO_PAPER) >= 7) ?? "#14120f";
}

/**
 * The backing a caption needs under `look`, or null when it needs none. `background` is the caption's own background colour:
 * "transparent" means the text sits straight on the picture.
 */
// film and paper add a layer over the picture instead of filtering it, and the captions are drawn above that layer, so they need no chip:
// film's grain is held under FILM_GRAIN_MAX (effects.ts) and paper is a multiply, which can only darken what a caption sat on. Both are named
// here on purpose, so a new look has to decide for itself (the compiler checks the switch).
export function lookCaptionGuard(look: { kind: LookKind; inks?: readonly string[] } | null | undefined, background: string): CaptionGuard | null {
  if (!look || background !== "transparent") return null;
  switch (look.kind) {
    case "blueprint": return { background: BLUEPRINT.paper, wordColor: BLUEPRINT.line };
    case "riso": return { background: RISO_PAPER, wordColor: risoCaptionInk(resolveInks(look)) };
    case "film":
    case "paper": return null;
  }
}
