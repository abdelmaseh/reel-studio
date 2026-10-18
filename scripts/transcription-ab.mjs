import './lib/project-tmp.mjs';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ROOT, ffprobeJson } from './lib/media.mjs';
import { cliArgs } from './lib/job-paths.mjs';
import { assertProjectOutput } from './lib/project-paths.mjs';
import { assertTranscriptionOutputPath } from './lib/transcription.mjs';
import { AB_DEFAULTS, parseChunkList, runAbPlan } from './lib/transcription-compare.mjs';

const USAGE = 'Usage: node scripts/transcription-ab.mjs <recording>... [--lang ar] [--start 0] [--duration 90] [--chunks 14,30] [--overlap 2] [--threads 4] '
  + '[--reference <reviewed captions.json>] [--reuse] [--out state/qa/transcription-ab/<stamp>]\n'
  + 'The first recording is the one the --reference file belongs to. The first chunk size is the baseline. Reads recordings only; writes under state/qa/.';
const FLAGS = ['lang', 'start', 'duration', 'chunks', 'overlap', 'threads', 'reference', 'reuse', 'out'];
const number = (value, name, min, max, fallback) => {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new Error(`Invalid --${name}. Expected ${min} to ${max}.\n${USAGE}`);
  return parsed;
};

/** Validates the command line. Pure apart from path resolution; nothing is read or written. */
export function parseAbArgs(argv, { now = () => new Date() } = {}) {
  const args = cliArgs(argv, FLAGS, ['reuse']);
  if (!args._.length) throw new Error(`Name at least one recording.\n${USAGE}`);
  const overlapSec = number(args.overlap, 'overlap', 0, 10, AB_DEFAULTS.overlapSec);
  const threads = number(args.threads, 'threads', 1, 12, AB_DEFAULTS.threads);
  if (!Number.isInteger(threads)) throw new Error('--threads must be an integer.');
  const chunks = args.chunks === undefined ? [...AB_DEFAULTS.chunks] : parseChunkList(args.chunks, overlapSec);
  if (chunks.some((size) => size <= overlapSec)) throw new Error('Every chunk size must be longer than --overlap.');
  const lang = args.lang ?? AB_DEFAULTS.lang;
  if (!/^(auto|[a-z]{2,3})$/i.test(lang)) throw new Error('Invalid language code.');
  const stamp = now().toISOString().replace(/\.\d+Z$/, '').replace(/[-:]/g, '').replace('T', '-');
  // The studio's own output guard first (outside the studio, Raw/, Reference/ and .git are refused), then the comparison folder must be new and under state/qa/.
  const target = assertProjectOutput(path.resolve(ROOT, args.out ?? `state/qa/transcription-ab/${stamp}`));
  const outRoot = path.relative(ROOT, target).split(path.sep).join('/');
  if (!outRoot.toLowerCase().startsWith('state/qa/')) throw new Error('--out must be a new folder under state/qa/.');
  assertTranscriptionOutputPath(target); // the folder holds transcription outputs: no symlink or junction on the way
  return {
    recordings: args._.map((media, index) => ({ media, reference: index === 0 && args.reference !== undefined ? args.reference : null })),
    settings: { lang: lang.toLowerCase(), startSec: number(args.start, 'start', 0, 86400, AB_DEFAULTS.startSec), durationSec: number(args.duration, 'duration', 10, 3600, AB_DEFAULTS.durationSec),
      chunks, overlapSec, threads, reuse: args.reuse === true },
    outRoot,
  };
}

const wordsOf = (value) => {
  const words = Array.isArray(value) ? value : value?.captions ?? value?.words;
  if (!Array.isArray(words) || !words.every((word) => typeof word?.text === 'string' && Number.isFinite(word.startMs) && Number.isFinite(word.endMs))) {
    throw new Error('A captions file needs a words array with text, startMs and endMs.');
  }
  return words;
};

// Every path the user types is relative to the studio folder, so the command works from any working directory; the report keeps studio-relative paths.
const inStudio = (file) => path.resolve(ROOT, file);
const fromStudio = (file) => path.relative(ROOT, file).split(path.sep).join('/');
const exists = (file) => fs.stat(file).then(() => true, () => false);
const isFile = async (file) => (await fs.stat(file).catch(() => null))?.isFile() === true;

// The same figure transcribeMedia limits a range by: the first audio stream, else the container.
async function probeAudioDuration(media) {
  const probe = await ffprobeJson(inStudio(media));
  const stream = (probe.streams ?? []).find((entry) => entry.codec_type === 'audio');
  if (!stream) throw new Error(`No audio stream in ${media}.`);
  const seconds = Number(stream.duration ?? probe.format?.duration);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`The audio duration of ${media} is unavailable.`);
  return seconds;
}

/** The whole command. The real transcription, probe and clock are the defaults; the tests inject fakes so no test decodes audio. */
export async function runAbCommand(argv, { transcribeMedia = null, audioDurationSec = probeAudioDuration, now = () => new Date(), write = (text) => process.stderr.write(text) } = {}) {
  const { recordings, settings, outRoot } = parseAbArgs(argv, { now });
  const out = inStudio(outRoot);
  // Everything that can be wrong is checked before the folder is created or anything is decoded.
  if (await exists(out)) throw new Error(`${outRoot} already exists; a comparison folder is never reused. Pick a new --out.`);
  for (const recording of recordings) {
    if (!(await isFile(inStudio(recording.media)))) throw new Error(`Recording not found: ${recording.media}`);
    if (recording.reference && !(await isFile(inStudio(recording.reference)))) throw new Error(`Reference not found: ${recording.reference}`);
  }
  for (const recording of recordings) if (settings.startSec >= await audioDurationSec(recording.media)) throw new Error(`--start is outside ${recording.media}.`);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.mkdir(out).catch((error) => { // never reused: an existing folder is an error
    throw error.code === 'EEXIST' ? new Error(`${outRoot} already exists; a comparison folder is never reused. Pick a new --out.`) : error;
  });
  const transcribe = transcribeMedia ?? (await import('./lib/transcription-run.mjs')).transcribeMedia;
  const report = await runAbPlan({
    recordings, settings, outRoot, now,
    transcribe: async (args) => {
      const result = await transcribe({ ...args, media: inStudio(args.media), out: inStudio(args.out) }, { onProgress: (message) => write(`  ${message}\n`) });
      return { ...result, outDir: fromStudio(result.outDir) };
    },
    readCaptions: async (outDir) => wordsOf(JSON.parse(await fs.readFile(path.resolve(ROOT, outDir, 'captions.json'), 'utf8'))),
    readReference: async (file) => wordsOf(JSON.parse(await fs.readFile(inStudio(file), 'utf8'))),
    audioDurationSec,
    log: (message) => write(`[ab] ${message}\n`),
  });
  const file = path.join(out, 'ab-report.json');
  await fs.writeFile(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return { ok: true, report: fromStudio(file), verdict: report.verdict, recommendedChunkSeconds: report.recommendedChunkSeconds, reasons: report.reasons,
    recordings: report.recordings.map((entry) => ({ media: entry.media, referenced: entry.reference !== null, verdict: entry.verdict, decodeSec: entry.runs.map((run) => [run.chunkSeconds, run.decodeSec]) })) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await runAbCommand(process.argv.slice(2)), null, 2)); } catch (error) { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; }
}
