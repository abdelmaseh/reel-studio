import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STYLE_IDS, STYLE_METAS, getStyleMeta, ownSceneStyle} from '../engine/src/styles/registry.ts';

const meta = () => getStyleMeta('cartoon');

test('cartoon is the last registered style and owns its two families', () => {
  assert.equal(STYLE_IDS.at(-1), 'cartoon');
  assert.equal(STYLE_METAS.length, 14);
  assert.deepEqual([...meta().ownScenes], ['cartoon', 'cartoon-ending']);
  assert.equal(ownSceneStyle('cartoon'), 'cartoon');
  assert.equal(ownSceneStyle('cartoon-ending'), 'cartoon');
  assert.equal(meta().since, '3.0.0');
  assert.equal(meta().label.ar, 'كارتون');
  assert.equal(meta().brand, false);
  assert.equal(meta().pip.allowed, false);
  assert.equal(meta().defaults.font, 'Plex Display');
  assert.ok(meta().fit.purpose.explainer < 10 && meta().fit.purpose.tutorial < 10, 'fit stays below the asserted winners');
  const sound = JSON.parse(readFileSync(new URL('../engine/src/styles/cartoon/sound.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(sound.kinds).sort(), ['click', 'count', 'reveal', 'stamp', 'swap', 'transition', 'type']);
  assert.equal(sound.kinds.transition.recipe, 'cartoon-flip');
  assert.equal(sound.kinds.stamp.recipe, 'cartoon-stamp');
});

import {cartoonSceneSchema, validateCartoonTiming, validateCartoonWords, cartoonSequenceIssues, cartoonAssetClaims, cartoonVideoSources} from '../engine/src/styles/cartoon/scenes/schema.ts';
import {styleSceneFamilies, styleSceneSchema} from '../engine/src/styles/scenes.ts';
import {body, bodyScene, words} from './helpers/cartoon-fixtures.mjs';

const endingScene = (over = {}) => ({id: 'end', family: 'cartoon-ending', fromFrame: 260, durationInFrames: 120, layout: 'takeover', motion: 'quiet', data: {
  fromTheme: 'dark', theme: 'light', tag: '// 03 — follow', entrance: {x: 540, scale: 0.86},
  sentences: [{from: 16, to: 19}], accents: [], follow: {handle: '@example.creator', message: 'تابعني لمحتوى أكثر', at: {word: 16}, tapAt: {word: 18, dt: 0.04}}, ...over}});
// Words 16..19 land 0.3 s after the ending starts (frame 269 at 30 fps), so the reveal leads the first sentence by 0.3 s.
const shifted = (by, count = 20) => words(count).map((w) => ({...w, fromFrame: w.fromFrame + by, toFrame: w.toFrame + by}));
const endingWords = shifted(29);

test('both families are registered style scenes and the schema accepts the sample body and ending', () => {
  assert.ok(styleSceneFamilies.includes('cartoon') && styleSceneFamilies.includes('cartoon-ending'));
  assert.equal(styleSceneSchema.safeParse(bodyScene()).success, true);
  assert.equal(cartoonSceneSchema.safeParse(endingScene()).success, true);
  assert.equal(cartoonSceneSchema.safeParse(bodyScene({cards: [{id: 'x', kind: 'nope', from: {word: 0}, to: {word: 1}, data: {}}]})).success, false);
  assert.equal(cartoonSceneSchema.safeParse(bodyScene({acts: [{theme: 'light', sentence: 0, tag: 'a'}]})).success, false, 'two acts at least');
  assert.equal(cartoonSceneSchema.safeParse(endingScene({follow: undefined})).success, false, 'an ending needs a comment or a follow part');
  assert.equal(cartoonSceneSchema.safeParse(endingScene({fromTheme: 'light'})).success, false, 'the ending opens with a reveal, so the grounds differ');
});

test('word-free and word-anchored validators report the spec faults', () => {
  assert.deepEqual(validateCartoonTiming(cartoonSceneSchema.parse(bodyScene()), 30), []);
  assert.deepEqual(validateCartoonWords(cartoonSceneSchema.parse(bodyScene()), words(), 30), []);
  assert.deepEqual(validateCartoonWords(cartoonSceneSchema.parse(endingScene()), endingWords, 30), []);
  const bad = validateCartoonWords(cartoonSceneSchema.parse(bodyScene({sentences: [{from: 0, to: 3}, {from: 5, to: 7}, {from: 8, to: 11}, {from: 12, to: 15}]})), words(), 30);
  assert.match(bad.join('|'), /body: sentence/);
  const far = validateCartoonWords(cartoonSceneSchema.parse(endingScene()), shifted(40), 30);
  assert.match(far.join('|'), /lead/, 'the ending reveal must lead its first sentence by 0.2..0.5 s');
});

test('continuity: the ending starts where the body ends and from its last theme and place', () => {
  const ok = [bodyScene({places: [{at: {word: 12}, x: 540, scale: 0.86}]}), endingScene()];
  assert.deepEqual(cartoonSequenceIssues(ok), []);
  assert.match(cartoonSequenceIssues([bodyScene(), endingScene({fromTheme: 'pink'})]).join('|'), /fromTheme/);
  assert.match(cartoonSequenceIssues([bodyScene(), {...endingScene(), fromFrame: 270}]).join('|'), /start where the cartoon body ends/);
});

test('monitor clips are the only assets and the only moving sources', () => {
  const clip = {src: 'cartoon/screen.mp4', sha256: 'b'.repeat(64), width: 1920, height: 1080, kind: 'video'};
  const withMonitor = cartoonSceneSchema.parse(bodyScene({cards: [{id: 'm', kind: 'monitor', from: {word: 0}, to: {word: 3}, data: {clip, crop: {x: 0, y: 0, w: 1920}, label: 'my screen', trimBeforeFrame: 10}}]}));
  assert.deepEqual(cartoonVideoSources(withMonitor), ['cartoon/screen.mp4']);
  const [claim] = cartoonAssetClaims(withMonitor);
  assert.equal(claim.src, 'cartoon/screen.mp4');
  assert.equal(claim.kind, 'video');
  assert.deepEqual(cartoonVideoSources(cartoonSceneSchema.parse(bodyScene())), []);
  void body;
});

import {editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {reviewManifest} from './helpers/review-manifest.mjs';

export const cartoonManifest = (scenes, wordCount = 16) => {
  const m = reviewManifest('cartoon-test');
  m.style = 'cartoon';
  m.source.totalFrames = 400;
  m.segments = [{fromFrame: 0, toFrame: 400}];
  m.captions.words = Array.from({length: wordCount}, (_, i) => ({text: i % 5 === 2 ? 'API' : `كلمة${i}`, startMs: i * 500, endMs: i * 500 + 300, confidence: 1}));
  m.scenes = scenes;
  return m;
};

test('the manifest refuses a cartoon scene whose sentences do not tile its words', () => {
  const good = editManifestSchema.safeParse(cartoonManifest([bodyScene()]));
  assert.equal(good.success, true, JSON.stringify(good.error?.issues));
  const broken = editManifestSchema.safeParse(cartoonManifest([bodyScene({sentences: [{from: 0, to: 3}, {from: 5, to: 7}, {from: 8, to: 11}, {from: 12, to: 15}]})]));
  assert.equal(broken.success, false);
  assert.match(JSON.stringify(broken.error.issues), /tile/);
  assert.equal(editManifestSchema.safeParse(cartoonManifest([{...bodyScene(), family: 'glide-lines'}])).success, false, 'a cartoon family still belongs to cartoon only');
});

import {normalizePreferences, OPTIONAL_PREFERENCES} from '../scripts/lib/branding.mjs';
import {defaultPreferences} from '../engine/src/core/preference-options.ts';
import {DEFAULT_CHARACTER} from '../engine/src/styles/cartoon/scenes/character.ts';

test('a profile may keep a fixed cartoon character; a missing key means the generic default', () => {
  assert.ok(OPTIONAL_PREFERENCES.includes('character'));
  const plain = normalizePreferences(defaultPreferences());
  assert.equal('character' in plain, false);
  const saved = normalizePreferences({...defaultPreferences(), character: {mode: 'fixed', value: {...DEFAULT_CHARACTER, beard: {kind: 'full', color: '#2B211D'}}}});
  assert.equal(saved.character.value.beard.kind, 'full');
  assert.throws(() => normalizePreferences({...defaultPreferences(), character: {mode: 'fixed', value: {...DEFAULT_CHARACTER, skin: 'tan'}}}), /character/);
  assert.equal('character' in normalizePreferences({...defaultPreferences(), character: {mode: 'auto', value: null}}), false);
  assert.throws(() => normalizePreferences({...defaultPreferences(), character: {mode: 'fixed', value: 'beard'}}), /character/);
});

import {endingIssues, signoffCoverageIssues} from '../scripts/lib/endings.mjs';
import {assertDeliveryReady} from '../scripts/lib/editor-director.mjs';

// 26 words: 0..15 every 0.5 s (the body), 16..25 shifted by 0.967 s so the ending (frame 260) opens 0.3 s before word 16.
// Edit frames: word 16 -> 269, 20 -> 329, 23 -> 374, 24 -> 389, 25 -> 404; the edit ends at 420.
const deliveryEnding = (data) => ({id: 'end', family: 'cartoon-ending', fromFrame: 260, durationInFrames: 160, layout: 'takeover', motion: 'quiet', data: {
  fromTheme: 'dark', theme: 'light', tag: '// 03 — follow', entrance: {x: 540, scale: 0.86}, accents: [], ...data}});
const followPartOf = () => ({follow: {handle: '@example.creator', message: 'تابعني لمحتوى أكثر', at: {word: 16}, tapAt: {word: 18, dt: 0.04}}});
const withEnding = (data, {signOff = null, cta = null, follow = true} = {}) => {
  const m = cartoonManifest([bodyScene(), deliveryEnding(data)], 26);
  m.source.totalFrames = 420; m.segments = [{fromFrame: 0, toFrame: 420}];
  m.captions.words = m.captions.words.map((w, i) => ({...w, startMs: w.startMs + (i >= 16 ? 967 : 0), endMs: w.endMs + (i >= 16 ? 967 : 0)}));
  m.creator = {...m.creator, handle: '@example.creator', ending: {cta, followCard: follow, signOff}};
  if (signOff) m.signoffFromFrame = 389; else delete m.signoffFromFrame;
  m.purpose = 'delivery'; m.captions.status = 'reviewed'; m.captions.reviewer = 'owner'; m.sounds = [];
  return m;
};
const allWords = {sentences: [{from: 16, to: 19}, {from: 20, to: 25}]};

test('the cartoon ending counts as the follow card, the comment card, or both, with the profile handle and keyword', () => {
  const m = withEnding({...allWords, ...followPartOf()});
  assert.equal(editManifestSchema.safeParse(m).success, true, JSON.stringify(editManifestSchema.safeParse(m).error?.issues?.slice(0, 2)));
  assert.deepEqual(endingIssues(m), []);
  assert.doesNotThrow(() => assertDeliveryReady(m));
  m.scenes[1].data.follow.handle = '@example.other';
  assert.match(endingIssues(m).join('|'), /complete profile handle/);
  const both = withEnding({...allWords, comment: {keyword: 'PLAN', promise: 'the question list', at: {word: 16}}, follow: {...followPartOf().follow, at: {word: 18}, tapAt: {word: 19}}}, {cta: 'PLAN'});
  assert.deepEqual(endingIssues(both), []);
  both.scenes[1].data.comment.keyword = 'OTHER';
  assert.match(endingIssues(both).join('|'), /keyword must be/);
  assert.match(endingIssues(withEnding({...allWords, ...followPartOf()}, {follow: false})).join('|'), /follow card is off/);
  assert.match(endingIssues(withEnding({...allWords, ...followPartOf()}, {cta: 'PLAN'})).join('|'), /comment part/);
});

test('with the recorded sign-off on, only a cartoon tail may cover it, and it must be quiet', () => {
  const quiet = withEnding({sentences: [{from: 16, to: 19}, {from: 20, to: 23}], ...followPartOf(), tail: {at: {word: 24}}}, {signOff: 'سلام'});
  assert.deepEqual(endingIssues(quiet), []);
  assert.deepEqual(signoffCoverageIssues(quiet), []);
  assert.doesNotThrow(() => assertDeliveryReady(quiet));
  const covering = withEnding({...allWords, ...followPartOf()}, {signOff: 'سلام'});
  assert.match(endingIssues(covering).join('|'), /only a cartoon tail/);
  assert.throws(() => assertDeliveryReady(covering), /sign-?off/i);
  const late = withEnding({sentences: [{from: 16, to: 19}, {from: 20, to: 24}], ...followPartOf(), tail: {at: {word: 25}}}, {signOff: 'سلام'});
  assert.match(endingIssues(late).join('|'), /tail must start at or before the sign-off/);
  const short = withEnding({sentences: [{from: 16, to: 19}, {from: 20, to: 23}], ...followPartOf(), tail: {at: {word: 24}}}, {signOff: 'سلام'});
  short.scenes[1].durationInFrames = 150;
  assert.match(endingIssues(short).join('|'), /runs to the edit end/);
  const other = withEnding({...allWords, ...followPartOf()}, {signOff: 'سلام'});
  other.scenes = [{...other.scenes[0], durationInFrames: 400}];
  assert.match(signoffCoverageIssues(other).join('|'), /only a cartoon tail/, 'a last body without a tail is told to add one');
  const earlier = withEnding({sentences: [{from: 16, to: 19}, {from: 20, to: 23}], ...followPartOf(), tail: {at: {word: 24}}}, {signOff: 'سلام'});
  earlier.scenes[0] = {...earlier.scenes[0], durationInFrames: 395};
  assert.match(signoffCoverageIssues(earlier).join('|'), /Every scene must finish before the recorded sign-off/, 'any scene before the last still finishes before the sign-off');
});

import {buildEditorPlan, editorRenderCommand, validateEditorBrief} from '../scripts/lib/editor-director.mjs';
import {profileToBrief} from '../scripts/lib/branding.mjs';
import {readFile} from 'node:fs/promises';

const exampleProfile = JSON.parse(await readFile(new URL('../PROFILE.example.json', import.meta.url), 'utf8'));
const cartoonBrief = (beats, extra = {}) => ({version: 1, id: 'cartoon-brief', source: 'Raw/example.mp4', transcript: 'Projects/cartoon-brief/words.json', ...profileToBrief(exampleProfile),
  purpose: 'explainer', tone: 'calm', style: 'cartoon', sourceKind: 'cartoon', beats, ...extra});
const briefSource = {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 260};
const briefWords = Array.from({length: 16}, (_, i) => ({text: i % 5 === 2 ? 'API' : `كلمة${i}`, startMs: i * 500, endMs: i * 500 + 300, confidence: 1}));
const wholeBody = (data = body()) => [{id: 'body', fromSec: 0, toSec: 260 / 30, intent: 'cartoon', data}];

test('a cartoon source has no presenter: the manifest says so, delivery exempts motion, and the scenes must cover the whole timeline', () => {
  assert.doesNotThrow(() => validateEditorBrief(cartoonBrief(wholeBody())));
  assert.throws(() => validateEditorBrief({...cartoonBrief(wholeBody()), sourceKind: 'drawing'}), /sourceKind/);
  const plan = buildEditorPlan(cartoonBrief(wholeBody()), briefSource, briefWords);
  assert.equal(plan.manifest.presenter, false);
  assert.equal(plan.manifest.style, 'cartoon');
  assert.equal(plan.manifest.scenes[0].family, 'cartoon');
  assert.equal(plan.manifest.scenes[0].layout, 'takeover');
  const cmd = editorRenderCommand({...plan.manifest, purpose: 'delivery', captions: {...plan.manifest.captions, status: 'reviewed', reviewer: 'owner'}}, {propsFile: 'Projects/cartoon-brief/prepared/props.json', sfxFile: 'Projects/cartoon-brief/prepared/sounds.wav'}, {delivery: true});
  assert.ok(cmd.args.includes('--motion-exempt'));
  assert.throws(() => buildEditorPlan(cartoonBrief([{...wholeBody()[0], fromSec: 1}]), briefSource, briefWords), /cover the complete timeline/);
  assert.throws(() => buildEditorPlan(cartoonBrief([{id: 'hook', fromSec: 0, toSec: 2, intent: 'intro', data: {kicker: 'a', title: 'b', subtitle: 'c', caption: 'd'}}]), briefSource, briefWords), /cartoon scenes/);
});

test('a fixed profile character reaches a cartoon beat that does not set its own', () => {
  const character = {...DEFAULT_CHARACTER, beard: {kind: 'full', color: '#2B211D'}, hair: {style: 'quiff', color: '#2A2320'}};
  const brief = cartoonBrief(wholeBody());
  brief.preferences = {...brief.preferences, character: {mode: 'fixed', value: character}};
  const plan = buildEditorPlan(brief, briefSource, briefWords);
  assert.equal(plan.manifest.scenes[0].data.character.beard.kind, 'full');
  const own = buildEditorPlan({...brief, beats: wholeBody({...body(), character: DEFAULT_CHARACTER})}, briefSource, briefWords);
  assert.equal(own.manifest.scenes[0].data.character.beard.kind, 'none', 'a beat with its own character keeps it');
});

import {TEMPLATE_FAMILIES, addSceneFromTemplate, sceneDemoFields, templateFamiliesFor} from '../engine/src/review-editor/ops/scenes.ts';
import {fieldLabel, fieldsForFamily} from '../engine/src/review-editor/panels/form-schema.ts';
import {cartoonTemplate, cartoonEndingTemplate} from '../engine/src/styles/cartoon/scenes/templates.ts';
import {assertNoSampleText} from '../scripts/lib/editor-director.mjs';

test('the editor offers both cartoon families with Arabic labels, builds a valid template from the scene words, and flags its placeholders', () => {
  assert.ok(TEMPLATE_FAMILIES.includes('cartoon') && TEMPLATE_FAMILIES.includes('cartoon-ending'));
  assert.ok(templateFamiliesFor('cartoon').includes('cartoon'));
  assert.ok(!templateFamiliesFor('one-shot').includes('cartoon'), 'own families stay with their style');
  const m = cartoonManifest([], 24);
  const added = addSceneFromTemplate(m, 'cartoon', {atFrame: 0, durationInFrames: 260});
  assert.equal(added.ok, true, JSON.stringify(added));
  const scene = added.manifest.scenes[0];
  assert.equal(scene.family, 'cartoon');
  assert.equal(scene.layout, 'takeover');
  assert.equal(editManifestSchema.safeParse(added.manifest).success, true);
  const demo = sceneDemoFields(scene);
  assert.ok(demo.length > 0, 'placeholder copy is flagged until the creator writes the real words');
  assert.ok(demo.every((field) => !/character|theme|kind|glyphs|icon|shape|\.id$|\.to$/.test(field)), `only copy is flagged: ${demo.join(', ')}`);
  assert.throws(() => assertNoSampleText(added.manifest), /sample text/, 'delivery refuses the template words');
  assert.equal(sceneDemoFields({family: 'cartoon-ending', data: cartoonEndingTemplate(words(24), {handle: '@example.creator'})}).includes('follow.handle'), false, 'the handle is a real value');
  for (const key of ['acts', 'sentences', 'cards', 'character', 'tail', 'entrance', 'fromTheme', 'comment', 'follow', 'skin', 'headwear', 'beard', 'glasses', 'outfit', 'crop', 'clip', 'glyphs', 'counter', 'accents']) assert.notEqual(fieldLabel(key), key, `${key} has an Arabic label`);
  assert.ok(fieldsForFamily('cartoon').length > 0);
  const t = cartoonTemplate(words(16), {fps: 30, sceneFrom: 0, durationInFrames: 260});
  assert.equal(t.acts.length, 2);
  assert.equal(t.sentences.at(-1).to, 15);
  assert.equal(addSceneFromTemplate(cartoonManifest([], 2), 'cartoon', {atFrame: 0, durationInFrames: 260}).ok, false, 'too few words for two acts is refused');
});

import '../scripts/lib/project-tmp.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ROOT} from '../scripts/lib/project-paths.mjs';
import {run} from '../scripts/lib/media.mjs';
import {planEditorBrief} from '../scripts/lib/editor-director.mjs';

test('planning a cartoon brief through the real route keeps the words for the anchors and places the cartoon sounds', async () => {
  const id = `cartoon-plan-${randomUUID()}`, relative = `Projects/${id}`, directory = path.resolve(ROOT, relative);
  assert.ok(directory.startsWith(path.resolve(ROOT, 'Projects') + path.sep));
  await fs.mkdir(directory, {recursive: true});
  try {
    const sourceFile = `${relative}/source.mp4`, transcript = `${relative}/words.json`, briefFile = `${relative}/brief.json`;
    await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=gray:s=64x96:r=30', '-frames:v', '260', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', path.resolve(ROOT, sourceFile)]);
    await fs.writeFile(path.resolve(ROOT, transcript), JSON.stringify(briefWords));
    await fs.writeFile(path.resolve(ROOT, briefFile), JSON.stringify(cartoonBrief(wholeBody(), {id, source: sourceFile, transcript, sound: 'auto'})));
    await planEditorBrief(briefFile);
    const manifest = JSON.parse(await fs.readFile(path.resolve(directory, 'edit.json'), 'utf8'));
    assert.equal(manifest.scenes[0].family, 'cartoon');
    assert.equal(manifest.captions.words.length, briefWords.length);
    assert.ok(manifest.sounds.some((sound) => sound.recipe === 'cartoon-flip'), `the act flip sounds: ${JSON.stringify(manifest.sounds)}`);
  } finally {
    await fs.rm(directory, {recursive: true, force: true});
  }
});
