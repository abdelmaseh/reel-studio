import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {ROOT} from '../scripts/lib/media.mjs';
import {loadReviewProject} from '../scripts/lib/review-editor-project.mjs';
import {editManifestSchema, editSceneSchema} from '../engine/src/prepared-edit/schema.ts';
import {ENDING_FAMILIES, brollIssues} from '../engine/src/prepared-edit/broll.ts';
import {creatorCtaIssue} from '../engine/src/review-editor/ops/scenes.ts';
import {valuesSchema} from '../engine/src/project-scenes/schema.ts';
import {addBrollScene, brollRefusal, clipOptionLabel} from '../engine/src/review-editor/ops/broll.ts';
import {explainEnglish, explainIssue} from '../engine/src/review-editor/ops/explain.ts';
import {validateManifest} from '../engine/src/review-editor/validate.ts';
import {buildFields, fieldsForFamily} from '../engine/src/review-editor/panels/form-schema.ts';
import {bundleEngine} from './helpers/engine-bundle.mjs';
import {realClip} from './helpers/clip-fixtures.mjs';
import {reviewManifest} from './helpers/review-manifest.mjs';

const entry = (extra = {}) => ({id: 'clip-0a1b2c3d', label: 'Desk', src: 'projects/example/a.mp4', sha256: 'a'.repeat(64), width: 1080, height: 1920, fps: 30, frames: 90, inFrame: 15,
  window: {fromSec: 0.5, toSec: 3}, source: {path: 'Raw/desk.mp4', sha256: 'b'.repeat(64)}, licence: 'creator-supplied (own footage)', hadAudio: false, addedAt: '2026-10-20T00:00:00.000Z', ...extra});
const manifest = (change = {}) => {
  const m = reviewManifest('broll-editor-manifest');
  m.style = 'split-canvas';
  m.source.totalFrames = 900;
  m.segments = [{fromFrame: 0, toFrame: 900}];
  m.scenes = [];
  return Object.assign(m, change);
};

test('adding B-roll places a two-second full-screen scene that starts where the clip was cut', () => {
  const added = addBrollScene(manifest(), entry(), {atFrame: 120});
  assert.equal(added.ok, true, added.reason);
  const scene = added.manifest.scenes[added.index];
  assert.deepEqual([scene.family, scene.layout, scene.fromFrame, scene.durationInFrames], ['screens', 'takeover', 120, 60]);
  assert.deepEqual(scene.data, {look: 'broll', steps: [{atFrame: 0, src: 'projects/example/a.mp4', sha256: 'a'.repeat(64), width: 1080, height: 1920, trimBeforeFrame: 15, fit: 'cover'}]});
  assert.equal(editManifestSchema.safeParse(added.manifest).success, true);
  assert.equal(added.notes.length, 1);
});

test('a clip that is shorter than two seconds limits the scene to what is left of it', () => {
  const added = addBrollScene(manifest(), entry({frames: 40, inFrame: 10}), {atFrame: 0});
  assert.equal(added.manifest.scenes[added.index].durationInFrames, 30);
});

test('a clip too small for the full screen goes in contained, with a note', () => {
  const added = addBrollScene(manifest(), entry({width: 1920, height: 1080}), {atFrame: 0});
  assert.equal(added.ok, true, added.reason);
  assert.equal(added.manifest.scenes[added.index].data.steps[0].fit, 'contain');
  assert.equal(added.notes.length, 2);
});

test('a clip that cannot fill the screen even contained is refused in Arabic, with a request for a larger clip', () => {
  for (const [width, height] of [[720, 1280], [860, 1529], [800, 1400], [500, 600]]) {
    const refused = addBrollScene(manifest(), entry({width, height}), {atFrame: 0});
    assert.equal(refused.ok, false, `${width}x${height} is too small even contained`);
    assert.match(refused.reason, /أصغر من أن تملأ الشاشة حتى بوضع contain/);
    assert.match(refused.reason, /بدقة أعلى/);
    assert.ok(refused.reason.includes(`${width}×${height}`), refused.reason);
    assert.doesNotMatch(refused.reason, /enlarged|Use fit|manifest/i, 'no English refusal reaches the creator');
  }
});

test('a clip at exactly 1.25x fills the screen, and one that only fits contained is added contained', () => {
  const exact = addBrollScene(manifest(), entry({width: 864, height: 1536}), {atFrame: 0});
  assert.equal(exact.ok, true, exact.reason);
  assert.equal(exact.manifest.scenes[exact.index].data.steps[0].fit, 'cover');
  assert.equal(exact.notes.length, 1);
  const square = addBrollScene(manifest(), entry({width: 1080, height: 1080}), {atFrame: 0});
  assert.equal(square.ok, true, square.reason);
  assert.equal(square.manifest.scenes[square.index].data.steps[0].fit, 'contain');
  assert.equal(square.notes.length, 2);
});

const stepOf = (extra = {}) => ({atFrame: 0, src: 'projects/example/a.mp4', sha256: 'a'.repeat(64), width: 1080, height: 1920, trimBeforeFrame: 0, fit: 'cover', ...extra});
const brollScene = (extra = {}, step = {}) => ({id: 'broll-7', family: 'screens', fromFrame: 60, durationInFrames: 90, layout: 'takeover', motion: 'quiet', data: {look: 'broll', steps: [stepOf(step)]}, ...extra});
const brollMessages = () => {
  const comment = {id: 'cta-1', family: 'comment', fromFrame: 30, durationInFrames: 30};
  const splitBox = {split: {windowTop: 800}};
  return {
    style: brollIssues({style: 'cartoon', scenes: [brollScene()]}),
    signoff: brollIssues({style: 'split-canvas', signoffFromFrame: 100, scenes: [brollScene()]}),
    ending: brollIssues({style: 'split-canvas', scenes: [comment, brollScene()]}),
    presenterless: brollIssues({style: 'split-canvas', presenter: false, scenes: [brollScene({layout: 'split'})]}),
    cover: brollIssues({style: 'split-canvas', scenes: [brollScene({}, {width: 1920, height: 1080})]}),
    contained: brollIssues({style: 'split-canvas', scenes: [brollScene({}, {width: 540, height: 960, fit: 'contain'})]}),
    splitCover: brollIssues({style: 'split-canvas', footage: splitBox, scenes: [brollScene({layout: 'split'}, {width: 540, height: 960})]}),
    splitContained: brollIssues({style: 'split-canvas', footage: splitBox, scenes: [brollScene({layout: 'split'}, {width: 300, height: 400, fit: 'contain'})]}),
    noSplit: brollIssues({style: 'split-canvas', presenter: false, scenes: [brollScene({}, {width: 1920, height: 1080})]}),
    label: brollIssues({style: 'split-canvas', footage: {...splitBox, pip: {sceneIds: ['broll-7']}}, scenes: [brollScene({}, {label: 'Desk'})]}),
  };
};

test('every B-roll manifest message has a neutral Arabic explanation that names the scene', () => {
  for (const [name, messages] of Object.entries(brollMessages())) {
    assert.equal(messages.length, 1, `${name}: ${messages.join(' | ')}`);
    const arabic = explainEnglish(messages[0]);
    assert.ok(arabic, `${name} has no Arabic explanation: ${messages[0]}`);
    assert.match(arabic, /[؀-ۿ]{3,}/, name);
    assert.ok(arabic.includes('broll-7'), `${name} must name the scene: ${arabic}`);
    assert.doesNotMatch(arabic, /must end|cannot sit|would be enlarged|is not available|needs the presenter|cannot carry|run scripts|node /i, `${name} still carries English or a command: ${arabic}`);
  }
});

test('the Arabic enlargement explanation keeps the factor and the box, and lists only the remedies that apply', () => {
  const cases = brollMessages();
  const say = (name) => explainEnglish(cases[name][0]);
  for (const [name, factor, box] of [['cover', '1.78', '1080×1920'], ['contained', '2.00', '1080×1920'], ['splitCover', '2.00', '1080×800'], ['splitContained', '2.00', '1080×800'], ['noSplit', '1.78', '1080×1920']]) {
    assert.ok(say(name).includes(factor) && say(name).includes(box) && say(name).includes('1.25'), `${name}: ${say(name)}`);
    assert.match(say(name), /بدقة أعلى/, `${name} always allows a larger clip`);
  }
  assert.ok(say('cover').includes('بنصف الشاشة') && say('cover').includes('contain'));
  assert.ok(say('contained').includes('بنصف الشاشة') && !say('contained').includes('contain'), say('contained'));
  assert.ok(!say('splitCover').includes('بنصف الشاشة') && say('splitCover').includes('contain'), say('splitCover'));
  assert.ok(!say('splitContained').includes('بنصف الشاشة') && !say('splitContained').includes('contain'), say('splitContained'));
  assert.ok(!say('noSplit').includes('بنصف الشاشة') && say('noSplit').includes('contain'), say('noSplit'));
});

test('the editor and the manifest rule agree on which scenes are endings', async () => {
  assert.deepEqual([...ENDING_FAMILIES].sort(), ['comment', 'creator-cta', 'follow', 'glide-comment', 'glide-follow']);
  const sceneOf = (family, id, fromFrame) => ({id, family, fromFrame, durationInFrames: 60, layout: 'takeover', motion: 'quiet', data: {}});
  for (const family of [...ENDING_FAMILIES, 'statement', 'screens']) {
    const isEnding = ENDING_FAMILIES.includes(family);
    const m = manifest();
    m.creator = {...m.creator, handle: '@reel.studio', ending: {cta: 'دليل', followCard: true, signOff: null}};
    m.scenes = [sceneOf(family, 'end-1', 0)];
    const editorSeesAnEnding = (creatorCtaIssue(m) ?? '').includes('مشهد ختام موجود بالفعل');
    const ruleSeesAnEnding = brollIssues({style: 'split-canvas', scenes: [sceneOf(family, 'end-1', 0), brollScene({fromFrame: 90})]}).some((message) => /cannot sit on or after the ending scenes/.test(message));
    assert.deepEqual([family, editorSeesAnEnding, ruleSeesAnEnding], [family, isEnding, isEnding]);
  }
  assert.doesNotMatch(await fs.readFile(path.join(ROOT, 'engine', 'src', 'review-editor', 'ops', 'scenes.ts'), 'utf8'), /const ENDING_FAMILIES/, 'the editor reads the one list instead of keeping its own');
});

test('the split layout message of the window look has an Arabic explanation too', () => {
  const windowScreens = {id: 'screens-1', family: 'screens', fromFrame: 0, durationInFrames: 120, layout: 'split', motion: 'quiet',
    data: {kicker: 'شاشات', steps: [{atFrame: 0, title: 'الأولى', src: 'projects/example/a.png', kind: 'image', fit: 'contain', trimBeforeFrame: 0}]}};
  const refused = editSceneSchema.safeParse(windowScreens);
  const english = refused.error.issues.map((issue) => issue.message).find((message) => /split layout/.test(message));
  assert.ok(english, 'the schema refuses the split layout for the window look');
  const arabic = explainEnglish(english);
  assert.match(arabic, /نصف الشاشة/);
  assert.doesNotMatch(arabic, /Only the B-roll/);
});

test('the editor shows the Arabic text for a B-roll problem, in the issues list and in a refused add', () => {
  const m = manifest({signoffFromFrame: 100});
  m.scenes = [brollScene({id: 'broll-7', fromFrame: 60, durationInFrames: 90})];
  const found = validateManifest(m).issues.find((issue) => /B-roll must end/.test(issue.detail ?? ''));
  assert.ok(found, 'the validation reports the sign-off rule');
  assert.match(found.message, /المشهد "broll-7"/);
  assert.doesNotMatch(found.message, /B-roll must end|مشكلة في الـ manifest/);
  assert.equal(explainIssue(found), found.message, 'the refusal text and the list text agree');
  const withEnding = manifest();
  withEnding.scenes = [{id: 'cta-1', family: 'creator-cta', fromFrame: 0, durationInFrames: 90, layout: 'presenter', motion: 'quiet',
    data: {title: 'اكتب', keyword: 'دليل', prompt: 'اكتب {keyword}', handle: '@reel.studio', followFrame: 30, clickedFrame: 60}}];
  const refused = addBrollScene(withEnding, entry(), {atFrame: 90});
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /المشهد "broll"/);
  assert.doesNotMatch(refused.reason, /cannot sit|B-roll must|مشكلة في الـ manifest/);
});

test('B-roll is refused for another frame rate, in a style that draws its own screen, and when there is no room', () => {
  assert.match(addBrollScene(manifest(), entry({fps: 24}), {atFrame: 0}).reason, /مسجّلة بمعدل 24 فريم/);
  assert.match(addBrollScene(manifest({style: 'cartoon'}), entry(), {atFrame: 0}).reason, /B-roll غير متاح في ستايل cartoon/);
  assert.match(brollRefusal(manifest({style: 'one-shot'})), /one-shot/);
  assert.equal(brollRefusal(manifest()), null);
  const short = manifest();
  short.source.totalFrames = 60;
  short.segments = [{fromFrame: 0, toFrame: 60}];
  assert.match(addBrollScene(short, entry(), {atFrame: 45}).reason, /لا توجد مساحة خالية/);
});

test('the form marks clip objects so the editor can show a picker instead of file fields', () => {
  const [root] = fieldsForFamily('screens');
  const steps = root.variants.find((variant) => variant.consts.look === 'broll').field.fields.find((field) => field.key === 'steps');
  assert.equal(steps.item.kind, 'object');
  assert.equal(steps.item.clip, true);
  const projectFields = buildFields(valuesSchema([{key: 'background', type: 'clip', required: true}]));
  assert.equal(projectFields.find((field) => field.key === 'background').clip, true);
  assert.notEqual(root.variants.find((variant) => variant.consts.look !== 'broll').field.fields.find((field) => field.key === 'steps').item.clip, true);
});

const form = await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {SchemaForm} from './engine/src/review-editor/panels/schema-form.tsx';
  export const render = (props) => renderToStaticMarkup(React.createElement(SchemaForm, {fps: 30, onCommit: () => null, ...props}));
`, {ssr: true});

const brollData = {look: 'broll', steps: [{atFrame: 0, src: 'projects/example/a.mp4', sha256: 'a'.repeat(64), width: 1080, height: 1920, trimBeforeFrame: 15, fit: 'cover'}]};

test('the form shows the registered clips in a picker and hides the file fields', () => {
  const html = form.render({family: 'screens', data: brollData, clips: [entry(), entry({id: 'clip-ffeeddcc', label: 'Street', src: 'projects/example/b.mp4', window: {fromSec: 1, toSec: 2}})]});
  assert.match(html, /aria-label="اللقطة"/);
  assert.match(html, /<option value="clip-0a1b2c3d" selected="">Desk · 2\.5ث<\/option>/, 'the window 0.5 to 3 s is 2.5 s, not the 3.0 s of the file with its handles');
  assert.match(html, /Street · 1\.0ث/);
  assert.doesNotMatch(html, /3\.0ث/, 'frames / fps counts both one-second handles and is no longer shown');
  assert.doesNotMatch(html, /بصمة الملف/);
  assert.match(html, /قص من البداية/);
});

test('a clip in a list shows the length of the chosen window, one decimal, without the one-second handles', () => {
  assert.equal(clipOptionLabel(entry()), 'Desk · 2.5ث');
  assert.equal(clipOptionLabel(entry({label: 'Short', frames: 150, window: {fromSec: 2, toSec: 4}})), 'Short · 2.0ث', 'a 2 s window of a 5 s file reads 2.0');
  assert.equal(clipOptionLabel(entry({label: 'Odd', window: {fromSec: 0.1, toSec: 2.3}})), 'Odd · 2.2ث', 'floating point noise in the subtraction does not leak');
});

test('the in-point of a clip says it counts frames of the clip file, while the step start still counts frames of the scene', () => {
  const sceneHint = 'فريم داخل المشهد';
  const html = form.render({family: 'screens', data: brollData, clips: [entry()]});
  assert.equal(html.split('فريم داخل ملف اللقطة نفسه').length - 1, 1, 'one note, under the in-point');
  assert.equal(html.split(sceneHint).length - 1, 1, 'and one for the step start, which counts frames of the scene');
  const underInPoint = html.match(/قص من البداية[^]*?<\/div>/)[0];
  assert.match(underInPoint, /فريم داخل ملف اللقطة نفسه/, 'the note under the in-point is the clip one');
  assert.doesNotMatch(underInPoint, new RegExp(sceneHint), 'and not the generic note about scene frames');
  const underStart = html.match(/فريم الظهور[^]*?<\/div>/)[0];
  assert.match(underStart, new RegExp(sceneHint), 'the step start keeps the note about scene frames');
  const windowLook = form.render({family: 'screens', data: {kicker: 'شاشات', steps: [{atFrame: 0, title: 'الأولى', src: 'projects/example/a.png', kind: 'image', fit: 'contain', trimBeforeFrame: 0}]}});
  assert.equal(windowLook.split('فريم داخل ملف اللقطة نفسه').length - 1, 0, 'the window look has no clip object');
  const [root] = fieldsForFamily('screens');
  const step = root.variants.find((variant) => variant.consts.look === 'broll').field.fields.find((field) => field.key === 'steps').item;
  assert.deepEqual(step.fields.filter((field) => field.inClipFile).map((field) => field.key), ['trimBeforeFrame']);
  const project = buildFields(valuesSchema([{key: 'background', type: 'clip', required: true}])).find((field) => field.key === 'background');
  assert.deepEqual(project.fields.filter((field) => field.inClipFile).map((field) => field.key), ['trimBeforeFrame'], 'a clip field of a project scene says the same');
});

test('the form explains how to register a clip when the project has none, and flags an unregistered file', () => {
  assert.match(form.render({family: 'screens', data: brollData, clips: []}), /اطلب من المساعد تجهيز لقطة/);
  assert.match(form.render({family: 'screens', data: brollData, clips: [entry({src: 'projects/example/other.mp4'})]}), /لقطة غير مسجّلة في المشروع/);
});

test('the project payload lists the registered clips, and a damaged clips.json gives an empty list and a warning', async (t) => {
  const {id, clip} = await realClip(t, {name: 'broll-editor'});
  const manifestFile = path.join(ROOT, 'Projects', id, 'edit.json');
  await fs.writeFile(manifestFile, JSON.stringify(reviewManifest(id)));
  const project = await loadReviewProject(`Projects/${id}/edit.json`);
  assert.deepEqual(project.clips.map((item) => item.id), [clip.id]);
  await fs.writeFile(path.join(ROOT, 'Projects', id, 'clips.json'), '{"version":1,"clips":"broken"}');
  const damaged = await loadReviewProject(`Projects/${id}/edit.json`);
  assert.deepEqual(damaged.clips, []);
  assert.ok(damaged.warnings.some((warning) => warning.includes('clips.json')));
});
