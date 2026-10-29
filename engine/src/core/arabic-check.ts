// The Arabic correctness rules, shared by the delivery gates (scripts/lib/arabic-check.mjs) and the review editor (review-editor/validate.ts).
//
// Pure and Node-safe: no packages, no JSX, explicit .ts imports. The one thing it cannot know is which glyphs a font file draws; the caller
// passes that in as `coverage` (Node reads it from the real WOFF2 files, the editor passes nothing and so never reports a missing glyph).
//
// Two levels, by the owner's decision. `fail` blocks delivery: the text would draw broken (joins cut, characters the font lacks).
// `needs-review` needs eyes on the preview and never blocks on its own.
import {ARABIC_LETTER, LATIN_LETTER, displayDigits} from './digits.ts';
import {defaultFontFor} from '../styles/registry.ts';
import type {DigitChoice} from '../styles/types.ts';

export type ArabicLevel = 'fail' | 'needs-review';

export const ARABIC_CHECK_CODES = Object.freeze({
  'missing-glyph': 'fail',
  'split-word-markup': 'fail',
  'zwnj-in-word': 'fail',
  'presentation-forms': 'fail',
  'tatweel-edge': 'fail',
  'per-letter-transform': 'fail',
  'mixed-direction': 'needs-review',
  'stacked-harakat': 'needs-review',
  'digit-style': 'needs-review',
  'long-line': 'needs-review',
} as const satisfies Record<string, ArabicLevel>);
export type ArabicCode = keyof typeof ARABIC_CHECK_CODES;

/** One problem in one string. `text` is the string it was found in; `detail` is the English explanation. */
export type ArabicFinding = { level: ArabicLevel; code: ArabicCode; text: string; detail: string };
export type LocatedFinding = ArabicFinding & { where: string; path: (string | number)[] };

/** A line longer than this many characters, or an unbroken run longer than the second number, is worth a look. */
export const LONG_LINE_CHARS = 90;
export const LONG_TOKEN_CHARS = 24;

export type StringOptions = {
  /** The digits choice: a missing value is the Western default. */
  digits?: DigitChoice | null;
  /** Code points the font of this string draws; omitted means the glyph check is not run. */
  coverage?: ReadonlySet<number> | null;
  longLine?: number;
  longToken?: number;
};

const TATWEEL = '\u0640';
const ZWNJ = '\u200C';
const MARK = /^\p{M}$/u;
const HARAKAT = /^[\u064B-\u0652\u0670]$/;
const TAG = /<\/?[A-Za-z][^<>]*>/g;
const HAS_TAG = /<\/?[A-Za-z][^<>]*>/;
const INDIC = /[٠-٩]/;
const PERSIAN = /[۰-۹]/;
const SIGNED_NUMBER = /(?<![0-9٠-٩۰-۹\p{L}])[+\-−–]\s?[0-9٠-٩۰-۹]/u;
// Elements that start a new block or line: a word does not continue across them, so a boundary of this kind is never a split word.
const BLOCK_TAGS: ReadonlySet<string> = new Set(['div', 'p', 'li', 'ul', 'ol', 'dl', 'dt', 'dd', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside', 'blockquote', 'pre', 'figure', 'figcaption',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'form', 'fieldset', 'br', 'hr', 'img', 'svg', 'canvas', 'video', 'button', 'input']);
const URLISH = /^(?:https?:\/\/|www\.)|:\/\/|^[#@]|@[\w.-]+\.[a-z]{2,}$/i;

// Arabic letters that join to the letter before them but never to the one after (right-joining), and the ones that join neither way.
const RIGHT_JOINING: ReadonlyArray<readonly [number, number]> = [
  [0x622, 0x625], [0x627, 0x627], [0x629, 0x629], [0x62f, 0x632], [0x648, 0x648], [0x671, 0x673], [0x675, 0x677], [0x688, 0x699],
  [0x6c0, 0x6c0], [0x6c3, 0x6cb], [0x6cd, 0x6cd], [0x6cf, 0x6cf], [0x6d2, 0x6d3], [0x6d5, 0x6d5], [0x6ee, 0x6ef],
];
const NON_JOINING: ReadonlyArray<readonly [number, number]> = [[0x621, 0x621], [0x674, 0x674]];
const inRanges = (ranges: ReadonlyArray<readonly [number, number]>, code: number): boolean => ranges.some(([from, to]) => code >= from && code <= to);
const isArabicLetter = (ch: string): boolean => ARABIC_LETTER.test(ch);
const hasArabicLetter = (text: string): boolean => Array.from(text).some(isArabicLetter);
const joinsForward = (ch: string): boolean => isArabicLetter(ch) && !inRanges(RIGHT_JOINING, ch.codePointAt(0)!) && !inRanges(NON_JOINING, ch.codePointAt(0)!);
const joinsBackward = (ch: string): boolean => isArabicLetter(ch) && !inRanges(NON_JOINING, ch.codePointAt(0)!);
const hex = (ch: string): string => `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;
const unique = <T,>(items: T[]): T[] => [...new Set(items)];

// Arabic Presentation Forms-A and -B hold shaped glyph variants, which a font run must not receive as text. The ranges stop before the
// honorific ligatures and signs (U+FDF0-U+FDFF), and the ornate parentheses (U+FD3E, U+FD3F) are left out: those are single symbols people do write.
const isPresentationForm = (code: number): boolean =>
  ((code >= 0xfb50 && code <= 0xfdcf) || (code >= 0xfe70 && code <= 0xfefc)) && code !== 0xfd3e && code !== 0xfd3f;

// Never drawn as a glyph of their own: every space, control, joiner and bidi control, the variation selectors and the byte-order mark.
const isInvisible = (ch: string): boolean => {
  const code = ch.codePointAt(0)!;
  return code <= 0x20 || /^[\p{Z}\p{Cc}]$/u.test(ch) || code === 0xad || code === 0x034f || code === 0x061c || (code >= 0x200b && code <= 0x200f)
    || (code >= 0x202a && code <= 0x202e) || (code >= 0x2060 && code <= 0x206f) || (code >= 0xfe00 && code <= 0xfe0f) || code === 0xfeff;
};
const isPictograph = (ch: string): boolean => /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Regional_Indicator}\p{Emoji_Modifier}\u20E3]$/u.test(ch);

function presentationFindings(chars: string[]): string | null {
  const hits = unique(chars.filter((ch) => isPresentationForm(ch.codePointAt(0)!)));
  if (!hits.length) return null;
  return `Presentation-form characters ${hits.map((ch) => `${hex(ch)} ${ch}`).join(', ')} are shaped glyph variants; write the plain letters (${unique(hits.map((ch) => ch.normalize('NFKC'))).join(' ')}) and let the studio join them.`;
}

function tatweelEdges(text: string): string[] {
  const out: string[] = [];
  for (const token of text.split(/\s+/)) {
    if (!token) continue;
    const core = token.replace(/^[^\p{L}\p{M}\u0640]+|[^\p{L}\p{M}\u0640]+$/gu, '');
    if (!core || !hasArabicLetter(core) || /^\u0640+$/.test(core)) continue;
    const starts = core.startsWith(TATWEEL);
    const ends = core.replace(/\p{M}+$/u, '').endsWith(TATWEEL);
    if (starts || ends) out.push(`${token} (${starts ? 'starts' : 'ends'} with a tatweel)`);
  }
  return out;
}

function zwnjInside(chars: string[]): boolean {
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== ZWNJ) continue;
    let before = i - 1;
    while (before >= 0 && MARK.test(chars[before])) before--;
    let after = i + 1;
    while (after < chars.length && MARK.test(chars[after])) after++;
    if (before >= 0 && after < chars.length && isArabicLetter(chars[before]) && isArabicLetter(chars[after])) return true;
  }
  return false;
}

function stackedHarakat(text: string): string[] {
  const chars = Array.from(text.normalize('NFC'));
  const out: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (MARK.test(chars[i])) continue;
    const marks: string[] = [];
    let next = i + 1;
    while (next < chars.length && MARK.test(chars[next])) marks.push(chars[next++]);
    const harakat = marks.filter((mark) => HARAKAT.test(mark));
    if (harakat.length < 2) continue;
    const twice = unique(harakat).length < harakat.length;
    out.push(`${chars[i]}${marks.join('')} carries ${harakat.length} harakat (${harakat.map(hex).join(' ')})${twice ? ', one of them doubled' : ''}`);
  }
  return out;
}

function mixedDirection(raw: string): string | null {
  const text = raw.replace(/\{keyword\}/g, ' ');
  if (!hasArabicLetter(text)) return null;
  const latin = unique(text.match(/[A-Za-z][A-Za-z0-9'’._+#-]*/g) ?? []);
  const signed = SIGNED_NUMBER.test(text);
  if (!latin.length && !signed) return null;
  return [latin.length ? `Latin text (${latin.slice(0, 4).join(', ')}) inside an Arabic line` : '', signed ? 'a signed number (+3, -5) that the bidi rules can flip' : ''].filter(Boolean).join('; ')
    + '. Check the order and the punctuation on the preview.';
}

function digitStyle(text: string, digits: DigitChoice | null | undefined): string | null {
  if (digits !== 'arabic-indic' && (INDIC.test(text) || PERSIAN.test(text))) {
    return `Arabic-Indic or Persian digits (${unique(text.match(/[٠-٩۰-۹]+/g) ?? []).slice(0, 3).join(' ')}) while the digits choice is ${digits === 'latin' ? 'Western (latin)' : 'unset, which draws Western digits'}.`;
  }
  if (digits === 'arabic-indic' && PERSIAN.test(text)) {
    return `Persian digits (${unique(text.match(/[۰-۹]+/g) ?? []).slice(0, 3).join(' ')}) while the digits choice is Arabic-Indic; the two sets differ in 4, 5 and 6.`;
  }
  return null;
}

function longRuns(text: string, limits: { line: number; token: number }): string | null {
  const lines = text.split(/\r?\n/).filter((line) => Array.from(line).length > limits.line);
  const tokens = text.split(/\s+/).filter((token) => Array.from(token).length > limits.token && !URLISH.test(token));
  if (!lines.length && !tokens.length) return null;
  return [lines.length ? `a line of ${Array.from(lines[0]).length} characters (over ${limits.line})` : '', tokens.length ? `an unbroken run of ${Array.from(tokens[0]).length} characters (over ${limits.token})` : ''].filter(Boolean).join('; ')
    + '. Check it fits the safe width at the chosen size.';
}

function missingGlyphs(text: string, coverage: ReadonlySet<number>): { fail: string[]; review: string[] } {
  const fail: string[] = [], review: string[] = [];
  for (const ch of unique(Array.from(text))) {
    const code = ch.codePointAt(0)!;
    if (isInvisible(ch) || coverage.has(code)) continue;
    // A precomposed letter the font lacks still draws when the shaper can build it from base and mark.
    const parts = Array.from(ch.normalize('NFD'));
    if (parts.length > 1 && parts.every((part) => coverage.has(part.codePointAt(0)!) || isInvisible(part))) continue;
    (isPictograph(ch) || /^\p{S}$/u.test(ch) ? review : fail).push(ch);
  }
  return { fail, review };
}

/** The rules that read one visible string. The string may hold markup; the markup rules are `checkArabicMarkup`. */
export function checkArabicString(text: string, options: StringOptions = {}): ArabicFinding[] {
  const out: ArabicFinding[] = [];
  if (typeof text !== 'string' || !text) return out;
  const add = (code: ArabicCode, detail: string, level: ArabicLevel = ARABIC_CHECK_CODES[code]) => out.push({ level, code, text, detail });
  const chars = Array.from(text);

  const forms = presentationFindings(chars);
  if (forms) add('presentation-forms', forms);
  const edges = tatweelEdges(text);
  if (edges.length) add('tatweel-edge', `A tatweel at the edge of a word: ${edges.slice(0, 3).join('; ')}. The studio places kashida itself, never at a word start or end.`);
  if (zwnjInside(chars)) add('zwnj-in-word', 'A zero-width non-joiner (U+200C) sits between two Arabic letters and cuts their join. Remove it.');
  const stacked = stackedHarakat(text);
  if (stacked.length) add('stacked-harakat', `${stacked.slice(0, 3).join('; ')}. Check the marks do not collide at this size.`);
  const mixed = mixedDirection(text);
  if (mixed) add('mixed-direction', mixed);
  const digitsDetail = digitStyle(text, options.digits);
  if (digitsDetail) add('digit-style', digitsDetail);
  const runs = longRuns(text, { line: options.longLine ?? LONG_LINE_CHARS, token: options.longToken ?? LONG_TOKEN_CHARS });
  if (runs) add('long-line', runs);

  if (options.coverage) {
    const shown = options.digits === 'latin' || options.digits === 'arabic-indic' ? displayDigits(text, options.digits) : text;
    const missing = missingGlyphs(shown, options.coverage);
    const list = (items: string[]) => items.slice(0, 8).map((ch) => `${hex(ch)} ${ch}`).join(', ');
    if (missing.fail.length) add('missing-glyph', `The font does not draw ${list(missing.fail)}; the browser would use another face or an empty box.`, 'fail');
    if (missing.review.length) add('missing-glyph', `The font does not draw the symbol or emoji ${list(missing.review)}; it comes from the system font, so look at it on the preview.`, 'needs-review');
  }
  return out;
}

/** The rules that read markup (a rendered scene, or a string that holds tags): Arabic letters of one word must not be split across elements. */
export function checkArabicMarkup(html: string): ArabicFinding[] {
  const out: ArabicFinding[] = [];
  if (typeof html !== 'string' || !HAS_TAG.test(html)) return out;
  const add = (code: ArabicCode, detail: string) => out.push({ level: ARABIC_CHECK_CODES[code], code, text: html, detail });

  // Walk the tags and the characters between them. `last` is the last visible character, with the tags passed since it.
  type Piece = { kind: 'tag'; name: string; closing: boolean; style: string } | { kind: 'text'; value: string };
  const pieces: Piece[] = [];
  let cursor = 0;
  for (const match of html.matchAll(TAG)) {
    if (match.index! > cursor) pieces.push({ kind: 'text', value: html.slice(cursor, match.index) });
    const raw = match[0];
    pieces.push({ kind: 'tag', name: /^<\/?([A-Za-z][\w-]*)/.exec(raw)![1].toLowerCase(), closing: raw.startsWith('</'), style: /style\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(raw)?.slice(1).find((part) => part !== undefined) ?? '' });
    cursor = match.index! + raw.length;
  }
  if (cursor < html.length) pieces.push({ kind: 'text', value: html.slice(cursor) });

  // Two elements side by side are not enough to call a word split: markup alone cannot tell a split word from two blocks that sit next to
  // each other. The signature of a split word is a one-letter fragment glued to the letter beside it, so that is what is reported.
  const letterRun = (value: string, fromEnd: boolean): number => {
    const letters = Array.from(value).filter((ch) => !MARK.test(ch));
    let run = 0;
    for (let i = 0; i < letters.length; i++) {
      if (!isArabicLetter(fromEnd ? letters[letters.length - 1 - i] : letters[i])) break;
      run++;
    }
    return run;
  };
  const splits: string[] = [];
  let left: { last: string; run: number } | null = null; // the previous text ended in an Arabic letter, with this many letters in its last run
  let crossed = false;                                   // only tags came between it and the text that follows
  for (const piece of pieces) {
    if (piece.kind === 'tag') {
      if (BLOCK_TAGS.has(piece.name)) { left = null; crossed = false; } else if (left) crossed = true;
      continue;
    }
    const letters = Array.from(piece.value).filter((ch) => !MARK.test(ch));
    if (!letters.length) { left = null; crossed = false; continue; }
    if (left && crossed && joinsForward(left.last) && joinsBackward(letters[0]) && (left.run === 1 || letterRun(piece.value, false) === 1)) splits.push(`${left.last}|${letters[0]}`);
    const last = letters[letters.length - 1];
    left = isArabicLetter(last) ? { last, run: letterRun(piece.value, true) } : null;
    crossed = false;
  }
  if (splits.length) add('split-word-markup', `An Arabic word is cut across elements at ${unique(splits).slice(0, 3).join(', ')}; the letters would stop joining. Put the whole word in one element.`);

  // A one-letter element with a transform, sitting inside a word, is the per-letter animation that unjoins Arabic.
  // The characters of the nearest text on one side, or undefined when a block boundary comes first.
  const neighbour = (from: number, step: 1 | -1): string[] | undefined => {
    for (let at = from; at >= 0 && at < pieces.length; at += step) {
      const piece = pieces[at];
      if (piece.kind === 'text') return Array.from(piece.value);
      if (BLOCK_TAGS.has(piece.name)) return undefined;
    }
    return undefined;
  };
  const lone: string[] = [];
  for (let i = 0; i + 2 < pieces.length; i++) {
    const open = pieces[i], body = pieces[i + 1], close = pieces[i + 2];
    if (open.kind !== 'tag' || open.closing || body.kind !== 'text' || close.kind !== 'tag' || !close.closing || close.name !== open.name) continue;
    if (!/transform|translate|rotate|scale/i.test(open.style)) continue;
    const letters = Array.from(body.value).filter((ch) => !MARK.test(ch));
    if (letters.length !== 1 || !isArabicLetter(letters[0])) continue;
    const previousLetter = neighbour(i - 1, -1)?.filter((ch) => !MARK.test(ch)).pop();
    const nextLetter = neighbour(i + 3, 1)?.find((ch) => !MARK.test(ch));
    const touchesWord = (previousLetter !== undefined && joinsForward(previousLetter) && joinsBackward(letters[0])) || (nextLetter !== undefined && joinsForward(letters[0]) && joinsBackward(nextLetter));
    if (touchesWord) lone.push(letters[0]);
  }
  if (lone.length) add('per-letter-transform', `A transform on the single letter ${unique(lone).join(' ')} inside a word moves it away from its neighbours. Move whole words or lines, or use a letter effect on a rasterised line.`);
  return out;
}

/** The text of a string that holds tags, without the tags. */
export const stripTags = (html: string): string => html.replace(TAG, '');

// ---- the manifest walker -------------------------------------------------------------------------------------------------------------

export type VisibleString = {
  kind: 'caption' | 'scene' | 'creator';
  where: string;
  path: (string | number)[];
  text: string;
  /** A font the scene names for itself (a scene's `data.font`). */
  font?: string;
};

// The same fields scripts/lib/text-check.mjs reads: keys and values that carry code, assets or styling are never words the viewer reads.
const TECHNICAL_KEY = /^(?:id|.*Id|src|path|file|url|href|icon|component|recipe|font|.*Font|color|.*Color|accent)$/;
const TECHNICAL_VALUE = /^(?:#[\da-f]{3,8}|(?:https?:\/\/|(?:Projects|Raw|Reference|Outputs|state)\/)\S*|[\w.-]+\.(?:png|jpe?g|webp|gif|svg|mp4|mov|webm|wav|mp3|m4a|json|ttf|otf|woff2?))$/i;

const record = (value: unknown): Record<string, unknown> | null => (value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null);

/** Every visible string of an edit manifest: caption words, scene copy (technical fields skipped), the creator name and ending lines. */
export function visibleStrings(manifest: unknown): VisibleString[] {
  const out: VisibleString[] = [];
  const m = record(manifest);
  if (!m) return out;

  const words = record(m.captions)?.words;
  if (Array.isArray(words)) {
    words.forEach((word, index) => {
      const text = record(word)?.text;
      if (typeof text === 'string' && text.trim()) out.push({ kind: 'caption', where: `captions.words[${index}]`, path: ['captions', 'words', index], text });
    });
  }

  // The creator CTA scenes draw `{keyword}` as the comment keyword, so the drawn text is what the rules read.
  const endingCta = record(record(m.creator)?.ending)?.cta;
  const ctaKeyword = typeof endingCta === 'string' && endingCta.trim() ? endingCta : undefined;

  if (Array.isArray(m.scenes)) {
    m.scenes.forEach((scene, index) => {
      const s = record(scene);
      const data = s?.data;
      if (!s || data === null || data === undefined) return;
      const sceneId = typeof s.id === 'string' ? s.id : `#${index + 1}`;
      const font = typeof record(data)?.font === 'string' ? (record(data)!.font as string) : undefined;
      const keyword = typeof record(data)?.keyword === 'string' && (record(data)!.keyword as string).trim() ? (record(data)!.keyword as string) : ctaKeyword;
      const walk = (value: unknown, trail: string, path: (string | number)[], key: string | undefined, depth: number) => {
        if (depth > 12 || (key !== undefined && TECHNICAL_KEY.test(key))) return;
        if (typeof value === 'string') {
          if (value.trim() && !TECHNICAL_VALUE.test(value.trim())) out.push({ kind: 'scene', where: `scenes[${sceneId}].${trail}`, path: ['scenes', index, ...path], text: keyword ? value.replace(/\{keyword\}/g, keyword) : value, ...(font ? { font } : {}) });
        } else if (Array.isArray(value)) {
          value.forEach((item, at) => walk(item, `${trail}[${at}]`, [...path, at], key, depth + 1));
        } else {
          const object = record(value);
          if (object) for (const [name, item] of Object.entries(object)) walk(item, `${trail}.${name}`, [...path, name], name, depth + 1);
        }
      };
      walk(data, 'data', ['data'], undefined, 0);
    });
  }

  const creator = record(m.creator);
  if (creator) {
    const ending = record(creator.ending);
    const lines: [string, (string | number)[], unknown][] = [['creator.displayName', ['creator', 'displayName'], creator.displayName],
      ['creator.ending.cta', ['creator', 'ending', 'cta'], ending?.cta], ['creator.ending.signOff', ['creator', 'ending', 'signOff'], ending?.signOff]];
    for (const [where, path, text] of lines) if (typeof text === 'string' && text.trim()) out.push({ kind: 'creator', where, path, text });
  }
  return out;
}

export type FontCoverage = (family: string) => ReadonlySet<number> | null | undefined;
export type ManifestOptions = {
  /** The digits choice of the profile, used when the manifest itself has none. */
  digits?: DigitChoice | null;
  /** The fixed font of the profile, used when the manifest names none. */
  profileFont?: string | null;
  /** What each font draws. Omitted: the glyph check is not run. */
  coverage?: FontCoverage | null;
  longLine?: number;
  longToken?: number;
};

const digitChoice = (value: unknown): DigitChoice | null => (value === 'latin' || value === 'arabic-indic' ? value : null);

/** The font family the manifest draws a string in: the scene's own font, the manifest font, the profile's fixed font, then the style default. */
export function fontForManifest(manifest: unknown, options: ManifestOptions = {}, sceneFont?: string): string {
  const m = record(manifest);
  if (sceneFont) return sceneFont;
  if (typeof m?.fontFamily === 'string') return m.fontFamily;
  if (options.profileFont) return options.profileFont;
  return defaultFontFor(typeof m?.style === 'string' ? m.style : '');
}

/** Every finding of an edit manifest, each with where it is (a readable `where` and a `path` array for the editor), plus notes about checks that could not run. */
export function manifestFindings(manifest: unknown, options: ManifestOptions = {}): { findings: LocatedFinding[]; notes: string[] } {
  const findings: LocatedFinding[] = [];
  const notes: string[] = [];
  const m = record(manifest);
  if (!m) return { findings, notes };
  const digits = digitChoice(m.digits) ?? options.digits ?? null;
  const unknownFonts = new Set<string>();
  // Caption words that are never drawn (burned-in subtitles, or a graphics-only edit) cannot draw broken, so they are left out.
  const captionsDrawn = m.contentMode !== 'graphics' && record(m.captions)?.visible !== false;
  const all = visibleStrings(manifest);
  const strings = captionsDrawn ? all : all.filter((item) => item.kind !== 'caption');
  if (strings.length < all.length) notes.push('The caption words are not drawn on screen (captions.visible is false), so they were not checked.');

  for (const item of strings) {
    const family = fontForManifest(manifest, options, item.font);
    let coverage: ReadonlySet<number> | null = null;
    if (options.coverage) {
      coverage = options.coverage(family) ?? null;
      if (!coverage && !unknownFonts.has(family)) { unknownFonts.add(family); notes.push(`No glyph data for the font "${family}" (not installed or not a known family); glyph coverage was not checked for text set in it.`); }
    }
    const holdsMarkup = HAS_TAG.test(item.text);
    const found = [...(holdsMarkup ? checkArabicMarkup(item.text) : []),
      ...checkArabicString(holdsMarkup ? stripTags(item.text) : item.text, { digits, coverage, longLine: options.longLine, longToken: options.longToken })];
    for (const finding of found) findings.push({ ...finding, text: item.text, where: item.where, path: item.path });
  }

  // Caption words arrive one at a time, so a Latin word is judged by its neighbours: the same word is reported once, with a count.
  const words = strings.filter((item) => item.kind === 'caption');
  const groups = new Map<string, { first: VisibleString; count: number }>();
  words.forEach((item, at) => {
    const own = item.text.trim();
    const standalone = (LATIN_LETTER.test(own) || SIGNED_NUMBER.test(own)) && !hasArabicLetter(own);
    if (!standalone) return;
    const neighbours = [words[at - 1], words[at + 1]].filter((neighbour): neighbour is VisibleString => neighbour !== undefined);
    // Only direct neighbours in the word list count; a hole left by an empty word does not join two sides.
    const index = (entry: VisibleString) => entry.path[2] as number;
    const adjacent = neighbours.filter((neighbour) => Math.abs(index(neighbour) - index(item)) === 1);
    if (!adjacent.some((neighbour) => hasArabicLetter(neighbour.text))) return;
    const key = own.toLowerCase();
    const group = groups.get(key);
    if (group) group.count++; else groups.set(key, { first: item, count: 1 });
  });
  for (const { first, count } of groups.values()) {
    findings.push({ level: 'needs-review', code: 'mixed-direction', text: first.text, where: first.where, path: first.path,
      detail: `"${first.text.trim()}" sits between Arabic words${count > 1 ? ` (${count} times; the first is reported)` : ''}. Check its position and punctuation on the preview.` });
  }
  return { findings, notes };
}

/** A short Arabic sentence for the editor's issue list. The English detail stays in `detail`. */
export function arabicIssueMessage(code: ArabicCode, text: string): string {
  const shown = text.length > 40 ? `${text.slice(0, 40)}…` : text;
  switch (code) {
    case 'missing-glyph': return `الخط المختار مش بيرسم حرف أو أكتر في «${shown}». هيطلع بخط تاني أو مربع فاضي.`;
    case 'split-word-markup': return `كلمة عربية متقطعة بين أكتر من عنصر في «${shown}». الحروف مش هتتوصل ببعض.`;
    case 'zwnj-in-word': return `فيه فاصل مخفي (ZWNJ) جوه كلمة في «${shown}». هيقطع وصل الحروف. شيله.`;
    case 'presentation-forms': return `حروف عربية بأشكال العرض الجاهزة (زي \uFEFB) في «${shown}». اكتبها حروف عادية والاستوديو يوصلها.`;
    case 'tatweel-edge': return `كشيدة (\u0640) في أول كلمة أو آخرها في «${shown}». الكشيدة بتتحط بين الحروف بس.`;
    case 'per-letter-transform': return `حرف عربي واحد بيتحرك لوحده جوه كلمة في «${shown}». الحروف هتتفك عن بعض.`;
    case 'mixed-direction': return `كلام عربي مخلوط بإنجليزي أو رقم بإشارة في «${shown}». راجع ترتيبه في المعاينة.`;
    case 'stacked-harakat': return `أكتر من تشكيلة على حرف واحد في «${shown}». راجع إنها مش متداخلة.`;
    case 'digit-style': return `شكل الأرقام في «${shown}» مختلف عن اختيار الأرقام. راجع الأرقام في المعاينة.`;
    case 'long-line': return `سطر أو كلمة طويلة جد\u064Bا في «${shown}». راجع إنها داخلة في عرض الشاشة.`;
  }
}
