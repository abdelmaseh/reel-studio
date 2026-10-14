import test from 'node:test';
import assert from 'node:assert/strict';
import {glideVideoSources} from '../engine/src/styles/grid-glide/scenes/media.ts';
import {preparedPlateList} from '../engine/src/prepared-edit/plates.ts';
import {graphicsTransitionIssues} from '../engine/src/prepared-edit/graphics-transitions.ts';
import {manifestFootage} from '../scripts/lib/delivery-gates.mjs';

const media = (name, kind, extra = {}) => ({at: 0, src: `projects/example/${name}`, sha256: 'a'.repeat(64), width: 1280, height: 720, kind, ...extra});
const card = (clips) => ({id: 'card-1', family: 'glide-card', fromFrame: 0, durationInFrames: 120, layout: 'takeover', motion: 'quiet',
  data: {lines: [], media: {clips}, bullets: [], enter: {kind: 'cut'}, exit: {kind: 'cut'}}});
const withVideo = card([media('a.png', 'image'), media('b.mp4', 'video', {at: 30}), media('b.mp4', 'video', {at: 60}), media('c.mov', 'video', {at: 90})]);
const imagesOnly = card([media('a.png', 'image'), media('d.png', 'image', {at: 30})]);

test('glideVideoSources lists each mounted video once and ignores other families', () => {
  assert.deepEqual(glideVideoSources(withVideo), ['projects/example/b.mp4', 'projects/example/c.mov']);
  assert.deepEqual(glideVideoSources(imagesOnly), []);
  assert.deepEqual(glideVideoSources({family: 'screens', data: {steps: [{kind: 'video', src: 'x.mp4'}]}}), []);
  assert.deepEqual(glideVideoSources({family: 'glide-card'}), []);
  assert.deepEqual(glideVideoSources(undefined), []);
});

test('the plate list declares glide-card videos beside the presenter plate', () => {
  assert.deepEqual(preparedPlateList({scenes: [withVideo]}, '_prepared/example/plate.mp4'),
    ['_prepared/example/plate.mp4', 'projects/example/b.mp4', 'projects/example/c.mov']);
  assert.deepEqual(preparedPlateList({scenes: [imagesOnly]}, '_prepared/example/plate.mp4'), ['_prepared/example/plate.mp4']);
});

test('the delivery gate finds glide-card videos in the manifest', () => {
  const props = {plate: {src: '_prepared/example/plate.mp4'}, edit: {scenes: [withVideo, imagesOnly]}};
  assert.deepEqual(manifestFootage(props), ['_prepared/example/plate.mp4', 'projects/example/b.mp4', 'projects/example/c.mov']);
});

test('whip-pan is refused over glide-card video and allowed over stills', () => {
  const whip = [{atFrame: 0, durationInFrames: 10, kind: 'whip-pan', dir: 'rtl'}];
  assert.match(graphicsTransitionIssues(whip, [withVideo]).join('|'), /would decode scene card-1's video/);
  assert.deepEqual(graphicsTransitionIssues(whip, [imagesOnly]), []);
});
