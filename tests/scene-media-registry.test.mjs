import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sceneMovingSources, sceneVideoSources} from '../engine/src/core/scene-media.ts';
import {preparedPlateList} from '../engine/src/prepared-edit/plates.ts';
import {graphicsTransitionIssues} from '../engine/src/prepared-edit/graphics-transitions.ts';
import {manifestFootage} from '../scripts/lib/delivery-gates.mjs';
import {editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {reviewManifest} from './helpers/review-manifest.mjs';

const scene = (family, data) => ({id: `${family}-1`, family, fromFrame: 0, durationInFrames: 120, layout: 'takeover', motion: 'quiet', data});
const hook = scene('kinetic-hook', {foreground: {src: 'projects/x/matte.mp4'}});
const screens = scene('screens', {kicker: 'k', steps: [{atFrame: 0, kind: 'image', src: 'projects/x/a.png'}, {atFrame: 30, kind: 'video', src: 'projects/x/b.mp4'}, {atFrame: 60, kind: 'video', src: 'projects/x/b.mp4'}]});
const stillScreens = scene('screens', {kicker: 'k', steps: [{atFrame: 0, kind: 'image', src: 'projects/x/a.png'}]});
const focus = scene('screen-focus', {steps: [{atFrame: 0, kind: 'video', src: 'projects/x/c.mp4'}, {atFrame: 30, kind: 'image', src: 'projects/x/d.png'}]});
const glide = scene('glide-card', {lines: [], media: {clips: [{at: 0, src: 'projects/x/e.mp4', sha256: 'a'.repeat(64), width: 64, height: 36, kind: 'video'}]}, bullets: [], enter: {kind: 'cut'}, exit: {kind: 'cut'}});
const plain = scene('statement', {kicker: 'k', title: 't'});
const hookWithoutForeground = scene('kinetic-hook', {});
const clipOf = (src) => ({src, sha256: 'a'.repeat(64), width: 1080, height: 1920, trimBeforeFrame: 0, fit: 'cover'});
const broll = scene('screens', {look: 'broll', steps: [{atFrame: 0, ...clipOf('projects/x/f.mp4')}, {atFrame: 30, ...clipOf('projects/x/g.mp4')}]});
const projectScenes = {pack: 'Projects/wire-test/scene-pack.json', scenes: [{id: 'bg-clip', label: 'Clip background', entry: 'scenes/BgClip.tsx',
  fields: [{key: 'title', type: 'string', required: true, max: 40}, {key: 'background', type: 'clip'}]}]};
const projectWithClip = scene('project-scene', {component: 'bg-clip', values: {title: 'x', background: clipOf('projects/x/h.mp4')}});
const projectWithoutClip = scene('project-scene', {component: 'bg-clip', values: {title: 'x'}});

test('each family reports its moving files, split into presenter mattes and captures', () => {
  assert.deepEqual(sceneMovingSources(hook), {foreground: ['projects/x/matte.mp4'], captures: []});
  assert.deepEqual(sceneMovingSources(screens), {foreground: [], captures: ['projects/x/b.mp4', 'projects/x/b.mp4']});
  assert.deepEqual(sceneMovingSources(focus), {foreground: [], captures: ['projects/x/c.mp4']});
  assert.deepEqual(sceneMovingSources(glide), {foreground: [], captures: ['projects/x/e.mp4']});
  for (const quiet of [stillScreens, plain, hookWithoutForeground, {family: 'screens'}, {family: 'screens', data: null}, {family: 'screens', data: {steps: 'x'}}]) {
    assert.deepEqual(sceneMovingSources(quiet), {foreground: [], captures: []});
  }
});

test('sceneVideoSources lists each file once, foreground first', () => {
  assert.deepEqual(sceneVideoSources(screens), ['projects/x/b.mp4']);
  assert.deepEqual(sceneVideoSources(hook), ['projects/x/matte.mp4']);
  assert.deepEqual(sceneVideoSources(plain), []);
});

test('the plate list puts every foreground before every capture, as before', () => {
  assert.deepEqual(preparedPlateList({scenes: [screens, hook, focus, glide, plain]}, '_prepared/x/plate.mp4'),
    ['_prepared/x/plate.mp4', 'projects/x/matte.mp4', 'projects/x/b.mp4', 'projects/x/c.mp4', 'projects/x/e.mp4']);
});

test('the delivery footage gate lists files scene by scene, as before', () => {
  const props = {plate: {src: '_prepared/x/plate.mp4'}, edit: {scenes: [screens, hook, focus, glide, plain, 'junk']}};
  assert.deepEqual(manifestFootage(props), ['_prepared/x/plate.mp4', 'projects/x/b.mp4', 'projects/x/matte.mp4', 'projects/x/c.mp4', 'projects/x/e.mp4']);
});

test('whip-pan is refused over every family that mounts video and allowed over stills', () => {
  const whip = [{atFrame: 0, durationInFrames: 10, kind: 'whip-pan', dir: 'rtl'}];
  for (const video of [screens, hook, focus, glide]) assert.match(graphicsTransitionIssues(whip, [video]).join('|'), /would decode scene .*video/, video.family);
  for (const still of [stillScreens, plain, hookWithoutForeground]) assert.deepEqual(graphicsTransitionIssues(whip, [still]), [], still.family);
});

test('B-roll steps and project-scene clips are moving sources, and a project scene needs its contracts to be seen', () => {
  assert.deepEqual(sceneMovingSources(broll), {foreground: [], captures: ['projects/x/f.mp4', 'projects/x/g.mp4']});
  assert.deepEqual(sceneMovingSources(projectWithClip, projectScenes), {foreground: [], captures: ['projects/x/h.mp4']});
  assert.deepEqual(sceneMovingSources(projectWithClip), {foreground: [], captures: []}, 'without the contracts the registry cannot tell which fields are clips');
  assert.deepEqual(sceneMovingSources(projectWithoutClip, projectScenes), {foreground: [], captures: []});
  assert.deepEqual(sceneVideoSources(projectWithClip, projectScenes), ['projects/x/h.mp4']);
});

test('the plate list includes B-roll clips and project-scene clips', () => {
  const plates = ['_prepared/x/plate.mp4', 'projects/x/f.mp4', 'projects/x/g.mp4', 'projects/x/h.mp4'];
  assert.deepEqual(preparedPlateList({scenes: [broll, projectWithClip, plain], projectScenes}, '_prepared/x/plate.mp4'), plates);
  assert.deepEqual(preparedPlateList({scenes: [broll, projectWithClip, plain]}, '_prepared/x/plate.mp4'), plates.slice(0, 3), 'a project-scene clip is found only with the contracts');
});

test('the delivery footage gate lists B-roll clips and project-scene clips', () => {
  const props = {plate: {src: '_prepared/x/plate.mp4'}, edit: {scenes: [broll, projectWithClip, plain], projectScenes}};
  assert.deepEqual(manifestFootage(props), ['_prepared/x/plate.mp4', 'projects/x/f.mp4', 'projects/x/g.mp4', 'projects/x/h.mp4']);
  assert.deepEqual(manifestFootage({...props, edit: {scenes: props.edit.scenes}}), ['_prepared/x/plate.mp4', 'projects/x/f.mp4', 'projects/x/g.mp4']);
});

test('whip-pan is refused over B-roll and over a project scene with a clip, and allowed over a project scene without one', () => {
  const whip = [{atFrame: 0, durationInFrames: 10, kind: 'whip-pan', dir: 'rtl'}];
  assert.match(graphicsTransitionIssues(whip, [broll]).join('|'), /would decode scene screens-1's video/);
  assert.match(graphicsTransitionIssues(whip, [projectWithClip], projectScenes).join('|'), /would decode scene project-scene-1's video/);
  assert.deepEqual(graphicsTransitionIssues(whip, [projectWithoutClip], projectScenes), []);
  // The manifest rule (engine/src/prepared-edit/schema.ts) must hand the contracts to that function, or a project-scene clip would be decoded once per echo.
  const issuesOf = (scenes, withContracts = true) => {
    const m = reviewManifest('wire-test');
    Object.assign(m, {style: 'section-deck', scenes, transitions: whip, ...(withContracts ? {projectScenes} : {})});
    m.source.totalFrames = 900;
    m.segments = [{fromFrame: 0, toFrame: 900}];
    const parsed = editManifestSchema.safeParse(m);
    return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
  };
  assert.deepEqual(issuesOf([broll]).filter((message) => /whip-pan/.test(message)), ["whip-pan at 0 would decode scene screens-1's video once per echo (core/mblur.tsx); use clip-wipe or light-scan."]);
  assert.deepEqual(issuesOf([projectWithClip]).filter((message) => /whip-pan/.test(message)), ["whip-pan at 0 would decode scene project-scene-1's video once per echo (core/mblur.tsx); use clip-wipe or light-scan."]);
  assert.deepEqual(issuesOf([projectWithoutClip]), [], 'the same transition over a project scene without a clip is fine');
});

test('the former hand-kept lists read the one registry', async () => {
  for (const file of ['scripts/lib/prepared-props.mjs', 'scripts/lib/delivery-gates.mjs', 'engine/src/prepared-edit/plates.ts', 'engine/src/prepared-edit/graphics-transitions.ts']) {
    assert.match(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'), /core\/scene-media\.ts/, file);
  }
});
