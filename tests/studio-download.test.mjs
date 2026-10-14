import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {ROOT} from '../scripts/lib/project-paths.mjs';
import {downloadVerified, downloadTimeoutMs, renameWithRetry} from '../scripts/lib/studio-download.mjs';

const HALF_HOUR = 30 * 60 * 1000;

async function sandbox(t) {
  const parent = path.join(ROOT, 'state', 'tmp', 'studio-download-tests');
  await fs.mkdir(parent, {recursive: true});
  const root = await fs.mkdtemp(path.join(parent, 'case-'));
  t.after(async () => { assert.equal(path.dirname(root), parent); await fs.rm(root, {recursive: true, force: true}); });
  return root;
}

const locked = code => Object.assign(new Error(`${code}: file is locked`), {code});

test('the download time limit is 30 minutes for small files and grows for the 1.5 GB model', () => {
  assert.equal(downloadTimeoutMs(null), HALF_HOUR);
  assert.equal(downloadTimeoutMs(), HALF_HOUR);
  assert.equal(downloadTimeoutMs(8361840), HALF_HOUR, 'the runtime archive keeps the base limit');
  assert.ok(downloadTimeoutMs(1533763059) >= 2 * 60 * 60 * 1000, 'the model gets at least two hours (a 200 KB/s floor)');
});

test('the final rename retries while antivirus holds the new file, then succeeds', async () => {
  const attempts = [];
  const failures = [locked('EPERM'), locked('EBUSY'), locked('EACCES')];
  const rename = async (from, to) => { attempts.push([from, to]); const failure = failures.shift(); if (failure) throw failure; };
  await renameWithRetry('a.partial', 'a', {rename, delayMs: 0});
  assert.equal(attempts.length, 4);
  assert.deepEqual(attempts.at(-1), ['a.partial', 'a']);
});

test('the rename gives up after its tries and does not retry other errors', async () => {
  let calls = 0;
  await assert.rejects(renameWithRetry('a.partial', 'a', {rename: async () => { calls += 1; throw locked('EPERM'); }, tries: 4, delayMs: 0}), /EPERM/);
  assert.equal(calls, 4);
  calls = 0;
  await assert.rejects(renameWithRetry('a.partial', 'a', {rename: async () => { calls += 1; throw Object.assign(new Error('missing'), {code: 'ENOENT'}); }, delayMs: 0}), /missing/);
  assert.equal(calls, 1, 'only a lock-style error is retried');
});

test('a download is verified, renamed into place and cached on the second call', async t => {
  const root = await sandbox(t), body = Buffer.from('pinned file body');
  const server = http.createServer((_req, res) => { res.writeHead(200); res.end(body); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}/file.bin`, target = path.join(root, 'nested', 'file.bin');
  const sha256 = createHash('sha256').update(body).digest('hex');
  assert.deepEqual(await downloadVerified({url, sha256, bytes: body.length, target}), {cached: false, target, bytes: body.length});
  assert.deepEqual(await fs.readFile(target), body);
  assert.equal((await fs.readdir(path.dirname(target))).includes('file.bin.partial'), false);
  assert.deepEqual(await downloadVerified({url, sha256, bytes: body.length, target}), {cached: true, target});
  await assert.rejects(downloadVerified({url, sha256: 'f'.repeat(64), bytes: body.length, target: path.join(root, 'bad.bin')}), /SHA-256/);
  await assert.rejects(fs.stat(path.join(root, 'bad.bin.partial')), {code: 'ENOENT'});
});
