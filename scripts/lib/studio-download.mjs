import {createHash} from 'node:crypto';
import {createReadStream, createWriteStream, promises as fs} from 'node:fs';
import path from 'node:path';
import {Readable, Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export async function sha256File(file) {
  const stat = await fs.stat(file).catch(() => null);
  if (!stat || !stat.isFile()) return null;
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

// 30 minutes, or the time a 200 KB/s connection needs, whichever is longer: the 1.5 GB model must not time out on a slow line.
export const downloadTimeoutMs = bytes => Math.max(30 * 60 * 1000, Math.ceil((bytes ?? 0) / 200_000) * 1000);

// Antivirus may hold a freshly written file for a moment; retry only that kind of error so the verified download is kept.
const LOCKED = new Set(['EPERM', 'EBUSY', 'EACCES']);
export async function renameWithRetry(from, to, {rename = fs.rename, tries = 10, delayMs = 500} = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try { return await rename(from, to); }
    catch (error) {
      if (!LOCKED.has(error.code) || attempt >= tries) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

export async function downloadVerified({url, sha256, bytes = null, target, timeoutMs = downloadTimeoutMs(bytes)}) {
  if ((await sha256File(target)) === sha256) return {cached: true, target};
  await fs.mkdir(path.dirname(target), {recursive: true});
  const partial = `${target}.partial`;
  await fs.rm(partial, {force: true});
  try {
    const response = await fetch(url, {signal: AbortSignal.timeout(timeoutMs)});
    if (!response.ok || !response.body) throw new Error(`Download failed (HTTP ${response.status}): ${url}`);
    const hash = createHash('sha256');
    let size = 0;
    const meter = new Transform({
      transform(chunk, _encoding, callback) {
        hash.update(chunk);
        size += chunk.length;
        callback(null, chunk);
      },
    });
    await pipeline(Readable.fromWeb(response.body), meter, createWriteStream(partial));
    const actual = hash.digest('hex');
    if (actual !== sha256) throw new Error(`Downloaded file failed its SHA-256 check (expected ${sha256}, got ${actual}): ${url}`);
    if (bytes !== null && size !== bytes) throw new Error(`Downloaded file has ${size} bytes, expected ${bytes}: ${url}`);
    await renameWithRetry(partial, target, {tries: 30, delayMs: 1000}); // Antivirus may hold a large fresh file for a while.
    return {cached: false, target, bytes: size};
  } finally {
    await fs.rm(partial, {force: true});
  }
}
