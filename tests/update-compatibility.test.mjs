import '../scripts/lib/project-tmp.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {checkForUpdate, pullUpdate} from '../scripts/lib/studio-git.mjs';
import {normalizeProfile} from '../scripts/lib/branding.mjs';
import {compileEdit} from '../engine/src/prepared-edit/timeline.ts';

const oldManifest = {
  version: 1, id: 'kept-reel', purpose: 'test', style: 'section-deck',
  source: {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 120},
  segments: [{fromFrame: 0, toFrame: 120}],
  captions: {status: 'reviewed', reviewer: 'Creator', words: [{text: 'شرح', startMs: 0, endMs: 1000, confidence: 1}]},
  scenes: [{id: 'intro', fromFrame: 0, durationInFrames: 120, family: 'intro', layout: 'takeover', motion: 'quiet',
    data: {kicker: 'مثال', title: 'مشروع محفوظ', subtitle: 'المحتوى الأصلي', caption: 'شرح'}}],
  sounds: [], camera: [], presenter: false,
};

function git(root, ...args) {
  const result = spawnSync('git', ['-C', root, ...args], {encoding: 'utf8', windowsHide: true});
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test('the current release retains existing profile and manifest formats and a matching runtime version', async () => {
  const lock = JSON.parse(await readFile(new URL('../versions.lock.json', import.meta.url), 'utf8'));
  const runtime = JSON.parse(await readFile(new URL('../engine/package.json', import.meta.url), 'utf8'));
  assert.equal(lock.engine, runtime.version);
  assert.equal(compileEdit(oldManifest).durationInFrames, 120);
  const profile = JSON.parse(await readFile(new URL('../PROFILE.example.json', import.meta.url), 'utf8'));
  profile.schemaVersion = 2;
  delete profile.preferences;
  const bytes = JSON.stringify(profile);
  const normalized = normalizeProfile(profile);
  assert.deepEqual(normalized.ending, profile.ending);
  assert.equal(JSON.stringify(profile), bytes);
});

test('the engine package lock carries the runtime version of the release lock', async () => {
  const lock = JSON.parse(await readFile(new URL('../versions.lock.json', import.meta.url), 'utf8'));
  const packageLock = JSON.parse(await readFile(new URL('../engine/package-lock.json', import.meta.url), 'utf8'));
  assert.match(lock.edition, /^\d+\.\d+\.\d+$/);
  assert.equal(packageLock.version, lock.engine);
  assert.equal(packageLock.packages[''].version, lock.engine);
});

test('a 1.8.6 clone updates by fast-forward while preserving profile and project bytes', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'studio-update-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const origin = path.join(root, 'origin'), consumer = path.join(root, 'consumer');
  await mkdir(path.join(origin, 'engine'), {recursive: true});
  git(origin, 'init', '-b', 'main');
  git(origin, 'config', 'user.name', 'Reel Studio Test');
  git(origin, 'config', 'user.email', 'noreply@github.com');
  const lock = {schema: 1, edition: '1.8.6', engine: '0.6.0', node: {version: '22.20.0'}};
  await writeFile(path.join(origin, 'versions.lock.json'), JSON.stringify(lock));
  await writeFile(path.join(origin, 'engine', 'package-lock.json'), '{"lockfileVersion":3}');
  await writeFile(path.join(origin, '.gitignore'), '/PROFILE.json\n/Projects/\n/Raw/\n/Outputs/\n');
  git(origin, 'add', 'versions.lock.json', 'engine/package-lock.json', '.gitignore');
  git(origin, 'commit', '-m', 'initial');
  const from = git(origin, 'rev-parse', 'HEAD');
  git(root, '-c', 'protocol.file.allow=always', 'clone', '--quiet', pathToFileURL(origin).href, consumer);
  git(consumer, 'config', 'protocol.file.allow', 'always');
  const profile = await readFile(new URL('../PROFILE.example.json', import.meta.url));
  const project = Buffer.from(JSON.stringify(oldManifest, null, 2));
  await mkdir(path.join(consumer, 'Projects', 'kept-reel'), {recursive: true});
  await mkdir(path.join(consumer, 'Outputs'), {recursive: true});
  await writeFile(path.join(consumer, 'PROFILE.json'), profile);
  await writeFile(path.join(consumer, 'Projects', 'kept-reel', 'edit.json'), project);
  await writeFile(path.join(consumer, 'Outputs', 'kept.mp4'), 'unchanged-output');
  await writeFile(path.join(origin, 'versions.lock.json'), JSON.stringify({...lock, edition: '2.0.0', engine: '1.0.0'}));
  git(origin, 'add', 'versions.lock.json');
  git(origin, 'commit', '-m', 'update');
  git(origin, 'tag', 'v2.0.0');
  const check = await checkForUpdate(consumer, {gitExe: 'git'});
  assert.equal(check.current, '1.8.6');
  assert.equal(check.latest, '2.0.0');
  assert.equal(check.updateAvailable, true);
  const result = pullUpdate(consumer, {gitExe: 'git'});
  assert.equal(result.ok, true);
  assert.equal(result.from, from);
  assert.equal(result.updated, true);
  assert.deepEqual(result.changed, {packages: false, tools: false});
  assert.deepEqual(await readFile(path.join(consumer, 'PROFILE.json')), profile);
  assert.deepEqual(await readFile(path.join(consumer, 'Projects', 'kept-reel', 'edit.json')), project);
  assert.equal(await readFile(path.join(consumer, 'Outputs', 'kept.mp4'), 'utf8'), 'unchanged-output');
  assert.equal(compileEdit(JSON.parse(project)).durationInFrames, 120);
  assert.equal(pullUpdate(consumer, {gitExe: 'git'}).updated, false);
});

test('an update installs the newest release tag, not unreleased commits on main', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'studio-release-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const origin = path.join(root, 'origin'), consumer = path.join(root, 'consumer');
  await mkdir(path.join(origin, 'engine'), {recursive: true});
  git(origin, 'init', '-b', 'main');
  git(origin, 'config', 'user.name', 'Reel Studio Test');
  git(origin, 'config', 'user.email', 'noreply@github.com');
  const lock = (edition) => JSON.stringify({schema: 1, edition, engine: '1.0.0', node: {version: '22.20.0'}});
  const commit = async (edition, tag) => {
    await writeFile(path.join(origin, 'versions.lock.json'), lock(edition));
    git(origin, 'add', 'versions.lock.json', 'engine/package-lock.json');
    git(origin, 'commit', '-m', edition);
    if (tag) git(origin, 'tag', tag);
  };
  await writeFile(path.join(origin, 'engine', 'package-lock.json'), '{"lockfileVersion":3}');
  await commit('2.5.0', 'v2.5.0');
  git(root, '-c', 'protocol.file.allow=always', 'clone', '--quiet', pathToFileURL(origin).href, consumer);
  git(consumer, 'config', 'protocol.file.allow', 'always');
  await commit('2.6.0', 'v2.6.0');
  const released = git(origin, 'rev-parse', 'HEAD');
  await commit('2.7.0-work', null);

  const check = await checkForUpdate(consumer, {gitExe: 'git'});
  assert.equal(check.latest, '2.6.0');
  assert.equal(check.release, 'v2.6.0');
  assert.equal(check.updateAvailable, true);
  const result = pullUpdate(consumer, {gitExe: 'git'});
  assert.equal(result.ok, true);
  assert.equal(result.to, released);
  assert.equal(JSON.parse(await readFile(path.join(consumer, 'versions.lock.json'), 'utf8')).edition, '2.6.0');
  assert.equal(pullUpdate(consumer, {gitExe: 'git'}).updated, false);
});

test('a remote without release tags offers no update and never installs unreleased work', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'studio-tagless-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const origin = path.join(root, 'origin'), consumer = path.join(root, 'consumer');
  await mkdir(path.join(origin, 'engine'), {recursive: true});
  git(origin, 'init', '-b', 'main');
  git(origin, 'config', 'user.name', 'Reel Studio Test');
  git(origin, 'config', 'user.email', 'noreply@github.com');
  const lock = (edition) => JSON.stringify({schema: 1, edition, engine: '1.0.0', node: {version: '22.20.0'}});
  await writeFile(path.join(origin, 'engine', 'package-lock.json'), '{"lockfileVersion":3}');
  await writeFile(path.join(origin, 'versions.lock.json'), lock('2.5.0'));
  git(origin, 'add', 'versions.lock.json', 'engine/package-lock.json');
  git(origin, 'commit', '-m', 'first');
  git(root, '-c', 'protocol.file.allow=always', 'clone', '--quiet', pathToFileURL(origin).href, consumer);
  git(consumer, 'config', 'protocol.file.allow', 'always');
  const before = git(consumer, 'rev-parse', 'HEAD');
  await writeFile(path.join(origin, 'versions.lock.json'), lock('3.0.0-work'));
  git(origin, 'add', 'versions.lock.json');
  git(origin, 'commit', '-m', 'unreleased work');

  const check = await checkForUpdate(consumer, {gitExe: 'git'});
  assert.equal(check.ok, true);
  assert.equal(check.updateAvailable, false);
  assert.equal(check.reason, 'no-release');
  const result = pullUpdate(consumer, {gitExe: 'git'});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no-release');
  assert.equal(git(consumer, 'rev-parse', 'HEAD'), before, 'the clone stays where it was');
  assert.equal(JSON.parse(await readFile(path.join(consumer, 'versions.lock.json'), 'utf8')).edition, '2.5.0');
});

// A local origin whose commits are released as annotated tags, plus a clone of it that behaves like a creator's studio folder.
async function releaseStudio(t, prefix) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => rm(root, {recursive: true, force: true}));
  const origin = path.join(root, 'origin'), consumer = path.join(root, 'consumer');
  await mkdir(path.join(origin, 'engine'), {recursive: true});
  git(origin, 'init', '-b', 'main');
  git(origin, 'config', 'user.name', 'Reel Studio Test');
  git(origin, 'config', 'user.email', 'noreply@github.com');
  git(origin, 'config', 'tag.gpgSign', 'false');
  await writeFile(path.join(origin, 'engine', 'package-lock.json'), '{"lockfileVersion":3}');
  const release = async (edition, tag, engine = '1.0.0') => {
    await writeFile(path.join(origin, 'versions.lock.json'), JSON.stringify({schema: 1, edition, engine, node: {version: '22.20.0'}}));
    git(origin, 'add', 'versions.lock.json', 'engine/package-lock.json');
    git(origin, 'commit', '-m', `${edition} ${engine}`);
    if (tag) git(origin, 'tag', '-a', tag, '-m', tag);
    return git(origin, 'rev-parse', 'HEAD');
  };
  const clone = () => {
    git(root, '-c', 'protocol.file.allow=always', 'clone', '--quiet', pathToFileURL(origin).href, consumer);
    git(consumer, 'config', 'protocol.file.allow', 'always');
    git(consumer, 'config', 'user.name', 'Reel Studio Test');
    git(consumer, 'config', 'user.email', 'noreply@github.com');
  };
  const state = async () => ({head: git(consumer, 'rev-parse', 'HEAD'), status: git(consumer, 'status', '--porcelain'), lock: await readFile(path.join(consumer, 'versions.lock.json'), 'utf8')});
  return {root, origin, consumer, release, clone, state};
}

test('a release tag moved forward upstream is followed instead of failing the fetch as offline', async t => {
  const s = await releaseStudio(t, 'studio-moved-');
  await s.release('2.5.0', 'v2.5.0');
  s.clone();
  await s.release('2.6.0', 'v2.6.0');
  assert.equal((await checkForUpdate(s.consumer, {gitExe: 'git'})).release, 'v2.6.0', 'the clone has fetched the first v2.6.0');
  const fixed = await s.release('2.6.0', null, '1.0.1');
  git(s.origin, 'tag', '-f', '-a', 'v2.6.0', '-m', 'v2.6.0');

  const check = await checkForUpdate(s.consumer, {gitExe: 'git'});
  assert.equal(check.ok, true);
  assert.notEqual(check.reason, 'offline', 'a moved tag is not a network problem');
  assert.equal(check.release, 'v2.6.0');
  assert.equal(check.updateAvailable, true);
  const result = pullUpdate(s.consumer, {gitExe: 'git'});
  assert.equal(result.ok, true, result.detail);
  assert.equal(result.to, fixed, 'the update lands on the re-tagged commit');
  assert.equal(JSON.parse((await s.state()).lock).engine, '1.0.1');
});

test('a release tag moved to other history stops the update as diverged and leaves the folder untouched', async t => {
  const s = await releaseStudio(t, 'studio-rewritten-');
  await s.release('2.5.0', 'v2.5.0');
  s.clone();
  const published = await s.release('2.6.0', 'v2.6.0');
  assert.equal(pullUpdate(s.consumer, {gitExe: 'git'}).to, published, 'the clone installed the published v2.6.0');
  git(s.origin, 'commit', '--amend', '--quiet', '-m', '2.6.0 rebuilt');
  git(s.origin, 'tag', '-f', '-a', 'v2.6.0', '-m', 'v2.6.0');
  assert.notEqual(git(s.origin, 'rev-parse', 'HEAD'), published);
  const before = await s.state();

  const check = await checkForUpdate(s.consumer, {gitExe: 'git'});
  assert.equal(check.ok, true);
  assert.notEqual(check.reason, 'offline', 'a moved tag is not a network problem');
  const result = pullUpdate(s.consumer, {gitExe: 'git'});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'diverged');
  assert.deepEqual(await s.state(), before, 'HEAD, files and status are unchanged');
});

test('a release tag deleted upstream is dropped locally and never installed', async t => {
  const s = await releaseStudio(t, 'studio-deleted-');
  await s.release('2.5.0', 'v2.5.0');
  s.clone();
  await s.release('2.6.0', 'v2.6.0');
  assert.equal((await checkForUpdate(s.consumer, {gitExe: 'git'})).release, 'v2.6.0', 'the clone has fetched v2.6.0');
  assert.equal(git(s.consumer, 'tag', '--list', 'v2.6.0'), 'v2.6.0');
  git(s.origin, 'tag', '-d', 'v2.6.0');
  const before = await s.state();

  const check = await checkForUpdate(s.consumer, {gitExe: 'git'});
  assert.equal(check.ok, true);
  assert.equal(check.release, 'v2.5.0', 'the newest release is the newest one that still exists');
  assert.equal(check.updateAvailable, false);
  assert.equal(git(s.consumer, 'tag', '--list', 'v2.6.0'), '', 'the deleted tag is gone from the clone');
  const kept = pullUpdate(s.consumer, {gitExe: 'git'});
  assert.equal(kept.ok, true);
  assert.equal(kept.updated, false, 'the deleted release is never installed');
  assert.deepEqual(await s.state(), before);

  git(s.origin, 'tag', '-d', 'v2.5.0');
  const none = await checkForUpdate(s.consumer, {gitExe: 'git'});
  assert.equal(none.reason, 'no-release');
  const refused = pullUpdate(s.consumer, {gitExe: 'git'});
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'no-release');
  assert.deepEqual(await s.state(), before);
});

test('local commits in the studio folder stop the update as diverged and nothing is lost', async t => {
  const s = await releaseStudio(t, 'studio-diverged-');
  await s.release('2.5.0', 'v2.5.0');
  s.clone();
  await writeFile(path.join(s.consumer, 'local-note.txt'), 'kept');
  git(s.consumer, 'add', 'local-note.txt');
  git(s.consumer, 'commit', '-m', 'local change');
  await s.release('2.6.0', 'v2.6.0');
  const before = await s.state();

  const result = pullUpdate(s.consumer, {gitExe: 'git'});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'diverged');
  assert.equal(result.release, 'v2.6.0');
  assert.deepEqual(await s.state(), before, 'HEAD, files and status are unchanged');
  assert.equal(await readFile(path.join(s.consumer, 'local-note.txt'), 'utf8'), 'kept');
});

test('an unreachable origin reads as offline for the check and the update and changes nothing', async t => {
  const s = await releaseStudio(t, 'studio-offline-');
  await s.release('2.5.0', 'v2.5.0');
  s.clone();
  await s.release('2.6.0', 'v2.6.0');
  git(s.consumer, 'remote', 'set-url', 'origin', pathToFileURL(path.join(s.root, 'gone')).href);
  const before = await s.state();

  const check = await checkForUpdate(s.consumer, {gitExe: 'git'});
  assert.equal(check.reason, 'offline');
  assert.equal(check.updateAvailable, null);
  const result = pullUpdate(s.consumer, {gitExe: 'git'});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'offline');
  assert.deepEqual(await s.state(), before);
});

test('every reason the update can stop with has an Arabic line in studio.mjs', async () => {
  const gitSource = await readFile(new URL('../scripts/lib/studio-git.mjs', import.meta.url), 'utf8');
  const studioSource = await readFile(new URL('../scripts/studio.mjs', import.meta.url), 'utf8');
  const reasons = new Set([...gitSource.slice(gitSource.indexOf('export function pullUpdate')).matchAll(/reason: '([a-z-]+)'/g)].map((match) => match[1]));
  for (const reason of ['no-git', 'local-changes', 'offline', 'no-release', 'diverged', 'pull-failed']) assert.ok(reasons.has(reason), `pullUpdate can stop with ${reason}`);
  const start = studioSource.indexOf('const UPDATE_LINES = {');
  const lines = studioSource.slice(start, studioSource.indexOf('\n};', start));
  for (const reason of reasons) assert.match(lines, new RegExp(`'${reason}': '[^']*[\\u0600-\\u06FF]`), `${reason} has an Arabic line`);
});

test('a store folder gets one plain line that points to the free GitHub version', async () => {
  const {STORE_FAREWELL} = await import('../scripts/lib/studio-git.mjs');
  assert.match(STORE_FAREWELL, /https:\/\/github\.com\/mohamedabdou-ai\/reel-studio/);
  assert.match(STORE_FAREWELL, /«انقل بروفايلي»/);
  assert.doesNotMatch(STORE_FAREWELL, /ZIP|فولدر|عشان|دلوقتي|قول /);
});
