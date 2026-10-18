import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {existsSync, promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// The studio's everyday commands run without a permission prompt, so each command that writes a file keeps it inside the studio
// folder itself, and an exported caption file is replaced only on request.
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const run = (script, args) => new Promise((resolve) => {
  execFile(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {cwd: ROOT, windowsHide: true, timeout: 60000},
    (error, stdout, stderr) => resolve({code: error ? (error.code ?? 1) : 0, out: `${stdout}${stderr}`}));
});
// The system temp folder is outside the studio, except when a harness points TEMP into it (a clean-install
// check runs the suite that way); then use the folder next to the studio.
const isInside = (file) => {const rel = path.relative(ROOT, file); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));};
const tempOutside = path.join(os.tmpdir(), `studio-outside-${process.pid}`);
const outside = isInside(tempOutside) ? path.join(path.dirname(path.resolve(ROOT)), `studio-outside-${process.pid}`) : tempOutside;

test('commands that write a file refuse a destination outside the studio folder', async () => {
  const cases = [
    ['export-captions.mjs', ['state/tmp/none.json', '--outdir', outside]],
    ['sfx.mjs', ['--hits', 'state/tmp/none.json', '--dur', '1', '--out', path.join(outside, 'a.wav')]],
    ['sfx.mjs', ['--kit', path.join(outside, 'kit')]],
    ['build-cut-audio.mjs', ['state/tmp/none.wav', '--segments', '0-1', '--out', path.join(outside, 'a.wav')]],
    ['contact-sheet.mjs', ['state/tmp/none.mp4', '--out', path.join(outside, 'sheet.jpg')]],
    ['iterate.mjs', ['PreparedEdit', '--out', outside, '--no-render']],
    ['safe-check.mjs', ['--comp', 'PreparedEdit', '--out', path.join(outside, 'report.json')]],
  ];
  for (const [script, args] of cases) {
    const result = await run(script, args);
    assert.notEqual(result.code, 0, `${script} ${args.join(' ')} must fail`);
    assert.match(result.out, /inside the project/, `${script} names the reason`);
  }
  assert.equal(existsSync(outside), false, 'nothing was created outside the studio');
});

test('probe, ig-check and frames refuse a report or folder outside the studio folder or inside Raw/ and write nothing', async () => {
  const rawReport = `Raw/boundary-${process.pid}.json`, rawFolder = path.join(ROOT, 'Raw'), rawExisted = existsSync(rawFolder);
  const cases = [
    ['probe.mjs', ['state/tmp/none.mp4', '--json', path.join(outside, 'probe.json')], /inside the project/],
    ['ig-check.mjs', ['state/tmp/none.mp4', '--json', path.join(outside, 'ig.json')], /inside the project/],
    ['probe.mjs', ['state/tmp/none.mp4', '--json', rawReport], /read-only/],
    ['ig-check.mjs', ['state/tmp/none.mp4', '--json', rawReport], /read-only/],
    ['frames.mjs', ['state/tmp/none.mp4', '--at', '1', '--out', path.join(outside, 'frames')], /inside the project/],
    ['frames.mjs', ['state/tmp/none.mp4', '--at', '1', '--out', `Raw/frames-${process.pid}`], /read-only/],
  ];
  for (const [script, args, reason] of cases) {
    const result = await run(script, args);
    assert.notEqual(result.code, 0, `${script} ${args.join(' ')} must fail`);
    assert.match(result.out, reason, `${script} names the reason`);
  }
  assert.equal(existsSync(outside), false, 'nothing was created outside the studio');
  assert.equal(existsSync(path.join(ROOT, rawReport)), false, 'nothing was written into Raw/');
  assert.equal(existsSync(rawFolder), rawExisted, 'Raw/ was not created');
});

test('probe asks for a file name after --json instead of writing a file called true', async () => {
  const stray = path.join(ROOT, 'true'), existed = existsSync(stray);
  const result = await run('probe.mjs', ['state/tmp/none.mp4', '--json']);
  assert.notEqual(result.code, 0);
  assert.match(result.out, /Usage: node scripts\/probe\.mjs/);
  assert.equal(existsSync(stray), existed, 'no stray file');
});

test('caption export writes beside its source and replaces an existing file only with --force', async () => {
  const dir = await fs.mkdtemp(path.join(ROOT, 'state', 'tmp', 'captions-export-'));
  try {
    const source = path.join(dir, 'clip.json');
    await fs.writeFile(source, JSON.stringify({pills: [{from: 0, to: 1.2, text: 'مرحبا'}], cta: null}));
    const first = await run('export-captions.mjs', [path.relative(ROOT, source)]);
    assert.equal(first.code, 0, first.out);
    assert.ok(existsSync(path.join(dir, 'clip.srt')) && existsSync(path.join(dir, 'clip.ass')));
    const again = await run('export-captions.mjs', [path.relative(ROOT, source)]);
    assert.notEqual(again.code, 0);
    assert.match(again.out, /already exists.*--force/);
    const forced = await run('export-captions.mjs', [path.relative(ROOT, source), '--force']);
    assert.equal(forced.code, 0, forced.out);
  } finally {
    await fs.rm(dir, {recursive: true, force: true});
  }
});
