// Node-safe: no packages, no JSX, explicit .ts imports only.
export type Direction = 'rtl' | 'ltr';

/** The animated words of an authored phrase: whitespace-separated tokens. */
export const glideWords = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);

// The Arabic script as escaped ranges only (no literal Arabic letters and no U+FEFF in this file): Arabic, Arabic
// Supplement, Arabic Extended-A, and the presentation forms up to U+FEFC (U+FEFF is a byte-order mark, not a letter).
const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFC]/;
// An Arabic-script letter: a letter inside the ranges above. Digits (Arabic-Indic included), punctuation, marks, spaces
// and format characters are neutral and never make a text right-to-left.
const ARABIC_LETTER = new RegExp(`(?=\\p{L})${ARABIC_SCRIPT.source}`, 'u');

/**
 * Reading direction of one authored text: right-to-left when the text contains any Arabic letter, otherwise
 * left-to-right. An Arabic line often opens or ends with a Latin tool name; it is still an Arabic line, and the kit keeps
 * each run of Latin words in its own left-to-right group inside it. A text without an Arabic letter (Latin, digits,
 * punctuation or empty) reads left-to-right.
 */
export const textDirection = (text: string): Direction => ARABIC_LETTER.test(text) ? 'rtl' : 'ltr';
