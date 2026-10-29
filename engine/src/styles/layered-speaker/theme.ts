import { FAMILY } from '../../core/fonts';
import type { StyleThemeModule } from '../theme-types.ts';

// Ink night with one marker yellow. The speaker's own picture carries the colour; the words are heavy white with a dark outline.
// Shared families drawn in this style use these tokens; the layered-speaker scene reads them for the marks and the accent word.
export default {
  theme: {
    background: '#12161C',
    card: '#1B2129',
    border: '#2C3540',
    text: '#FFFFFF',
    dim: '#B6BFCB',
    accent: '#FFD23F',
    accentInk: '#FFD23F',
    onAccent: '#12161C',
    good: '#7BE0A4',
    bad: '#FF6B5E',
    badInk: '#FF8A7F',
    pill: '#FFFFFF',
    pillText: '#12161C',
    ar: FAMILY.cairo,
    display: FAMILY.cairo,
    mono: FAMILY.plexMono,
  },
  layout: { kind: 'adapted', seam: 1056, caption: 1320, title: 142, body: 208, titleTop: 42 },
  galleryCut: 'none',
} satisfies StyleThemeModule;
