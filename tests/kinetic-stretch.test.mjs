import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPHASIS_KINDS, STRETCH_PEAK, STRETCH_IN_SEC, STRETCH_OUT_SEC, resolveEmphasis, tokenizeSpoken, stretchCount, stretchedText, reservedText,
  stretchAmount, stretchRoom, stretchWidths,
} from '../engine/src/creative-kit/kinetic-words-logic.ts';
import {stretchWord} from '../engine/src/arabic/kashida.ts';
import {semanticSceneSchema} from '../engine/src/creative-kit/semantic/schema.ts';
import {createFrameRenderer} from '../scripts/lib/ssr-frames.mjs';
import {editSceneSchema} from '../engine/src/prepared-edit/schema.ts';
import {textNodes} from './helpers/markup.mjs';
import crypto from 'node:crypto';
import {bundleEngine, setSsrFrame} from './helpers/engine-bundle.mjs';

const T = 'ـ';
const word = (text, sourceIndex, fromFrame, toFrame) => ({text, sourceIndex, fromFrame, toFrame});
const count = (text) => [...text].filter((c) => c === T).length;

test('stretch is the sixth kinetic emphasis kind and every kind resolves', () => {
  assert.deepEqual([...EMPHASIS_KINDS], ['accent', 'latin', 'pop', 'underline', 'weight', 'stretch']);
  const tokens = tokenizeSpoken([word('ببلاش', 0, 10, 40), word('شكرا', 1, 40, 70)]);
  const kinds = resolveEmphasis(tokens, [{sourceIndex: 0, kind: 'stretch'}, {sourceIndex: 0, kind: 'accent'}, {sourceIndex: 1, kind: 'stretch'}]);
  assert.deepEqual(kinds, [['accent', 'stretch'], ['stretch']], 'kinds come back in the order of EMPHASIS_KINDS');
  assert.throws(() => resolveEmphasis(tokens, [{sourceIndex: 0, kind: 'wobble'}]), /stretch/, 'the error lists stretch among the kinds');
});

test('stretch on a word that cannot stretch is ignored, not an error', () => {
  const tokens = tokenizeSpoken([word('AI', 0, 0, 20), word('ورد', 1, 20, 40)]);
  assert.doesNotThrow(() => resolveEmphasis(tokens, [{sourceIndex: 0, kind: 'stretch'}, {sourceIndex: 1, kind: 'stretch'}]));
  assert.equal(stretchedText('AI', 10, 0, 40, 30), 'AI');
  assert.equal(stretchedText('ورد', 10, 0, 40, 30), 'ورد');
  assert.equal(reservedText('AI', ['stretch']), 'AI');
});

test('tokens carry the end of their spoken window in the same time base as the enter frame', () => {
  const [a, b] = tokenizeSpoken([word('فكرة', 0, 24, 60), word('واحدة', 1, 60, 96)]);
  assert.deepEqual([a.enterFrame, a.endFrame, b.enterFrame, b.endFrame], [24, 60, 60, 96]);
  const [c] = tokenizeSpoken([word('فكرة', 0, 24, 60)], {origin: 10, leadFrames: 2});
  assert.deepEqual([c.enterFrame, c.endFrame], [12, 48]);
});

test('a word of several pieces ends each piece where the next begins, and joined continuations extend the end', () => {
  const [first, second] = tokenizeSpoken([word('جدا ممتاز', 0, 0, 40)]);
  assert.equal(first.enterFrame, 0);
  assert.equal(first.endFrame, second.enterFrame);
  assert.equal(second.endFrame, 40);
  const joined = tokenizeSpoken([word(' كتب', 0, 0, 20), word('ة', 1, 20, 30)]);
  assert.equal(joined.length, 1, 'the continuation joins the token');
  assert.equal(joined[0].text, 'كتبة');
  assert.equal(joined[0].endFrame, 30);
  for (const token of tokenizeSpoken([word('أ ب ت ث', 0, 5, 9)])) assert.ok(token.endFrame >= token.enterFrame, 'an end is never before its start');
});

test('stretchCount: nothing before the word, a rise over 0.35 s, a hold over the spoken word, a relax over 0.25 s', () => {
  const fps = 30, enter = 30, end = 90;
  const rise = Math.round(STRETCH_IN_SEC * fps), relax = Math.round(STRETCH_OUT_SEC * fps);
  assert.deepEqual([rise, relax], [11, 8]);
  assert.equal(stretchCount(0, enter, end, fps), 0);
  assert.equal(stretchCount(enter - 1, enter, end, fps), 0);
  assert.equal(stretchCount(enter, enter, end, fps), 0, 'it starts from the plain word');
  assert.equal(stretchCount(enter + rise, enter, end, fps), STRETCH_PEAK);
  for (let f = enter + rise; f <= end; f++) assert.equal(stretchCount(f, enter, end, fps), STRETCH_PEAK, `hold at ${f}`);
  assert.equal(stretchCount(end + relax, enter, end, fps), 0);
  assert.equal(stretchCount(end + relax + 40, enter, end, fps), 0);
  let previous = 0;
  for (let f = enter; f <= enter + rise; f++) {
    const n = stretchCount(f, enter, end, fps);
    assert.ok(n >= previous, `the rise only grows (${f})`);
    previous = n;
  }
  for (let f = end; f <= end + relax; f++) {
    const n = stretchCount(f, enter, end, fps);
    assert.ok(n <= previous, `the relax only shrinks (${f})`);
    previous = n;
  }
  assert.ok(stretchCount(enter + 1, enter, end, fps) > 0 && stretchCount(enter + 1, enter, end, fps) < STRETCH_PEAK);
});

test('stretchCount: a very short spoken word still reaches the peak before it relaxes', () => {
  const fps = 30, enter = 10, end = 14;
  let peak = 0;
  for (let f = enter; f < enter + 40; f++) peak = Math.max(peak, stretchCount(f, enter, end, fps));
  assert.equal(peak, STRETCH_PEAK);
  assert.equal(stretchCount(enter + 11 + 8, enter, end, fps), 0, 'relaxes right after the rise');
});

test('stretchCount scales its timing with fps and takes a custom peak', () => {
  const at60 = Array.from({length: 120}, (_, f) => stretchCount(f, 0, 30, 60));
  assert.equal(Math.max(...at60), STRETCH_PEAK);
  assert.equal(at60[Math.round(0.35 * 60)], STRETCH_PEAK, 'the rise takes 0.35 s at any fps');
  assert.equal(at60[30], STRETCH_PEAK);
  assert.equal(at60[30 + Math.round(0.25 * 60)], 0, 'the relax takes 0.25 s at any fps');
  assert.equal(Math.max(...Array.from({length: 60}, (_, f) => stretchCount(f, 0, 20, 30, 2))), 2);
  assert.equal(stretchCount(5, 0, 20, 30, 0), 0, 'a peak of zero never stretches');
});

test('stretchedText is the whole word with tatweels added at its best slot, as one string', () => {
  const fps = 30;
  assert.equal(stretchedText('ببلاش', 5, 30, 90, fps), 'ببلاش');
  const peak = stretchedText('ببلاش', 50, 30, 90, fps);
  assert.equal(peak, 'بب' + T.repeat(STRETCH_PEAK) + 'لاش');
  assert.equal(peak, stretchWord('ببلاش', STRETCH_PEAK));
  const mid = stretchedText('ببلاش', 33, 30, 90, fps);
  assert.ok(count(mid) > 0 && count(mid) < STRETCH_PEAK, mid);
  assert.equal(mid.replaceAll(T, ''), 'ببلاش');
  assert.equal(reservedText('ببلاش', ['accent']), 'ببلاش', 'only stretch reserves room');
  assert.equal(reservedText('ببلاش', ['accent', 'stretch']), peak);
});

test('the kinetic text scene schema accepts stretch emphasis and still refuses unknown kinds', () => {
  const data = {kicker: 'كلمات', title: 'عنوان', sourceIndices: [0, 1], lang: 'ar', enter: 'rise', emphasis: [{sourceIndex: 1, kind: 'stretch'}]};
  const scene = {id: 'words', family: 'kinetic-text', layout: 'takeover', motion: 'land', fromFrame: 0, durationInFrames: 120, data};
  assert.equal(semanticSceneSchema.safeParse(scene).success, true);
  assert.equal(editSceneSchema.safeParse(scene).success, true);
  assert.equal(semanticSceneSchema.safeParse({...scene, data: {...data, emphasis: [{sourceIndex: 1, kind: 'wobble'}]}}).success, false);
});

// ---- rendered markup -----------------------------------------------------------------------------------------

const renderer = await createFrameRenderer();
const WORDS = [
  {text: 'فكرة', sourceIndex: 0, segmentIndex: 0, fromFrame: 0, toFrame: 24, startMs: 0, endMs: 800, confidence: 1},
  {text: 'ببلاش', sourceIndex: 1, segmentIndex: 0, fromFrame: 30, toFrame: 74, startMs: 1000, endMs: 2466, confidence: 1},
  {text: 'للجميع', sourceIndex: 2, segmentIndex: 0, fromFrame: 75, toFrame: 110, startMs: 2500, endMs: 3666, confidence: 1},
];
const sceneWith = (emphasis) => editSceneSchema.parse({
  id: 'words', family: 'kinetic-text', layout: 'takeover', motion: 'land', fromFrame: 0, durationInFrames: 140,
  data: {kicker: 'كلمات', title: 'عنوان', sourceIndices: [0, 1, 2], lang: 'ar', enter: 'rise', ...(emphasis ? {emphasis} : {})},
});
const draw = (frame, emphasis) => renderer.renderScene({scene: sceneWith(emphasis), style: 'section-deck', frame, words: WORDS});
const textOfWord = (html, plain) => textNodes(html).filter((node) => node.replaceAll(T, '') === plain);

test('rendered: the emphasised word is one text node that stretches on its spoken word and relaxes after it', () => {
  const stretch = [{sourceIndex: 1, kind: 'stretch'}];
  assert.deepEqual(textOfWord(draw(20, stretch), 'ببلاش'), [], 'not spoken yet');
  assert.deepEqual(textOfWord(draw(30, stretch), 'ببلاش'), ['ببلاش'], 'enters plain');
  const held = textOfWord(draw(60, stretch), 'ببلاش');
  assert.equal(held.length, 1, 'the word stays one text node');
  assert.equal(held[0], 'بب' + T.repeat(STRETCH_PEAK) + 'لاش');
  const grown = textOfWord(draw(34, stretch), 'ببلاش');
  assert.equal(grown.length, 1);
  assert.ok(count(grown[0]) > 0 && count(grown[0]) < STRETCH_PEAK, grown[0]);
  assert.deepEqual(textOfWord(draw(74 + 8 + 2, stretch), 'ببلاش'), ['ببلاش'], 'relaxed again');
});

test('rendered: other words are never touched and an unemphasised scene never carries a tatweel', () => {
  const stretch = [{sourceIndex: 1, kind: 'stretch'}];
  const html = draw(76, stretch);
  const nodes = textNodes(html);
  assert.ok(nodes.includes('فكرة') && nodes.includes('للجميع'));
  assert.equal(nodes.filter((n) => n.includes(T)).length, 1, 'one stretched word');
  for (const frame of [0, 30, 60, 100, 139]) assert.ok(!textNodes(draw(frame)).some((n) => n.includes(T)), `no tatweel without emphasis (frame ${frame})`);
});

test('rendered: a stretch on a Latin word changes nothing', () => {
  const latin = [{text: 'فكرة', sourceIndex: 0, segmentIndex: 0, fromFrame: 0, toFrame: 24, startMs: 0, endMs: 800, confidence: 1},
    {text: 'ChatGPT', sourceIndex: 1, segmentIndex: 0, fromFrame: 30, toFrame: 70, startMs: 1000, endMs: 2333, confidence: 1}];
  const scene = editSceneSchema.parse({id: 'w', family: 'kinetic-text', layout: 'takeover', motion: 'land', fromFrame: 0, durationInFrames: 120,
    data: {kicker: 'كلمات', title: 'عنوان', sourceIndices: [0, 1], lang: 'ar', enter: 'rise', emphasis: [{sourceIndex: 1, kind: 'stretch'}]}});
  const nodes = textNodes(renderer.renderScene({scene, style: 'section-deck', frame: 60, words: latin}));
  assert.ok(nodes.includes('ChatGPT'));
  assert.ok(!nodes.some((n) => n.includes(T)));
});

test('rendered: the stretched line still fits its box at the peak (room is reserved for the longest form)', () => {
  const stretch = [{sourceIndex: 1, kind: 'stretch'}];
  assert.doesNotThrow(() => draw(60, stretch));
  assert.doesNotThrow(() => draw(139, stretch));
});

// ---- the room follows the word -------------------------------------------------------------------------------
// Owner decision for V4: "the words move and close the gap". The room a stretching word takes in its line is its current width, so its
// neighbours glide apart while it grows and glide back as it relaxes. The line breaks are decided once, with the longest form.

const lineBundle = await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {SpokenLine} from './engine/src/creative-kit/kinetic-words';
  import {SafeRoot} from './engine/src/core/safe';
  export const line = (props, probe) => renderToStaticMarkup(probe
    ? React.createElement(SafeRoot, {probe}, React.createElement(SpokenLine, props))
    : React.createElement(SpokenLine, props));
`, {ssr: true});

const spoken = (sourceIndex, fromFrame, toFrame, text) => ({text, sourceIndex, segmentIndex: 0, fromFrame, toFrame, startMs: 0, endMs: 1, confidence: 1});
// The stretching word (ببلاش) and the word after it (يوم) enter together, so the neighbour is on screen for the whole stretch.
const LINE_WORDS = [spoken(0, 0, 20, 'كل'), spoken(1, 30, 70, 'ببلاش'), spoken(2, 30, 110, 'يوم')];
const lineProps = (over = {}) => ({words: LINE_WORDS, lang: 'ar', font: {fontFamily: 'Cairo', fontSize: 100, fontWeight: 800}, box: {left: 40, top: 700, width: 1000},
  color: '#fff', accent: '#f90', maxLines: 3, minSize: 40, align: 'start', untilFrame: 150, onOverflow: 'render', ...over});
const lineAt = (frame, props, probe) => { setSsrFrame(frame); return lineBundle.line(props, probe); };
const cssNumber = (style, key) => {
  const hit = style.match(new RegExp(`(?:^|;)${key}:(-?[\\d.]+)(?:px)?(?=;|$)`));
  return hit ? Number(hit[1]) : Number.NaN;
};
const placed = (html) => [...html.matchAll(/<span style="([^"]*)">([^<]*)<\/span>/g)].filter((hit) => hit[1].includes('transform-origin')).map((hit) => ({
  text: hit[2], plain: hit[2].replaceAll(T, ''), left: cssNumber(hit[1], 'left'), top: cssNumber(hit[1], 'top'), width: cssNumber(hit[1], 'width'), size: cssNumber(hit[1], 'font-size'),
}));
const pick = (html, plain) => placed(html).find((token) => token.plain === plain) ?? assert.fail(`${plain} is not drawn`);
/** The three words of the line (right to left: كل, ببلاش, يوم) and the visible gap between neighbours. */
const trio = (html) => {
  const a = pick(html, 'كل'), b = pick(html, 'ببلاش'), c = pick(html, 'يوم');
  return {a, b, c, ab: a.left - (b.left + b.width), bc: b.left - (c.left + c.width)};
};
const hashOf = (parts) => crypto.createHash('sha256').update(parts.join('\n--frame--\n')).digest('hex');
const LINE_FRAMES = [0, 12, 20, 30, 33, 36, 40, 60, 72, 76, 80, 100, 139];
const hashLine = (props, probe) => hashOf(LINE_FRAMES.map((frame) => lineAt(frame, props, probe)));
const ALIGNS = ['start', 'center'];
const STRETCH_B = [{sourceIndex: 1, kind: 'stretch'}];

test('a line without a stretch word renders exactly the markup it rendered before the room followed the word', () => {
  // Hashes taken from the code before the change; lines, marks, pops and weights are untouched.
  const expected = {
    start: {
      none: '361bafa619cf453401d52c147af89e992e74eba35149b7b4257cf8c937817f2a',
      underline: '07bf0a963af4b84026498da6d9056c44d9f43a5f7b57863b9f80b363b433a7b1',
      mixed: '9846b01a78347cd371c7040872ecc61771ca7ab993122dc7bd925658d296094c',
    },
    center: {
      none: '521605348fbe504279d9df1e4e9d0aab07a9a820be639545b3f33ed7a2cd3f15',
      underline: 'f20aba58d62921bf1dead3bf017b02efabe4731608cc3aee95fc4e3c1140148f',
      mixed: '5855c51aaf258f872a14b2760a4870cdf385e5a2486bbc5bd2fede4a2b61619d',
    },
  };
  for (const align of ALIGNS) {
    assert.equal(hashLine(lineProps({align})), expected[align].none, `${align}: plain line`);
    assert.equal(hashLine(lineProps({align, emphasis: [{sourceIndex: 1, kind: 'underline'}, {sourceIndex: 2, kind: 'accent'}]})), expected[align].underline, `${align}: underline`);
    assert.equal(hashLine(lineProps({align, emphasis: [{sourceIndex: 0, kind: 'pop'}, {sourceIndex: 1, kind: 'weight'}]})), expected[align].mixed, `${align}: pop and weight`);
  }
});

test('a stretch on a word that cannot stretch leaves the line exactly as it was', () => {
  const words = [spoken(0, 0, 20, 'كل'), spoken(1, 30, 70, 'AI'), spoken(2, 30, 110, 'يوم')];
  const plain = hashLine(lineProps({words}));
  assert.equal(plain, '860857033dae35300a43b90f0fc8034656fcb209a6894a7c0fdc42d034a6d4fc');
  assert.equal(hashLine(lineProps({words, emphasis: [{sourceIndex: 1, kind: 'stretch'}]})), plain);
});

// V4 section-deck moves centerFull from 900 to 1330 (styles/section-deck/format.ts).
// Its takeover safe width now crosses the platform rail. An in-memory geometry-only
// probe reproduced all eight original hashes; only the four takeover records change.
// See state/v4-gate-kinetic-geometry-evidence.json. Split and standalone lines remain pinned.
test('scenes without a stretch word keep the V4 takeover and historical split spoken-line markup', () => {
  const spokenMarkup = (html) => [
    ...(html.match(/<span style="[^"]*transform-origin:50% 60%">[^<]*<\/span>/g) ?? []),
    ...(html.match(/<svg width="1080" height="1920"[\s\S]*?<\/svg>/g) ?? []),
  ].join('\n');
  const sceneIn = (layout, emphasis) => editSceneSchema.parse({id: 'words', family: 'kinetic-text', layout, motion: 'land', fromFrame: 0, durationInFrames: 140,
    data: {kicker: 'كلمات', title: 'عنوان', sourceIndices: [0, 1, 2], lang: 'ar', enter: 'rise', ...(emphasis ? {emphasis} : {})}});
  const cases = {
    none: undefined,
    accent: [{sourceIndex: 1, kind: 'accent'}],
    underline: [{sourceIndex: 1, kind: 'underline'}, {sourceIndex: 2, kind: 'underline'}],
    mixed: [{sourceIndex: 0, kind: 'pop'}, {sourceIndex: 1, kind: 'weight'}, {sourceIndex: 2, kind: 'accent'}],
  };
  const expected = {
    'none/takeover': '15c93a6ceb5664e215eb8376c884ab74cb8c67029e034b731c7f06bf28c7cfc9',
    'none/split': '57aaffe96817c8a05e5387dc270304850ad75f780792384c609d8160e9d06744',
    'accent/takeover': 'd3bd0f060b5583b3abe930a8d0df242942b5a346acab91727ccc347def394559',
    'accent/split': 'e3310621dd98b30b44c6a1186a1b0ee838768d9eb665d10a7ff6c8a3981ed6de',
    'underline/takeover': '07cdd500a8b919e101ed3da637b4f8b2f68251e952cb0da88b98af6c0b34cb79',
    'underline/split': '16242e0e00df77333557e34208606c876f047ac001dc1f60a1eda37fb081e5a3',
    'mixed/takeover': '3182033093aa22d18e4b752d6ad466682bfe91e44794537e7f41295674818e4e',
    'mixed/split': '25322260bcb6e62f7cb59028fefcc550229b5de23b208e78884c50426964ea58',
  };
  for (const [name, emphasis] of Object.entries(cases)) {
    for (const layout of ['takeover', 'split']) {
      const parts = [0, 12, 31, 36, 40, 60, 77, 82, 100, 139].map((frame) => spokenMarkup(renderer.renderScene({scene: sceneIn(layout, emphasis), style: 'section-deck', frame, words: WORDS})));
      assert.equal(hashOf(parts), expected[`${name}/${layout}`], `${name}/${layout}`);
    }
  }
});

test('the safe-zone probe still sees the longest form of the word in the room it takes at its widest', () => {
  const stretch = lineProps({emphasis: STRETCH_B});
  // Hashes taken from the code before the change: the probe draws and lays out the longest form, as it always did.
  const expected = {
    start: ['40244a8a161afa1a8a9dd9f5ece247061b28cad1cec7fd9dbd346cec3ecdbd30', '269c271fb9b029df7733bfa613fa066453f9ef7abba252518a02615e0fb5b0d5'],
    center: ['c296ce8be386e8420939a22ef134fe5095415fcdd415076753c71573f7d5b346', '98c69d8b1453d848c290503594b5afe9e76d5e758d7e540ed0c263a107fcb664'],
  };
  for (const align of ALIGNS) {
    assert.equal(hashLine({...stretch, align}, '#00ff00'), expected[align][0], `${align}: probe markup is unchanged`);
    assert.equal(hashLine({...stretch, align, emphasis: [...STRETCH_B, {sourceIndex: 1, kind: 'underline'}]}, '#00ff00'), expected[align][1], `${align}: probe markup with an underline is unchanged`);
    const live = trio(lineAt(60, {...stretch, align}));
    for (const frame of [0, 33, 100]) {
      const probed = trio(lineAt(frame, {...stretch, align}, '#00ff00'));
      assert.equal(probed.b.text, stretchWord('ببلاش', STRETCH_PEAK), `${align}: the probe draws the longest form (frame ${frame})`);
      for (const key of ['a', 'b', 'c']) assert.deepEqual([probed[key].left, probed[key].top, probed[key].width], [live[key].left, live[key].top, live[key].width], `${align}: ${key} sits where it does at the peak`);
    }
  }
});

test('at rest the stretching word takes exactly its plain width: no loose gap before the stretch and none after it', () => {
  for (const align of ALIGNS) {
    const stretch = lineProps({align, emphasis: STRETCH_B});
    const plain = lineProps({align});
    // 20: only the first word is on screen; 30: the word has just entered, still plain; 90 and 139: relaxed again.
    for (const frame of [20, 30, 90, 139]) assert.equal(lineAt(frame, stretch), lineAt(frame, plain), `${align}: frame ${frame} is the plain line`);
    const rest = trio(lineAt(139, stretch));
    assert.ok(rest.ab > 0 && rest.bc > 0 && rest.ab < 60 && rest.bc < 60, `a normal word gap, not a reserved one (${rest.ab}, ${rest.bc})`);
  }
});

test('while it stretches the neighbours stay within half a tatweel of the normal gap', () => {
  for (const align of ALIGNS) {
    const stretch = lineProps({align, emphasis: STRETCH_B});
    const rest = trio(lineAt(139, stretch));
    const step = (pick(lineAt(60, stretch), 'ببلاش').width - rest.b.width) / STRETCH_PEAK;
    assert.ok(step > 20, `a tatweel is a real width (${step})`);
    for (let frame = 30; frame <= 90; frame++) {
      const now = trio(lineAt(frame, stretch));
      assert.ok(Math.abs(now.ab - rest.ab) <= step / 2 + 2, `${align}: the gap before the word at frame ${frame} is ${now.ab}, normal is ${rest.ab}`);
      assert.ok(Math.abs(now.bc - rest.bc) <= step / 2 + 2, `${align}: the gap after the word at frame ${frame} is ${now.bc}, normal is ${rest.bc}`);
    }
  }
});

test('the neighbours follow the continuous stretch, not the whole-tatweel steps', () => {
  for (const align of ALIGNS) {
    const stretch = lineProps({align, emphasis: STRETCH_B});
    const rest = trio(lineAt(139, stretch));
    const step = (pick(lineAt(60, stretch), 'ببلاش').width - rest.b.width) / STRETCH_PEAK;
    for (let frame = 30; frame <= 90; frame++) {
      const grown = step * stretchAmount(frame, 30, 70, 30);
      const now = trio(lineAt(frame, stretch));
      // The line is right-anchored ("start") or centred; either way the words after the stretching word are pushed outward by the room it gained.
      const [before, after] = align === 'start' ? [0, grown] : [grown / 2, grown / 2];
      assert.ok(Math.abs(now.a.left - (rest.a.left + before)) <= 2.5, `${align}: the word before it at frame ${frame}`);
      assert.ok(Math.abs(now.c.left - (rest.c.left - after)) <= 2.5, `${align}: the word after it at frame ${frame}`);
    }
  }
});

test('a centred line keeps the stretching word where it is; a right-anchored line grows it toward the end of the line', () => {
  const centred = lineProps({align: 'center', emphasis: STRETCH_B});
  const centreOf = (token) => token.left + token.width / 2;
  const restCentre = centreOf(pick(lineAt(139, centred), 'ببلاش'));
  for (let frame = 31; frame <= 90; frame++) {
    const now = trio(lineAt(frame, centred));
    assert.ok(Math.abs(centreOf(now.b) - restCentre) <= 2.5, `centre aligned: the word stays put at frame ${frame}`);
    assert.ok(Math.abs(centreOf(now.b) - (now.a.left + now.c.left + now.c.width) / 2) <= 2.5, `the word sits in the middle of its room at frame ${frame}`);
  }
  const anchored = lineProps({align: 'start', emphasis: STRETCH_B});
  const rest = trio(lineAt(139, anchored));
  for (let frame = 31; frame <= 90; frame++) {
    const now = trio(lineAt(frame, anchored));
    assert.equal(now.a.left, rest.a.left, `right-anchored: the earlier word does not move (frame ${frame})`);
    assert.ok(now.c.left <= rest.c.left, `right-anchored: later words only move toward the end of the line (frame ${frame})`);
  }
  const mid = trio(lineAt(50, anchored));
  assert.ok(mid.c.left < rest.c.left - 100, 'right-anchored: the word after it has been pushed away');
  const midCentred = trio(lineAt(50, centred));
  const restCentred = trio(lineAt(139, centred));
  assert.ok(midCentred.a.left > restCentred.a.left + 50 && midCentred.c.left < restCentred.c.left - 50, 'centred: both neighbours have been pushed apart');
});

test('the line breaks and the type size never change during the stretch', () => {
  const words = [spoken(0, 0, 20, 'كل'), spoken(1, 30, 70, 'ببلاش'), ...['يوم', 'وكمان', 'بكرة', 'جدا'].map((text, index) => spoken(index + 2, 30, 110, text))];
  for (const align of ALIGNS) {
    const props = lineProps({words, align, emphasis: STRETCH_B});
    const finalTokens = placed(lineAt(139, props));
    assert.equal(finalTokens.length, 6);
    assert.ok(new Set(finalTokens.map((token) => token.top)).size >= 2, 'the fixture really wraps onto more than one line');
    assert.equal(finalTokens[0].size, placed(lineAt(139, lineProps({words, align})))[0].size, `${align}: a word that may stretch does not shrink the whole sentence`);
    const finalLine = new Map(finalTokens.map((token) => [token.plain, token.top]));
    for (let frame = 30; frame <= 100; frame++) {
      for (const token of placed(lineAt(frame, props))) {
        assert.equal(token.top, finalLine.get(token.plain), `${align}: ${token.plain} stays on its line at frame ${frame}`);
        assert.equal(token.size, finalTokens[0].size, `${align}: the type size is fixed (frame ${frame})`);
      }
    }
  }
});

test('an underline on the stretching word follows the moving box', () => {
  const underlined = lineProps({emphasis: [...STRETCH_B, {sourceIndex: 1, kind: 'underline'}]});
  const gap = trio(lineAt(139, underlined)).ab;
  const widths = new Set();
  for (const frame of [33, 36, 40, 50, 60, 72, 76, 80, 100]) {
    const html = lineAt(frame, underlined);
    const numbers = html.match(/<path d="([^"]+)"/)[1].match(/-?\d+(?:\.\d+)?/g).map(Number);
    const startX = numbers[0], endX = numbers[numbers.length - 2];
    const now = trio(html);
    const right = now.a.left - gap, left = now.c.left + now.c.width + gap;
    const extra = (right - left) * 0.04;
    assert.ok(Math.abs(startX - (right + extra)) <= 2.5, `the underline starts at the right edge of the word's room (frame ${frame}: ${startX} vs ${right + extra})`);
    assert.ok(Math.abs(endX - (left - extra)) <= 2.5, `the underline ends at the left edge of the word's room (frame ${frame}: ${endX} vs ${left - extra})`);
    widths.add(Math.round(startX - endX));
  }
  assert.ok(widths.size > 3, 'the underline really changes length with the word');
  // The other words' underlines follow their words as well: the one under the word after it moves with it.
  const second = lineProps({emphasis: [...STRETCH_B, {sourceIndex: 2, kind: 'underline'}]});
  const xs = new Set([33, 60, 100].map((frame) => Math.round(Number(lineAt(frame, second).match(/<path d="M (-?\d+)/)[1]))));
  assert.equal(xs.size, 3, 'the underline of the word after the stretch moves with that word');
});

test('the drawn word is one joined string, centred in its room, that never pokes past the widest room', () => {
  for (const align of ALIGNS) {
    const stretch = lineProps({align, emphasis: STRETCH_B});
    const peak = pick(lineAt(60, stretch), 'ببلاش');
    for (let frame = 30; frame <= 90; frame++) {
      const word = pick(lineAt(frame, stretch), 'ببلاش');
      assert.equal(word.text.replaceAll(T, ''), 'ببلاش', `no letter is lost or split (frame ${frame})`);
      assert.ok(/^بب(ـ*)لاش$/.test(word.text), `the tatweels stay in one run inside the word (frame ${frame})`);
      assert.ok(word.left >= peak.left - 1 && word.left + word.width <= peak.left + peak.width + 1, `${align}: inside the widest room at frame ${frame}`);
    }
  }
});

test('stretchAmount is the continuous curve behind stretchCount: the same timing without the rounding', () => {
  for (const fps of [24, 30, 60]) {
    for (let frame = 0; frame < 6 * fps; frame++) {
      const amount = stretchAmount(frame, 10, 40, fps);
      assert.equal(stretchCount(frame, 10, 40, fps), Math.round(amount), `the count is the rounded amount (${fps} fps, frame ${frame})`);
      assert.ok(amount >= 0 && amount <= STRETCH_PEAK);
    }
  }
  const [fps, enter, end, rise, relax] = [30, 30, 90, 11, 8];
  assert.equal(stretchAmount(enter - 5, enter, end, fps), 0);
  assert.equal(stretchAmount(enter, enter, end, fps), 0);
  assert.equal(stretchAmount(enter + rise, enter, end, fps), STRETCH_PEAK);
  assert.equal(stretchAmount(end, enter, end, fps), STRETCH_PEAK);
  assert.equal(stretchAmount(end + relax, enter, end, fps), 0);
  assert.equal(stretchAmount(enter + 1, enter, end, fps, 2) > 0, true);
  assert.equal(stretchAmount(enter + 5, enter, end, fps, 0), 0, 'a peak of zero never stretches');
  // It has no step anywhere, not even between two frames: sampled every hundredth of a frame it never jumps.
  let last = stretchAmount(0, enter, end, fps);
  let fractions = 0;
  for (let i = 1; i <= 14000; i++) {
    const amount = stretchAmount(i / 100, enter, end, fps);
    assert.ok(Math.abs(amount - last) < 0.04, `a smooth curve at frame ${i / 100}: ${last} -> ${amount}`);
    if (amount % 1 > 0.05 && amount % 1 < 0.95) fractions += 1;
    last = amount;
  }
  assert.ok(fractions > 500, 'it spends its time between whole tatweels, not only on them');
});

test('stretchRoom: the measured width at a whole count and a straight line between counts', () => {
  const widths = [100, 128, 157, 185, 214, 242, 271];
  widths.forEach((width, count) => assert.equal(stretchRoom(widths, count), width, `count ${count}`));
  assert.equal(stretchRoom(widths, 2.5), (157 + 185) / 2);
  assert.equal(stretchRoom(widths, 0.25), 100 + 28 * 0.25);
  assert.equal(stretchRoom(widths, -3), 100, 'below zero is the plain word');
  assert.equal(stretchRoom(widths, 99), 271, 'above the peak is the widest form');
  assert.equal(stretchRoom(widths, Number.NaN), 100);
  assert.equal(stretchRoom([80], 3), 80, 'a word that cannot stretch has one width');
  let last = stretchRoom(widths, 0);
  for (let i = 1; i <= 600; i++) {
    const room = stretchRoom(widths, i / 100);
    assert.ok(room >= last && room - last < 0.5, `no step: a hundredth of a tatweel moves the room by a hair (${i / 100})`);
    last = room;
  }
});

test('stretchWidths measures the word with every count of tatweels and is flat when the word cannot stretch', () => {
  const widthOf = (form) => [...form].length * 10;
  assert.deepEqual(stretchWidths('ببلاش', widthOf), [50, 60, 70, 80, 90, 100, 110]);
  assert.deepEqual(stretchWidths('ببلاش', widthOf, 2), [50, 60, 70]);
  assert.equal(stretchWidths('ببلاش', widthOf).at(-1), widthOf(reservedText('ببلاش', ['stretch'])), 'the last form is the one the room used to be reserved for');
  assert.deepEqual(stretchWidths('AI', widthOf), [20, 20, 20, 20, 20, 20, 20]);
  const dips = stretchWidths('ببلاش', (form) => (form.length === 7 ? 55 : 50 + (form.length - 5) * 10));
  assert.deepEqual(dips, [50, 60, 60, 80, 90, 100, 110], 'a measure that dips never makes the room shrink');
});
