import { FAMILY } from "../../core/fonts";
import type { StyleThemeModule } from "../theme-types";

export const PAPER_COLLAGE_PALETTE = {ground: '#EAE7DC', teal: '#1E6470', terra: '#C8623E', mustard: '#E2B13C', card: '#FFFEF7', ink: '#28322E'} as const;
export const PAPER_COLLAGE_CAPTION_CENTER = 1240;

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
    onAccent: "#FFFEF7",
  },
  layout: { kind: "adapted", seam: 1030, caption: PAPER_COLLAGE_CAPTION_CENTER, title: 128, body: 204, titleTop: 48 },
  caption: {takeoverCenter:1240},
  galleryCut: "none",
} satisfies StyleThemeModule;
