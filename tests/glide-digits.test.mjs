import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameRenderer} from '../scripts/lib/ssr-frames.mjs';
import {editSceneSchema} from '../engine/src/prepared-edit/schema.ts';
import {localizeGlideData} from '../engine/src/styles/grid-glide/scenes/digits.ts';
import {GLIDE_TEMPLATE_SCREEN} from '../engine/src/styles/grid-glide/scenes/templates.ts';
import {strayDigitTokens, textNodes} from './helpers/markup.mjs';

const renderer = await createFrameRenderer();
const cut = {kind: 'cut'};
const KEYWORD = 'خطة30';
const scene = (family, data) => ({id: family, family, layout: 'takeover', motion: 'land', fromFrame: 0, durationInFrames: 240, data});
const GLIDE = [
  scene('glide-chapter', {ordinal: 'الخطوة 1', heroAt: 0, pill: {label: 'أداتك 2'}, enter: cut, exit: cut}),
  scene('glide-card', {lines: [{words: ['ماذا', 'يفعل', '3'], role: 'lead', at: 6, cadence: 7}, {words: ['نتيجتك', '2024'], role: 'hero', at: 34, cadence: 7}],
    media: {clips: [{at: 0, ...GLIDE_TEMPLATE_SCREEN, kind: 'image'}]}, bullets: [{text: 'يفعل أول شيء 1', at: 60}], enter: cut, exit: cut}),
  scene('glide-lines', {lines: [{words: ['قلها', 'ببساطة', '10'], role: 'lead', at: 6, cadence: 7}, {words: ['نقطتك', '7'], role: 'hero', at: 36, cadence: 7}], grid: false, enter: cut, exit: cut}),
  scene('glide-comment', {lines: [{words: ['قل', 'الكلمة', '3'], role: 'lead', at: 6, cadence: 7}], keyword: KEYWORD, heroAt: 30, box: {text: 'ما ستحصل عليه 2024', at: 55}, enter: cut, exit: cut}),
  scene('glide-follow', {lines: [{words: ['تريد', 'المزيد', '9'], role: 'lead', at: 6, cadence: 7}], handle: '@your.handle', heroAt: 24, pill: {label: 'متابعة 1'}, enter: cut, exit: cut}),
];
const render = (input, options = {}) => renderer.renderScene({scene: editSceneSchema.parse(structuredClone(input)), style: 'grid-glide', frame: 200, ...options});
const nodes = (input, options) => textNodes(render(input, options));

test('the pure mapping touches every drawn text and nothing else', () => {
  const data = structuredClone(GLIDE[3].data);
  const before = structuredClone(data);
  const mapped = localizeGlideData(data, 'arabic-indic');
  assert.deepEqual(data, before, 'the authored data is not mutated');
  assert.deepEqual(mapped.lines[0].words, ['قل', 'الكلمة', '٣']);
  assert.equal(mapped.box.text, 'ما ستحصل عليه ٢٠٢٤');
  assert.equal(mapped.keyword, KEYWORD, 'the keyword is never mapped');
  assert.equal(mapped.lines[0].at, 6);
  const chapter = localizeGlideData(GLIDE[0].data, 'arabic-indic');
  assert.equal(chapter.ordinal, 'الخطوة ١');
  assert.equal(chapter.pill.label, 'أداتك ٢');
  assert.equal(localizeGlideData(GLIDE[1].data, 'arabic-indic').bullets[0].text, 'يفعل أول شيء ١');
  assert.equal(localizeGlideData(GLIDE[4].data, 'arabic-indic').handle, '@your.handle');
});

test('no choice returns the very same object, and an English line keeps its digits', () => {
  for (const item of GLIDE) {
    assert.equal(localizeGlideData(item.data, null), item.data);
    assert.equal(localizeGlideData(item.data, undefined), item.data);
  }
  const english = {lines: [{words: ['Top', '10', 'tools'], role: 'hero', at: 0, cadence: 7}], grid: false, enter: cut, exit: cut};
  assert.deepEqual(localizeGlideData(english, 'arabic-indic').lines[0].words, ['Top', '10', 'tools']);
  assert.deepEqual(localizeGlideData({lines: [{words: ['خطوة', '١٠'], role: 'hero', at: 0}]}, 'latin').lines[0].words, ['خطوة', '10']);
});

test('Grid Glide draws the chosen digits in every scene and keeps the keyword and the handle', () => {
  for (const item of GLIDE) {
    const stray = strayDigitTokens(render(item, {digits: 'arabic-indic'}), {allow: [KEYWORD]});
    assert.deepEqual(stray, [], `${item.id}: ${stray.join(' ')}`);
  }
  assert.ok(nodes(GLIDE[3], {digits: 'arabic-indic'}).includes(KEYWORD));
  assert.ok(nodes(GLIDE[4], {digits: 'arabic-indic'}).includes('@your.handle'));
  assert.ok(nodes(GLIDE[1], {digits: 'arabic-indic'}).includes('٢٠٢٤'));
});

test('with no choice, or a Latin choice, the scenes draw the digits as written', () => {
  for (const options of [{}, {digits: null}, {digits: 'latin'}]) {
    assert.ok(nodes(GLIDE[2], options).includes('10') && nodes(GLIDE[2], options).includes('7'), JSON.stringify(options));
  }
  for (const item of GLIDE) assert.equal(render(item), render(item, {digits: null}), `${item.id}: a null choice changes nothing`);
});
