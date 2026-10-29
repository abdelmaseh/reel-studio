import test from 'node:test';
import assert from 'node:assert/strict';
import {bundleEngine, setSsrFps, setSsrFrame} from './helpers/engine-bundle.mjs';

// The outcome scene lays its items out as a wrapping row of tags. Arabic reads from the right, so an Arabic row starts at the
// right edge and wraps from there; a Latin row keeps starting at the left.
const mod = await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {KineticSceneRenderer} from './engine/src/creative-kit/kinetic/scenes';
  const geometry = {windowTop: 960, windowHeight: 960, videoWidth: 1080, videoLeft: 0, videoTop: 960};
  export const render = (scene) => renderToStaticMarkup(React.createElement(KineticSceneRenderer, {scene, style: 'section-deck', geometry, aspect: 16 / 9, seam: 960}));
`, {ssr: true, media: true, plateStub: true});

const scene = (items, footer = 'جرّبها بنفسك') => ({id: 'outcome-1', family: 'outcome', fromFrame: 0, durationInFrames: 120, layout: 'split', motion: 'land',
  data: {kicker: 'النتيجة', title: 'ثلاث خطوات واضحة', items, footer}});
const styleOf = (value) => Object.fromEntries(value.split(';').filter(Boolean).map(declaration => {
  const colon = declaration.indexOf(':');
  return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()];
}));
const rowOf = (html) => {
  const divs = [], stack = [];
  // The SSR row and its tags use nested divs. Keep their structure and text, independent of style serialization order.
  for (const [token] of html.matchAll(/<[^>]+>|[^<]+/g)) {
    if (token.startsWith('</div>')) stack.pop();
    else if (/^<div(?:\s|>)/.test(token)) {
      const node = {style: styleOf(/\bstyle="([^"]*)"/.exec(token)?.[1] ?? ''), children: [], text: ''};
      stack.at(-1)?.children.push(node);
      divs.push(node); stack.push(node);
    } else if (!token.startsWith('<')) {
      for (const node of stack) node.text += token;
    }
  }
  const rows = divs.filter(node => node.style.display === 'flex' && node.children.length > 0
    && node.children.every(child => child.style.display === 'inline-block'));
  assert.equal(rows.length, 1, 'exactly one row contains the tags as direct children');
  return rows[0];
};
const assertRow = (row, items, direction) => {
  assert.equal(row.style.direction, direction);
  assert.equal(row.style['flex-direction'] ?? 'row', 'row', 'the row must not reverse the authored order');
  assert.equal(row.style['flex-wrap'], 'wrap', 'new lines follow the same reading direction');
  assert.deepEqual(row.children.map(tag => tag.text), items, 'tags keep the authored order inside their row');
};
const assertTags = (row, directions) => {
  assert.deepEqual(row.children.map(tag => tag.style.direction), directions, 'each tag sets its own text direction');
  assert.ok(row.children.every(tag => tag.style['unicode-bidi'] === 'isolate'), 'tag text is isolated from the row');
};
const render = (target) => {
  setSsrFps(30);
  setSsrFrame(119);
  return mod.render(target);
};

test('an Arabic outcome row starts at the right edge and keeps the authored order', () => {
  const items = ['خطة', 'تنفيذ', 'نتيجة'];
  const row = rowOf(render(scene(items)));
  assertRow(row, items, 'rtl');
  assertTags(row, ['rtl', 'rtl', 'rtl']);
});

test('a Latin outcome row keeps starting at the left', () => {
  const items = ['Plan', 'Build', 'Ship'];
  const row = rowOf(render(scene(items, 'Try it yourself')));
  assertRow(row, items, 'ltr');
  assertTags(row, ['ltr', 'ltr', 'ltr']);
});

test('Latin punctuation and signed percentages keep their own direction inside an Arabic row', () => {
  const items = ['خطة', 'تنفيذ', 'API!', '+10%'];
  const row = rowOf(render(scene(items)));
  assertRow(row, items, 'rtl');
  assertTags(row, ['rtl', 'rtl', 'ltr', 'ltr']);
});

test('enough Arabic tags to wrap keep reading from the right', () => {
  const items = ['نتيجة أولى واضحة', 'نتيجة ثانية واضحة', 'نتيجة ثالثة واضحة',
    'نتيجة رابعة واضحة', 'نتيجة خامسة واضحة', 'نتيجة سادسة واضحة'];
  const row = rowOf(render(scene(items)));
  assertRow(row, items, 'rtl');
  assertTags(row, items.map(() => 'rtl'));
  const tagsWidth = row.children.reduce((sum, tag) => sum + parseFloat(tag.children[0].style.width)
    + 2 * parseFloat(tag.style.padding.split(/\s+/)[1]) + 2 * parseFloat(tag.style.border), 0);
  const requiredWidth = tagsWidth + (items.length - 1) * parseFloat(row.style.gap);
  assert.ok(requiredWidth > parseFloat(row.style.width), 'the tags require more than one line');
});

test('row and tag lookup tolerates a different CSS property order', () => {
  const items = ['خطة', 'تنفيذ', 'API!', '+10%'];
  const html = render(scene(items)).replace(/style="([^"]*)"/g,
    (_attribute, style) => 'style="' + style.split(';').reverse().join(';') + '"');
  const row = rowOf(html);
  assertRow(row, items, 'rtl');
  assertTags(row, ['rtl', 'rtl', 'ltr', 'ltr']);
});
