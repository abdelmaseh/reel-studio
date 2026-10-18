import assert from 'node:assert/strict';

// Egyptian-dialect markers that must not appear in White Arabic text (whole words, diacritics ignored).
export const DIALECT = ['ده', 'دي', 'دا', 'دول', 'إزاي', 'ازاي', 'عايز', 'عاوز', 'عشان', 'كده', 'كدا', 'اللي', 'مش', 'قول', 'بتاع', 'بتاعك', 'دلوقتي', 'دلوقت', 'إيه', 'ايه', 'ليه', 'فين', 'أوي', 'خليه', 'خلي', 'هتلاقي'];
const strip = (text) => text.replace(/[ً-ْٰـ]/g, '');

/** The dialect markers found in `text`, as whole words, ignoring diacritics. */
export const dialectIn = (text) => {
  const clean = strip(text);
  return DIALECT.filter((word) => new RegExp(`(?<![\\u0621-\\u064A])${word}(?![\\u0621-\\u064A])`).test(clean));
};

/** Fails with `label` when `text` contains an Egyptian-dialect marker. */
export const assertNoDialect = (text, label) => assert.deepEqual(dialectIn(text), [], label);
