import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createSettingsServer} from '../scripts/lib/settings-server.mjs';
import {CAPTION_SKINS, DIGIT_LABELS_AR} from '../engine/src/core/preference-options.ts';
import {dialectIn} from './helpers/dialect.mjs';

const example = JSON.parse(await readFile(new URL('../PROFILE.example.json', import.meta.url), 'utf8'));
const app = (await readFile(new URL('../scripts/settings-ui/app.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const sixKeys = ['style', 'captionsGrouping', 'captionsPresentation', 'font', 'writingStyle', 'palette'];
async function instance(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reel-settings-arabic-'));
  const server = await createSettingsServer({root});
  t.after(async () => { await server.close(); await rm(root, {recursive: true, force: true}); });
  const api = (route, options = {}) => fetch(`${server.origin}/api/${route}`, {...options, headers: {'x-reel-studio-token': server.token, ...options.headers}});
  const save = (profile, etag) => api('profile', {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify({profile, etag})});
  return {root, server, api, save};
}
const fileProfile = async (root) => JSON.parse(await readFile(path.join(root, 'PROFILE.json'), 'utf8'));

test('caption skin choices save as an optional preference and auto removes the key', async (t) => {
  const {api, save} = await instance(t);
  const catalog = await (await api('catalog')).json();
  assert.deepEqual(catalog.choices.captionsSkin, [...CAPTION_SKINS]);
  assert.equal(Object.hasOwn(catalog.defaults.preferences, 'captionsSkin'), false);
  const first = await (await save({...example, preferences: {...example.preferences, captionsSkin: {mode: 'fixed', value: 'karaoke'}}}, null)).json();
  assert.equal(first.profile.preferences.captionsSkin.value, 'karaoke');
  const automatic = await (await save({...first.profile, preferences: {...first.profile.preferences, captionsSkin: {mode: 'auto', value: null}}}, first.etag)).json();
  assert.equal(Object.hasOwn(automatic.profile.preferences, 'captionsSkin'), false);
});

test('the skin picker changes only its preference, resets to absence and offers every catalog skin', () => {
  const start = app.indexOf('function setCaptionSkin('), end = app.indexOf('function captionSkinsSection(', start);
  assert.ok(start >= 0 && end > start, 'the optional skin control exists');
  const draft = {preferences: {captionsPresentation: {mode: 'fixed', value: 'minimal'}}};
  const set = new Function('draft', 'changed', 'render', 'document', app.slice(start, end) + ';return setCaptionSkin;')(draft, () => {}, () => {}, {getElementById: () => ({focus() {}})});
  set('paper-tag', 'skin-test');
  assert.deepEqual(draft.preferences.captionsSkin, {mode: 'fixed', value: 'paper-tag'});
  set('auto', 'skin-test');
  assert.equal(Object.hasOwn(draft.preferences, 'captionsSkin'), false);
  assert.equal(draft.preferences.captionsPresentation.value, 'minimal');
  assert.ok(app.includes('...catalog.choices.captionsSkin'));
});

test('the catalog offers the digits choices, and the default profile has no digits key', async (t) => {
  const {api} = await instance(t);
  const catalog = await (await api('catalog')).json();
  assert.deepEqual(catalog.choices.digits, ['latin', 'arabic-indic']);
  assert.equal(Object.hasOwn(catalog.defaults.preferences, 'digits'), false);
});

test('a fixed digits choice is saved and read back, and the automatic choice leaves no key in the file', async (t) => {
  const {root, api, save} = await instance(t);
  const first = await (await save({...example, name: 'أحمد', preferences: {...example.preferences, digits: {mode: 'fixed', value: 'arabic-indic'}}}, null)).json();
  assert.deepEqual(first.profile.preferences.digits, {mode: 'fixed', value: 'arabic-indic'});
  assert.deepEqual((await fileProfile(root)).preferences.digits, {mode: 'fixed', value: 'arabic-indic'});
  assert.deepEqual((await (await api('profile')).json()).profile.preferences.digits, {mode: 'fixed', value: 'arabic-indic'});
  const latin = await (await save({...first.profile, preferences: {...first.profile.preferences, digits: {mode: 'fixed', value: 'latin'}}}, first.etag)).json();
  assert.deepEqual((await fileProfile(root)).preferences.digits, {mode: 'fixed', value: 'latin'});
  const automatic = await (await save({...latin.profile, preferences: {...latin.profile.preferences, digits: {mode: 'auto', value: null}}}, latin.etag)).json();
  assert.equal(Object.hasOwn(automatic.profile.preferences, 'digits'), false);
  assert.equal(Object.hasOwn((await fileProfile(root)).preferences, 'digits'), false, 'explicit auto is written as no key');
  const refused = await save({...automatic.profile, preferences: {...automatic.profile.preferences, digits: {mode: 'fixed', value: 'persian'}}}, automatic.etag);
  assert.equal(refused.status, 400);
});

test('a profile written by 2.5 is not rewritten by opening it, and saving it unchanged adds no digits key', async (t) => {
  const {root, api, save} = await instance(t);
  const bytes = JSON.stringify({...example, name: 'قديم'}, null, 2);
  await writeFile(path.join(root, 'PROFILE.json'), bytes, 'utf8');
  const state = await (await api('profile')).json();
  assert.equal(await readFile(path.join(root, 'PROFILE.json'), 'utf8'), bytes, 'opening rewrites nothing');
  assert.deepEqual(Object.keys(state.profile.preferences), sixKeys);
  assert.equal((await save(state.profile, state.etag)).status, 200);
  assert.deepEqual(Object.keys((await fileProfile(root)).preferences), sixKeys);
  // The screen opens such a profile as "as it is" and sends that state back as an explicit auto: still no key in the file.
  const again = await (await api('profile')).json();
  const sent = {...again.profile, preferences: {...again.profile.preferences, digits: {mode: 'auto', value: null}}};
  assert.equal((await save(sent, again.etag)).status, 200);
  assert.deepEqual(Object.keys((await fileProfile(root)).preferences), sixKeys);
});

test('the screen writes the digits state as fixed or no key, opens a missing key as "as it is", and shows the digits in the summary', () => {
  const labels = new Function(`return ${/const digitLabels = (\{[^;]*\});/.exec(app)?.[1]}`)();
  assert.deepEqual(labels, {...DIGIT_LABELS_AR}, 'the screen and the editor share the same three strings');
  assert.ok(app.includes("'الخطوط والأرقام'"), 'step 4 is fonts and digits');
  assert.ok(app.includes("['الأرقام',"), 'the summary has a digits row');
  assert.ok(app.includes('delete draft.preferences.digits'), 'automatic removes the key');
  assert.ok(app.includes("draft.preferences.digits = {mode: 'fixed', value}"), 'a fixed choice is written with its value');
  assert.ok(app.includes("draft.preferences.digits ??= {mode: 'auto', value: null}"), 'a missing key means automatic on load');
  assert.ok(app.includes('...catalog.choices.digits'), 'the choices come from the catalog');
  const samples = new Function(`return ${/const digitSamples = (\{[^;]*\});/.exec(app)?.[1]}`)();
  assert.deepEqual(Object.keys(samples), ['auto', 'latin', 'arabic-indic']);
  assert.ok(/[0-9]/.test(samples.latin) && !/[٠-٩]/.test(samples.latin), 'the Latin sample uses Latin digits');
  assert.ok(/[٠-٩]/.test(samples['arabic-indic']) && !/[0-9]/.test(samples['arabic-indic']), 'the Arabic-Indic sample uses Arabic-Indic digits');
});

test('the strings the digits step adds to the screen are neutral White Arabic', () => {
  const added = [
    'الخطوط والأرقام',
    'شكل الأرقام على الشاشة',
    'شكل الأرقام',
    'الأرقام',
    'كل مشهد كما كان',
    '3 خطوات · 2025',
    '٣ خطوات · ٢٠٢٥',
    'هذا الاختيار يغيّر شكل الأرقام على الشاشة وفي الكابشن أيضًا. «كما هو» يترك كل مشهد كما كان.',
  ];
  for (const text of added) {
    assert.ok(app.includes(text), `the screen contains: ${text}`);
    assert.deepEqual(dialectIn(text), [], text);
  }
});
