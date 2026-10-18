import {spawnSync} from 'node:child_process';
import {existsSync, promises as fs} from 'node:fs';
import path from 'node:path';

const GIT_ENV = {...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never'};

export const STORE_MARKER = 'STORE-EDITION.json';
// The paid store edition is discontinued; its folders get one line pointing to the free GitHub version.
export const STORE_FAREWELL = 'نسخة المتجر لم تعد تُحدَّث، لأن Reel Studio أصبح مجانيًا. ثبّت النسخة المجانية في مجلد جديد من https://github.com/mohamedabdou-ai/reel-studio ثم قل للمساعد «انقل بروفايلي». تبقى مشاريعك القديمة في مجلدها.';
export const isStoreEdition = (root) => existsSync(path.join(root, STORE_MARKER));

export function resolveGit(root) {
  for (const candidate of ['git', path.join(root, 'Tools', 'git', 'cmd', 'git.exe')]) {
    if (spawnSync(candidate, ['--version'], {stdio: 'ignore', windowsHide: true}).status === 0) return candidate;
  }
  return null;
}

function git(gitExe, root, args, timeout = 120000) {
  const result = spawnSync(gitExe, ['-C', root, ...args], {encoding: 'utf8', windowsHide: true, timeout, env: GIT_ENV});
  return {ok: result.status === 0, status: result.status, stdout: (result.stdout ?? '').trim(), stderr: (result.stderr ?? '').trim() || result.error?.message || ''};
}

const editionOf = (text) => {
  try {
    return JSON.parse(text).edition ?? null;
  } catch {
    return null;
  }
};

function isOwnClone(gitExe, root) {
  const top = git(gitExe, root, ['rev-parse', '--show-toplevel']);
  return top.ok && path.resolve(top.stdout).toLowerCase() === path.resolve(root).toLowerCase();
}

// Creators receive official releases only: the newest vX.Y.Z tag. A remote without a release tag offers no update at all,
// so unreleased work on main is never installed. The fetch forces and prunes tags, so a release tag that was moved or deleted
// upstream is followed instead of failing the whole fetch (which used to read as "offline" and block every later update).
const RELEASE_TAG = /^v\d+\.\d+\.\d+$/;
function releaseTarget(gitExe, root) {
  const fetched = git(gitExe, root, ['fetch', '--quiet', '--force', '--prune', '--prune-tags', 'origin'], 60000);
  if (!fetched.ok) return {ok: false, detail: fetched.stderr};
  const tags = git(gitExe, root, ['tag', '--list', 'v*', '--sort=-v:refname']).stdout.split('\n').map((t) => t.trim()).filter((t) => RELEASE_TAG.test(t));
  return {ok: true, ref: tags[0] ?? null, tag: tags[0] ?? null};
}

export async function checkForUpdate(root, {gitExe}) {
  if (isStoreEdition(root)) return {ok: true, channel: 'store', updateAvailable: null, current: editionOf(await fs.readFile(path.join(root, 'versions.lock.json'), 'utf8'))};
  if (!gitExe) return {ok: false, reason: 'no-git'};
  if (!isOwnClone(gitExe, root)) return {ok: false, reason: 'not-a-clone'};
  const current = editionOf(await fs.readFile(path.join(root, 'versions.lock.json'), 'utf8'));
  const target = releaseTarget(gitExe, root);
  if (!target.ok) return {ok: true, updateAvailable: null, reason: 'offline', current, detail: target.detail};
  if (!target.ref) return {ok: true, updateAvailable: false, reason: 'no-release', current, latest: null, release: null};
  const behind = Number(git(gitExe, root, ['rev-list', '--count', `HEAD..${target.ref}`]).stdout || 0);
  const latest = editionOf(git(gitExe, root, ['show', `${target.ref}:versions.lock.json`]).stdout);
  return {ok: true, updateAvailable: behind > 0, behind, current, latest, release: target.tag};
}


export function toolPins(lockText) {
  try {
    const {edition, engine, notices, ...tools} = JSON.parse(lockText);
    return JSON.stringify(tools);
  } catch {
    return lockText;
  }
}

export function pullUpdate(root, {gitExe}) {
  if (isStoreEdition(root)) return {ok: true, channel: 'store', updated: false, changed: {packages: false, tools: false}};
  if (!gitExe) return {ok: false, reason: 'no-git'};
  const dirty = git(gitExe, root, ['status', '--porcelain', '--untracked-files=no']).stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  if (dirty.length) return {ok: false, reason: 'local-changes', dirty};
  const blob = (file) => git(gitExe, root, ['rev-parse', `HEAD:${file}`]).stdout;
  const pins = () => toolPins(git(gitExe, root, ['show', 'HEAD:versions.lock.json']).stdout);
  const from = git(gitExe, root, ['rev-parse', 'HEAD']).stdout;
  const before = {packages: blob('engine/package-lock.json'), tools: pins()};
  const target = releaseTarget(gitExe, root);
  if (!target.ok) return {ok: false, reason: 'offline', detail: target.detail};
  if (!target.ref) return {ok: false, reason: 'no-release'};
  // A fast-forward needs HEAD to be an ancestor of the release. Local commits, or a release tag that moved to other history, stop here untouched.
  const ancestry = git(gitExe, root, ['merge-base', '--is-ancestor', 'HEAD', target.ref]);
  if (ancestry.status === 1) return {ok: false, reason: 'diverged', release: target.tag};
  if (!ancestry.ok) return {ok: false, reason: 'pull-failed', detail: ancestry.stderr};
  const pulled = git(gitExe, root, ['merge', '--ff-only', '--quiet', target.ref], 300000);
  if (!pulled.ok) return {ok: false, reason: 'pull-failed', detail: pulled.stderr};
  const to = git(gitExe, root, ['rev-parse', 'HEAD']).stdout;
  return {ok: true, updated: from !== to, from, to, release: target.tag, changed: {packages: before.packages !== blob('engine/package-lock.json'), tools: before.tools !== pins()}};
}
