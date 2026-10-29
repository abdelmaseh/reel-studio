// The pure half of the person matte: sizes, the mask maths, the ffmpeg command lines and the manifest edit.
// Nothing here touches the disk, a browser or ffmpeg, so every function is tested in plain Node (tests/matte-runtime.test.mjs).
// The half that runs ffmpeg and the local Chromium is scripts/lib/matte-runtime.mjs.
import { createHash } from 'node:crypto';
import { FOREGROUND_FAMILIES } from '../../engine/src/core/scene-media.ts';
import { foregroundSourceFrame } from '../../engine/src/prepared-edit/visibility.ts';

export const MATTE_VERSION = 1;

/**
 * low and high are the confidence band the soft edge runs across (below low is background, above high is the person).
 * blur is the box radius in analysis pixels. temporal is how much of the last frame is kept for a small change;
 * a change larger than jump is real movement and is followed at once.
 */
export const MATTE_SETTINGS = Object.freeze({ low: 0.3, high: 0.78, blur: 1, temporal: 0.3, jump: 64, batch: 24 });

/** Most frames one matte may hold: ten minutes at 60 fps. */
export const MATTE_MAX_FRAMES = 36000;

const FPS_TEXT = /^\d{1,6}(?:\/\d{1,6})?$/;
const fail = (message) => { throw new Error(`matte: ${message}`); };
const wholeFrames = (value, label, min) => { if (!Number.isInteger(value) || value < min) fail(`${label} must be a whole number of at least ${min}, got ${value}.`); return value; };

/** Fits the source into a target width, keeping its aspect, with both sides even. A small source is never scaled up. */
export function evenSize(width, height, targetWidth) {
  wholeFrames(width, 'source width', 2);
  wholeFrames(height, 'source height', 2);
  if (!Number.isInteger(targetWidth) || targetWidth < 16 || targetWidth % 2 !== 0) fail(`the target width must be an even number of at least 16, got ${targetWidth}.`);
  const w = Math.min(targetWidth, width);
  const even = (value) => Math.max(2, Math.round(value / 2) * 2);
  return { width: even(w), height: even((w * height) / width) };
}

/** The part of the source the matte covers. With no frames given it runs to the end of the source. */
export function planMatteRange({ totalFrames, startFrame = 0, frames }) {
  wholeFrames(totalFrames, 'the source length', 1);
  if (!Number.isInteger(startFrame) || startFrame < 0 || startFrame >= totalFrames) fail(`the start frame must be inside the source (0 to ${totalFrames - 1}), got ${startFrame}.`);
  const count = frames === undefined ? totalFrames - startFrame : frames;
  if (!Number.isInteger(count) || count < 1) fail(`a matte needs at least one frame, got ${count}.`);
  if (startFrame + count > totalFrames) fail(`the range ${startFrame}+${count} is not inside the source (${totalFrames} frames).`);
  if (count > MATTE_MAX_FRAMES) fail(`${count} frames is too long for one matte (limit ${MATTE_MAX_FRAMES}).`);
  return { startFrame, frames: count };
}

/**
 * Which mask is the person. A background mask is inverted (so a four-class model and a two-class one work the same way);
 * a lone unnamed mask is the person; an unnamed pair is background first.
 */
export function pickPersonMask(labels, count) {
  if (!Number.isInteger(count) || count < 1) fail('the segmenter returned no mask.');
  const names = Array.isArray(labels) ? labels.map((label) => String(label).toLowerCase()) : [];
  const background = names.findIndex((label) => /background|backdrop/.test(label));
  if (background >= 0 && background < count) return { index: background, invert: true };
  if (count === 1) return { index: 0, invert: false };
  if (names.length === 0 && count === 2) return { index: 0, invert: true };
  const person = names.findIndex((label) => /person|selfie|foreground|human/.test(label));
  if (person >= 0 && person < count) return { index: person, invert: false };
  fail(`could not tell which of the ${count} masks is the person (labels: ${names.join(', ') || 'none'}).`);
}

/** Writes the person confidence (0 to 255) of one frame into `out`. */
export function personConfidence(masks, pick, out) {
  const source = masks[pick.index];
  if (!source || source.length !== out.length) fail(`the mask has ${source?.length ?? 'no'} values, the frame has ${out.length}.`);
  for (let i = 0; i < out.length; i++) {
    const value = pick.invert ? 1 - source[i] : source[i];
    out[i] = value <= 0 ? 0 : value >= 1 ? 255 : Math.round(value * 255);
  }
  return out;
}

/** The soft edge: a smoothstep between the floor and the ceiling. */
export function alphaFromConfidence(confidence, out, { low, high }) {
  if (!(high > low)) fail('the alpha ceiling must be above its floor.');
  for (let i = 0; i < out.length; i++) {
    const t = Math.min(1, Math.max(0, (confidence[i] / 255 - low) / (high - low)));
    out[i] = Math.round(255 * t * t * (3 - 2 * t));
  }
  return out;
}

/** A separable box blur with clamped edges. Radius 0 copies the input. */
export function boxBlur(source, width, height, radius, out) {
  if (radius <= 0) { out.set(source); return out; }
  const tmp = new Uint8Array(width * height);
  const size = radius * 2 + 1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += source[row + Math.min(width - 1, Math.max(0, x + k))];
      tmp[row + x] = Math.round(sum / size);
    }
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += tmp[Math.min(height - 1, Math.max(0, y + k)) * width + x];
      out[y * width + x] = Math.round(sum / size);
    }
  }
  return out;
}

/** Blur, then ease small changes against the previous frame so the edge does not shimmer. A large change is followed at once. */
export function refineAlpha(raw, previous, width, height, settings = MATTE_SETTINGS) {
  const soft = boxBlur(raw, width, height, settings.blur, new Uint8Array(width * height));
  if (!previous) return soft;
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i++) {
    const delta = soft[i] - previous[i];
    out[i] = Math.abs(delta) > settings.jump ? soft[i] : Math.round(soft[i] - delta * settings.temporal);
  }
  return out;
}

const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};

/** A short name for one matte: what it was cut from, how, and with which model. */
export function matteKey(parts) {
  return createHash('sha256').update(stable({ version: MATTE_VERSION, ...parts })).digest('hex').slice(0, 16);
}

export function mattePaths(project, key) {
  if (typeof project !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(project)) fail(`the project must be a lowercase slug, got ${JSON.stringify(project)}.`);
  if (!/^[a-f0-9]{16}$/.test(key)) fail('the matte key must be 16 hex digits.');
  const src = `_prepared/${project}/matte-${key}.webm`;
  return { src, file: `engine/public/${src}` };
}

/** The `foreground` object a scene carries (creative-kit/kinetic/schema.ts foregroundSchema), before it is placed on a scene. */
export function foregroundRecord({ src, sourceSha256, sourceFromFrame, frames }) {
  return { src, sourceSha256, sourceFromFrame, frames, trimBeforeFrame: 0 };
}

/**
 * Puts a matte on a scene: finds the matte frame that sits under the scene's first frame, and refuses a matte that is from another
 * source, does not cover the scene, or a scene that runs across a cut (the matte and the picture would drift apart).
 */
export function attachForeground(manifest, sceneId, record) {
  const index = manifest.scenes.findIndex((scene) => scene.id === sceneId);
  if (index < 0) fail(`there is no scene named ${JSON.stringify(sceneId)}.`);
  const scene = manifest.scenes[index];
  if (!FOREGROUND_FAMILIES.includes(scene.family)) fail(`${scene.family} does not take a foreground (${FOREGROUND_FAMILIES.join(', ')} do).`);
  if (record.sourceSha256 !== manifest.source.sha256) fail('this matte was cut from another source than the one in the edit.');
  let first;
  let last;
  try {
    first = foregroundSourceFrame(manifest, scene.fromFrame);
    last = foregroundSourceFrame(manifest, scene.fromFrame + scene.durationInFrames - 1);
  } catch {
    fail(`scene ${sceneId} is not inside the edit.`);
  }
  if (last - first !== scene.durationInFrames - 1) fail(`scene ${sceneId} runs across a cut; split it at the cut, because the matte follows the source frames.`);
  const trim = first - record.sourceFromFrame;
  if (trim < 0 || trim + scene.durationInFrames > record.frames) {
    fail(`the matte (source frames ${record.sourceFromFrame} to ${record.sourceFromFrame + record.frames - 1}) does not cover scene ${sceneId} (source frames ${first} to ${last}).`);
  }
  const scenes = manifest.scenes.slice();
  scenes[index] = { ...scene, data: { ...scene.data, foreground: { ...record, trimBeforeFrame: trim } } };
  return { manifest: { ...manifest, scenes }, trimBeforeFrame: trim };
}

const even = (value, label) => { if (!Number.isInteger(value) || value < 2 || value % 2 !== 0) fail(`${label} must be an even number, got ${value}.`); return value; };
const fpsText = (value) => { if (typeof value !== 'string' || !FPS_TEXT.test(value) || value.split('/').some((part) => Number(part) === 0)) fail(`fps must look like 30 or 30000/1001, got ${JSON.stringify(value)}.`); return value; };

const regularStamps = (fps) => `setpts=N/((${fps})*TB)`;

/** ffmpeg: the wanted frames of the source as raw RGBA at the analysis size, on stdout. */
export function decodeArgs({ input, startFrame, frames, width, height, fps }) {
  even(width, 'the analysis width');
  even(height, 'the analysis height');
  fpsText(fps);
  return ['-v', 'error', '-nostdin', '-i', input, '-map', '0:v:0', '-an', '-sn', '-dn',
    '-vf', `trim=start_frame=${startFrame}:end_frame=${startFrame + frames},${regularStamps(fps)},scale=${width}:${height}:flags=area,setsar=1,format=rgba`,
    '-fps_mode', 'passthrough', '-f', 'rawvideo', 'pipe:1'];
}

/** ffmpeg: 8-bit raw alpha frames on stdin, kept lossless in a small file until they are merged. */
export function alphaEncodeArgs({ width, height, fps, out }) {
  even(width, 'the analysis width');
  even(height, 'the analysis height');
  fpsText(fps);
  return ['-v', 'error', '-nostdin', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${width}x${height}`, '-framerate', fps, '-i', 'pipe:0',
    '-an', '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'gray', out];
}

/** ffmpeg: the source frames with the alpha merged in, as a VP9 clip with a real alpha channel. */
export function mergeArgs({ input, alpha, startFrame, frames, width, height, fps, out, crf = 24 }) {
  even(width, 'the output width');
  even(height, 'the output height');
  fpsText(fps);
  const stamps = regularStamps(fps);
  const graph = `[0:v:0]trim=start_frame=${startFrame}:end_frame=${startFrame + frames},${stamps},scale=${width}:${height}:flags=lanczos,setsar=1,format=yuv420p[v];`
    + `[1:v:0]${stamps},scale=${width}:${height}:flags=bicubic,format=gray[a];[v][a]alphamerge,format=yuva420p[o]`;
  return ['-v', 'error', '-nostdin', '-y', '-i', input, '-i', alpha, '-filter_complex', graph, '-map', '[o]', '-an', '-r', fps,
    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', String(crf), '-row-mt', '1', '-auto-alt-ref', '0',
    '-deadline', 'good', '-cpu-used', '2', '-threads', '2', '-metadata:s:v:0', 'alpha_mode=1', out];
}

/**
 * A head and shoulders shape (0 or 255 per pixel). It stands in for the model in tests and in the demo stills, where a
 * synthetic subject is wanted on purpose; it is never used for a real edit.
 */
export function standInSpeakerMask({ width, height }) {
  const out = new Uint8Array(width * height);
  const head = { cx: width * 0.5, cy: height * 0.38, rx: width * 0.17, ry: height * 0.12 };
  const body = { cx: width * 0.5, cy: height * 0.86, rx: width * 0.42, ry: height * 0.34 };
  const inside = (x, y, e) => ((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2 <= 1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const neck = Math.abs(x - width * 0.5) < width * 0.07 && y > height * 0.45 && y < height * 0.56;
    if (inside(x + 0.5, y + 0.5, head) || inside(x + 0.5, y + 0.5, body) || neck) out[y * width + x] = 255;
  }
  return out;
}
