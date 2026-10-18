import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SAMPLE_RATE, SOUND_IDS, mixHits, renderSound, toStereo} from '../scripts/sfx.mjs';
import {SOUND_NAMES, loadSoundCatalog, soundRecipe, validateHits} from '../scripts/lib/job-sound.mjs';
import {expandSoundEvents, loadStylePalette} from '../scripts/lib/sfx-events.mjs';
import {autoSoundPlan} from '../scripts/lib/editor-director.mjs';
import {normalizeGraphicsSpec} from '../scripts/lib/graphics-project.mjs';

const demo = () => JSON.parse(readFileSync(new URL('../instructions/examples/one-shot-demo.json', import.meta.url), 'utf8'));
const peakOf = (voice) => {
  const {left, right} = toStereo(voice);
  let peak = 0;
  for (let i = 0; i < left.length; i += 1) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  return peak;
};

test('the two air voices are registered, validated and part of the catalog', async () => {
  for (const name of ['airRise', 'airPass']) {
    assert.ok(SOUND_IDS.includes(name), name);
    assert.ok(SOUND_NAMES.includes(name), name);
  }
  assert.doesNotThrow(() => validateHits([{t: 0, sound: 'airRise', gain: 0.5, pan: 0, opts: {dur: 0.9, seed: 11, lo: 220, hi: 3200}}], 1));
  assert.throws(() => validateHits([{t: 0, sound: 'airPass', gain: 0.5, pan: 0, opts: {freq: 300}}], 1), /option/i);
  const catalog = await loadSoundCatalog();
  assert.deepEqual(catalog.sounds.filter((sound) => sound.id.startsWith('air')).map((sound) => sound.id), ['airRise', 'airPass']);
  for (const id of ['air-rise', 'air-pass', 'soft-pop']) assert.ok(catalog.recipes.some((recipe) => recipe.id === id), id);
  assert.ok((await soundRecipe('air-rise')).hits.some((hit) => hit.sound === 'subThud'), 'the rise carries its own landing');
});

test('the air voices are stereo, deterministic, bounded and shaped: the rise stops abruptly, the pass fades in and out', () => {
  for (const [name, opts] of [['airRise', {}], ['airPass', {}], ['airRise', {dur: 0.5, seed: 5, lo: 300, hi: 2000}]]) {
    const a = toStereo(renderSound(name, opts)), b = toStereo(renderSound(name, opts));
    assert.equal(a.left.length, Math.round((opts.dur ?? 0.9) * SAMPLE_RATE));
    assert.ok(a.left.every((x, i) => x === b.left[i]) && a.right.every((x, i) => x === b.right[i]), `${name} is deterministic`);
    assert.ok(a.left.every(Number.isFinite) && peakOf(a) > 0.3 && peakOf(a) <= 0.95, `${name} stays inside range`);
  }
  const rise = toStereo(renderSound('airRise')), pass = toStereo(renderSound('airPass'));
  const tail = (voice, ms) => Math.max(...Array.from(voice.left.slice(-Math.round(SAMPLE_RATE * ms / 1000)), Math.abs));
  assert.ok(Math.abs(rise.left.at(-1)) < 0.02, 'the rise ends on silence, so it can land under a thud');
  assert.ok(tail(rise, 150) > 0.2, 'but it is loud just before the end');
  assert.ok(tail(pass, 40) < 0.1 && Math.abs(pass.left[0]) < 0.01, 'the pass fades in and out');
  assert.notDeepEqual(Array.from(pass.left.slice(0, 2000)), Array.from(pass.right.slice(0, 2000)), 'it moves across the stereo field');
});

test('the one-shot palette names real recipes, with lead-ins shorter than their recipes', async () => {
  const palette = await loadStylePalette('one-shot');
  const used = Object.fromEntries(Object.entries(palette.entries).map(([kind, entry]) => [kind, entry.recipe?.id]));
  assert.deepEqual(used, {transition: 'air-rise', stamp: 'sub-thud', swap: 'air-pass', click: 'cursor-click', count: 'ui-click', reveal: 'soft-pop', type: 'ui-click'});
  for (const entry of Object.values(palette.entries)) assert.ok(entry.leadSec < entry.recipe.duration);
  assert.ok(palette.entries.stamp.gain < palette.entries.transition.gain, 'the landing stays under the air');
});

test('the automatic sounds of the demo take mix into one bounded stem with a sound in most seconds', async () => {
  const edit = normalizeGraphicsSpec(demo());
  const palette = await loadStylePalette('one-shot');
  const plan = autoSoundPlan(edit, palette);
  const hits = expandSoundEvents(plan.sounds, palette, 30);
  const {peak, placed} = mixHits(hits, 20);
  assert.equal(placed, hits.length);
  assert.ok(peak > 0.05 && peak < 1.5, `peak ${peak}`);
  const seconds = new Set(plan.sounds.map((sound) => Math.floor(sound.atFrame / 30)));
  assert.ok(seconds.size >= 12, `a sound begins in ${seconds.size} of 20 seconds`);
});
