import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUGH_KINDS, passProgress, roughDrawFrames, roughMark, roughProgress, seededRandom, ROUGH_DRAW_SECONDS,
} from '../engine/src/creative-kit/marks/rough.ts';
import {bundleEngine, setSsrFrame, setSsrFps} from './helpers/engine-bundle.mjs';

const target = {x: 300, y: 600, width: 360, height: 120};
const numbers = (d) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

test('a seeded generator repeats exactly and a different seed gives a different sequence', () => {
  const a = seededRandom('word:1'), b = seededRandom('word:1'), c = seededRandom('word:2');
  const first = Array.from({length: 8}, () => a());
  assert.deepEqual(Array.from({length: 8}, () => b()), first);
  assert.notDeepEqual(Array.from({length: 8}, () => c()), first);
  for (const value of first) assert.ok(value >= 0 && value < 1);
});

test('every kind builds a deterministic rough path that moves with the seed', () => {
  assert.deepEqual([...ROUGH_KINDS], ['underline', 'circle', 'band', 'strike', 'arrow']);
  for (const kind of ROUGH_KINDS) {
    const once = roughMark(kind, target, 'rtl', {seed: 'key'});
    const again = roughMark(kind, target, 'rtl', {seed: 'key'});
    assert.deepEqual(again, once, `${kind} repeats`);
    const other = roughMark(kind, target, 'rtl', {seed: 'another'});
    assert.notEqual(other.passes[0].d, once.passes[0].d, `${kind} depends on the seed`);
    assert.ok(once.passes.length >= 1);
    for (const pass of once.passes) {
      assert.match(pass.d, /^M [-\d.]+ [-\d.]+( C [-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+| L [-\d.]+ [-\d.]+| M [-\d.]+ [-\d.]+)+$/, `${kind} is plain SVG path data`);
      assert.ok(numbers(pass.d).every(Number.isFinite));
      assert.ok(pass.from >= 0 && pass.to <= 1 && pass.from < pass.to, `${kind} pass window`);
      assert.ok(pass.opacity > 0 && pass.opacity <= 1);
    }
    assert.ok(once.passes[0].from === 0, `${kind} starts drawing at progress 0`);
    assert.equal(once.passes.at(-1).to, 1, `${kind} finishes at progress 1`);
  }
});

test('the box holds every point of every pass and the stroke itself', () => {
  for (const kind of ROUGH_KINDS) {
    for (const dir of ['rtl', 'ltr']) {
      const stroke = roughMark(kind, target, dir, {seed: `${kind}-${dir}`});
      const {left, top, width, height} = stroke.box;
      assert.ok(width > 0 && height > 0, kind);
      for (const point of stroke.points) {
        assert.ok(point.x >= left - 0.01 && point.x <= left + width + 0.01, `${kind} ${dir} x ${point.x} inside ${left}..${left + width}`);
        assert.ok(point.y >= top - 0.01 && point.y <= top + height + 0.01, `${kind} ${dir} y ${point.y}`);
      }
      // The ink has to stay near the word, not drift across the frame.
      assert.ok(left > target.x - 200 && left + width < target.x + target.width + 200, `${kind} ${dir} stays close sideways`);
      assert.ok(top > target.y - 120 && top + height < target.y + target.height + 320, `${kind} ${dir} stays close vertically`);
    }
  }
});

test('an underline starts on the reading side and a mirrored mark starts on the other side', () => {
  const right = roughMark('underline', target, 'rtl', {seed: 's'}).points;
  const left = roughMark('underline', target, 'ltr', {seed: 's'}).points;
  assert.ok(right[0].x > target.x + target.width - 30, 'RTL underline starts at the right end of the word');
  assert.ok(right.at(-1).x < target.x + 30, 'and ends at the left end');
  assert.ok(left[0].x < target.x + 30 && left.at(-1).x > target.x + target.width - 30, 'LTR is the mirror');
  // The underline sits under the line box, not through the middle of the word.
  assert.ok(right.every((p) => p.y > target.y + target.height - 25 && p.y < target.y + target.height + 40));
});

test('a circle surrounds the word, a strike crosses it and a band covers its middle', () => {
  const circle = roughMark('circle', target, 'rtl', {seed: 'c'}).points;
  const xs = circle.map((p) => p.x), ys = circle.map((p) => p.y);
  assert.ok(Math.min(...xs) < target.x && Math.max(...xs) > target.x + target.width, 'the loop is wider than the word');
  assert.ok(Math.min(...ys) < target.y && Math.max(...ys) > target.y + target.height, 'and taller');
  const strike = roughMark('strike', target, 'rtl', {seed: 's'}).points;
  assert.ok(strike.every((p) => p.y > target.y + target.height * 0.25 && p.y < target.y + target.height * 0.9), 'the strike stays inside the word height');
  const band = roughMark('band', target, 'rtl', {seed: 'b'});
  assert.ok(band.strokeWidth >= target.height * 0.5, 'the band is a thick stroke');
  assert.ok(band.points.every((p) => p.y > target.y + target.height * 0.3 && p.y < target.y + target.height * 0.85));
});

test('an arrow has a shaft and a separate arrow head drawn last', () => {
  const arrow = roughMark('arrow', target, 'rtl', {seed: 'a'});
  assert.equal(arrow.passes.length, 2);
  assert.ok(arrow.passes[0].to <= arrow.passes[1].from + 1e-9, 'the head waits for the shaft');
  assert.match(arrow.passes[1].d, / L /, 'the head is two barbs meeting at the tip');
});

test('an arrow can come in from above the word instead of from below', () => {
  const below = roughMark('arrow', target, 'rtl', {seed: 'a'});
  const above = roughMark('arrow', target, 'rtl', {seed: 'a', from: 'above'});
  assert.ok(below.points.every((p) => p.y > target.y + target.height * 0.5), 'the default arrow is under the word');
  assert.ok(above.points.every((p) => p.y < target.y + target.height * 0.5), 'the other one is over it');
  const mirror = (p) => 2 * (target.y + target.height / 2) - p.y;
  // The shaft is the same drawing turned over; the barbs (the last three points) are re-aimed at the tip.
  const shaft = (stroke) => stroke.points.slice(0, -3);
  assert.deepEqual(shaft(above).map((p) => Math.round(p.x)), shaft(below).map((p) => Math.round(p.x)), 'the same sideways path');
  assert.ok(shaft(above).every((p, i) => Math.abs(p.y - mirror(shaft(below)[i])) < 1.5), 'turned over around the middle of the word');
  assert.equal(above.passes.length, 2);
  assert.match(above.passes[1].d, / L /);
  // Other kinds ignore it.
  assert.deepEqual(roughMark('underline', target, 'rtl', {seed: 'a', from: 'above'}), roughMark('underline', target, 'rtl', {seed: 'a'}));
});

test('roughness 0 is the clean geometry and more roughness moves the ink further from it', () => {
  const spread = (roughness) => {
    const pts = roughMark('underline', target, 'ltr', {seed: 'r', roughness}).points;
    const ys = pts.map((p) => p.y);
    return Math.max(...ys) - Math.min(...ys);
  };
  assert.ok(spread(0) < 14, 'a clean underline is nearly level');
  assert.ok(spread(1) > spread(0));
  assert.throws(() => roughMark('underline', target, 'ltr', {seed: 'r', roughness: 2}), /roughness/);
});

test('the draw-on lasts 0.3 to 0.5 seconds at every frame rate', () => {
  for (const kind of ROUGH_KINDS) {
    assert.ok(ROUGH_DRAW_SECONDS[kind] >= 0.3 && ROUGH_DRAW_SECONDS[kind] <= 0.5, kind);
    for (const fps of [24, 25, 30, 50, 60]) {
      const frames = roughDrawFrames(kind, fps);
      assert.ok(Number.isInteger(frames) && frames >= 1);
      assert.ok(frames / fps >= 0.3 - 0.5 / fps && frames / fps <= 0.5 + 0.5 / fps, `${kind} @${fps}: ${frames} frames`);
    }
  }
  assert.throws(() => roughDrawFrames('circle', 0), /fps/);
});

test('progress runs 0 to 1 over the draw-on, never goes back and finishes on the last frame', () => {
  const dur = roughDrawFrames('circle', 30);
  assert.equal(roughProgress(9, 10, dur), 0, 'nothing before the start frame');
  let last = 0;
  for (let frame = 10; frame < 10 + dur; frame++) {
    const p = roughProgress(frame, 10, dur);
    assert.ok(p > 0 && p <= 1 && p >= last, `frame ${frame}`);
    last = p;
  }
  assert.equal(roughProgress(10 + dur - 1, 10, dur), 1, 'complete on the last draw frame');
  assert.equal(roughProgress(10 + dur + 40, 10, dur), 1, 'and it stays drawn');
});

test('a pass draws inside its own window of the whole progress', () => {
  const pass = {d: 'M 0 0 L 1 1', from: 0.5, to: 1, opacity: 1};
  assert.equal(passProgress(pass, 0.25), 0);
  assert.equal(passProgress(pass, 0.75), 0.5);
  assert.equal(passProgress(pass, 1), 1);
});

test('bad input is refused by name', () => {
  assert.throws(() => roughMark('squiggle', target, 'rtl', {seed: 'x'}), /unknown mark kind/);
  assert.throws(() => roughMark('circle', {...target, width: 0}, 'rtl', {seed: 'x'}), /rect/);
  assert.throws(() => roughMark('circle', target, 'up', {seed: 'x'}), /direction/);
  assert.throws(() => roughMark('circle', target, 'rtl', {seed: ''}), /seed/);
  assert.throws(() => roughMark('circle', target, 'rtl', {seed: 'x', strokeWidth: -1}), /strokeWidth/);
});

const harness = `
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MarkStroke} from './engine/src/creative-kit/marks/MarkStroke';
import {SafeRoot} from './engine/src/core/safe';
export const draw = (props, probe) => renderToStaticMarkup(React.createElement(SafeRoot, probe ? {probe} : {}, React.createElement(MarkStroke, props)));
`;

test('every kind renders as SVG strokes that draw on, and the stroke is hidden before its frame', async () => {
  const {draw} = await bundleEngine(harness, {ssr: true});
  const props = (kind, extra = {}) => ({kind, target, dir: 'rtl', at: 10, color: '#ffd23f', seed: `mark-${kind}`, ...extra});
  for (const kind of ROUGH_KINDS) {
    setSsrFps(30);
    setSsrFrame(5);
    assert.doesNotMatch(draw(props(kind)), /<path/, `${kind} is not visible before its frame`);
    const dur = roughDrawFrames(kind, 30);
    setSsrFrame(10 + dur - 1);
    const done = draw(props(kind));
    const paths = done.match(/<path[^>]*>/g) ?? [];
    assert.equal(paths.length, roughMark(kind, target, 'rtl', {seed: `mark-${kind}`}).passes.length, `${kind} paints one path per pass`);
    for (const path of paths) {
      assert.match(path, /stroke="#ffd23f"/);
      assert.match(path, /stroke-linecap="round"/);
      assert.match(path, /stroke-dasharray/);
    }
    assert.match(done, /<svg/);
  }
  setSsrFrame(11);
  const early = draw(props('circle'));
  const dash = (early.match(/stroke-dashoffset="([-\d.]+)"/) ?? [])[1];
  assert.ok(Number(dash) > 0, 'a path still being drawn keeps a dash offset');
  setSsrFrame(0);
});

test('under the safe-zone probe a mark is painted in full as content', async () => {
  const {draw} = await bundleEngine(harness, {ssr: true});
  setSsrFps(30);
  setSsrFrame(0);
  const html = draw({kind: 'underline', target, dir: 'rtl', at: 10, color: '#ffd23f', seed: 'p'}, '#ff00ff');
  assert.match(html, /<path/, 'the safe-zone check must see the stroke');
  assert.match(html, /stroke-dashoffset="0"/, 'drawn in full');
});
