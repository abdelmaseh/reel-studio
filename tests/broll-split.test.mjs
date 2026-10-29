import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {profileToBrief} from '../scripts/lib/branding.mjs';
import {buildEditorPlan} from '../scripts/lib/editor-director.mjs';
import {editManifestSchema, editSceneSchema} from '../engine/src/prepared-edit/schema.ts';
import {clipEnlargementIssue} from '../engine/src/core/clip-schema.ts';
import {brollSplitIssues} from '../engine/src/prepared-edit/broll.ts';
import {allowedLayouts} from '../engine/src/review-editor/ops/scenes.ts';
import {bundleEngine, setSsrFps, setSsrFrame} from './helpers/engine-bundle.mjs';
import {reviewManifest} from './helpers/review-manifest.mjs';

const clip = (extra = {}) => ({src: 'projects/example/a.mp4', sha256: 'a'.repeat(64), width: 1080, height: 1920, trimBeforeFrame: 0, fit: 'cover', ...extra});
const broll = (steps, extra = {}) => ({id: 'broll-1', family: 'screens', fromFrame: 0, durationInFrames: 90, layout: 'split', motion: 'quiet', data: {look: 'broll', steps}, ...extra});
const windowScreens = (extra = {}) => ({id: 'screens-1', family: 'screens', fromFrame: 0, durationInFrames: 120, layout: 'takeover', motion: 'quiet',
  data: {kicker: 'شاشات', steps: [{atFrame: 0, title: 'الأولى', src: 'projects/example/a.png', kind: 'image', fit: 'contain', trimBeforeFrame: 0}]}, ...extra});

test('the split layout belongs to the broll look only', () => {
  assert.equal(editSceneSchema.safeParse(broll([{atFrame: 0, ...clip()}])).success, true);
  const refused = editSceneSchema.safeParse(windowScreens({layout: 'split'}));
  assert.equal(refused.success, false);
  assert.match(refused.error.issues.map((issue) => issue.message).join('|'), /Only the B-roll look of screens supports the split layout/);
  assert.equal(editSceneSchema.safeParse(windowScreens()).success, true);
});

test('the editor offers split for broll and keeps the window look full screen', () => {
  assert.deepEqual(allowedLayouts(broll([{atFrame: 0, ...clip()}], {layout: 'takeover'})), ['split', 'takeover']);
  assert.deepEqual(allowedLayouts(windowScreens()), ['takeover']);
});

const profile = JSON.parse(await readFile(new URL('../PROFILE.example.json', import.meta.url), 'utf8'));
const source = {path: 'Raw/synthetic.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 720};
const words = [{text: '12', startMs: 6000, endMs: 6400, confidence: 1}];
const brief = (beat = {}) => ({version: 1, id: 'broll-split-test', source: source.path, transcript: 'Projects/broll-split-test/words.json', ...profileToBrief(profile),
  purpose: 'explainer', tone: 'calm', style: 'section-deck', captionsReviewedBy: 'Creator',
  beats: [{id: 'clip', fromSec: 0, toSec: 2, intent: 'screens', data: {look: 'broll', steps: [{atFrame: 0, ...clip()}]}, ...beat}]});

test('a screens beat without a layout stays full screen, and may ask for split', () => {
  assert.equal(buildEditorPlan(brief(), source, words).manifest.scenes[0].layout, 'takeover');
  assert.equal(buildEditorPlan(brief({layout: 'split'}), source, words).manifest.scenes[0].layout, 'split');
});

const geometry = {windowTop: 0, windowHeight: 1920, videoWidth: 1080, videoLeft: 0, videoTop: 0};
const footage = {defaultLayout: 'split', full: geometry, split: {...geometry, windowTop: 800, windowHeight: 1120}};
const manifestWith = (scenes, change = {}) => {
  const m = reviewManifest('broll-split-manifest');
  m.style = 'section-deck';
  m.source.totalFrames = 900;
  m.segments = [{fromFrame: 0, toFrame: 900}];
  m.scenes = scenes;
  m.footage = footage;
  return Object.assign(m, change);
};
const issuesOf = (m) => {
  const result = editManifestSchema.safeParse(m);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

test('split B-roll is measured against the box above the presenter window', () => {
  assert.deepEqual(issuesOf(manifestWith([broll([{atFrame: 0, ...clip({width: 1920, height: 1080})}])])), [], 'a wide clip fits the 1080x800 box');
  assert.ok(issuesOf(manifestWith([broll([{atFrame: 0, ...clip({width: 540, height: 960})}])])).some((message) => /enlarged 2\.00x in its 1080x800 box/.test(message)));
});

const withoutFootage = (scenes, change = {}) => {
  const m = manifestWith(scenes, change);
  delete m.footage;
  return m;
};
const enlargementOf = (m) => {
  const found = issuesOf(m).filter((message) => /enlarged/.test(message));
  assert.equal(found.length, 1, found.join('|'));
  return found[0];
};

test('a split B-roll scene in a manifest without footage is not measured against a guessed box', () => {
  const wide = {width: 1920, height: 1080};
  assert.deepEqual(issuesOf(withoutFootage([broll([{atFrame: 0, ...clip(wide)}])])), [], 'the renderer draws the style seam and prepare measures it; this module does not know it');
  assert.deepEqual(issuesOf(withoutFootage([broll([{atFrame: 0, ...clip({width: 540, height: 960})}])])), [], 'not even a clip that is certainly too small: the seam decides');
});

test('a split B-roll scene still needs the presenter on screen when the manifest has no footage', () => {
  assert.ok(issuesOf(withoutFootage([broll([{atFrame: 0, ...clip()}])], {presenter: false})).some((message) => /needs the presenter on screen/.test(message)));
});

test('a split B-roll clip that is too small for its box suggests contain or a larger clip, not the split layout it already uses', () => {
  const message = enlargementOf(manifestWith([broll([{atFrame: 0, ...clip({width: 540, height: 960})}])]));
  assert.match(message, /enlarged 2\.00x in its 1080x800 box/);
  assert.doesNotMatch(message, /use the split layout/);
  assert.match(message, /\(limit 1\.25x\); use fit "contain" or a larger clip\.$/);
});

test('a full-screen B-roll scene keeps measuring in the whole frame and still suggests the split layout', () => {
  const wide = {width: 1920, height: 1080};
  assert.equal(enlargementOf(manifestWith([broll([{atFrame: 0, ...clip(wide)}], {layout: 'takeover'})])),
    'broll-1 step 1: the clip would be enlarged 1.78x in its 1080x1920 box (limit 1.25x); use the split layout, fit "contain" or a larger clip.');
});

test('the enlargement hint lists only the remedies that still apply', () => {
  const box = {width: 1080, height: 1920};
  const wide = {width: 1920, height: 1080, fit: 'cover'};
  const hint = (options) => clipEnlargementIssue(wide, box, 'scene step 1', options).split('(limit 1.25x); ')[1];
  assert.equal(hint(), 'use the split layout, fit "contain" or a larger clip.', 'with no options the text is the one that existed before');
  assert.equal(hint({split: true}), 'use fit "contain" or a larger clip.', 'a split scene is not told to use the split layout');
  assert.equal(hint({canSplit: true}), 'use the split layout, fit "contain" or a larger clip.');
  assert.equal(hint({canSplit: false}), 'use fit "contain" or a larger clip.', 'an edit without the presenter on screen cannot split');
  assert.equal(hint({contain: true}), 'use the split layout or a larger clip.', 'a clip that is already contained is not told to use contain');
  assert.equal(hint({split: true, contain: true}), 'use a larger clip.');
  assert.equal(hint({canSplit: false, contain: true}), 'use a larger clip.');
  assert.equal(clipEnlargementIssue({width: 864, height: 1536, fit: 'cover'}, box, 'x'), null, 'exactly 1.25x is allowed');
});

test('with the style seam known, a split B-roll scene is measured against the box above it', () => {
  const seam = 768;
  assert.deepEqual(brollSplitIssues(broll([{atFrame: 0, ...clip({width: 1920, height: 1080})}]), seam), [], 'a 1080p landscape clip fills the 1080x768 box with room to spare');
  assert.deepEqual(brollSplitIssues(broll([{atFrame: 0, ...clip({width: 540, height: 960})}]), seam),
    ['broll-1 step 1: the clip would be enlarged 2.00x in its 1080x768 box (limit 1.25x); use fit "contain" or a larger clip.']);
  assert.deepEqual(brollSplitIssues(broll([{atFrame: 0, ...clip()}, {atFrame: 30, ...clip({width: 300, height: 400, fit: 'contain'})}]), seam),
    ['broll-1 step 2: the clip would be enlarged 1.92x in its 1080x768 box (limit 1.25x); use a larger clip.'], 'every step is measured, and a contained clip is not told to use contain');
  assert.deepEqual(brollSplitIssues(broll([{atFrame: 0, ...clip({width: 540, height: 960})}], {layout: 'takeover'}), seam), [], 'a full-screen scene is the manifest rule, not this check');
  assert.deepEqual(brollSplitIssues(windowScreens({layout: 'takeover'}), seam), [], 'the window look has no clips to measure');
});

test('a contained clip that is still too small is not told to use contain, and an edit without the presenter is not told to split', () => {
  const contained = {width: 540, height: 960, fit: 'contain'};
  assert.match(enlargementOf(manifestWith([broll([{atFrame: 0, ...clip(contained)}], {layout: 'takeover'})])),
    /enlarged 2\.00x in its 1080x1920 box \(limit 1\.25x\); use the split layout or a larger clip\.$/);
  assert.match(enlargementOf(manifestWith([broll([{atFrame: 0, ...clip({width: 300, height: 400, fit: 'contain'})}])])),
    /enlarged 2\.00x in its 1080x800 box \(limit 1\.25x\); use a larger clip\.$/);
  assert.match(enlargementOf(manifestWith([broll([{atFrame: 0, ...clip({width: 1920, height: 1080})}], {layout: 'takeover'})], {presenter: false})),
    /enlarged 1\.78x in its 1080x1920 box \(limit 1\.25x\); use fit "contain" or a larger clip\.$/);
});

test('split B-roll needs a presenter on screen, and the presenter window only goes on a full-screen B-roll scene', () => {
  assert.ok(issuesOf(manifestWith([broll([{atFrame: 0, ...clip()}])], {presenter: false})).some((message) => /needs the presenter on screen/.test(message)));
  const withPip = manifestWith([broll([{atFrame: 0, ...clip()}])]);
  withPip.footage = {...footage, pip: {x: 50, y: 100, width: 260, height: 260, radius: 30, plate: {left: -50, top: -20, width: 360, height: 640}, sceneIds: ['broll-1']}};
  assert.ok(issuesOf(withPip).some((message) => /PiP scene broll-1 must be a takeover/.test(message)));
});

const mod = await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {KineticSceneRenderer} from './engine/src/creative-kit/kinetic/scenes';
  const geometry = {windowTop: 800, windowHeight: 1120, videoWidth: 1080, videoLeft: 0, videoTop: 0};
  export const render = (scene, seam) => renderToStaticMarkup(React.createElement(KineticSceneRenderer, {scene, style: 'section-deck', geometry, aspect: 16 / 9, seam}));
`, {ssr: true, media: true, plateStub: true});

test('a split broll scene fills only the box above the seam', () => {
  setSsrFps(30);
  setSsrFrame(0);
  const html = mod.render(broll([{atFrame: 0, ...clip()}]), 800);
  assert.match(html, /width:1080px;height:800px/);
  assert.match(html, /height:800px;bottom:auto/);
  assert.doesNotMatch(html, /height:1920px/);
});

test('the render stops a split clip that is too small for the box above the seam, and draws one that fits', () => {
  setSsrFps(30);
  setSsrFrame(0);
  assert.throws(() => mod.render(broll([{atFrame: 0, ...clip({width: 540, height: 960})}]), 800), /enlarged 2\.00x in its 1080x800 box/);
  assert.match(mod.render(broll([{atFrame: 0, ...clip({width: 1920, height: 1080})}]), 768), /width:1080px;height:768px/);
});
