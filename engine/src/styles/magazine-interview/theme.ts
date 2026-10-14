import { FAMILY } from "../../core/fonts";
import type { StyleThemeModule } from "../theme-types";

export default {
  theme: {
    background: "#081321",
    card: "#102338",
    border: "#4F6D80",
    text: "#F5F3EC",
    dim: "#BBCED9",
    accent: "#F3C776",
    good: "#79CBBB",
    bad: "#F2A3A3",
    pill: "transparent",
    pillText: "#F5F3EC",
    ar: FAMILY.cairo,
    display: FAMILY.latinSerif,
    mono: FAMILY.plexMono,
    onAccent: "#081321",
  },
  layout: { kind: "adapted", seam: 1080, caption: 1300, title: 148, body: 218, titleTop: 40 },
  galleryCut: "none",
} satisfies StyleThemeModule;
