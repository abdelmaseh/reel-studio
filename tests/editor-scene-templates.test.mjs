import test from 'node:test';
import assert from 'node:assert/strict';
import {editSceneSchema} from '../engine/src/prepared-edit/schema.ts';
import {kineticSceneVariants} from '../engine/src/creative-kit/kinetic/schema.ts';
import {librarySceneVariants} from '../engine/src/motion-library/schema.ts';
import {SAMPLE_NUMBER, manifestSampleNumbers, sampleNumberPaths} from '../engine/src/prepared-edit/sample-numbers.ts';
import {KIT_LAYOUT, KIT_TEMPLATE_FAMILIES, TEMPLATE_TEXT, kitTemplate, kitTemplateData} from '../engine/src/review-editor/ops/templates.ts';
import {sceneTimingIssues} from '../engine/src/review-editor/ops/anchors.ts';
import {fieldLabel, fieldsForFamily, validateData} from '../engine/src/review-editor/panels/form-schema.ts';
import {creativeGalleryDefaults} from '../engine/src/creative-kit/schema.ts';
import {TEMPLATE_FAMILIES, addSceneFromTemplate, creatorCtaIssue, sceneDemoFields, templateFamiliesFor} from '../engine/src/review-editor/ops/scenes.ts';
import {FAMILY_LABEL_AR, SCENES_TEXT, familyLabel} from '../engine/src/review-editor/panels/family-labels.ts';
import {validateManifest} from '../engine/src/review-editor/validate.ts';
import {deliveryIssues, exportAvailability, saveAvailability} from '../engine/src/review-editor/shell/save-rules.ts';
import {setIn} from '../engine/src/review-editor/ops/paths.ts';
import {endingIssues} from '../scripts/lib/endings.mjs';
import {assertDeliveryReady, assertNoSampleText, editorRenderCommand} from '../scripts/lib/editor-director.mjs';
import {createFrameRenderer} from '../scripts/lib/ssr-frames.mjs';
import {bundleEngine} from './helpers/engine-bundle.mjs';
import {dialectIn} from './helpers/dialect.mjs';
import {textNodes} from './helpers/markup.mjs';
import {reviewManifest} from './helpers/review-manifest.mjs';

const ARABIC = /\p{Script=Arabic}/u;
const FPS = [24, 25, 30, 50, 60];
// A 30-second recording with no scenes, so every template has room.
const kitManifest = (fps = 30) => {
  const m = reviewManifest('kit-test');
  m.source.fps = fps;
  m.source.totalFrames = fps * 30;
  m.segments = [{fromFrame: 0, toFrame: fps * 30}];
  m.scenes = [];
  return m;
};
const withEnding = (m, ending, handle) => {
  m.creator = {displayName: 'Reel Studio', handle, ending: {cta: null, followCard: false, signOff: null, ...ending}};
  return m;
};
const sceneOf = (family, fps, room) => {
  const kit = kitTemplate(family, fps, room);
  return {id: `${family}-1`, family, fromFrame: 0, durationInFrames: kit.frames, layout: kit.layout, motion: 'quiet', data: kit.data};
};
const leaves = (value, path = []) => (value !== null && typeof value === 'object'
  ? Object.entries(value).flatMap(([key, child]) => leaves(child, [...path, key]))
  : [{path: path.join('.'), value}]);
const allKeys = (fields) => fields.flatMap((field) => [field.key,
  ...(field.kind === 'object' ? allKeys(field.fields) : field.kind === 'array' ? allKeys([field.item])
    : field.kind === 'union' ? field.variants.flatMap((variant) => allKeys(variant.field.fields)) : [])]).filter(Boolean);

test('the sample figure is valid for the two schemas that show a figure and is found by path', () => {
  assert.equal(SAMPLE_NUMBER, 987654);
  const count = sceneOf('count', 30);
  const story = sceneOf('data-story', 30);
  assert.equal(editSceneSchema.safeParse(count).success, true);
  assert.equal(editSceneSchema.safeParse(story).success, true);
  assert.deepEqual(sampleNumberPaths(count), ['value']);
  assert.deepEqual(sampleNumberPaths(story), ['items.0.value']);
  assert.deepEqual(sampleNumberPaths(sceneOf('checklist', 30)), []);
  const changed = structuredClone(count);
  changed.data.value = 1250;
  assert.deepEqual(sampleNumberPaths(changed), []);
  const second = structuredClone(story);
  second.data.items.push({label: 'اكتب اسم الرقم', value: SAMPLE_NUMBER, atFrame: 20});
  assert.deepEqual(sampleNumberPaths(second), ['items.0.value', 'items.1.value']);
  assert.deepEqual(manifestSampleNumbers({scenes: [count, changed, second]}).map((hit) => `${hit.sceneId}:${hit.path}`),
    ['count-1:value', 'data-story-1:items.0.value', 'data-story-1:items.1.value']);
  assert.deepEqual(sampleNumberPaths({family: 'count', data: null}), []);
});

test('every kit template validates, fits its timing rules and keeps the schema layout at 24 to 60 fps and at every room', () => {
  assert.deepEqual([...KIT_TEMPLATE_FAMILIES], ['checklist', 'data-story', 'count', 'outcome', 'statement', 'creator-cta']);
  for (const family of KIT_TEMPLATE_FAMILIES) {
    const variant = [...kineticSceneVariants, ...librarySceneVariants].find((schema) => schema.shape.family.value === family);
    assert.ok(variant, family);
    const layoutSchema = variant.shape.layout;
    const allowed = 'value' in layoutSchema ? [layoutSchema.value] : layoutSchema.options;
    assert.ok(allowed.includes(KIT_LAYOUT[family]), `${family}: table layout ${KIT_LAYOUT[family]} must be one the schema allows`);
    if ('value' in layoutSchema) assert.equal(KIT_LAYOUT[family], layoutSchema.value, `${family}: a literal layout gives the table value`);
    else assert.equal(KIT_LAYOUT[family], 'takeover', `${family}: the data-story choice takes the full canvas`);
    for (const fps of FPS) {
      const wanted = Math.round(({statement: 90}[family] ?? 120) * fps / 30);
      const least = Math.ceil(2 * fps);
      for (const room of [undefined, least, least + 7, wanted - 1, wanted, wanted + 50]) {
        const scene = sceneOf(family, fps, room);
        const label = `${family} at ${fps} fps, room ${room}`;
        assert.ok(scene.durationInFrames >= least && scene.durationInFrames <= wanted, label);
        if (room !== undefined) assert.ok(scene.durationInFrames <= room, label);
        const parsed = editSceneSchema.safeParse(scene);
        assert.equal(parsed.success, true, `${label}: ${parsed.error?.message}`);
        assert.deepEqual(sceneTimingIssues(parsed.data), [], label);
        assert.equal(validateData(family, scene.data).ok, true, label);
      }
    }
  }
});

test('templates are 120 frames at 30 fps except the statement, and gaps shorter than a template shrink the keys with it', () => {
  assert.deepEqual(KIT_TEMPLATE_FAMILIES.map((family) => kitTemplate(family, 30).frames), [120, 120, 120, 120, 90, 120]);
  assert.deepEqual(KIT_TEMPLATE_FAMILIES.map((family) => kitTemplate(family, 60).frames), [240, 240, 240, 240, 180, 240]);
  assert.deepEqual(kitTemplate('checklist', 30).data.items.map((item) => item.atFrame), [20, 48, 76]);
  assert.deepEqual(kitTemplate('checklist', 60).data.items.map((item) => item.atFrame), [40, 96, 152]);
  const half = kitTemplate('checklist', 30, 60);
  assert.equal(half.frames, 60);
  assert.deepEqual(half.data.items.map((item) => item.atFrame), [10, 24, 38]);
  assert.equal(kitTemplate('count', 30).data.rollDuration, 40);
  assert.equal(kitTemplate('count', 30, 60).data.rollDuration, 20);
  assert.equal(kitTemplate('creator-cta', 30).data.followFrame, 30);
  assert.equal(kitTemplate('creator-cta', 30).data.clickedFrame, 60);
  assert.throws(() => kitTemplate('count', 30, 59), /at least 60 frames/);
  assert.throws(() => kitTemplate('statement', 60, 100), /at least 120 frames/);
  const first = kitTemplate('outcome', 30);
  first.data.items[0] = 'changed';
  assert.notEqual(kitTemplate('outcome', 30).data.items[0], 'changed', 'every call returns a fresh copy');
  assert.deepEqual(kitTemplateData.count, kitTemplate('count', 30).data);
});

test('template text is Arabic placeholders, the figure is the sentinel and the structural choices stay in English', () => {
  const structural = new Set(['variant', 'suffix', 'display', 'keyword', 'handle']);
  for (const family of KIT_TEMPLATE_FAMILIES) {
    for (const {path, value} of leaves(kitTemplateData[family])) {
      const key = path.split('.').at(-1);
      if (typeof value !== 'string' || structural.has(key) || value === '') continue;
      assert.match(value, ARABIC, `${family}.${path} must be an Arabic placeholder`);
    }
  }
  assert.equal(kitTemplateData.count.value, SAMPLE_NUMBER);
  assert.equal(kitTemplateData['data-story'].items[0].value, SAMPLE_NUMBER);
  assert.equal(kitTemplateData['data-story'].display, 'metric');
  assert.equal(kitTemplateData.checklist.variant, 'blueprint');
  for (const text of Object.values(TEMPLATE_TEXT)) assert.deepEqual(dialectIn(text), [], text);
});

test('every field of every kit template has an Arabic label in the form', () => {
  for (const family of KIT_TEMPLATE_FAMILIES) {
    const fields = fieldsForFamily(family);
    assert.ok(fields.length > 0, family);
    for (const key of new Set(allKeys(fields))) assert.notEqual(fieldLabel(key), key, `${family}.${key} needs an Arabic label`);
  }
});

test('the picker offers the six templates after the original kit and offers creator-cta only when the profile supports it', () => {
  assert.equal(TEMPLATE_FAMILIES[0], 'intro');
  for (const family of KIT_TEMPLATE_FAMILIES) assert.ok(TEMPLATE_FAMILIES.includes(family), family);
  assert.deepEqual(templateFamiliesFor('section-deck').filter((family) => KIT_TEMPLATE_FAMILIES.includes(family)), [...KIT_TEMPLATE_FAMILIES]);
  const m = kitManifest();
  const offered = templateFamiliesFor(m.style, m);
  assert.equal(offered.includes('creator-cta'), false);
  for (const family of ['checklist', 'data-story', 'count', 'outcome', 'statement']) assert.ok(offered.includes(family), family);
  assert.ok(templateFamiliesFor(m.style, withEnding(m, {cta: 'دليل', followCard: true}, '@reel.studio')).includes('creator-cta'));
});

test('each template is added ready and valid at 24 to 60 fps with the layout, length and notes the table promises', () => {
  for (const fps of FPS) {
    for (const family of ['checklist', 'data-story', 'count', 'outcome', 'statement']) {
      const added = addSceneFromTemplate(kitManifest(fps), family, {atFrame: 0});
      assert.equal(added.ok, true, `${family} at ${fps} fps: ${added.reason}`);
      const scene = added.manifest.scenes[added.index];
      assert.equal(scene.family, family);
      assert.equal(scene.fromFrame, 0);
      assert.equal(scene.layout, KIT_LAYOUT[family]);
      assert.equal(scene.durationInFrames, kitTemplate(family, fps).frames);
      assert.deepEqual(scene.data, kitTemplate(family, fps).data);
      assert.equal(scene.id, family);
      assert.equal(validateManifest(added.manifest).ok, true, `${family} at ${fps} fps`);
      assert.equal(added.notes[0], TEMPLATE_TEXT.added);
      assert.equal(added.notes.includes(TEMPLATE_TEXT.addedWithNumber), ['count', 'data-story'].includes(family), family);
    }
  }
  const twice = addSceneFromTemplate(addSceneFromTemplate(kitManifest(), 'outcome', {atFrame: 0}).manifest, 'outcome', {atFrame: 0});
  assert.equal(twice.ok, true);
  assert.deepEqual(twice.manifest.scenes.map((scene) => scene.id), ['outcome', 'outcome-2']);
  assert.equal(twice.manifest.scenes[1].fromFrame, twice.manifest.scenes[0].durationInFrames, 'the second one takes the next free room');
});

test('a gap shorter than the template shrinks it and a gap under two seconds is refused in neutral Arabic', () => {
  const m = kitManifest();
  m.scenes = [
    {id: 'first', family: 'intro', fromFrame: 0, durationInFrames: 60, layout: 'split', motion: 'quiet', data: structuredClone(creativeGalleryDefaults.intro)},
    {id: 'last', family: 'intro', fromFrame: 140, durationInFrames: 60, layout: 'split', motion: 'quiet', data: structuredClone(creativeGalleryDefaults.intro)},
  ];
  const added = addSceneFromTemplate(m, 'checklist', {atFrame: 60});
  assert.equal(added.ok, true, added.reason);
  assert.equal(added.manifest.scenes[added.index].fromFrame, 60);
  assert.equal(added.manifest.scenes[added.index].durationInFrames, 80);
  assert.equal(validateManifest(added.manifest).ok, true);
  const tight = structuredClone(m);
  Object.assign(tight.scenes[1], {fromFrame: 100, durationInFrames: 800});
  const refused = addSceneFromTemplate(tight, 'checklist', {atFrame: 60});
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /ثانيتين/);
  assert.deepEqual(dialectIn(refused.reason), []);
  const short = addSceneFromTemplate(kitManifest(), 'count', {atFrame: 0, durationInFrames: 40});
  assert.equal(short.ok, false);
  assert.match(short.reason, /ثانيتين/);
});

test('creator-cta needs the comment keyword, the follow card and a complete handle, goes last and fills the profile values', () => {
  const ask = (m) => addSceneFromTemplate(m, 'creator-cta', {atFrame: 0});
  const profile = {cta: 'دليل', followCard: true};
  const noCreator = kitManifest();
  delete noCreator.creator;
  const cases = [
    ['no creator', noCreator, /ملف للمبدع/],
    ['comment only', withEnding(kitManifest(), {cta: 'دليل', followCard: false}, null), /بطاقة المتابعة/],
    ['follow only', withEnding(kitManifest(), {cta: null, followCard: true}, '@reel.studio'), /كلمة مفتاحية/],
    ['neither', withEnding(kitManifest(), {cta: null, followCard: false}, null), /كلمة مفتاحية/],
    ['a keyword over 20 characters', withEnding(kitManifest(), {cta: 'ك'.repeat(21), followCard: true}, '@reel.studio'), /كلمة مفتاحية/],
  ];
  for (const [label, m, pattern] of cases) {
    const refused = ask(m);
    assert.equal(refused.ok, false, label);
    assert.match(refused.reason, pattern, label);
    assert.deepEqual(dialectIn(refused.reason), [], label);
    assert.equal(creatorCtaIssue(m), refused.reason, label);
  }
  const withEnd = withEnding(kitManifest(), profile, '@reel.studio');
  withEnd.scenes = [{id: 'comment', family: 'comment', fromFrame: 0, durationInFrames: 90, layout: 'takeover', motion: 'quiet', data: structuredClone(creativeGalleryDefaults.comment)}];
  assert.match(ask(withEnd).reason, /مشهد ختام/);
  const crowded = withEnding(kitManifest(), profile, '@reel.studio');
  crowded.scenes = [{id: 'intro', family: 'intro', fromFrame: 0, durationInFrames: 880, layout: 'split', motion: 'quiet', data: structuredClone(creativeGalleryDefaults.intro)}];
  assert.match(ask(crowded).reason, /بعد آخر مشهد/);
  assert.equal(templateFamiliesFor(crowded.style, crowded).includes('creator-cta'), false);

  const ready = withEnding(kitManifest(), profile, '@reel.studio');
  ready.scenes = [{id: 'intro', family: 'intro', fromFrame: 0, durationInFrames: 60, layout: 'split', motion: 'quiet', data: structuredClone(creativeGalleryDefaults.intro)}];
  const added = ask(ready);
  assert.equal(added.ok, true, added.reason);
  const scene = added.manifest.scenes[added.index];
  assert.equal(added.index, 1, 'the ending scene is always the last one, whatever the playhead says');
  assert.equal(scene.fromFrame, 60);
  assert.equal(scene.layout, 'presenter');
  assert.equal(scene.data.keyword, 'دليل');
  assert.equal(scene.data.handle, '@reel.studio');
  assert.equal(validateManifest(added.manifest).ok, true);
  assert.deepEqual(endingIssues(added.manifest), [], 'the delivery ending gate accepts the template as the whole ending');
  assert.deepEqual(sceneDemoFields(scene).sort(), ['prompt', 'title'], 'the profile values are real, only the free text is a sample');
  assert.equal(ask(added.manifest).ok, false, 'a second ending is refused');

  const signed = withEnding(kitManifest(), {cta: 'دليل', followCard: true, signOff: 'مع السلامة'}, '@reel.studio');
  signed.signoffFromFrame = 500;
  const beforeSignoff = ask(signed);
  assert.equal(beforeSignoff.ok, true, beforeSignoff.reason);
  const end = beforeSignoff.manifest.scenes.at(-1);
  assert.ok(end.fromFrame + end.durationInFrames <= 500, 'everything ends before the recorded sign-off');
});

test('graphics projects accept only the full-canvas templates', () => {
  const m = kitManifest();
  m.contentMode = 'graphics';
  const offered = templateFamiliesFor(m.style, m);
  for (const family of ['checklist', 'data-story']) assert.ok(offered.includes(family), family);
  for (const family of ['count', 'outcome', 'statement', 'creator-cta']) assert.equal(offered.includes(family), false, family);
  const refused = addSceneFromTemplate(m, 'count', {atFrame: 0});
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /مشاريع الجرافيك/);
});

test('a fresh template lists its sample text and never its structural choices; written text is not sample text', () => {
  const count = addSceneFromTemplate(kitManifest(), 'count', {atFrame: 0}).manifest.scenes[0];
  assert.deepEqual(sceneDemoFields(count).sort(), ['kicker', 'title', 'unit']);
  const story = addSceneFromTemplate(kitManifest(), 'data-story', {atFrame: 0}).manifest.scenes[0];
  assert.deepEqual(sceneDemoFields(story).sort(), ['items.0.label', 'kicker', 'sourceNote', 'title', 'unit']);
  const checklist = addSceneFromTemplate(kitManifest(), 'checklist', {atFrame: 0}).manifest.scenes[0];
  assert.equal(sceneDemoFields(checklist).includes('variant'), false);
  const written = structuredClone(count);
  Object.assign(written.data, {kicker: 'أرقام العام', title: 'عدد المشاهدات', unit: 'مشاهدة'});
  assert.deepEqual(sceneDemoFields(written), []);
  for (const family of KIT_TEMPLATE_FAMILIES) {
    const fields = sceneDemoFields({family, data: kitTemplateData[family]});
    for (const key of ['variant', 'suffix', 'display']) assert.equal(fields.includes(key), false, `${family}.${key}`);
    assert.equal(fields.some((field) => field.endsWith('.suffix')), false, family);
  }
});

test('the scene picker labels every kit template in Arabic and the new panel text is neutral Arabic', () => {
  for (const family of KIT_TEMPLATE_FAMILIES) {
    assert.match(familyLabel(family), ARABIC, family);
    assert.ok(familyLabel(family).includes(family), `${family}: the label keeps the family id for the assistant`);
  }
  assert.equal(familyLabel('intro'), 'intro');
  assert.deepEqual(Object.keys(FAMILY_LABEL_AR).sort(), [...KIT_TEMPLATE_FAMILIES].sort());
  for (const text of Object.values(SCENES_TEXT)) assert.deepEqual(dialectIn(text), [], text);
});

test('the Scenes panel labels the templates, explains the sample text and flags a sample figure', async () => {
  const {render} = await bundleEngine(`
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {EditorStoreProvider, createEditorStore} from './engine/src/review-editor/store.ts';
    import {ScenesPanel} from './engine/src/review-editor/panels/scenes.tsx';
    export const render = (manifest) => {
      const store = createEditorStore(manifest);
      const props = {manifest, apply: store.apply, playhead: 0, seek() {}, selection: null, select() {}, issues: [], project: {staticFiles: []}};
      return renderToStaticMarkup(React.createElement(EditorStoreProvider, {store}, React.createElement(ScenesPanel, props)));
    };
  `);
  const m = kitManifest();
  const added = addSceneFromTemplate(m, 'count', {atFrame: 0});
  const html = render(added.manifest);
  assert.ok(html.includes(SCENES_TEXT.sampleNumberBadge), 'a scene that still shows the sample figure carries the badge');
  assert.ok(html.includes('نص تجريبي'), 'and the sample text badge');
  assert.ok(html.includes(SCENES_TEXT.helper));
  for (const family of templateFamiliesFor(m.style, added.manifest)) assert.ok(html.includes(`>${familyLabel(family)}</option>`), family);
  const fixed = structuredClone(added.manifest);
  fixed.scenes[0].data.value = 1250;
  assert.equal(render(fixed).includes(SCENES_TEXT.sampleNumberBadge), false, 'a written figure drops the badge');
});

// ---- the sample figure and the sample words block the final export, never saving ------------------------------
const readyToDeliver = (m) => {
  m.purpose = 'delivery';
  m.captions.status = 'reviewed';
  m.captions.reviewer = 'Recorded words reviewed';
  return m;
};
const withScene = (family, fps = 30) => readyToDeliver(addSceneFromTemplate(kitManifest(fps), family, {atFrame: 0}).manifest);
const codes = (validation, code) => validation.issues.filter((issue) => issue.code === code);

const WRITTEN_COUNT = {kicker: 'أرقام العام', title: 'عدد المشاهدات', unit: 'مشاهدة'};

test('a template figure and template words are delivery errors that never block saving', () => {
  const m = withScene('count');
  const v = validateManifest(m);
  assert.equal(v.ok, true, 'the sample figure and the sample words are not schema errors');
  assert.equal(saveAvailability(v).enabled, true, 'saving is never blocked');
  assert.equal(v.deliveryReady, false);
  const numbers = codes(v, 'delivery:sample-number');
  assert.equal(numbers.length, 1);
  assert.equal(numbers[0].severity, 'error');
  assert.equal(numbers[0].stage, 'delivery');
  assert.equal(numbers[0].path, 'scenes.0.data.value');
  assert.match(numbers[0].message, /987654/);
  assert.deepEqual(dialectIn(numbers[0].message), []);
  const text = codes(v, 'delivery:sample-text');
  assert.equal(text.length, 1);
  assert.equal(text[0].severity, 'error', 'placeholder words must not be published either');
  assert.equal(text[0].stage, 'delivery');
  assert.equal(text[0].path, 'scenes.0.data');
  assert.equal(text[0].detail, 'Delivery sample text: scene count still holds the template words at data.kicker, data.title, data.unit.');
  assert.deepEqual(dialectIn(text[0].message), []);
  assert.deepEqual(v.issues.filter((issue) => issue.stage === 'delivery').map((issue) => issue.code), ['delivery:sample-number', 'delivery:sample-text'], 'the figure comes first');

  const deliver = exportAvailability(v, 'deliver', {id: 'deliver', label: 'x', available: true}, false);
  assert.equal(deliver.enabled, false);
  assert.match(deliver.reason, /\(2\)/, 'the count names the figure and the words');
  assert.match(deliver.reason, /987654/, 'the first reason is the figure');

  const written = structuredClone(m);
  written.scenes[0].data.value = 1250;
  const afterFigure = validateManifest(written);
  assert.equal(codes(afterFigure, 'delivery:sample-number').length, 0);
  assert.equal(codes(afterFigure, 'delivery:sample-text').length, 1, 'the sample text is still an error');
  assert.equal(afterFigure.deliveryReady, false, 'the words still block the final export');
  const afterReason = exportAvailability(afterFigure, 'deliver', {id: 'deliver', label: 'x', available: true}, false);
  assert.equal(afterReason.enabled, false);
  assert.match(afterReason.reason, /\(1\)/);
  assert.match(afterReason.reason, /نصًا تجريبيًا/);
  assert.equal(deliveryIssues(afterFigure).length, 1);
  assert.equal(saveAvailability(afterFigure).enabled, true, 'saving still never waits for the words');

  const finished = structuredClone(written);
  Object.assign(finished.scenes[0].data, WRITTEN_COUNT);
  const done = validateManifest(finished);
  assert.deepEqual(done.issues.filter((issue) => issue.stage === 'delivery'), []);
  assert.equal(done.deliveryReady, true);
  assert.equal(exportAvailability(done, 'deliver', {id: 'deliver', label: 'x', available: true}, false).enabled, true);
});

test('every figure of a data-story is reported with its own path and other families never flag sample text', () => {
  const m = withScene('data-story');
  m.scenes[0].data.display = 'bars';
  m.scenes[0].layout = 'takeover';
  m.scenes[0].data.items.push({label: 'اكتب اسم الرقم', value: SAMPLE_NUMBER, atFrame: 20});
  const v = validateManifest(m);
  assert.equal(v.ok, true, JSON.stringify(v.issues.filter((issue) => issue.severity === 'error' && issue.stage !== 'delivery')));
  assert.deepEqual(codes(v, 'delivery:sample-number').map((issue) => issue.path), ['scenes.0.data.items.0.value', 'scenes.0.data.items.1.value']);
  const intro = readyToDeliver(addSceneFromTemplate(kitManifest(), 'intro', {atFrame: 0}).manifest);
  const calm = validateManifest(intro);
  assert.equal(codes(calm, 'delivery:sample-text').length, 0, 'only the kit templates flag sample text');
  assert.equal(calm.deliveryReady, true);
});

test('the export dialog lists every delivery item and the drawer shows the template words once', async () => {
  const {renderExport, renderDrawer} = await bundleEngine(`
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {ExportDialog} from './engine/src/review-editor/ExportDialog.tsx';
    import {IssuesDrawer} from './engine/src/review-editor/IssuesDrawer.tsx';
    import {initialJob} from './engine/src/review-editor/shell/job-state.ts';
    export const renderExport = (validation) => renderToStaticMarkup(React.createElement(ExportDialog, {open: true, onClose() {}, intent: 'export',
      project: {exportModes: [{id: 'preview', label: 'p', available: true}, {id: 'deliver', label: 'd', available: true}]}, validation, pending: false, dirty: false,
      needsPrepare: false, job: initialJob, onStart() {}, onCancel() {}, onReset() {}, onReconnect() {}, onPrepareInstead() {}, client: {}, editSeconds: 10, notify() {}}));
    export const renderDrawer = (validation, manifest) => renderToStaticMarkup(React.createElement(IssuesDrawer, {open: true, onClose() {}, validation, manifest, onNavigate() {}}));
  `);
  const m = withScene('count');
  const blocked = renderExport(validateManifest(m));
  assert.ok(blocked.includes('ناقص للتصدير النهائي (2)'), 'the figure and the words are both counted');
  assert.equal(blocked.includes('تنبيه ·'), false, 'neither is a warning any more');
  const written = structuredClone(m);
  written.scenes[0].data.value = 1250;
  const wordsLeft = validateManifest(written);
  assert.ok(renderExport(wordsLeft).includes('ناقص للتصدير النهائي (1)'), 'the words alone still block the final export');
  const finished = structuredClone(written);
  Object.assign(finished.scenes[0].data, WRITTEN_COUNT);
  assert.equal(renderExport(validateManifest(finished)).includes('rv-warnings'), false, 'nothing to list when the template is fully written');
  // The list is generic: a delivery warning that no rule raises today would still be shown, without blocking.
  const note = {path: 'scenes.0.data', where: 'x', message: 'm', severity: 'warning', stage: 'delivery', code: 'delivery:note'};
  const notes = renderExport({ok: true, deliveryReady: true, issues: [note]});
  assert.ok(notes.includes('ملاحظات قبل التصدير النهائي (1)'), 'a warning alone is listed');
  assert.ok(notes.includes('تنبيه ·'));
  assert.equal(notes.includes('ناقص للتصدير النهائي'), false);
  const drawer = renderDrawer(wordsLeft, written);
  assert.equal(drawer.split('نصًا تجريبيًا').length - 1, 1, 'the words appear once, under the delivery group');
});

test('the command-line delivery gate refuses the template figure and the template words with the scene, the path and a way out', () => {
  const m = withScene('count');
  assert.throws(() => assertDeliveryReady(m), (error) => {
    assert.match(error.message, /^Delivery sample number: scene count still shows the template figure 987654 at data\.value\. Write the real figure with its source\./);
    assert.match(error.message, /two figures/);
    return true;
  });
  assert.throws(() => assertDeliveryReady(withScene('data-story')), /scene data-story still shows the template figure 987654 at data\.items\.0\.value/);
  const written = structuredClone(m);
  written.scenes[0].data.value = 1250;
  assert.throws(() => assertDeliveryReady(written), (error) => {
    assert.equal(error.message, 'Delivery sample text: scene count still holds the template words at data.kicker, data.title, data.unit. Write the real words in those fields before delivery.');
    return true;
  });
  const finished = structuredClone(written);
  Object.assign(finished.scenes[0].data, WRITTEN_COUNT);
  assert.equal(assertDeliveryReady(finished).ok, true, 'a figure with its words written passes');
  const prepared = {propsFile: 'Projects/kit-test/prepared/props.json', sfxFile: 'Projects/kit-test/prepared/sounds.wav'};
  const screenOnly = (manifest) => ({...manifest, presenter: false, camera: []});
  assert.throws(() => editorRenderCommand(screenOnly(m), prepared, {delivery: true}), /Delivery sample number/);
  assert.throws(() => editorRenderCommand(screenOnly(written), prepared, {delivery: true}), /Delivery sample text: scene count/);
  assert.ok(editorRenderCommand(screenOnly(finished), prepared, {delivery: true}).args.includes('--deliver'));
  assert.ok(editorRenderCommand(screenOnly(m), prepared, {}).args.includes('--preview'), 'a preview render is not gated');
  assert.ok(editorRenderCommand(screenOnly(written), prepared, {review: true}).args.includes('--no-proxy'), 'a review render is not gated either');
});

test('the gate names every scene and field that still holds template words, and only the words that are still the template', () => {
  const m = withScene('checklist');
  const added = addSceneFromTemplate(m, 'outcome', {atFrame: 0});
  assert.equal(added.ok, true, added.reason);
  assert.throws(() => assertDeliveryReady(added.manifest), (error) => {
    assert.match(error.message, /^Delivery sample text: scene checklist still holds the template words at data\.kicker, data\.title, data\.items\.0\.label, data\.items\.0\.detail,/);
    assert.match(error.message, /; scene outcome still holds the template words at data\.kicker, data\.title, data\.items\.0, data\.items\.1, data\.items\.2, data\.footer\./);
    assert.match(error.message, /Write the real words in those fields before delivery\.$/);
    return true;
  });
  const partly = structuredClone(added.manifest);
  Object.assign(partly.scenes[0].data, {kicker: 'قائمة النشر', title: 'راجع قبل النشر'});
  partly.scenes[0].data.items.forEach((item, index) => Object.assign(item, {label: `نقطة ${index + 1}`, detail: `تفصيل ${index + 1}`}));
  assert.throws(() => assertNoSampleText(partly), (error) => {
    assert.doesNotMatch(error.message, /scene checklist/, 'a written scene is not named');
    assert.match(error.message, /^Delivery sample text: scene outcome still holds/);
    return true;
  });
  Object.assign(partly.scenes[1].data, {kicker: 'النتيجة', title: 'ما الذي ستحصل عليه', items: ['أولًا', 'ثانيًا', 'ثالثًا'], footer: 'من إعداد صاحب الفيديو'});
  assert.doesNotThrow(() => assertNoSampleText(partly));
  const intro = readyToDeliver(addSceneFromTemplate(kitManifest(), 'intro', {atFrame: 0}).manifest);
  assert.doesNotThrow(() => assertNoSampleText(intro), 'only the kit templates are guarded, like the editor');
});

test('the editor and the command line flag the same scenes and fields through one detection', () => {
  const real = (scene) => sceneDemoFields(scene).reduce((data, path, index) =>
    setIn(data, path.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part)), `كلام حقيقي ${index + 1}`), scene.data);
  for (const family of KIT_TEMPLATE_FAMILIES) {
    const base = family === 'creator-cta' ? withEnding(kitManifest(), {cta: 'دليل', followCard: true}, '@reel.studio') : kitManifest();
    const added = addSceneFromTemplate(base, family, {atFrame: 0});
    assert.equal(added.ok, true, `${family}: ${added.reason}`);
    const manifest = readyToDeliver(added.manifest);
    const fields = sceneDemoFields(manifest.scenes[added.index]);
    assert.ok(fields.length > 0, family);
    const issue = codes(validateManifest(manifest), 'delivery:sample-text');
    assert.equal(issue.length, 1, family);
    assert.equal(issue[0].detail, `Delivery sample text: scene ${family} still holds the template words at ${fields.map((field) => `data.${field}`).join(', ')}.`, family);
    assert.throws(() => assertNoSampleText(manifest), (error) => error.message.includes(`scene ${family} still holds the template words at ${fields.map((field) => `data.${field}`).join(', ')}`), family);
    const written = structuredClone(manifest);
    written.scenes[added.index].data = real(written.scenes[added.index]);
    assert.deepEqual(sceneDemoFields(written.scenes[added.index]), [], family);
    assert.equal(validateManifest(written).ok, true, `${family}: the written words still validate`);
    assert.equal(codes(validateManifest(written), 'delivery:sample-text').length, 0, family);
    assert.doesNotThrow(() => assertNoSampleText(written), family);
  }
});

let frames;
const rendered = async (scene, options = {}) => {
  frames ??= await createFrameRenderer();
  return textNodes(frames.renderScene({scene: editSceneSchema.parse(scene), style: 'section-deck', frame: 200, ...options})).join(' ');
};

test('the count template ships no suffix, so a real figure is drawn as typed', async () => {
  for (const fps of FPS) assert.equal(kitTemplate('count', fps).data.suffix, '', `${fps} fps`);
  assert.equal(kitTemplateData.count.suffix, '');
  const count = sceneOf('count', 30);
  assert.equal(editSceneSchema.safeParse(count).success, true, 'an empty suffix is valid');
  assert.equal(validateData('count', count.data).ok, true);
  assert.equal(addSceneFromTemplate(kitManifest(), 'count', {atFrame: 0}).manifest.scenes[0].data.suffix, '');
  assert.deepEqual(sceneDemoFields(count).filter((field) => field === 'suffix'), [], 'the empty suffix is never sample text');
  const real = structuredClone(count);
  Object.assign(real.data, {...WRITTEN_COUNT, value: 1250});
  const shown = await rendered(real, {frame: 100});
  assert.ok(shown.includes('1,250'), shown);
  assert.equal(shown.includes('1,250+'), false, 'no claim nobody typed');
  Object.assign(real.data, {suffix: '+'});
  assert.ok((await rendered(real, {frame: 100})).includes('1,250+'), 'a suffix the creator types is still drawn');
  assert.equal(editSceneSchema.safeParse({...count, data: {...count.data, suffix: '123456789'}}).success, false, 'the length limit stays');
});
