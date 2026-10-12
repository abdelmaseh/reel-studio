import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {ROOT} from '../lib/project-paths.mjs';
import {createReviewServer} from '../lib/review-editor-server.mjs';
import {reviewManifest} from '../../tests/helpers/review-manifest.mjs';

async function review(t, record) {
  const id = `stats-review-${randomUUID()}`, directory = path.join(ROOT, 'Projects', id);
  const manifestPath = `Projects/${id}/edit.json`;
  await mkdir(directory, {recursive: true});
  await writeFile(path.join(ROOT, manifestPath), JSON.stringify(reviewManifest(id)));
  t.after(async() => {
    assert.equal(path.dirname(directory), path.join(ROOT, 'Projects'));
    await rm(directory, {recursive: true, force: true});
  });
  const bundle = {files: new Map([['/index.html', {contents: Buffer.from('<html>editor</html>'), type: 'text/html'}]])};
  const app = await createReviewServer({manifestPath, bundle, deps: {recordStudioEvent: record}});
  t.after(() => app.close());
  return {app, origin: new URL(app.url).origin};
}

test('only a successful authenticated editor project load counts use, once per server', async t => {
  const events = [];
  const {app, origin} = await review(t, async(root, event) => {events.push({root, event});});
  assert.equal((await fetch(app.url)).status, 200);
  assert.equal((await fetch(`${origin}/api/project`)).status, 401);
  assert.equal((await fetch(`${origin}/api/project?token=bad`)).status, 401);
  assert.deepEqual(events, []);
  const project = `${origin}/api/project?token=${app.token}`;
  assert.equal((await fetch(project)).status, 200);
  assert.equal((await fetch(project)).status, 200);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, [{root: ROOT, event: 'studio_used'}]);
});

test('a failed statistics collector never changes the editor response', async t => {
  const {app, origin} = await review(t, async() => {throw new Error('collector unavailable');});
  const response = await fetch(`${origin}/api/project?token=${app.token}`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).manifest.id.startsWith('stats-review-'), true);
  await new Promise(resolve => setImmediate(resolve));
});
