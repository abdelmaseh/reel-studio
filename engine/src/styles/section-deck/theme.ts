import type { StyleThemeModule } from "../theme-types";
import { FONT, LAYOUT, PALETTE, SECTION_BG } from "./format";

export default {
  theme: {
    background: SECTION_BG.navy,
    card: PALETTE.cardBg,
    border: PALETTE.cardBorder,
    text: PALETTE.text,
    dim: PALETTE.dim,
    accent: PALETTE.accent,
    good: PALETTE.chipGreen,
    bad: PALETTE.chipRed,
    pill: PALETTE.pillBg,
    pillText: PALETTE.pillText,
    ar: FONT.arNaskh,
    display: FONT.sans,
    mono: FONT.mono,
  },
  layout: { kind: "legacy", seam: LAYOUT.seamY, caption: LAYOUT.captionY.centerFull },
  galleryCut: "flash-bloom",
} satisfies StyleThemeModule;
