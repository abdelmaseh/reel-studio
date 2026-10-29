import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  BAND_GAP, DEFAULT_HEAD, HERO, HERO_MARKS, HERO_PAD, fitMark, insideSafe, markRoom, MARKED_HEIGHT, LAYERED_FAMILIES, MATTE_MARGIN, SAFE, SIDE, WORD_PAD, aboveBox, layeredCues, layeredMinFrames, sideBox, zonesFor,
} from '../engine/src/styles/layered-speaker/scenes/math.ts';
import {
  BASELINE_IN_HEAD, MAX_BAR_EM, analyzeStretch, barLength, planAbove, planBehind, scaled,
} from '../engine/src/styles/layered-speaker/scenes/stretch.ts';
import {layeredTemplate, layeredTemplateFrames} from '../engine/src/styles/layered-speaker/scenes/templates.ts';

test('the safe area equals the platform profile the delivery gate checks', () => {
  const profile = JSON.parse(readFileSync(new URL('../engine/src/core/platform/instagram-reels.json', import.meta.url), 'utf8')).profiles['ig-reels-organic'];
  assert.deepEqual({top: SAFE.top, bottom: SAFE.bottom, left: SAFE.left, right: SAFE.right, railX: SAFE.railX, railY: SAFE.railY},
    {top: profile.top, bottom: profile.bottom, left: profile.left, right: profile.right, railX: profile.rail.x, railY: profile.rail.y});
  assert.deepEqual([...LAYERED_FAMILIES], ['layered-speaker']);
});

test('the free areas around the head stay outside the head box and inside the safe area', () => {
  for (const head of [DEFAULT_HEAD, {x: 300, y: 600, width: 300, height: 380}, {x: 500, y: 450, width: 400, height: 500}, {x: 380, y: 800, width: 320, height: 420}]) {
    const zones = zonesFor(head);
    assert.deepEqual(zones.head, head);
    assert.ok(zones.above.y >= SAFE.top && zones.above.y + zones.above.height <= head.y, 'the band above ends above the head');
    for (const side of ['left', 'right']) {
      const zone = zones[side];
      assert.ok(zone.x >= SAFE.left && zone.x + zone.width <= SAFE.right, `${side} inside the sides`);
      assert.ok(zone.y >= SAFE.top && zone.y + zone.height <= 1100, `${side} stays above the caption band`);
      if (side === 'left') assert.ok(zone.x + zone.width <= head.x - SIDE.gap + 1e-9, 'left strip ends before the head');
      else assert.ok(zone.x >= head.x + head.width + SIDE.gap - 1e-9, 'right strip starts after the head');
    }
  }
  assert.deepEqual(zonesFor(null).head, DEFAULT_HEAD, 'no measurement uses the typical head');
  assert.equal(zonesFor({x: 100, y: 200, width: 300, height: 300}).above.height, 0, 'a head near the top leaves no band');
});

test('a word beside the head gets a box that clears the head and is refused where the strip is too narrow', () => {
  const zones = zonesFor(DEFAULT_HEAD);
  for (const place of ['left', 'right']) {
    const box = sideBox(zones, place);
    assert.ok(box, place);
    assert.ok(box.width >= SIDE.minWidth && box.width <= SIDE.maxWidth);
    assert.ok(box.x >= SAFE.left + WORD_PAD && box.x + box.width <= SAFE.right - WORD_PAD);
    assert.ok(box.y >= SAFE.top + WORD_PAD && box.y + box.height <= 1100);
    const clear = box.x + box.width <= DEFAULT_HEAD.x || box.x >= DEFAULT_HEAD.x + DEFAULT_HEAD.width || box.y + box.height <= DEFAULT_HEAD.y || box.y >= DEFAULT_HEAD.y + DEFAULT_HEAD.height;
    assert.ok(clear, `${place} word clears the head box`);
  }
  assert.ok(sideBox(zones, 'right').y > sideBox(zones, 'left').y, 'the two sides stagger');
  const wide = zonesFor({x: 120, y: 520, width: 840, height: 440});
  assert.equal(sideBox(wide, 'left'), null);
  assert.equal(sideBox(wide, 'right'), null);
});

test('with a big word on screen the side words keep out of its rows: left above it, right below it', () => {
  const zones = zonesFor(DEFAULT_HEAD);
  const band = {top: 598, bottom: 862};
  const left = sideBox(zones, 'left', band);
  const right = sideBox(zones, 'right', band);
  assert.ok(left.y + left.height <= band.top - BAND_GAP + 1e-9, 'the left word ends above the letters');
  assert.ok(right.y >= band.bottom + BAND_GAP - 1e-9, 'the right word starts below the letters');
  assert.ok(left.y >= SAFE.top && right.y + right.height <= 1100);
  const flush = sideBox(zones, 'left', {top: 598, bottom: 862});
  assert.equal(flush.y + flush.height, band.top - BAND_GAP, 'it hugs the band');
  // No room above the letters: the left word goes below them instead; no room anywhere: refused.
  assert.ok(sideBox(zones, 'left', {top: 330, bottom: 600}).y >= 600 + BAND_GAP);
  assert.equal(sideBox(zones, 'left', {top: 330, bottom: 1090}), null);
  assert.deepEqual(sideBox(zones, 'right', null), sideBox(zones, 'right'), 'no band: the staggered placement');
});

test('a line above the head sits over the head box, or in the middle of the band without a big word', () => {
  const zones = zonesFor(DEFAULT_HEAD);
  const withHero = aboveBox(zones, true);
  assert.ok(withHero.y + withHero.height <= DEFAULT_HEAD.y);
  const alone = aboveBox(zones, false);
  assert.ok(alone.y >= zones.above.y && alone.y + alone.height <= zones.above.y + zones.above.height);
  assert.equal(aboveBox(zonesFor({x: 360, y: 300, width: 360, height: 440}), true), null, 'no room over a head that high');
});

// A synthetic bitmap of a stretched word: letters left, a long thin bar, letters right.
function bitmap({width = 700, height = 400, baseline = 280, size = 200, leftInk = [60, 250], rightInk = [450, 640], bar = [250, 450]} = {}) {
  const data = new Uint8ClampedArray(width * height * 4);
  const fill = (x0, x1, y0, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[(y * width + x) * 4 + 3] = 255; };
  fill(leftInk[0], leftInk[1], 60, 330);
  fill(bar[0], bar[1], baseline - 26, baseline);
  fill(rightInk[0], rightInk[1], 80, 320);
  return {img: {width, height, data}, size, baseline};
}

test('the stretch analysis finds the bar and the ink box', () => {
  const {img, size, baseline} = bitmap();
  const m = analyzeStretch(img, size, baseline);
  assert.ok(m);
  assert.deepEqual(m.ink, {left: 60, right: 640, top: 60, bottom: 330});
  assert.ok(Math.abs(m.bar.x0 - 250) <= 2 && Math.abs(m.bar.x1 - 450) <= 2, `bar ${m.bar.x0}..${m.bar.x1}`);
  const k = scaled(m, 400);
  assert.equal(k.k, 2);
  assert.ok(Math.abs(k.leftW - (m.bar.x0 - 60) * 2) < 1e-9);
  assert.equal(analyzeStretch({width: 10, height: 10, data: new Uint8ClampedArray(400)}, 10, 5), null, 'no ink');
  const noBar = bitmap({bar: [250, 262]});
  assert.equal(analyzeStretch(noBar.img, noBar.size, noBar.baseline), null, 'a word without a long thin bar cannot be stretched');
});

const metrics = () => {
  const {img, size, baseline} = bitmap();
  return analyzeStretch(img, size, baseline);
};

test('behind the head: the bar covers the head plus the margin and the letters fit both sides', () => {
  const m = metrics();
  const head = DEFAULT_HEAD;
  const plan = planBehind(m, head, MATTE_MARGIN);
  assert.equal(plan.mode, 'behind');
  assert.equal(plan.barFinal, head.width + 2 * MATTE_MARGIN);
  assert.equal(plan.cx, head.x + head.width / 2);
  assert.equal(plan.baselineY, head.y + BASELINE_IN_HEAD * head.height);
  assert.ok(plan.size >= HERO.minSize && plan.size <= HERO.maxSize);
  const k = scaled(m, plan.size);
  const leftEdge = plan.cx - plan.barFinal / 2 - k.leftW;
  const rightEdge = plan.cx + plan.barFinal / 2 + k.rightW;
  assert.ok(leftEdge >= SAFE.left + HERO_PAD - 1e-6, `left edge ${leftEdge}`);
  assert.ok(rightEdge <= SAFE.right - HERO_PAD + 1e-6, `right edge ${rightEdge}`);
  assert.ok(plan.baselineY - k.ascent >= SAFE.top + HERO_PAD - 1e-6, 'the letters stay under the top margin');
  assert.ok(plan.baselineY + k.descent <= 1100 + 1e-6, 'and above the caption band');
  // The size is the largest that fits: one pixel more breaks a limit.
  const bigger = scaled(m, plan.size + 1);
  const breaks = plan.cx - plan.barFinal / 2 - bigger.leftW < SAFE.left + HERO_PAD || plan.cx + plan.barFinal / 2 + bigger.rightW > SAFE.right - HERO_PAD
    || plan.baselineY - bigger.ascent < SAFE.top + HERO_PAD || plan.baselineY + bigger.descent > 1100 || plan.size + 1 > HERO.maxSize;
  assert.ok(breaks, 'no bigger size fits');
});

test('behind the head: a big head or a wide word that cannot keep its letters visible is refused with the tight side named', () => {
  const m = metrics();
  const huge = planBehind(m, {x: 140, y: 520, width: 800, height: 440}, MATTE_MARGIN);
  assert.equal(huge.mode, 'none');
  assert.match(huge.reason, /minimum \d+px/);
  assert.match(huge.reason, /left|right|width/);
  const tall = planBehind(m, {x: 360, y: 300, width: 360, height: 100}, MATTE_MARGIN);
  assert.equal(tall.mode, 'none', 'a head too near the top leaves no height for the letters');
});

test('behind the head: every random head keeps the plan inside the safe area', () => {
  const m = metrics();
  let seed = 7;
  const next = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  let planned = 0;
  for (let i = 0; i < 300; i++) {
    const width = 220 + next() * 260;
    const head = {x: 120 + next() * (840 - width), y: 420 + next() * 400, width, height: 300 + next() * 240};
    const plan = planBehind(m, head, MATTE_MARGIN);
    if (plan.mode === 'none') continue;
    planned++;
    const k = scaled(m, plan.size);
    assert.ok(plan.cx - plan.barFinal / 2 - k.leftW >= SAFE.left, JSON.stringify(head));
    assert.ok(plan.cx + plan.barFinal / 2 + k.rightW <= SAFE.right, JSON.stringify(head));
    assert.ok(plan.baselineY - k.ascent >= SAFE.top && plan.baselineY + k.descent <= SAFE.bottom, JSON.stringify(head));
  }
  assert.ok(planned > 100, 'most heads can be planned');
});

test('above the head: the word is centred in the band and its bar never grows past a ruler', () => {
  const m = metrics();
  const zones = zonesFor({x: 360, y: 700, width: 360, height: 440});
  const plan = planAbove(m, zones.above);
  assert.equal(plan.mode, 'above');
  const k = scaled(m, plan.size);
  assert.ok(plan.barFinal <= plan.size * MAX_BAR_EM + 1e-6);
  assert.ok(plan.barFinal >= plan.size * 0.6 - 1e-6);
  assert.equal(plan.cx, zones.above.x + zones.above.width / 2);
  assert.ok(plan.baselineY - k.ascent >= zones.above.y && plan.baselineY + k.descent <= zones.above.y + zones.above.height);
  assert.ok(plan.cx - plan.barFinal / 2 - k.leftW >= SAFE.left + HERO_PAD - 1e-6);
  assert.equal(planAbove(m, zonesFor({x: 360, y: 330, width: 360, height: 440}).above).mode, 'none', 'a band too low for a readable word');
});

test('the bar grows from a short stub to its rest length and never goes back', () => {
  const plan = {size: 240, barFinal: 430};
  assert.ok(Math.abs(barLength(0, plan) - 240 * 0.04) < 1e-9);
  assert.equal(barLength(1, plan), 430);
  let last = -1;
  for (let i = 0; i <= 20; i++) {
    const length = barLength(i / 20, plan);
    assert.ok(length >= last);
    last = length;
  }
  assert.ok(barLength(0.3, plan) > barLength(0, plan) + (430 - 9.6) * 0.5, 'fast at first');
  assert.equal(barLength(-3, plan), barLength(0, plan));
  assert.equal(barLength(9, plan), 430);
});

test('sound cues land on the big word and on each mark, and nowhere else', () => {
  const data = {words: [{place: 'behind', text: 'x', atFrame: 6}, {place: 'right', text: 'y', atFrame: 30, mark: {kind: 'circle', atFrame: 42}}, {place: 'left', text: 'z', atFrame: 50}]};
  assert.deepEqual(layeredCues(data, 30), [{frame: 6, kind: 'reveal'}, {frame: 42, kind: 'swap'}]);
  assert.deepEqual(layeredCues({}, 30), []);
  assert.deepEqual(layeredCues({words: [{place: 'behind', atFrame: 'soon'}]}, 30), [], 'loose data is ignored, not trusted');
});

test('a scene needs time for every word to be read and every mark to be drawn', () => {
  const data = {words: [{place: 'behind', text: 'x', atFrame: 6}, {place: 'right', text: 'y', atFrame: 30, mark: {kind: 'circle', atFrame: 42}}]};
  const need = layeredMinFrames(data, 30);
  assert.equal(need, Math.max(36, 42 + 15 + 9), 'the circle takes 15 frames to draw and 0.3 s to be seen');
  assert.ok(layeredMinFrames({words: [{place: 'left', text: 'a', atFrame: 0}]}, 30) >= 36, 'at least 1.2 s');
  assert.ok(layeredMinFrames(data, 60) > need);
  assert.ok(layeredTemplateFrames(30) >= 90);
  assert.ok(layeredTemplateFrames(60) >= 180);
  assert.equal(layeredTemplate.words.length, 3);
});

test('a stroke is inside the safe area only when every side and the action rail allow it', () => {
  assert.equal(insideSafe({left: 100, top: 300, width: 400, height: 100}), true);
  assert.equal(insideSafe({left: 50, top: 300, width: 400, height: 100}), false, 'the left margin');
  assert.equal(insideSafe({left: 100, top: 240, width: 400, height: 100}), false, 'under the header');
  assert.equal(insideSafe({left: 100, top: 300, width: 920, height: 100}), false, 'the right margin');
  assert.equal(insideSafe({left: 700, top: 1100, width: 200, height: 100}), false, 'the rail below y 1150 starts at x 853');
  assert.equal(insideSafe({left: 500, top: 1100, width: 300, height: 100}), true);
});

test('a mark is fitted inside the safe area, swinging an arrow in from the other side when the reading side has no room', () => {
  const word = {x: 700, y: 500, width: 250, height: 90};
  const circle = fitMark('circle', word, 'rtl', 'seed');
  assert.ok(circle && insideSafe(circle.box));
  const arrow = fitMark('arrow', {x: 840, y: 700, width: 160, height: 80}, 'rtl', 'seed');
  assert.ok(arrow, 'an arrow near the right edge still fits');
  assert.equal(arrow.dir, 'ltr', 'it swings in from the head side');
  assert.equal(arrow.from, 'below');
  // A word low on the right: the tail below it would run into the action rail, so the arrow comes in from above.
  const low = fitMark('arrow', {x: 800, y: 1020, width: 160, height: 80}, 'rtl', 'seed');
  assert.ok(low && low.from === 'above' && insideSafe(low.box), JSON.stringify(low));
  assert.equal(fitMark('circle', {x: 100, y: 500, width: 880, height: 120}, 'rtl', 'seed'), null, 'a circle around a word that wide cannot fit');
  assert.deepEqual([...HERO_MARKS], ['underline', 'band', 'strike']);
  assert.ok(['circle', 'band', 'arrow', 'strike', 'underline'].every((kind) => markRoom(kind) >= 20));
  assert.ok(markRoom('circle') > markRoom('underline'), 'a loop needs more room than a line');
  // Marks on a side word with the room the scene leaves for them stay inside for every kind and a spread of seeds.
  const zones = zonesFor(DEFAULT_HEAD);
  for (const place of ['left', 'right']) {
    const box = sideBox(zones, place, {top: 598, bottom: 862});
    for (const kind of ['underline', 'circle', 'band', 'strike', 'arrow']) {
      const room = markRoom(kind);
      const rect = {x: box.x + room + 10, y: box.y + (box.height - MARKED_HEIGHT) / 2 + 10, width: box.width - 2 * room - 20, height: MARKED_HEIGHT - 20};
      for (const seed of ['a', 'b', 'c', 'd']) assert.ok(fitMark(kind, rect, 'rtl', seed, {top: 598, bottom: 862}), `${place} ${kind} ${seed}`);
    }
  }
});
