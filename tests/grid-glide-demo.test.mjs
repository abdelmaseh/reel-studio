import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeGraphicsSpec} from '../scripts/lib/graphics-project.mjs';
import {assertDeliveryReady, autoSoundPlan} from '../scripts/lib/editor-director.mjs';
import {soundRecipe} from '../scripts/lib/job-sound.mjs';
import {loadStylePalette} from '../scripts/lib/sfx-events.mjs';
import {scanPublicationFile} from '../scripts/lib/publication-policy.mjs';
import {GRID_GLIDE_FAMILIES, gridGlideDipIssues, validateGridGlideTiming} from '../engine/src/styles/grid-glide/scenes/schema.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = 'instructions/examples/grid-glide-demo.json';
const text = () => readFileSync(path.join(root, SPEC), 'utf8');
const load = () => JSON.parse(text());
const glide = scenes => scenes.filter(scene => GRID_GLIDE_FAMILIES.includes(scene.family));

test('the Grid Glide demo is a valid source-free graphics specification of 15 to 20 seconds', () => {
  const edit = normalizeGraphicsSpec(load());
  assert.equal(edit.style, 'grid-glide');
  assert.equal(edit.contentMode, 'graphics');
  assert.equal(edit.presenter, false);
  const seconds = edit.source.totalFrames / edit.source.fps;
  assert.ok(seconds >= 15 && seconds <= 20, `duration ${seconds} s`);
  const families = edit.scenes.map(scene => scene.family);
  for (const family of GRID_GLIDE_FAMILIES) assert.ok(families.includes(family), `${family} is in the demo`);
  assert.deepEqual(families.slice(-2), ['glide-comment', 'glide-follow'], 'the style draws its own comment then follow endings');
  assert.equal(families.includes('comment') || families.includes('follow'), false, 'the shared endings show fixed English header lines');
  const card = edit.scenes.find(scene => scene.family === 'glide-card');
  assert.equal(card.data.bullets.length, 3);
  assert.equal(card.data.media.clips.length, 2);
  assert.ok(edit.scenes.some(scene => scene.data.box), 'one box line');
  assert.equal(glide(edit.scenes).filter(scene => scene.data.exit.kind === 'dip').length, 1, 'one dip');
  assert.deepEqual(gridGlideDipIssues(edit.scenes), []);
  for (const scene of glide(edit.scenes)) assert.deepEqual(validateGridGlideTiming(scene, edit.source.fps), [], scene.id);
});

test('the demo ends with the profile keyword and the complete handle, and passes the delivery gate', () => {
  const raw = load();
  const edit = normalizeGraphicsSpec(raw, {delivery: true});
  assert.equal(assertDeliveryReady(edit).ok, true);
  const [comment, follow] = edit.scenes.slice(-2);
  assert.equal(comment.data.keyword, raw.creator.ending.cta, 'the keyword is the profile CTA');
  assert.equal(follow.data.handle, raw.creator.handle, 'the handle is the complete profile handle');
  assert.equal(follow.data.pill.label.length > 0 && follow.data.pill.logo === undefined, true, 'the follow pill has a label and no logo');
  assert.equal(comment.fromFrame + comment.durationInFrames, follow.fromFrame, 'the two endings follow each other');
  assert.equal(follow.fromFrame + follow.durationInFrames, edit.source.totalFrames, 'the follow card is the last scene');
});

test('the card captures match the files they declare', () => {
  const edit = normalizeGraphicsSpec(load());
  const clips = edit.scenes.find(scene => scene.family === 'glide-card').data.media.clips;
  for (const clip of clips) {
    assert.match(clip.src, /^examples\/glide-screen-[ab]\.png$/);
    const bytes = readFileSync(path.join(root, 'engine/public', clip.src));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), clip.sha256, `${clip.src} bytes`);
    assert.equal(bytes.readUInt32BE(16), clip.width, `${clip.src} width`);
    assert.equal(bytes.readUInt32BE(20), clip.height, `${clip.src} height`);
    assert.equal(clip.kind, 'image');
  }
});

test('its sounds are the opening boom plus the planner output for the Grid Glide palette', async () => {
  const raw = load();
  const edit = normalizeGraphicsSpec({...raw, sounds: []});
  const palette = await loadStylePalette('grid-glide');
  const plan = autoSoundPlan(edit, palette, {opening: await soundRecipe('sub-boom')});
  assert.deepEqual(raw.sounds, plan.sounds);
  assert.deepEqual(raw.sounds[0], {atFrame: 0, recipe: 'sub-boom', gain: palette.entries.transition.gain}, 'the opening boom comes first');
  const recipes = raw.sounds.map(sound => sound.recipe);
  assert.equal(recipes.filter(id => id === 'ui-click').length, 2, 'one click for the chapter pill and one for the follow pill');
  assert.equal(recipes.filter(id => id === 'sub-swell-hit').length, 1, 'one swell for the one dip');
  assert.ok(recipes.filter(id => id === 'sub-thump').length >= 3, 'thumps on the hard cuts');
  assert.deepEqual([...new Set(recipes)].filter(id => !['sub-boom', 'sub-thump', 'sub-thud', 'sub-swell-hit', 'ui-click'].includes(id)), [], 'only the five low voices');
});

test('the demo contains no personal or third-party material', () => {
  const body = text();
  assert.deepEqual(scanPublicationFile(SPEC, Buffer.from(body)), []);
  assert.equal(/https?:\/\//i.test(body), false);
  assert.deepEqual([...body.matchAll(/@[A-Za-z0-9_.]+/g)].map(match => match[0]).filter(handle => handle !== '@example.creator'), []);
  assert.equal(/[A-Za-z]:[\\/]/.test(body), false);
});
