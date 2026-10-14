import { FAMILY } from "../../core/fonts";
import type { StyleThemeModule } from "../theme-types";

export default {
  theme: {
    background: "#EAE7DC",
    card: "#FFFEF7",
    border: "#575A50",
    text: "#28322E",
    dim: "#60665C",
    accent: "#1E6470",
    good: "#347147",
    bad: "#A6422E",
    pill: "#FFFEF7",
    pillText: "#28322E",
    ar: FAMILY.tajawal,
    display: FAMILY.latinSerif,
    mono: FAMILY.plexMono,
    onAccent: "#FFFFFF",
  },
  layout: { kind: "adapted", seam: 1030, caption: 1240, title: 128, body: 204, titleTop: 48 },
  galleryCut: "none",
} satisfies StyleThemeModule;
