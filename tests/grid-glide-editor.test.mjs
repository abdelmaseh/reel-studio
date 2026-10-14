import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {GRID_GLIDE_FAMILIES, glideEnterSchema, gridGlideSceneSchema, validateGridGlideTiming} from '../engine/src/styles/grid-glide/scenes/schema.ts';
import {GLIDE_TEMPLATE_SCREEN, gridGlideTemplate, gridGlideTemplateData, gridGlideTemplateFrames} from '../engine/src/styles/grid-glide/scenes/templates.ts';
import {fieldLabel, fieldsForFamily, formFamilies, validateData} from '../engine/src/review-editor/panels/form-schema.ts';
import {TEMPLATE_FAMILIES, addSceneFromTemplate, sceneDemoFields, setSceneField, templateFamiliesFor} from '../engine/src/review-editor/ops/scenes.ts';
import {reviewManifest} from './helpers/review-manifest.mjs';

const ARABIC = /\p{Script=Arabic}/u;
const glideManifest = (fps = 30) => {
  const m = reviewManifest();
  m.style = 'grid-glide';
  m.source.fps = fps;
  m.source.totalFrames = 900;
  m.segments = [{fromFrame: 0, toFrame: 900}];
  m.scenes = [];
  return m;
};
const allKeys = (fields) => fields.flatMap((field) => [field.key,
  ...(field.kind === 'object' ? allKeys(field.fields) : field.kind === 'array' ? allKeys([field.item])
    : field.kind === 'union' ? field.variants.flatMap((variant) => allKeys(variant.field.fields)) : [])]).filter(Boolean);
const find = (fields, key) => fields.find((field) => field.key === key);

test('every template validates against the form schema, the scene schema and the timing rules at 30, 50 and 60 fps', () => {
  for (const family of GRID_GLIDE_FAMILIES) {
    assert.equal(validateData(family, gridGlideTemplateData[family]).ok, true, family);
    for (const fps of [30, 50, 60]) {
      const scene = {id: 'template', family, fromFrame: 0, durationInFrames: gridGlideTemplateFrames(family, fps), layout: 'takeover', motion: 'quiet', data: gridGlideTemplate(family, fps)};
      const parsed = gridGlideSceneSchema.safeParse(scene);
      assert.equal(parsed.success, true, `${family} at ${fps} fps: ${parsed.error?.message}`);
      assert.deepEqual(validateGridGlideTiming(parsed.data, fps), [], `${family} at ${fps} fps`);
    }
  }
  assert.deepEqual(gridGlideTemplate('glide-chapter', 30), gridGlideTemplateData['glide-chapter']);
  assert.notEqual(gridGlideTemplate('glide-chapter', 30), gridGlideTemplateData['glide-chapter'], 'each call returns a copy');
  assert.throws(() => gridGlideTemplate('intro', 30), /No Grid Glide template/);
});

test('the placeholder screen is a real PNG that matches the template constants', async () => {
  const bytes = await readFile(new URL('../engine/public/examples/glide-template-screen.png', import.meta.url));
  assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(bytes.readUInt32BE(16), GLIDE_TEMPLATE_SCREEN.width);
  assert.equal(bytes.readUInt32BE(20), GLIDE_TEMPLATE_SCREEN.height);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), GLIDE_TEMPLATE_SCREEN.sha256);
  assert.equal(GLIDE_TEMPLATE_SCREEN.src, 'examples/glide-template-screen.png');
});

test('the scene picker offers the glide families only to their own style', () => {
  for (const family of GRID_GLIDE_FAMILIES) {
    assert.ok(TEMPLATE_FAMILIES.includes(family), family);
    assert.ok(formFamilies().includes(family), `${family} must be editable after being added`);
    assert.ok(templateFamiliesFor('grid-glide').includes(family), family);
    assert.equal(templateFamiliesFor('section-deck').includes(family), false, family);
  }
  assert.ok(templateFamiliesFor('section-deck').includes('intro'));
  assert.ok(templateFamiliesFor('grid-glide').includes('intro'), 'shared families stay available');
});

test('every editable Grid Glide field has an Arabic label and frame fields show seconds', () => {
  for (const family of GRID_GLIDE_FAMILIES) {
    const fields = fieldsForFamily(family);
    assert.ok(fields.length > 0, family);
    for (const key of new Set(allKeys(fields))) assert.notEqual(fieldLabel(key), key, `${family}.${key} needs an Arabic label`);
  }
  assert.equal(fieldLabel('role'), 'الدور', 'role is shared by the glide line role and the chapter quote speaker role, so the label stays neutral');
  assert.equal(find(fieldsForFamily('glide-chapter'), 'heroAt').isFrame, true);
  assert.equal(find(fieldsForFamily('glide-chapter'), 'pillAt').isFrame, true);
  const lineFields = find(fieldsForFamily('glide-lines'), 'lines').item.fields;
  assert.equal(find(lineFields, 'at').isFrame, true);
  assert.equal(find(lineFields, 'cadence').isFrame, false, 'cadence is a rhythm in 30 fps frames, not a position in the scene');
});

test('the enter and exit choices read in Arabic', () => {
  for (const family of GRID_GLIDE_FAMILIES) {
    const fields = fieldsForFamily(family);
    for (const key of ['enter', 'exit']) {
      const field = find(fields, key);
      assert.equal(field.kind, 'union', `${family}.${key}`);
      assert.equal(field.variants.length, 3, `${family}.${key}`);
      for (const variant of field.variants) assert.match(variant.label, ARABIC, `${family}.${key}: ${variant.label}`);
    }
  }
});

test('the slide distance is a select with 400 and 500, never a raw JSON field, and still defaults to 400', () => {
  for (const family of GRID_GLIDE_FAMILIES) {
    const slide = find(fieldsForFamily(family), 'enter').variants.find((variant) => variant.consts.kind === 'slide');
    const distance = find(slide.field.fields, 'distance');
    assert.equal(distance.kind, 'enum', `${family}: the distance renders as a choice`);
    assert.deepEqual(distance.options, [400, 500], family);
    assert.equal(distance.fixed, false, family);
    assert.equal(distance.default, 400, family);
  }
  assert.equal(glideEnterSchema.parse({kind: 'slide', from: 'left'}).distance, 400);
  assert.equal(glideEnterSchema.parse({kind: 'slide', from: 'right', distance: 500}).distance, 500);
  assert.equal(glideEnterSchema.safeParse({kind: 'slide', from: 'left', distance: 450}).success, false);
});

test('the live editor adds a ready, valid scene from each template at 30, 50 and 60 fps', () => {
  for (const fps of [30, 50, 60]) {
    for (const family of GRID_GLIDE_FAMILIES) {
      const added = addSceneFromTemplate(glideManifest(fps), family, {atFrame: 0});
      assert.equal(added.ok, true, `${family} at ${fps} fps: ${added.reason}`);
      const scene = added.manifest.scenes[0];
      assert.equal(scene.family, family);
      assert.equal(scene.layout, 'takeover');
      assert.equal(scene.durationInFrames, gridGlideTemplateFrames(family, fps));
      assert.deepEqual(scene.data, gridGlideTemplate(family, fps));
      assert.equal(editManifestSchema.safeParse(added.manifest).success, true, `${family} at ${fps} fps`);
    }
  }
  let m = glideManifest();
  for (const family of GRID_GLIDE_FAMILIES) {
    const added = addSceneFromTemplate(m, family, {atFrame: 0});
    assert.equal(added.ok, true, family);
    m = added.manifest;
  }
  assert.deepEqual(m.scenes.map((scene) => scene.family), [...GRID_GLIDE_FAMILIES]);
  assert.equal(editManifestSchema.safeParse(m).success, true);
});

test('a glide scene cannot be added to another style', () => {
  const m = glideManifest();
  m.style = 'section-deck';
  for (const family of GRID_GLIDE_FAMILIES) {
    const refused = addSceneFromTemplate(m, family, {atFrame: 0});
    assert.equal(refused.ok, false, family);
    assert.match(refused.reason, /grid-glide/);
    assert.match(refused.reason, ARABIC);
  }
});

test('a glide scene skips a gap too short for the whole template instead of being clipped into it', () => {
  for (const fps of [30, 50]) {
    const seeded = addSceneFromTemplate(glideManifest(fps), 'glide-chapter', {atFrame: 40});
    assert.equal(seeded.ok, true, `seed at ${fps} fps: ${seeded.reason}`);
    const seedEnd = 40 + gridGlideTemplateFrames('glide-chapter', fps);
    for (const family of GRID_GLIDE_FAMILIES) {
      const added = addSceneFromTemplate(seeded.manifest, family, {atFrame: 0});
      assert.equal(added.ok, true, `${family} at ${fps} fps: ${added.reason}`);
      const scene = added.manifest.scenes.find((candidate) => candidate.id === added.id);
      assert.ok(scene.fromFrame >= seedEnd, `${family} at ${fps} fps must start after the seeded scene, not in the 40 frame gap (got ${scene.fromFrame})`);
      assert.equal(scene.fromFrame, seedEnd, `${family} at ${fps} fps takes the first gap that fits`);
      assert.equal(scene.durationInFrames, gridGlideTemplateFrames(family, fps));
      assert.equal(editManifestSchema.safeParse(added.manifest).success, true, `${family} at ${fps} fps`);
    }
  }
});

test('a glide scene is refused in Arabic when no gap holds the whole template', () => {
  const m = glideManifest();
  const filler = addSceneFromTemplate(m, 'glide-lines', {atFrame: 40, durationInFrames: 860});
  assert.equal(filler.ok, true, filler.reason);
  assert.equal(filler.manifest.scenes[0].fromFrame + filler.manifest.scenes[0].durationInFrames, 900);
  for (const family of GRID_GLIDE_FAMILIES) {
    const refused = addSceneFromTemplate(filler.manifest, family, {atFrame: 0});
    assert.equal(refused.ok, false, family);
    assert.match(refused.reason, /مفيش مساحة فاضية/, family);
    assert.match(refused.reason, ARABIC, family);
  }
  const clipped = addSceneFromTemplate(filler.manifest, 'intro', {atFrame: 0});
  assert.equal(clipped.ok, true, `other families may still shrink into a short gap: ${clipped.reason}`);
  assert.equal(clipped.manifest.scenes[0].durationInFrames, 40);
});

test('demo fields flag unfinished copy and media, not structural choices', () => {
  const chapter = addSceneFromTemplate(glideManifest(), 'glide-chapter', {atFrame: 0});
  const scene = chapter.manifest.scenes[0];
  const fields = sceneDemoFields(scene);
  assert.ok(fields.includes('ordinal') && fields.includes('pill.label'), fields.join(','));
  assert.equal(fields.some((path) => /(^|\.)(kind|role|from|dir|sha256)$/.test(path)), false, 'structural choices are not copy');
  const edited = setSceneField(chapter.manifest, scene.id, ['ordinal'], 'Step two');
  assert.equal(edited.ok, true);
  assert.equal(sceneDemoFields(edited.manifest.scenes[0]).includes('ordinal'), false);
  const media = addSceneFromTemplate(glideManifest(), 'glide-card', {atFrame: 0});
  const cardFields = sceneDemoFields(media.manifest.scenes[0]);
  assert.ok(cardFields.includes('media.clips.0.src') && cardFields.includes('lines.0.words.0'), cardFields.join(','));
  assert.equal(cardFields.some((path) => /(^|\.)(kind|role|from|dir|sha256)$/.test(path)), false);
});

test('the ending templates flag the placeholder keyword, handle and lines but not the FOLLOW label', () => {
  const comment = addSceneFromTemplate(glideManifest(), 'glide-comment', {atFrame: 0});
  const commentFields = sceneDemoFields(comment.manifest.scenes[0]);
  assert.ok(commentFields.includes('keyword') && commentFields.includes('lines.0.words.0') && commentFields.includes('box.text'), commentFields.join(','));
  const follow = addSceneFromTemplate(glideManifest(), 'glide-follow', {atFrame: 0});
  const followFields = sceneDemoFields(follow.manifest.scenes[0]);
  assert.ok(followFields.includes('handle') && followFields.includes('lines.0.words.0'), followFields.join(','));
  assert.equal(followFields.includes('pill.label'), false, 'FOLLOW is a real label, so keeping it is not unfinished copy');
  assert.equal(followFields.some((path) => /(^|\.)(kind|role|from|dir|sha256)$/.test(path)), false, 'structural choices are not copy');
  const edited = setSceneField(follow.manifest, follow.manifest.scenes[0].id, ['handle'], '@example.creator');
  assert.equal(edited.ok, true, edited.reason);
  assert.equal(sceneDemoFields(edited.manifest.scenes[0]).includes('handle'), false);
});

test('a new ending scene takes the keyword and the handle from the creator profile', () => {
  const profiled = (cta, handle) => {
    const m = glideManifest();
    m.creator = {...m.creator, handle, ending: {...m.creator.ending, cta, followCard: handle !== null}};
    return m;
  };
  const m = profiled('خطة', '@example.creator');
  const comment = addSceneFromTemplate(m, 'glide-comment', {atFrame: 0});
  assert.equal(comment.ok, true, comment.reason);
  assert.equal(comment.manifest.scenes[0].data.keyword, 'خطة', 'the keyword is the profile CTA');
  assert.equal(comment.manifest.scenes[0].data.heroAt, gridGlideTemplate('glide-comment', 30).heroAt, 'the rest of the template is untouched');
  assert.equal(sceneDemoFields(comment.manifest.scenes[0]).includes('keyword'), false, 'a prefilled keyword is not flagged as sample text');
  const follow = addSceneFromTemplate(m, 'glide-follow', {atFrame: 0});
  assert.equal(follow.ok, true, follow.reason);
  assert.equal(follow.manifest.scenes[0].data.handle, '@example.creator', 'the handle is the profile handle');
  assert.equal(sceneDemoFields(follow.manifest.scenes[0]).includes('handle'), false);
  assert.equal(editManifestSchema.safeParse(follow.manifest).success, true);
  // Each scene takes only its own field; the other fields keep the template.
  assert.equal(comment.manifest.scenes[0].data.handle, undefined);
  assert.equal(follow.manifest.scenes[0].data.keyword, undefined);
  // Without a CTA or a handle the placeholders stay.
  const bare = profiled(null, null);
  assert.equal(addSceneFromTemplate(bare, 'glide-comment', {atFrame: 0}).manifest.scenes[0].data.keyword, gridGlideTemplateData['glide-comment'].keyword);
  assert.equal(addSceneFromTemplate(bare, 'glide-follow', {atFrame: 0}).manifest.scenes[0].data.handle, gridGlideTemplateData['glide-follow'].handle);
  // A CTA of more than three words cannot be a keyword scene: the placeholder keeps the scene valid.
  const long = addSceneFromTemplate(profiled('اكتب خطة لي الآن', '@example.creator'), 'glide-comment', {atFrame: 0});
  assert.equal(long.ok, true, long.reason);
  assert.equal(long.manifest.scenes[0].data.keyword, gridGlideTemplateData['glide-comment'].keyword);
  // The fixed tests above stay true: the template itself is never changed by a prefill.
  assert.equal(gridGlideTemplate('glide-comment', 30).keyword, gridGlideTemplateData['glide-comment'].keyword);
});

test('the form renders every family in Arabic without a problem state', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const engineRequire = createRequire(new URL('../engine/package.json', import.meta.url));
  const {build} = engineRequire('esbuild');
  const bundle = await build({stdin: {contents: `
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {SchemaForm} from './engine/src/review-editor/panels/schema-form.tsx';
    export const render = (family, data) => renderToStaticMarkup(React.createElement(SchemaForm, {family, data, fps: 30, onCommit: () => null}));
  `, resolveDir: root, loader: 'tsx'}, nodePaths: [path.join(root, 'engine/node_modules')], bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent'});
  const loaded = {exports: {}};
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(engineRequire, loaded, loaded.exports);
  const expected = {
    'glide-chapter': ['كبسولة الأداة', 'طريقة الدخول', 'قطع مباشر'],
    'glide-card': ['الأسطر', 'النقاط', 'اللقطات بالترتيب', 'طريقة الخروج'],
    'glide-lines': ['الأسطر', 'شبكة الخلفية', 'العلامة الخافتة أسفل الشاشة'],
    'glide-comment': ['الأسطر', 'الكلمة المفتاحية', 'فريم ظهور الكلمة الكبيرة', 'الصندوق', 'طريقة الخروج'],
    'glide-follow': ['الـ handle', 'كبسولة الأداة / زرار المتابعة', 'فريم ظهور الكبسولة', 'العلامة الخافتة أسفل الشاشة'],
  };
  for (const family of GRID_GLIDE_FAMILIES) {
    const html = loaded.exports.render(family, gridGlideTemplate(family, 30));
    for (const label of expected[family]) assert.ok(html.includes(label), `${family} must show «${label}»`);
    assert.equal(html.includes('sf-msg bad'), false, `${family} must open without a problem state`);
  }
});
