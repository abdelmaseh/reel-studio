import test from 'node:test';
import assert from 'node:assert/strict';
import {IN, OUT} from '../engine/src/styles/grid-glide/scenes/math.ts';
import {ssrBundle, setFrame, css, leaves, wordMotion, rectOf, translateNumbers} from './helpers/glide-scene-ssr.mjs';

const renderer = await ssrBundle(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {SafeRoot} from './engine/src/core/safe';
  import {StyleSceneRenderer} from './engine/src/styles/scene-renderers';
  export const render = (scene, style) => renderToStaticMarkup(
    React.createElement(SafeRoot, {}, React.createElement(StyleSceneRenderer, {scene, style})));
`);
const draw = (scene, frame, style = 'grid-glide', fps = 30) => { setFrame(frame, {duration: scene.durationInFrames, fps}); return renderer.render(scene, style); };

const cut = {kind: 'cut'};
const clip = (name, kind, at, extra = {}) => ({at, src: `projects/example/${name}`, sha256: 'a'.repeat(64), width: 1600, height: 900, kind, ...extra});
const scene = (family, data, extra = {}) => ({id: 'glide-1', family, fromFrame: 0, durationInFrames: 240, layout: 'takeover', motion: 'quiet', data, ...extra});
const chapter = (data = {}) => scene('glide-chapter', {ordinal: 'First Tool', heroAt: 1, pill: {label: 'Example tool'}, enter: cut, exit: {kind: 'push', dir: 'right'}, watermark: 'example-mark', ...data}, {durationInFrames: 60});
const englishCard = (data = {}) => scene('glide-card', {
  lines: [{words: ['one', 'two', 'three'], role: 'lead', at: 2, cadence: 6.5}, {words: ['hero', 'words'], role: 'hero', at: 22, cadence: 7}],
  media: {clips: [clip('a.png', 'image', 0), clip('b.mp4', 'video', 60), clip('c.png', 'image', 120)]},
  bullets: [{text: 'open the project', at: 90}, {text: 'then the second', at: 125}],
  enter: {kind: 'slide', from: 'left', distance: 400}, exit: {kind: 'push', dir: 'down'}, watermark: 'example-mark', ...data,
}, {durationInFrames: 210});
const arabicCard = (data = {}) => scene('glide-card', {
  lines: [{words: ['اشرح', 'الفكرة', 'ببساطة'], role: 'lead', at: 2, cadence: 6.5}],
  box: {text: 'خطوة واحدة واضحة', at: 60},
  media: {clips: [clip('a.png', 'image', 0)]},
  bullets: [{text: 'افتح المشروع الآن', at: 120}, {text: 'ثم اختر الخطوة الثانية', at: 150}],
  enter: cut, exit: cut, ...data,
});
const englishLines = (data = {}) => scene('glide-lines', {
  lines: [{words: ['one', 'clear', 'idea'], role: 'lead', at: 0}, {words: ['simple', 'steps'], role: 'hero', at: 21}, {words: ['today'], role: 'lead', at: 48}],
  box: {text: 'one clear idea', at: 70}, grid: true, enter: cut, exit: cut, watermark: 'example-mark', ...data,
}, {durationInFrames: 150});
const arabicLines = () => scene('glide-lines', {
  lines: [{words: ['فكرة', 'واحدة', 'واضحة'], role: 'lead', at: 0}, {words: ['خطوات', 'بسيطة'], role: 'hero', at: 21}],
  enter: cut, exit: cut,
});

const ARABIC = /[\u0600-\u06FF]/;
const RTL_WIPE = /clip-path:\s*inset\(0(?:px)? 0(?:px)? 0(?:px)? [\d.]+%\)/;
const LTR_WIPE = /clip-path:\s*inset\(0(?:px)? [\d.]+% 0(?:px)? 0(?:px)?\)/;
const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`);
const noArabicTracking = (html) => {
  for (const leaf of leaves(html).filter((item) => ARABIC.test(item.text))) assert.ok(!/letter-spacing/.test(leaf.style), `Arabic text must not be letter-spaced: ${leaf.text}`);
};

test('the chapter ordinal follows the entrance law at its key frames', () => {
  const input = chapter();
  const at = (frame, text) => wordMotion(draw(input, frame), text);
  assert.equal(at(1, 'First').opacity, 0, 'the start frame shows nothing');
  const first = at(2, 'First');
  assert.equal(first.found, true);
  near(first.opacity, OUT(1 / 30), 1e-3, 'first visible opacity');
  near(first.y, 98.3, 0.3, 'first visible rise of a 130 px stack');
  assert.equal(at(8, 'Tool').opacity, 0, 'the second word starts 7 frames after the first');
  near(at(9, 'Tool').y, 98.3, 0.3, 'second word first visible rise');
  const settled = at(40, 'First');
  near(settled.opacity, 1, 1e-6, 'settled opacity');
  near(settled.y, 0, 1e-6, 'settled rise');
  const html = draw(input, 40);
  assert.ok(html.includes('data-glide-scene="glide-chapter"'));
  assert.ok(html.toLowerCase().includes('example tool'), 'the tool name is a pill');
  assert.ok(html.includes('example-mark'), 'the watermark is drawn');
  assert.ok(!html.includes('direction:rtl'));
  assert.ok(!draw(chapter({pill: undefined}), 40).toLowerCase().includes('example tool'));
});

test('an Arabic ordinal is one right-to-left word with no letter spacing', () => {
  const html = draw(chapter({ordinal: 'الأول'}), 12);
  assert.ok(leaves(html).some((leaf) => leaf.text === 'الأول'), 'the word is not split into characters');
  assert.ok(html.includes('direction:rtl'));
  noArabicTracking(html);
});

test('a card scene lays out the wide card, cuts between clips and slides in and out', () => {
  const input = englishCard();
  assert.deepEqual(rectOf(draw(input, 100), 'border-radius:24px'), {left: 127, top: 509, width: 827, height: 473});
  const before = draw(input, 59), after = draw(input, 60), later = draw(input, 120);
  assert.ok(before.includes('example/a.png') && !before.includes('example/b.mp4'), 'the first clip is shown before the cut');
  assert.ok(after.includes('example/b.mp4') && !after.includes('example/a.png'), 'the video replaces it on its frame, by a hard cut');
  assert.ok(later.includes('example/c.png'));
  assert.ok(translateNumbers(draw(input, 0)).some((n) => Math.abs(n + 400) < 1e-6), 'a slide from the left starts 400 px to the left');
  assert.ok(!translateNumbers(draw(input, 40)).some((n) => Math.abs(n) === 400), 'the slide has settled');
  const exitOffset = 200 * IN(14 / 15);
  assert.ok(translateNumbers(draw(input, 209)).some((n) => Math.abs(Math.abs(n) - exitOffset) < 0.01), `a downward push is ${exitOffset.toFixed(2)} px on its last frame`);
  near(wordMotion(draw(input, 3), 'one').y, 60.5, 0.3, 'caption lines rise 80 px');
  const bullet = wordMotion(draw(input, 91), 'open');
  near(bullet.opacity, OUT(1 / 30), 1e-3, 'bullet word opacity');
  near(bullet.x, 72.6, 0.5, 'a left-to-right bullet word slides in from the right by 1.5 x its size');
  assert.equal(bullet.y, 0, 'bullet words never move vertically');
  assert.ok(draw(input, 100).includes('left:164px'), 'the sparkle of a left-to-right bullet is centred at x 200');
});

test('an Arabic card mirrors its bullets and wipes the box from the right', () => {
  const input = arabicCard();
  const html = draw(input, 121);
  const bullet = wordMotion(html, 'افتح');
  near(bullet.x, -72.6, 0.5, 'a right-to-left bullet word slides in from the left');
  assert.ok(html.includes('left:754px'), 'the star is centred at x 790');
  assert.match(draw(input, 70), RTL_WIPE);
  assert.ok(html.includes('direction:rtl'));
  noArabicTracking(html);
  const rect = rectOf(html, 'border-radius:24px');
  assert.deepEqual(rect, {left: 127, top: 379, width: 827, height: 473});
});

test('a tall stack narrows the card so its right edge clears the action rail', () => {
  const four = [
    {words: ['one', 'two', 'three'], role: 'lead', at: 2}, {words: ['hero', 'words'], role: 'hero', at: 22},
    {words: ['more', 'words', 'here'], role: 'lead', at: 40}, {words: ['and', 'some', 'more'], role: 'lead', at: 55},
  ];
  const rect = rectOf(draw(englishCard({lines: four, bullets: [{text: 'a b', at: 90}]}), 120), 'border-radius:24px');
  assert.deepEqual(rect, {left: 127, top: 691, width: 726, height: 416});
  assert.equal(rect.left + rect.width, 853);
  assert.throws(() => draw(englishCard({lines: four, bullets: [{text: 'a', at: 90}, {text: 'b', at: 120}, {text: 'c', at: 150}]}), 120), /glide-1: the stack needs 1495px/);
});

test('a lines scene draws the optional grid, a left-to-right box wipe and the stack rise', () => {
  const input = englishLines();
  const html = draw(input, 80);
  assert.ok(html.includes('data-glide-scene="glide-lines"'));
  assert.ok(html.includes('<svg'), 'the hook grid is present');
  assert.ok(!draw(englishLines({grid: false}), 80).includes('<svg'));
  assert.match(html, LTR_WIPE);
  assert.ok(html.includes('example-mark'));
  near(wordMotion(draw(input, 22), 'simple').y, 98.3, 0.3, 'hero lines use the 130 px stack rise');
});

test('an Arabic lines scene is right-to-left and never letter-spaced', () => {
  const html = draw(arabicLines(), 30);
  assert.ok(html.includes('direction:rtl'));
  assert.ok(leaves(html).some((leaf) => leaf.text === 'فكرة'));
  noArabicTracking(html);
});

test('the renderers follow the edit frame rate: the same motion lasts twice as many frames at 60 fps', () => {
  // A chapter authored for 60 fps: 120 frames, the hero on frame 2, a push over the last 30 frames.
  const input = {...chapter({heroAt: 2}), durationInFrames: 120};
  const at = (frame, text) => wordMotion(draw(input, frame, 'grid-glide', 60), text);
  assert.equal(at(2, 'First').opacity, 0, 'the start frame shows nothing');
  near(at(4, 'First').opacity, OUT(1 / 30), 1e-3, 'frame 2 after the start at 60 fps looks like frame 1 at 30 fps');
  near(at(4, 'First').y, 98.3, 0.3, 'the same first rise');
  assert.equal(at(16, 'Tool').opacity, 0, 'the second word starts 14 frames after the first, not 7');
  assert.ok(at(17, 'Tool').opacity > 0);
  assert.ok(at(61, 'First').opacity < 1 && at(62, 'First').opacity === 1, 'a word settles 60 frames after its start');
  // The default pill starts 29.5 frames after the hero word and fades in 5 frames later.
  const pillOpacity = (frame) => Number(css(/style="([^"]*border-radius:26px[^"]*)"/.exec(draw(input, frame, 'grid-glide', 60))?.[1], 'opacity'));
  assert.equal(pillOpacity(36), 0);
  assert.ok(pillOpacity(38) > 0);
  // The push moves over the last 30 frames: frame 118 is frame 14 of a 15-frame push at 30 fps.
  const pushed = 400 * IN(28 / 30);
  assert.ok(translateNumbers(draw(input, 118, 'grid-glide', 60)).some((n) => Math.abs(n - pushed) < 0.01), `a push is ${pushed.toFixed(2)} px on frame 118`);
  assert.ok(translateNumbers(draw(input, 90, 'grid-glide', 60)).every((n) => n === 0), 'the push has not started on frame 90');
});

test('a style-owned scene refuses to render under another style', () => {
  assert.throws(() => draw(chapter(), 5, 'section-deck'), /belongs to grid-glide, not section-deck/);
});

test('SceneLayer dispatches glide scenes before the shared families', async () => {
  const layer = await ssrBundle(`
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {SafeRoot} from './engine/src/core/safe';
    import {SceneLayer} from './engine/src/prepared-edit/PreparedEdit';
    export const render = (scene, style) => renderToStaticMarkup(
      React.createElement(SafeRoot, {}, React.createElement(SceneLayer, {scene, style, geometry: {}, aspect: 1.78, seam: 1000})));
  `);
  for (const [input, family] of [[chapter(), 'glide-chapter'], [englishCard(), 'glide-card'], [englishLines(), 'glide-lines']]) {
    setFrame(20, {duration: input.durationInFrames});
    assert.ok(layer.render(input, 'grid-glide').includes(`data-glide-scene="${family}"`), family);
  }
});

test('every line sits in the safe column the layout assigns, centred on the canvas', () => {
  for (const [input, frame] of [[chapter(), 40], [englishCard(), 100], [englishLines(), 80]]) {
    const rows = [...draw(input, frame).matchAll(/data-glide="line" style="([^"]*)"/g)].map((match) => match[1]);
    assert.ok(rows.length > 0, `${input.family} draws lines`);
    for (const style of rows) {
      assert.equal(css(style, 'left'), '65px', `${input.family}: the column starts at the band's left edge`);
      assert.equal(css(style, 'width'), '950px', `${input.family}: the column is the whole band, centred on x 540`);
    }
  }
});

test('an Arabic line that names a tool stays right-to-left with the Latin words kept together', () => {
  const input = scene('glide-lines', {
    lines: [{words: ['استخدم', 'Example', 'Tool'], role: 'lead', at: 0}, {words: ['Acme', 'Notes', 'مهم'], role: 'hero', at: 10}],
    enter: cut, exit: cut,
  }, {durationInFrames: 150});
  const html = draw(input, 60);
  const rows = [...html.matchAll(/data-glide="line" style="([^"]*)"/g)].map((match) => match[1]);
  assert.equal(css(rows[0], 'direction'), 'rtl', 'a short Arabic line with a tool name reads right-to-left');
  assert.equal(css(rows[1], 'direction'), 'rtl', 'an Arabic line that opens with a Latin tool name reads right-to-left');
  assert.equal((html.match(/data-glide="latin-run"/g) ?? []).length, 2, 'each tool name is one left-to-right group inside its Arabic line');
  noArabicTracking(html);
});

test('the scene draws with the creator font when one is set', async () => {
  const themed = await ssrBundle(`
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {SafeRoot} from './engine/src/core/safe';
    import {TypographyProvider} from './engine/src/creative-kit/chapter-theme';
    import {StyleSceneRenderer} from './engine/src/styles/scene-renderers';
    export const render = (scene, font) => renderToStaticMarkup(React.createElement(SafeRoot, {},
      React.createElement(TypographyProvider, {fontFamily: font}, React.createElement(StyleSceneRenderer, {scene, style: 'grid-glide'}))));
  `);
  setFrame(40, {duration: 60});
  const own = themed.render(chapter(), 'Creator Sans');
  assert.ok(own.includes('font-family:Creator Sans'), 'the ordinal uses the creator font');
  assert.ok(!own.includes('font-family:Grid Sans'), 'the style font is replaced everywhere');
  assert.ok(themed.render(chapter(), null).includes('font-family:Grid Sans'), 'without a choice the style font stays');
});

test('a line wider than its safe column fails the render when text can be measured', () => {
  const wide = scene('glide-lines', {lines: [{words: ['abcdefgh', 'ijklmnopq'], role: 'hero', at: 0}], enter: cut, exit: cut}, {durationInFrames: 150});
  assert.ok(draw(wide, 60), 'Node-only runs skip the measurement');
  globalThis.document = {};
  try {
    assert.throws(() => draw(wide, 60), /glide-1 line 1: "abcdefgh ijklmnopq" is 900px wide at 100px but its safe column is 862px/);
    assert.ok(draw(englishLines(), 80), 'a line that fits renders');
  } finally {
    delete globalThis.document;
  }
});

test('a bullet that only fits below 64 px still renders: the kit shrinks it and the scene adds no stricter guard', () => {
  const bullets = (text) => englishCard({bullets: [{text, at: 90}, {text: 'then the second', at: 125}]});
  const fontSize = (html, word) => css(leaves(html).find((leaf) => leaf.text === word)?.style ?? '', 'font-size');
  globalThis.document = {};
  try {
    // 25 letters in three words: about 833 px wide at 64 px, 727 px free beside the star, so the kit draws it at 55 px.
    const html = draw(bullets('abcdefgh ijklmnop qrstuvwxy'), 100);
    assert.equal(fontSize(html, 'abcdefgh'), '55px', 'the bullet shrank to fit instead of being refused');
    assert.equal(fontSize(html, 'then'), '64px', 'a bullet that fits keeps the full size');
    // Below the kit floor the kit itself refuses, with its own message.
    assert.throws(() => draw(bullets('abcdefghij klmnopqrst uvwxyzabcd'), 100), /the bullet .* needs \d+px at 48px but only 727px are free/);
  } finally {
    delete globalThis.document;
  }
});
