import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {promises as fs, readFileSync} from 'node:fs';
import path from 'node:path';
import {ROOT} from '../scripts/lib/project-paths.mjs';
import {validateLock} from '../scripts/lib/studio-lock.mjs';
import {installPinnedWhisper, verifyPinnedWhisper, pinnedWhisperPaths, isMissingRuntimeDll, probeWhisperRuntime, extractRuntime} from '../scripts/lib/transcription-install.mjs';
import {setupSteps} from '../scripts/lib/studio-setup.mjs';
import {STEP_IDS, STEP_LABELS, describeSetup, workerSteps} from '../scripts/lib/studio-state.mjs';
import {quickChecks, CHECK_LABELS} from '../scripts/lib/studio-doctor.mjs';
import {seedPinnedArtifacts} from '../scripts/lib/clean-install.mjs';

const lock = JSON.parse(readFileSync(path.join(ROOT, 'versions.lock.json'), 'utf8'));
const pins = lock.transcription;
const sha = text => createHash('sha256').update(text).digest('hex');

async function sandbox(t) {
  const parent = path.join(ROOT, 'state', 'tmp', 'transcription-setup-tests');
  await fs.mkdir(parent, {recursive: true});
  const root = await fs.mkdtemp(path.join(parent, 'case-'));
  t.after(async () => { assert.equal(path.dirname(root), parent); await fs.rm(root, {recursive: true, force: true}); });
  return root;
}

const fakeRuntime = {executable: 'whisper-cli.exe', binaryVersion: 'test', binaryFiles: {'whisper-cli.exe': 'a'.repeat(64)}, capabilities: {cpu: true, dtwFlag: true, vadFlag: true}};
function fakes() {
  const calls = [];
  // The fake download writes the URL as the file body, so its hash is sha(url).
  const download = async ({url, sha256, bytes, target}) => {
    calls.push({url, sha256, bytes, target});
    await fs.mkdir(path.dirname(target), {recursive: true});
    await fs.writeFile(target, url);
    return {cached: false, target};
  };
  const extract = async ({directory, record}) => {
    await fs.mkdir(directory, {recursive: true});
    await fs.writeFile(path.join(directory, 'install.json'), JSON.stringify({schema: 1, ...record}));
  };
  const inspect = async () => fakeRuntime;
  return {calls, download, extract, inspect};
}

test('the lock pins the whisper.cpp runtime, the medium model and the VAD with hashes and sizes', () => {
  assert.equal(pins.runtime.release, 'b4938');
  assert.equal(pins.runtime.sha256, 'c2a4b60edb11f7e11a9191ffb50929535527d4d91c9903dbe3e554583bbbc63d');
  assert.equal(pins.runtime.bytes, 8361840);
  assert.equal(pins.model.name, 'medium');
  assert.equal(pins.model.path, 'Tools/whisper-models/ggml-medium.bin');
  assert.equal(pins.model.sha256, '6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208');
  assert.equal(pins.model.bytes, 1533763059);
  assert.equal(pins.vad.path, 'Tools/whisper-models/ggml-silero-v6.2.0.bin');
  assert.equal(pins.vad.sha256, '2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987');
  assert.equal(pins.vad.bytes, 885098);
  for (const entry of [pins.model, pins.vad]) assert.match(entry.url, /^https:\/\/huggingface\.co\/[^/]+\/[^/]+\/resolve\/[0-9a-f]{40}\//, 'model URLs name a fixed revision');
  validateLock(lock);
});

test('the lock validator refuses a transcription entry without a hash or outside Tools/whisper-models', () => {
  const broken = structuredClone(lock);
  broken.transcription.model.sha256 = 'abc';
  broken.transcription.vad.path = 'Tools/models/vad.bin';
  assert.throws(() => validateLock(broken), /transcription\.model\.sha256[\s\S]*transcription\.vad\.path/);
});

test('pinned install downloads the pinned files and records them where transcription looks', async t => {
  const root = await sandbox(t), {calls, download, extract, inspect} = fakes();
  const record = await installPinnedWhisper(pins, {root, download, extract, inspect});
  const paths = pinnedWhisperPaths(pins, root);
  assert.deepEqual(calls.map(call => call.url), [pins.runtime.url, pins.model.url, pins.vad.url]);
  assert.deepEqual(calls.map(call => call.sha256), [pins.runtime.sha256, pins.model.sha256, pins.vad.sha256]);
  assert.deepEqual(calls.map(call => call.bytes), [pins.runtime.bytes, pins.model.bytes, pins.vad.bytes]);
  assert.deepEqual(calls.map(call => call.target), [paths.archive, paths.model, paths.vad]);
  const saved = JSON.parse(await fs.readFile(paths.runtimeFile, 'utf8'));
  assert.equal(saved.directory, paths.directory);
  assert.equal(saved.model.name, 'medium');
  assert.equal(saved.model.path, paths.model);
  assert.equal(saved.model.sha256, pins.model.sha256);
  assert.equal(saved.vad.path, paths.vad);
  assert.equal(saved.vad.sha256, pins.vad.sha256);
  assert.deepEqual(saved.binaryFiles, fakeRuntime.binaryFiles);
  assert.deepEqual(record, saved);
});

test('an existing verified runtime is reused instead of downloaded again', async t => {
  const root = await sandbox(t), {calls, download, inspect} = fakes();
  const paths = pinnedWhisperPaths(pins, root);
  await fs.mkdir(paths.directory, {recursive: true});
  await fs.writeFile(path.join(paths.directory, 'install.json'), JSON.stringify({schema: 1, releaseTag: 'b4938'}));
  await installPinnedWhisper(pins, {root, download, extract: async () => assert.fail('must not extract again'), inspect});
  assert.deepEqual(calls.map(call => call.url), [pins.model.url, pins.vad.url]);
});

test('verification needs the recorded runtime and model files that match their pins', async t => {
  const root = await sandbox(t), {download, extract, inspect} = fakes();
  assert.equal(await verifyPinnedWhisper(pins, {root, inspect}), false, 'nothing installed');
  await installPinnedWhisper(pins, {root, download, extract, inspect});
  assert.equal(await verifyPinnedWhisper(pins, {root, inspect}), false, 'files that do not match their pins');
  const matching = {...pins, model: {...pins.model, sha256: sha(pins.model.url)}, vad: {...pins.vad, sha256: sha(pins.vad.url)}};
  assert.equal(await verifyPinnedWhisper(matching, {root, inspect}), true);
  assert.equal(await verifyPinnedWhisper(matching, {root, inspect: async () => { throw new Error('hash changed'); }}), false, 'a runtime that fails inspection');
});

test('first-run setup ends with the transcription step, keyed by its pins', async () => {
  assert.deepEqual(STEP_IDS, ['folders', 'packages', 'browser', 'ffmpeg', 'fonts', 'models', 'transcription']);
  assert.match(STEP_LABELS.transcription, /التفريغ/);
  const step = setupSteps(ROOT, lock).at(-1);
  assert.equal(step.id, 'transcription');
  const changed = structuredClone(lock);
  changed.transcription.model.sha256 = 'f'.repeat(64);
  assert.notEqual(await step.key(), await setupSteps(ROOT, changed).at(-1).key(), 'a new pin reruns the step');
});

test('the settings screen lists every setup step and derives its count', () => {
  const app = readFileSync(path.join(ROOT, 'scripts/settings-ui/app.js'), 'utf8');
  const labels = /const stageLabels = \{([^}]*)\}/.exec(app)?.[1] ?? '';
  assert.deepEqual([...labels.matchAll(/(\w+):/g)].map(match => match[1]), STEP_IDS);
  assert.equal(/من ٦|\/ 6\b|'6'/.test(app), false, 'no hard-coded six-stage count');
});

test('doctor reports transcription missing until its runtime record and pinned files exist', async t => {
  const root = await sandbox(t);
  const quick = () => quickChecks(root, {lock, gitExe: null, readProfile: async () => ({}), runsTool: () => false, locationProblem: () => null});
  let result = await quick();
  assert.ok(result.failed.includes('transcription'));
  assert.ok(CHECK_LABELS.transcription);
  assert.deepEqual(result.checks.transcription.missing, ['Tools/whisper-runtime.json', pins.model.path, pins.vad.path]);
  for (const file of result.checks.transcription.missing) {
    await fs.mkdir(path.dirname(path.join(root, file)), {recursive: true});
    await fs.writeFile(path.join(root, file), '{}');
  }
  result = await quick();
  assert.equal(result.checks.transcription.ok, true);
});

test('a clean install seeds the pinned transcription files from a cache', async t => {
  const root = await sandbox(t), cache = path.join(root, 'cache'), target = path.join(root, 'target');
  const seeded = structuredClone(lock);
  seeded.fonts = []; seeded.models = [];
  seeded.transcription.runtime.sha256 = sha('runtime');
  seeded.transcription.model.sha256 = sha('model');
  seeded.transcription.vad.sha256 = sha('vad');
  const archive = 'state/cache/downloads/whisper-b4938-x64.zip';
  for (const [file, body] of [[archive, 'runtime'], [pins.model.path, 'model'], [pins.vad.path, 'vad']]) {
    await fs.mkdir(path.dirname(path.join(cache, file)), {recursive: true});
    await fs.writeFile(path.join(cache, file), body);
  }
  assert.deepEqual(await seedPinnedArtifacts(cache, target, seeded), [archive, pins.model.path, pins.vad.path]);
  assert.equal(await fs.readFile(path.join(target, pins.model.path), 'utf8'), 'model');
});

const OLD_STEPS = ['folders', 'packages', 'browser', 'ffmpeg', 'fonts', 'models'];
const okSteps = ids => Object.fromEntries(ids.map(id => [id, {ok: true}]));

test('the setup worker also finishes steps the requesting studio did not know', () => {
  const all = [...OLD_STEPS, 'transcription'];
  assert.deepEqual(workerSteps(OLD_STEPS, {steps: okSteps(OLD_STEPS)}), all, 'an update started by the six-step studio still installs transcription');
  assert.deepEqual(workerSteps(['fonts'], {steps: okSteps(all)}), ['fonts'], 'a finished studio runs only what was asked');
  assert.deepEqual(workerSteps(['fonts'], {}), all, 'a missing steps record counts as nothing done');
  assert.deepEqual(workerSteps(['models'], {steps: {...okSteps(all), folders: {ok: false}}}), ['folders', 'models'], 'a failed step is run again');
});

test('a state an older studio left done does not read as finished while a step is missing', () => {
  const old = describeSetup({status: 'done', steps: okSteps(OLD_STEPS)}, {alive: false});
  assert.equal(old.json.status, 'incomplete');
  assert.equal(old.json.next, 'node scripts/studio.mjs setup');
  assert.equal(old.json.done.transcription, false);
  assert.doesNotMatch(old.line, /خلص ✓/);
  const current = describeSetup({status: 'done', steps: okSteps(STEP_IDS)}, {alive: false});
  assert.equal(current.json.status, 'done');
  assert.match(current.line, /خلص ✓/);
});

test('doctor does not take a done state with a step missing as finished setup', async t => {
  const root = await sandbox(t);
  const quick = () => quickChecks(root, {lock, gitExe: null, readProfile: async () => ({}), runsTool: () => false, locationProblem: () => null});
  const save = async steps => {
    await fs.mkdir(path.join(root, 'state'), {recursive: true});
    await fs.writeFile(path.join(root, 'state', 'setup.json'), JSON.stringify({schema: 1, status: 'done', steps}));
  };
  await save(okSteps(OLD_STEPS));
  const partial = await quick();
  assert.ok(partial.failed.includes('setup'), 'six steps done is not finished setup');
  assert.equal(partial.checks.setup.actual, 'incomplete');
  await save(okSteps(STEP_IDS));
  const finished = (await quick()).checks.setup;
  assert.deepEqual([finished.ok, finished.actual], [true, 'done']);
});

test('the transcription step loads its installer lazily and the import resolves', async t => {
  const root = await sandbox(t);
  assert.equal(await setupSteps(root, lock).at(-1).verify(), false, 'nothing installed in an empty edition');
});

test('a start failure from a missing DLL is recognised from either exit-code spelling', () => {
  assert.equal(isMissingRuntimeDll({status: 3221225781}), true, 'unsigned STATUS_DLL_NOT_FOUND');
  assert.equal(isMissingRuntimeDll({status: -1073741515}), true, 'signed STATUS_DLL_NOT_FOUND');
  assert.equal(isMissingRuntimeDll(Object.assign(new Error('Command failed'), {status: 3221225781})), true, 'an execFileSync error');
  assert.equal(isMissingRuntimeDll({status: 1}), false, 'an ordinary failure');
  assert.equal(isMissingRuntimeDll({status: 0}), false);
  assert.equal(isMissingRuntimeDll({status: null, error: new Error('spawn ENOENT')}), false);
  assert.equal(isMissingRuntimeDll(null), false);
});

test('the runtime probe names the missing Visual C++ Redistributable instead of an opaque failure', () => {
  const runtime = {executable: path.join(ROOT, 'Tools', 'whisper-b4938', 'whisper-cli.exe'), binaryFiles: {}};
  const message = /Error: whisper-cli\.exe could not start because a required DLL is missing, most likely the Microsoft Visual C\+\+ Redistributable \(x64\)\. Install it from https:\/\/aka\.ms\/vs\/17\/release\/vc_redist\.x64\.exe, then run node scripts\/studio\.mjs setup again\.$/;
  const version = Object.assign(new Error('Command failed: whisper-cli.exe --version'), {status: 3221225781});
  assert.throws(() => probeWhisperRuntime(runtime, {execFileSync: () => { throw version; }, spawnSync: () => assert.fail('not reached')}), message);
  assert.throws(() => probeWhisperRuntime(runtime, {execFileSync: () => 'version: 1.7.5\n', spawnSync: () => ({status: -1073741515, stdout: '', stderr: ''})}), message);
  const other = Object.assign(new Error('Command failed: boom'), {status: 1});
  assert.throws(() => probeWhisperRuntime(runtime, {execFileSync: () => { throw other; }, spawnSync: () => assert.fail('not reached')}), error => error === other, 'any other failure passes through unchanged');
  const ok = probeWhisperRuntime(runtime, {execFileSync: () => 'version: 1.7.5\n', spawnSync: () => ({status: 0, stdout: '--output-json-full --dtw --vad-model', stderr: ''})});
  assert.equal(ok.binaryVersion, 'version: 1.7.5');
  assert.equal(ok.capabilities.vadFlag, true);
});

// The fake unzip lays out what the official archive contains; the real hashing still runs on it.
function archiveFakes(overrides = {}) {
  const calls = [];
  const unzip = async (archive, destination) => {
    calls.push({archive, destination});
    await fs.mkdir(path.join(destination, 'bin'), {recursive: true});
    await fs.writeFile(path.join(destination, 'bin', 'whisper-cli.exe'), 'exe');
    await fs.writeFile(path.join(destination, 'bin', 'ggml.dll'), 'dll');
  };
  const probe = ({executable, binaryFiles}) => ({executable, binaryVersion: 'test', binaryFiles, capabilities: {cpu: true, dtwFlag: true, vadFlag: true}});
  return {calls, deps: {unzip, probe, ...overrides}};
}
const record = {releaseTag: 'b4938', archiveSha256: 'a'.repeat(64)};
const leftovers = async directory => (await fs.readdir(path.dirname(directory))).filter(name => name.startsWith(path.basename(directory) + '.install-'));

test('an extracted runtime appears with its install.json already inside, and no staging folder is left', async t => {
  const root = await sandbox(t), directory = path.join(root, 'Tools', 'whisper-b4938'), {calls, deps} = archiveFakes();
  await extractRuntime({archive: path.join(root, 'whisper.zip'), directory, record}, deps);
  const saved = JSON.parse(await fs.readFile(path.join(directory, 'install.json'), 'utf8'));
  assert.equal(saved.releaseTag, 'b4938');
  assert.equal(saved.executable, path.join(directory, 'bin', 'whisper-cli.exe'), 'the recorded executable points at the final folder');
  assert.deepEqual(Object.keys(saved.binaryFiles).sort(), [path.join('bin', 'ggml.dll'), path.join('bin', 'whisper-cli.exe')]);
  assert.equal((await fs.stat(saved.executable)).isFile(), true);
  assert.deepEqual(await leftovers(directory), []);
  await extractRuntime({archive: path.join(root, 'whisper.zip'), directory, record}, {unzip: () => assert.fail('a folder with install.json is kept')});
  assert.equal(calls.length, 1);
});

test('a failed probe or extraction removes the staging folder and leaves no runtime folder', async t => {
  const root = await sandbox(t), directory = path.join(root, 'Tools', 'whisper-b4938');
  const broken = new Error('whisper --help failed');
  await assert.rejects(extractRuntime({archive: 'x.zip', directory, record}, archiveFakes({probe: () => { throw broken; }}).deps), error => error === broken);
  assert.deepEqual(await leftovers(directory), []);
  await assert.rejects(fs.stat(directory), {code: 'ENOENT'}, 'no half-installed folder');
  const unreadable = new Error('Unsafe archive entry');
  await assert.rejects(extractRuntime({archive: 'x.zip', directory, record}, {unzip: async () => { throw unreadable; }}), error => error === unreadable);
  assert.deepEqual(await leftovers(directory), []);
});

test('an existing folder without install.json is preserved and the staging copy is removed', async t => {
  const root = await sandbox(t), directory = path.join(root, 'Tools', 'whisper-b4938');
  await fs.mkdir(directory, {recursive: true});
  await fs.writeFile(path.join(directory, 'kept.txt'), 'inspect me');
  await assert.rejects(extractRuntime({archive: 'x.zip', directory, record}, archiveFakes().deps), /Incomplete install already exists/);
  assert.equal(await fs.readFile(path.join(directory, 'kept.txt'), 'utf8'), 'inspect me');
  assert.deepEqual(await leftovers(directory), []);
});
