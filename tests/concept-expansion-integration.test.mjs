import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {CATALOG, catalogDemo, catalogSchema, getCatalogEntry, listMotionConcepts} from '../engine/src/motion-concepts/catalog.ts';
import {CONCEPT_IDS} from '../engine/src/motion-concepts/types.ts';
import {motionConceptDataSchema} from '../engine/src/creative-kit/semantic/schema.ts';
import {editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {buildFields, fieldsForFamily, blankValue, describeFields, validateData, scalarVariantIndex, recordKeyIssue} from '../engine/src/review-editor/panels/form-schema.ts';
import {addSceneFromTemplate, setSceneData, sceneDemoFields} from '../engine/src/review-editor/ops/scenes.ts';
import {normalizeGraphicsSpec} from '../scripts/lib/graphics-project.mjs';
import {previewDefinitions, getPreviewDefinition, previewFixtureIssues} from '../engine/src/library-preview/fixtures.ts';
import {reviewManifest} from './helpers/review-manifest.mjs';
import {TEMPLATE_DATA} from '../engine/src/review-editor/ops/demo.ts';

const require = createRequire(new URL('../engine/package.json', import.meta.url));
const {z} = require('zod');
const NEW = ['conditional-branching', 'identity-filtering'];
const scene = (id, config, durationInFrames) => ({id: `sample-${id}`, family: 'motion-concept', fromFrame: 0, durationInFrames, layout: 'takeover', motion: 'quiet', data: {concept: id, config}});

test('both new concepts remain individually discoverable and preserve all existing concepts', () => {
  assert.equal(CATALOG.length, 17);
  assert.equal(CONCEPT_IDS.length, 17);
  assert.ok(CATALOG.some(entry => entry.id === 'button-to-window'));
  assert.ok(CATALOG.some(entry => entry.id === 'chaos-to-brand'));
  for (const [id, query, minFrames, defaultFrames] of [
    ['conditional-branching', 'branch', 210, 270], ['identity-filtering', 'filter', 270, 330],
  ]) {
    const entry = getCatalogEntry(id);
    assert.equal(entry.family, 'flow');
    assert.equal(entry.loopable, false);
    assert.equal(entry.minFrames, minFrames);
    assert.equal(entry.defaultFrames, defaultFrames);
    assert.ok(entry.dataFields.length >= 3);
    assert.ok(listMotionConcepts({query}).concepts.some(item => item.id === id));
    assert.deepEqual(catalogSchema(id).parse(catalogDemo(id)), catalogDemo(id));
  }
});

test('normal scene schema preserves each config contract and rejects mismatched or invented fields', () => {
  for (const id of NEW) {
    const config = catalogDemo(id);
    assert.equal(motionConceptDataSchema.safeParse({concept: id, config}).success, true, id);
    assert.equal(validateData('motion-concept', {concept: id, config}).ok, true, id);
    assert.equal(motionConceptDataSchema.safeParse({concept: id, config: {...config, inventedResult: true}}).success, false);
    const other = NEW.find(value => value !== id);
    assert.equal(motionConceptDataSchema.safeParse({concept: id, config: catalogDemo(other)}).success, false);
  }
});

test('source-free planner preserves both native concepts and enforces readable floors at every supported fps', () => {
  for (const [id, seconds] of [['conditional-branching', 7], ['identity-filtering', 9]]) {
    for (const fps of [30, 50, 60]) {
      const config = catalogDemo(id), duration = fps * seconds;
      const raw = {version: 1, id: `sample-${id}`, fps, reviewedBy: 'Integration fixture', scenes: [scene(id, config, duration)]};
      const manifest = normalizeGraphicsSpec(raw);
      assert.deepEqual(manifest.scenes[0].data, {concept: id, config});
      assert.equal(manifest.contentMode, 'graphics');
      assert.deepEqual(manifest.captions.words, []);
      assert.equal(editManifestSchema.safeParse(manifest).success, true);
      assert.throws(() => normalizeGraphicsSpec({...raw, scenes: [scene(id, config, duration - 1)]}), /concept needs at least/);
    }
  }
});

test('live editor inserts the selected concept with its own fps-scaled sample and applies ordinary field edits', () => {
  for (const [id, seconds] of [['conditional-branching', 9], ['identity-filtering', 11]]) {
    for (const fps of [30, 50, 60]) {
      const manifest = reviewManifest();
      manifest.source.fps = fps; manifest.source.totalFrames = fps * 30;
      manifest.segments = [{fromFrame: 0, toFrame: fps * 30}]; manifest.scenes = [];
      const added = addSceneFromTemplate(manifest, 'motion-concept', {concept: id});
      assert.equal(added.ok, true, `${id}/${fps}`);
      const item = added.manifest.scenes[0];
      assert.equal(item.data.concept, id);
      assert.deepEqual(item.data.config, catalogDemo(id));
      assert.equal(item.durationInFrames, fps * seconds);
      const data = structuredClone(item.data);
      if (id === 'conditional-branching') data.config.branches.whenTrue = 'نتيجة معدلة';
      else data.config.retainedLabel = 'قائمة معدلة';
      const edited = setSceneData(added.manifest, item.id, data);
      assert.equal(edited.ok, true);
      assert.deepEqual(edited.manifest.scenes[0].data, data);
    }
  }
});

function fragmentedManifest(fps, firstGap = 100, totalFrames = 900) {
  const manifest = reviewManifest();
  manifest.source.fps = fps; manifest.source.totalFrames = totalFrames;
  manifest.segments = [{fromFrame: 0, toFrame: totalFrames}];
  manifest.scenes = [{id: 'manual-process', family: 'process', fromFrame: firstGap, durationInFrames: 150,
    layout: 'takeover', motion: 'quiet', data: structuredClone(TEMPLATE_DATA.process)}];
  return manifest;
}

test('selected concepts skip a 100-frame gap and use the later 650-frame gap at every supported fps', () => {
  for (const id of NEW) for (const fps of [30, 50, 60]) {
    const manifest = fragmentedManifest(fps), before = JSON.stringify(manifest);
    const result = addSceneFromTemplate(manifest, 'motion-concept', {concept: id});
    assert.equal(result.ok, true, `${id}/${fps}: ${result.reason ?? ''}`);
    const added = result.manifest.scenes[result.index];
    assert.equal(added.fromFrame, 250);
    assert.equal(added.durationInFrames, Math.min(fps * (id === 'conditional-branching' ? 9 : 11), 650));
    assert.deepEqual(result.manifest.scenes.find(item => item.id === 'manual-process'), manifest.scenes[0]);
    assert.equal(JSON.stringify(manifest), before, 'Adding must preserve the supplied manual snapshot');
  }
});

test('concept defaults may shrink into the first gap only while respecting their fps-scaled native minimum', () => {
  for (const [id, minimumSeconds] of [['conditional-branching', 7], ['identity-filtering', 9]]) for (const fps of [30, 50, 60]) {
    const gap = fps * minimumSeconds + 10, manifest = fragmentedManifest(fps, gap, 1800);
    const result = addSceneFromTemplate(manifest, 'motion-concept', {concept: id});
    assert.equal(result.ok, true, `${id}/${fps}`);
    assert.equal(result.manifest.scenes[result.index].fromFrame, 0);
    assert.equal(result.manifest.scenes[result.index].durationInFrames, gap);
    const tooShort = addSceneFromTemplate(manifest, 'motion-concept', {concept: id, durationInFrames: fps * minimumSeconds - 1});
    assert.equal(tooShort.ok, false, 'An explicitly unfinished choreography must still be refused');
  }
});

test('ordinary short templates retain their first-gap placement and failed concept insertion preserves manual scenes', () => {
  for (const fps of [30, 50, 60]) {
    const manifest = fragmentedManifest(fps), result = addSceneFromTemplate(manifest, 'process');
    assert.equal(result.ok, true);
    assert.equal(result.manifest.scenes[result.index].fromFrame, 0);
    assert.equal(result.manifest.scenes[result.index].durationInFrames, 100);
    const blocked = fragmentedManifest(fps, 100, 300), before = JSON.stringify(blocked);
    for (const id of NEW) assert.equal(addSceneFromTemplate(blocked, 'motion-concept', {concept: id}).ok, false);
    assert.equal(JSON.stringify(blocked), before);
  }
});

test('live fields expose numbers, booleans and attribute dictionaries without raw JSON editors', () => {
  const fields = buildFields(z.object({value: z.union([z.number().min(-100).max(100), z.boolean()]), attributes: z.record(z.string(), z.union([z.number(), z.boolean()]))}));
  assert.equal(fields[0].kind, 'scalar-union');
  assert.equal(fields[1].kind, 'record');
  assert.equal(fields[1].item.kind, 'scalar-union');
  assert.equal(blankValue(fields[0]), -100);
  assert.equal(scalarVariantIndex(fields[0], 42), 0);
  assert.equal(scalarVariantIndex(fields[0], false), 1);
  assert.deepEqual(blankValue(fields[1]), {});
  assert.equal(recordKeyIssue(fields[1], 'score', {}), null);
  assert.ok(recordKeyIssue(fields[1], 'score', {score: 82}));
  for (const unsafe of ['', '__proto__', 'constructor', 'prototype']) assert.ok(recordKeyIssue(fields[1], unsafe, {}));
  const conceptFields = fieldsForFamily('motion-concept')[0];
  for (const id of NEW) {
    const variant = conceptFields.variants.find(item => item.consts.concept === id);
    assert.ok(variant, id);
    assert.ok(!describeFields(variant.field.fields).some(field => field.endsWith(':json')), id);
  }
});

test('new concept templates identify authored sample copy without marking the fixed concept selector as copy', () => {
  for (const id of NEW) {
    const fields = sceneDemoFields({family: 'motion-concept', data: {concept: id, config: catalogDemo(id)}});
    assert.ok(fields.includes(id === 'conditional-branching' ? 'config.branches.whenTrue' : 'config.retainedLabel'));
    assert.ok(!fields.includes('concept'));
    assert.ok(!fields.includes('config.condition.kind'));
    assert.ok(!fields.some(field => field.endsWith('.op') || field.endsWith('.field')));
  }
});

test('new canonical previews and explicit alternate examples retain their native motion identity', () => {
  const definitions = previewDefinitions();
  for (const id of NEW) {
    const item = getPreviewDefinition(`concept:${id}`);
    assert.match(item.labelAr, /[\u0600-\u06ff]/);
    assert.ok(!item.labelAr.startsWith('مثال '));
    assert.deepEqual(previewFixtureIssues(item), []);
    assert.equal(item.durationInFrames, id === 'conditional-branching' ? 270 : 330);
    assert.equal(item.style, 'section-deck');
  }
  const branch = getPreviewDefinition('preview:conditional-branching-false');
  const filtering = getPreviewDefinition('preview:identity-filtering-all');
  assert.equal(branch.canonicalKey, 'concept:conditional-branching');
  assert.equal(filtering.canonicalKey, 'concept:identity-filtering');
  assert.equal(branch.style, 'paper-collage');
  assert.equal(filtering.style, 'paper-collage');
  assert.deepEqual(previewFixtureIssues(branch), []);
  assert.deepEqual(previewFixtureIssues(filtering), []);
  assert.ok(branch.fixture.data.input.value < branch.fixture.data.condition.threshold);
  assert.deepEqual(branch.fixture.data.branches, getPreviewDefinition('concept:conditional-branching').fixture.data.branches);
  assert.ok(filtering.fixture.data.criteria.length >= 2);
  // Concept alternates only; arabic-type carries one alternate preview per move (tests/arabic-type-registration.test.mjs).
  assert.equal(definitions.filter(item => item.canonicalKey?.startsWith('concept:')).length, 2);
  assert.equal(new Set(definitions.map(item => item.slug)).size, definitions.length);
});
