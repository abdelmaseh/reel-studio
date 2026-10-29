import { FAMILY } from "../../core/fonts";
import type { StyleThemeModule } from "../theme-types";

export default {
  theme: {
    background: "#050916",
    card: "#172338",
    border: "#647991",
    text: "#FFFFFF",
    dim: "rgba(255,255,255,0.74)",
    accent: "#64E4FF",
    good: "#86E8BC",
    bad: "#FF8DAB",
    pill: "#172338",
    pillText: "#FFFFFF",
    ar: FAMILY.gridSans,
    display: FAMILY.plexDisplay,
    mono: FAMILY.plexMono,
    onAccent: "#050916",
  },
  layout: { kind: "adapted", seam: 1080, caption: 1340, title: 138, body: 208, titleTop: 40 },
  caption: {takeoverCenter:1340},
  galleryCut: "none",
} satisfies StyleThemeModule;
