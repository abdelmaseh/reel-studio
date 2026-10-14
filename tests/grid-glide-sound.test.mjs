import '../scripts/lib/project-tmp.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {PROJECT_TMP} from '../scripts/lib/project-tmp.mjs';
import {ROOT} from '../scripts/lib/project-paths.mjs';
import {run} from '../scripts/lib/media.mjs';
import {SAMPLE_RATE, SOUND_IDS, mixHits, renderSound, toStereo} from '../scripts/sfx.mjs';
import {GLIDE_CLICK, GLIDE_LAYERS, GLIDE_VOICES} from '../scripts/lib/sfx-glide-tables.mjs';
import {SOUND_NAMES, soundRecipe, validateHits} from '../scripts/lib/job-sound.mjs';
import {expandSoundEvents, loadStylePalette, loadStylePalettes, planSfxEvents, validatePalettes} from '../scripts/lib/sfx-events.mjs';
import {editCues} from '../scripts/lib/scene-cues.mjs';
import {autoSoundPlan, buildEditorPlan, openingRecipe, planEditorBrief} from '../scripts/lib/editor-director.mjs';
import {profileToBrief} from '../scripts/lib/branding.mjs';

const exec = promisify(execFile);
const catalog = JSON.parse(await fs.readFile(new URL('../Sound-Kits/catalog.json', import.meta.url), 'utf8'));
const profile = JSON.parse(await fs.readFile(new URL('../PROFILE.example.json', import.meta.url), 'utf8'));
const NEW_VOICES = ['subBoom', 'subThump', 'subThud', 'subSwellHit', 'uiClick'];

// Peaks, positions and counts measured on the reference implementation of these tables.
const FACTS = {
  subBoom: {samples: 29760, stereo: false, peak: 0.8384, peakAt: 4798, firstAbove: 994},
  subThump: {samples: 60000, stereo: true, peak: 0.3464, peakAt: 21477, firstAbove: 1},
  subThud: {samples: 36000, stereo: true, peak: 0.1068, peakAt: 6976, firstAbove: 6},
  subSwellHit: {samples: 16320, stereo: true, peak: 0.3048, peakAt: 9896, firstAbove: 1},
  uiClick: {samples: 2880, stereo: false, peak: 0.5244, peakAt: 1409, firstAbove: 1388},
};
const GOLDEN = {
  subBoom: [[1000, 0.0190225, 0.0190225], [5000, -0.1442948, -0.1442948], [12000, 0.2179914, 0.2179914], [20000, -0.0896882, -0.0896882]],
  subThump: [[1000, -0.0172116, -0.029022], [5000, 0.0361809, 0.009874], [12000, -0.053274, -0.0856068], [25000, 0.123803, 0.2218694]],
  subThud: [[1000, -0.0042937, 0.0008775], [5000, -0.0244029, -0.0228369], [12000, 0.0397182, 0.0030729], [20000, 0.0192602, 0.022803]],
  subSwellHit: [[1000, -0.0059751, -0.0117374], [5000, -0.0292106, -0.0280928], [12000, 0.0765415, 0.2187934]],
  uiClick: [[1388, -0.2225122, -0.2225122], [1409, 0.5243953, 0.5243953], [1500, -0.1437634, -0.1437634]],
};
const REGRESSION = {
  'paper-reveal': '6838deeccac3a3695ec3c876e29201e85eb02901b67b1f903b28e282d30b5cd7',
  'chapter-shift': '29a1e20fcc28beb3cb82730ee896e386abbccf93e134b27dfa02b6db99748fe2',
  'typing-burst': 'c221769422cf503a6d3219bbbb15c262bb2118642f0436817a3e3b4beabd671a',
};

const peakOf = (voice) => {
  const {left, right} = toStereo(voice);
  let peak = 0, at = 0;
  for (let i = 0; i < left.length; i++) {
    const level = Math.max(Math.abs(left[i]), Math.abs(right[i]));
    if (level > peak) { peak = level; at = i; }
  }
  return {peak, at};
};
const firstAbove = (voice, level = 1e-4) => {
  const {left, right} = toStereo(voice);
  return left.findIndex((value, i) => Math.abs(value) + Math.abs(right[i]) > level);
};
const lastAbove = (voice, level = 1e-4) => {
  const {left, right} = toStereo(voice);
  for (let i = left.length - 1; i >= 0; i--) if (Math.abs(left[i]) + Math.abs(right[i]) > level) return i;
  return -1;
};
const digest = (mix) => createHash('sha256').update(Buffer.from(mix.L.buffer)).update(Buffer.from(mix.R.buffer)).digest('hex');
const sameBytes = (a, b) => Buffer.from(a.buffer).equals(Buffer.from(b.buffer));

test('the five voices are registered with the specified lengths at 48 kHz', () => {
  assert.equal(SAMPLE_RATE, 48000);
  for (const name of NEW_VOICES) {
    assert.ok(SOUND_IDS.includes(name), name);
    assert.ok(SOUND_NAMES.includes(name), `${name} must be a valid hit sound`);
    const voice = renderSound(name);
    const facts = FACTS[name];
    assert.equal(ArrayBuffer.isView(voice), !facts.stereo, `${name} mono or stereo`);
    const {left, right} = toStereo(voice);
    assert.equal(left.length, facts.samples, name);
    assert.equal(right.length, facts.samples, name);
  }
  assert.deepEqual(NEW_VOICES.map((name) => toStereo(renderSound(name)).left.length / SAMPLE_RATE), [0.62, 1.25, 0.75, 0.34, 0.06]);
});

test('every voice stays below full scale and keeps its measured peak', () => {
  for (const name of NEW_VOICES) {
    const {peak} = peakOf(renderSound(name));
    assert.ok(peak < 0.98, `${name} peak ${peak}`);
    assert.ok(Math.abs(peak - FACTS[name].peak) < 0.001, `${name} peak ${peak} vs ${FACTS[name].peak}`);
  }
});

test('onsets and peaks sit where the reference frames say', () => {
  const sec = (index) => index / SAMPLE_RATE;
  const boom = renderSound('subBoom');
  assert.ok(Math.abs(firstAbove(boom) - FACTS.subBoom.firstAbove) <= 2, 'the boom keeps its 20.8 ms silent lead');
  assert.ok(sec(peakOf(boom).at) > 0.095 && sec(peakOf(boom).at) < 0.105, 'the boom peaks at about 0.10 s');
  const thump = peakOf(renderSound('subThump'));
  assert.ok(Math.abs(thump.at - FACTS.subThump.peakAt) <= 2);
  assert.ok(sec(thump.at) - 0.27 > 0.08 && sec(thump.at) - 0.27 < 0.23, 'the thump body lands 0.08 to 0.23 s after its reference frame (0.27 s into the file)');
  assert.ok(Math.abs(peakOf(renderSound('subThud')).at - FACTS.subThud.peakAt) <= 2);
  const swell = renderSound('subSwellHit');
  assert.ok(sec(peakOf(swell).at) > 0.15 && sec(peakOf(swell).at) < 0.25, 'the swell peaks 0.15 to 0.25 s in');
  assert.ok(sec(lastAbove(swell)) > 0.305 && sec(lastAbove(swell)) < 0.311, 'the swell stops dead at 0.31 s');
  const click = renderSound('uiClick');
  assert.ok(sec(firstAbove(click)) > 0.0285 && sec(firstAbove(click)) < 0.0295, 'the ring starts 28.9 ms into the file');
  assert.ok(Math.abs(peakOf(click).at - FACTS.uiClick.peakAt) <= 2);
});

test('samples match the reference tables', () => {
  for (const name of NEW_VOICES) {
    const {left, right} = toStereo(renderSound(name));
    for (const [index, l, r] of GOLDEN[name]) {
      assert.ok(Math.abs(left[index] - l) < 1e-6, `${name}[${index}] left ${left[index]} vs ${l}`);
      assert.ok(Math.abs(right[index] - r) < 1e-6, `${name}[${index}] right ${right[index]} vs ${r}`);
    }
  }
  const {left, right} = toStereo(renderSound('subThump'));
  let both = 0, l2 = 0, r2 = 0;
  for (let i = 0; i < left.length; i++) { both += left[i] * right[i]; l2 += left[i] * left[i]; r2 += right[i] * right[i]; }
  const correlation = both / Math.sqrt(l2 * r2);
  assert.ok(correlation > 0.7 && correlation < 0.8, `the thump channels differ (correlation ${correlation})`);
});

test('the parameter tables are the shipped ones', () => {
  const digest = createHash('sha256').update(JSON.stringify({layers: GLIDE_LAYERS, click: GLIDE_CLICK, voices: GLIDE_VOICES})).digest('hex');
  assert.equal(digest, 'c013175f2aa6f6a8255f934a1fb604664b10d6701977fc96ee42ae18ddae6821');
  assert.deepEqual(Object.keys(GLIDE_LAYERS), ['thumpM', 'thumpS', 'thudM', 'thudS', 'swellM', 'swellS', 'boomM']);
  assert.equal(GLIDE_CLICK.rings.length, 4);
});

test('mixHits handles stereo voices per channel and keeps the pan rule for mono voices', () => {
  const thump = mixHits([{t: 0, sound: 'subThump', gain: 1, pan: 0, opts: {}}], 1.25);
  assert.equal(thump.L.length, 60000);
  assert.equal(sameBytes(thump.L, thump.R), false, 'a stereo voice keeps its two channels');
  assert.ok(Math.abs(thump.peak - FACTS.subThump.peak) < 0.001);
  const right = mixHits([{t: 0, sound: 'subThump', gain: 1, pan: 1, opts: {}}], 1.25);
  assert.equal(Math.max(...right.L.map(Math.abs)), 0, 'pan acts as a balance on a stereo voice');
  assert.ok(Math.max(...right.R.map(Math.abs)) > 0.2);
  const boom = mixHits([{t: 0, sound: 'subBoom', gain: 1, pan: 0, opts: {}}], 0.62);
  assert.equal(sameBytes(boom.L, boom.R), true, 'a mono voice sounds the same on both channels');
  const click = mixHits([{t: 0, sound: 'click', gain: 1, pan: 0.5, opts: {}}], 0.1);
  const peak = (samples) => Math.max(...samples.map(Math.abs));
  assert.ok(Math.abs(peak(click.L) / peak(click.R) - 0.5) < 1e-6, 'the mono pan law is unchanged');
  const first = mixHits([{t: 0.1, sound: 'subThud', gain: 0.5, pan: 0, opts: {}}, {t: 0.2, sound: 'uiClick', gain: 0.5, pan: 0, opts: {}}], 1);
  const second = mixHits([{t: 0.1, sound: 'subThud', gain: 0.5, pan: 0, opts: {}}, {t: 0.2, sound: 'uiClick', gain: 0.5, pan: 0, opts: {}}], 1);
  assert.equal(sameBytes(first.L, second.L) && sameBytes(first.R, second.R), true, 'two renders are identical');
});

test('the existing recipes render exactly as before', () => {
  for (const [id, expected] of Object.entries(REGRESSION)) {
    const recipe = catalog.recipes.find((item) => item.id === id);
    assert.equal(digest(mixHits(recipe.hits, recipe.duration)), expected, id);
  }
});

test('the synthesizer command is deterministic and writes the new voices as stereo files', async (t) => {
  const dir = await fs.mkdtemp(path.join(PROJECT_TMP, 'glide-sound-'));
  t.after(() => fs.rm(dir, {recursive: true, force: true}));
  const hits = path.join(dir, 'hits.json');
  await fs.writeFile(hits, JSON.stringify([
    {t: 0, sound: 'subBoom', gain: 0.5, pan: 0, opts: {}}, {t: 0.3, sound: 'subThump', gain: 1, pan: 0, opts: {}}, {t: 1.2, sound: 'uiClick', gain: 0.5, pan: 0, opts: {}},
  ]));
  const wavs = [path.join(dir, 'a.wav'), path.join(dir, 'b.wav')];
  for (const out of wavs) await exec(process.execPath, [path.join(ROOT, 'scripts/sfx.mjs'), '--hits', hits, '--dur', '1.5', '--out', out], {cwd: ROOT});
  const [a, b] = await Promise.all(wavs.map((file) => fs.readFile(file)));
  assert.equal(a.length, 44 + 72000 * 4);
  assert.equal(a.toString('ascii', 0, 4), 'RIFF');
  assert.equal(a.readUInt32LE(24), 48000);
  assert.ok(a.equals(b), 'two runs give the same bytes');
  assert.ok(a.subarray(44).some((byte) => byte !== 0));
  const kit = path.join(dir, 'kit');
  await exec(process.execPath, [path.join(ROOT, 'scripts/sfx.mjs'), '--kit', kit], {cwd: ROOT});
  const files = await fs.readdir(kit);
  for (const name of NEW_VOICES) assert.ok(files.includes(`${name}.wav`), name);
  const thump = await fs.readFile(path.join(kit, 'subThump.wav'));
  assert.equal(thump.length, 44 + 60000 * 4);
  let different = false;
  for (let i = 44; i < thump.length; i += 4) if (thump.readInt16LE(i) !== thump.readInt16LE(i + 2)) { different = true; break; }
  assert.ok(different, 'the kit file keeps the thump channels apart');
});

test('the new voices take no options', () => {
  for (const name of NEW_VOICES) {
    assert.doesNotThrow(() => validateHits([{t: 0, sound: name, gain: 1, pan: 0, opts: {}}], 2), name);
    assert.throws(() => validateHits([{t: 0, sound: name, opts: {seed: 1}}], 2), /Unknown sound option field: seed/, name);
  }
});

test('the catalog carries the five recipes with their durations and valid hits', async () => {
  const lengths = {'sub-boom': 0.62, 'sub-thump': 1.25, 'sub-thud': 0.75, 'sub-swell-hit': 0.34, 'ui-click': 0.2};
  for (const [id, duration] of Object.entries(lengths)) {
    const recipe = await soundRecipe(id);
    assert.equal(recipe.duration, duration, id);
    assert.equal(recipe.hits.length, 1, id);
    assert.ok(NEW_VOICES.includes(recipe.hits[0].sound), id);
    assert.equal(recipe.hits[0].t, 0, id);
    assert.equal(mixHits(recipe.hits, recipe.duration).L.length, Math.round(duration * SAMPLE_RATE), id);
    const voice = toStereo(renderSound(recipe.hits[0].sound)).left.length / SAMPLE_RATE;
    assert.ok(recipe.hits[0].t + voice <= duration + 1e-9, `${id} must hold its whole voice`);
  }
  assert.equal((await soundRecipe('sub-boom')).hits[0].gain, 0.5);
  assert.deepEqual(catalog.sounds.map((sound) => sound.id).filter((id) => NEW_VOICES.includes(id)), NEW_VOICES);
  assert.equal(catalog.sounds.length, 18);
  assert.equal(catalog.recipes.length, 16);
});

test('the Grid Glide palette validates and maps the contract kinds', async () => {
  const palettes = await loadStylePalettes();
  assert.doesNotThrow(() => validatePalettes(palettes, catalog));
  const kinds = palettes.styles['grid-glide'].kinds;
  assert.deepEqual(Object.fromEntries(Object.entries(kinds).map(([kind, entry]) => [kind, [entry.recipe, entry.gain, entry.leadSec]])), {
    transition: ['sub-thump', 0.5, 0.27], stamp: ['sub-swell-hit', 0.5, 0.2], swap: ['sub-thud', 0.5, 0.13], click: ['ui-click', 0.5, 0],
    count: [null, 0, 0], reveal: [null, 0, 0], type: [null, 0, 0],
  });
});

test('the swap cue leads the thud so its peak lands within one frame of the cue', async () => {
  const palette = (await loadStylePalettes()).styles['grid-glide'].kinds.swap;
  const peakSec = peakOf(renderSound('subThud')).at / SAMPLE_RATE;
  assert.ok(Math.abs(peakSec - palette.leadSec) <= 1 / 30, `the thud peak at ${peakSec} s lands ${peakSec - palette.leadSec} s after the cue`);
});

const glideScene = (id, family, fromFrame, durationInFrames, data) => ({id, family, fromFrame, durationInFrames, layout: 'takeover', motion: 'quiet', data});
const KEEP = {enter: {kind: 'cut'}, exit: {kind: 'cut'}};
const lines = {lines: [{words: ['One', 'two', 'three'], role: 'lead', at: 6}, {words: ['Big', 'idea'], role: 'hero', at: 30}], box: {text: 'Box line', at: 50}};

test('a glide edit puts thumps on cuts, clicks on pills, swells on dips and nothing else', async () => {
  const palette = await loadStylePalette('grid-glide');
  const manifest = {source: {fps: 30}, scenes: [
    glideScene('opening', 'glide-lines', 0, 90, {...lines, ...KEEP}),
    glideScene('chapter', 'glide-chapter', 90, 90, {ordinal: 'One', heroAt: 4, pill: {label: 'Tool'}, enter: {kind: 'slide', from: 'right', distance: 400}, exit: {kind: 'dip'}}),
    glideScene('card', 'glide-card', 180, 150, {...lines, bullets: [{text: 'first', at: 70}, {text: 'second', at: 90}], media: {clips: [{at: 0}, {at: 60}]}, enter: {kind: 'dip'}, exit: {kind: 'cut'}}),
    glideScene('closing', 'glide-lines', 330, 120, {...lines, grid: true, ...KEEP}),
  ]};
  const plan = planSfxEvents(editCues(manifest), palette, {fps: 30, durationInFrames: 600});
  assert.deepEqual(plan.events.map((event) => [event.atFrame, event.recipe]),
    [[82, 'sub-thump'], [114, 'ui-click'], [174, 'sub-swell-hit'], [322, 'sub-thump']]);
  assert.deepEqual([...new Set(plan.decisions.map((decision) => decision.kind))].sort(), ['click', 'stamp', 'transition']);
  assert.equal(plan.decisions.find((decision) => decision.frame === 0).reason, 'before-start');
});

test('the click ring lands four to seven frames after the pill starts, at every frame rate', async () => {
  const palette = await loadStylePalette('grid-glide');
  const ring = firstAbove(renderSound('uiClick')) / SAMPLE_RATE;
  // The cue puts the click 5 * fps / 30 frames after the pill, so the gap is a sixth of a second at any frame rate. The window is
  // measured in frames at 30 fps (133 to 233 ms); the default pill start is heroAt + 14.75 * fps / 30 edit frames.
  for (const fps of [24, 30, 50, 60]) {
    for (const [from, heroAt, pillAt] of [[90, 0], [90, 4], [120, 10.5], [60, 33], [90, 4, 30.25], [90, 4, 30.5]]) {
      const data = {ordinal: 'One', heroAt, pill: {label: 'Tool'}, ...(pillAt === undefined ? {} : {pillAt}), ...KEEP};
      const manifest = {source: {fps}, scenes: [glideScene('chapter', 'glide-chapter', from, 90, data)]};
      const cues = editCues(manifest).filter((cue) => cue.kind === 'click');
      const {events} = planSfxEvents(cues, palette, {fps, durationInFrames: 20 * fps});
      const [hit] = expandSoundEvents(events, palette, fps);
      const pillStart = from + (pillAt ?? heroAt + (14.75 * fps) / 30);
      const frames30 = (hit.t + ring - pillStart / fps) * 30;
      assert.ok(frames30 >= 4 && frames30 <= 7, `${fps} fps, heroAt ${heroAt} pillAt ${pillAt}: ring ${frames30.toFixed(2)} frames (at 30 fps) after the pill`);
    }
  }
});

const glideBrief = () => ({
  version: 1, id: 'glide-sound', source: 'Raw/example.mp4', transcript: 'Projects/glide-sound/words.json', ...profileToBrief(profile),
  purpose: 'explainer', tone: 'calm', style: 'grid-glide', beats: [
    {id: 'chapter', fromSec: 0, toSec: 3, intent: 'glide-chapter', data: {ordinal: 'Step one', heroAt: 4, pill: {label: 'Example tool'}, ...KEEP}},
    {id: 'card', fromSec: 3, toSec: 9, intent: 'glide-card', data: {lines: [{words: ['What', 'it', 'does'], role: 'lead', at: 6}],
      media: {clips: [{at: 0, src: 'examples/glide-template-screen.png', sha256: 'b'.repeat(64), width: 640, height: 360, kind: 'image'}]}, ...KEEP}},
    {id: 'closing', fromSec: 9, toSec: 14, intent: 'glide-lines', data: {lines: [{words: ['Your', 'point'], role: 'hero', at: 6}], ...KEEP}},
  ],
});
const edit = {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 600};

test('the opening boom, the cues and the stem fit together', async () => {
  const {manifest} = buildEditorPlan(glideBrief(), edit, []);
  const palette = await loadStylePalette('grid-glide');
  const plan = autoSoundPlan(manifest, palette, {opening: await soundRecipe('sub-boom')});
  assert.deepEqual(plan.opening, {atFrame: 0, recipe: 'sub-boom', gain: 0.5});
  assert.deepEqual(plan.sounds.map((sound) => [sound.atFrame, sound.recipe]), [[0, 'sub-boom'], [24, 'ui-click'], [82, 'sub-thump'], [262, 'sub-thump']]);
  const hits = [];
  for (const sound of plan.sounds) {
    const recipe = await soundRecipe(sound.recipe);
    hits.push(...recipe.hits.map((hit) => ({...hit, t: hit.t + sound.atFrame / 30, gain: (hit.gain ?? 1) * sound.gain})));
  }
  validateHits(hits, 20);
  const stem = mixHits(hits, 20);
  assert.ok(stem.peak < 0.98, `stem peak ${stem.peak}`);
  assert.ok(Math.max(...stem.L.subarray(0, 960).map(Math.abs)) < 1e-3, 'the first 20 ms are the boom lead-in');
  assert.ok(Math.max(...stem.L.subarray(0, 24000).map(Math.abs)) > 0.05, 'the boom is in the stem');
});

test('the opening recipe is read from the catalog only when it can sound', async () => {
  const {manifest} = buildEditorPlan(glideBrief(), edit, []);
  const palette = await loadStylePalette('grid-glide');
  const neverRead = () => { throw new Error('the catalog must not be read'); };
  assert.equal((await openingRecipe(manifest, palette)).id, 'sub-boom', 'a glide edit with a sounding transition kind gets the boom recipe');
  const silent = {...palette, entries: {...palette.entries, transition: {...palette.entries.transition, recipe: null, gain: 0, leadSec: 0}}};
  assert.equal(await openingRecipe(manifest, silent, neverRead), undefined, 'a silent transition kind never asks for the recipe');
  const shared = {...glideBrief(), beats: [
    {id: 'hello', fromSec: 0, toSec: 3, intent: 'intro', layout: 'takeover', data: {kicker: 'Example', title: 'A clear idea', subtitle: 'Review the meaning', caption: 'Example'}},
    {...glideBrief().beats[0], id: 'chapter', fromSec: 3, toSec: 6},
  ]};
  assert.equal(await openingRecipe(buildEditorPlan(shared, edit, []).manifest, palette, neverRead), undefined, 'an edit that does not open on a glide scene never asks for it');
  const plan = autoSoundPlan(manifest, silent, {opening: await openingRecipe(manifest, silent, neverRead)});
  assert.equal(plan.opening, null);
  assert.deepEqual(plan.sounds.map((sound) => sound.recipe), ['ui-click'], 'no boom and no thumps; only the cue kinds that still have a recipe sound');
});

test('planning a glide brief with automatic sound opens with the boom and places thumps, clicks and swells', async () => {
  const id = `glide-sound-${randomUUID()}`, relative = `Projects/${id}`, directory = path.resolve(ROOT, relative);
  assert.ok(directory.startsWith(path.resolve(ROOT, 'Projects') + path.sep));
  await fs.mkdir(directory, {recursive: true});
  try {
    const sourceFile = `${relative}/source.mp4`, transcript = `${relative}/words.json`, briefFile = `${relative}/brief.json`;
    await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=gray:s=64x96:r=30:d=15', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', path.resolve(ROOT, sourceFile)]);
    await fs.writeFile(path.resolve(ROOT, transcript), JSON.stringify([{text: 'Example', startMs: 0, endMs: 500, confidence: 1}]));
    const beats = glideBrief().beats;
    beats[0].data.exit = {kind: 'dip'};
    beats[1].data.enter = {kind: 'dip'};
    await fs.writeFile(path.resolve(ROOT, briefFile), JSON.stringify({...glideBrief(), id, source: sourceFile, transcript, beats, sound: 'auto'}));
    const result = await planEditorBrief(briefFile);
    assert.equal(result.sounds, 4);
    const planned = JSON.parse(await fs.readFile(path.resolve(ROOT, result.manifest), 'utf8'));
    assert.deepEqual(planned.sounds.map((sound) => [sound.atFrame, sound.recipe, sound.gain]),
      [[0, 'sub-boom', 0.5], [24, 'ui-click', 0.5], [84, 'sub-swell-hit', 0.5], [262, 'sub-thump', 0.5]],
      'the boom on frame 0, the pill click, the swell ahead of the dip and the thump ahead of the cut');
    const record = JSON.parse(await fs.readFile(path.resolve(ROOT, result.decisionJson), 'utf8'));
    assert.deepEqual(record.sound.opening, {atFrame: 0, recipe: 'sub-boom', gain: 0.5});
    assert.equal(record.sound.mode, 'auto');
    assert.equal(record.sound.placed, 4);
    assert.deepEqual(record.beatDecisions.map((beat) => beat.soundRecipe ?? null), ['sub-boom + ui-click + sub-swell-hit', 'sub-thump', null]);
  } finally { await fs.rm(directory, {recursive: true, force: true}); }
});

test('recipes mode names the thump for every glide scene', () => {
  const plan = buildEditorPlan(glideBrief(), edit, []);
  assert.deepEqual(plan.decision.beatDecisions.map((beat) => beat.soundCandidate), ['sub-thump', 'sub-thump', 'sub-thump']);
});
