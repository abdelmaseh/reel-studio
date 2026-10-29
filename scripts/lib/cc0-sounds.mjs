// The bundled CC0 recordings in Sound-Kits/cc0: the provenance ledger (ledger.json), a WAV reader, the sample voice used by scripts/sfx.mjs
// (`sample:<id>` hits) and the helpers that turn a stamped ledger into catalog recipes. Pure Node, no network, no side effects at import.
//
// Rules from instructions/SOUND.md: recorded effects ship only when CC0 with a ledger entry (rule 12); no music; no sweeps; no buzzer.
import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const SAMPLE_PREFIX = 'sample:';
export const SOUND_KINDS = Object.freeze(['click', 'pop', 'chime', 'tick', 'type', 'reject', 'landing', 'paper']);
export const BUDGET_BYTES = 8 * 1024 * 1024;
export const MAX_SAMPLE_SECONDS = 1.2;
const SAMPLE_RATE = 48000;
const PEAK = 0.7;
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

// Words that mark a source file as something the sound guide does not allow: air sweeps and swipes, glissando risers, error buzzers and
// alarms, music-like jingles and loops. They are checked against the words of the source file name.
export const FORBIDDEN_CUE_WORDS = Object.freeze([
  'whoosh', 'woosh', 'swoosh', 'swish', 'swipe', 'sweep', 'rise', 'riser', 'send', 'open', 'close', 'expand', 'collapse', 'skip', 'back', 'forward',
  'minimize', 'maximize', 'scroll', 'error', 'warning', 'blocked', 'buzz', 'buzzer', 'alarm', 'siren',
  'level', 'achievement', 'streak', 'bonus', 'reward', 'jingle', 'fanfare', 'melody', 'music', 'loop',
  'loading', 'processing', 'recording', 'connecting', 'scanning', 'streaming',
]);

const fail = (message) => { throw new Error(message); };
const exactKeys = (value, keys, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object.`);
  const actual = Object.keys(value).sort(), expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, i) => key !== expected[i])) fail(`${label} must have exactly these fields: ${expected.join(', ')}.`);
  return value;
};
const text = (value, label, max = 400) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${label} must be text of 1..${max} characters.`);
  return value;
};

const SOURCE_REQUIRED = ['name', 'author', 'home', 'licence', 'licenceUrl', 'base'];
const SOURCE_OPTIONAL = ['ref', 'via', 'official', 'licenceBytes', 'note'];
const SOUND_KEYS = ['id', 'file', 'kind', 'source', 'origin', 'originUrl', 'originBytes', 'originSeconds', 'use', 'sha256', 'bytes', 'seconds', 'channels'];

/** The words of a source file name ("impact_soft_heavy_000.ogg" -> impact, soft, heavy). */
const cueWords = (origin) => origin.split('/').pop().replace(/\.[A-Za-z0-9]+$/, '').toLowerCase().split(/[^a-z]+/).filter(Boolean);

/** Throws when the ledger breaks a rule; returns it otherwise. */
export function validateLedger(ledger) {
  exactKeys(ledger, ['version', 'licence', 'format', 'note', 'sources', 'sounds'], 'ledger');
  if (ledger.version !== 1) fail('ledger version must be 1.');
  if (ledger.licence !== 'CC0-1.0') fail('Every bundled sound must be CC0-1.0: the ledger licence must say CC0-1.0.');
  exactKeys(ledger.format, ['container', 'encoding', 'sampleRate'], 'ledger format');
  if (ledger.format.container !== 'wav' || ledger.format.encoding !== 'pcm_s16le' || ledger.format.sampleRate !== SAMPLE_RATE) fail('ledger format must be wav, pcm_s16le, 48000.');
  text(ledger.note, 'ledger note', 800);
  if (!ledger.sources || typeof ledger.sources !== 'object' || Array.isArray(ledger.sources) || Object.keys(ledger.sources).length === 0) fail('ledger sources must list at least one source.');
  for (const [id, source] of Object.entries(ledger.sources)) {
    if (!SLUG.test(id)) fail(`source id ${id} must be a slug.`);
    for (const key of Object.keys(source)) if (![...SOURCE_REQUIRED, ...SOURCE_OPTIONAL].includes(key)) fail(`source ${id} has an unexpected field: ${key}.`);
    for (const key of SOURCE_REQUIRED) text(source[key], `source ${id} ${key}`, 600);
    if (source.licence !== 'CC0-1.0') fail(`source ${id} must be CC0-1.0 (found ${String(source.licence)}).`);
    if (!/^https:\/\//.test(source.base) || !source.base.endsWith('/')) fail(`source ${id} base must be an https url ending in /.`);
    if (source.ref !== undefined && !/^[0-9a-f]{40}$/.test(source.ref)) fail(`source ${id} ref must be a full commit hash.`);
  }
  if (!Array.isArray(ledger.sounds) || ledger.sounds.length === 0 || ledger.sounds.length > 40) fail('ledger sounds must list 1..40 files.');
  const ids = new Set(), files = new Set();
  let total = 0;
  for (const [index, sound] of ledger.sounds.entries()) {
    const label = `sound ${index} (${String(sound?.id)})`;
    exactKeys(sound, SOUND_KEYS, label);
    if (typeof sound.id !== 'string' || !SLUG.test(sound.id)) fail(`${label}: id must be a lowercase slug.`);
    if (ids.has(sound.id) || files.has(sound.file)) fail(`${label}: duplicate id or file.`);
    ids.add(sound.id); files.add(sound.file);
    if (sound.file !== `${sound.id}.wav`) fail(`${label}: file must be ${sound.id}.wav.`);
    if (!SOUND_KINDS.includes(sound.kind)) fail(`${label}: kind must be one of ${SOUND_KINDS.join(', ')}.`);
    const source = ledger.sources[sound.source];
    if (!source) fail(`${label}: unknown source ${String(sound.source)}.`);
    text(sound.origin, `${label} origin`, 300);
    const banned = cueWords(sound.origin).filter((word) => FORBIDDEN_CUE_WORDS.includes(word));
    if (banned.length) fail(`${label}: the source file name says ${banned.join(', ')}, which the sound guide does not allow (sweeps, buzzers, music).`);
    if (typeof sound.originUrl !== 'string' || !sound.originUrl.startsWith(source.base)) fail(`${label}: originUrl must start with the base of source ${sound.source}.`);
    if (!Number.isInteger(sound.originBytes) || sound.originBytes < 100 || sound.originBytes > 2_000_000) fail(`${label}: originBytes must be the exact source size in bytes.`);
    if (sound.originSeconds !== null && !(typeof sound.originSeconds === 'number' && sound.originSeconds > 0 && sound.originSeconds <= 10)) fail(`${label}: originSeconds is a number of seconds or null.`);
    text(sound.use, `${label} use`, 300);
    const stamp = [sound.sha256, sound.bytes, sound.seconds, sound.channels];
    if (stamp.some((value) => value !== null) && stamp.some((value) => value === null)) fail(`${label}: a stamp is complete or absent (sha256, bytes, seconds and channels together).`);
    if (sound.sha256 !== null) {
      if (!/^[0-9a-f]{64}$/.test(sound.sha256)) fail(`${label}: sha256 must be 64 hex digits.`);
      if (!Number.isInteger(sound.bytes) || sound.bytes < 44) fail(`${label}: bytes must be the file size.`);
      if (!(typeof sound.seconds === 'number' && sound.seconds > 0 && sound.seconds <= MAX_SAMPLE_SECONDS)) fail(`${label}: seconds must be 0..${MAX_SAMPLE_SECONDS} (a sound effect, not a track).`);
      if (sound.channels !== 1 && sound.channels !== 2) fail(`${label}: channels must be 1 or 2.`);
      total += sound.bytes;
    }
  }
  if (total > BUDGET_BYTES) fail(`The stamped files add up to ${total} bytes; the budget is ${BUDGET_BYTES}.`);
  return ledger;
}

// ---- WAV ------------------------------------------------------------------------------------------------------------------------------

/**
 * Decodes a WAV (PCM 8/16/24/32-bit or 32-bit float, mono or stereo) to Float32 channels in -1..1.
 * Returns { sampleRate, channels, left, right } with `right` null for mono.
 */
export function readWav(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') fail('Not a WAV file (no RIFF/WAVE header).');
  let format = null, data = null;
  for (let at = 12; at + 8 <= buffer.length;) {
    const id = buffer.toString('ascii', at, at + 4), size = buffer.readUInt32LE(at + 4), start = at + 8;
    if (id === 'fmt ') {
      if (size < 16 || start + size > buffer.length) fail('WAV fmt chunk is truncated.');
      let tag = buffer.readUInt16LE(start);
      if (tag === 0xfffe && size >= 26) tag = buffer.readUInt16LE(start + 24);
      format = {tag, channels: buffer.readUInt16LE(start + 2), sampleRate: buffer.readUInt32LE(start + 4), bits: buffer.readUInt16LE(start + 14)};
    } else if (id === 'data') {
      if (start + size > buffer.length) fail('WAV data chunk is truncated.');
      data = buffer.subarray(start, start + size);
      break;
    }
    at = start + size + (size % 2);
  }
  if (!format) fail('WAV has no fmt chunk.');
  if (!data) fail('WAV has no data chunk.');
  const {tag, channels, sampleRate, bits} = format;
  if (channels !== 1 && channels !== 2) fail(`WAV has ${channels} channels; the bundled sounds are mono or stereo.`);
  if (!(sampleRate >= 8000 && sampleRate <= 192000)) fail(`WAV sample rate ${sampleRate} is not usable.`);
  const isFloat = tag === 3 && bits === 32;
  if (!(tag === 1 && [8, 16, 24, 32].includes(bits)) && !isFloat) fail(`WAV encoding not supported (tag ${tag}, ${bits} bit): use PCM or 32-bit float.`);
  const bytes = bits / 8, frames = Math.floor(data.length / (bytes * channels));
  const left = new Float32Array(frames), right = channels === 2 ? new Float32Array(frames) : null;
  const sample = (offset) => {
    if (isFloat) return data.readFloatLE(offset);
    if (bits === 8) return (data[offset] - 128) / 128;
    if (bits === 16) return data.readInt16LE(offset) / 32768;
    if (bits === 24) return data.readIntLE(offset, 3) / 8388608;
    return data.readInt32LE(offset) / 2147483648;
  };
  for (let i = 0; i < frames; i++) {
    left[i] = sample(i * bytes * channels);
    if (right) right[i] = sample(i * bytes * channels + bytes);
  }
  return {sampleRate, channels, left, right};
}

const resample = (input, from) => {
  if (from === SAMPLE_RATE) return input;
  const n = Math.round(input.length * SAMPLE_RATE / from), out = new Float32Array(n), ratio = from / SAMPLE_RATE;
  for (let i = 0; i < n; i++) {
    const position = i * ratio, base = Math.floor(position), fraction = position - base;
    const a = input[Math.min(base, input.length - 1)], b = input[Math.min(base + 1, input.length - 1)];
    out[i] = a + (b - a) * fraction;
  }
  return out;
};

// ---- the sample voice used by scripts/sfx.mjs -----------------------------------------------------------------------------------------

const DEFAULT_ROOT = fileURLToPath(new URL('../../Sound-Kits/cc0/', import.meta.url));
let rootOverride = null;
const ledgers = new Map(), voices = new Map();

/** Tests point the loader at a temporary folder; `null` goes back to Sound-Kits/cc0. */
export function setCc0Root(dir) {
  rootOverride = dir;
  ledgers.clear(); voices.clear();
}
const root = () => rootOverride ?? DEFAULT_ROOT;

export function loadLedgerSync() {
  const dir = root();
  if (!ledgers.has(dir)) ledgers.set(dir, validateLedger(JSON.parse(readFileSync(path.join(dir, 'ledger.json'), 'utf8'))));
  return ledgers.get(dir);
}

/** The ids a `sample:<id>` hit may name. */
export const ledgerSampleIds = () => new Set(loadLedgerSync().sounds.map((sound) => sound.id));

/**
 * A mono Float32Array or { left, right } at 48 kHz, peak-normalised to 0.7 so one hit gain means the same level for every file.
 * Throws a clear error for an id that is not in the ledger and for a file that is not installed yet.
 */
export function cc0Sample(id) {
  const dir = root(), key = `${dir}\u0000${id}`;
  if (voices.has(key)) return voices.get(key);
  const ledger = loadLedgerSync();
  const sound = ledger.sounds.find((item) => item.id === id);
  if (!sound) fail(`Unknown sample "${id}". Ledgered samples: ${ledger.sounds.map((item) => item.id).join(', ')}.`);
  const file = path.join(dir, sound.file);
  if (!existsSync(file)) {
    fail(`sample:${id} needs Sound-Kits/cc0/${sound.file}, which is not installed yet. The CC0 files are put in place after the owner approves their download: `
      + '`node scripts/cc0-sounds.mjs urls` lists them, `convert --from <folder>` and `stamp` finish the install.');
  }
  const wav = readWav(readFileSync(file));
  const left = resample(wav.left, wav.sampleRate), right = wav.right ? resample(wav.right, wav.sampleRate) : null;
  let peak = 0;
  for (const channel of right ? [left, right] : [left]) for (let i = 0; i < channel.length; i++) peak = Math.max(peak, Math.abs(channel[i]));
  const scale = peak > 0 ? PEAK / peak : 1;
  for (const channel of right ? [left, right] : [left]) for (let i = 0; i < channel.length; i++) channel[i] *= scale;
  const voice = right ? {left, right} : left;
  voices.set(key, voice);
  return voice;
}

// ---- install helpers (used by scripts/cc0-sounds.mjs) -------------------------------------------------------------------------------

/** ffmpeg arguments that make the shipped file: 48 kHz 16-bit WAV, leading silence trimmed, channels kept, no tags, no loudness change. */
export const ffmpegArgs = (input, output) => [
  '-y', '-i', input, '-vn', '-map_metadata', '-1',
  '-af', 'silenceremove=start_periods=1:start_threshold=-50dB:detection=peak',
  '-ar', String(SAMPLE_RATE), '-c:a', 'pcm_s16le', '-fflags', '+bitexact', '-flags:a', '+bitexact', output,
];

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** One catalog recipe per stamped sound: `cc0-<id>`, a single hit at t=0. Needs the stamp (durations). */
export function recipesFromLedger(ledger) {
  validateLedger(ledger);
  return ledger.sounds.map((sound) => {
    if (sound.sha256 === null) fail(`Stamp the ledger first (node scripts/cc0-sounds.mjs stamp): ${sound.id} has no duration yet.`);
    return {
      id: `cc0-${sound.id}`,
      name: `CC0 ${sound.id.replaceAll('-', ' ')}`,
      use: sound.use,
      duration: Math.ceil((sound.seconds + 0.01) * 100) / 100,
      hits: [{t: 0, sound: `${SAMPLE_PREFIX}${sound.id}`, gain: 0.3, pan: 0, opts: {}}],
    };
  });
}

/** A copy of the catalog whose `cc0-*` recipes are replaced by `recipes`; the other recipes stay where they are. */
export function mergeCc0Recipes(catalog, recipes) {
  return {...structuredClone(catalog), recipes: [...catalog.recipes.filter((recipe) => !recipe.id.startsWith('cc0-')).map((recipe) => structuredClone(recipe)), ...structuredClone(recipes)]};
}

const recipeBlock = (recipe, eol) => [
  '    {',
  `      "id": ${JSON.stringify(recipe.id)}, "name": ${JSON.stringify(recipe.name)}, "use": ${JSON.stringify(recipe.use)}, "duration": ${recipe.duration},`,
  `      "hits": [${recipe.hits.map((hit) => `{ "t": ${hit.t}, "sound": ${JSON.stringify(hit.sound)}, "gain": ${hit.gain}, "pan": ${hit.pan}, "opts": {} }`).join(', ')}]`,
  '    }',
].join(eol);

/**
 * Sound-Kits/catalog.json with its `cc0-*` recipes (always the last ones) replaced by `recipes`, written in the file's own layout and line
 * endings so the diff shows only those recipes. The result is parsed and compared with mergeCc0Recipes() before it is returned.
 */
export function spliceCatalogText(text, recipes) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const closing = `${eol}  ]${eol}}`;
  const end = text.lastIndexOf(closing);
  if (end < 0) fail('catalog.json does not end with its recipes array.');
  let body = text.slice(0, end);
  const first = body.indexOf(`    {${eol}      "id": "cc0-`);
  if (first >= 0) body = body.slice(0, first).replace(/,\s*$/, '');
  const blocks = recipes.map((recipe) => recipeBlock(recipe, eol));
  const result = `${body}${blocks.length ? `,${eol}` : ''}${blocks.join(`,${eol}`)}${text.slice(end)}`;
  try {
    assert.deepEqual(JSON.parse(result), mergeCc0Recipes(JSON.parse(text), recipes));
  } catch (error) {
    fail(`The catalog text could not be updated safely (${error.message.split('\n')[0]}).`);
  }
  return result;
}

// ---- install status, stamp and convert (the CLI in scripts/cc0-sounds.mjs wraps these) ---------------------------------------------

/** Downloaded sources are saved as <id> plus the extension of the source file, because two packs can both ship a press.ogg. */
export const savedName = (sound) => `${sound.id}${path.extname(sound.origin)}`;

/** The rows the owner approves: what to download, from where, how big. */
export function downloadTable(ledger) {
  validateLedger(ledger);
  const files = ledger.sounds.map((sound) => ({id: sound.id, file: sound.file, kind: sound.kind, url: sound.originUrl, bytes: sound.originBytes, source: sound.source, saveAs: savedName(sound)}));
  return {
    files,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    licences: Object.entries(ledger.sources).map(([id, source]) => ({source: id, licence: source.licence, url: source.licenceUrl, bytes: source.licenceBytes ?? null})),
  };
}

export function installStatus(ledger, dir = root()) {
  return ledger.sounds.map((sound) => ({id: sound.id, file: sound.file, installed: existsSync(path.join(dir, sound.file)), stamped: sound.sha256 !== null}));
}

/** A copy of the ledger with sha256, bytes, seconds and channels filled in for every file that is present. */
export function stampLedger(ledger, dir = root()) {
  const next = structuredClone(ledger), missing = [];
  for (const sound of next.sounds) {
    const file = path.join(dir, sound.file);
    if (!existsSync(file)) { missing.push(sound.id); continue; }
    const bytes = readFileSync(file), wav = readWav(bytes);
    if (wav.sampleRate !== SAMPLE_RATE) fail(`${sound.file} is ${wav.sampleRate} Hz; run convert (48 kHz) before stamp.`);
    Object.assign(sound, {sha256: sha256(bytes), bytes: bytes.length, seconds: Math.round(wav.left.length / SAMPLE_RATE * 1000) / 1000, channels: wav.channels});
  }
  return {ledger: validateLedger(next), stamped: next.sounds.length - missing.length, missing};
}

/** Problems with the installed files: a changed file, a long one, a silent or clipped one. An empty list is clean. */
/** Consecutive full-scale samples that count as clipping. */
export const CLIP_RUN = 3;

export function checkInstalled(ledger, dir = root()) {
  const problems = [];
  for (const sound of ledger.sounds) {
    const file = path.join(dir, sound.file);
    if (!existsSync(file)) continue;
    const bytes = readFileSync(file);
    if (sound.sha256 === null) problems.push(`${sound.id}: installed but not stamped`);
    else if (sha256(bytes) !== sound.sha256) problems.push(`${sound.id}: the file changed since it was stamped`);
    const wav = readWav(bytes);
    if (wav.sampleRate !== SAMPLE_RATE) problems.push(`${sound.id}: ${wav.sampleRate} Hz instead of 48000`);
    if (wav.left.length / wav.sampleRate > MAX_SAMPLE_SECONDS) problems.push(`${sound.id}: longer than ${MAX_SAMPLE_SECONDS} s`);
    // Clipped means flat tops: CLIP_RUN or more samples in a row at full scale. One full-scale sample is a peak-normalised file, not distortion.
    let peak = 0, run = 0, longestRun = 0;
    for (const channel of wav.right ? [wav.left, wav.right] : [wav.left]) {
      run = 0;
      for (let i = 0; i < channel.length; i++) {
        const level = Math.abs(channel[i]);
        peak = Math.max(peak, level);
        run = level >= 0.999 ? run + 1 : 0;
        longestRun = Math.max(longestRun, run);
      }
    }
    if (peak < 0.02) problems.push(`${sound.id}: silent (peak ${peak.toFixed(3)})`);
    if (longestRun >= CLIP_RUN) problems.push(`${sound.id}: clipped (${longestRun} samples in a row at full scale)`);
  }
  return problems;
}

/**
 * Converts the downloaded source files in `fromDir` (each saved as savedName(): the id plus the source extension) into the shipped WAVs in `toDir`.
 * A source whose size differs from the ledger is refused. `run(args)` starts ffmpeg; it is a parameter so tests need no binary.
 */
export async function convertAll(ledger, fromDir, toDir, run) {
  const done = [], missing = [];
  for (const sound of ledger.sounds) {
    const input = path.join(fromDir, savedName(sound));
    if (!existsSync(input)) { missing.push(savedName(sound)); continue; }
    const size = readFileSync(input).length;
    if (size !== sound.originBytes) fail(`${path.basename(input)} is ${size} bytes; the ledger expects ${sound.originBytes} (${sound.originUrl}).`);
    await run(ffmpegArgs(input, path.join(toDir, sound.file)));
    done.push(sound.id);
  }
  return {converted: done, missing};
}
