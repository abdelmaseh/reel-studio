import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {encodeWav} from '../scripts/sfx.mjs';
import {
  checkInstalled, convertAll, downloadTable, ffmpegArgs, installStatus, readWav, recipesFromLedger, savedName, spliceCatalogText, stampLedger, validateLedger,
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
const tone = (frames, amplitude = 0.5, lead = 0) => Float32Array.from({length: frames}, (_, i) => (i < lead ? 0 : Math.sin(i / 8) * amplitude * Math.exp(-(i - lead) / 6000)));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fakeStamped = () => {
  const stamped = structuredClone(ledger);
  stamped.sounds.forEach((sound, i) => { Object.assign(sound, {sha256: String(i).padStart(64, 'a'), bytes: 20000 + i, seconds: 0.2 + i / 100, channels: 1}); });
  return stamped;
};

test('the download table is the owner approval list: every file with its exact url and size, and the licence texts', () => {
  const table = downloadTable(ledger);
  assert.equal(table.files.length, 28);
  assert.equal(table.totalBytes, 159535);
  assert.equal(new Set(table.files.map((file) => file.url)).size, 28, 'one url per file');
  assert.equal(new Set(table.files.map((file) => file.saveAs)).size, 28, 'one save-as name per file, even where two packs ship the same file name');
  assert.equal(table.files.find((file) => file.id === 'click-mechanical').saveAs, 'click-mechanical.ogg');
  assert.equal(table.files.find((file) => file.id === 'click-tiny').saveAs, 'click-tiny.wav');
  assert.ok(table.files.every((file) => /^https:\/\/raw\.githubusercontent\.com\//.test(file.url) && file.bytes > 0));
  assert.deepEqual(table.licences.map((licence) => licence.source).sort(), Object.keys(ledger.sources).sort());
  assert.ok(table.licences.every((licence) => licence.licence === 'CC0-1.0' && licence.url.startsWith('https://')));
});

test('stamp records hash, size, length and channels of the installed files only, and refuses a file that is not 48 kHz', async (t) => {
  const dir = await tmp(t, 'reel-cc0-stamp-');
  const [first, second] = ledger.sounds;
  await writeFile(path.join(dir, first.file), encodeWav(tone(2400), tone(2400)));
  await writeFile(path.join(dir, second.file), encodeWav(tone(4800), tone(4800, 0.3)));
  const {ledger: next, stamped, missing} = stampLedger(ledger, dir);
  assert.equal(stamped, 2);
  assert.equal(missing.length, ledger.sounds.length - 2);
  assert.equal(next.sounds[0].seconds, 0.05);
  assert.equal(next.sounds[1].seconds, 0.1);
  assert.equal(next.sounds[0].channels, 2);
  assert.equal(next.sounds[0].sha256, sha(readFileSync(path.join(dir, first.file))));
  assert.equal(next.sounds[2].sha256, null, 'a missing file stays unstamped');
  assert.equal(ledger.sounds[0].sha256, null, 'the input is not changed');
  assert.deepEqual(installStatus(next, dir).filter((row) => row.installed).map((row) => row.id), [first.id, second.id]);
  assert.deepEqual(checkInstalled(next, dir), []);

  await writeFile(path.join(dir, first.file), encodeWav(tone(2400, 0.4), tone(2400, 0.4)));
  assert.match(checkInstalled(next, dir).join('\n'), new RegExp(`${first.id}: the file changed`));
  await writeFile(path.join(dir, first.file), encodeWav(new Float32Array(2400), new Float32Array(2400)));
  assert.match(checkInstalled(next, dir).join('\n'), /silent/);
  await writeFile(path.join(dir, first.file), encodeWav(Float32Array.from({length: 2400}, () => 1), Float32Array.from({length: 2400}, () => 1)));
  assert.match(checkInstalled(next, dir).join('\n'), /clipped/);
  const lone = tone(2400, 0.4);
  lone[100] = 1;
  await writeFile(path.join(dir, first.file), encodeWav(lone, tone(2400, 0.4)));
  assert.doesNotMatch(checkInstalled(next, dir).join('\n'), /clipped/, 'one full-scale sample is a normalised peak, not clipping');
  await writeFile(path.join(dir, first.file), encodeWav(tone(70000), tone(70000)));
  assert.match(checkInstalled(next, dir).join('\n'), /longer than/);
  const slow = Buffer.from(encodeWav(tone(2400), tone(2400)));
  slow.writeUInt32LE(44100, 24);
  await writeFile(path.join(dir, first.file), slow);
  assert.throws(() => stampLedger(ledger, dir), /44100 Hz[\s\S]*convert/);
});

test('convert maps each downloaded source to its shipped name, refuses a source of the wrong size and reports what is missing', async (t) => {
  const from = await tmp(t, 'reel-cc0-from-'), to = await tmp(t, 'reel-cc0-to-');
  const [a, b] = ledger.sounds;
  await writeFile(path.join(from, savedName(a)), Buffer.alloc(a.originBytes));
  const calls = [];
  const result = await convertAll({...ledger, sounds: [a, ledger.sounds[2]]}, from, to, async (args) => { calls.push(args); });
  assert.deepEqual(result.converted, [a.id]);
  assert.deepEqual(result.missing, [savedName(ledger.sounds[2])]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].at(-1), path.join(to, a.file));
  assert.ok(calls[0].includes(path.join(from, savedName(a))));
  await writeFile(path.join(from, savedName(b)), Buffer.alloc(b.originBytes + 1));
  await assert.rejects(() => convertAll({...ledger, sounds: [b]}, from, to, async () => {}), new RegExp(`expects ${b.originBytes}`));
});

const ffmpegExe = path.join(ROOT, 'Tools', 'bin', 'ffmpeg.exe');
test('the ffmpeg arguments really produce 48 kHz 16-bit WAV, trim leading silence and repeat byte for byte', {skip: !existsSync(ffmpegExe)}, async (t) => {
  const dir = await tmp(t, 'reel-cc0-ffmpeg-');
  const input = Buffer.from(encodeWav(tone(4410, 0.5, 2000), tone(4410, 0.5, 2000)));
  input.writeUInt32LE(44100, 24);
  input.writeUInt32LE(44100 * 4, 28);
  await writeFile(path.join(dir, 'in.wav'), input);
  const run = promisify(execFile);
  for (const name of ['a.wav', 'b.wav']) await run(ffmpegExe, ffmpegArgs(path.join(dir, 'in.wav'), path.join(dir, name)), {windowsHide: true});
  const a = readFileSync(path.join(dir, 'a.wav')), b = readFileSync(path.join(dir, 'b.wav'));
  assert.equal(sha(a), sha(b), 'bit-exact output');
  const wav = readWav(a);
  assert.equal(wav.sampleRate, 48000);
  assert.equal(wav.channels, 2);
  assert.ok(Math.abs(wav.left[10]) > 0.01 || Math.abs(wav.left[40]) > 0.01, 'the 45 ms of leading silence is gone');
  assert.equal(a.readUInt16LE(34), 16, 'sixteen bits');
});

test('the catalog text is updated in its own layout: only the cc0 recipes at the end change, and removing them gives the original back', () => {
  const text = spliceCatalogText(readFileSync(path.join(ROOT, 'Sound-Kits', 'catalog.json'), 'utf8'), []);
  const recipes = recipesFromLedger(fakeStamped());
  const added = spliceCatalogText(text, recipes);
  const parsed = JSON.parse(added);
  assert.equal(parsed.recipes.length, JSON.parse(text).recipes.length + 28);
  assert.deepEqual(parsed.recipes.slice(-28), recipes);
  assert.deepEqual(parsed.recipes.slice(0, -28), JSON.parse(text).recipes, 'the earlier recipes are untouched');
  const cut = text.lastIndexOf('    }');
  assert.ok(added.startsWith(text.slice(0, cut + 5)), 'the earlier text is untouched');
  assert.equal(spliceCatalogText(added, recipes), added, 'idempotent');
  assert.equal(spliceCatalogText(added, []), text, 'removing them restores the file exactly');
  assert.equal(added.includes('\r\n'), text.includes('\r\n'), 'same line endings');
  assert.throws(() => spliceCatalogText('{"recipes": []}', recipes), /catalog/);
});

test('a stamped ledger with a long or silent sound is refused before it can make a recipe', () => {
  const stamped = fakeStamped();
  stamped.sounds[0].seconds = 5;
  assert.throws(() => validateLedger(stamped), /seconds/);
  assert.throws(() => recipesFromLedger(ledger), /Stamp the ledger first/);
});

test('the command line lists, tabulates and checks without touching the network or the files', async () => {
  const run = promisify(execFile);
  const call = async (...args) => JSON.parse((await run(process.execPath, [path.join(ROOT, 'scripts', 'cc0-sounds.mjs'), ...args], {cwd: ROOT, windowsHide: true})).stdout);
  const list = await call('list');
  assert.equal(list.count, 28);
  assert.equal(list.licence, 'CC0-1.0');
  const urls = await call('urls');
  assert.equal(urls.totalBytes, 159535);
  assert.equal(urls.files.length, 28);
  const check = await call('check');
  assert.equal(check.ok, true);
  assert.equal(check.installed + check.pending.length, 28);
});
