import { FAMILY } from "../../core/fonts";
import type { StyleThemeModule } from "../theme-types";

export default {
  theme: {
    background: "#171C24",
    card: "#252D37",
    border: "#758290",
    text: "#F8F2E8",
    dim: "#CCD3D9",
    accent: "#F3C665",
    good: "#8FDEA8",
    bad: "#F58A84",
    pill: "transparent",
    pillText: "#F8F2E8",
    ar: FAMILY.cairo,
    display: FAMILY.latinSerif,
    mono: FAMILY.plexMono,
    onAccent: "#171C24",
  },
  layout: { kind: "adapted", seam: 1056, caption: 1240, title: 118, body: 190, titleTop: 44 },
  galleryCut: "none",
} satisfies StyleThemeModule;
