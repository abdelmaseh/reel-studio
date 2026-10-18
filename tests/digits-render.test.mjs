import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameRenderer} from '../scripts/lib/ssr-frames.mjs';
import {editSceneSchema} from '../engine/src/prepared-edit/schema.ts';
import {ARABIC_SCENES} from './fixtures/arabic-scenes.mjs';
import {textNodes} from './helpers/markup.mjs';

const renderer = await createFrameRenderer();
const STYLES = ['section-deck', 'paper-collage', 'liquid-glass'];
const parsed = (input) => editSceneSchema.parse(structuredClone(input));
const render = (input, style, options = {}) => renderer.renderScene({scene: parsed(input), style, frame: 200, ...options});
const fixture = (family, id = family) => ARABIC_SCENES.find((item) => item.family === family && item.id === id);

test('every Arabic fixture scene is a valid edit scene', () => {
  assert.ok(ARABIC_SCENES.length >= 21);
  for (const input of ARABIC_SCENES) assert.equal(editSceneSchema.safeParse(input).success, true, `${input.id} parses`);
});

test('a null digits provider changes no markup: unset digits render exactly as before', () => {
  for (const style of STYLES) {
    for (const input of ARABIC_SCENES) {
      assert.equal(render(input, style, {digits: null}), render(input, style), `${style} ${input.id}`);
    }
  }
});

test('FitText maps authored digits to the chosen set and leaves an unset preference alone', () => {
  const intro = fixture('intro');
  const nodes = (options) => textNodes(render(intro, 'section-deck', options));
  assert.ok(nodes({}).includes('خطوة 1 من 3'));
  assert.ok(nodes({digits: null}).includes('خطوة 1 من 3'));
  assert.ok(nodes({digits: 'latin'}).includes('خطوة 1 من 3'));
  const arabicIndic = nodes({digits: 'arabic-indic'});
  assert.ok(arabicIndic.includes('خطوة ١ من ٣'), arabicIndic.join(' | '));
  assert.ok(arabicIndic.includes('اشرح فكرتك في ٣ جمل'));
  assert.equal(arabicIndic.some((node) => /[0-9]/.test(node) && !node.includes('2024')), false, 'only the caption is not drawn by the scene');
});

test('digits written as Arabic-Indic become Latin under latin and an English line keeps its digits', () => {
  const written = {...fixture('intro'), data: {kicker: 'خطوة ١ من ٣', title: 'فكرة واضحة', subtitle: 'اشرح فكرتك في ٣ جمل', caption: 'تعليق'}};
  assert.ok(textNodes(render(written, 'section-deck', {digits: 'latin'})).includes('خطوة 1 من 3'));
  const english = {...fixture('intro'), data: {kicker: 'STEP 1', title: 'Top 10 tools', subtitle: 'Seven tips for 2024', caption: 'Caption 5'}};
  const nodes = textNodes(render(english, 'section-deck', {digits: 'arabic-indic'}));
  assert.ok(nodes.includes('STEP 1') && nodes.includes('Seven tips for 2024'), nodes.join(' | '));
  assert.ok(nodes.some((node) => node.includes('Top 10')), 'an English heading keeps its digits');
});

test('numbers the scene builds are mapped through the same text path', () => {
  const nodes = textNodes(render(fixture('proof'), 'section-deck', {digits: 'arabic-indic'}));
  assert.ok(nodes.includes('١٢٬٥٠٠٪'), nodes.join(' | '));
  assert.ok(textNodes(render(fixture('proof'), 'section-deck')).includes('12,500%'));
  assert.ok(textNodes(render(fixture('proof'), 'section-deck', {digits: 'latin'})).includes('12,500%'));
});
