// Shared synthetic data for the cartoon suites: neutral placeholder words and a two-act body.

// Arabic-only suffixes keep every word unique without a digit (a digit would start a Latin run in the headline).
const LETTERS = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
/** The text of word `i`: every fifth word from 2 is the Latin `API`, the others are distinct Arabic words. */
export const wordText = (i) => (i % 5 === 2 ? 'API' : `كلمة${LETTERS[i % LETTERS.length]}${i >= LETTERS.length ? LETTERS[Math.floor(i / LETTERS.length)] : ''}`);
/** `count` words, one every `step` seconds at `fps`; the source index equals the position. */
export const words = (count = 16, fps = 30, step = 0.5) => Array.from({length: count}, (_, i) => ({
  text: wordText(i), sourceIndex: i, fromFrame: Math.round(i * step * fps), toFrame: Math.round((i * step + 0.3) * fps),
}));

/** A light act over sentences 1-2 and a dark act over sentences 3-4, with a term, a code and a fan card. */
export const body = (over = {}) => ({
  acts: [{theme: 'light', sentence: 0, tag: '// 01 — hook'}, {theme: 'dark', sentence: 2, tag: '// 02 — the idea'}],
  sentences: [{from: 0, to: 3}, {from: 4, to: 7}, {from: 8, to: 11}, {from: 12, to: 15}],
  accents: [5, 13],
  counter: {kind: 'sections'},
  brackets: true,
  cards: [
    {id: 'term1', kind: 'term', from: {word: 0}, to: {word: 4}, data: {tag: '// idea', term: 'API', glyphs: ['circle', 'triangle']}},
    {id: 'code1', kind: 'code', from: {word: 4}, to: 'flip', data: {filename: 'app.js', lines: [{text: 'connect(a, b)', at: {word: 5}}]}},
    {id: 'fan1', kind: 'fan', from: {word: 8}, to: {word: 15}, data: {items: [{name: 'بريد', icon: 'mail'}, {name: 'ملفات', icon: 'folder'}]}},
  ],
  ...over,
});

export const bodyScene = (over = {}) => ({id: 'body', family: 'cartoon', fromFrame: 0, durationInFrames: 260, layout: 'takeover', motion: 'quiet', data: body(over)});
