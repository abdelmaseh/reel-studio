import test from 'node:test';
import assert from 'node:assert/strict';
import {bundleEngine, setSsrFps, setSsrFrame} from './helpers/engine-bundle.mjs';
import {perLetterLint} from '../engine/src/arabic/lint.ts';
import {layeredTemplate} from '../engine/src/styles/layered-speaker/scenes/templates.ts';
import {DEFAULT_HEAD, SIDE} from '../engine/src/styles/layered-speaker/scenes/math.ts';
import {textNodes} from './helpers/markup.mjs';

const harness = `
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {LayeredSceneView} from './engine/src/styles/layered-speaker/scenes/scene';
import {SafeRoot} from './engine/src/core/safe';
import {layeredSceneSchema} from './engine/src/styles/layered-speaker/scenes/schema';
import {DigitsProvider} from './engine/src/creative-kit/digits';
export const drawDigits = (scene, digits, extra = {}) => renderToStaticMarkup(React.createElement(SafeRoot, {}, React.createElement(DigitsProvider, {digits},
  React.createElement(LayeredSceneView, {scene: layeredSceneSchema.parse(scene), style: 'layered-speaker', ...extra}))));
export const draw = (scene, extra = {}, probe) => renderToStaticMarkup(React.createElement(SafeRoot, probe ? {probe} : {},
  React.createElement(LayeredSceneView, {scene: layeredSceneSchema.parse(scene), style: 'layered-speaker', ...extra})));
`;

const geometry = {windowTop: 0, windowHeight: 1920, videoWidth: 1080, videoLeft: 0, videoTop: 0};
const matte = {src: '_prepared/x/matte-0123456789abcdef.webm', sourceSha256: 'a'.repeat(64), sourceFromFrame: 0, frames: 200, trimBeforeFrame: 30};
const scene = (change = (d) => d) => ({id: 'key-word', family: 'layered-speaker', fromFrame: 0, durationInFrames: 120, layout: 'presenter', motion: 'land', data: change(structuredClone(layeredTemplate))});
const withMatte = (d) => ({...d, foreground: matte});

const position = (html, attr) => {
  const out = [];
  for (const match of html.matchAll(new RegExp(`<div data-layered-word="${attr}" style="([^"]*)"`, 'g'))) {
    const style = match[1];
    const px = (name) => Number(new RegExp(`${name}:(-?[\\d.]+)px`).exec(style)[1]);
    out.push({left: px('left'), top: px('top'), width: px('width'), height: px('height')});
  }
  return out;
};

test('the three layers are drawn in order: the big word, then the speaker, then the words around the head', async () => {
  const {draw} = await bundleEngine(harness, {ssr: true, plateStub: true});
  setSsrFps(30);
  setSsrFrame(100);
  const html = draw(scene(withMatte), {geometry, aspect: 16 / 9, headBox: DEFAULT_HEAD});
  const hero = html.indexOf('data-layered-hero="behind"');
  const video = html.indexOf('data-footage="_prepared/x/matte-0123456789abcdef.webm"');
  const right = html.indexOf('data-layered-word="right"');
  const left = html.indexOf('data-layered-word="left"');
  assert.ok(hero >= 0 && video > hero, 'the speaker is drawn above the big word');
  assert.ok(right > video && left > video, 'the words beside the head are drawn above the speaker');
  assert.match(html, /data-start-from-sec="1"/, 'the matte starts at its trim (30 frames = 1 s)');
  assert.match(html, /data-muted="true"/, 'the matte never carries sound');
});

test('without a matte there is no speaker layer and the big word moves above the head', async () => {
  const {draw} = await bundleEngine(harness, {ssr: true, plateStub: true});
  setSsrFrame(100);
  const html = draw(scene(), {geometry, aspect: 16 / 9, headBox: DEFAULT_HEAD});
  assert.match(html, /data-layered-hero="above"/);
  assert.doesNotMatch(html, /<video/);
  const noGeometry = draw(scene(withMatte), {headBox: DEFAULT_HEAD});
  assert.doesNotMatch(noGeometry, /<video/, 'a matte needs the geometry of the speaker picture to line up');
  assert.match(noGeometry, /data-layered-hero="behind"/);
});

test('Arabic stays joined: words are whole text nodes and the big word is one labelled canvas', async () => {
  const {draw} = await bundleEngine(harness, {ssr: true, plateStub: true});
  setSsrFrame(100);
  const html = draw(scene(withMatte), {geometry, aspect: 16 / 9, headBox: DEFAULT_HEAD});
  assert.deepEqual(perLetterLint(html), []);
  const texts = textNodes(html);
  // A phrase may wrap onto several lines, but every Arabic word stays one piece of text, never split into letters.
  for (const word of layeredTemplate.words.filter((w) => w.place !== 'behind')) {
    assert.ok(texts.join(' ').includes(word.text), `${word.text} reads in order`);
    for (const token of word.text.split(' ')) assert.ok(texts.some((text) => text.split(/[ \n]+/).includes(token)), `${token} is whole`);
  }
  assert.match(html, /<canvas[^>]*aria-label="الفرق"/, 'the big word is one canvas that carries the whole word');
  assert.doesNotMatch(html, /letter-spacing:(?!0px)/, 'no letter spacing on Arabic');
});

test('words beside the head keep clear of the head box and inside the safe area', async () => {
  const {draw} = await bundleEngine(harness, {ssr: true, plateStub: true});
  setSsrFrame(100);
  for (const head of [DEFAULT_HEAD, {x: 330, y: 560, width: 340, height: 400}, {x: 400, y: 480, width: 300, height: 420}]) {
    const html = draw(scene(withMatte), {geometry, aspect: 16 / 9, headBox: head});
    for (const place of ['left', 'right']) {
      const [box] = position(html, place);
      assert.ok(box, place);
      const clear = box.left + box.width <= head.x || box.left >= head.x + head.width || box.top + box.height <= head.y || box.top >= head.y + head.height;
      assert.ok(clear, `${place} word clears ${JSON.stringify(head)}: ${JSON.stringify(box)}`);
      assert.ok(box.left >= 65 && box.left + box.width <= 1015 && box.top >= 250 && box.top + box.height <= 1100, `${place} inside the safe area`);
    }
  }
});

test('a word with no room beside the head stops the render and names the word', async () => {
  const {draw} = await bundleEngine(harness, {ssr: true, plateStub: true});
  setSsrFrame(100);
  assert.throws(() => draw(scene(withMatte), {geometry, aspect: 16 / 9, headBox: {x: 120, y: 520, width: 840, height: 440}}),
    new RegExp(`no room for the (right|left) word.*under ${SIDE.minWidth}px`));
});

test('hand-drawn marks stay hidden until their frame, then draw on and finish', async () => {
  const {draw} = await bundleEngine(harness, {ssr: true, plateStub: true});
  setSsrFps(30);
  const html = (frame) => { setSsrFrame(frame); return draw(scene(withMatte), {geometry, aspect: 16 / 9, headBox: DEFAULT_HEAD}); };
  assert.doesNotMatch(html(30), /<path/, 'the circle on the right word starts at frame 42');
  const early = html(44);
  assert.match(early, /<path/);
  assert.ok(Number((/stroke-dashoffset="([-\d.]+)"/.exec(early) ?? [])[1]) > 0, 'still drawing');
  const done = html(42 + 15 + 1);
  assert.match(done, /stroke-dashoffset="0"/, 'fully drawn after its 0.5 s');
  assert.match(done, /stroke="#FFD23F"/, 'in the marker colour');
});

test('words rise in on their frame and the whole scene fades out in its last 0.2 s', async () => {
  const {draw} = await bundleEngine(harness, {ssr: true, plateStub: true});
  setSsrFps(30);
  const opacities = (frame) => { setSsrFrame(frame); return [...draw(scene(withMatte), {geometry, aspect: 16 / 9, headBox: DEFAULT_HEAD}).matchAll(/position:absolute;left:0px;top:0px;width:1080px;height:1920px;opacity:([\d.]+)/g)].map((m) => Number(m[1])); };
  assert.ok(opacities(60).every((value) => value === 1), 'fully visible in the middle of the scene');
  assert.ok(opacities(118).every((value) => value > 0 && value < 1), 'fading near the end');
  assert.ok(opacities(119).every((value) => value < opacities(118)[0]));
});

test('under the safe-zone probe the words are measured in full', async () => {
  const {draw} = await bundleEngine(harness, {ssr: true, plateStub: true});
  setSsrFps(30);
  setSsrFrame(0);
  const html = draw(scene(withMatte), {geometry, aspect: 16 / 9, headBox: DEFAULT_HEAD}, '#ff00ff');
  assert.match(html, /data-layered-word="right"/, 'the content words are painted');
  assert.match(html, /opacity:1[;"]/);
  assert.match(html, /<path/, 'and the marks are drawn in full');
});

test('digits in the words around the head follow the digits choice', async () => {
  const {draw, drawDigits} = await bundleEngine(harness, {ssr: true, plateStub: true});
  setSsrFps(30);
  setSsrFrame(100);
  const numbered = scene((d) => { d.words[1].text = 'خطوة 3'; d.words[1].mark = undefined; return d; });
  const latin = textNodes(draw(numbered, {geometry, aspect: 16 / 9, headBox: DEFAULT_HEAD})).join(' ');
  assert.match(latin, /خطوة 3/, 'no choice: the digit stays as written');
  const indic = textNodes(drawDigits(numbered, 'arabic-indic', {geometry, aspect: 16 / 9, headBox: DEFAULT_HEAD})).join(' ');
  assert.match(indic, /خطوة ٣/);
  assert.doesNotMatch(indic, /[0-9]/);
});
