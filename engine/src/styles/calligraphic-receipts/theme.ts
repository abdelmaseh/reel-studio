import { FAMILY } from "../../core/fonts";
import type { StyleThemeModule } from "../theme-types";

export default {
  theme: {
    background: "#F4EDE1",
    card: "#FFFCF5",
    border: "#B6A28B",
    text: "#2E2019",
    dim: "#75604F",
    accent: "#A54522",
    good: "#2D6948",
    bad: "#AF352A",
    pill: "transparent",
    pillText: "#2E2019",
    ar: FAMILY.naskh,
    display: FAMILY.latinSerif,
    mono: FAMILY.plexMono,
    onAccent: "#FFFFFF",
  },
  layout: { kind: "adapted", seam: 1000, caption: 1260, title: 156, body: 218, titleTop: 38 },
  galleryCut: "none",
} satisfies StyleThemeModule;
