import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ROOT, ffprobeJson, run, summarizeProbe} from '../scripts/lib/media.mjs';
import {BT709_TAGS, HDR_TRANSFERS, ratio} from '../scripts/lib/intake.mjs';
import {addClip, clipFilter, clipId, planClipScale, planClipWindow, readClipIndex} from '../scripts/lib/clips.mjs';

const exec = promisify(execFile);
const ffmpeg = (...args) => run('ffmpeg', ['-hide_banner', '-nostats', '-v', 'error', '-y', ...args]);
const LICENCE = 'creator-supplied (own footage)';
const HLG_TAGS = 'format=yuv420p,setparams=color_primaries=bt2020:color_trc=arib-std-b67:colorspace=bt2020nc:range=tv';
const sha = async (relative) => createHash('sha256').update(await fs.readFile(path.join(ROOT, ...relative.split('/')))).digest('hex');

async function workspace(t, {intake = 30} = {}) {
  const id = `clips-test-${randomUUID().slice(0, 8)}`;
  const dir = path.join(ROOT, 'Projects', id);
  const staged = path.join(ROOT, 'engine', 'public', 'projects', id);
  await fs.mkdir(path.join(dir, 'source'), {recursive: true});
  await fs.mkdir(path.join(dir, 'fixtures'), {recursive: true});
  if (intake) await fs.writeFile(path.join(dir, 'source', 'intake.json'), JSON.stringify({version: 1, deliveryFps: intake}));
  t.after(async () => {
    assert.equal(path.dirname(dir), path.join(ROOT, 'Projects'));
    assert.equal(path.dirname(staged), path.join(ROOT, 'engine', 'public', 'projects'));
    await fs.rm(dir, {recursive: true, force: true});
    await fs.rm(staged, {recursive: true, force: true});
  });
  const make = async (name, inputs, output) => {
    await ffmpeg(...inputs, ...output, path.join(dir, 'fixtures', name));
    return `Projects/${id}/fixtures/${name}`;
  };
  return {
    id, project: `Projects/${id}`, dir, make,
    portrait: () => make('portrait.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=3'], ['-c:v', 'libx264', '-pix_fmt', 'yuv420p']),
    landscapeWithAudio: () => make('landscape.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=24:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3'],
      ['-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p', '-shortest']),
    // No -shortest: the 3.6 s audio track outlasts the 3 s picture, so the container reports 3.6 s.
    audioTail: () => make('tail.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3.6'],
      ['-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p']),
    // Matroska reports no duration for its streams, only for the container.
    mkv: () => make('portrait.mkv', ['-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=3'], ['-c:v', 'libx264', '-pix_fmt', 'yuv420p']),
    uhd: () => make('uhd.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=3840x2160:rate=25:duration=2'], ['-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p']),
    // A landscape picture whose display matrix asks for a 90 degree turn, as phones write portrait footage: the stored pixels stay 1920x1080.
    rotated: async () => {
      const flat = await make('landscape-flat.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30:duration=3'], ['-c:v', 'libx264', '-pix_fmt', 'yuv420p']);
      return {flat, file: await make('rotated.mp4', ['-display_rotation', '90', '-i', path.join(ROOT, ...flat.split('/'))], ['-c', 'copy'])};
    },
    hlg: () => make('hlg.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=540x960:rate=30:duration=2'],
      ['-vf', HLG_TAGS, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt2020', '-color_trc', 'arib-std-b67', '-colorspace', 'bt2020nc']),
  };
}

const stagedProbe = async (src) => {
  const probe = await ffprobeJson(path.join(ROOT, 'engine', 'public', src));
  return {video: probe.streams.find((s) => s.codec_type === 'video'), audio: probe.streams.filter((s) => s.codec_type === 'audio').length};
};
const stagedFile = (clip) => path.join(ROOT, 'engine', 'public', ...clip.src.split('/'));
const readLedger = async (w) => JSON.parse(await fs.readFile(path.join(w.dir, 'assets.json'), 'utf8'));
const writeLedger = (w, ledger) => fs.writeFile(path.join(w.dir, 'assets.json'), `${JSON.stringify(ledger, null, 2)}\n`);

test('planClipWindow adds one second of handle on each side and clamps to the file', () => {
  assert.deepEqual(planClipWindow(3, {fromSec: 1, toSec: 2}), {fromSec: 1, toSec: 2, startSec: 0, endSec: 3, durationSec: 3, inSec: 1});
  assert.deepEqual(planClipWindow(10, {fromSec: 4, toSec: 6}), {fromSec: 4, toSec: 6, startSec: 3, endSec: 7, durationSec: 4, inSec: 1});
  assert.deepEqual(planClipWindow(10, {}), {fromSec: 0, toSec: 10, startSec: 0, endSec: 10, durationSec: 10, inSec: 0});
  assert.equal(planClipWindow(10, {fromSec: 0.4, toSec: 9.8}).inSec, 0.4);
});

test('planClipWindow refuses empty, outside and over-long windows', () => {
  assert.throws(() => planClipWindow(10, {fromSec: 5, toSec: 5}), /empty or reversed/);
  assert.throws(() => planClipWindow(10, {fromSec: 2, toSec: 11}), /outside the file/);
  assert.throws(() => planClipWindow(100, {}), /longer than 60 s: pass --from and --to/);
  assert.throws(() => planClipWindow(100, {fromSec: 0, toSec: 61}), /limited to 60 s/);
  assert.throws(() => planClipWindow(0, {}), /no readable duration/);
});

test('planClipScale never scales up and keeps the cover size of the 1080x1920 frame', () => {
  assert.equal(planClipScale(1080, 1920), null);
  assert.equal(planClipScale(1920, 1080), null);
  assert.deepEqual(planClipScale(3840, 2160), {width: 3414, height: 1920});
  assert.deepEqual(planClipScale(2160, 3840), {width: 1080, height: 1920});
  assert.deepEqual(planClipScale(1200, 2000), {width: 1152, height: 1920});
});

test('clipId depends on the source hash, the window and the project rate', () => {
  const base = {sourceSha256: 'a'.repeat(64), fromSec: 0, toSec: 3, fps: 30};
  assert.match(clipId(base), /^clip-[a-f0-9]{8}$/);
  assert.equal(clipId(base), clipId({...base}));
  for (const change of [{sourceSha256: 'b'.repeat(64)}, {fromSec: 1}, {toSec: 4}, {fps: 60}]) assert.notEqual(clipId({...base, ...change}), clipId(base));
});

test('clipFilter converts the rate first, tone-maps HDR, scales down, then tags BT.709', () => {
  assert.equal(clipFilter({fps: 30}), `fps=30,format=yuv420p,${BT709_TAGS}`);
  assert.equal(clipFilter({fps: 30, scale: {width: 3414, height: 1920}}), `fps=30,scale=3414:1920:flags=lanczos,format=yuv420p,${BT709_TAGS}`);
  assert.match(clipFilter({fps: 30, hdr: 'hlg'}), /^fps=30,zscale=tin=arib-std-b67.*format=yuv420p,setparams=/);
});

test('a portrait file becomes a silent SDR clip at the project rate, staged and recorded', async (t) => {
  const w = await workspace(t);
  const file = await w.portrait();
  const before = await sha(file);
  const {clip, notes, cached} = await addClip({project: w.id, file, label: 'Office desk', licence: LICENCE});
  assert.equal(cached, false);
  assert.deepEqual([clip.width, clip.height, clip.fps, clip.frames, clip.inFrame], [1080, 1920, 30, 90, 0]);
  assert.equal(clip.src, `projects/${w.id}/clips/${clip.id}.mp4`);
  assert.equal(clip.hadAudio, false);
  assert.deepEqual(notes, []);
  const {video, audio} = await stagedProbe(clip.src);
  assert.equal(audio, 0);
  assert.equal(video.avg_frame_rate, '30/1');
  assert.equal(video.pix_fmt, 'yuv420p');
  assert.equal(video.color_transfer, 'bt709');
  assert.equal(await sha(`engine/public/${clip.src}`), clip.sha256);
  assert.equal(await sha(`Projects/${w.id}/assets/clips/${clip.id}.mp4`), clip.sha256, 'the staged copy equals the project derivative');
  assert.equal(await sha(file), before, 'the named file is never modified');
  assert.deepEqual((await readClipIndex(w.id)).clips.map((c) => c.id), [clip.id]);
  const ledger = JSON.parse(await fs.readFile(path.join(w.dir, 'assets.json'), 'utf8'));
  const entry = ledger.assets.find((asset) => asset.id === clip.id);
  assert.equal(entry.kind, 'video');
  assert.equal(entry.role, 'illustration');
  assert.equal(entry.usage.basis, LICENCE);
  assert.equal(entry.provenance.sha256, before);
});

test('a window keeps one second of handle and records where the requested part starts', async (t) => {
  const w = await workspace(t);
  const {clip} = await addClip({project: w.id, file: await w.portrait(), label: 'Middle', licence: LICENCE, fromSec: 1, toSec: 2});
  assert.deepEqual([clip.frames, clip.inFrame], [90, 30]);
  assert.deepEqual(clip.window, {fromSec: 1, toSec: 2});
});

test('a 24 fps landscape file with audio is retimed to the project rate and loses its sound', async (t) => {
  const w = await workspace(t);
  const {clip, notes} = await addClip({project: w.id, file: await w.landscapeWithAudio(), label: 'Wide', licence: LICENCE});
  assert.deepEqual([clip.width, clip.height, clip.frames, clip.hadAudio], [1920, 1080, 90, true]);
  assert.ok(notes.some((note) => /audio track was removed/i.test(note)), notes.join('|'));
  assert.ok(notes.some((note) => /frame rate converted to the project's 30 fps/i.test(note)), notes.join('|'));
  const {video, audio} = await stagedProbe(clip.src);
  assert.equal(audio, 0);
  assert.equal(video.avg_frame_rate, '30/1');
});

test('a landscape file with a 90 degree display rotation comes out upright at its display size, with a note', async (t) => {
  const w = await workspace(t);
  const {flat, file} = await w.rotated();
  const stored = (await ffprobeJson(path.join(ROOT, ...file.split('/')))).streams.find((s) => s.codec_type === 'video');
  assert.deepEqual([stored.width, stored.height], [1920, 1080], 'the stored pixels are landscape');
  assert.equal(stored.side_data_list.find((item) => item.rotation != null).rotation, 90, 'and a display matrix asks for a 90 degree turn');
  const summary = summarizeProbe(file, await ffprobeJson(path.join(ROOT, ...file.split('/'))));
  assert.deepEqual([summary.rotation, summary.width, summary.height], [90, 1080, 1920], 'the probe summary reports the display size');
  const {clip, notes} = await addClip({project: w.id, file, label: 'Turned', licence: LICENCE});
  assert.deepEqual([clip.width, clip.height], [1080, 1920]);
  assert.ok(notes.includes('Rotation of 90 degrees applied to the picture.'), notes.join('|'));
  const {video} = await stagedProbe(clip.src);
  assert.deepEqual([video.width, video.height], [1080, 1920]);
  assert.equal((video.side_data_list ?? []).some((item) => item.rotation != null), false, 'the turn is in the pixels, not left as metadata for a player to apply');
  // The first frame of the clip is the stored landscape frame turned counterclockwise, which is what the display matrix asks for. The reference frames carry
  // the same BT.709 tags as the clip, so both reach gray through the same matrix and a correct turn differs by almost nothing.
  const gray = async (input, filter) => (await run('ffmpeg', ['-hide_banner', '-nostats', '-v', 'error', ...input, ...(filter ? ['-vf', filter] : []), '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'], {encoding: 'buffer'})).stdout;
  const difference = (a, b) => { let total = 0; for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i]); return total / a.length; };
  const actual = await gray(['-i', stagedFile(clip)]);
  const landscape = path.join(ROOT, ...flat.split('/'));
  assert.equal(actual.length, 1080 * 1920);
  assert.ok(difference(actual, await gray(['-i', landscape], `transpose=2,format=yuv420p,${BT709_TAGS}`)) < 5, 'upright: the landscape frame turned counterclockwise');
  assert.ok(difference(actual, await gray(['-i', landscape], `transpose=1,format=yuv420p,${BT709_TAGS}`)) > 40, 'not the opposite turn');
  assert.ok(difference(actual, await gray(['-i', landscape], `scale=1080:1920,format=yuv420p,${BT709_TAGS}`)) > 40, 'and not the stored landscape picture squeezed into the portrait frame');
});

test('a file whose audio outlasts its picture is planned from the picture and not refused as truncated', async (t) => {
  const w = await workspace(t);
  const file = await w.audioTail();
  const streams = (await ffprobeJson(path.join(ROOT, ...file.split('/')))).streams;
  const seconds = (type) => Number(streams.find((s) => s.codec_type === type).duration);
  assert.ok(seconds('audio') - seconds('video') > 0.3, `fixture: the audio (${seconds('audio')} s) must outlast the video (${seconds('video')} s)`);
  const {clip, notes} = await addClip({project: w.id, file, label: 'Audio tail', licence: LICENCE});
  assert.equal(clip.hadAudio, true);
  assert.ok(notes.some((note) => /audio track was removed/i.test(note)), notes.join('|'));
  assert.ok(Math.abs(clip.frames - 90) <= 1, `frames: ${clip.frames}`);
  assert.ok(Math.abs(clip.window.toSec - 3) < 0.1, `window: ${JSON.stringify(clip.window)}`);
  const {video, audio} = await stagedProbe(clip.src);
  assert.equal(audio, 0);
  assert.equal(video.avg_frame_rate, '30/1');
  await assert.rejects(addClip({project: w.id, file, label: 'Past the picture', licence: LICENCE, fromSec: 2, toSec: 3.5}), /outside the file/);
});

test('a container that reports no picture duration is planned from the container duration', async (t) => {
  const w = await workspace(t);
  const {clip} = await addClip({project: w.id, file: await w.mkv(), label: 'Matroska', licence: LICENCE});
  assert.ok(Math.abs(clip.frames - 90) <= 1, `frames: ${clip.frames}`);
  assert.ok(Math.abs(clip.window.toSec - 3) < 0.1, `window: ${JSON.stringify(clip.window)}`);
});

test('a 4K file is scaled down to the cover size and never scaled up', async (t) => {
  const w = await workspace(t);
  const {clip, notes} = await addClip({project: w.id, file: await w.uhd(), label: 'Skyline', licence: LICENCE});
  assert.deepEqual([clip.width, clip.height, clip.frames], [3414, 1920, 60]);
  assert.ok(notes.some((note) => /scaled down to 3414x1920/i.test(note)), notes.join('|'));
  const {video} = await stagedProbe(clip.src);
  assert.deepEqual([video.width, video.height], [3414, 1920]);
});

test('an HLG file is tone-mapped to BT.709 and the source transfer is recorded', async (t) => {
  const w = await workspace(t);
  const {clip, notes} = await addClip({project: w.id, file: await w.hlg(), label: 'Sunset', licence: LICENCE});
  assert.equal(clip.hdrSource, 'hlg');
  assert.ok(notes.some((note) => /HDR \(HLG\) converted to BT\.709 SDR/.test(note)), notes.join('|'));
  assert.equal((await stagedProbe(clip.src)).video.color_transfer, 'bt709');
});

test('adding the same file and window again reuses the clip; another window is a new clip', async (t) => {
  const w = await workspace(t);
  const file = await w.portrait();
  const first = await addClip({project: w.id, file, label: 'Desk', licence: LICENCE});
  const again = await addClip({project: w.id, file, label: 'Desk', licence: LICENCE});
  assert.equal(again.cached, true);
  assert.equal(again.clip.id, first.clip.id);
  const other = await addClip({project: w.id, file, label: 'Desk part', licence: LICENCE, fromSec: 1, toSec: 2});
  assert.notEqual(other.clip.id, first.clip.id);
  assert.equal((await readClipIndex(w.id)).clips.length, 2);
  const ledger = JSON.parse(await fs.readFile(path.join(w.dir, 'assets.json'), 'utf8'));
  assert.equal(ledger.assets.length, 2);
});

test('adding a clip again with a corrected licence and a credit updates its records without re-encoding it', async (t) => {
  const w = await workspace(t);
  const file = await w.portrait();
  const {clip: first} = await addClip({project: w.id, file, label: 'Desk', licence: LICENCE});
  const ledger = await readLedger(w);
  ledger.assets[0].destinations = [{sceneId: 'broll-1', role: 'cutaway'}];
  ledger.assets[0].revisions[0].review = {status: 'accepted', method: 'played in the editor', findings: []};
  await writeLedger(w, ledger);
  const stamps = (...files) => Promise.all(files.map(async (f) => (await fs.stat(f)).mtimeMs));
  const clipFiles = [path.join(w.dir, 'assets', 'clips', `${first.id}.mp4`), stagedFile(first)];
  const before = await stamps(...clipFiles);
  const again = await addClip({project: w.id, file, label: 'Desk, wide shot', licence: 'CC BY 4.0', credit: 'Photo by Sam'});
  assert.equal(again.cached, true);
  assert.deepEqual(again.notes, ['Updated the label, licence or credit of the existing clip.']);
  assert.deepEqual(again.clip, {...first, label: 'Desk, wide shot', licence: 'CC BY 4.0', credit: 'Photo by Sam'}, 'only the label, licence and credit change');
  assert.deepEqual((await readClipIndex(w.id)).clips, [again.clip]);
  const [asset] = (await readLedger(w)).assets;
  assert.deepEqual(asset, {...ledger.assets[0], purpose: 'Desk, wide shot', usage: {...ledger.assets[0].usage, basis: 'CC BY 4.0', credits: ['Photo by Sam']}},
    'only the purpose, licence and credits change; destinations and review stay');
  assert.equal(await sha(`engine/public/${first.src}`), first.sha256);
  assert.deepEqual(await stamps(...clipFiles), before, 'the derivative and the staged copy were not rewritten');
  const records = ['clips.json', 'assets.json'].map((name) => path.join(w.dir, name));
  const written = await stamps(...records);
  const quiet = await addClip({project: w.id, file, label: 'Desk, wide shot', licence: 'CC BY 4.0'});
  assert.equal(quiet.cached, true);
  assert.deepEqual(quiet.notes, []);
  assert.equal(quiet.clip.credit, 'Photo by Sam', 'an omitted credit leaves the credit unchanged');
  assert.deepEqual(await stamps(...records), written, 'a repeat that changes nothing rewrites no record');
});

test('adding a clip again restores an asset ledger entry that the first add never wrote', async (t) => {
  const w = await workspace(t);
  const file = await w.portrait();
  const {clip} = await addClip({project: w.id, file, label: 'Desk', licence: LICENCE});
  await fs.rm(path.join(w.dir, 'assets.json'));
  const again = await addClip({project: w.id, file, label: 'Desk', licence: LICENCE});
  assert.equal(again.cached, true);
  const [asset] = (await readLedger(w)).assets;
  assert.deepEqual([asset.id, asset.usage.basis, asset.selectedRevision, asset.revisions[0].sha256], [clip.id, LICENCE, 'r1', clip.sha256]);
  await writeLedger(w, {version: 1, assets: [{id: 'other-asset', kind: 'image', role: 'illustration'}]});
  await addClip({project: w.id, file, label: 'Desk', licence: LICENCE});
  assert.deepEqual((await readLedger(w)).assets.map((item) => item.id), ['other-asset', clip.id], 'the other assets of the ledger stay');
});

test('regenerating a clip whose staged file is gone keeps the destinations and the credit of its asset', async (t) => {
  const w = await workspace(t);
  const file = await w.portrait();
  const {clip} = await addClip({project: w.id, file, label: 'Desk', licence: LICENCE, credit: 'Photo by Sam'});
  const destinations = [{sceneId: 'broll-1', role: 'cutaway'}];
  const ledger = await readLedger(w);
  ledger.assets[0].destinations = destinations;
  ledger.assets[0].revisions[0].review = {status: 'accepted', method: 'played in the editor', findings: []};
  await writeLedger(w, ledger);
  await fs.rm(stagedFile(clip));
  const again = await addClip({project: w.id, file, label: 'Desk', licence: LICENCE});
  assert.equal(again.cached, false);
  assert.equal(await sha(`engine/public/${clip.src}`), again.clip.sha256, 'the staged file exists again');
  assert.equal(again.clip.credit, 'Photo by Sam', 'an omitted credit leaves the credit unchanged');
  assert.deepEqual((await readClipIndex(w.id)).clips, [again.clip]);
  const {assets} = await readLedger(w);
  assert.equal(assets.length, 1);
  assert.deepEqual(assets[0].destinations, destinations);
  assert.deepEqual(assets[0].usage.credits, ['Photo by Sam']);
  assert.deepEqual(assets[0].revisions.map((r) => [r.id, r.review.status]), [['r1', 'awaiting-review']], 'the regenerated file is a new, unreviewed revision');
  assert.equal(assets[0].selectedRevision, 'r1');
});

test('the 501st clip is refused and clips.json and the ledger stay as they were', async (t) => {
  const w = await workspace(t);
  const file = await w.portrait();
  const {clip} = await addClip({project: w.id, file, label: 'Desk', licence: LICENCE});
  const clones = Array.from({length: 499}, (_, i) => ({...clip, id: `clip-${i.toString(16).padStart(8, '0')}`}));
  await fs.writeFile(path.join(w.dir, 'clips.json'), `${JSON.stringify({version: 1, clips: clones}, null, 2)}\n`);
  const last = await addClip({project: w.id, file, label: 'Desk part', licence: LICENCE, fromSec: 1, toSec: 2});
  assert.equal((await readClipIndex(w.id)).clips.length, 500, 'the 500th clip is accepted');
  const index = await fs.readFile(path.join(w.dir, 'clips.json'));
  const ledger = await fs.readFile(path.join(w.dir, 'assets.json'));
  await assert.rejects(addClip({project: w.id, file, label: 'Desk end', licence: LICENCE, fromSec: 2, toSec: 3}), /at most 500 clips/);
  assert.deepEqual(await fs.readFile(path.join(w.dir, 'clips.json')), index, 'clips.json is byte-identical');
  assert.deepEqual(await fs.readFile(path.join(w.dir, 'assets.json')), ledger, 'the ledger is byte-identical');
  assert.equal((await readClipIndex(w.id)).clips.length, 500, 'the index stays readable');
  assert.deepEqual((await fs.readdir(path.dirname(stagedFile(clip)))).sort(), [clip, last.clip].map((c) => `${c.id}.mp4`).sort(), 'the refused clip was not staged');
});

test('a project without a recording needs an explicit rate that agrees with its intake', async (t) => {
  const none = await workspace(t, {intake: 0});
  const file = await none.portrait();
  await assert.rejects(addClip({project: none.id, file, label: 'Desk', licence: LICENCE}), /main-recording intake/);
  const {clip} = await addClip({project: none.id, file, label: 'Desk', licence: LICENCE, fps: 30});
  assert.equal(clip.fps, 30);
  const known = await workspace(t, {intake: 30});
  await assert.rejects(addClip({project: known.id, file: await known.portrait(), label: 'Desk', licence: LICENCE, fps: 60}), /disagrees with the project's delivery rate 30/);
});

test('missing licence, damaged windows, long files and clip folders are refused', async (t) => {
  const w = await workspace(t);
  const file = await w.portrait();
  await assert.rejects(addClip({project: w.id, file, label: 'Desk', licence: ''}), /--licence is required/);
  await assert.rejects(addClip({project: w.id, file, label: '', licence: LICENCE}), /--label is required/);
  await assert.rejects(addClip({project: w.id, file, label: 'Desk', licence: LICENCE, fromSec: 2, toSec: 99}), /outside the file/);
  const long = await w.make('long.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=64x64:rate=5:duration=61'], ['-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p']);
  await assert.rejects(addClip({project: w.id, file: long, label: 'Long', licence: LICENCE}), /longer than 60 s/);
  const tone = await w.make('tone.m4a', ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2'], ['-c:a', 'aac']);
  await assert.rejects(addClip({project: w.id, file: tone, label: 'Tone', licence: LICENCE}), /video stream/);
  const {clip} = await addClip({project: w.id, file, label: 'Desk', licence: LICENCE});
  await assert.rejects(addClip({project: w.id, file: `Projects/${w.id}/assets/clips/${clip.id}.mp4`, label: 'Again', licence: LICENCE}), /inside the clip folders/);
  await assert.rejects(addClip({project: w.id, file: `engine/public/${clip.src}`, label: 'Again', licence: LICENCE}), /inside the clip folders/);
  await assert.rejects(addClip({project: 'Bad_Slug', file, label: 'Desk', licence: LICENCE}), /lowercase slug/);
});

test('a mistyped project is refused and no folder appears, with or without an explicit rate', async (t) => {
  const w = await workspace(t);
  const file = await w.portrait();
  const ghost = `${w.id}-typo`;
  const folders = [path.join(ROOT, 'Projects', ghost), path.join(ROOT, 'engine', 'public', 'projects', ghost)];
  t.after(async () => { for (const folder of folders) await fs.rm(folder, {recursive: true, force: true}); });
  const exists = (folder) => fs.access(folder).then(() => true, () => false);
  await assert.rejects(addClip({project: ghost, file, label: 'Desk', licence: LICENCE}), new RegExp(`^Error: Project Projects/${ghost} does not exist\\.$`));
  await assert.rejects(addClip({project: ghost, file, label: 'Desk', licence: LICENCE, fps: 30}), /Project Projects\/.* does not exist\./, 'an explicit rate used to create a phantom project');
  assert.deepEqual(await Promise.all(folders.map(exists)), [false, false], 'neither the project folder nor its public folder was created');
  assert.deepEqual((await readClipIndex(ghost)).clips, [], 'listing is unaffected');
  assert.equal(await exists(folders[0]), false, 'and listing creates nothing either');
  await assert.rejects(exec(process.execPath, ['scripts/clips.mjs', 'add', '--project', `Projects/${ghost}`, '--file', file, '--label', 'Desk', '--licence', LICENCE, '--fps', '30'], {cwd: ROOT}),
    (error) => error.code === 1 && new RegExp(`"error":"Project Projects/${ghost} does not exist\\."`).test(error.stderr));
  assert.equal(await exists(folders[0]), false);
  const {clip} = await addClip({project: w.id, file, label: 'Desk', licence: LICENCE});
  assert.match(clip.id, /^clip-/, 'a real project is unaffected');
});

test('the clip checks read the intake helpers instead of keeping copies of them', async () => {
  assert.equal(ratio('30000/1001').toFixed(3), '29.970');
  assert.deepEqual([ratio(undefined), ratio('0/0'), ratio('24/1')], [0, 0, 24]);
  assert.deepEqual({...HDR_TRANSFERS}, {'arib-std-b67': 'hlg', smpte2084: 'pq'});
  const source = await fs.readFile(path.join(ROOT, 'scripts', 'lib', 'clips.mjs'), 'utf8');
  assert.doesNotMatch(source, /const ratio\s*=/, 'ratio comes from intake.mjs');
  assert.doesNotMatch(source, /arib-std-b67|smpte2084/, 'the HDR transfer names come from intake.mjs');
});

test('the command line adds and lists clips and reports errors as JSON', async (t) => {
  const w = await workspace(t);
  const file = await w.portrait();
  const added = JSON.parse((await exec(process.execPath, ['scripts/clips.mjs', 'add', '--project', w.project, '--file', file, '--label', 'Desk', '--licence', LICENCE], {cwd: ROOT})).stdout);
  assert.equal(added.ok, true);
  assert.match(added.clip.id, /^clip-[a-f0-9]{8}$/);
  const listed = JSON.parse((await exec(process.execPath, ['scripts/clips.mjs', 'list', '--project', w.project], {cwd: ROOT})).stdout);
  assert.deepEqual(listed.clips.map((c) => c.id), [added.clip.id]);
  await assert.rejects(exec(process.execPath, ['scripts/clips.mjs', 'add', '--project', w.project, '--file', file, '--label', 'Desk'], {cwd: ROOT}),
    (error) => error.code === 1 && /"ok":false/.test(error.stderr) && /licence/.test(error.stderr));
});
