import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {verifyKineticAssets} from '../scripts/lib/prepared-props.mjs';
import {ROOT, run} from '../scripts/lib/media.mjs';

const source = {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 600};
const cut = {kind: 'cut'};
const chapter = (logo) => ({id: 'chapter-1', family: 'glide-chapter', fromFrame: 0, durationInFrames: 60, layout: 'takeover', motion: 'quiet',
  data: {ordinal: 'First', heroAt: 1, pill: {label: 'Example tool', logo}, enter: cut, exit: {kind: 'push', dir: 'right'}}});
const card = (clips) => ({id: 'card-1', family: 'glide-card', fromFrame: 60, durationInFrames: 90, layout: 'takeover', motion: 'quiet',
  data: {lines: [], media: {clips}, bullets: [], enter: cut, exit: cut}});

async function withFixtures(body) {
  const relative = `engine/public/projects/glide-assets-${randomUUID()}`, directory = path.resolve(ROOT, relative);
  assert.ok(directory.startsWith(path.resolve(ROOT, 'engine/public/projects') + path.sep));
  await fs.mkdir(directory, {recursive: true});
  try {
    const make = async (name, width, height, video) => {
      const file = path.join(directory, name);
      const input = ['-f', 'lavfi', '-i', `color=c=gray:s=${width}x${height}:r=30:d=${video ? 2 : 1}`];
      await run('ffmpeg', ['-v', 'error', '-y', ...input, ...(video ? ['-c:v', 'libx264', '-pix_fmt', 'yuv420p'] : ['-frames:v', '1']), file]);
      const bytes = await fs.readFile(file);
      return {src: `${relative.slice('engine/public/'.length)}/${name}`, sha256: createHash('sha256').update(bytes).digest('hex'), width, height};
    };
    await body({still: await make('still.png', 64, 36, false), logo: await make('logo.png', 32, 32, false), clip: await make('clip.mp4', 64, 36, true), relative});
  } finally { await fs.rm(directory, {recursive: true, force: true}); }
}

test('declared logo, still and video are verified against the real files', async () => {
  await withFixtures(async ({still, logo, clip}) => {
    const scenes = [chapter(logo), card([{at: 0, ...still, kind: 'image'}, {at: 30, ...clip, kind: 'video'}])];
    const assets = await verifyKineticAssets({source, scenes});
    assert.deepEqual(assets.map((asset) => asset.sha256), [logo.sha256, still.sha256, clip.sha256], 'every file takes part in preparation identity, in scene order');
    assert.deepEqual(assets.map((asset) => [asset.width, asset.height]), [[32, 32], [64, 36], [64, 36]]);
  });
});

test('wrong hashes, sizes and media kinds are refused', async () => {
  await withFixtures(async ({still, logo, clip}) => {
    const image = {at: 0, ...still, kind: 'image'};
    await assert.rejects(() => verifyKineticAssets({source, scenes: [chapter({...logo, width: 31})]}), /dimension/i);
    await assert.rejects(() => verifyKineticAssets({source, scenes: [chapter({...logo, sha256: 'b'.repeat(64)})]}), /hash|bytes/i);
    await assert.rejects(() => verifyKineticAssets({source, scenes: [card([{...image, sha256: 'b'.repeat(64)}])]}), /hash|bytes/i);
    await assert.rejects(() => verifyKineticAssets({source, scenes: [card([{...image, height: 35}])]}), /dimension/i);
    await assert.rejects(() => verifyKineticAssets({source, scenes: [card([{at: 0, ...clip, kind: 'image'}])]}), /image/i, 'a video declared as an image');
    await assert.rejects(() => verifyKineticAssets({source, scenes: [card([{at: 0, ...still, kind: 'video'}])]}), /video/i, 'an image declared as a video');
  });
});

test('a missing file or a video that is too short for its clip window is refused', async () => {
  await withFixtures(async ({still, clip, relative}) => {
    const missing = {src: `${relative.slice('engine/public/'.length)}/gone.png`, sha256: 'c'.repeat(64), width: 64, height: 36};
    await assert.rejects(() => verifyKineticAssets({source, scenes: [card([{at: 0, ...missing, kind: 'image'}])]}), /missing|ENOENT|exist|not found/i);
    const tooShort = card([{at: 0, ...still, kind: 'image'}, {at: 10, ...clip, kind: 'video'}]); // 80 frames needed, the file has 60
    await assert.rejects(() => verifyKineticAssets({source, scenes: [tooShort]}), /too short/i);
  });
});
