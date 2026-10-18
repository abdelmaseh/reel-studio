import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {profileToBrief} from '../scripts/lib/branding.mjs';
import {buildEditorPlan, validateEditorBrief} from '../scripts/lib/editor-director.mjs';
import {normalizeGraphicsSpec} from '../scripts/lib/graphics-project.mjs';
import {validatePodcastSelections} from '../scripts/lib/podcast-batch.mjs';
import {defaultPreferences} from '../engine/src/core/preference-options.ts';

const example = JSON.parse(await readFile(new URL('../PROFILE.example.json', import.meta.url), 'utf8'));
const selection = JSON.parse(await readFile(new URL('./fixtures/podcast-selection.json', import.meta.url), 'utf8'));
const words = Array.from({length: 8}, (_, i) => ({text: 'كلمة', startMs: i * 400, endMs: i * 400 + 350, confidence: 1}));
const source = {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 120};
const withDigits = (value) => ({...structuredClone(example), preferences: {...defaultPreferences(), digits: {mode: 'fixed', value}}});
const briefFor = (profile, extra = {}) => ({version: 1, id: 'digits-test', source: source.path, transcript: 'Projects/digits-test/words.json',
  ...profileToBrief(profile), purpose: 'tutorial', tone: 'calm',
  beats: [{id: 'hook', fromSec: 0, toSec: 3, intent: 'intro', data: {kicker: 'تجربة', title: 'اختياراتك', subtitle: 'شرح بسيط', caption: 'شرح'}}], ...extra});

test('a saved digits choice reaches the manifest and the decision', () => {
  const plan = buildEditorPlan(briefFor(withDigits('arabic-indic')), source, words);
  assert.equal(plan.manifest.digits, 'arabic-indic');
  assert.equal(plan.decision.preferences.digits, 'arabic-indic');
});

test('a value in the brief beats the saved choice, for this video only', () => {
  const profile = withDigits('arabic-indic');
  const plan = buildEditorPlan(briefFor(profile, {digits: 'latin'}), source, words);
  assert.equal(plan.manifest.digits, 'latin');
  assert.equal(profile.preferences.digits.value, 'arabic-indic', 'the profile is not touched');
  assert.equal(buildEditorPlan(briefFor(example, {digits: 'arabic-indic'}), source, words).manifest.digits, 'arabic-indic');
});

test('without a choice the manifest and the decision carry no digits key', () => {
  const plan = buildEditorPlan(briefFor(example), source, words);
  assert.equal(Object.hasOwn(plan.manifest, 'digits'), false);
  assert.equal(Object.hasOwn(plan.decision.preferences, 'digits'), false);
});

test('the brief validates its digits value', () => {
  assert.doesNotThrow(() => validateEditorBrief(briefFor(example, {digits: 'latin'})));
  assert.throws(() => validateEditorBrief(briefFor(example, {digits: 'persian'})), /Invalid option|expected|digits/i);
  assert.throws(() => validateEditorBrief(briefFor(example, {digitz: 'latin'})), /digitz/);
});

test('a graphics specification can choose the digits and still refuses unknown keys', () => {
  const spec = {version: 1, id: 'graphics-digits', style: 'paper-collage', fps: 30, reviewedBy: 'Approved illustrative copy', scenes: [{
    id: 'idea', family: 'intro', fromFrame: 0, durationInFrames: 90, layout: 'takeover', motion: 'quiet',
    data: {kicker: 'ILLUSTRATIVE', title: 'One clear idea', subtitle: 'Authored graphic copy', caption: 'Example'}}]};
  assert.equal(normalizeGraphicsSpec({...spec, digits: 'arabic-indic'}).digits, 'arabic-indic');
  assert.equal(Object.hasOwn(normalizeGraphicsSpec(spec), 'digits'), false);
  assert.throws(() => normalizeGraphicsSpec({...spec, digits: 'persian'}));
  assert.throws(() => normalizeGraphicsSpec({...spec, digitz: 'latin'}), /digitz/);
});

test('a podcast clip can choose the digits for its own editor settings', () => {
  const context = {source: {path: 'Raw/podcast.mp4', sha256: 'a'.repeat(64), durationSec: 700, fps: 30},
    words: [{text: 'تجربة', startMs: 630000, endMs: 630300}, {text: 'شرح', startMs: 630500, endMs: 630900}, {text: 'واضح', startMs: 631200, endMs: 631800}, {text: 'سلام', startMs: 633000, endMs: 633700}],
    batchId: 'podcast-demo'};
  const chosen = {...selection, clips: [{...selection.clips[0], editor: {...selection.clips[0].editor, digits: 'arabic-indic'}}]};
  assert.equal(validatePodcastSelections(chosen, context).clips[0].editor.digits, 'arabic-indic');
  const unknown = {...selection, clips: [{...selection.clips[0], editor: {...selection.clips[0].editor, digitz: 'latin'}}]};
  assert.throws(() => validatePodcastSelections(unknown, context), /digitz/);
});
