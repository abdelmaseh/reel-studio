import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameRenderer} from '../scripts/lib/ssr-frames.mjs';
import {editSceneSchema} from '../engine/src/prepared-edit/schema.ts';
import {toArabicIndic} from '../engine/src/core/digits.ts';
import {bundleEngine} from './helpers/engine-bundle.mjs';
import {ARABIC_KEYWORD, ARABIC_SCENES} from './fixtures/arabic-scenes.mjs';
import {strayDigitTokens, textNodes} from './helpers/markup.mjs';

const {finalValueTemplate} = await bundleEngine(`export {finalValueTemplate} from './engine/src/creative-kit/value-fit.ts';`);
const renderer = await createFrameRenderer();
const STYLES = ['section-deck', 'paper-collage', 'liquid-glass', 'kinetic-paper'];
const render = (input, style, options = {}) => renderer.renderScene({scene: editSceneSchema.parse(structuredClone(input)), style, frame: 200, ...options});

// Text keys whose values are file names, identifiers or choices are never digits to show.
const PROTECTED = new Set(['id', 'family', 'layout', 'motion', 'src', 'kind', 'fit', 'variant', 'display', 'handle', 'valueFit', 'suffix', 'lang', 'enter']);
const withArabicIndic = (value, key = '') => Array.isArray(value) ? value.map((item) => withArabicIndic(item, key))
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([name, item]) => [name, withArabicIndic(item, name)]))
    : typeof value === 'string' && !PROTECTED.has(key) ? toArabicIndic(value) : value;

test('under arabic-indic no Latin digit stays on screen in any family, in four styles', () => {
  for (const style of STYLES) {
    for (const input of ARABIC_SCENES) {
      const stray = strayDigitTokens(render(input, style, {digits: 'arabic-indic'}));
      assert.deepEqual(stray, [], `${style} ${input.id}: ${stray.join(' ')}`);
    }
  }
});

test('under latin no Arabic-Indic digit stays on screen, even when the words were written with them', () => {
  for (const style of STYLES) {
    for (const input of ARABIC_SCENES) {
      const written = {...input, data: withArabicIndic(input.data)};
      const stray = strayDigitTokens(render(written, style, {digits: 'latin'}), {pattern: /[٠-٩۰-۹]/});
      assert.deepEqual(stray, [], `${style} ${input.id}: ${stray.join(' ')}`);
    }
  }
});

test('with no choice the authored digits are drawn as written', () => {
  const intro = ARABIC_SCENES.find((item) => item.family === 'intro');
  assert.ok(textNodes(render(intro, 'section-deck')).includes('خطوة 1 من 3'));
  const written = {...intro, data: withArabicIndic(intro.data)};
  assert.ok(textNodes(render(written, 'section-deck')).includes('خطوة ١ من ٣'));
});

test('the comment keyword keeps its digits verbatim', () => {
  const keyword = 'خطة30';
  const comment = ARABIC_SCENES.find((item) => item.family === 'comment');
  const html = render({...comment, data: {...comment.data, keyword, promise: `أرسل ${keyword} الآن 5`}}, 'section-deck', {digits: 'arabic-indic'});
  const nodes = textNodes(html);
  assert.ok(nodes.includes(keyword), nodes.join(' | '));
  assert.ok(nodes.some((node) => node.includes(`${keyword} ·`) || node.includes('أرسل خطة30 الآن ٥')), 'the promise maps its own digits and keeps the keyword');
  const cta = ARABIC_SCENES.find((item) => item.family === 'creator-cta');
  const ctaNodes = textNodes(render({...cta, data: {...cta.data, keyword}}, 'section-deck', {digits: 'arabic-indic'})).join(' ');
  assert.ok(ctaNodes.includes(`اكتب ${keyword} وسأرسل لك ٣ نصائح`), ctaNodes);
  const stack = ARABIC_SCENES.find((item) => item.family === 'comment-stack');
  assert.ok(textNodes(render({...stack, data: {...stack.data, keyword}}, 'section-deck', {digits: 'arabic-indic'})).join(' ').includes(keyword));
});

test('the width template uses the widest glyph of the chosen set', () => {
  assert.equal(finalValueTemplate(12500, '%'), '88,888%');
  assert.equal(finalValueTemplate(12500, '%', null), '88,888%');
  assert.equal(finalValueTemplate(12500, '%', 'latin'), '88,888%');
  assert.equal(finalValueTemplate(12500, '%', 'arabic-indic'), '٨٨٬٨٨٨٪');
  assert.equal(finalValueTemplate(7, '+', 'arabic-indic'), '٨+');
});

test('recorded words drawn by the kinetic text scene follow the digits preference without changing the words', () => {
  const words = [{text: 'السعر', sourceIndex: 0, segmentIndex: 0, fromFrame: 0, toFrame: 8, startMs: 0, endMs: 250, confidence: 1},
    {text: '2024', sourceIndex: 1, segmentIndex: 0, fromFrame: 9, toFrame: 18, startMs: 300, endMs: 600, confidence: 1}];
  const scene = {id: 'words', family: 'kinetic-text', layout: 'takeover', motion: 'land', fromFrame: 0, durationInFrames: 120,
    data: {kicker: 'كلمات', title: 'عنوان', sourceIndices: [0, 1], lang: 'ar', enter: 'rise'}};
  const nodes = (digits) => textNodes(render(scene, 'section-deck', {words, ...(digits === undefined ? {} : {digits})})).join(' ');
  assert.ok(nodes('arabic-indic').includes('٢٠٢٤') && !nodes('arabic-indic').includes('2024'));
  assert.ok(nodes('latin').includes('2024'));
  assert.ok(nodes().includes('2024'), 'no choice: as recorded');
  assert.equal(words[1].text, '2024', 'the recorded word object is not changed');
});

test('the data story draws its animated numbers in Arabic-Indic digits only when asked', () => {
  const metric = ARABIC_SCENES.find((item) => item.family === 'data-story' && item.id === 'data-story');
  assert.ok(textNodes(render(metric, 'section-deck')).includes('42.50'));
  assert.ok(textNodes(render(metric, 'section-deck', {digits: 'latin'})).includes('42.50'));
  assert.ok(textNodes(render(metric, 'section-deck', {digits: 'arabic-indic'})).join(' ').includes('٤٢٫٥٠٪'));
});
