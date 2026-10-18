import {isArabic} from '../core/type.ts';

// Fixed card labels. A card whose own copy is Arabic shows the Arabic label; other cards keep the English one.
export const CARD_LABELS = Object.freeze({
  idea: {en: 'THE IDEA', ar: 'الفكرة'},
  value: {en: 'SUPPLIED VALUE', ar: 'بالأرقام'},
  proof: {en: 'THE PROOF', ar: 'الدليل'},
  how: {en: 'HOW IT WORKS', ar: 'طريقة العمل'},
  beforeAfter: {en: 'BEFORE / AFTER', ar: 'قبل / بعد'},
  board: {en: 'THE COMPARISON BOARD', ar: 'لوحة المقارنة'},
  sideBySide: {en: 'SIDE BY SIDE', ar: 'جنبًا إلى جنب'},
  comment: {en: 'ADD A COMMENT', ar: 'اكتب تعليقك'},
  template: {en: 'WANT THE TEMPLATE?', ar: 'احصل على القالب'},
  templateLine: {en: 'Leave the keyword below.', ar: 'اكتب الكلمة في التعليقات'},
  follow: {en: 'FOLLOW FOR MORE', ar: 'تابعني للمزيد'},
  followLine: {en: 'Keep the ideas coming.', ar: 'أفكار جديدة باستمرار'},
  followButton: {en: '+ Follow', ar: '+ متابعة'},
  following: {en: 'Following', ar: 'تمت المتابعة'},
  followPill: {en: 'Follow', ar: 'متابعة'},
  source: {en: 'SOURCE CAPTURE', ar: 'لقطة من المصدر'},
  missing: {en: 'MISSING', ar: 'ناقص'},
  chapter: {en: 'CHAPTER', ar: 'الفصل'},
} as const);

export type CardLabelKey = keyof typeof CARD_LABELS;

// Strings under these keys are never shown as copy: file references (every key a card or concept schema uses for an asset
// path), hashes, ids and option values.
const NOT_COPY = new Set(['src', 'path', 'file', 'image', 'icon', 'logo', 'poster', 'productIcon', 'visualSrc', 'sha256', 'url', 'href', 'id', 'kind',
  'variant', 'fit', 'display', 'dir', 'lang', 'enter', 'layout', 'motion', 'family', 'mode', 'color', 'accent', 'role', 'concept', 'preset']);
const copyStrings = (value: unknown, key = ''): string[] =>
  NOT_COPY.has(key) ? []
    : typeof value === 'string' ? [value]
      : Array.isArray(value) ? value.flatMap((item) => copyStrings(item, key))
        : value && typeof value === 'object' ? Object.entries(value).flatMap(([name, item]) => copyStrings(item, name)) : [];

/** True when the card's visible copy is Arabic. An explicit `lang` decides first; file names and option values never do. */
export const arabicCopy = (data: unknown): boolean => {
  const lang = data && typeof data === 'object' && !Array.isArray(data) ? (data as {lang?: unknown}).lang : undefined;
  if (lang === 'ar' || lang === 'en') return lang === 'ar';
  return copyStrings(data).some((text) => isArabic(text));
};

export const cardLabel = (key: CardLabelKey, data: unknown): string => CARD_LABELS[key][arabicCopy(data) ? 'ar' : 'en'];
