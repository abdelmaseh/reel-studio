import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {mixHits} from '../scripts/sfx.mjs';
import {STYLE_IDS} from '../engine/src/styles/registry.ts';
import {SWEEP_RECIPES, loadStylePalettes, resolvePalette, validatePalettes} from '../scripts/lib/sfx-events.mjs';
import {DEFAULT_SOUND_MODE, EDITOR_SOUND_MODES, editorRenderCommand, placeBriefSounds, validateEditorBrief} from '../scripts/lib/editor-director.mjs';
import {MIX_UNDER_DEFAULT_DB, normalizeMixOptions} from '../scripts/lib/mix-contract.mjs';
import {normalizeGraphicsSpec} from '../scripts/lib/graphics-project.mjs';
import {profileToBrief} from '../scripts/lib/branding.mjs';
import {defaultPreferences} from '../engine/src/core/preference-options.ts';

const read = async (relative) => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
const catalog = JSON.parse(await read('Sound-Kits/catalog.json'));
const recipe = (id) => catalog.recipes.find((item) => item.id === id) ?? assert.fail(`${id} is not in the catalog`);
const digest = (mix) => createHash('sha256').update(Buffer.from(mix.L.buffer)).update(Buffer.from(mix.R.buffer)).digest('hex');
const SWEEP_VOICES = ['whoosh', 'whooshSoft', 'whooshShort', 'swipe'];
const LANDINGS = ['soft-transition', 'directional-whoosh', 'chapter-shift', 'highlight-swipe'];
// sha256 of mixHits (L then R) of the four recipes as they rendered before 2026-10-18, when they were sweeps.
const LEGACY = {
  'soft-transition-sweep': '45db2abb733fc995211ca794dd22f97ffb0930d6f5ac80e4ebf6672049af60c3',
  'directional-whoosh-sweep': '37c4474cfc31fb4e07290aaf204f1a4a73fb579cbfc94bc08351f815d64b0195',
  'chapter-shift-sweep': '29a1e20fcc28beb3cb82730ee896e386abbccf93e134b27dfa02b6db99748fe2',
  'highlight-swipe-sweep': 'c329273fc3d36a0ed4172d26a968cbeac88f3f191602a2204b2fde401fdc6794',
};

test('the four transition recipes are soft landings or a small pop that start on the cue frame, never a sweep voice', () => {
  for (const id of LANDINGS) {
    const {hits} = recipe(id);
    assert.ok(hits.length >= 1, id);
    for (const hit of hits) assert.ok(['impact', 'pop'].includes(hit.sound), `${id} uses ${hit.sound}`);
    assert.equal(hits[0].t, 0, `${id} lands on its first frame`);
  }
});

test('the -sweep twins keep the earlier sweeps byte for byte, for an explicit request only', () => {
  assert.deepEqual(Object.keys(LEGACY), LANDINGS.map((id) => `${id}-sweep`));
  for (const [id, expected] of Object.entries(LEGACY)) {
    const twin = recipe(id);
    assert.equal(digest(mixHits(twin.hits, twin.duration)), expected, id);
    assert.match(twin.use, /explicit/, `${id} says it is for an explicit request`);
  }
  assert.deepEqual(catalog.sounds.map((sound) => sound.id).filter((id) => SWEEP_VOICES.includes(id)).sort(), [...SWEEP_VOICES].sort(), 'the sweep voices stay for old hits files');
  assert.equal(catalog.sounds.length, 20);
  assert.equal(catalog.recipes.length, 25);
});

test('no style palette names a sweep: landings and pops only, twins never, landings with no lead', async () => {
  const palettes = await loadStylePalettes();
  assert.doesNotThrow(() => validatePalettes(palettes, catalog));
  assert.deepEqual(Object.keys(SWEEP_RECIPES), LANDINGS);
  const twins = new Set(Object.values(SWEEP_RECIPES));
  for (const id of STYLE_IDS) for (const [kind, entry] of Object.entries(palettes.styles[id].kinds)) {
    if (entry.recipe === null) continue;
    assert.ok(!twins.has(entry.recipe), `${id}.${kind} names ${entry.recipe}`);
    for (const hit of recipe(entry.recipe).hits) assert.ok(!SWEEP_VOICES.includes(hit.sound), `${id}.${kind} -> ${entry.recipe} uses ${hit.sound}`);
    if (LANDINGS.includes(entry.recipe)) assert.equal(entry.leadSec, 0, `${id}.${kind} lands on its cue frame`);
  }
  const first = palettes.styles[STYLE_IDS[0]];
  const sweepy = {...palettes, styles: {...palettes.styles, [STYLE_IDS[0]]: {...first, kinds: {...first.kinds, transition: {...first.kinds.transition, recipe: 'soft-transition-sweep', gain: 0.4, leadSec: 0}}}}};
  assert.throws(() => validatePalettes(sweepy, catalog), /sweep/);
});

test('sweeps on request swap exactly the landing entries for their twins', async () => {
  const palettes = await loadStylePalettes();
  for (const id of STYLE_IDS) {
    const plain = resolvePalette(palettes, catalog, id), swept = resolvePalette(palettes, catalog, id, {sweeps: true});
    assert.equal(plain.sweeps, false, id);
    assert.equal(swept.sweeps, true, id);
    for (const kind of Object.keys(plain.entries)) {
      const before = plain.entries[kind].recipe?.id ?? null, after = swept.entries[kind].recipe?.id ?? null;
      assert.equal(after, before === null ? null : SWEEP_RECIPES[before] ?? before, `${id}.${kind}`);
    }
  }
  assert.throws(() => resolvePalette(palettes, catalog, STYLE_IDS[0], {sweeps: 'yes'}), /sweeps/);
});

const sceneAt = (id, family, fromFrame, data = {}) => ({id, family, layout: 'takeover', motion: 'land', fromFrame, durationInFrames: 90, data});
// A minimal plan as buildEditorPlan leaves it: two scenes, no sounds yet, one beat decision per scene.
const freshPlan = (style = 'kinetic-paper') => {
  const scenes = [sceneAt('a', 'intro', 0, {kicker: 'K', title: 'T', subtitle: 'S', caption: 'C'}), sceneAt('b', 'statement', 90, {kicker: 'K', title: 'T'})];
  return {manifest: {version: 1, id: 'policy', purpose: 'test', style, source: {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 300},
    segments: [{fromFrame: 0, toFrame: 300}], captions: {status: 'draft', words: []}, scenes, sounds: [], camera: []},
    decision: {beatDecisions: scenes.map((scene) => ({id: scene.id, family: scene.family, fromFrame: scene.fromFrame, durationInFrames: scene.durationInFrames}))}};
};
// A complete brief the way the baseline capture builds one: the example profile plus one intro beat.
const exampleBrief = async () => {
  const profile = JSON.parse(await read('PROFILE.example.json'));
  return {version: 1, id: 'policy-brief', source: 'Raw/example.mp4', transcript: 'Projects/policy-brief/words.json',
    ...profileToBrief({...profile, schemaVersion: 3, preferences: defaultPreferences()}), purpose: 'explainer', tone: 'calm',
    beats: [{id: 'example', fromSec: 0, toSec: 3, intent: 'intro', data: {kicker: 'Example', title: 'A clear idea', subtitle: 'Review the meaning', caption: 'Example'}}]};
};

test('sound modes: auto is the default, none places nothing, recipes stays explicit', async () => {
  assert.deepEqual([...EDITOR_SOUND_MODES], ['auto', 'recipes', 'none']);
  assert.equal(DEFAULT_SOUND_MODE, 'auto');
  const calls = [];
  const loadPalette = async (style, options) => { calls.push([style, options]); return resolvePalette(await loadStylePalettes(), catalog, style, options); };
  const auto = freshPlan();
  await placeBriefSounds(auto, {}, {totalFrames: 300, loadPalette});
  assert.equal(auto.decision.sound.mode, 'auto');
  assert.equal(auto.decision.sound.sweeps, false);
  assert.deepEqual(calls, [['kinetic-paper', {sweeps: false}]]);
  assert.ok(auto.manifest.sounds.length >= 1, 'the palette placed the scene-start landings');
  assert.ok(auto.manifest.sounds.every((sound) => sound.recipe === 'soft-transition'), JSON.stringify(auto.manifest.sounds));
  const none = freshPlan();
  await placeBriefSounds(none, {sound: 'none'}, {totalFrames: 300, loadPalette});
  assert.deepEqual(none.manifest.sounds, []);
  assert.deepEqual(none.decision.sound, {mode: 'none', placed: 0});
  assert.ok(none.decision.beatDecisions.every((beat) => /none/.test(beat.soundOmitted)));
  const loaded = [];
  const recipes = freshPlan();
  await placeBriefSounds(recipes, {sound: 'recipes', tone: 'calm'}, {totalFrames: 300, loadPalette, loadRecipe: async (id) => { loaded.push(id); return recipe(id); }});
  assert.deepEqual(loaded, ['soft-transition', 'soft-transition']);
  assert.deepEqual(recipes.manifest.sounds.map((sound) => [sound.atFrame, sound.recipe, sound.gain]), [[0, 'soft-transition', 0.4], [90, 'soft-transition', 0.4]]);
  assert.equal(recipes.decision.sound.mode, 'recipes');
});

test('"sweeps": true swaps the landings for their twins in both placing modes and is recorded', async () => {
  const loaded = [];
  const auto = freshPlan();
  await placeBriefSounds(auto, {sweeps: true}, {totalFrames: 300, loadPalette: async (style, options) => resolvePalette(await loadStylePalettes(), catalog, style, options)});
  assert.ok(auto.manifest.sounds.length >= 1);
  assert.ok(auto.manifest.sounds.every((sound) => sound.recipe === 'soft-transition-sweep'), JSON.stringify(auto.manifest.sounds));
  assert.equal(auto.decision.sound.sweeps, true);
  const recipes = freshPlan();
  await placeBriefSounds(recipes, {sound: 'recipes', sweeps: true, tone: 'energetic'}, {totalFrames: 300, loadRecipe: async (id) => { loaded.push(id); return recipe(id); }});
  assert.deepEqual(loaded, ['soft-transition-sweep', 'soft-transition-sweep']);
  assert.equal(recipes.manifest.sounds[0].gain, 0.6);
  assert.equal(recipes.decision.sound.sweeps, true);
});

test('the brief validates the sound mode and the sweeps switch', async () => {
  const brief = await exampleBrief();
  assert.doesNotThrow(() => validateEditorBrief(brief));
  assert.doesNotThrow(() => validateEditorBrief({...brief, sound: 'none'}));
  assert.doesNotThrow(() => validateEditorBrief({...brief, sweeps: true}));
  assert.throws(() => validateEditorBrief({...brief, sound: 'off'}), /sound must be one of auto, recipes, none/);
  assert.throws(() => validateEditorBrief({...brief, sweeps: 'yes'}), /sweeps/);
});

test('a graphics specification accepts "sounds": "none" and "sweeps" only beside "sounds": "auto"', async () => {
  const spec = JSON.parse(await read('instructions/examples/one-shot-demo.json'));
  assert.deepEqual(normalizeGraphicsSpec({...spec, sounds: 'none'}).sounds, []);
  assert.deepEqual(normalizeGraphicsSpec({...spec, sounds: 'auto', sweeps: true}).sounds, [], 'planning happens in the creation command, not in normalization');
  assert.throws(() => normalizeGraphicsSpec({...spec, sounds: 'off'}), /sounds must be "auto", "none" or a list/);
  assert.throws(() => normalizeGraphicsSpec({...spec, sounds: 'none', sweeps: true}), /sweeps/);
  assert.throws(() => normalizeGraphicsSpec({...spec, sweeps: 'yes'}), /sweeps/);
});

test('effects sit 7 dB under the voice peak by default, and the editor render can set the distance', () => {
  assert.equal(MIX_UNDER_DEFAULT_DB, 7);
  assert.equal(normalizeMixOptions({video: 'state/tmp/policy-in.mp4', out: 'state/tmp/policy-out.mp4'}).under, 7);
  const manifest = {version: 1, id: 'policy-render', purpose: 'test', style: 'section-deck', source: {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 360},
    segments: [{fromFrame: 0, toFrame: 360}], captions: {status: 'reviewed', reviewer: 'Creator', words: []}, scenes: [], sounds: [], camera: [], presenter: false};
  const prepared = {propsFile: 'Projects/policy-render/prepared/props.json', sfxFile: 'Projects/policy-render/prepared/sounds.wav'};
  const command = editorRenderCommand(manifest, prepared, {sfxUnder: 9});
  assert.equal(command.args[command.args.indexOf('--sfx-under') + 1], '9');
  assert.ok(!editorRenderCommand(manifest, prepared, {}).args.includes('--sfx-under'), 'no flag means the mix default');
  for (const bad of [-1, 41, Number.NaN, '9']) assert.throws(() => editorRenderCommand(manifest, prepared, {sfxUnder: bad}), /sfxUnder/, String(bad));
});

test('the sound guide exists and the manager, every style guide and the kits README point to it', async () => {
  const guide = await read('instructions/SOUND.md');
  assert.match(guide, /^# Sound effects/m);
  for (const needle of ['"sound": "auto"', '"sound": "none"', '"sweeps": true', '--sfx-under', '0.4 s', 'sign-off', 'CC0']) assert.ok(guide.includes(needle), needle);
  assert.match(await read('instructions/PRODUCTION-MANAGER.md'), /\| sound \|[^\n]*`SOUND\.md`/);
  for (const id of STYLE_IDS) assert.match(await read(`instructions/styles/${id}.md`), /\[SOUND\.md\]\(\.\.\/SOUND\.md\)/, id);
  assert.match(await read('Sound-Kits/README.md'), /SOUND\.md/);
  assert.match(await read('instructions/EDITING.md'), /"sound": "none"/);
  assert.match(await read('instructions/GRAPHICS.md'), /"sounds": "none"/);
  assert.match(await read('instructions/STYLE-AUTHORING.md'), /-sweep/);
});

test('the kits README cue table names every scene family the cue planner handles and the kinetic-text rule', async () => {
  const source = await read('scripts/lib/scene-cues.mjs');
  const families = [...new Set([...source.matchAll(/case '([a-z-]+)':/g)].map((match) => match[1]))];
  assert.ok(families.length >= 20, `${families.length} families`);
  const table = (await read('Sound-Kits/README.md')).split('| Scene | Cue |')[1];
  assert.ok(table, 'the cue table exists');
  for (const family of families) assert.ok(table.includes(`\`${family}\``), `${family} is in the cue table`);
  assert.match(table, /`kinetic-text`[^\n]*loses/);
});
