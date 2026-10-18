// Display-time digit mapping for on-screen text. Pure and Node-safe: no packages, no JSX, explicit .ts imports only.
//
// The reviewed words, the manifest text and the files on disk never change. Only the glyphs shown on screen are mapped,
// so mapping twice gives the same text (idempotent) and a missing preference (null) returns the very same string.
import type {DigitChoice} from '../styles/types.ts';

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DECIMAL = '٫'; // Arabic decimal separator
const ARABIC_THOUSANDS = '٬'; // Arabic thousands separator
const ARABIC_PERCENT = '٪'; // Arabic percent sign
const LATIN_DIGIT = /[0-9]/g;
const NON_LATIN_DIGIT = /[٠-٩۰-۹]/g;
// A separator or a percent sign next to a digit of either kind belongs to the number, so a mixed run such as "12,500٪"
// or "٥٠%" maps as one number.
const DIGIT_CLASS = '[0-9٠-٩۰-۹]';
const LATIN_DECIMAL = new RegExp(`(?<=${DIGIT_CLASS})[.](?=${DIGIT_CLASS})`, 'g');
const LATIN_THOUSANDS = new RegExp(`(?<=${DIGIT_CLASS})[,](?=${DIGIT_CLASS})`, 'g');
const LATIN_PERCENT = new RegExp(`(?<=${DIGIT_CLASS})[%]`, 'g');
const ARABIC_DECIMAL_BETWEEN = new RegExp(`(?<=${DIGIT_CLASS})${ARABIC_DECIMAL}(?=${DIGIT_CLASS})`, 'g');
const ARABIC_THOUSANDS_BETWEEN = new RegExp(`(?<=${DIGIT_CLASS})${ARABIC_THOUSANDS}(?=${DIGIT_CLASS})`, 'g');
const ARABIC_PERCENT_AFTER = new RegExp(`(?<=${DIGIT_CLASS})${ARABIC_PERCENT}`, 'g');
const PERCENT_SIGN = /%/g;
const ARABIC_PERCENT_SIGN = new RegExp(ARABIC_PERCENT, 'g');

// An Arabic-script letter: a letter inside the Arabic blocks. Digits, punctuation and marks are not letters, so the
// Arabic-Indic digits U+0660-0669 and the Persian digits U+06F0-06F9 never count (core/type.ts counts them).
export const ARABIC_LETTER = /(?=\p{L})[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFC]/u;
export const LATIN_LETTER = /[A-Za-z]/;

export type DigitMapOptions = {
  /** Strings that stay exactly as authored, for example the comment keyword. */
  keep?: readonly string[];
};

/** Latin digits become Arabic-Indic; `.` and `,` between digits become the Arabic decimal and thousands separators (U+066B, U+066C); `%` after a digit becomes the Arabic percent sign (U+066A). */
export function toArabicIndic(text: string): string {
  return text
    .replace(LATIN_DECIMAL, ARABIC_DECIMAL)
    .replace(LATIN_THOUSANDS, ARABIC_THOUSANDS)
    .replace(LATIN_PERCENT, ARABIC_PERCENT)
    .replace(LATIN_DIGIT, (digit) => ARABIC_INDIC[Number(digit)]);
}

/** Arabic-Indic and Persian digits become Latin; the Arabic decimal and thousands separators between digits become `.` and `,`; the Arabic percent sign after a digit becomes `%`. */
export function toLatinDigits(text: string): string {
  return text
    .replace(ARABIC_DECIMAL_BETWEEN, '.')
    .replace(ARABIC_THOUSANDS_BETWEEN, ',')
    .replace(ARABIC_PERCENT_AFTER, '%')
    .replace(NON_LATIN_DIGIT, (glyph) => {
      const index = ARABIC_INDIC.indexOf(glyph);
      return String(index >= 0 ? index : PERSIAN.indexOf(glyph));
    });
}

/**
 * Whether a line of text takes part in digit mapping. A line with Latin letters and no Arabic letter ("Top 10 tools")
 * is an English line: its digits stay as written.
 */
export function mapsDigits(text: string): boolean {
  return !(LATIN_LETTER.test(text) && !ARABIC_LETTER.test(text));
}

const hasDigit = (token: string): boolean => /[0-9٠-٩۰-۹]/.test(token);

// A token is left alone when it is a handle, a hashtag, a link, or mixes Latin letters with digits (GPT4, 4K, mp4).
function skipToken(token: string): boolean {
  if (token === '' || /^\s+$/.test(token)) return true;
  if (/^[@#]/.test(token)) return true;
  if (token.includes('://') || /www\./i.test(token)) return true;
  return LATIN_LETTER.test(token) && hasDigit(token);
}

const DIGIT = new RegExp(DIGIT_CLASS);
const NUMBER_SEPARATOR = /[.,٫٬]/;

// The character beside a keep string (`next`, then `beyond` it) continues a number when it is a digit, or a separator with a digit
// after it and a digit at the keep string's own edge: `100` is part of `1,100`, but the `.` in `1.خطة30` only ends a list number.
const continuesNumber = (next: string | undefined, beyond: string | undefined, edge: string): boolean =>
  next !== undefined && (DIGIT.test(next) || (DIGIT.test(edge) && NUMBER_SEPARATOR.test(next) && beyond !== undefined && DIGIT.test(beyond)));

// A keep string matches only as a whole token, never inside a number: `100` is not found in `1000`, `12026` or `1,100`.
const onBoundary = (text: string, start: number, needle: string): boolean => {
  const end = start + needle.length;
  return !continuesNumber(text[start - 1], text[start - 2], needle[0]) && !continuesNumber(text[end], text[end + 1], needle[needle.length - 1]);
};

function splitKeep(text: string, keep: readonly string[]): {text: string; kept: boolean}[] {
  const needles = [...new Set(keep.filter((item) => item.length > 0))].sort((a, b) => b.length - a.length);
  if (needles.length === 0) return [{text, kept: false}];
  const parts: {text: string; kept: boolean}[] = [];
  let cursor = 0;
  let free = 0;
  while (cursor < text.length) {
    const hit = needles.find((needle) => text.startsWith(needle, cursor) && onBoundary(text, cursor, needle));
    if (hit === undefined) { cursor += 1; continue; }
    if (cursor > free) parts.push({text: text.slice(free, cursor), kept: false});
    parts.push({text: hit, kept: true});
    cursor += hit.length;
    free = cursor;
  }
  if (free < text.length) parts.push({text: text.slice(free), kept: false});
  return parts;
}

/** Maps the digits of every token of `text`, skipping handles, hashtags, links, Latin+digit tokens and `keep` strings. */
export function mapDigitTokens(text: string, set: DigitChoice, options: DigitMapOptions = {}): string {
  const convert = set === 'arabic-indic' ? toArabicIndic : toLatinDigits;
  return splitKeep(text, options.keep ?? []).map((part) => part.kept ? part.text
    : part.text.split(/(\s+)/).map((token) => skipToken(token) ? token : convert(token)).join('')).join('');
}

/** The text as shown on screen: a null or missing set returns `text` unchanged. Idempotent. */
export function displayDigits(text: string, set: DigitChoice | null | undefined, options: DigitMapOptions = {}): string {
  if (set !== 'latin' && set !== 'arabic-indic') return text;
  return mapsDigits(text) ? mapDigitTokens(text, set, options) : text;
}

/** Several pieces of one line (for example the words of a caption cue): the whole line decides, then each piece maps. */
export function displayDigitList(texts: readonly string[], set: DigitChoice | null | undefined, options: DigitMapOptions = {}): string[] {
  if (set !== 'latin' && set !== 'arabic-indic') return [...texts];
  if (!mapsDigits(texts.join(' '))) return [...texts];
  return texts.map((text) => mapDigitTokens(text, set, options));
}

/** A number suffix such as `%` in the chosen digit set. A null set returns it unchanged. */
export function localizeSuffix(suffix: string, set: DigitChoice | null | undefined): string {
  if (set !== 'latin' && set !== 'arabic-indic') return suffix;
  const percent = set === 'arabic-indic' ? suffix.replace(PERCENT_SIGN, ARABIC_PERCENT) : suffix.replace(ARABIC_PERCENT_SIGN, '%');
  return mapDigitTokens(percent, set);
}
