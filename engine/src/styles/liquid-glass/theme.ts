import { FAMILY } from "../../core/fonts";
import type { StyleThemeModule } from "../theme-types";

export default {
  theme: {
    background: "#050916",
    card: "#172338",
    border: "#647991",
    text: "#F5FAFF",
    dim: "#C2D0E4",
    accent: "#64E4FF",
    good: "#86E8BC",
    bad: "#FF8DAB",
    pill: "#172338",
    pillText: "#F5FAFF",
    ar: FAMILY.cairo,
    display: FAMILY.plexDisplay,
    mono: FAMILY.plexMono,
    onAccent: "#050916",
  },
  layout: { kind: "adapted", seam: 1080, caption: 1340, title: 138, body: 208, titleTop: 40 },
  galleryCut: "none",
} satisfies StyleThemeModule;
