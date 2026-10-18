import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameRenderer} from '../scripts/lib/ssr-frames.mjs';
import {editSceneSchema} from '../engine/src/prepared-edit/schema.ts';
import {catalogDemo, conceptSettledFrame, CATALOG} from '../engine/src/motion-concepts/catalog.ts';
import {strayDigitTokens, textNodes} from './helpers/markup.mjs';

const renderer = await createFrameRenderer();
// The concepts that decide their digits from their copy (before 2.6) now read the video's choice first.
const DECIDING = ['button-to-window', 'brief-to-workspace', 'headline-to-system', 'prompt-to-results', 'kpi-zoom', 'automation-flow', 'system-layers', 'tool-stack-spread',
  'conditional-branching', 'identity-filtering'];
const entry = (id) => CATALOG.find((item) => item.id === id);
function render(id, {config = catalogDemo(id), digits, style = 'section-deck'} = {}) {
  const scene = editSceneSchema.parse({id: `concept-${id}`, family: 'motion-concept', layout: 'takeover', motion: 'land', fromFrame: 0,
    durationInFrames: entry(id).defaultFrames, data: {concept: id, config}});
  return renderer.renderScene({scene, style, frame: conceptSettledFrame(id, 'once', entry(id).defaultFrames), ...(digits === undefined ? {} : {digits})});
}
const arabicIndic = (html) => strayDigitTokens(html, {pattern: /[٠-٩]/});
const latin = (html) => textNodes(html).flatMap((node) => node.split(/\s+/)).filter((token) => /[0-9]/.test(token) && !/[A-Za-z]/.test(token));

test('with no choice the Arabic demos keep drawing Arabic-Indic digits, as before', () => {
  for (const id of DECIDING) {
    const html = render(id);
    assert.ok(arabicIndic(html).length > 0, `${id} draws Arabic-Indic digits`);
    assert.equal(html, render(id, {digits: null}), `${id}: a null choice changes nothing`);
  }
});

test('a Latin choice beats Arabic copy in every concept that decides its digits', () => {
  for (const id of DECIDING) {
    const html = render(id, {digits: 'latin'});
    assert.deepEqual(arabicIndic(html), [], `${id}: no Arabic-Indic digit is left`);
    assert.ok(latin(html).length > 0, `${id}: the same numbers are drawn in Latin digits`);
  }
});

test('an Arabic-Indic choice beats English copy', () => {
  const english = {
    'button-to-window': (config) => ({...config, ctaLabel: 'See the demo'}),
    'headline-to-system': (config) => ({...config, coreIdea: 'One idea becomes a week of content'}),
    'prompt-to-results': (config) => ({...config, prompt: 'Plan my weekly content for a coffee shop'}),
  };
  for (const [id, change] of Object.entries(english)) {
    const config = change(catalogDemo(id));
    assert.deepEqual(arabicIndic(render(id, {config})), [], `${id}: English copy draws Latin digits when nothing is chosen`);
    assert.ok(arabicIndic(render(id, {config, digits: 'arabic-indic'})).length > 0, `${id}: the choice wins`);
  }
});
