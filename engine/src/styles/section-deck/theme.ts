import type { StyleThemeModule } from "../theme-types";
import { FONT, LAYOUT, PALETTE } from "./format";

export default {
  theme: {
    background: "#0A1428",
    sectionDeck: {grounds: [["#0A1428", "#1E3A6E"], ["#110D2C", "#3A2C86"], ["#1C0B05", "#5A2410"]], faint: "rgba(255,255,255,0.12)"},
    onAccent: "#1A0A03",
    card: PALETTE.cardBg,
    border: PALETTE.cardBorder,
    text: PALETTE.text,
    dim: "rgba(255,255,255,0.64)",
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
  caption: {takeoverCenter:LAYOUT.captionY.centerFull},
  galleryCut: "flash-bloom",
} satisfies StyleThemeModule;
