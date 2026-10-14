import { FAMILY } from "../../core/fonts";
import type { StyleThemeModule } from "../theme-types";

export default {
  theme: {
    background: "#D9D9D4",
    card: "#F6F5EE",
    border: "#262823",
    text: "#262823",
    dim: "#5D6057",
    accent: "#E4C62F",
    good: "#376A40",
    bad: "#A13727",
    pill: "#F6F5EE",
    pillText: "#262823",
    ar: FAMILY.naskh,
    display: FAMILY.latinSerif,
    mono: FAMILY.plexMono,
    accentInk: "#655510",
    onAccent: "#262823",
  },
  layout: { kind: "adapted", seam: 1000, caption: 1300, title: 144, body: 212, titleTop: 44 },
  galleryCut: "none",
} satisfies StyleThemeModule;
