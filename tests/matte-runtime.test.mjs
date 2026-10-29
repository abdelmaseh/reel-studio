import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, promises as fs} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  MATTE_SETTINGS, alphaFromConfidence, attachForeground, boxBlur, decodeArgs, evenSize, foregroundRecord, matteKey, mattePaths,
  mergeArgs, alphaEncodeArgs, personConfidence, pickPersonMask, planMatteRange, refineAlpha, standInSpeakerMask,
} from '../scripts/lib/matte-core.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FFMPEG = path.join(ROOT, 'Tools', 'bin', 'ffmpeg.exe');
const HAVE_FFMPEG = existsSync(FFMPEG);

test('a size keeps the source aspect, stays even and never grows past the source', () => {
  assert.deepEqual(evenSize(1080, 1920, 540), {width: 540, height: 960});
  assert.deepEqual(evenSize(1080, 1920, 1080), {width: 1080, height: 1920});
  assert.deepEqual(evenSize(2160, 3840, 1080), {width: 1080, height: 1920});
  assert.deepEqual(evenSize(720, 1280, 1080), {width: 720, height: 1280}, 'a small source is not scaled up');
  const odd = evenSize(1079, 1919, 540);
  assert.equal(odd.width % 2, 0);
  assert.equal(odd.height % 2, 0);
  assert.throws(() => evenSize(1080, 1920, 3), /even/);
});

test('the matte range must sit inside the source and hold at least one frame', () => {
  assert.deepEqual(planMatteRange({totalFrames: 900}), {startFrame: 0, frames: 900});
  assert.deepEqual(planMatteRange({totalFrames: 900, startFrame: 100, frames: 300}), {startFrame: 100, frames: 300});
  assert.deepEqual(planMatteRange({totalFrames: 900, startFrame: 600}), {startFrame: 600, frames: 300});
  assert.throws(() => planMatteRange({totalFrames: 900, startFrame: 800, frames: 200}), /inside the source/);
  assert.throws(() => planMatteRange({totalFrames: 900, startFrame: -1, frames: 10}), /start frame/);
  assert.throws(() => planMatteRange({totalFrames: 900, startFrame: 0, frames: 0}), /at least one frame/);
  assert.throws(() => planMatteRange({totalFrames: 900, frames: 99999}), /too long|inside the source/);
});

test('the person mask is the inverse of a background mask and the direct one otherwise', () => {
  assert.deepEqual(pickPersonMask(['background', 'selfie'], 2), {index: 0, invert: true});
  assert.deepEqual(pickPersonMask(['background', 'hair', 'body-skin', 'face-skin', 'clothes', 'others'], 6), {index: 0, invert: true});
  assert.deepEqual(pickPersonMask(['person'], 1), {index: 0, invert: false});
  assert.deepEqual(pickPersonMask([], 1), {index: 0, invert: false});
  assert.deepEqual(pickPersonMask([], 2), {index: 0, invert: true}, 'unnamed pair: the first mask is the background');
  assert.throws(() => pickPersonMask([], 0), /no mask/);
});

test('confidence becomes a byte and the invert flag flips it', () => {
  const direct = personConfidence([Float32Array.from([0, 0.5, 1, 1.4, -0.2])], {index: 0, invert: false}, new Uint8Array(5));
  assert.deepEqual([...direct], [0, 128, 255, 255, 0]);
  const inverted = personConfidence([Float32Array.from([1, 0.5, 0])], {index: 0, invert: true}, new Uint8Array(3));
  assert.deepEqual([...inverted], [0, 128, 255]);
});

test('the alpha curve is closed below the floor, open above the ceiling and smooth in between', () => {
  const conf = Uint8Array.from([0, 40, 77, 128, 180, 200, 255]);
  const alpha = alphaFromConfidence(conf, new Uint8Array(conf.length), {low: 0.3, high: 0.78});
  assert.equal(alpha[0], 0);
  assert.equal(alpha[1], 0, '0.16 is under the floor');
  assert.equal(alpha[6], 255);
  assert.equal(alpha[5], 255, '0.78 and over is solid');
  assert.ok(alpha[3] > 0 && alpha[3] < 255 && alpha[4] > alpha[3], 'monotonic soft edge');
});

test('blur spreads a hard edge, keeps a flat area flat and keeps the size', () => {
  const w = 8, h = 4;
  const hard = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 4; x < w; x++) hard[y * w + x] = 255;
  const soft = boxBlur(hard, w, h, 1, new Uint8Array(w * h));
  assert.equal(soft.length, w * h);
  assert.equal(soft[1 * w + 0], 0, 'far from the edge stays closed');
  assert.equal(soft[1 * w + 7], 255, 'far from the edge stays open');
  assert.ok(soft[1 * w + 3] > 0 && soft[1 * w + 3] < 255 && soft[1 * w + 4] > 0 && soft[1 * w + 4] < 255, 'the edge is soft');
  const flat = boxBlur(new Uint8Array(w * h).fill(200), w, h, 2, new Uint8Array(w * h));
  assert.ok(flat.every((v) => v === 200));
  assert.deepEqual([...boxBlur(hard, w, h, 0, new Uint8Array(w * h))], [...hard], 'radius 0 changes nothing');
});

test('temporal smoothing calms small flicker and follows a real move at once', () => {
  const w = 4, h = 1, settings = {...MATTE_SETTINGS, blur: 0};
  const prev = Uint8Array.from([100, 100, 0, 255]);
  const raw = Uint8Array.from([120, 100, 255, 0]);
  const out = refineAlpha(raw, prev, w, h, settings);
  assert.ok(out[0] > 100 && out[0] < 120, 'a small change is eased');
  assert.equal(out[1], 100);
  assert.equal(out[2], 255, 'a person stepping in appears at once');
  assert.equal(out[3], 0, 'and stepping out disappears at once');
  assert.deepEqual([...refineAlpha(raw, null, w, h, settings)], [...raw], 'the first frame has nothing to ease from');
});

test('the output name depends on the source, the range, the size and the settings', () => {
  const base = {sourceSha256: 'a'.repeat(64), startFrame: 0, frames: 90, width: 1080, height: 1920, fps: '30/1', settings: MATTE_SETTINGS, model: 'sha-1'};
  const key = matteKey(base);
  assert.match(key, /^[a-f0-9]{16}$/);
  assert.equal(matteKey({...base}), key);
  for (const change of [{startFrame: 3}, {frames: 91}, {width: 540}, {model: 'sha-2'}, {fps: '25/1'}, {sourceSha256: 'b'.repeat(64)}, {settings: {...MATTE_SETTINGS, blur: 2}}]) {
    assert.notEqual(matteKey({...base, ...change}), key, JSON.stringify(Object.keys(change)));
  }
  const {src, file} = mattePaths('my-edit', key);
  assert.equal(src, `_prepared/my-edit/matte-${key}.webm`);
  assert.equal(file, `engine/public/_prepared/my-edit/matte-${key}.webm`);
  assert.throws(() => mattePaths('Bad Name', key), /slug/);
});

test('a foreground record matches the schema the scenes read', async () => {
  const {foregroundSchema} = await import('../engine/src/creative-kit/kinetic/schema.ts');
  const record = foregroundRecord({src: '_prepared/x/matte-0123456789abcdef.webm', sourceSha256: 'c'.repeat(64), sourceFromFrame: 30, frames: 120});
  assert.deepEqual(record, {src: '_prepared/x/matte-0123456789abcdef.webm', sourceSha256: 'c'.repeat(64), sourceFromFrame: 30, frames: 120, trimBeforeFrame: 0});
  assert.deepEqual(foregroundSchema.parse(record), record);
});

const manifest = (over = {}) => ({
  source: {sha256: 'c'.repeat(64), fps: 30, totalFrames: 600},
  segments: [{fromFrame: 0, toFrame: 100}, {fromFrame: 160, toFrame: 400}],
  scenes: [
    {id: 'hook', family: 'layered-speaker', fromFrame: 10, durationInFrames: 60, data: {}},
    {id: 'later', family: 'layered-speaker', fromFrame: 120, durationInFrames: 60, data: {foreground: {src: 'old.webm'}}},
    {id: 'other', family: 'intro', fromFrame: 200, durationInFrames: 30, data: {}},
  ],
  ...over,
});
const record = (over = {}) => foregroundRecord({src: '_prepared/x/matte-0123456789abcdef.webm', sourceSha256: 'c'.repeat(64), sourceFromFrame: 0, frames: 600, ...over});

test('attaching a matte lines its first frame up with the scene start in the source', () => {
  const first = attachForeground(manifest(), 'hook', record());
  assert.equal(first.trimBeforeFrame, 10);
  assert.equal(first.manifest.scenes[0].data.foreground.trimBeforeFrame, 10);
  assert.equal(first.manifest.scenes[0].data.foreground.sourceFromFrame, 0);
  // Output frame 120 is the 20th frame of the second segment: source frame 180.
  const second = attachForeground(manifest(), 'later', record());
  assert.equal(second.trimBeforeFrame, 180);
  assert.deepEqual(manifest().scenes[1].data.foreground, {src: 'old.webm'}, 'the input is not changed');
  const offset = attachForeground(manifest(), 'hook', record({sourceFromFrame: 5, frames: 595}));
  assert.equal(offset.trimBeforeFrame, 5);
});

test('attaching refuses a wrong source, a wrong scene and a matte that does not cover the scene', () => {
  assert.throws(() => attachForeground(manifest(), 'hook', record({sourceSha256: 'd'.repeat(64)})), /another source/);
  assert.throws(() => attachForeground(manifest(), 'missing', record()), /no scene/);
  assert.throws(() => attachForeground(manifest(), 'other', record()), /does not take a foreground/);
  assert.throws(() => attachForeground(manifest(), 'hook', record({sourceFromFrame: 40, frames: 100})), /does not cover/);
  assert.throws(() => attachForeground(manifest(), 'later', record({frames: 150})), /does not cover/);
  const cut = manifest({scenes: [{id: 'span', family: 'layered-speaker', fromFrame: 80, durationInFrames: 60, data: {}}]});
  assert.throws(() => attachForeground(cut, 'span', record()), /cut/, 'a scene may not run across a cut: the matte would drift from the picture');
});

test('the ffmpeg commands are built from the plan and never from free text', () => {
  const decode = decodeArgs({input: 'in.mov', startFrame: 12, frames: 30, width: 540, height: 960, fps: '30000/1001'});
  assert.ok(decode.includes('pipe:1'));
  assert.match(decode.join(' '), /trim=start_frame=12:end_frame=42/);
  assert.match(decode.join(' '), /scale=540:960/);
  assert.match(decode.join(' '), /format=rgba/);
  const alpha = alphaEncodeArgs({width: 540, height: 960, fps: '30000/1001', out: 'alpha.mkv'});
  assert.match(alpha.join(' '), /-f rawvideo -pix_fmt gray -s 540x960 -framerate 30000\/1001 -i pipe:0/);
  assert.ok(alpha.includes('ffv1'));
  const merge = mergeArgs({input: 'in.mov', alpha: 'alpha.mkv', startFrame: 12, frames: 30, width: 1080, height: 1920, fps: '30000/1001', out: 'out.webm', crf: 24});
  const joined = merge.join(' ');
  assert.match(joined, /alphamerge/);
  assert.match(joined, /libvpx-vp9/);
  assert.match(joined, /yuva420p/);
  assert.match(joined, /alpha_mode=1/);
  assert.match(joined, /setpts=N\/\(\(30000\/1001\)\*TB\)/, 'both streams get the same regular timestamps');
  assert.throws(() => decodeArgs({input: 'in.mov', startFrame: 0, frames: 10, width: 541, height: 960, fps: '30/1'}), /even/);
  assert.throws(() => decodeArgs({input: 'in.mov', startFrame: 0, frames: 10, width: 540, height: 960, fps: '30; rm -rf'}), /fps/);
});

test('the stand-in speaker is a head and shoulders shape inside the frame', () => {
  const {width, height} = {width: 54, height: 96};
  const mask = standInSpeakerMask({width, height});
  assert.equal(mask.length, width * height);
  const at = (x, y) => mask[y * width + x];
  assert.equal(at(27, 36), 255, 'the head');
  assert.equal(at(27, 80), 255, 'the shoulders');
  assert.equal(at(2, 2), 0, 'the corner is open');
  assert.equal(at(2, 80), 0, 'beside the shoulders is open');
});

test('the whole matte pipeline makes a playable alpha clip with the right frames, size and cadence', {skip: HAVE_FFMPEG ? false : 'ffmpeg is not installed here'}, async (t) => {
  const runtime = await import('../scripts/lib/matte-runtime.mjs');
  const project = 'matte-test';
  const work = path.join(ROOT, 'state', 'tmp', `matte-test-${process.pid}`);
  await fs.mkdir(work, {recursive: true});
  const source = path.join(work, 'source.mp4');
  // A 12-frame 30 fps 270x480 clip: the content does not matter, the segmenter below stands in for the model.
  const made = spawnSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=270x480:rate=30', '-frames:v', '12', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-g', '4', source], {encoding: 'utf8', windowsHide: true});
  assert.equal(made.status, 0, made.stderr);
  const outDir = path.join(ROOT, 'engine', 'public', '_prepared', project);
  t.after(async () => {
    await fs.rm(work, {recursive: true, force: true});
    await fs.rm(outDir, {recursive: true, force: true});
  });
  const result = await runtime.makeMatteFromFile({
    sourceAbsolute: source, project, startFrame: 2, frames: 8, outWidth: 270, analysisWidth: 54,
    segmenter: {id: 'test-ellipse', async open() {}, async close() {}, async segment(frames, size) { return frames.map(() => standInSpeakerMask(size)); }},
    log: () => {},
  });
  assert.match(result.foreground.src, /^_prepared\/matte-test\/matte-[a-f0-9]{16}\.webm$/);
  assert.equal(result.foreground.frames, 8);
  assert.equal(result.foreground.sourceFromFrame, 2);
  assert.equal(result.foreground.trimBeforeFrame, 0);
  assert.equal(result.width, 270);
  assert.equal(result.height, 480);
  assert.equal(result.cached, false);
  const file = path.join(ROOT, 'engine', 'public', result.foreground.src);
  const probe = spawnSync(path.join(ROOT, 'Tools', 'bin', 'ffprobe.exe'), ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames,width,height,avg_frame_rate,codec_name:stream_tags=alpha_mode', '-of', 'json', file], {encoding: 'utf8', windowsHide: true});
  const stream = JSON.parse(probe.stdout).streams[0];
  assert.equal(Number(stream.nb_read_frames), 8);
  assert.equal(stream.width, 270);
  assert.equal(stream.height, 480);
  assert.equal(stream.avg_frame_rate, '30/1');
  assert.equal(stream.tags?.ALPHA_MODE ?? stream.tags?.alpha_mode, '1');
  // The alpha really has a transparent background and a visible subject.
  const alpha = spawnSync(FFMPEG, ['-v', 'error', '-c:v', 'libvpx-vp9', '-i', file, '-vf', 'alphaextract', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'], {encoding: 'buffer', windowsHide: true, maxBuffer: 1 << 24});
  assert.equal(alpha.status, 0, String(alpha.stderr));
  assert.equal(alpha.stdout.length, 270 * 480);
  assert.equal(alpha.stdout[0], 0, 'the corner is transparent');
  assert.equal(alpha.stdout[(300 * 270) + 135] > 200, true, 'the body is opaque');
  // A render links the matte into its bundle (a second name for the same file); finding it again must not need to write it.
  await fs.link(file, `${file}.bundle-link`);
  // A second call finds the finished file instead of making it again.
  const again = await runtime.makeMatteFromFile({sourceAbsolute: source, project, startFrame: 2, frames: 8, outWidth: 270, analysisWidth: 54,
    segmenter: {id: 'test-ellipse', async open() {}, async close() {}, async segment() { throw new Error('should not run'); }}, log: () => {}});
  assert.equal(again.cached, true);
  assert.deepEqual(again.foreground, result.foreground);
  // The record plugs into a manifest.
  assert.equal(JSON.parse(await fs.readFile(`${file}.matte.json`, "utf8")).range.frames, 8);
});

test('the model file is pinned by name and only runs once it is on disk and verified', async () => {
  const runtime = await import('../scripts/lib/matte-runtime.mjs');
  const model = runtime.MATTE_MODEL;
  assert.equal(model.path, 'Tools/models/selfie-segmenter-v1/selfie_segmenter.tflite');
  assert.match(model.url, /^https:\/\/storage\.googleapis\.com\/mediapipe-models\/image_segmenter\/selfie_segmenter\//);
  assert.equal(model.license, 'Apache-2.0');
  const status = await runtime.matteModelStatus();
  assert.ok(['missing', 'unpinned', 'mismatch', 'ok'].includes(status.state), status.state);
  if (status.state === 'missing') {
    await assert.rejects(runtime.requireMatteModel(), /selfie_segmenter\.tflite is not installed/);
    assert.match(status.message, /Download requests|node scripts\/matte\.mjs/);
  }
});

const modelPresent = existsSync(path.join(ROOT, 'Tools', 'models', 'selfie-segmenter-v1', 'selfie_segmenter.tflite'));
test('the browser segmenter returns one person mask per frame, sized like the frame', {skip: modelPresent && HAVE_FFMPEG ? false : 'the MediaPipe selfie segmenter model is not downloaded yet'}, async () => {
  const runtime = await import('../scripts/lib/matte-runtime.mjs');
  const segmenter = await runtime.createBrowserSegmenter({log: () => {}});
  try {
    const width = 144, height = 256;
    const rgba = new Uint8Array(width * height * 4).fill(128);
    const masks = await segmenter.segment([rgba, rgba], {width, height});
    assert.equal(masks.length, 2);
    for (const mask of masks) {
      assert.equal(mask.length, width * height);
      assert.ok(mask instanceof Uint8Array);
    }
  } finally {
    await segmenter.close();
  }
});

test('the pins file and versions.lock.json agree about the model once the lock lists it', async () => {
  const runtime = await import('../scripts/lib/matte-runtime.mjs');
  const lock = JSON.parse(await fs.readFile(path.join(ROOT, 'versions.lock.json'), 'utf8'));
  const entry = lock.models.find((model) => model.id === runtime.MATTE_MODEL.id);
  // The lock entry is added after the owner-approved download is measured; until then the pins are empty on purpose.
  if (!entry) {
    assert.equal(runtime.MATTE_MODEL.sha256, null);
    assert.equal(runtime.MATTE_MODEL.bytes, null);
    return;
  }
  assert.equal(entry.path, runtime.MATTE_MODEL.path);
  assert.equal(entry.url, runtime.MATTE_MODEL.url);
  assert.equal(entry.sha256, runtime.MATTE_MODEL.sha256);
  assert.equal(entry.bytes, runtime.MATTE_MODEL.bytes);
  assert.equal(entry.license, 'Apache-2.0');
});
