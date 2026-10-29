// Arabic letter joining. Pure and Node-safe: no packages, no React, no DOM.
//
// Written from the Unicode joining model (dual-joining, right-joining, non-joining, transparent, join-causing), not copied
// from any project. Every other module of the Arabic core builds on these four answers: what kind of character is this,
// does it connect to the next letter, does it connect to the previous letter, and which characters belong together.

/** R = right-joining (connects to the letter before it only), D = dual-joining, U = non-joining, T = transparent (harakat and other marks), C = join-causing (tatweel, ZWJ). */
export type JoiningType = "R" | "D" | "U" | "T" | "C";

const TATWEEL = 0x0640;
const ZWJ = 0x200d;

// Letters that join to the letter before them but never to the one after them. Alef maqsura (U+0649) is listed here
// because in Arabic text it only ever ends a word; Unicode calls it dual-joining for other languages.
const RIGHT_JOINING: ReadonlyArray<readonly [number, number]> = [
  [0x0622, 0x0625], // آ أ ؤ إ
  [0x0627, 0x0627], // ا
  [0x0629, 0x0629], // ة
  [0x062f, 0x0632], // د ذ ر ز
  [0x0648, 0x0649], // و ى
  [0x0671, 0x0673], // ٱ ٲ ٳ
  [0x0675, 0x0677],
  [0x0688, 0x0699], // ڈ … ژ (Urdu / Persian dal and reh families)
  [0x06c0, 0x06c0],
  [0x06c3, 0x06cb], // ۃ … ۋ
  [0x06cd, 0x06cd],
  [0x06cf, 0x06cf],
  [0x06d2, 0x06d3],
  [0x06d5, 0x06d5],
  [0x06ee, 0x06ef],
  [0x0759, 0x075b],
  [0x076b, 0x076c],
  [0x0771, 0x0771],
  [0x0773, 0x0774],
  [0x0778, 0x0779],
];

// Marks and format characters that sit on or between letters without changing the join. Unicode gives the two
// end-of-ayah style signs U+06DD / U+06DE and the small letters U+06E5 / U+06E6 / U+06E9 no transparency, so they are not here.
const TRANSPARENT: ReadonlyArray<readonly [number, number]> = [
  [0x0610, 0x061a],
  [0x061c, 0x061c],
  [0x064b, 0x065f],
  [0x0670, 0x0670],
  [0x06d6, 0x06dc],
  [0x06df, 0x06e4],
  [0x06e7, 0x06e8],
  [0x06ea, 0x06ed],
  [0x08d3, 0x08e1],
  [0x08e3, 0x08ff],
  [0x200e, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x2064],
  [0x2066, 0x2069],
  [0xfeff, 0xfeff],
];

// Dual-joining letters beyond the "every other letter of the main block" rule below.
const DUAL_EXTRA: ReadonlyArray<readonly [number, number]> = [
  [0x06fa, 0x06fc],
  [0x06ff, 0x06ff],
  [0x0750, 0x077f],
];

const inRanges = (code: number, ranges: ReadonlyArray<readonly [number, number]>): boolean => {
  for (const [lo, hi] of ranges) if (code >= lo && code <= hi) return true;
  return false;
};

/** Joining type of a code point. */
const typeOfCode = (code: number): JoiningType => {
  if (code === TATWEEL || code === ZWJ) return "C";
  if (inRanges(code, TRANSPARENT)) return "T";
  if (inRanges(code, RIGHT_JOINING)) return "R";
  // Hamza (U+0621) and the high hamza (U+0674) stand alone.
  if (code === 0x0621 || code === 0x0674) return "U";
  if ((code >= 0x0620 && code <= 0x064a) || (code >= 0x066e && code <= 0x06d3)) return "D";
  if (inRanges(code, DUAL_EXTRA)) return "D";
  return "U";
};

/** Joining type of a code point number (the same answer as `joiningType`, without building a string). */
export const joiningTypeOfCode = typeOfCode;

/** Joining type of the first code point of `ch`. Anything that is not an Arabic-script letter or mark is "U". */
export function joiningType(ch: string): JoiningType {
  const code = ch.codePointAt(0);
  return code === undefined ? "U" : typeOfCode(code);
}

const unitAt = (text: string, index: number): number => {
  const code = text.codePointAt(index);
  return code !== undefined && code > 0xffff ? 2 : 1;
};

/** Index of the next character after `index` that is not transparent, or -1. */
const nextBase = (text: string, index: number): number => {
  let i = index + unitAt(text, index);
  while (i < text.length) {
    if (typeOfCode(text.codePointAt(i) as number) !== "T") return i;
    i += unitAt(text, i);
  }
  return -1;
};

/** Index of the previous character before `index` that is not transparent, or -1. */
const prevBase = (text: string, index: number): number => {
  let i = index - 1;
  while (i >= 0) {
    const low = text.charCodeAt(i);
    if (low >= 0xdc00 && low <= 0xdfff && i > 0) i -= 1; // step onto the high surrogate
    if (typeOfCode(text.codePointAt(i) as number) !== "T") return i;
    i -= 1;
  }
  return -1;
};

const inside = (text: string, index: number): boolean => Number.isInteger(index) && index >= 0 && index < text.length;

/** True when the character at `index` connects to the next letter, skipping transparent marks between them. */
export function joinsForward(text: string, index: number): boolean {
  if (!inside(text, index)) return false;
  const own = typeOfCode(text.codePointAt(index) as number);
  if (own !== "D" && own !== "C") return false;
  const next = nextBase(text, index);
  if (next < 0) return false;
  const nextType = typeOfCode(text.codePointAt(next) as number);
  return nextType === "R" || nextType === "D" || nextType === "C";
}

/** True when the character at `index` connects to the previous letter, skipping transparent marks between them. */
export function joinsBackward(text: string, index: number): boolean {
  if (!inside(text, index)) return false;
  const own = typeOfCode(text.codePointAt(index) as number);
  if (own !== "R" && own !== "D" && own !== "C") return false;
  const prev = prevBase(text, index);
  if (prev < 0) return false;
  const prevType = typeOfCode(text.codePointAt(prev) as number);
  return prevType === "D" || prevType === "C";
}

const COMBINING = /\p{M}/u;

/** True for a code point that rides on the character before it (harakat, other marks, the joiner). */
export const isCombining = (code: number): boolean => code === ZWJ || COMBINING.test(String.fromCodePoint(code));

/** Splits text into user-perceived characters: a base letter keeps its following harakat (and joiner) with it. Joining the result returns the text. */
export function graphemes(text: string): string[] {
  const out: string[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0) as number;
    if (out.length > 0 && isCombining(code)) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}
