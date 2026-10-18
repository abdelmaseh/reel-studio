import test from 'node:test';
import assert from 'node:assert/strict';
import {styleSceneVideoSources} from '../engine/src/styles/scenes.ts';
import {styleSceneVideoSources as lightVideoSources} from '../engine/src/styles/media.ts';
import {preparedPlateList} from '../engine/src/prepared-edit/plates.ts';
import {graphicsTransitionIssues} from '../engine/src/prepared-edit/graphics-transitions.ts';
import {manifestFootage} from '../scripts/lib/delivery-gates.mjs';
import {cartoonSceneSchema, cartoonAssetClaims, validateCartoonTiming} from '../engine/src/styles/cartoon/scenes/schema.ts';
import {bodyScene} from './helpers/cartoon-fixtures.mjs';

const clip = {src: 'cartoon/screen.mp4', sha256: 'b'.repeat(64), width: 1920, height: 1080, kind: 'video'};
const monitorCard = (data = {}) => ({id: 'm', kind: 'monitor', from: {word: 0}, to: {word: 3}, data: {clip, crop: {x: 0, y: 0, w: 1920}, label: 'my screen', ...data}});
const monitor = {id: 'body', family: 'cartoon', fromFrame: 0, durationInFrames: 100, layout: 'takeover', motion: 'quiet', data: {cards: [monitorCard()]}};

test('the monitor clip is a moving source at every site that lists footage', () => {
  assert.deepEqual(styleSceneVideoSources(monitor), ['cartoon/screen.mp4']);
  assert.deepEqual(lightVideoSources(monitor), ['cartoon/screen.mp4'], 'the same list from the Node-safe module without zod');
  assert.deepEqual(styleSceneVideoSources({family: 'glide-card', data: {media: {clips: [{kind: 'video', src: 'g.mp4'}]}}}), ['g.mp4']);
  assert.deepEqual(styleSceneVideoSources({...monitor, data: {cards: [monitorCard({clip: {...clip, kind: 'image', src: 'cartoon/shot.png'}})]}}), [], 'an image is not a moving source');
  assert.deepEqual(preparedPlateList({scenes: [monitor]}, '_prepared/x/plate.mp4'), ['_prepared/x/plate.mp4', 'cartoon/screen.mp4']);
  assert.ok(manifestFootage({plate: {src: '_prepared/x/plate.mp4'}, edit: {scenes: [monitor]}}).some((name) => name.includes('screen')));
  // A whip-pan cannot enter a scene that mounts video (it would decode it once per echo): the predicate must see the monitor clip.
  const whip = [{atFrame: 0, durationInFrames: 10, kind: 'whip-pan'}];
  assert.match(graphicsTransitionIssues(whip, [monitor]).join('|'), /would decode scene body/);
  assert.deepEqual(graphicsTransitionIssues(whip, [{...monitor, data: {cards: []}}]), []);
});

test('monitor claims count the trimmed lead-in, and the crop and scale limits hold', () => {
  const scene = cartoonSceneSchema.parse(bodyScene({cards: [monitorCard({trimBeforeFrame: 12})]}));
  const [claim] = cartoonAssetClaims(scene);
  assert.equal(claim.frames, 12 + scene.durationInFrames);
  assert.deepEqual(validateCartoonTiming(scene, 30), []);
  const outside = cartoonSceneSchema.parse(bodyScene({cards: [monitorCard({crop: {x: 400, y: 0, w: 1920}})]}));
  assert.match(validateCartoonTiming(outside, 30).join('|'), /leaves the 1920x1080 file/);
  const enlarged = cartoonSceneSchema.parse(bodyScene({cards: [monitorCard({crop: {x: 0, y: 0, w: 600}})]}));
  assert.match(validateCartoonTiming(enlarged, 30).join('|'), /limit is 1\.25/);
  assert.equal(cartoonSceneSchema.safeParse(bodyScene({cards: [monitorCard({clip: {...clip, src: '../escape.mp4'}})]})).success, false, 'no parent paths');
});
