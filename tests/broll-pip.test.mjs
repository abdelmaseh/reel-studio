import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {profileToBrief} from '../scripts/lib/branding.mjs';
import {buildEditorPlan} from '../scripts/lib/editor-director.mjs';
import {assertEditionManifest} from '../scripts/lib/edit-project.mjs';

const profile = JSON.parse(await readFile(new URL('../PROFILE.example.json', import.meta.url), 'utf8'));
const source = {path: 'Raw/synthetic.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 720};
const words = [{text: '12', startMs: 6000, endMs: 6400, confidence: 1}];
const geometry = {windowTop: 0, windowHeight: 1920, videoWidth: 1080, videoLeft: 0, videoTop: 0};
const pip = {x: 50, y: 100, width: 260, height: 260, radius: 30, plate: {left: -50, top: -20, width: 360, height: 640}, sceneIds: ['clip']};
const step = {atFrame: 0, src: 'projects/example/a.mp4', sha256: 'a'.repeat(64), width: 1080, height: 1920, trimBeforeFrame: 0, fit: 'cover'};
const brief = (extra = {}) => ({
  version: 1, id: 'broll-pip-test', source: source.path, transcript: 'Projects/broll-pip-test/words.json', ...profileToBrief(profile),
  purpose: 'explainer', tone: 'calm', style: 'split-canvas', captionsReviewedBy: 'Creator',
  beats: [{id: 'clip', fromSec: 0, toSec: 2, intent: 'screens', data: {look: 'broll', steps: [step]}}],
  footage: {full: geometry, split: {...geometry, windowTop: 800, windowHeight: 1120}, pip}, ...extra,
});

test('the presenter window can sit on a full-screen B-roll scene', () => {
  const {manifest} = buildEditorPlan(brief(), source, words);
  assert.deepEqual([manifest.scenes[0].family, manifest.scenes[0].layout, manifest.scenes[0].data.look], ['screens', 'takeover', 'broll']);
  assert.deepEqual(assertEditionManifest(manifest).footage.pip, pip);
});

test('the presenter window is refused in a style without picture-in-picture, and when it would cover the caption band', () => {
  assert.throws(() => buildEditorPlan(brief({style: 'section-deck'}), source, words), /Picture-in-picture is not part of the section-deck style/);
  assert.throws(() => buildEditorPlan(brief({footage: {full: geometry, split: geometry, pip: {...pip, y: 1300}}}), source, words), /caption band/);
});

const labelled = {...step, label: 'Office desk'};
const clipBeat = (steps, extra = {}) => ({id: 'clip', fromSec: 0, toSec: 2, intent: 'screens', data: {look: 'broll', steps}, ...extra});

test('a B-roll scene shown with the presenter window cannot carry a label, because the window covers the label corner', () => {
  assert.throws(() => buildEditorPlan(brief({beats: [clipBeat([labelled])]}), source, words),
    /clip: a B-roll scene shown with the presenter window cannot carry a label, because the window covers the label's corner; remove the label or take the scene out of footage\.pip\.sceneIds\./);
  assert.throws(() => buildEditorPlan(brief({beats: [clipBeat([step, {...labelled, atFrame: 30}])]}), source, words), /cannot carry a label/, 'a label on any later clip counts too');
  assert.doesNotThrow(() => buildEditorPlan(brief({beats: [clipBeat([step])]}), source, words), 'the same scene without a label is accepted');
});

test('a labelled B-roll scene that the presenter window does not sit on keeps its label', () => {
  const beats = [clipBeat([step]), clipBeat([labelled], {id: 'labelled', fromSec: 2.5, toSec: 4.5})];
  const {manifest} = buildEditorPlan(brief({beats}), source, words);
  assert.deepEqual(manifest.footage.pip.sceneIds, ['clip']);
  assert.equal(manifest.scenes.find((scene) => scene.id === 'labelled').data.steps[0].label, 'Office desk');
});

test('the presenter window must name a scene that exists', () => {
  assert.throws(() => buildEditorPlan(brief({footage: {full: geometry, split: geometry, pip: {...pip, sceneIds: ['missing']}}}), source, words), /PiP scene missing does not exist/);
});
