import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bundleEngine, setSsrFrame} from './helpers/engine-bundle.mjs';
import {blurWindows, oneShotTimeline} from '../engine/src/styles/one-shot/scenes/math.ts';

const demo = JSON.parse(readFileSync(new URL('../instructions/examples/one-shot-demo.json', import.meta.url), 'utf8')).scenes[0];

const mod = await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {OneShotSceneView} from './engine/src/styles/one-shot/scenes/scene';
  import {SafeRoot} from './engine/src/core/safe';
  export const render = (scene) => renderToStaticMarkup(React.createElement(OneShotSceneView, {scene}));
  import {DigitsProvider} from './engine/src/creative-kit/digits';
  export const renderProbe = (scene) => renderToStaticMarkup(React.createElement(SafeRoot, {probe: '#00FF00'}, React.createElement(OneShotSceneView, {scene})));
  export const renderDigits = (scene, digits) => renderToStaticMarkup(React.createElement(DigitsProvider, {digits}, React.createElement(OneShotSceneView, {scene})));
`, {ssr: true});

const at = (seconds, scene = demo) => { setSsrFrame(Math.round(seconds * 30)); return mod.render(scene); };
const tl = oneShotTimeline(demo.data);
// CameraMotionBlur needs the full Remotion timeline context, which this Node markup helper does not have; the preview and the render draw those frames for real.
const blurred = (timeline, t) => blurWindows(timeline).some(([a, b]) => t >= a && t <= b);

test('the first and the last frame are the same home page, so the take loops', () => {
  const first = at(0);
  assert.equal(first, at(tl.total - 1 / 30));
  assert.equal(first, at(tl.closing.holdFrom + 0.1));
  assert.match(first, /نتيجة جاهزة/);
  assert.match(first, /يلا نبدأ/);
});

test('every half second of the take renders without throwing and shows the step it belongs to', () => {
  for (let t = 0; t < tl.total; t += 0.5) {
    if (blurred(tl, t)) continue;
    const html = at(t);
    assert.ok(html.length > 500, `t=${t}`);
    assert.doesNotMatch(html, /NaN|undefined|Infinity/, `t=${t}`);
  }
  assert.match(at(3.6), /حطّ/);
  assert.match(at(7.6), /الطلب/);
  assert.match(at(12.0), /استنى/);
  assert.match(at(tl.blocks.at(-1).hero + 0.3), /نتيجة/);
});

test('the dropped file travels: a chip, then a token inside the typed sentence, then the header of the job card', () => {
  assert.match(at(4.0), /file\.mp4/);
  assert.match(at(8.6), /file\.mp4/);
  assert.match(at(12.5), /file\.mp4/);
  assert.match(at(8.6), /الملف/);
});

test('the closing desk shows the closing line, the platforms and the home page on the phone', () => {
  const html = at(tl.closing.swipe[1] + 0.1);
  assert.match(html, /خطوات/);
  assert.match(html, />بس</);
  for (const platform of ['Instagram', 'TikTok', 'Shorts']) assert.match(html, new RegExp(platform));
  assert.match(html, /نتيجة جاهزة/, 'the phone swipes to the home page');
});

test('the safe-zone probe draws a still layout: no shadows, no cursor and no zoom camera', () => {
  for (const t of [1.9, 5.0, 9.8, 14.8, 16.2, 18.8]) {
    setSsrFrame(Math.round(t * 30));
    const html = mod.renderProbe(demo);
    assert.doesNotMatch(html, /box-shadow|drop-shadow/, `shadow at t=${t}`);
    assert.doesNotMatch(html, /M1 1 L1 38/, `cursor at t=${t}`);
    assert.doesNotMatch(html, /translate\(540px, [\d.]+px\) scale/, `zoom camera at t=${t}`);
  }
});

test('a chain with a toggle, a number and a reel without a work step draws every world', () => {
  const scene = {
    ...demo,
    data: {
      ...demo.data,
      steps: [
        {kind: 'field', title: {top: 'اكتب الطلب', bottom: 'بكلام بسيط'}, text: 'حوّل الملف', placeholder: 'اكتب رسالتك…'},
        {kind: 'toggle', title: {top: 'اختار الإعداد', bottom: 'اللي يناسبك'}, options: [{label: 'الخيار الأول', on: true}, {label: 'الخيار التاني', on: false}]},
        {kind: 'stat', title: {top: 'شوف الرقم', bottom: 'الحقيقي'}, value: 12.5, decimals: 1, unit: 'ثانية', label: 'اتوفرت من الفيديو'},
      ],
    },
  };
  const timeline = oneShotTimeline(scene.data);
  const long = {...scene, durationInFrames: Math.ceil(timeline.total * 30)};
  assert.equal(timeline.blocks.map((block) => block.kind).join(), 'ask,toggle,stat,finale');
  for (let t = 0; t < timeline.total; t += 0.5) {
    if (blurred(timeline, t)) continue;
    assert.doesNotMatch(at(t, long), /NaN|undefined|Infinity/, `t=${t}`);
  }
  const [, toggle, stat] = timeline.blocks;
  assert.match(at(toggle.presses[0] + 0.6, long), /الخيار الأول/);
  assert.match(at(stat.count[1] + 0.2, long), /١٢٫٥/);
});

test('the video digits choice reaches the step numbers and the copy; without a choice the style keeps its Arabic-Indic numbering', () => {
  setSsrFrame(0);
  const unset = mod.render(demo);
  assert.match(unset, /في ٣ خطوات/);
  assert.match(unset, />١</);
  assert.equal(mod.renderDigits(demo, null), unset, 'an empty choice changes nothing');
  const latin = mod.renderDigits(demo, 'latin');
  assert.match(latin, /في 3 خطوات/);
  assert.match(latin, />1</);
  assert.doesNotMatch(latin, /[٠-٩]/, 'no Arabic-Indic digit is left on the home page');
  assert.equal(mod.renderDigits(demo, 'arabic-indic'), unset, 'the style already writes Arabic-Indic');
  setSsrFrame(Math.round(12.0 * 30));
  const work = mod.renderDigits(demo, 'latin');
  assert.match(work, /\d+%/, 'the progress percent follows the choice');
  assert.doesNotMatch(work, /٪/);
});
