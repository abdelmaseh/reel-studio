// Editor templates for the cartoon families: a starter body and a follow-only ending built over the scene's own reviewed words.
// Every visible string is a placeholder the creator replaces (the editor flags them, and delivery refuses them unchanged).
// Node-safe: no packages, no JSX.
import {DEFAULT_CHARACTER, type Character} from './character.ts';
import {ACT_MIN_SECONDS, flipFrameFor, type WordLike} from './math.ts';

type Sentence = {from: number; to: number};
const SENTENCE_WORDS = 4;

/** Sentences of four words over the given words, in order. */
const sentencesOver = (words: readonly WordLike[]): Sentence[] => {
  const out: Sentence[] = [];
  for (let i = 0; i < words.length; i += SENTENCE_WORDS) out.push({from: words[i].sourceIndex, to: words[Math.min(words.length, i + SENTENCE_WORDS) - 1].sourceIndex});
  return out;
};

export type TemplateSpan = {fps: number; sceneFrom: number; durationInFrames: number};

/** The sentence where the second act starts: both acts last at least ACT_MIN_SECONDS and the flip sits nearest the middle. */
function secondActAt(words: readonly WordLike[], sentences: readonly Sentence[], span: TemplateSpan): number {
  const startOf = (s: Sentence) => words.find((w) => w.sourceIndex === s.from)!.fromFrame - span.sceneFrom;
  const lastBefore = (s: Sentence) => words.filter((w) => w.sourceIndex < s.from).at(-1)!.fromFrame - span.sceneFrom;
  let best = -1, bestDistance = Infinity;
  for (let k = 1; k < sentences.length; k += 1) {
    const flip = flipFrameFor(startOf(sentences[k]), lastBefore(sentences[k]), span.fps);
    const min = ACT_MIN_SECONDS * span.fps;
    if (flip < min || span.durationInFrames - flip < min) continue;
    const distance = Math.abs(flip - span.durationInFrames / 2);
    if (distance < bestDistance) { best = k; bestDistance = distance; }
  }
  return best > 0 ? best : Math.max(1, Math.ceil(sentences.length / 2));
}

/** The starter body the live editor adds over the scene's words: two acts, a term card and a windows card. */
export function cartoonTemplate(words: readonly WordLike[], span: TemplateSpan = {fps: 30, sceneFrom: 0, durationInFrames: 260}) {
  const sentences = sentencesOver(words);
  const second = Math.min(sentences.length - 1, secondActAt(words, sentences, span));
  const lastWord = words[words.length - 1].sourceIndex;
  return {
    character: {...DEFAULT_CHARACTER} as Character,
    acts: [{theme: 'light' as const, sentence: 0, tag: '// 01 — المقدمة'}, {theme: 'dark' as const, sentence: second, tag: '// 02 — الفكرة'}],
    sentences, accents: [] as number[], counter: {kind: 'sections' as const}, brackets: true,
    cards: [
      {id: 'card-1', kind: 'term' as const, from: {word: words[0].sourceIndex}, to: 'flip' as const, data: {tag: '// الموضوع', term: 'اكتب الكلمة', glyphs: ['circle' as const, 'triangle' as const]}},
      {id: 'card-2', kind: 'windows' as const, from: {word: sentences[second].from}, to: {word: lastWord}, data: {left: {name: 'برنامج تاني'}, right: {name: 'برنامج'}, linkLabel: 'اكتب الرابط'}},
    ],
  };
}

/** A follow-only ending over the scene's words, with the creator's own handle when the profile has one. */
export function cartoonEndingTemplate(words: readonly WordLike[], profile: {handle: string | null}) {
  const first = words[0]?.sourceIndex ?? 0, mid = words[Math.min(words.length - 1, Math.max(1, Math.floor(words.length / 2)))]?.sourceIndex ?? first;
  return {
    character: {...DEFAULT_CHARACTER} as Character,
    fromTheme: 'dark' as const, theme: 'light' as const, tag: '// 03 — المتابعة', entrance: {x: 540, scale: 0.86},
    sentences: sentencesOver(words), accents: [] as number[],
    follow: {handle: profile.handle ?? '@example.creator', message: 'اكتب رسالة المتابعة', at: {word: first}, tapAt: {word: mid, dt: 0.04}},
  };
}

const SAMPLE: WordLike[] = Array.from({length: 18}, (_, i) => ({sourceIndex: i, fromFrame: i * 15, toFrame: i * 15 + 9, text: 'كلمة'}));
/** Static placeholder data the demo detector compares against (only the strings matter). */
export const cartoonTemplateData: Record<string, unknown> = {
  cartoon: cartoonTemplate(SAMPLE),
  'cartoon-ending': cartoonEndingTemplate(SAMPLE, {handle: '@example.creator'}),
};
/** Frames the starter body asks for: nine seconds, room for two acts of at least three. */
export const cartoonTemplateFrames = (fps = 30): number => Math.round(9 * fps);
/** Copy keys the creator must rewrite; every other string in a cartoon scene is a structural choice (theme, kind, colour, icon, id). */
export const CARTOON_COPY_KEYS: ReadonlySet<string> = new Set(['tag', 'term', 'name', 'linkLabel', 'caption', 'filename', 'text', 'label', 'stamp', 'command', 'title',
  'beforeLabel', 'afterLabel', 'equalsBefore', 'equalsAfter', 'arrowLabel', 'message', 'keyword', 'promise', 'handle']);
