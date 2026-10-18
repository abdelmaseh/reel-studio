import {EDITION_STYLE_IDS} from '../creative-kit/styles.ts';
import {defaultCaptionsFor, defaultFontFor, styleLabels} from '../styles/registry.ts';
import {CAPTION_PRESENTATION, DIGIT_CHOICES, FONT_CHOICES} from '../styles/types.ts';
import type {Character} from '../styles/cartoon/scenes/character.ts';

export {CAPTION_PRESENTATION, DIGIT_CHOICES, FONT_CHOICES};
export type {CaptionPresentation, DigitChoice, PreferredFont} from '../styles/types.ts';
export const CAPTION_GROUPING = ['compact', 'clauses', 'single'] as const;
export type CaptionGrouping = (typeof CAPTION_GROUPING)[number];
export const WRITING_STYLES = ['short', 'educational', 'storytelling'] as const;
export type WritingStyle = (typeof WRITING_STYLES)[number];
export const PREFERENCE_VALUES = {
  style: EDITION_STYLE_IDS,
  captionsGrouping: CAPTION_GROUPING,
  captionsPresentation: CAPTION_PRESENTATION,
  font: FONT_CHOICES,
  writingStyle: WRITING_STYLES,
  palette: ['brand'] as const,
  // Optional in every saved file: a missing key and {mode: 'auto'} both mean "as it is today".
  digits: DIGIT_CHOICES,
} as const;
type PreferenceKey = keyof typeof PREFERENCE_VALUES;
type PreferenceOf<K extends PreferenceKey> =
  {mode: 'auto'; value: null} | {mode: 'fixed'; value: (typeof PREFERENCE_VALUES)[K][number]};
export type Preferences = {[K in Exclude<PreferenceKey, 'digits'>]: PreferenceOf<K>} & {digits?: PreferenceOf<'digits'>; character?: {mode: 'auto'; value: null} | {mode: 'fixed'; value: Character}};

/** The Arabic text of the three digit states. The settings screen and the editor both read this one map. */
export const DIGIT_LABELS_AR = Object.freeze({auto: 'كما هو', latin: '1 2 3', 'arabic-indic': '١ ٢ ٣'} as const);

export function defaultPreferences({legacy = false} = {}): Preferences {
  return {
    style: {mode: 'auto', value: null}, captionsGrouping: {mode: 'auto', value: null},
    captionsPresentation: {mode: 'auto', value: null}, font: {mode: 'auto', value: null},
    writingStyle: {mode: 'auto', value: null}, palette: legacy ? {mode: 'fixed', value: 'brand'} : {mode: 'auto', value: null},
  };
}

export const STYLE_LABELS: Record<string, {label: string; description: string}> = styleLabels();
export const WRITING_GUIDES: Record<WritingStyle, string> = {
  short: 'اكتب وصف منشور مختصر: جملة افتتاحية واضحة، فايدة واحدة، وطلب واحد مناسب. من غير حشو.',
  educational: 'اكتب وصف بنقط عملية قصيرة تخلّي الناس عايزة الشرح الكامل في الفيديو: افتتاحية، نقطتين أو تلاتة، وطلب مناسب. من غير ما تشرح الفيديو ولا تضيف معلومة مش فيه.',
  storytelling: 'اكتب وصف بحكاية قصيرة: موقف أو مشكلة بكلام جديد يقود للفيديو، من غير ما تحكي خطواته أو تكشف خلاصته. حافظ على الحقائق اللي في الفيديو.',
};


export function resolvePreferences(preferences: Preferences, {purpose, tone, style}: {purpose: string; tone: string; style: string}) {
  const fixed = <K extends keyof Preferences>(key: K) => {
    // A brief written by 2.5 has exactly six keys, so a missing key is "automatic", never an error.
    const preference = preferences[key];
    return preference?.mode === 'fixed' ? preference.value : null;
  };
  const digits = fixed('digits');
  const clauses = ['explainer', 'tutorial'].includes(purpose) && tone !== 'energetic';
  const writing: WritingStyle = purpose === 'story' ? 'storytelling' : ['explainer', 'tutorial'].includes(purpose) ? 'educational' : 'short';
  return {
    captionsGrouping: fixed('captionsGrouping') ?? (clauses ? 'clauses' : 'compact'),
    captionsPresentation: fixed('captionsPresentation') ?? defaultCaptionsFor(style),
    fontFamily: fixed('font') ?? defaultFontFor(style), writingStyle: fixed('writingStyle') ?? writing,
    // Only a fixed choice is returned: an absent key leaves every output exactly as it was.
    ...(digits === null ? {} : {digits}),
  };
}
