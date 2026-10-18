// Shared vocabulary of the per-style structure.
//
// Node-safe: this file and every engine/src/styles/<id>/meta.ts load in plain Node with type
// stripping, before `npm ci` (studio setup imports them through preference-options.ts).
// Keep explicit `.ts` import extensions, no JSX and no packages here.

export const FONT_CHOICES = ['Cairo', 'Tajawal', 'Noto Naskh Arabic', 'Plex Display', 'Grid Sans', 'Noto Kufi Arabic', 'Readex Pro', 'El Messiri'] as const;
export type PreferredFont = (typeof FONT_CHOICES)[number];

// How digits are drawn on screen. A missing preference is the third state, "as it is today", and is not listed here.
export const DIGIT_CHOICES = ['latin', 'arabic-indic'] as const;
export type DigitChoice = (typeof DIGIT_CHOICES)[number];

export const CAPTION_PRESENTATION = ['pill', 'minimal', 'ink-strip'] as const;
export type CaptionPresentation = (typeof CAPTION_PRESENTATION)[number];

export const STYLE_USE_CASES = ['explainer', 'case-study', 'tutorial', 'comparison', 'opinion', 'story'] as const;
export type StyleUseCase = (typeof STYLE_USE_CASES)[number];
export type EditorPurpose = StyleUseCase;

export const EDITOR_TONES = ['energetic', 'calm', 'editorial'] as const;
export type EditorTone = (typeof EDITOR_TONES)[number];

export type StyleGrammar = {
  typography: 'product-sans' | 'heavy-poster' | 'naskh-receipt' | 'mixed-paper' | 'serif-verdict' | 'serif-editorial';
  card: 'rounded-ui' | 'ink-frame' | 'receipt-sheet' | 'taped-paper' | 'verdict-board' | 'offset-plate' | 'glass-panel' | 'perforated-ticket' | 'magazine-rule' | 'route-paper' | 'bevel-slab';
  annotation: 'accent-rule' | 'terminal-period' | 'signal-strip' | 'brush-rule' | 'tape-tabs' | 'verdict-divider' | 'yellow-marker' | 'lens-rim' | 'ticket-stub' | 'chapter-rule' | 'route-marker' | 'inverted-box';
  composition: 'split-panel' | 'section-stack' | 'poster-lockup' | 'claim-receipt' | 'collage-stack' | 'two-column-board' | 'editorial-spread' | 'aurora-lens' | 'ticket-stack' | 'magazine-column' | 'route-map' | 'flat-canvas';
  caption: 'pill' | 'ink-strip' | 'boxless' | 'paper-label';
  motion: 'land' | 'stagger' | 'quiet';
};

export type PipPolicy = { allowed: boolean; basis: 'observed' | 'inference'; evidence: string };

export type MixProfile = { slug: string; lraMax: number; source: string; section: string };

export type StyleMeta = {
  id: string;
  label: { ar: string; en: string };
  description: { ar: string; en: string };
  useCases: readonly StyleUseCase[];
  grammar: StyleGrammar;
  legacy: boolean;
  brand: boolean;
  pip: PipPolicy;
  defaults: { font: PreferredFont; captionsPresentation: CaptionPresentation; clauseCaptions: boolean; staticCaptions: boolean };
  fit: { purpose: Partial<Record<EditorPurpose, number>>; tone: Partial<Record<EditorTone, number>>; semanticBeats: readonly string[] };
  ownScenes: readonly string[];
  mix?: MixProfile;
  since: string;
};

export const defineStyle = <const T extends StyleMeta>(meta: T): Readonly<T> => Object.freeze(meta);
