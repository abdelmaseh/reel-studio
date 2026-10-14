import { FAMILY } from "../../core/fonts";
import type { StyleThemeModule } from "../theme-types";

export default {
  theme: {
    background: "#1A100D",
    card: "#35231B",
    border: "#BA8755",
    text: "#FFF4E5",
    dim: "#DEC8AD",
    accent: "#FFD075",
    good: "#9FE0B0",
    bad: "#F09576",
    pill: "#2E1D17",
    pillText: "#FFF4E5",
    ar: FAMILY.cairo,
    display: FAMILY.plexDisplay,
    mono: FAMILY.plexMono,
    onAccent: "#35210A",
  },
  layout: { kind: "adapted", seam: 1080, caption: 1320, title: 138, body: 210, titleTop: 40 },
  galleryCut: "none",
} satisfies StyleThemeModule;
