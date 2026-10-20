import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {ROOT, run} from '../../scripts/lib/media.mjs';
import {addClip} from '../../scripts/lib/clips.mjs';

/**
 * A throwaway project holding one real, normalised 3 s portrait clip at 30 fps (`clip`, as `addClip` returns it), plus `raw(name, inputs, output)`
 * to stage more files in the same public folder and get their `{src, sha256}`. Everything is removed after the test.
 */
export async function realClip(t, {name = 'clip-fixture'} = {}) {
  const id = `${name}-${randomUUID().slice(0, 8)}`;
  const dir = path.join(ROOT, 'Projects', id);
  const staged = path.join(ROOT, 'engine', 'public', 'projects', id);
  await fs.mkdir(path.join(dir, 'source'), {recursive: true});
  await fs.mkdir(path.join(dir, 'fixtures'), {recursive: true});
  await fs.mkdir(staged, {recursive: true});
  await fs.writeFile(path.join(dir, 'source', 'intake.json'), JSON.stringify({version: 1, deliveryFps: 30}));
  t.after(async () => {
    assert.equal(path.dirname(dir), path.join(ROOT, 'Projects'));
    assert.equal(path.dirname(staged), path.join(ROOT, 'engine', 'public', 'projects'));
    await fs.rm(dir, {recursive: true, force: true});
    await fs.rm(staged, {recursive: true, force: true});
  });
  await run('ffmpeg', ['-hide_banner', '-nostats', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(dir, 'fixtures', 'a.mp4')]);
  const {clip} = await addClip({project: id, file: `Projects/${id}/fixtures/a.mp4`, label: 'Desk', licence: 'creator-supplied (own footage)'});
  const raw = async (fileName, inputs, output) => {
    await run('ffmpeg', ['-hide_banner', '-nostats', '-v', 'error', '-y', ...inputs, ...output, path.join(staged, fileName)]);
    return {src: `projects/${id}/${fileName}`, sha256: createHash('sha256').update(await fs.readFile(path.join(staged, fileName))).digest('hex')};
  };
  return {id, clip, raw};
}
