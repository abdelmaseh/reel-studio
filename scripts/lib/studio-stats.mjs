// Counts successful installs (a new version counts once) and daily use per version so the maintainer can see that updates arrive and work.
// Each event carries only schema, installationId (a random UUID created here, not derived from the user or the machine),
// event, version and occurredAt; never names, handles, media, files or paths. README (privacy) and the thank-you line at
// the end of setup tell the user. Network or local-state failures never affect the studio.
// REEL_STUDIO_STATS=off disables recording and sending absolutely; QA installs (verify-clean-install) set it so they are not counted.
import {randomUUID} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';

const ENDPOINT = 'https://store.pyraai.cloud/wp-json/reel-studio-stats/v1/events';
const MAX_AGE = 30 * 86400000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const enabled = options => process.env.REEL_STUDIO_STATS !== 'off' && (options.endpoint || !(process.env.CI || process.env.NODE_TEST_CONTEXT));
const nowOf = options => options.now ? options.now() : new Date();
const keyOf = event => `${event.event}:${event.version}:${event.occurredAt}`;
const fileOf = root => path.join(root, 'state/studio-stats.json');
const readJson = async(file) => JSON.parse(await fs.readFile(file, 'utf8'));

function retainOutbox(state, retained) {
  const remaining = new Set(retained);
  for (const event of state.outbox) {
    if (!remaining.has(event) && event.event === 'installed' && state.installed[event.version] === event.occurredAt) {
      delete state.installed[event.version]; // A dropped unsent install can be observed again; acknowledged installs stay marked.
    }
  }
  state.outbox = retained;
}

async function takeLock(file, waitMs) {
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      const handle = await fs.open(file, 'wx');
      await handle.close();
      return () => fs.rm(file, {force: true});
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const stat = await fs.stat(file).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > 10000) await fs.rm(file, {force: true});
      else if (Date.now() >= deadline) return null;
      else await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}

async function changeState(root, now, change) {
  const file = fileOf(root);
  await fs.mkdir(path.dirname(file), {recursive: true});
  const release = await takeLock(`${file}.lock`, 1000);
  if (!release) return null;
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const state = await readJson(file).catch(error => {
      if (error.code !== 'ENOENT') throw error;
      return {schema: 1, installationId: randomUUID(), installed: {}, used: {}, outbox: []};
    });
    if (state.schema !== 1 || !UUID.test(state.installationId) || !Array.isArray(state.outbox)) return null;
    state.installed ??= {}; state.used ??= {};
    retainOutbox(state, state.outbox.filter(event => event.schema === 1 && event.installationId === state.installationId
      && ['installed', 'studio_used'].includes(event.event) && VERSION.test(event.version ?? '')
      && event.version.length <= 64 && Number.isFinite(Date.parse(event.occurredAt)) && now - Date.parse(event.occurredAt) <= MAX_AGE).slice(-64));
    state.used = Object.fromEntries(Object.entries(state.used).filter(([, stamp]) => now - Date.parse(stamp) <= MAX_AGE));
    await change(state);
    await fs.writeFile(temporary, `${JSON.stringify(state)}\n`, 'utf8');
    await fs.rename(temporary, file);
    return state;
  } finally {
    await fs.rm(temporary, {force: true}).catch(() => {});
    await release();
  }
}

export async function recordStudioEvent(root, event, options = {}) {
  try {
    if (!enabled(options) || !['installed', 'studio_used'].includes(event)) return;
    const now = nowOf(options), version = (await readJson(path.join(root, 'versions.lock.json'))).edition;
    if (!VERSION.test(version ?? '') || version.length > 64) return;
    const ready = event === 'studio_used' && (await readJson(path.join(root, 'state/setup.json')).catch(() => null))?.status === 'done';
    await changeState(root, now, state => {
      for (const kind of ready ? ['installed', event] : [event]) {
        const markers = kind === 'installed' ? state.installed : state.used;
        const key = kind === 'installed' ? version : `${version}:${now.toISOString().slice(0, 10)}`;
        if (markers[key]) continue;
        const occurredAt = now.toISOString(); markers[key] = occurredAt;
        state.outbox.push({schema: 1, installationId: state.installationId, event: kind, version, occurredAt});
      }
      retainOutbox(state, state.outbox.slice(-64));
    });
    await flushStudioEvents(root, options);
  } catch {} // Counters cannot change the success/failure of setup, editing or export.
}

export async function flushStudioEvents(root, options = {}) {
  let release;
  try {
    if (!enabled(options)) return;
    await fs.mkdir(path.dirname(fileOf(root)), {recursive: true});
    release = await takeLock(`${fileOf(root)}.sending`, 0);
    if (!release) return;
    const state = await changeState(root, nowOf(options), () => {});
    if (!state?.outbox.length) return;
    const signal = AbortSignal.timeout(Math.max(1, Math.min(1000, options.timeoutMs ?? 1000)));
    const sent = new Set();
    for (const pending of state.outbox.slice(0, 4)) {
      const payload = {schema: 1, installationId: pending.installationId, event: pending.event, version: pending.version, occurredAt: pending.occurredAt};
      const body = JSON.stringify(payload);
      if (Buffer.byteLength(body) > 1024) continue;
      try {
        const response = await fetch(options.endpoint ?? ENDPOINT, {method: 'POST', headers: {'content-type': 'application/json'}, body, signal, redirect: 'error'});
        await response.body?.cancel();
        if (!response.ok) break;
        sent.add(keyOf(pending));
      } catch { break; }
    }
    if (sent.size) await changeState(root, nowOf(options), latest => {latest.outbox = latest.outbox.filter(event => !sent.has(keyOf(event)));});
  } catch {} finally { await release?.().catch(() => {}); }
}
