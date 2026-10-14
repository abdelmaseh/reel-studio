import { FAMILY } from "../../core/fonts";
import type { StyleThemeModule } from "../theme-types";

export default {
  theme: {
    background: "#EFE5D4",
    card: "#FFFCF3",
    border: "#5B554C",
    text: "#24242B",
    dim: "#665E53",
    accent: "#C93474",
    good: "#276D52",
    bad: "#B43E31",
    pill: "#FFFCF3",
    pillText: "#24242B",
    ar: FAMILY.tajawal,
    display: FAMILY.plexDisplay,
    mono: FAMILY.plexMono,
    onAccent: "#FFFFFF",
  },
  layout: { kind: "adapted", seam: 1080, caption: 1320, title: 136, body: 208, titleTop: 40 },
  galleryCut: "none",
} satisfies StyleThemeModule;
