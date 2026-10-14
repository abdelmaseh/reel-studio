import type { StyleThemeModule } from "../theme-types";
import { FONT, LAYOUT, PALETTE } from "./format";

export default {
  theme: {
    background: PALETTE.canvas,
    card: PALETTE.canvasDeep,
    border: PALETTE.band,
    text: PALETTE.ink,
    dim: PALETTE.inkSoft,
    accent: PALETTE.accent,
    good: PALETTE.success,
    bad: PALETTE.alert,
    pill: PALETTE.pillBg,
    pillText: PALETTE.pillText,
    ar: FONT.ar,
    display: FONT.display,
    mono: FONT.mono,
  },
  layout: { kind: "legacy", seam: LAYOUT.seamY, caption: LAYOUT.captionY.lowThirdSafe },
  galleryCut: "leak-or-whiteout",
} satisfies StyleThemeModule;
