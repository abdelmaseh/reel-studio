import { FAMILY } from '../../core/fonts';
import type { StyleThemeModule } from '../theme-types.ts';

// The light act. Shared families drawn in this style use these tokens; the cartoon scenes read the per-act
// palettes in scenes/math.ts instead (the dark act cannot be a chapter palette: lime fails ink/accent).
export default {
  theme: {
    background: '#EEEBE4',
    card: '#FFFFFF',
    border: '#D9D5CC',
    text: '#141414',
    dim: '#555552',
    accent: '#E8472B',
    accentInk: '#BF3D27',
    onAccent: '#141414',
    good: '#141414',
    bad: '#B4283C',
    badInk: '#8F1F30',
    pill: '#141414',
    pillText: '#FFFFFF',
    ar: FAMILY.plexDisplay,
    display: FAMILY.plexDisplay,
    mono: FAMILY.plexMono,
  },
  layout: { kind: 'adapted', seam: 1080, caption: 1300, title: 142, body: 212, titleTop: 40 },
  galleryCut: 'none',
} satisfies StyleThemeModule;
