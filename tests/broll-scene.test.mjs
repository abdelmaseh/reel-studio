import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyKineticAssets} from '../scripts/lib/prepared-props.mjs';
import {sceneCues} from '../scripts/lib/scene-cues.mjs';
import {soundCandidateFor} from '../scripts/lib/editor-director.mjs';
import {editManifestSchema, editSceneSchema} from '../engine/src/prepared-edit/schema.ts';
import {kineticSceneSchema, validateKineticTiming} from '../engine/src/creative-kit/kinetic/schema.ts';
import {sceneClipClaims, sceneVideoSources} from '../engine/src/core/scene-media.ts';
import {familyDataSchema, fieldsForFamily, toJsonSchema, validateData} from '../engine/src/review-editor/panels/form-schema.ts';
import {reviewManifest} from './helpers/review-manifest.mjs';
import {realClip} from './helpers/clip-fixtures.mjs';

const clip = (extra = {}) => ({src: 'projects/example/a.mp4', sha256: 'a'.repeat(64), width: 1080, height: 1920, trimBeforeFrame: 0, fit: 'cover', ...extra});
const broll = (steps, extra = {}) => ({id: 'broll-1', family: 'screens', fromFrame: 0, durationInFrames: 90, layout: 'takeover', motion: 'quiet', data: {look: 'broll', steps}, ...extra});
const windowScreens = (extra = {}) => ({id: 'screens-1', family: 'screens', fromFrame: 0, durationInFrames: 120, layout: 'takeover', motion: 'quiet',
  data: {kicker: 'شاشات', steps: [{atFrame: 0, title: 'الأولى', src: 'projects/example/a.png', kind: 'image', fit: 'contain', trimBeforeFrame: 0},
    {atFrame: 60, title: 'الثانية', src: 'projects/example/b.mp4', kind: 'video', fit: 'cover', trimBeforeFrame: 0}]}, ...extra});

test('a screens scene still parses in its original look and gains nothing', () => {
  const parsed = editSceneSchema.safeParse(windowScreens());
  assert.equal(parsed.success, true, parsed.error?.message);
  assert.equal('look' in parsed.data.data, false);
});

test('the broll look takes one to six verified clips with an optional short label', () => {
  assert.equal(editSceneSchema.safeParse(broll([{atFrame: 0, ...clip(), label: 'Office'}])).success, true);
  const six = Array.from({length: 6}, (_, i) => ({atFrame: i * 10, ...clip({src: `projects/example/${i}.mp4`})}));
  assert.equal(editSceneSchema.safeParse(broll(six)).success, true);
  for (const bad of [[], [...six, {atFrame: 60, ...clip()}], [{atFrame: 0, ...clip(), label: 'x'.repeat(61)}], [{atFrame: 0, ...clip({src: 'projects/example/a.mov'})}],
    [{atFrame: 0, ...clip(), title: 'no titles in broll'}], [{atFrame: 0, ...clip({sha256: 'short'})}]]) {
    assert.equal(editSceneSchema.safeParse(broll(bad)).success, false, JSON.stringify(bad).slice(0, 90));
  }
  assert.equal(editSceneSchema.safeParse({...broll([{atFrame: 0, ...clip()}]), data: {look: 'broll', steps: [{atFrame: 0, ...clip()}], kicker: 'x'}}).success, false);
});

test('the first broll clip starts at zero and later clips are strictly ordered', () => {
  const scene = (steps) => kineticSceneSchema.parse(broll(steps));
  assert.deepEqual(validateKineticTiming(scene([{atFrame: 0, ...clip()}, {atFrame: 30, ...clip()}])), []);
  assert.match(validateKineticTiming(scene([{atFrame: 5, ...clip()}])).join('|'), /first screen must start at zero/);
  assert.match(validateKineticTiming(scene([{atFrame: 0, ...clip()}, {atFrame: 0, ...clip()}])).join('|'), /strictly ordered/);
});

test('the editor form offers both looks of screens and recognises the clip step', () => {
  const [root] = fieldsForFamily('screens');
  assert.equal(root.kind, 'union');
  assert.equal(root.variants.length, 2);
  assert.equal(validateData('screens', {look: 'broll', steps: [{atFrame: 0, ...clip()}]}).ok, true);
  assert.equal(validateData('screens', windowScreens().data).ok, true);
  const stepsOf = (look) => toJsonSchema(familyDataSchema('screens')).anyOf.find((branch) => branch.properties.look.const === look).properties.steps.items;
  assert.equal(stepsOf('broll')['x-reel-clip'], true, 'the B-roll step carries the marker the editor reads to show the clip picker');
  assert.equal(stepsOf('window')['x-reel-clip'], undefined, 'the window look keeps plain file fields');
});

test('every broll clip is a moving source and carries a claim for the prepare check', () => {
  const scene = broll([{atFrame: 0, ...clip()}, {atFrame: 30, ...clip({src: 'projects/example/b.mp4', trimBeforeFrame: 15})}]);
  assert.deepEqual(sceneVideoSources(scene), ['projects/example/a.mp4', 'projects/example/b.mp4']);
  assert.deepEqual(sceneClipClaims(scene).map((c) => [c.src, c.trimBeforeFrame, c.frames]), [['projects/example/a.mp4', 0, 30], ['projects/example/b.mp4', 15, 60]]);
  assert.deepEqual(sceneVideoSources(windowScreens()), ['projects/example/b.mp4'], 'the window look still lists only its video steps');
});

test('a broll scene gets no automatic sound cue at all, while the window look keeps its cues', () => {
  assert.deepEqual(sceneCues(broll([{atFrame: 0, ...clip()}, {atFrame: 30, ...clip()}]), 30), []);
  assert.deepEqual(sceneCues(windowScreens(), 30).map((cue) => `${cue.frame}:${cue.kind}`), ['0:transition', '60:swap']);
  assert.equal(soundCandidateFor(broll([{atFrame: 0, ...clip()}])), undefined);
  assert.equal(soundCandidateFor(windowScreens()), 'soft-transition');
});

const manifestWith = (scenes, change = {}) => {
  const m = reviewManifest('broll-manifest');
  m.style = 'split-canvas';
  m.source.totalFrames = 900;
  m.segments = [{fromFrame: 0, toFrame: 900}];
  m.scenes = scenes;
  return Object.assign(m, change);
};
const issuesOf = (m) => {
  const result = editManifestSchema.safeParse(m);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

test('a broll scene is accepted in a style that has a screen to give', () => {
  assert.deepEqual(issuesOf(manifestWith([broll([{atFrame: 0, ...clip()}])])), []);
});

test('a broll scene is refused in the styles that draw their own screen', () => {
  for (const style of ['cartoon', 'one-shot', 'grid-glide']) {
    assert.ok(issuesOf(manifestWith([broll([{atFrame: 0, ...clip()}])], {style})).some((message) => message.includes(`B-roll is not available in the ${style} style`)), style);
  }
});

test('a broll scene must end before the sign-off and cannot sit on or after an ending scene', () => {
  assert.ok(issuesOf(manifestWith([broll([{atFrame: 0, ...clip()}], {durationInFrames: 200})], {signoffFromFrame: 150})).some((message) => /must end before the recorded sign-off/.test(message)));
  const ending = {id: 'cta-1', family: 'creator-cta', fromFrame: 90, durationInFrames: 90, layout: 'presenter', motion: 'quiet',
    data: {title: 'اكتب', keyword: 'دليل', prompt: 'اكتب {keyword}', handle: '@reel.studio', followFrame: 30, clickedFrame: 60}};
  const after = broll([{atFrame: 0, ...clip()}], {id: 'broll-2', fromFrame: 200, durationInFrames: 60});
  assert.ok(issuesOf(manifestWith([ending, after])).some((message) => /cannot sit on or after the ending scenes/.test(message)));
});

test('a broll clip is refused beyond exactly 1.25x, and contain is no exemption for a clip that is still enlarged', () => {
  const enlarged = (width, height, fit = 'cover') => issuesOf(manifestWith([broll([{atFrame: 0, ...clip({width, height, fit})}])])).filter((message) => /enlarged/.test(message));
  assert.deepEqual(enlarged(864, 1536), [], '864x1536 fills the 1080x1920 box at exactly 1.25x');
  assert.match(enlarged(860, 1529).join('|'), /enlarged 1\.26x in its 1080x1920 box/, '860x1529 needs a little more than 1.25x');
  assert.match(enlarged(1920, 1080).join('|'), /enlarged 1\.78x in its 1080x1920 box/, 'a wide clip covering the portrait box is enlarged');
  assert.deepEqual(enlarged(1920, 1080, 'contain'), [], 'contained, the same wide clip shrinks to fit');
  assert.match(enlarged(540, 960, 'contain').join('|'), /enlarged 2\.00x in its 1080x1920 box/, 'contained, a small clip is still enlarged to fit');
});

const source = {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 600};
const stepOf = (file, extra = {}) => ({atFrame: 0, src: file.src, sha256: file.sha256, width: file.width ?? 1080, height: file.height ?? 1920, trimBeforeFrame: 0, fit: 'cover', ...extra});

test('prepare verifies broll clips against the real files, step by step', async (t) => {
  const {clip: real} = await realClip(t, {name: 'broll-prepare'});
  const check = (steps, durationInFrames = 90) => verifyKineticAssets({source, scenes: [broll(steps, {durationInFrames})]});
  const assets = await check([stepOf(real)]);
  assert.deepEqual(assets.map((asset) => asset.sha256), [real.sha256]);
  await assert.rejects(check([stepOf(real, {sha256: 'b'.repeat(64)})]), /hash|bytes/i);
  await assert.rejects(check([stepOf(real, {height: 1900})]), /dimension/i);
  await assert.rejects(check([stepOf(real), stepOf(real, {atFrame: 60, trimBeforeFrame: 70})]), /too short/i, 'the second clip needs 70 + 30 frames and the file has 90');
  await assert.rejects(check([stepOf(real)], 200), /too short/i);
});

test('prepare measures a split B-roll scene against the style seam when the manifest has no footage', async (t) => {
  const {clip: real} = await realClip(t, {name: 'broll-split-prepare'});
  const split = (steps, extra = {}) => broll(steps, {layout: 'split', ...extra});
  const edit = (scenes, change = {}) => ({style: 'split-canvas', source, scenes, ...change});
  const tooSmall = stepOf({src: 'projects/none/small.mp4', sha256: 'c'.repeat(64)}, {width: 540, height: 960});
  // The split-canvas seam is 768, so the box above it is 1080x768. The refusal comes before any file is read.
  await assert.rejects(verifyKineticAssets(edit([split([tooSmall])])), /broll-1 step 1: the clip would be enlarged 2\.00x in its 1080x768 box \(limit 1\.25x\); use fit "contain" or a larger clip\./);
  await assert.rejects(verifyKineticAssets(edit([split([tooSmall]), split([tooSmall], {id: 'broll-2', fromFrame: 100})])), (error) => /broll-1 step 1/.test(error.message) && /broll-2 step 1/.test(error.message), 'every scene is reported');
  assert.deepEqual((await verifyKineticAssets(edit([split([stepOf(real)])]))).map((asset) => asset.sha256), [real.sha256], 'a portrait clip fills the box and is accepted');
  const other = await verifyKineticAssets(edit([split([stepOf(real)])], {style: 'section-deck'}));
  assert.equal(other.length, 1, 'another style uses its own seam');
  await assert.rejects(verifyKineticAssets(edit([split([tooSmall])], {footage: {split: {windowTop: 800}}})), (error) => !/enlarged/.test(error.message), 'with footage the manifest rule already measured it, so prepare does not measure again');
  await assert.rejects(verifyKineticAssets(edit([broll([tooSmall])])), (error) => !/enlarged/.test(error.message), 'a full-screen scene is unchanged');
});

test('prepare refuses a broll clip with sound or another frame rate even when its hash and size are right', async (t) => {
  const {raw} = await realClip(t, {name: 'broll-media'});
  const loud = await raw('loud.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3'],
    ['-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p', '-shortest']);
  await assert.rejects(verifyKineticAssets({source, scenes: [broll([stepOf(loud)])]}), /audio track/i);
  const slow = await raw('slow.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=24:duration=4'], ['-c:v', 'libx264', '-pix_fmt', 'yuv420p']);
  await assert.rejects(verifyKineticAssets({source, scenes: [broll([stepOf(slow)])]}), /runs at 24 fps but the edit runs at 30 fps/);
});
