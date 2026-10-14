import type {SceneTheme} from '../styles/theme-types.ts';

// Material of the `bevel-slab` card grammar: a light slab with a stacked 1 px bevel, a two-layer drop shadow
// that falls to the right and bottom only, and an inset screen. Pure data.
export const SLAB = {
  radius: 24,
  inset: 9,
  innerRadius: 15,
  screen: '#FFFFFF',
  shadow: '15px 15px 27px -3px rgba(0,0,0,.255), 48px 48px 45px 7px rgba(0,0,0,.163)',
  // Small surfaces (message cards) use a lighter single shadow.
  softShadow: '9px 9px 18px -3px rgba(0,0,0,.22)',
  bevel: 'inset 0 1px 0 0 #fefefe, inset 0 2px 0 0 #ffffff, inset 0 3px 0 0 #fefefe, inset 0 4px 0 0 #fefefe, inset 0 5px 0 0 #f8f8f8, inset 0 6px 0 0 #e4e4e4, inset 0 7px 0 0 #e2e2e2, inset 0 8px 0 0 #e7e7e7, inset 1px 0 0 0 #ffffff, inset 2px 0 0 0 #ffffff, inset 3px 0 0 0 #ffffff, inset 4px 0 0 0 #fefefe, inset 5px 0 0 0 #efefef, inset 6px 0 0 0 #e4e4e4, inset 7px 0 0 0 #e7e7e7, inset 8px 0 0 0 #e8e8e8, inset 0 -1px 0 0 #8d8d8d, inset 0 -2px 0 0 #8e8e8e, inset 0 -3px 0 0 #9b9b9b, inset 0 -4px 0 0 #afafaf, inset 0 -5px 0 0 #cecece, inset 0 -6px 0 0 #e8e8e8, inset 0 -7px 0 0 #e7e7e7, inset 0 -8px 0 0 #e4e4e4, inset 0 -9px 0 0 #eaeaea, inset -1px 0 0 0 #5c5c5c, inset -2px 0 0 0 #575757, inset -3px 0 0 0 #666666, inset -4px 0 0 0 #7b7b7b, inset -5px 0 0 0 #949494, inset -6px 0 0 0 #d4d4d4, inset -7px 0 0 0 #e8e8e8, inset -8px 0 0 0 #e4e4e4, inset -9px 0 0 0 #e9e9e9',
} as const;

/** Cards whose small details use the soft, rounded variant: rounded UI cards, styles without a grammar, and the bevel slab. */
export const isRoundCard = (theme: Pick<SceneTheme, 'grammar'>): boolean =>
  !theme.grammar || theme.grammar.card === 'rounded-ui' || theme.grammar.card === 'bevel-slab';
