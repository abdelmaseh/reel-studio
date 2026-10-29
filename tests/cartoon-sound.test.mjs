import test from 'node:test';
import assert from 'node:assert/strict';
import {SAMPLE_RATE, mixHits, renderSound, toStereo} from '../scripts/sfx.mjs';
import {loadSoundCatalog, soundRecipe, validateHits} from '../scripts/lib/job-sound.mjs';

const peakOf = (voice) => {
  const {left, right} = toStereo(voice);
  let peak = 0;
  for (let i = 0; i < left.length; i += 1) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  return peak;
};

test('the cartoon flip and stamp recipes exist, are single deterministic hits and keep the catalog counts', async () => {
  const catalog = await loadSoundCatalog();
  assert.equal(catalog.sounds.length, 20);
  // Synthesized recipes only; the recorded CC0 recipes (cc0-*) are counted on their own page.
  assert.equal(catalog.recipes.filter((recipe) => !recipe.id.startsWith('cc0-')).length, 25);
  const flip = await soundRecipe('cartoon-flip');
  assert.equal(flip.duration, 0.4);
  // A soft pass of air, not a sweep voice: style palettes may not name whoosh/swipe voices (scripts/lib/sfx-events.mjs).
  assert.deepEqual(flip.hits, [{t: 0, sound: 'airPass', gain: 0.1, pan: 0, opts: {dur: 0.36, seed: 300, lo: 600, hi: 3200}}]);
  const stamp = await soundRecipe('cartoon-stamp');
  assert.equal(stamp.duration, 0.5);
  assert.deepEqual(stamp.hits, [{t: 0, sound: 'impact', gain: 0.18, pan: 0, opts: {seed: 701}}]);
  for (const recipe of [flip, stamp]) {
    assert.doesNotThrow(() => validateHits(recipe.hits, recipe.duration));
    const a = mixHits(recipe.hits, recipe.duration), b = mixHits(recipe.hits, recipe.duration);
    assert.equal(a.L.length, Math.round(recipe.duration * SAMPLE_RATE));
    assert.ok(a.L.every((x, i) => x === b.L[i]), `${recipe.id} is deterministic`);
  }
  const air = toStereo(renderSound('airPass', {dur: 0.36, seed: 300, lo: 600, hi: 3200}));
  assert.equal(air.left.length, Math.round(0.36 * SAMPLE_RATE));
  assert.ok(peakOf(air) > 0.2 && peakOf(air) <= 0.95);
});

import {sceneCues, editCues} from '../scripts/lib/scene-cues.mjs';
import {loadStylePalette, expandSoundEvents} from '../scripts/lib/sfx-events.mjs';
import {autoSoundPlan} from '../scripts/lib/editor-director.mjs';
import {resolveCartoonTimeline} from '../engine/src/styles/cartoon/scenes/math.ts';
import {body, bodyScene, words} from './helpers/cartoon-fixtures.mjs';
import {reviewManifest} from './helpers/review-manifest.mjs';

const scene = bodyScene();

test('the body scene cues a transition on every flip (not on frame 0), reveals on card landings, typing on code lines', () => {
  const cues = sceneCues(scene, 30, {words: words()});
  const tl = resolveCartoonTimeline(body(), scene, words(), 30);
  assert.ok(!cues.some((c) => c.frame === 0 && c.kind === 'transition'), 'act 1 opens silent');
  assert.ok(cues.some((c) => c.frame === tl.acts[1].flipFrame && c.kind === 'transition'));
  assert.ok(cues.some((c) => c.kind === 'reveal' && c.frame === tl.cards[0].startFrame + Math.round(0.05 * 30)));
  assert.ok(cues.some((c) => c.kind === 'type' && c.frame === 75), 'the code line types on its word');
  assert.deepEqual(sceneCues(scene, 30), [], 'without words there is nothing to cue');
  const at50 = sceneCues({...scene, durationInFrames: Math.round(260 / 30 * 50)}, 50, {words: words(16, 50)});
  assert.ok(at50.some((c) => c.kind === 'type' && c.frame === 125), 'the same cue in seconds at 50 fps');
});

test('the ending cues its reveal on frame 0, the card landings, and the tap; nothing in the tail', () => {
  const endWords = words(26).map((w) => ({...w, fromFrame: w.fromFrame + 29, toFrame: w.toFrame + 29}));
  const ending = {id: 'end', family: 'cartoon-ending', fromFrame: 260, durationInFrames: 180, layout: 'takeover', motion: 'quiet', data: {
    fromTheme: 'dark', theme: 'light', tag: '// 03', entrance: {x: 540, scale: 0.86}, sentences: [{from: 16, to: 19}, {from: 20, to: 23}], accents: [],
    comment: {keyword: 'PLAN', at: {word: 16}}, follow: {handle: '@example.creator', message: 'تابعني', at: {word: 20}, tapAt: {word: 22, dt: 0.04}}, tail: {at: {word: 24}}}};
  const cues = sceneCues(ending, 30, {words: endWords});
  assert.ok(cues.some((c) => c.frame === 260 && c.kind === 'transition'), 'the ending reveal');
  assert.ok(cues.some((c) => c.frame === 260 + 100 && c.kind === 'click'), 'the tap');
  assert.ok(cues.some((c) => c.frame === 260 + 9 + 3 && c.kind === 'reveal'), 'the comment card lands');
  assert.ok(cues.every((c) => c.frame < 260 + 129), 'silent from the tail on');
});

test('the palette plans the demo into a bounded stem with nothing at or after the tail', async () => {
  const m = reviewManifest('cartoon-sound');
  m.style = 'cartoon'; m.source.totalFrames = 260; m.segments = [{fromFrame: 0, toFrame: 260}];
  m.captions.words = words().map((w, i) => ({text: w.text, startMs: i * 500, endMs: i * 500 + 300, confidence: 1}));
  m.scenes = [{...scene, data: {...body(), sentences: [{from: 0, to: 3}, {from: 4, to: 7}, {from: 8, to: 11}, {from: 12, to: 13}], tail: {at: {word: 14}}}}];
  const palette = await loadStylePalette('cartoon');
  const plan = autoSoundPlan(m, palette);
  assert.ok(plan.sounds.length >= 3, JSON.stringify(plan.sounds));
  assert.ok(plan.sounds.every((s) => s.atFrame < 14 * 15), 'silent from the tail on');
  assert.ok(plan.sounds.some((s) => s.recipe === 'cartoon-flip'), 'the flip sounds');
  const hits = expandSoundEvents(plan.sounds, palette, 30);
  const {peak} = mixHits(hits, 260 / 30);
  assert.ok(peak > 0.02 && peak < 1.5, `peak ${peak}`);
  assert.equal(editCues(m).filter((c) => c.kind === 'transition').length, 1, 'one flip in the demo body');
});
