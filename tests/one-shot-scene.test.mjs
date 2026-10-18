import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {ONE_SHOT_FAMILIES, oneShotSceneSchema, validateOneShotTiming} from '../engine/src/styles/one-shot/scenes/schema.ts';
import {oneShotTemplate, oneShotTemplateData, oneShotTemplateFrames} from '../engine/src/styles/one-shot/scenes/templates.ts';
import {styleSceneFamilies, styleSceneSchema, validateStyleSceneTiming} from '../engine/src/styles/scenes.ts';
import {STYLE_METAS, ownSceneStyle} from '../engine/src/styles/registry.ts';
import {fieldLabel, fieldsForFamily, formFamilies, validateData} from '../engine/src/review-editor/panels/form-schema.ts';
import {TEMPLATE_FAMILIES, addSceneFromTemplate, sceneDemoFields, templateFamiliesFor} from '../engine/src/review-editor/ops/scenes.ts';
import {normalizeGraphicsSpec} from '../scripts/lib/graphics-project.mjs';
import {autoSoundPlan} from '../scripts/lib/editor-director.mjs';
import {loadStylePalette} from '../scripts/lib/sfx-events.mjs';
import {reviewManifest} from './helpers/review-manifest.mjs';

const spec = () => JSON.parse(readFileSync(new URL('../instructions/examples/one-shot-demo.json', import.meta.url), 'utf8'));
const scene = (change = (value) => value) => change(structuredClone(spec().scenes[0]));
const oneShotManifest = (fps = 30) => {
  const m = reviewManifest();
  m.style = 'one-shot';
  m.source.fps = fps;
  m.source.totalFrames = 1500;
  m.segments = [{fromFrame: 0, toFrame: 1500}];
  m.scenes = [];
  return m;
};

test('the style owns exactly the one-shot family and the manifest refuses it elsewhere', () => {
  assert.deepEqual([...ONE_SHOT_FAMILIES], ['one-shot']);
  assert.ok(styleSceneFamilies.includes('one-shot'));
  assert.equal(ownSceneStyle('one-shot'), 'one-shot');
  assert.deepEqual([...STYLE_METAS.find((meta) => meta.id === 'one-shot').ownScenes], ['one-shot']);
  assert.throws(() => normalizeGraphicsSpec({...spec(), style: 'paper-collage'}), /one-shot scenes are available only in one-shot/);
  assert.ok(normalizeGraphicsSpec(spec()));
});

test('the demo specification is a valid graphics project and its scene is exactly as long as its chain', () => {
  const edit = normalizeGraphicsSpec(spec());
  assert.equal(edit.style, 'one-shot');
  assert.equal(edit.scenes[0].durationInFrames, 600, 'a little longer than the 590 frames the chain needs: the home page holds');
  assert.deepEqual(validateOneShotTiming(oneShotSceneSchema.parse(edit.scenes[0]), 30), []);
  assert.deepEqual(validateStyleSceneTiming(styleSceneSchema.parse(edit.scenes[0]), 30), []);
});

test('the schema is strict about keys, step kinds and limits', () => {
  const bad = (change, pattern) => assert.throws(() => oneShotSceneSchema.parse(scene(change)), pattern);
  bad((s) => { s.data.extra = 1; return s; }, /unrecognized/i);
  bad((s) => { s.data.steps[0].kind = 'swirl'; return s; }, /invalid/i);
  bad((s) => { s.data.result.words = ['أ', 'ب', 'ج']; return s; }, /too.small|at least 4/i);
  bad((s) => { s.data.steps[2].jobs = ['واحد']; return s; }, /too.small|at least 2/i);
  bad((s) => { s.data.closing.platforms = []; return s; }, /too.small|at least 1/i);
  bad((s) => { s.data.accent = 'green'; return s; }, /#RRGGBB/);
  bad((s) => { s.data.brand = '   '; return s; }, /blank/);
  bad((s) => { s.layout = 'split'; return s; }, /invalid/i);
});

test('the timing check names the chain length and refuses a typed sentence that cannot sit beside the file', () => {
  const issues = (change, fps = 30) => validateOneShotTiming(oneShotSceneSchema.parse(scene(change)), fps);
  assert.match(issues((s) => { s.durationInFrames = 500; return s; }).join('|'), /needs at least 590 frames \(19\.7 s at 30 fps\) and the scene lasts 500/);
  assert.match(issues((s) => { s.durationInFrames = 900; return s; }, 60).join('|'), /needs at least 1179 frames/);
  assert.deepEqual(issues((s) => { s.durationInFrames = 640; return s; }), [], 'frames beyond the chain hold the home page');
  assert.deepEqual(issues((s) => { s.durationInFrames = 590; return s; }), [], 'the exact length is enough');
  assert.match(issues((s) => { s.data.steps[1].text = 'كلمة واحدة بعد التانية لحد ما تبقى سبع كلمات'; return s; }).join('|'), /at most 6 words/);
  assert.match(issues((s) => { s.data.steps[1].text = 'اكتب طلب طويل قوي '.repeat(2).trim(); return s; }).join('|'), /characters beside the file name/);
  const noDrop = (text) => issues((s) => { s.data.steps = [{...s.data.steps[1], text}, s.data.steps[2]]; return s; }).join('|');
  assert.match(noDrop('ا'.repeat(35)), /types at most 34 characters/, 'without a file the sentence has room for 34 characters');
  assert.equal(noDrop('ا'.repeat(34)), '');
  assert.match(issues((s) => { s.data.steps[1] = {kind: 'stat', title: s.data.steps[1].title, value: 1, decimals: 0, unit: 'ث', label: 'ملصق'}; return s; }).join('|'), /\(drop\) must be followed by a field step/);
});

test('a chain that breaks the colour grammar cannot become a project', () => {
  const title = {top: 'أ', bottom: 'ب'};
  assert.throws(() => normalizeGraphicsSpec({...spec(), scenes: [scene((s) => {
    s.data.steps = [{kind: 'field', title, text: 'اكتب', placeholder: 'ج'}, {kind: 'stat', title, value: 3, decimals: 0, unit: 'ث', label: 'ملصق'}];
    return s;
  })]}), /same colour/);
});

test('sounds "auto" places the style palette on the scene cues and every recipe exists in the palette', async () => {
  const edit = normalizeGraphicsSpec(spec());
  const palette = await loadStylePalette('one-shot');
  const plan = autoSoundPlan(edit, palette);
  assert.equal(plan.style, 'one-shot');
  assert.ok(plan.sounds.length >= 18 && plan.sounds.length <= 40, `${plan.sounds.length} sounds`);
  const allowed = new Set(['air-rise', 'air-pass', 'sub-thud', 'cursor-click', 'ui-click', 'soft-pop']);
  for (const sound of plan.sounds) {
    assert.ok(allowed.has(sound.recipe), sound.recipe);
    assert.ok(Number.isInteger(sound.atFrame) && sound.atFrame >= 0 && sound.atFrame < 600);
  }
  assert.ok(plan.sounds.filter((s) => s.recipe === 'air-rise').length >= 4, 'the swallow, the circle, the dive and the dive home');
  assert.ok(plan.sounds.some((s) => s.recipe === 'air-pass'));
  assert.equal(edit.sounds.length, 0, 'normalizing alone does not place sounds; the creation command does');
  assert.doesNotThrow(() => editManifestSchema.parse({...edit, sounds: plan.sounds}));
});

test('the editor offers the starter chain only in this style, and it is valid at every frame rate', () => {
  assert.ok(TEMPLATE_FAMILIES.includes('one-shot'));
  assert.ok(templateFamiliesFor('one-shot').includes('one-shot'));
  assert.equal(templateFamiliesFor('paper-collage').includes('one-shot'), false);
  for (const fps of [30, 50, 60]) {
    const added = addSceneFromTemplate(oneShotManifest(fps), 'one-shot', {atFrame: 0});
    assert.equal(added.ok, true, `${fps} fps: ${JSON.stringify(added.error ?? added.issues ?? '')}`);
    const next = added.manifest.scenes[0];
    assert.equal(next.durationInFrames, oneShotTemplateFrames(fps));
    assert.deepEqual(validateOneShotTiming(oneShotSceneSchema.parse(next), fps), []);
  }
  assert.equal(addSceneFromTemplate({...oneShotManifest(), style: 'paper-collage'}, 'one-shot', {atFrame: 0}).ok, false);
  assert.equal(addSceneFromTemplate(oneShotManifest(), 'one-shot', {atFrame: 0, durationInFrames: 200}).ok, false, 'a chain shorter than its length is refused');
});

test('the form knows the family, labels its fields in Arabic and flags only the placeholder copy', () => {
  assert.ok(formFamilies().includes('one-shot'));
  const keys = new Set(JSON.stringify(fieldsForFamily('one-shot')).match(/"key":"[A-Za-z]+"/g).map((entry) => entry.slice(7, -1)));
  for (const key of ['brand', 'intro', 'steps', 'result', 'closing', 'item', 'target', 'placeholder', 'options', 'jobs', 'platforms', 'decimals']) {
    assert.ok(keys.has(key), key);
    assert.match(fieldLabel(key), /\p{Script=Arabic}/u, key);
  }
  assert.deepEqual(validateData('one-shot', structuredClone(oneShotTemplate)).issues ?? [], []);
  const demo = sceneDemoFields({family: 'one-shot', data: structuredClone(oneShotTemplate)});
  assert.ok(demo.includes('brand') && demo.includes('steps.0.item'), 'the placeholder copy is flagged');
  assert.equal(demo.some((path) => /(^|\.)kind$/.test(path)), false, 'a step kind is a choice, not copy');
  assert.equal(demo.some((path) => path.startsWith('closing.platforms')), false, 'platform names are real names');
  assert.deepEqual(Object.keys(oneShotTemplateData), ['one-shot']);
});
