import test from 'node:test';
import assert from 'node:assert/strict';
import {LOOK_KINDS, DEFAULT_RISO_INKS} from '../engine/src/looks/index.ts';
import {LOOK_KEYS, LOOK_OPTIONS, lookResetPatch, lookView, setLook} from '../engine/src/review-editor/ops/look.ts';
import {validateManifest} from '../engine/src/review-editor/validate.ts';
import {createEditorStore} from '../engine/src/review-editor/store.ts';
import {createProjectFollower} from '../engine/src/review-editor/shell/live-project.ts';
import {LOOK_COALESCE, LOOK_EFFECT_LABEL, LOOK_STEP, LOOK_TEXT, inksWith, lookChange, lookReset} from '../engine/src/review-editor/panels/look-state.ts';
import {bundleEngine} from './helpers/engine-bundle.mjs';
import {dialectIn} from './helpers/dialect.mjs';
import {reviewManifest} from './helpers/review-manifest.mjs';

const ARABIC = /\p{Script=Arabic}/u;
const base = () => reviewManifest('looks-editor');

test('the Look tab offers the looks of the looks folder and writes them to the manifest root', () => {
  assert.equal(LOOK_OPTIONS.looks, LOOK_KINDS);
  assert.ok(LOOK_KEYS.includes('look'));
  const m = base();
  assert.equal(lookView(m).look.kind, null);
  assert.deepEqual(lookView(m).look, {value: null, kind: null, inks: [...DEFAULT_RISO_INKS], custom: false});

  const riso = setLook(m, {look: {kind: 'riso'}});
  assert.equal(riso.ok, true, riso.reason);
  assert.deepEqual(riso.manifest.look, {kind: 'riso'});
  assert.equal(validateManifest(riso.manifest).ok, true);
  assert.deepEqual(lookView(riso.manifest).look, {value: {kind: 'riso'}, kind: 'riso', inks: [...DEFAULT_RISO_INKS], custom: false});
  assert.equal('look' in m, false, 'the input manifest is never mutated');

  const same = setLook(riso.manifest, {look: {kind: 'riso'}});
  assert.equal(same.ok, true);
  assert.equal(same.changed, false);
  assert.equal(same.manifest, riso.manifest, 'an equal look hands back the same manifest, so the editor stays clean');

  const inks = ['#1b2a6b', '#e8452c'];
  const custom = setLook(riso.manifest, {look: {kind: 'riso', inks}});
  assert.equal(custom.ok, true, custom.reason);
  assert.deepEqual(lookView(custom.manifest).look, {value: {kind: 'riso', inks}, kind: 'riso', inks, custom: true});
  assert.equal(validateManifest(custom.manifest).ok, true);

  const blueprint = setLook(custom.manifest, {look: {kind: 'blueprint'}});
  assert.deepEqual(blueprint.manifest.look, {kind: 'blueprint'}, 'switching kind drops the riso inks');
  assert.equal(validateManifest(blueprint.manifest).ok, true);

  const off = setLook(blueprint.manifest, {look: null});
  assert.equal('look' in off.manifest, false, 'null takes the look off the manifest');
  assert.deepEqual(off.manifest, m);
  assert.equal(setLook(m, {look: null}).changed, false, 'taking off what is absent changes nothing');
  assert.deepEqual(lookResetPatch(m, 'look'), {look: null});

  const both = setLook(m, {look: {kind: 'blueprint'}, digits: 'latin'});
  assert.equal(both.manifest.look.kind, 'blueprint');
  assert.equal(both.manifest.digits, 'latin');
});

test('a look that cannot be printed is refused in neutral Arabic and leaves the manifest as it was', () => {
  const cases = [
    [{look: {kind: 'vhs'}}, /غير متاح/],
    [{look: {kind: 'blueprint', inks: ['#0078bf', '#ff48b0']}}, /مظهر الطباعة/],
    [{look: {kind: 'riso', inks: ['#0078bf', '#0078bf']}}, /يختلف/],
    [{look: {kind: 'riso', inks: ['#0078bf', '#0a7cc0']}}, /متقاربان/],
    [{look: {kind: 'riso', inks: ['#ffe800', '#9fe0ff']}}, /فاتحان/],
    [{look: {kind: 'riso', inks: ['#0078bf', 'pink']}}, /#RRGGBB/],
    [{look: {kind: 'riso', inks: ['#0078bf']}}, /حبرين/],
    [{look: {kind: 'riso', extra: true}}, /غير صالح/],
    [{look: 'riso'}, /غير متاح/],
  ];
  for (const [patch, pattern] of cases) {
    const m = base();
    const result = setLook(m, patch);
    assert.equal(result.ok, false, JSON.stringify(patch));
    assert.match(result.reason, pattern, JSON.stringify(patch));
    assert.match(result.reason, ARABIC);
    assert.deepEqual(dialectIn(result.reason), [], result.reason);
    assert.equal('look' in m, false);
  }
  assert.equal(setLook(base(), {colour: 'red'}).ok, false, 'an unknown key is still refused');
});

test('a look works in a graphics project and sits beside the other Look choices in one patch', () => {
  const graphics = base();
  graphics.contentMode = 'graphics';
  const result = setLook(graphics, {look: {kind: 'riso'}, fontFamily: 'Tajawal'});
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.manifest.look.kind, 'riso');
  assert.equal(result.manifest.fontFamily, 'Tajawal');
});

test('every look has an Arabic label in neutral Arabic, one undo step per control and its own merge key', () => {
  assert.deepEqual(Object.keys(LOOK_EFFECT_LABEL).sort(), ['none', ...LOOK_KINDS].sort());
  for (const label of Object.values(LOOK_EFFECT_LABEL)) {
    assert.match(label, ARABIC);
    assert.deepEqual(dialectIn(label), [], label);
  }
  assert.equal(LOOK_COALESCE.look, 'look:effect');
  assert.equal(new Set(Object.values(LOOK_COALESCE)).size, LOOK_KEYS.length);
  assert.match(LOOK_STEP.look, ARABIC);
  for (const key of ['look', 'lookOff', 'lookNote', 'inkOne', 'inkTwo', 'inksDefault', 'inksNote']) {
    assert.match(LOOK_TEXT[key], ARABIC, key);
    assert.deepEqual(dialectIn(LOOK_TEXT[key]), [], key);
  }
  assert.deepEqual(inksWith(['#111111', '#222222'], 0, '#ABCDEF'), ['#abcdef', '#222222']);
  assert.deepEqual(inksWith(['#111111', '#222222'], 1, '#ABCDEF'), ['#111111', '#abcdef']);

  let clock = 1000;
  const store = createEditorStore(base(), {now: () => clock});
  const send = (target, {label, fn, options}) => target.apply((current) => {
    const result = fn(current);
    return result.ok ? result.manifest : current;
  }, label, options);
  send(store, lookChange('look', {look: {kind: 'riso'}}));
  clock += 100;
  send(store, lookChange('look', {look: {kind: 'riso', inks: ['#1b2a6b', '#e8452c']}}));
  clock += 100;
  send(store, lookChange('look', {look: {kind: 'blueprint'}}));
  assert.equal(store.getSnapshot().manifest.look.kind, 'blueprint');
  assert.equal(store.getSnapshot().undoLabel, LOOK_STEP.look);
  store.undo();
  assert.equal('look' in store.getSnapshot().manifest, false, 'three quick changes of the look are one step');
  assert.equal(store.getSnapshot().canUndo, false);
  store.redo();
  clock += 100;
  send(store, lookReset('look'));
  assert.equal('look' in store.getSnapshot().manifest, false);
  store.undo();
  assert.equal(store.getSnapshot().manifest.look.kind, 'blueprint', 'a reset is a step of its own');
});

test('a look set by the assistant while the editor is open arrives as a style change', () => {
  const manifest = base();
  const project = {slug: manifest.id, manifestPath: `Projects/${manifest.id}/edit.json`, manifest, manifestRevision: 'a'.repeat(64), plate: null,
    needsPrepare: true, staticFiles: [], hasMotionPlan: false, motionPlanPath: null, exportModes: [], recipes: [], recipeInfo: [], warnings: []};
  const store = createEditorStore(manifest);
  const follower = createProjectFollower({store, initial: project, blocked: () => false, onProject: () => {}, onStatus: () => {}, now: () => 1});
  const next = structuredClone(project);
  next.manifestRevision = 'b'.repeat(64);
  next.manifest.look = {kind: 'blueprint'};
  follower.receive(next);
  assert.deepEqual(store.getSnapshot().manifest.look, {kind: 'blueprint'});
  assert.deepEqual(follower.getStatus().changes, ['style']);
});

test('the Look tab shows the look choice, the two inks only for riso and a reset that is off while nothing is set', async () => {
  const {render} = await bundleEngine(`
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {EditorStoreProvider, createEditorStore} from './engine/src/review-editor/store.ts';
    import {LookPanel} from './engine/src/review-editor/panels/look.tsx';
    export const render = (manifest) => {
      const store = createEditorStore(manifest);
      const props = {manifest, apply: store.apply, playhead: 0, seek() {}, selection: null, select() {}, issues: [], project: {staticFiles: []}};
      return renderToStaticMarkup(React.createElement(EditorStoreProvider, {store}, React.createElement(LookPanel, props)));
    };
  `);
  const tag = (html, name, label) => new RegExp(`<${name}[^>]*aria-label="${label}"[^>]*>`).exec(html)?.[0] ?? '';
  const m = base();
  const none = render(m);
  assert.ok(tag(none, 'select', LOOK_TEXT.look), 'the look select exists');
  for (const label of Object.values(LOOK_EFFECT_LABEL)) assert.ok(none.includes(`>${label}</option>`), label);
  assert.ok(none.includes('value="none" selected'));
  assert.match(tag(none, 'button', `${LOOK_TEXT.lookOff}: ${LOOK_TEXT.look}`), /disabled/, 'nothing to take off');
  assert.equal(none.includes(LOOK_TEXT.inkOne), false, 'no inks without riso');
  assert.ok(none.includes(LOOK_TEXT.lookNote));

  const riso = render(setLook(m, {look: {kind: 'riso'}}).manifest);
  assert.ok(riso.includes('value="riso" selected'));
  assert.doesNotMatch(tag(riso, 'button', `${LOOK_TEXT.lookOff}: ${LOOK_TEXT.look}`), /disabled/);
  for (const name of [LOOK_TEXT.inkOne, LOOK_TEXT.inkTwo]) assert.match(tag(riso, 'input', name), /type="color"/, name);
  for (const ink of DEFAULT_RISO_INKS) assert.ok(riso.includes(ink), ink);
  assert.match(tag(riso, 'button', LOOK_TEXT.inksDefault), /disabled/, 'the default pair has nothing to reset');
  const custom = render(setLook(m, {look: {kind: 'riso', inks: ['#1b2a6b', '#e8452c']}}).manifest);
  assert.ok(custom.includes('#1b2a6b') && custom.includes('#e8452c'));
  assert.doesNotMatch(tag(custom, 'button', LOOK_TEXT.inksDefault), /disabled/, 'a chosen pair can go back to the default');

  const blueprint = render(setLook(m, {look: {kind: 'blueprint'}}).manifest);
  assert.ok(blueprint.includes('value="blueprint" selected'));
  assert.equal(blueprint.includes(LOOK_TEXT.inkOne), false, 'blueprint has no inks');
});

test('a look written straight into the manifest with unusable inks shows up in the Issues list in words, not as a raw schema error', () => {
  const m = base();
  m.look = {kind: 'riso', inks: ['#0078bf', '#0078bf']};
  const result = validateManifest(m);
  assert.equal(result.ok, false);
  const issue = result.issues.find((entry) => entry.path.startsWith('look'));
  assert.ok(issue, JSON.stringify(result.issues));
  assert.match(issue.message, /حبرين/);
  assert.doesNotMatch(issue.message, /The two inks/);
  m.look = {kind: 'sepia'};
  assert.equal(validateManifest(m).ok, false);
});
