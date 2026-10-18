import { FAMILY } from '../../core/fonts';
import type { StyleThemeModule } from '../theme-types.ts';

export default {
  theme: {
    background: '#F3EEE3',
    card: '#FFFFFF',
    border: '#DAD5C9',
    text: '#0E1117',
    dim: '#5A6172',
    accent: '#C8FF4A',
    accentInk: '#0E1117',
    onAccent: '#0E1117',
    good: '#0E1117',
    bad: '#B4283C',
    badInk: '#8F1F30',
    pill: '#0E1117',
    pillText: '#FFFFFF',
    ar: FAMILY.cairo,
    display: FAMILY.kufi,
    mono: FAMILY.readex,
  },
  layout: { kind: 'adapted', seam: 1080, caption: 1300, title: 142, body: 212, titleTop: 40 },
  galleryCut: 'none',
} satisfies StyleThemeModule;
