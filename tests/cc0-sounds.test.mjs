import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {encodeWav, mixHits, renderSound} from '../scripts/sfx.mjs';
import {SOUND_NAMES, loadSoundCatalog, validateHits} from '../scripts/lib/job-sound.mjs';
import {
  BUDGET_BYTES, FORBIDDEN_CUE_WORDS, MAX_SAMPLE_SECONDS, SAMPLE_PREFIX, SOUND_KINDS, cc0Sample, ffmpegArgs, mergeCc0Recipes, readWav,
  recipesFromLedger, setCc0Root, validateLedger,
} from '../scripts/lib/cc0-sounds.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
// The shipped ledger is stamped once the files are installed; the tool tests start from its planned (unstamped) form.
const shipped = JSON.parse(readFileSync(path.join(ROOT, 'Sound-Kits', 'cc0', 'ledger.json'), 'utf8'));
const ledger = {...shipped, sounds: shipped.sounds.map((sound) => ({...sound, sha256: null, bytes: null, seconds: null, channels: null}))};
const tmp = async (t, prefix) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => rm(dir, {recursive: true, force: true}));
  return dir;
};
const clone = () => structuredClone(ledger);

test('the shipped ledger is valid, CC0 only, with a pinned source and exact size for each of the 28 planned files', () => {
  assert.doesNotThrow(() => validateLedger(ledger));
  assert.equal(ledger.sounds.length, 28);
  assert.equal(ledger.licence, 'CC0-1.0');
  assert.deepEqual(Object.keys(ledger.sources).sort(), ['kenney-impact-sounds', 'kenney-interface-sounds', 'kenney-rpg-audio', 'uisfx']);
  for (const source of Object.values(ledger.sources)) assert.equal(source.licence, 'CC0-1.0');
  assert.deepEqual([...new Set(ledger.sounds.map((sound) => sound.kind))].sort(), [...SOUND_KINDS].sort(), 'every kind of the sound guide has at least one file');
  assert.equal(ledger.sounds.reduce((sum, sound) => sum + sound.originBytes, 0), 159535, 'the download table total');
  assert.ok(ledger.sounds.reduce((sum, sound) => sum + sound.originBytes, 0) < BUDGET_BYTES);
  for (const sound of ledger.sounds) {
    const source = ledger.sources[sound.source];
    assert.ok(sound.originUrl.startsWith(source.base), `${sound.id} comes from its pinned base`);
    if (source.ref) assert.match(source.ref, /^[0-9a-f]{40}$/);
    assert.equal(sound.file, `${sound.id}.wav`);
  }
});

test('the ledger refuses what the sound guide forbids: other licences, sweeps, buzzers, music, bad names and duplicates', () => {
  const bad = (change) => { const copy = clone(); change(copy); return () => validateLedger(copy); };
  assert.throws(bad((l) => { l.licence = 'CC-BY-4.0'; }), /CC0/);
  assert.throws(bad((l) => { l.sources.uisfx.licence = 'MIT'; }), /CC0/);
  assert.throws(bad((l) => { l.sounds[1].id = l.sounds[0].id; l.sounds[1].file = l.sounds[0].file; }), /duplicate/i);
  assert.throws(bad((l) => { l.sounds[0].file = 'other.wav'; }), /file/);
  assert.throws(bad((l) => { l.sounds[0].kind = 'whoosh'; }), /kind/);
  assert.throws(bad((l) => { l.sounds[0].source = 'freesound'; }), /source/);
  assert.throws(bad((l) => { l.sounds[0].id = 'Click Minimal'; l.sounds[0].file = 'Click Minimal.wav'; }), /slug/);
  assert.throws(bad((l) => { l.sounds[0].origin = 'packages/uisfx/sounds/minimal/swipe.ogg'; }), /swipe/);
  assert.throws(bad((l) => { l.sounds[0].origin = 'packages/uisfx/sounds/minimal/error.ogg'; }), /error/);
  assert.throws(bad((l) => { l.sounds[0].origin = 'packages/uisfx/sounds/minimal/level-up.ogg'; }), /level/);
  assert.throws(bad((l) => { l.sounds[0].originUrl = 'https://example.com/a.ogg'; }), /base/);
  assert.throws(bad((l) => { l.sounds[0].sha256 = 'abc'; l.sounds[0].bytes = 10; l.sounds[0].seconds = 0.1; l.sounds[0].channels = 1; }), /sha256/);
  assert.throws(bad((l) => { l.sounds[0].sha256 = 'a'.repeat(64); }), /bytes|seconds|channels/, 'a stamp is complete or absent');
  assert.throws(bad((l) => { l.sounds[0].sha256 = 'a'.repeat(64); l.sounds[0].bytes = 100; l.sounds[0].seconds = MAX_SAMPLE_SECONDS + 1; l.sounds[0].channels = 1; }), /seconds/);
  assert.throws(bad((l) => { l.extra = true; }), /fields/);
  for (const word of ['whoosh', 'swipe', 'send', 'open', 'close', 'error', 'warning', 'blocked', 'level', 'achievement', 'jingle', 'music']) {
    assert.ok(FORBIDDEN_CUE_WORDS.includes(word), `${word} is forbidden in a source file name`);
  }
});

test('readWav decodes PCM 16-bit mono and stereo, 24-bit and float files, and refuses anything else', () => {
  const L = Float32Array.from({length: 480}, (_, i) => Math.sin(i / 7) * 0.5);
  const R = Float32Array.from({length: 480}, (_, i) => Math.cos(i / 5) * 0.25);
  const stereo = readWav(encodeWav(L, R));
  assert.equal(stereo.sampleRate, 48000);
  assert.equal(stereo.channels, 2);
  assert.equal(stereo.left.length, 480);
  for (let i = 0; i < 480; i += 37) {
    assert.ok(Math.abs(stereo.left[i] - L[i]) < 1 / 16000, `left ${i}`);
    assert.ok(Math.abs(stereo.right[i] - R[i]) < 1 / 16000, `right ${i}`);
  }
  const header = (bytes, {format = 1, channels = 1, rate = 44100, bits = 16} = {}) => {
    const buf = Buffer.alloc(44 + bytes);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + bytes, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(format, 20); buf.writeUInt16LE(channels, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * channels * bits / 8, 28);
    buf.writeUInt16LE(channels * bits / 8, 32); buf.writeUInt16LE(bits, 34); buf.write('data', 36); buf.writeUInt32LE(bytes, 40);
    return buf;
  };
  const mono = header(441 * 2);
  for (let i = 0; i < 441; i++) mono.writeInt16LE(Math.round(Math.sin(i / 10) * 16000), 44 + i * 2);
  const decoded = readWav(mono);
  assert.equal(decoded.channels, 1);
  assert.equal(decoded.right, null);
  assert.equal(decoded.sampleRate, 44100);
  assert.equal(decoded.left.length, 441);
  const float = header(4 * 10, {format: 3, bits: 32});
  for (let i = 0; i < 10; i++) float.writeFloatLE(i / 20, 44 + i * 4);
  assert.ok(Math.abs(readWav(float).left[4] - 0.2) < 1e-6);
  const deep = header(3 * 4, {bits: 24});
  deep.writeIntLE(4194304, 44 + 3, 3);
  assert.ok(Math.abs(readWav(deep).left[1] - 0.5) < 1e-6);
  assert.throws(() => readWav(Buffer.from('not a wav at all, definitely not')), /WAV/);
  assert.throws(() => readWav(header(8, {format: 2})), /PCM|float/);
  assert.throws(() => readWav(mono.subarray(0, 60)), /truncated|data/);
  assert.throws(() => readWav(header(8, {channels: 6})), /channels/);
});

test('a sample voice is read from the ledgered file, resampled to 48 kHz, peak-normalised, and a missing file says how to install it', async (t) => {
  const dir = await tmp(t, 'reel-cc0-');
  await mkdir(dir, {recursive: true});
  const miniLedger = {...clone(), sounds: [{...clone().sounds[0], id: 'probe-click', file: 'probe-click.wav'}]};
  await writeFile(path.join(dir, 'ledger.json'), JSON.stringify(miniLedger));
  setCc0Root(dir);
  t.after(() => setCc0Root(null));
  assert.throws(() => cc0Sample('probe-click'), /probe-click\.wav[\s\S]*cc0-sounds/);
  assert.throws(() => cc0Sample('nope'), /nope[\s\S]*probe-click/);
  const samples = Float32Array.from({length: 4410}, (_, i) => Math.sin(i / 12) * 0.2 * Math.exp(-i / 1500));
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + samples.length * 2, 4); wav.write('WAVE', 8); wav.write('fmt ', 12); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((value, i) => wav.writeInt16LE(Math.round(value * 32767), 44 + i * 2));
  await writeFile(path.join(dir, 'probe-click.wav'), wav);
  const voice = cc0Sample('probe-click');
  assert.ok(ArrayBuffer.isView(voice), 'a mono file is a mono voice');
  assert.equal(voice.length, Math.round(4410 * 48000 / 44100));
  const peak = voice.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  assert.ok(Math.abs(peak - 0.7) < 0.01, `peak ${peak}`);
  assert.equal(cc0Sample('probe-click'), voice, 'cached per file');
});

test('sample hits validate like the other voices and sfx.mjs mixes them at their time and gain', async (t) => {
  const dir = await tmp(t, 'reel-cc0-mix-');
  const L = Float32Array.from({length: 2400}, (_, i) => Math.sin(i / 9) * 0.8);
  await writeFile(path.join(dir, 'ledger.json'), JSON.stringify({...clone(), sounds: [{...clone().sounds[0], id: 'probe-tone', file: 'probe-tone.wav'}]}));
  await writeFile(path.join(dir, 'probe-tone.wav'), encodeWav(L, L));
  setCc0Root(dir);
  t.after(() => setCc0Root(null));

  assert.equal(SAMPLE_PREFIX, 'sample:');
  assert.doesNotThrow(() => validateHits([{t: 0.1, sound: 'sample:probe-tone', gain: 0.8, pan: -0.2}], 1));
  assert.throws(() => validateHits([{t: 0, sound: 'sample:Bad Id'}], 1), /sample/i);
  assert.throws(() => validateHits([{t: 0, sound: 'sample:'}], 1), /sample/i);
  assert.throws(() => validateHits([{t: 0, sound: 'sample:probe-tone', opts: {dur: 0.1}}], 1), /option/i);
  assert.throws(() => validateHits([{t: 0, sound: 'sample:probe-tone'}], 1, {samples: new Set(['other'])}), /probe-tone/);
  assert.doesNotThrow(() => validateHits([{t: 0, sound: 'sample:probe-tone'}], 1, {samples: new Set(['probe-tone'])}));
  assert.throws(() => validateHits([{t: 0, sound: 'whooshX'}], 1), /Unknown sound/);
  assert.ok(!SOUND_NAMES.some((name) => name.startsWith('sample')), 'the synthesized voice list is unchanged');

  const voice = renderSound('sample:probe-tone');
  assert.equal(voice.left.length, 2400, 'a stereo file is a stereo voice');
  const a = mixHits([{t: 0.5, sound: 'sample:probe-tone', gain: 0.5}], 1);
  assert.equal(a.placed, 1);
  assert.equal(a.L[Math.round(0.5 * 48000) - 1], 0, 'silent before the hit');
  assert.ok(Math.abs(a.peak - 0.35) < 0.01, `peak ${a.peak} = 0.7 normalised x 0.5 gain`);
  const again = mixHits([{t: 0.5, sound: 'sample:probe-tone', gain: 0.5}], 1);
  assert.equal(createHash('sha256').update(Buffer.from(a.L.buffer)).digest('hex'), createHash('sha256').update(Buffer.from(again.L.buffer)).digest('hex'), 'deterministic');
  assert.throws(() => renderSound('sample:missing'), /missing/);
});

test('the shipped sound catalog still validates and has no sample recipe until the files are approved', async () => {
  const catalog = await loadSoundCatalog();
  assert.equal(catalog.sounds.length, 20);
  assert.equal(catalog.recipes.filter((recipe) => recipe.hits.some((hit) => hit.sound.startsWith(SAMPLE_PREFIX))).length, existsSync(path.join(ROOT, 'Sound-Kits', 'cc0', `${ledger.sounds[0].file}`)) ? ledger.sounds.length : 0);
});

test('recipes are made from a stamped ledger, one per sound, and merge into the catalog without touching the others', () => {
  assert.throws(() => recipesFromLedger(ledger), /stamp/i, 'an unstamped ledger has no durations to build recipes from');
  const stamped = clone();
  stamped.sounds.forEach((sound, i) => { Object.assign(sound, {sha256: String(i).padStart(64, 'a'), bytes: 20000 + i, seconds: 0.2 + i / 100, channels: 1}); });
  assert.doesNotThrow(() => validateLedger(stamped));
  const recipes = recipesFromLedger(stamped);
  assert.equal(recipes.length, 28);
  for (const recipe of recipes) {
    assert.match(recipe.id, /^cc0-[a-z0-9-]+$/);
    assert.equal(recipe.hits.length, 1);
    assert.equal(recipe.hits[0].t, 0);
    assert.ok(recipe.hits[0].sound.startsWith(SAMPLE_PREFIX));
    assert.ok(recipe.duration >= stamped.sounds.find((sound) => `cc0-${sound.id}` === recipe.id).seconds, `${recipe.id} covers its sample`);
    assert.doesNotThrow(() => validateHits(recipe.hits, recipe.duration, {samples: new Set(stamped.sounds.map((sound) => sound.id))}));
  }
  const base = {version: 1, sampleRate: 48000, provenance: 'p', sounds: [], recipes: [{id: 'soft-pop', name: 'x', use: 'y', duration: 0.1, hits: []}, {id: 'cc0-old', name: 'x', use: 'y', duration: 0.1, hits: []}]};
  const merged = mergeCc0Recipes(base, recipes);
  assert.equal(merged.recipes.length, 1 + 28, 'the old cc0 recipe is replaced, the others stay');
  assert.equal(merged.recipes[0].id, 'soft-pop');
  assert.equal(base.recipes.length, 2, 'the input is not changed');
  assert.deepEqual(mergeCc0Recipes(merged, recipes), merged, 'merging twice changes nothing');
});

test('ffmpeg arguments make 48 kHz 16-bit WAV, trim leading silence and never loudness-normalise', () => {
  const args = ffmpegArgs('in.ogg', 'out.wav');
  assert.deepEqual(args.slice(0, 3), ['-y', '-i', 'in.ogg']);
  assert.ok(args.join(' ').includes('-ar 48000'));
  assert.ok(args.join(' ').includes('pcm_s16le'));
  assert.ok(args.join(' ').includes('silenceremove'));
  assert.ok(!args.join(' ').includes('loudnorm'));
  assert.equal(args.at(-1), 'out.wav');
});

test('files already put in place match the ledger (skipped while the downloads are pending)', () => {
  const folder = path.join(ROOT, 'Sound-Kits', 'cc0');
  const present = readdirSync(folder).filter((name) => name.endsWith('.wav'));
  if (present.length === 0) return;
  assert.deepEqual(present.sort(), shipped.sounds.map((sound) => sound.file).sort(), 'every ledgered file is present and nothing else is');
  for (const sound of shipped.sounds) {
    assert.ok(sound.sha256, `${sound.id} is stamped (node scripts/cc0-sounds.mjs stamp)`);
    const bytes = readFileSync(path.join(folder, sound.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sound.sha256, `${sound.id} sha256`);
    const wav = readWav(bytes);
    assert.equal(wav.sampleRate, 48000);
    assert.ok(wav.left.length / 48000 <= MAX_SAMPLE_SECONDS, `${sound.id} is short`);
    assert.equal(wav.channels, sound.channels);
  }
  assert.ok(shipped.sounds.reduce((sum, sound) => sum + sound.bytes, 0) <= BUDGET_BYTES, 'the 8 MB budget');
});

test('the guides describe the CC0 set where sounds are chosen', () => {
  const guide = readFileSync(path.join(ROOT, 'instructions', 'SOUND.md'), 'utf8');
  assert.match(guide, /Sound-Kits\/cc0/);
  assert.match(guide, /sample:/);
  assert.match(guide, /no sweeps|never a sweep|No sweeps/i);
  const readme = readFileSync(path.join(ROOT, 'Sound-Kits', 'cc0', 'README.md'), 'utf8');
  for (const sound of ledger.sounds) assert.ok(readme.includes(`\`${sound.id}\``), `${sound.id} is listed in Sound-Kits/cc0/README.md`);
});
