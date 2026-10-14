import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {profileToBrief} from '../scripts/lib/branding.mjs';
import {BEAT_FAMILIES, autoSoundPlan, buildEditorPlan, isGlideFamily, recommendEditorStyle, startsOnGlide, validateEditorBrief} from '../scripts/lib/editor-director.mjs';
import {CUE_KINDS, GLIDE_CUE_FAMILIES, editCues, sceneCues} from '../scripts/lib/scene-cues.mjs';
import {editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {GRID_GLIDE_FAMILIES} from '../engine/src/styles/grid-glide/scenes/schema.ts';

const profile = JSON.parse(await readFile(new URL('../PROFILE.example.json', import.meta.url), 'utf8'));
const source = {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 600};

const KEEP = {enter: {kind: 'cut'}, exit: {kind: 'cut'}};
const screen = {at: 0, src: 'examples/glide-template-screen.png', sha256: 'b'.repeat(64), width: 640, height: 360, kind: 'image'};
const chapter = (extra = {}) => ({ordinal: 'Step one', heroAt: 4, pill: {label: 'Example tool'}, ...KEEP, ...extra});
const card = (extra = {}) => ({
  lines: [{words: ['What', 'it', 'does'], role: 'lead', at: 6}, {words: ['In', 'one', 'line'], role: 'hero', at: 34}],
  media: {clips: [screen]}, bullets: [{text: 'does the first thing', at: 80}], ...KEEP, ...extra,
});
const closing = (extra = {}) => ({
  lines: [{words: ['A', 'clear', 'closing'], role: 'lead', at: 6}, {words: ['Your', 'point'], role: 'hero', at: 34}], ...KEEP, ...extra,
});
const beats = () => [
  {id: 'chapter', fromSec: 0, toSec: 3, intent: 'glide-chapter', data: chapter()},
  {id: 'card', fromSec: 3, toSec: 9, intent: 'glide-card', data: card()},
  {id: 'closing', fromSec: 9, toSec: 14, intent: 'glide-lines', data: closing()},
];
const brief = (extra = {}, list = beats(), creator = profileToBrief(profile)) => ({
  version: 1, id: 'glide-director', source: source.path, transcript: 'Projects/glide-director/words.json',
  ...creator, purpose: 'explainer', tone: 'calm', style: 'grid-glide', beats: list, ...extra,
});
const withHandle = () => profileToBrief({...profile, handle: '@example_studio'});
const intro = (id, fromSec, toSec) => ({id, fromSec, toSec, intent: 'intro', layout: 'takeover',
  data: {kicker: 'Example', title: 'A clear idea', subtitle: 'Review the meaning', caption: 'Example'}});

const cueScene = (family, data) => ({id: 'g', family, fromFrame: 100, durationInFrames: 120, layout: 'takeover', motion: 'quiet', data});
const cuesOf = (scene, fps) => sceneCues(scene, fps).map(({frame, kind}) => [frame, kind]);

const stubRecipe = (id, duration) => ({id, name: id, use: 'test', duration, hits: [{t: 0, sound: 'click', gain: 1, pan: 0, opts: {}}]});
const palette = () => {
  const entries = Object.fromEntries(CUE_KINDS.map((kind) => [kind, {recipe: null, gain: 0, leadSec: 0, confidence: 'none', basis: 'authored', evidence: 'silent'}]));
  const sound = (kind, id, duration, gain, leadSec) => { entries[kind] = {recipe: stubRecipe(id, duration), gain, leadSec, confidence: 'medium', basis: 'inferred', evidence: 'test'}; };
  sound('transition', 'sub-thump', 1.25, 0.5, 0.27);
  sound('stamp', 'sub-swell-hit', 0.34, 0.5, 0.2);
  sound('click', 'ui-click', 0.2, 0.5, 0);
  return {style: 'grid-glide', dna: 'instructions/STYLES.md', entries};
};
const OPENING = {id: 'sub-boom', duration: 0.62};

test('the cue family list matches the schema list', () => {
  assert.deepEqual([...GLIDE_CUE_FAMILIES].sort(), [...GRID_GLIDE_FAMILIES].sort());
});

test('a chapter pill clicks five frames after it starts at 30 fps', () => {
  const data = {ordinal: 'One', heroAt: 10, pill: {label: 'Tool'}, ...KEEP};
  assert.deepEqual(cuesOf(cueScene('glide-chapter', data)), [[100, 'transition'], [130, 'click']], '10 + 14.75 + 5 = 29.75 rounds to 30 (no frame rate means 30 fps)');
  assert.deepEqual(cuesOf(cueScene('glide-chapter', {...data, pillAt: 12})), [[100, 'transition'], [117, 'click']]);
  assert.deepEqual(cuesOf(cueScene('glide-chapter', {...data, pillAt: 30.5})), [[100, 'transition'], [136, 'click']], '35.5 rounds up');
  const bare = {...data};
  delete bare.pill;
  assert.deepEqual(cuesOf(cueScene('glide-chapter', bare)), [[100, 'transition']], 'no pill, no click');
  assert.deepEqual(cuesOf(cueScene('glide-chapter', {...data, pillAt: 118})), [[100, 'transition']], 'a click past the end of the scene is dropped');
});

test('the default pill start and the click offset scale with the frame rate', async () => {
  const data = {ordinal: 'One', heroAt: 10, pill: {label: 'Tool'}, ...KEEP};
  // scene-cues.mjs has no imports and mirrors pillStart; pin the mirror to the renderer's math.
  const {pillStart} = await import('../engine/src/styles/grid-glide/scenes/math.ts');
  for (const fps of [24, 25, 30, 50, 60]) {
    const click = cuesOf(cueScene('glide-chapter', data), fps).find(([, kind]) => kind === 'click')[0];
    assert.equal(click, Math.round(100 + pillStart(10, undefined, fps) + (5 * fps) / 30), `${fps} fps mirrors pillStart`);
  }
  // Default pillAt = heroAt + 14.75 * fps / 30 and the click follows by 5 * fps / 30 frames; the cue frame is rounded once.
  // fps 24: 10 + 11.8 + 4 = 25.8; fps 25: 10 + 12.29 + 4.17 = 26.46; fps 50: 10 + 24.58 + 8.33 = 42.92; fps 60: 10 + 29.5 + 10 = 49.5.
  for (const [fps, click] of [[24, 126], [25, 126], [30, 130], [50, 143], [60, 150]]) {
    assert.deepEqual(cuesOf(cueScene('glide-chapter', data), fps), [[100, 'transition'], [click, 'click']], `${fps} fps`);
  }
  assert.deepEqual(cuesOf(cueScene('glide-chapter', {...data, pillAt: 12}), 60), [[100, 'transition'], [122, 'click']], 'an explicit pillAt is already in edit frames; only the 5 frame offset scales');
  for (const unusable of [undefined, null, 0, -5, Number.NaN, '60']) {
    assert.deepEqual(cuesOf(cueScene('glide-chapter', data), unusable), [[100, 'transition'], [130, 'click']], `${String(unusable)} means 30 fps`);
  }
  const second = {...cueScene('glide-chapter', data), id: 'h', fromFrame: 300};
  const scenes = [cueScene('glide-chapter', data), second];
  assert.deepEqual(editCues({source: {fps: 50}, scenes}).map(({frame, kind}) => [frame, kind]),
    [[100, 'transition'], [143, 'click'], [300, 'transition'], [343, 'click']], 'editCues reads the frame rate from the manifest, for every scene');
  assert.deepEqual(editCues({scenes}).map(({frame, kind}) => [frame, kind]),
    [[100, 'transition'], [130, 'click'], [300, 'transition'], [330, 'click']], 'a manifest without a frame rate is read at 30 fps');
});

test('a dip entrance stamps the boundary instead of adding a thump', () => {
  for (const family of GRID_GLIDE_FAMILIES) {
    assert.deepEqual(cuesOf(cueScene(family, {enter: {kind: 'dip'}, exit: {kind: 'cut'}})), [[100, 'stamp']], family);
    for (const enter of [{kind: 'cut'}, {kind: 'slide', from: 'left', distance: 400}]) {
      assert.deepEqual(cuesOf(cueScene(family, {enter, exit: {kind: 'cut'}})), [[100, 'transition']], family);
    }
  }
  assert.deepEqual(cuesOf(cueScene('intro', {enter: {kind: 'dip'}})), [[100, 'transition']], 'only Grid Glide scenes read an enter dip');
});

test('words, lines, boxes, bullets and media changes add no cues', () => {
  const data = {
    lines: [{words: ['One', 'two', 'three'], role: 'lead', at: 6}, {words: ['Big', 'idea'], role: 'hero', at: 30}],
    box: {text: 'Box line', at: 50}, media: {clips: [{at: 0}, {at: 60}]},
    bullets: [{text: 'first', at: 70}, {text: 'second', at: 90}], ...KEEP,
  };
  assert.deepEqual(cuesOf(cueScene('glide-card', data)), [[100, 'transition']]);
  assert.deepEqual(cuesOf(cueScene('glide-lines', {...data, grid: true})), [[100, 'transition']]);
});

test('glide beats are director intents with a takeover layout and strict data', () => {
  for (const family of GRID_GLIDE_FAMILIES) assert.equal(BEAT_FAMILIES[family], family);
  assert.ok(GRID_GLIDE_FAMILIES.every(isGlideFamily));
  assert.equal(isGlideFamily('intro'), false);
  const plan = buildEditorPlan(brief(), source, []);
  assert.deepEqual(plan.manifest.scenes.map((scene) => [scene.family, scene.layout]),
    [['glide-chapter', 'takeover'], ['glide-card', 'takeover'], ['glide-lines', 'takeover']]);
  assert.equal(plan.manifest.style, 'grid-glide');
  assert.equal(editManifestSchema.safeParse(plan.manifest).success, true);
  const unknown = beats();
  unknown[0].data.unexpected = true;
  assert.throws(() => validateEditorBrief(brief({}, unknown)), /unrecognized/i);
  const split = beats();
  split[0].layout = 'split';
  assert.throws(() => validateEditorBrief(brief({}, split)), /"layout"[\s\S]*expected \\?"takeover/);
});

test('a glide beat in another style is refused with both style names', () => {
  assert.throws(() => buildEditorPlan(brief({style: 'paper-collage'}), source, []), /glide-chapter.*grid-glide.*paper-collage/s);
});

test('the profile handle becomes the faint watermark of glide scenes that omit one', () => {
  const plan = buildEditorPlan(brief({}, beats(), withHandle()), source, []);
  assert.deepEqual(plan.manifest.scenes.map((scene) => scene.data.watermark), ['@example_studio', '@example_studio', '@example_studio']);
  assert.ok(plan.decision.notices.some((notice) => /watermark/i.test(notice)));
  const mixed = buildEditorPlan(brief({}, [intro('hello', 0, 3), {...beats()[0], fromSec: 3, toSec: 6}], withHandle()), source, []);
  assert.equal('watermark' in mixed.manifest.scenes[0].data, false, 'shared families never get a watermark');
  assert.equal(mixed.manifest.scenes[1].data.watermark, '@example_studio');
});

test('a scene watermark wins; false, a custom text and a missing handle are respected', () => {
  const own = beats();
  own[1].data.watermark = '@someone_else';
  const explicit = buildEditorPlan(brief({}, own, withHandle()), source, []);
  assert.deepEqual(explicit.manifest.scenes.map((scene) => scene.data.watermark), ['@example_studio', '@someone_else', '@example_studio']);
  const off = buildEditorPlan(brief({watermark: false}, beats(), withHandle()), source, []);
  assert.ok(off.manifest.scenes.every((scene) => scene.data.watermark === undefined));
  assert.equal(off.decision.notices.some((notice) => /watermark/i.test(notice)), false);
  const offOwn = buildEditorPlan(brief({watermark: false}, own, withHandle()), source, []);
  assert.deepEqual(offOwn.manifest.scenes.map((scene) => scene.data.watermark), [undefined, '@someone_else', undefined], 'false only stops the automatic text; a scene that sets its own keeps it');
  const custom = buildEditorPlan(brief({watermark: 'Studio name'}, beats(), profileToBrief(profile)), source, []);
  assert.ok(custom.manifest.scenes.every((scene) => scene.data.watermark === 'Studio name'));
  const customOwn = buildEditorPlan(brief({watermark: 'Studio name'}, own, withHandle()), source, []);
  assert.deepEqual(customOwn.manifest.scenes.map((scene) => scene.data.watermark), ['Studio name', '@someone_else', 'Studio name'], 'a custom text replaces the handle but never a scene watermark');
  const none = buildEditorPlan(brief({}, beats(), profileToBrief(profile)), source, []);
  assert.ok(none.manifest.scenes.every((scene) => scene.data.watermark === undefined), 'no handle in the profile, no watermark');
});

const followBeat = (data = {}) => ({id: 'more', fromSec: 14, toSec: 17, intent: 'glide-follow', data: {
  lines: [{words: ['Want', 'more'], role: 'lead', at: 6, cadence: 7}], handle: '@example_studio', heroAt: 24, pill: {label: 'Follow'}, ...KEEP, ...data}});

test('the automatic watermark skips the follow card, whose hero already is the complete handle', () => {
  const list = (data) => [...beats(), followBeat(data)];
  const marks = (plan) => plan.manifest.scenes.map((scene) => scene.data.watermark);
  const auto = buildEditorPlan(brief({}, list(), withHandle()), source, []);
  assert.deepEqual(marks(auto), ['@example_studio', '@example_studio', '@example_studio', undefined]);
  assert.equal('watermark' in auto.manifest.scenes[3].data, false, 'the follow scene gets no watermark key at all');
  assert.ok(auto.decision.notices.some((notice) => notice.includes('added to 3 Grid Glide scene(s)')), 'the notice counts only the scenes that were filled');
  const custom = buildEditorPlan(brief({watermark: 'custom text'}, list(), withHandle()), source, []);
  assert.deepEqual(marks(custom), ['custom text', 'custom text', 'custom text', undefined], 'a custom text is not applied to the follow card either');
  const own = buildEditorPlan(brief({}, list({watermark: '@written_by_hand'}), withHandle()), source, []);
  assert.deepEqual(marks(own), ['@example_studio', '@example_studio', '@example_studio', '@written_by_hand'], 'a follow scene that sets its own watermark keeps it');
  const off = buildEditorPlan(brief({watermark: false}, list(), withHandle()), source, []);
  assert.ok(marks(off).every((mark) => mark === undefined));
  assert.equal(off.decision.notices.some((notice) => /watermark/i.test(notice)), false);
});

test('a custom watermark text is trimmed before it is stored, and the notice names the stored text', () => {
  const padded = buildEditorPlan(brief({watermark: '  Studio name  '}, beats(), profileToBrief(profile)), source, []);
  assert.ok(padded.manifest.scenes.every((scene) => scene.data.watermark === 'Studio name'));
  assert.ok(padded.decision.notices.some((notice) => notice.includes('Watermark "Studio name" was added')), 'the notice shows the stored text');
  const tight = buildEditorPlan(brief({watermark: ' '.repeat(3) + 'x'.repeat(37)}, beats(), profileToBrief(profile)), source, []);
  assert.ok(tight.manifest.scenes.every((scene) => scene.data.watermark === 'x'.repeat(37)), 'a text that fits in 40 characters only after trimming is stored without the padding');
});

test('the brief accepts only false or a short text as watermark', () => {
  for (const bad of [true, '', '   ', 'x'.repeat(41), 7]) assert.throws(() => validateEditorBrief(brief({watermark: bad})), /watermark/, String(bad));
  assert.doesNotThrow(() => validateEditorBrief(brief({watermark: false})));
  assert.doesNotThrow(() => validateEditorBrief(brief({watermark: 'x'.repeat(40)})));
});

test('automatic sound opens with the boom and then follows the cues', () => {
  const {manifest} = buildEditorPlan(brief(), source, []);
  assert.equal(startsOnGlide(manifest), true);
  const plan = autoSoundPlan(manifest, palette(), {opening: OPENING});
  assert.deepEqual(plan.sounds, [
    {atFrame: 0, recipe: 'sub-boom', gain: 0.5},
    {atFrame: 24, recipe: 'ui-click', gain: 0.5},
    {atFrame: 82, recipe: 'sub-thump', gain: 0.5},
    {atFrame: 262, recipe: 'sub-thump', gain: 0.5},
  ]);
  assert.deepEqual(plan.opening, plan.sounds[0]);
  assert.equal(plan.decisions.find((decision) => decision.frame === 0).reason, 'before-start', 'the first cut cannot take a lead; the boom covers it');
  assert.deepEqual(autoSoundPlan(manifest, palette()).sounds.map((sound) => sound.recipe), ['ui-click', 'sub-thump', 'sub-thump'], 'no boom unless the caller supplies the recipe');
});

test('a null opening is the same as no opening', () => {
  const {manifest} = buildEditorPlan(brief(), source, []);
  const plain = autoSoundPlan(manifest, palette());
  assert.doesNotThrow(() => autoSoundPlan(manifest, palette(), {opening: null}));
  const withNull = autoSoundPlan(manifest, palette(), {opening: null});
  assert.equal(withNull.opening, null);
  assert.deepEqual(withNull.sounds, plain.sounds);
  assert.deepEqual(autoSoundPlan(manifest, palette(), {opening: undefined}).sounds, plain.sounds);
});

test('a dip boundary plays the swell and not the thump', () => {
  const list = beats();
  list[0].data.exit = {kind: 'dip'};
  list[1].data.enter = {kind: 'dip'};
  const {manifest} = buildEditorPlan(brief({}, list), source, []);
  const plan = autoSoundPlan(manifest, palette(), {opening: OPENING});
  assert.deepEqual(plan.sounds.map((sound) => [sound.atFrame, sound.recipe]),
    [[0, 'sub-boom'], [24, 'ui-click'], [84, 'sub-swell-hit'], [262, 'sub-thump']]);
});

test('the opening boom needs an opening glide scene, a sounding transition and room', () => {
  const {manifest} = buildEditorPlan(brief(), source, []);
  const later = beats();
  later[0].fromSec = 1;
  later[0].toSec = 4;
  later[1].fromSec = 4;
  const lateManifest = buildEditorPlan(brief({}, later), source, []).manifest;
  assert.equal(startsOnGlide(lateManifest), false, 'a glide scene that starts after frame 0 does not open the edit');
  const shared = buildEditorPlan(brief({}, [intro('hello', 0, 3), {...beats()[0], fromSec: 3, toSec: 6}]), source, []).manifest;
  assert.equal(startsOnGlide(shared), false);
  assert.equal(autoSoundPlan(shared, palette(), {opening: OPENING}).opening, null);
  const silent = palette();
  silent.entries.transition = {...silent.entries.transition, recipe: null, gain: 0, leadSec: 0, confidence: 'none', basis: 'authored'};
  assert.equal(autoSoundPlan(manifest, silent, {opening: OPENING}).opening, null, 'a silent transition kind keeps the whole style quiet');
  assert.equal(autoSoundPlan(manifest, palette(), {opening: {id: 'sub-boom', duration: 99}}).opening, null, 'a recipe longer than the edit is skipped');
});

test('a brief written in Grid Glide beats chooses the style by itself', () => {
  const free = brief();
  delete free.style;
  assert.equal(recommendEditorStyle(free).style, 'grid-glide');
});

test('the editing guide documents the watermark field and every glide beat intent', async () => {
  const guide = await readFile(new URL('../instructions/EDITING.md', import.meta.url), 'utf8');
  assert.match(guide, /`watermark`/);
  assert.match(guide, /1 to 40 characters/, 'the guide states the same length limit as the brief check');
  for (const family of GRID_GLIDE_FAMILIES) assert.ok(guide.includes(`\`${family}\``), `${family} must appear in instructions/EDITING.md`);
});
