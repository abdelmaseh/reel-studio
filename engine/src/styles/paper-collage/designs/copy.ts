import {SHARED_STYLE_WORDS} from '../../../creative-kit/labels';
// Words used only by the approved collage drawings.
export const COPY = {
  step: {ar: 'خطوة', en: 'step'}, clear: {ar: 'واضحة', en: 'clear'}, missingKey: {ar: 'ناقصة', en: 'missing'},
  different: {ar: 'مختلف', en: 'different'}, one: {ar: 'واحدة', en: 'one'},
  commentPrompt: SHARED_STYLE_WORDS.commentPrompt,
  comments: {ar: 'التعليقات', en: 'comments'}, comment: SHARED_STYLE_WORDS.commentWord,
  missing: SHARED_STYLE_WORDS.missingTitle, follow: SHARED_STYLE_WORDS.followWord, followed: SHARED_STYLE_WORDS.followingWord,
} as const;
export const styleCopy = (ar: boolean) => (key: keyof typeof COPY) => COPY[key][ar ? 'ar' : 'en'];
