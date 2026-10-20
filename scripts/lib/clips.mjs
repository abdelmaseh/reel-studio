import {createHash} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {ffprobeJson, run, summarizeProbe} from './media.mjs';
import {atomicJson, checkedPath, ensureOutput, fileSnapshot, readJson, relativePath, slug, withFileLock} from './job-paths.mjs';
import {BT709_TAGS, HDR_TRANSFERS, describeSource, ratio, toneMapFilter} from './intake.mjs';
import {clipIndexEntrySchema, clipIndexSchema} from '../../engine/src/core/clip-schema.ts';

export const CLIP_MAX_SECONDS = 60;
export const CLIP_HANDLE_SECONDS = 1;
const FRAME_BOX = Object.freeze({width: 1080, height: 1920});
const r3 = (n) => Math.round(n * 1000) / 1000;

export const clipIndexPath = (project) => `Projects/${project}/clips.json`;
export const clipDerivativePath = (project, id) => `Projects/${project}/assets/clips/${id}.mp4`;
/** The path a scene stores: relative to engine/public. */
export const clipStagedSrc = (project, id) => `projects/${project}/clips/${id}.mp4`;

/** The same source, window and project rate always give the same id, so adding a clip twice is a no-op. */
export function clipId({sourceSha256, fromSec, toSec, fps}) {
  const key = `${sourceSha256}|${fromSec}|${toSec}|${fps}`;
  return `clip-${createHash('sha256').update(key).digest('hex').slice(0, 8)}`;
}

/** The requested part of a file plus one second of handle on each side, clamped to the file. */
export function planClipWindow(durationSec, {fromSec, toSec} = {}) {
  if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error('The file has no readable duration.');
  const from = fromSec ?? 0;
  const to = toSec ?? durationSec;
  if (![from, to].every(Number.isFinite) || from < 0 || to <= from) throw new Error('The requested window is empty or reversed.');
  if (from >= durationSec || to > durationSec + 0.05) throw new Error(`The requested window ${from}-${to} s is outside the file (${r3(durationSec)} s).`);
  if (fromSec === undefined && toSec === undefined && durationSec > CLIP_MAX_SECONDS) throw new Error(`The file is longer than ${CLIP_MAX_SECONDS} s: pass --from and --to.`);
  const end = Math.min(to, durationSec);
  if (end - from > CLIP_MAX_SECONDS) throw new Error(`A clip window is limited to ${CLIP_MAX_SECONDS} s.`);
  const startSec = r3(Math.max(0, from - CLIP_HANDLE_SECONDS));
  const endSec = r3(Math.min(durationSec, end + CLIP_HANDLE_SECONDS));
  return {fromSec: r3(from), toSec: r3(end), startSec, endSec, durationSec: r3(endSec - startSec), inSec: r3(from - startSec)};
}

/** Scale down to the smallest size that still covers the 1080x1920 frame; never scale up. Null when the file is not larger. */
export function planClipScale(width, height) {
  const s = Math.max(FRAME_BOX.width / width, FRAME_BOX.height / height);
  if (!(s < 1)) return null;
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  return {width: even(width * s), height: even(height * s)};
}

export function clipFilter({fps, hdr = null, scale = null}) {
  return [`fps=${fps}`, ...(hdr ? [toneMapFilter(hdr)] : []), ...(scale ? [`scale=${scale.width}:${scale.height}:flags=lanczos`] : []), 'format=yuv420p', BT709_TAGS].join(',');
}

export function clipArgs({input, output, startSec, durationSec, filter, fps}) {
  return ['-hide_banner', '-nostats', '-v', 'error', '-y', '-ss', String(startSec), '-i', input, '-t', String(durationSec),
    '-map', '0:v:0', '-an', '-sn', '-dn', '-vf', filter, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-g', String(fps), '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', output];
}

export async function readClipIndex(project) {
  const raw = await readJson(clipIndexPath(project), {optional: true});
  return raw === null ? {version: 1, clips: []} : clipIndexSchema.parse(raw);
}

/** The complete next index, checked against the schema (its clip cap included) before anything is written. */
function nextClipIndex(project, clips) {
  const next = clipIndexSchema.safeParse({version: 1, clips});
  if (next.success) return next.data;
  const full = next.error.issues.find((issue) => issue.code === 'too_big' && issue.origin === 'array');
  throw new Error(full ? `A project holds at most ${full.maximum} clips and ${clipIndexPath(project)} is full; it was not changed.`
    : `${clipIndexPath(project)} would be invalid and was not changed: ${next.error.issues.map((issue) => issue.message).join('; ')}`);
}

const text = (value, name, max) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`${name} is required (1 to ${max} characters).`);
  return value.trim();
};

/** An existing project always has its folder. Checked before the lock below, which would create the folder for a mistyped name (and, with --fps, carry on in it). */
async function requireProject(project) {
  const dir = `Projects/${project}`;
  const stat = await fs.stat(await checkedPath(dir, {file: false})).catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!stat?.isDirectory()) throw new Error(`Project ${dir} does not exist.`);
}

async function projectRate(project, fps) {
  const intake = await readJson(`Projects/${project}/source/intake.json`, {optional: true});
  const known = intake?.deliveryFps;
  const valid = (n) => Number.isInteger(n) && n >= 24 && n <= 60;
  if (fps !== undefined) {
    if (!valid(fps)) throw new Error('--fps must be a whole number from 24 to 60.');
    if (known !== undefined && known !== fps) throw new Error(`--fps ${fps} disagrees with the project's delivery rate ${known}; omit --fps.`);
    return fps;
  }
  if (!valid(known)) throw new Error('The project has no main-recording intake: run scripts/intake.mjs first, or pass --fps for a project without a recording.');
  return known;
}

async function measureClip(absolute) {
  const {stdout} = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames,width,height', '-of', 'json', absolute]);
  const stream = JSON.parse(stdout).streams?.[0];
  return {frames: Number(stream?.nb_read_frames), width: Number(stream?.width), height: Number(stream?.height)};
}

/** Copy a project file into engine/public. The write guard of ensureOutput covers Projects/ only, so check the target path by hand. */
async function stageFile(fromRelative, toRelative) {
  const target = await checkedPath(toRelative);
  await fs.mkdir(path.dirname(target), {recursive: true});
  await checkedPath(toRelative);
  await fs.copyFile(await checkedPath(fromRelative, {mustExist: true}), target);
}

/**
 * Record a clip in the asset ledger. An asset that is already there keeps its other fields (its destinations in particular):
 * a new run replaces only what it produces, and `reuse` (the same clip, already staged) refreshes only the label, licence and credits.
 */
async function appendLedger(project, entry, settings, {reuse = false} = {}) {
  const file = `Projects/${project}/assets.json`;
  const current = (await readJson(file, {optional: true})) ?? {version: 1, assets: []};
  if (current.version !== 1 || !Array.isArray(current.assets)) throw new Error(`${file} is not an asset ledger this tool can extend.`);
  const at = current.assets.findIndex((item) => item?.id === entry.id);
  const existing = at < 0 ? null : current.assets[at];
  let asset = {
    id: entry.id, kind: 'video', role: 'illustration', purpose: entry.label, destinations: [],
    provenance: {type: 'creator-named', source: entry.source.path, sha256: entry.source.sha256},
    usage: {status: 'documented', basis: entry.licence, credits: entry.credit ? [entry.credit] : []},
    production: {tool: 'scripts/clips.mjs add', operation: 'normalise clip', settings},
    authorization: {scope: 'creator-named file; no paid service', paid: false},
    reportedCost: {amount: 0, basis: 'local production'},
    revisions: [{id: 'r1', parent: null, path: clipDerivativePath(project, entry.id), stagedSrc: entry.src, sha256: entry.sha256, width: entry.width, height: entry.height,
      fps: entry.fps, frames: entry.frames, review: {status: 'awaiting-review', method: 'not yet reviewed', findings: []}}],
    selectedRevision: 'r1',
  };
  if (existing) {
    asset = reuse
      ? {...existing, purpose: asset.purpose, usage: {...existing.usage, basis: asset.usage.basis, credits: asset.usage.credits}}
      : {...existing, purpose: asset.purpose, usage: asset.usage, production: asset.production, revisions: asset.revisions, selectedRevision: asset.selectedRevision};
    if (JSON.stringify(asset) === JSON.stringify(existing)) return;
  }
  const assets = current.assets.filter((item) => item?.id !== entry.id);
  assets.splice(at < 0 ? assets.length : at, 0, asset);
  await atomicJson(file, {...current, assets}, {project});
}

/** Normalise a named file into a silent, SDR, constant-rate clip, stage it and record it. */
export async function addClip({project, file, label, licence, credit, fromSec, toSec, fps}) {
  slug(project, 'project');
  const source = relativePath(text(String(file ?? ''), '--file', 1000).replaceAll('\\', '/'));
  if (source.startsWith('engine/public/') || source.startsWith(`Projects/${project}/assets/clips/`)) throw new Error('The named file is inside the clip folders; name the original file instead.');
  const cleanLabel = text(label, '--label', 80);
  const cleanLicence = text(licence, '--licence', 300);
  const cleanCredit = credit === undefined ? undefined : text(credit, '--credit', 300);
  await requireProject(project);
  return withFileLock(`Projects/${project}/clips.lock`, {project}, async () => {
    const rate = await projectRate(project, fps);
    const absolute = await checkedPath(source, {mustExist: true});
    const original = await fileSnapshot(source);
    const probe = await ffprobeJson(absolute);
    const facts = describeSource(probe);
    const summary = summarizeProbe(absolute, probe);
    // Plan from the picture's own length: the container duration also counts an audio track that runs longer.
    const pictureSec = Number(probe.streams?.find((stream) => stream.codec_type === 'video')?.duration);
    const fileSec = Number.isFinite(pictureSec) && pictureSec > 0 ? Math.min(pictureSec, facts.durationSec ?? pictureSec) : facts.durationSec;
    const window = planClipWindow(fileSec, {fromSec, toSec});
    const scale = planClipScale(summary.width, summary.height);
    const settings = {fromSec: window.fromSec, toSec: window.toSec, fps: rate, scale, hdr: facts.hdr ?? null};
    const id = clipId({sourceSha256: original.sha256, fromSec: window.fromSec, toSec: window.toSec, fps: rate});
    const index = await readClipIndex(project);
    const known = index.clips.find((clip) => clip.id === id);
    if (known) {
      const staged = await fileSnapshot(`engine/public/${known.src}`).catch(() => null);
      if (staged?.sha256 === known.sha256) {
        // Same clip, already staged: keep the encoded file, apply a corrected label, licence or credit and restore a missing ledger entry.
        const clip = clipIndexEntrySchema.parse({...known, label: cleanLabel, licence: cleanLicence, ...(cleanCredit === undefined ? {} : {credit: cleanCredit})});
        const changed = clip.label !== known.label || clip.licence !== known.licence || clip.credit !== known.credit;
        if (changed) await atomicJson(clipIndexPath(project), nextClipIndex(project, index.clips.map((item) => (item.id === id ? clip : item))), {project});
        await appendLedger(project, clip, settings, {reuse: true});
        return {clip, notes: changed ? ['Updated the label, licence or credit of the existing clip.'] : [], cached: true};
      }
    }
    const derivative = clipDerivativePath(project, id);
    const output = await ensureOutput(derivative, {project});
    await run('ffmpeg', clipArgs({input: absolute, output, startSec: window.startSec, durationSec: window.durationSec, fps: rate, filter: clipFilter({fps: rate, hdr: facts.hdr, scale})}));
    const measured = await measureClip(output);
    const outProbe = await ffprobeJson(output);
    if (!outProbe.streams?.some((s) => s.codec_type === 'video') || outProbe.streams.some((s) => s.codec_type === 'audio')) throw new Error('The converted clip is not a silent video; the source may be damaged.');
    const expected = Math.floor(window.durationSec * rate);
    if (!(measured.frames >= expected - 2)) throw new Error(`The converted clip has ${measured.frames} frames but the window needs about ${expected}; the source file may be truncated.`);
    const inFrame = Math.round(window.inSec * rate);
    if (inFrame >= measured.frames) throw new Error('The requested window starts after the last readable frame.');
    const derived = await fileSnapshot(derivative);
    const src = clipStagedSrc(project, id);
    const keptCredit = cleanCredit ?? known?.credit;
    const entry = clipIndexEntrySchema.parse({
      id, label: cleanLabel, src, sha256: derived.sha256, width: measured.width, height: measured.height, fps: rate, frames: measured.frames, inFrame,
      window: {fromSec: window.fromSec, toSec: window.toSec}, source: {path: source, sha256: original.sha256}, licence: cleanLicence,
      ...(keptCredit ? {credit: keptCredit} : {}), hadAudio: facts.hasAudio, ...(facts.hdr ? {hdrSource: facts.hdr} : {}), addedAt: new Date().toISOString(),
    });
    const nextIndex = nextClipIndex(project, [...index.clips.filter((clip) => clip.id !== id), entry]);
    await stageFile(derivative, `engine/public/${src}`);
    await atomicJson(clipIndexPath(project), nextIndex, {project});
    await appendLedger(project, entry, settings);
    const notes = [];
    if (facts.hdr) notes.push(`HDR (${facts.hdr.toUpperCase()}) converted to BT.709 SDR.`);
    if (facts.hasAudio) notes.push('The audio track was removed; clips are silent.');
    if (scale) notes.push(`Scaled down to ${scale.width}x${scale.height} (never scaled up).`);
    if (facts.vfr || Math.abs(facts.taggedFps - rate) > 0.01) notes.push(`Frame rate converted to the project's ${rate} fps.`);
    if (summary.rotation) notes.push(`Rotation of ${summary.rotation} degrees applied to the picture.`);
    return {clip: entry, notes, cached: false};
  });
}

/**
 * Prepare-time check of a clip file a scene uses: silent, SDR, at the edit's rate and long enough for the part of the scene that plays it.
 * `asset` is the verified asset ({src, absolute}); `claim` carries trimBeforeFrame and frames.
 */
export async function verifyClipMedia(asset, claim, {fps}) {
  const probe = await ffprobeJson(asset.absolute);
  const video = probe.streams?.find((stream) => stream.codec_type === 'video');
  if (probe.streams?.some((stream) => stream.codec_type === 'audio')) throw new Error(`Scene clip carries an audio track: ${asset.src}. Clips are silent; add it again with scripts/clips.mjs.`);
  if (Object.hasOwn(HDR_TRANSFERS, video?.color_transfer)) throw new Error(`Scene clip is HDR: ${asset.src}. Add it again with scripts/clips.mjs.`);
  const rate = ratio(video?.avg_frame_rate);
  if (Math.abs(rate - fps) > 0.01) throw new Error(`Scene clip runs at ${r3(rate)} fps but the edit runs at ${fps} fps: ${asset.src}. Add it again with scripts/clips.mjs.`);
  const available = Number(video?.duration ?? probe.format?.duration);
  if (!Number.isFinite(available) || available + 1 / fps < (claim.trimBeforeFrame + claim.frames) / fps) throw new Error(`Scene clip is too short for its scene: ${asset.src}`);
}
