import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {promises as fs} from 'node:fs';
import {ROOT} from '../lib/project-paths.mjs';
import {recordStudioEvent, flushStudioEvents} from '../lib/studio-stats.mjs';

async function fixture(t, handler) {
  await fs.mkdir(path.join(ROOT, 'state/tmp'), {recursive: true});
  const root = await fs.mkdtemp(path.join(ROOT, 'state/tmp/studio-stats-test-'));
  await fs.writeFile(path.join(root, 'versions.lock.json'), JSON.stringify({edition: '2.3.0'}));
  const events = [];
  const server = http.createServer(async(req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    events.push({value: JSON.parse(body), bytes: Buffer.byteLength(body), method: req.method});
    if (handler) return handler(req, res);
    res.writeHead(202); res.end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async() => {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(root), path.join(ROOT, 'state/tmp'));
    await fs.rm(root, {recursive: true, force: true});
  });
  return {root, events, server, options: {endpoint: `http://127.0.0.1:${server.address().port}/events`, now: () => new Date('2026-10-13T08:00:00.000Z')}};
}

test('success events send only anonymous counters and deduplicate installs and daily use', async t => {
  const {root, events, options} = await fixture(t);
  await fs.writeFile(path.join(root, 'PROFILE.json'), JSON.stringify({name: 'Private Name', handle: '@private'}));
  for (const event of ['installed', 'installed', 'studio_used', 'studio_used']) await recordStudioEvent(root, event, options);
  assert.deepEqual(events.map(row => row.value.event), ['installed', 'studio_used']);
  const identity = events[0].value.installationId;
  assert.match(identity, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  for (const {value, bytes, method} of events) {
    assert.equal(method, 'POST'); assert.ok(bytes <= 1024);
    assert.deepEqual(Object.keys(value).sort(), ['event', 'installationId', 'occurredAt', 'schema', 'version']);
    assert.equal(value.installationId, identity); assert.equal(value.schema, 1);
    assert.equal(value.version, '2.3.0'); assert.equal(value.occurredAt, '2026-10-13T08:00:00.000Z');
    assert.ok(!JSON.stringify(value).includes('Private Name'));
  }
  await recordStudioEvent(root, 'studio_used', {...options, now: () => new Date('2026-10-14T08:00:00.000Z')});
  await fs.writeFile(path.join(root, 'versions.lock.json'), JSON.stringify({edition: '2.3.1'}));
  await recordStudioEvent(root, 'installed', options);
  assert.equal(events.length, 4); assert.equal(events[3].value.version, '2.3.1');
  assert.equal(events[3].value.installationId, identity, 'an upgrade keeps the original installation');
});

test('failed delivery queues the original timestamp and a later flush acknowledges it', async t => {
  let offline = true;
  const {root, events, options} = await fixture(t, (_req, res) => {res.writeHead(offline ? 503 : 202); res.end('{}');});
  await recordStudioEvent(root, 'installed', options);
  offline = false;
  await flushStudioEvents(root, {...options, now: () => new Date('2026-10-14T08:00:00.000Z')});
  assert.equal(events.length, 2); assert.deepEqual(events[1].value, events[0].value);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'state/studio-stats.json'), 'utf8')).outbox, []);
  await flushStudioEvents(root, options); assert.equal(events.length, 2);
});

test('timeout stays bounded and old offline events expire before sending', async t => {
  const {root, events, options} = await fixture(t, () => {});
  const started = performance.now();
  await recordStudioEvent(root, 'installed', {...options, timeoutMs: 80});
  assert.ok(performance.now() - started < 1000, 'collector cannot hold up the studio');
  await flushStudioEvents(root, {...options, now: () => new Date('2026-11-14T08:00:00.000Z'), timeoutMs: 80});
  assert.equal(events.length, 1, 'expired events are never replayed');
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'state/studio-stats.json'), 'utf8')).outbox, []);
});

test('concurrent callers keep one stable identity and never lose distinct event state', async t => {
  const {root, events, options} = await fixture(t);
  await Promise.all(Array.from({length: 12}, (_, index) => recordStudioEvent(root, index % 2 ? 'installed' : 'studio_used', options)));
  await flushStudioEvents(root, options);
  assert.equal(new Set(events.map(row => row.value.installationId)).size, 1);
  const unique = new Set(events.map(row => `${row.value.event}:${row.value.occurredAt}`));
  assert.deepEqual([...unique].sort(), ['installed:2026-10-13T08:00:00.000Z', 'studio_used:2026-10-13T08:00:00.000Z']);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'state/studio-stats.json'), 'utf8')).outbox, []);
});

test('meaningful use observes an existing complete install without collecting profile data', async t => {
  const {root, events, options} = await fixture(t);
  await fs.mkdir(path.join(root, 'state'), {recursive: true});
  await fs.writeFile(path.join(root, 'state/setup.json'), JSON.stringify({status: 'done'}));
  await recordStudioEvent(root, 'studio_used', options);
  assert.deepEqual(events.map(row => row.value.event), ['installed', 'studio_used']);
});

test('invalid events, corrupt state and unwritable locations stay silent', async t => {
  const {root, events, options} = await fixture(t);
  await recordStudioEvent(root, 'profile_saved', options);
  await fs.mkdir(path.join(root, 'state'), {recursive: true});
  await fs.writeFile(path.join(root, 'state/studio-stats.json'), '{broken');
  await recordStudioEvent(root, 'installed', options);
  await flushStudioEvents(root, options);
  const blocked = path.join(root, 'blocked');
  await fs.mkdir(blocked);
  await fs.copyFile(path.join(root, 'versions.lock.json'), path.join(blocked, 'versions.lock.json'));
  await fs.writeFile(path.join(blocked, 'state'), 'a file blocks the state directory');
  await recordStudioEvent(blocked, 'installed', options);
  await flushStudioEvents(blocked, options);
  assert.equal(events.length, 0);
});

test('offline retries keep the persistent outbox bounded', async t => {
  const {root, options} = await fixture(t, (_req, res) => {res.writeHead(503); res.end('{}');});
  for (let version = 0; version < 70; version += 1) {
    await fs.writeFile(path.join(root, 'versions.lock.json'), JSON.stringify({edition: `3.${version}.0`}));
    await recordStudioEvent(root, 'installed', options);
  }
  const state = JSON.parse(await fs.readFile(path.join(root, 'state/studio-stats.json'), 'utf8'));
  assert.equal(state.outbox.length, 64);
  assert.equal(state.outbox.at(-1).version, '3.69.0', 'recent events survive an extended outage');
});

test('an expired unacknowledged install is observed again on meaningful ready use', async t => {
  let offline = true;
  const {root, events, options} = await fixture(t, (_req, res) => {res.writeHead(offline ? 503 : 202); res.end('{}');});
  await fs.mkdir(path.join(root, 'state'), {recursive: true});
  await fs.writeFile(path.join(root, 'state/setup.json'), JSON.stringify({status: 'done'}));
  await recordStudioEvent(root, 'installed', {...options, now: () => new Date('2026-10-01T08:00:00.000Z')});
  offline = false;
  const resumed = {...options, now: () => new Date('2026-11-02T08:00:00.000Z')};
  await recordStudioEvent(root, 'studio_used', resumed);
  assert.deepEqual(events.slice(1).map(row => row.value.event), ['installed', 'studio_used']);
  assert.equal(events[1].value.occurredAt, '2026-11-02T08:00:00.000Z', 'the refreshed event meets the collector age limit');
  assert.equal(events[1].value.installationId, events[0].value.installationId);
  await recordStudioEvent(root, 'installed', resumed);
  assert.equal(events.length, 3, 'an acknowledged install stays deduplicated');
});

test('an install evicted by the outbox cap may be observed again without resetting acknowledged installs', async t => {
  let offline = false;
  const {root, events, options} = await fixture(t, (_req, res) => {res.writeHead(offline ? 503 : 202); res.end('{}');});
  await recordStudioEvent(root, 'installed', options);
  offline = true;
  for (let version = 0; version < 65; version += 1) {
    await fs.writeFile(path.join(root, 'versions.lock.json'), JSON.stringify({edition: `3.${version}.0`}));
    await recordStudioEvent(root, 'installed', options);
  }
  const file = path.join(root, 'state/studio-stats.json');
  const state = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(state.installed['3.0.0'], undefined, 'an unsent evicted installation is not marked acknowledged');
  assert.equal(state.installed['2.3.0'], '2026-10-13T08:00:00.000Z', 'the successfully sent installation stays marked');
  await fs.writeFile(path.join(root, 'versions.lock.json'), JSON.stringify({edition: '3.0.0'}));
  await fs.writeFile(path.join(root, 'state/setup.json'), JSON.stringify({status: 'done'}));
  await recordStudioEvent(root, 'studio_used', {...options, now: () => new Date('2026-10-14T08:00:00.000Z')});
  const recovered = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(recovered.installed['3.0.0'], '2026-10-14T08:00:00.000Z');
  assert.ok(recovered.outbox.some(event => event.event === 'installed' && event.version === '3.0.0'));
  offline = false;
  for (let attempt = 0; attempt < 16; attempt += 1) await flushStudioEvents(root, options);
  assert.ok(events.some(row => row.value.event === 'installed' && row.value.version === '3.0.0' && row.value.occurredAt === '2026-10-14T08:00:00.000Z'));
});
