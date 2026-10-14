import { FAMILY } from '../../core/fonts';
import type { StyleThemeModule } from '../theme-types.ts';

export default {
  theme: {
    background: '#F2F2F2',
    card: '#F9F9F7',
    border: '#8A8A8A',
    text: '#242424',
    dim: '#5A5A5A',
    accent: '#CCCCCC',
    accentInk: '#262626',
    onAccent: '#242424',
    good: '#333333',
    bad: '#8E8E8E',
    badInk: '#505050',
    pill: '#E5E5E5',
    pillText: '#191919',
    ar: FAMILY.gridSans,
    display: FAMILY.gridSans,
    mono: FAMILY.plexMono,
  },
  layout: { kind: 'adapted', seam: 1080, caption: 1300, title: 142, body: 212, titleTop: 40 },
  galleryCut: 'none',
} satisfies StyleThemeModule;
