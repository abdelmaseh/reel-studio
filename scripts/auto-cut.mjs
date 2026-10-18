import './lib/project-tmp.mjs';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {parseArgs, writeJson} from './lib/media.mjs';
import {ROOT, assertProjectOutput} from './lib/project-paths.mjs';
import {profileSignOff} from './lib/branding.mjs';
import {proposeCuts, approvedSegments, parseWav, rmsEnvelope, silencesFromRms, summarizeProposal, formatProposalTable,
  DEFAULT_GAP_SEC, DEFAULT_PAD_MS} from './lib/auto-cut.mjs';

const USAGE = 'Usage: node scripts/auto-cut.mjs --captions <words.json|edit.json> (--audio-cache <audio-analysis.json> | --wav <file.wav>) ' +
  '--fps <n> --out <proposal.json> [--total-frames N] [--gap 0.35] [--pad 120,180] [--signoff-sec S | --signoff-phrase "text" (default: PROFILE.json ending.signOff)] [--protect "a-b,c-d"] [--silence-db -35]';
const APPROVE_USAGE = 'Usage: node scripts/auto-cut.mjs --from <auto-cut.json> --approve all|none|1,4 --out <approved.json>';
const rel = (p) => (p ? path.relative(ROOT, path.resolve(p)).split(path.sep).join('/') : null);
const number = (value, name) => {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error(`--${name} needs a value.`);
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`--${name} must be a number.`);
  return n;
};

const wordsOf = (captions) => {
  const words = Array.isArray(captions) ? captions
    : Array.isArray(captions.words) ? captions.words
      : Array.isArray(captions.captions) ? captions.captions
        : captions.captions?.words;
  if (!Array.isArray(words)) throw new Error('Expected word captions with text/startMs/endMs (an array, {words}, {captions} or an edit.json).');
  return words;
};

// --from <auto-cut.json> --approve all|none|1,4 : the pauses plus the speech cuts the creator approved (table numbers).
async function approve(args) {
  if (typeof args.from !== 'string' || typeof args.approve !== 'string' || typeof args.out !== 'string') throw new Error(APPROVE_USAGE);
  const proposal = JSON.parse(await fs.readFile(args.from, 'utf8'));
  if (proposal.kind !== 'auto-cut-proposal' || !Array.isArray(proposal.removed)) throw new Error(`${args.from} is not an auto-cut proposal.`);
  const {fps, totalFrames, captions} = proposal.inputs ?? {};
  if (typeof captions !== 'string') throw new Error('The proposal does not name its captions file.');
  const words = wordsOf(JSON.parse(await fs.readFile(path.resolve(ROOT, captions), 'utf8')));
  const choice = args.approve.trim().toLowerCase();
  const approved = choice === 'none' ? []
    : choice === 'all' ? proposal.removed.map((_, i) => i)
      : choice.split(',').map((v) => {
        const n = Number(v.trim());
        if (!Number.isInteger(n) || n < 1) throw new Error(`--approve takes table numbers, "all" or "none"; got "${v.trim()}".`);
        return n - 1;
      });
  const segments = approvedSegments({words, fps, totalFrames, removed: proposal.removed, approved, pauses: proposal.pausesNearSpeechCuts ?? []});
  const out = assertProjectOutput(path.resolve(args.out));
  const numbers = [...new Set(approved)].sort((a, b) => a - b).map((i) => i + 1);
  await writeJson(out, {version: 1, kind: 'approved-cuts', source: rel(args.from), approved: numbers, segments});
  const kept = segments.reduce((sum, s) => sum + s.toFrame - s.fromFrame, 0) / fps;
  console.log(`approved: ${numbers.length ? numbers.join(', ') : 'pauses only'}; keeps ${kept.toFixed(2)}s of ${(totalFrames / fps).toFixed(2)}s`);
  console.log(`segments: ${rel(out)}`);
}

try {
  const args = parseArgs(process.argv.slice(2), {gap: String(DEFAULT_GAP_SEC), pad: DEFAULT_PAD_MS.join(','), 'silence-db': '-35'});
  run: {
  if (args.from !== undefined) { await approve(args); break run; }
  const cachePath = typeof args['audio-cache'] === 'string' ? args['audio-cache'] : null;
  const wavPath = typeof args.wav === 'string' ? args.wav : null;
  if (typeof args.captions !== 'string' || typeof args.out !== 'string' || (!cachePath && !wavPath)) throw new Error(USAGE);
  const captions = JSON.parse(await fs.readFile(args.captions, 'utf8'));
  const words = wordsOf(captions);
  const fps = number(args.fps ?? captions.source?.fps, 'fps');
  const gapSec = number(args.gap, 'gap');
  const padMs = String(args.pad).split(',').map((v) => number(v, 'pad'));
  const signoffFromSec = args['signoff-sec'] === undefined ? null : number(args['signoff-sec'], 'signoff-sec');
  const signoffPhrase = typeof args['signoff-phrase'] === 'string' ? args['signoff-phrase'] : signoffFromSec === null ? await profileSignOff(ROOT) : null;
  const protect = typeof args.protect === 'string' ? args.protect.split(',').map((pair) => {
    const [fromSec, toSec] = pair.split('-').map((v) => number(v, 'protect'));
    return {fromSec, toSec};
  }) : [];
  const notes = [];
  const status = captions.captions?.status ?? captions.status ?? null;
  if (status !== 'reviewed') {
    notes.push({code: 'captions-not-reviewed', message: `Caption status is ${status ?? 'unknown'}; check every proposed boundary against the words at the gate.`});
  }
  if (Array.isArray(captions.segments) && captions.source && !(captions.segments.length === 1 && captions.segments[0].fromFrame === 0 &&
    captions.segments[0].toFrame === captions.source.totalFrames)) {
    notes.push({code: 'manifest-already-cut', message: `${args.captions} already has ${captions.segments.length} segments; this proposal is computed from the full source and would replace them, not refine them.`});
  }

  let silences = [], rms = null, durationSec = null, audioPath = null;
  if (cachePath) {
    const cache = JSON.parse(await fs.readFile(cachePath, 'utf8'));
    if (!cache.hasAudio) throw new Error('The audio cache says this source has no audio.');
    silences = cache.silence?.spans ?? [];
    durationSec = Number.isFinite(cache.durationSec) ? cache.durationSec : null;
    audioPath = cache.wav16k ?? null;
    if (Number(cache.silence?.minDur) > gapSec) {
      notes.push({code: 'cache-min-dur', message: `The cache detected pauses of ${cache.silence.minDur}s or longer only; rerun scripts/audio.mjs with --silence-dur ${gapSec} to see shorter ones.`});
    }
  }
  if (wavPath) audioPath = wavPath;
  if (audioPath) {
    try {
      const {sampleRate, samples} = parseWav(await fs.readFile(audioPath));
      rms = rmsEnvelope(samples, sampleRate);
      durationSec ??= samples.length / sampleRate;
      if (!cachePath) silences = silencesFromRms(rms, {thresholdDb: number(args['silence-db'], 'silence-db'), minDurSec: gapSec});
    } catch (error) {
      if (wavPath) throw error;
      notes.push({code: 'no-rms', message: `Could not read ${audioPath} (${error.message}); boundaries use the nearest frame, not the quietest.`});
    }
  } else {
    notes.push({code: 'no-rms', message: 'The audio cache has no wav16k; boundaries use the nearest frame, not the quietest.'});
  }
  const totalFrames = args['total-frames'] !== undefined ? number(args['total-frames'], 'total-frames')
    : Number.isSafeInteger(captions.source?.totalFrames) ? captions.source.totalFrames
      : Number.isFinite(durationSec) ? Math.floor(durationSec * fps + 1e-9) : NaN;
  if (!Number.isSafeInteger(totalFrames)) throw new Error('Source frame count unknown; pass --total-frames.');

  const proposal = proposeCuts({words, silences, rms, fps, totalFrames, gapSec, padMs, protect, signoffFromSec, signoffPhrase});
  const out = assertProjectOutput(path.resolve(args.out));
  const document = {
    version: 1, kind: 'auto-cut-proposal', gate: 'rough-cut', applied: false,
    inputs: {captions: rel(args.captions), captionsStatus: status, audioCache: rel(cachePath), wav: rel(audioPath),
      rms: Boolean(rms), fps, totalFrames, gapSec, padMs, protect, signoffFromSec: proposal.signoffFromSec},
    segments: proposal.segments,
    silenceSegments: proposal.silenceSegments,
    pausesNearSpeechCuts: proposal.pausesNearSpeechCuts,
    removed: proposal.removed,
    warnings: [...notes, ...proposal.warnings],
    summary: summarizeProposal(proposal, {fps, totalFrames}),
  };
  await writeJson(out, document);
  console.log(formatProposalTable(document, {fps, totalFrames}));
  const pauseKept = proposal.silenceSegments.reduce((sum, s) => sum + s.toFrame - s.fromFrame, 0) / fps;
  console.log(`pauses only: keeps ${pauseKept.toFixed(2)}s, every word stays (silenceSegments)`);
  console.log(`\nproposal: ${rel(out)}`);
  }
} catch (error) {
  console.error(`auto-cut: ${error.message}`);
  process.exitCode = 1;
}
