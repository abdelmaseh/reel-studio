import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs, readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {ROOT} from '../lib/project-paths.mjs';
import {STEP_IDS} from '../lib/studio-state.mjs';

test('a warm partial setup keeps its original done result without counting a new full install', async t => {
  const base = path.join(ROOT, 'state/tmp'); await fs.mkdir(base, {recursive: true});
  const root = await fs.mkdtemp(path.join(base, 'stats-setup-test-'));
  t.after(async() => {assert.equal(path.dirname(root), base); await fs.rm(root, {recursive: true, force: true});});
  // Setup runs before `npm ci`, so the registry and every style meta must load from a bare tree.
  const styleFiles = ['types.ts', 'registry.ts', ...readdirSync(path.join(ROOT, 'engine/src/styles'), {withFileTypes: true})
    .filter(entry => entry.isDirectory()).map(entry => `${entry.name}/meta.ts`)].map(file => `engine/src/styles/${file}`);
  const files = ['scripts/studio.mjs', 'versions.lock.json', 'engine/src/core/preference-options.ts', 'engine/src/creative-kit/styles.ts', ...styleFiles,
    ...['project-tmp', 'project-paths', 'branding', 'studio-doctor', 'studio-git', 'studio-lock', 'studio-setup', 'studio-state', 'studio-download', 'npm-command', 'engine-dependencies'].map(name => `scripts/lib/${name}.mjs`)];
  for (const file of files) {
    await fs.mkdir(path.dirname(path.join(root, file)), {recursive: true});
    await fs.copyFile(path.join(ROOT, file), path.join(root, file));
  }
  await fs.writeFile(path.join(root, 'scripts/lib/studio-stats.mjs'),
    "import {writeFile} from 'node:fs/promises'; import path from 'node:path'; export async function recordStudioEvent(root,event){await writeFile(path.join(root,'state/captured-stats.json'),JSON.stringify({event}));} export async function flushStudioEvents(){}\n");
  await fs.mkdir(path.join(root, 'state'), {recursive: true});
  const steps = Object.fromEntries(STEP_IDS.map(id => [id, {ok: true, key: 'previous-install'}]));
  await fs.writeFile(path.join(root, 'state/setup.json'), JSON.stringify({schema: 1, status: 'done', steps}));
  const command = spawnSync(process.execPath, ['scripts/studio.mjs', 'setup', '--foreground', '--steps', 'folders'], {cwd: root, encoding: 'utf8', windowsHide: true});
  assert.equal(command.status, 0, command.stderr || command.stdout);
  assert.equal(JSON.parse(command.stdout.trim().split(/\r?\n/).at(-1)).status, 'done', 'setup behavior stays unchanged');
  assert.equal(await fs.stat(path.join(root, 'state/captured-stats.json')).catch(() => null), null, 'unverified prior tools cannot produce a full-install statistic');
});
