// The cartoon mouth table: one openness value (0..1) per OUTPUT frame, from the recording's own loudness.
// Calibration is relative to the recording (percentiles of its speech frames), so a quiet or loud microphone
// gives the same motion. Smoothing uses time constants, so 30, 50 and 60 fps tables agree in seconds.
import './project-tmp.mjs';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {checkedPath, digest, atomicJson, ensureOutput, fileSnapshot, readJson, withFileLock} from './job-paths.mjs';
import {run} from './media.mjs';
import {parseWav} from './auto-cut.mjs';
import {CARTOON_FAMILIES} from '../../engine/src/styles/cartoon/scenes/math.ts';

export const MOUTH_RECIPE_VERSION = 1;
const SILENCE_DB = -120, FLOOR_DB = -100, GATE_BELOW_REFERENCE = 30, MIN_WINDOW_DB = 12;
/** Seconds: a fast attack and a slower release (0.75 and 0.35 per 20 ms step). */
export const MOUTH_TAU = Object.freeze({attack: 0.0144, release: 0.0464});

export const needsMouth = (edit) => Array.isArray(edit?.scenes) && edit.scenes.some((scene) => CARTOON_FAMILIES.includes(scene?.family));

/** dBFS RMS per output frame: each output frame maps to its source time through the kept segments. */
export function dbPerOutputFrame({samples, sampleRate, segments, sourceFps, fps}) {
  const out = [];
  for (const segment of segments) {
    const length = Math.round(((segment.toFrame - segment.fromFrame) / sourceFps) * fps);
    for (let f = 0; f < length; f += 1) {
      const t0 = segment.fromFrame / sourceFps + f / fps;
      const a = Math.min(samples.length, Math.round(t0 * sampleRate)), b = Math.min(samples.length, Math.round((t0 + 1 / fps) * sampleRate));
      let power = 0;
      for (let i = a; i < b; i += 1) power += samples[i] * samples[i];
      const mean = b > a ? power / (b - a) : 0;
      out.push(mean > 0 ? Math.max(SILENCE_DB, 10 * Math.log10(mean)) : SILENCE_DB);
    }
  }
  return out;
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];

/** LO/HI from the recording: reference = P95 of the non-silent frames, gate 30 dB under it, HI = P97 and LO = P20 of the gated frames. */
export function calibrate(db) {
  const live = db.filter((v) => v > FLOOR_DB).sort((a, b) => a - b);
  if (!live.length) return {referenceDb: SILENCE_DB, gateDb: SILENCE_DB, loDb: -36, hiDb: -18, speechFrames: 0};
  const referenceDb = percentile(live, 0.95), gateDb = referenceDb - GATE_BELOW_REFERENCE;
  const speech = live.filter((v) => v > gateDb);
  const hiDb = percentile(speech, 0.97);
  let loDb = percentile(speech, 0.2);
  if (hiDb - loDb < MIN_WINDOW_DB) loDb = hiDb - MIN_WINDOW_DB;
  return {referenceDb, gateDb, loDb, hiDb, speechFrames: speech.length};
}

/** One-pole smoothing with a fast attack and a slower release, expressed in seconds. */
export function smoothOpen(raw, fps) {
  const attack = 1 - Math.exp(-(1 / fps) / MOUTH_TAU.attack), release = 1 - Math.exp(-(1 / fps) / MOUTH_TAU.release);
  const out = [];
  let prev = 0;
  for (const value of raw) {
    prev += (value - prev) * (value > prev ? attack : release);
    out.push(Math.round(prev * 100) / 100);
  }
  return out;
}

export function buildMouthTable(input) {
  const db = dbPerOutputFrame(input);
  const calibration = calibrate(db);
  const raw = db.map((v) => (v <= FLOOR_DB ? 0 : Math.max(0, Math.min(1, (v - calibration.loDb) / (calibration.hiDb - calibration.loDb)))));
  const values = smoothOpen(raw, input.fps);
  const openShare = values.length ? values.filter((v) => v > 0.3).length / values.length : 0;
  const round = (n) => Math.round(n * 100) / 100;
  return {version: MOUTH_RECIPE_VERSION, fps: input.fps, values, calibration: {referenceDb: round(calibration.referenceDb), gateDb: round(calibration.gateDb), loDb: round(calibration.loDb),
    hiDb: round(calibration.hiDb), speechFrames: calibration.speechFrames, openShare: Math.round(openShare * 1000) / 1000}};
}

const identity = (edit) => digest({version: MOUTH_RECIPE_VERSION, source: edit.source.sha256, segments: edit.segments, fps: edit.source.fps});

/** Builds `<base>/mouth.json` from the source audio; returns null when no cartoon scene needs it. */
export async function buildPreparedMouth(edit, {base, log = () => {}}) {
  if (!needsMouth(edit)) return null;
  log('Measuring the voice for the cartoon mouth.');
  const opts = {project: edit.id};
  const wav = await ensureOutput(`${base}/mouth-16k.wav`, opts);
  try {
    await run('ffmpeg', ['-v', 'error', '-y', '-i', await checkedPath(edit.source.path, {mustExist: true}), '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
    const {samples, sampleRate} = parseWav(await fs.readFile(wav));
    const table = {...buildMouthTable({samples, sampleRate, segments: edit.segments, sourceFps: edit.source.fps, fps: edit.source.fps}),
      source: edit.source.sha256, segments: edit.segments, identity: identity(edit)};
    await atomicJson(`${base}/mouth.json`, table, opts);
    const warning = table.calibration.speechFrames < 2 * edit.source.fps ? `only ${table.calibration.speechFrames} speech frames; the mouth will barely move (NEEDS-REVIEW)` : null;
    if (warning) log(`mouth: ${warning}`);
    return {table, summary: {frames: table.values.length, openShare: table.calibration.openShare, loDb: table.calibration.loDb, hiDb: table.calibration.hiDb, speechFrames: table.calibration.speechFrames, warning}};
  } finally {
    await fs.unlink(wav).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
}

const summaryOf = (table, fps) => {
  const c = table.calibration;
  const warning = c.speechFrames < 2 * fps ? `only ${c.speechFrames} speech frames; the mouth will barely move (NEEDS-REVIEW)` : null;
  return {frames: table.values.length, openShare: c.openShare, loDb: c.loDb, hiDb: c.hiDb, speechFrames: c.speechFrames, warning};
};

/**
 * The prepare step for the cartoon mouth. It runs right after `prepareEditProject` (whose code is a plate-cache key and
 * stays unchanged): it writes `mouth.json` beside `props.json`, adds the table to the props and records it in
 * `preparation.json`. A table built for the same source, cuts and fps is reused. Edits without a cartoon scene pass through.
 */
export async function attachPreparedMouth(result, {log = () => {}} = {}) {
  const props = await readJson(result.propsFile);
  const edit = props.edit;
  if (!needsMouth(edit)) return result;
  const base = path.posix.dirname(result.propsFile), opts = {project: edit.id};
  return withFileLock(`Projects/${edit.id}/prepare.lock`, opts, async () => {
    const existing = await readJson(`${base}/mouth.json`, {optional: true}).catch(() => null);
    let table = existing, summary;
    const reusable = existing && existing.identity === identity(edit) && await verifyPreparedMouth({edit, mouth: existing}).then(() => true, () => false);
    if (reusable) summary = summaryOf(existing, edit.source.fps);
    else ({table, summary} = await buildPreparedMouth(edit, {base, log}));
    await atomicJson(result.propsFile, {...props, mouth: table}, opts);
    const snapshots = await Promise.all([result.propsFile, `${base}/mouth.json`].map((p) => fileSnapshot(p, {nonempty: false})));
    const outputs = [...(result.outputs ?? []).filter((o) => o.path !== result.propsFile && o.path !== `${base}/mouth.json`), ...snapshots];
    const next = {...result, mouth: summary, outputs};
    const preparation = await readJson(`${base}/preparation.json`, {optional: true}).catch(() => null);
    if (preparation) await atomicJson(`${base}/preparation.json`, {...preparation, mouth: summary, outputs}, opts);
    return next;
  });
}

/** A cartoon edit must carry a table built for this source, these cuts and this fps. */
export async function verifyPreparedMouth(props) {
  const edit = props.edit;
  if (!needsMouth(edit)) return;
  const mouth = props.mouth;
  if (!mouth || typeof mouth !== 'object') throw new Error('This edit has a cartoon scene but no mouth table. Run edit-project prepare again.');
  const frames = edit.segments.reduce((n, s) => n + Math.round(((s.toFrame - s.fromFrame) / edit.source.fps) * (mouth.fps ?? edit.source.fps)), 0);
  const fresh = mouth.version === MOUTH_RECIPE_VERSION && mouth.source === edit.source.sha256 && digest(mouth.segments) === digest(edit.segments) && mouth.fps === edit.source.fps
    && Array.isArray(mouth.values) && mouth.values.length === frames && mouth.values.every((v) => typeof v === 'number' && v >= 0 && v <= 1);
  if (!fresh) throw new Error('The mouth table is stale for this edit (source, cuts or fps changed). Run edit-project prepare again.');
}
