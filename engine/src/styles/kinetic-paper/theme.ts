import { FAMILY } from "../../core/fonts";
import type { StyleThemeModule } from "../theme-types";

export default {
  theme: {
    background: "#F6F1E8",
    card: "#FBF8F0",
    border: "#15231F",
    text: "#15231F",
    dim: "#52645A",
    accent: "#DDF25E",
    good: "#286C45",
    bad: "#E96245",
    pill: "#15231F",
    pillText: "#F6F1E8",
    ar: FAMILY.cairo,
    display: FAMILY.lalezar,
    mono: FAMILY.plexMono,
    accentInk: "#365126",
    onAccent: "#15231F",
    badInk: "#AB3824",
  },
  layout: { kind: "adapted", seam: 1056, caption: 1320, title: 142, body: 208, titleTop: 42 },
  caption: {takeoverCenter:1320},
  galleryCut: "none",
} satisfies StyleThemeModule;
