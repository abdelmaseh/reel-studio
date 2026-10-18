import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizePreferences, normalizeProfile, profileToBrief} from '../scripts/lib/branding.mjs';
import {buildEditorPlan, validateEditorBrief} from '../scripts/lib/editor-director.mjs';
import {DIGIT_CHOICES, DIGIT_LABELS_AR, PREFERENCE_VALUES, defaultPreferences, resolvePreferences} from '../engine/src/core/preference-options.ts';
import {editManifestSchema} from '../engine/src/prepared-edit/schema.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const example = JSON.parse(await readFile(new URL('../PROFILE.example.json', import.meta.url), 'utf8'));
const sixKeys = ['style', 'captionsGrouping', 'captionsPresentation', 'font', 'writingStyle', 'palette'];
const words = Array.from({length: 8}, (_, i) => ({text: 'كلمة', startMs: i * 400, endMs: i * 400 + 350, confidence: 1}));
const source = {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 120};
const schema2 = () => { const old = structuredClone(example); old.schemaVersion = 2; delete old.preferences; return old; };
const briefFor = (profile, extra = {}) => ({version: 1, id: 'digits-test', source: source.path, transcript: 'Projects/digits-test/words.json',
  ...profileToBrief(profile), purpose: 'tutorial', tone: 'calm',
  beats: [{id: 'hook', fromSec: 0, toSec: 3, intent: 'intro', data: {kicker: 'تجربة', title: 'اختياراتك', subtitle: 'شرح بسيط', caption: 'شرح'}}], ...extra});
const sha = (text) => createHash('sha256').update(text).digest('hex');

test('digits has three states and one Arabic label map', () => {
  assert.deepEqual([...DIGIT_CHOICES], ['latin', 'arabic-indic']);
  assert.equal(PREFERENCE_VALUES.digits, DIGIT_CHOICES);
  assert.deepEqual({...DIGIT_LABELS_AR}, {auto: 'كما هو', latin: '1 2 3', 'arabic-indic': '١ ٢ ٣'});
  assert.deepEqual(Object.keys(defaultPreferences()), sixKeys, 'the default preferences are unchanged: six keys, no digits');
  assert.deepEqual(Object.keys(defaultPreferences({legacy: true})), sixKeys);
});

test('a 2.5 profile (schema 3 with six preferences) and a schema 2 profile stay valid and gain no digits key', () => {
  for (const profile of [example, schema2()]) {
    const normalized = normalizeProfile(structuredClone(profile));
    assert.deepEqual(Object.keys(normalized.preferences), sixKeys);
    assert.equal(Object.hasOwn(profileToBrief(profile).preferences, 'digits'), false);
  }
});

test('digits is optional: absent and explicit auto normalize away, a fixed choice is kept', () => {
  const six = defaultPreferences();
  assert.deepEqual(Object.keys(normalizePreferences(six)), sixKeys);
  assert.deepEqual(Object.keys(normalizePreferences({...six, digits: {mode: 'auto', value: null}})), sixKeys, 'explicit auto is the same as absent');
  const arabic = normalizePreferences({...six, digits: {mode: 'fixed', value: 'arabic-indic'}});
  assert.deepEqual(arabic.digits, {mode: 'fixed', value: 'arabic-indic'});
  assert.equal(Object.keys(arabic).at(-1), 'digits');
  assert.deepEqual(normalizePreferences({...six, digits: {mode: 'fixed', value: 'latin'}}).digits, {mode: 'fixed', value: 'latin'});
  const profile = {...structuredClone(example), preferences: {...six, digits: {mode: 'fixed', value: 'arabic-indic'}}};
  assert.deepEqual(profileToBrief(profile).preferences.digits, {mode: 'fixed', value: 'arabic-indic'});
});

test('bad digits values and unknown or missing keys are still refused', () => {
  const six = defaultPreferences();
  for (const digits of [{mode: 'fixed', value: 'persian'}, {mode: 'fixed', value: null}, {mode: 'auto', value: 'latin'}, {mode: 'sometimes', value: null}, 'latin', null]) {
    assert.throws(() => normalizePreferences({...six, digits}), undefined, JSON.stringify(digits));
  }
  assert.throws(() => normalizePreferences({...six, hidden: {mode: 'auto', value: null}}));
  const missing = {...six}; delete missing.font;
  assert.throws(() => normalizePreferences(missing));
});

test('resolvePreferences returns digits only when it is fixed and never throws on a 2.5 key set', () => {
  const context = {purpose: 'tutorial', tone: 'calm', style: 'section-deck'};
  const automatic = resolvePreferences(defaultPreferences(), context);
  assert.equal(Object.hasOwn(automatic, 'digits'), false);
  const exactly25 = Object.fromEntries(sixKeys.map((key) => [key, {mode: 'auto', value: null}]));
  assert.equal(Object.hasOwn(resolvePreferences(exactly25, context), 'digits'), false);
  assert.equal(resolvePreferences({...exactly25, digits: {mode: 'auto', value: null}}, context).digits, undefined);
  assert.equal(resolvePreferences({...exactly25, digits: {mode: 'fixed', value: 'arabic-indic'}}, context).digits, 'arabic-indic');
});

test('a 2.5 brief plans exactly as before: no digits in the manifest or in the decision', () => {
  const plan = buildEditorPlan(briefFor(example), source, words);
  assert.equal(Object.hasOwn(plan.manifest, 'digits'), false);
  assert.equal(Object.hasOwn(plan.decision.preferences, 'digits'), false);
  assert.doesNotThrow(() => validateEditorBrief(briefFor(schema2())));
  assert.doesNotThrow(() => validateEditorBrief({...briefFor(example), preferences: Object.fromEntries(sixKeys.map((key) => [key, {mode: 'auto', value: null}]))}));
});

test('the manifest accepts digits only as latin or arabic-indic and stays strict', () => {
  const manifest = buildEditorPlan(briefFor(example), source, words).manifest;
  for (const digits of DIGIT_CHOICES) assert.equal(editManifestSchema.parse({...manifest, digits}).digits, digits);
  assert.equal(editManifestSchema.safeParse({...manifest, digits: 'persian'}).success, false);
  assert.equal(editManifestSchema.safeParse({...manifest, digitz: 'latin'}).success, false);
  assert.equal(Object.hasOwn(editManifestSchema.parse(manifest), 'digits'), false, 'parsing an old manifest adds nothing');
});

// The sha-256 of the bytes `node scripts/profile.mjs check|brief` printed with 2.5 for PROFILE.example.json and for the same
// profile saved as schema 2. A new optional preference must not change one byte of either command.
const GOLDEN = {
  schema3: {check: '28cfca339d951ed6e9e3e14dba220b876d2d5d16ef22f78afe488b5ee22da99f', brief: '96a081cd7094309f81091c23e2252d497bdd9c3a7129124018d96290c09b4949'},
  schema2: {check: 'fa7ea1b01c9135dafe832bd0164e9092be36728627ab466845e9ada75242a2be', brief: '69e1060ab5d460b7b3ea7f50512be1ccec08767a13f7aeb1bc4eb6978fb10f26'},
};

test('profile.mjs check and brief print the same bytes as 2.5 for existing profiles', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'reel-digits-golden-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const files = {schema3: path.join(dir, 'v3.json'), schema2: path.join(dir, 'v2.json')};
  await writeFile(files.schema3, JSON.stringify(example, null, 2));
  await writeFile(files.schema2, JSON.stringify(schema2(), null, 2));
  for (const [name, file] of Object.entries(files)) {
    for (const command of ['check', 'brief']) {
      const run = spawnSync(process.execPath, ['scripts/profile.mjs', command, '--profile', file], {cwd: ROOT, encoding: 'buffer'});
      assert.equal(run.status, 0, `${name} ${command}: ${run.stderr}`);
      assert.equal(run.stderr.length, 0, `${name} ${command} prints nothing on stderr`);
      assert.equal(sha(run.stdout), GOLDEN[name][command], `${name} ${command}`);
    }
  }
});
