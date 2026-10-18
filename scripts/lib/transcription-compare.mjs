// Pure comparison tools for the chunk-size A/B (scripts/transcription-ab.mjs). Nothing here runs whisper.
// The verdict decides whether the default chunk length may change; every threshold lives in AB_THRESHOLDS.

export const AB_THRESHOLDS = Object.freeze({
  speedRatioMax: 0.65, // decode time of the candidate / decode time of the baseline
  werDeltaMax: 0.01, // word error rate may rise by one point at most (with a reference)
  startMedianDeltaMaxMs: 40, // median start error may rise by 40 ms at most (with a reference)
  startP95DeltaMaxMs: 150,
  seamDefectsPer100DeltaMax: 1, // duplicates and holes at chunk seams per 100 words
  agreementSlack: 0.03, // without a reference: agreement with the baseline may trail the noise floor by this much
  floorMedianSlackMs: 40,
  holeMs: 3000, // a gap this long inside a seam zone counts as a hole
  duplicateGapMs: 600, // a repeated word or phrase closer than this at a seam counts as a duplicate
  seamPadMs: 1000, // seam zone = the overlap plus this much on each side
  tailMs: 3000, // the last word must end within this much of the window end
  floorChunkSeconds: 12, // the noise-floor run
});

const MARKS = /[ً-ٰٟۖ-ۭـ]/g; // tashkeel, superscript alef, Quranic marks, tatweel

/** Spelling variants that never change a word: marks, hamza carriers, ya, ta marbuta, digit scripts, case, punctuation. */
export function normalizeWord(text) {
  return String(text ?? '').normalize('NFKC').replace(MARKS, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06F0))
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/** [{text, startMs, endMs}] -> [{n, startMs, endMs}]. An entry that holds several words is split; the parts share its timing. */
export function normalizeWords(words) {
  const out = [];
  for (const word of words ?? []) {
    for (const part of String(word.text ?? '').split(/\s+/)) {
      const n = normalizeWord(part);
      if (n) out.push({n, startMs: word.startMs, endMs: word.endMs});
    }
  }
  return out;
}

const MAX_CELLS = 25_000_000;

/** Minimum edit alignment of two normalized word lists. Returns the operations in order. */
export function alignWords(ref, hyp) {
  if (ref.length * hyp.length > MAX_CELLS) throw new Error('The window is too long to align; use a shorter --duration.');
  const rows = ref.length + 1, cols = hyp.length + 1;
  const cost = new Uint16Array(rows * cols);
  for (let i = 0; i < rows; i += 1) cost[i * cols] = i;
  for (let j = 0; j < cols; j += 1) cost[j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const same = ref[i - 1].n === hyp[j - 1].n ? 0 : 1;
      cost[i * cols + j] = Math.min(cost[(i - 1) * cols + j - 1] + same, cost[(i - 1) * cols + j] + 1, cost[i * cols + j - 1] + 1);
    }
  }
  const ops = [];
  let i = ref.length, j = hyp.length;
  while (i > 0 || j > 0) {
    const here = cost[i * cols + j];
    if (i > 0 && j > 0 && ref[i - 1].n === hyp[j - 1].n && here === cost[(i - 1) * cols + j - 1]) { ops.push({type: 'match', ref: i - 1, hyp: j - 1}); i -= 1; j -= 1; }
    else if (i > 0 && j > 0 && here === cost[(i - 1) * cols + j - 1] + 1) { ops.push({type: 'sub', ref: i - 1, hyp: j - 1}); i -= 1; j -= 1; }
    else if (i > 0 && here === cost[(i - 1) * cols + j] + 1) { ops.push({type: 'del', ref: i - 1, hyp: null}); i -= 1; }
    else { ops.push({type: 'ins', ref: null, hyp: j - 1}); j -= 1; }
  }
  return ops.reverse();
}

export function wordErrorRate(ops, refCount) {
  const count = (type) => ops.filter((op) => op.type === type).length;
  const substitutions = count('sub'), insertions = count('ins'), deletions = count('del'), matches = count('match');
  return {wer: refCount ? +((substitutions + insertions + deletions) / refCount).toFixed(4) : 0, substitutions, insertions, deletions, matches, refCount};
}

/** Absolute start-time differences of the matched words (nearest-rank percentile). */
export function timingDeltas(ops, ref, hyp) {
  const deltas = ops.filter((op) => op.type === 'match').map((op) => Math.abs(ref[op.ref].startMs - hyp[op.hyp].startMs)).sort((a, b) => a - b);
  if (!deltas.length) return {count: 0, medianMs: null, p95Ms: null};
  const rank = (share) => deltas[Math.max(0, Math.ceil(share * deltas.length) - 1)];
  return {count: deltas.length, medianMs: rank(0.5), p95Ms: rank(0.95)};
}

/** Share of words the two transcripts have in common (informational on its own). */
export function agreement(a, b) {
  if (!a.length && !b.length) return 1;
  const matches = alignWords(a, b).filter((op) => op.type === 'match').length;
  return +(matches / Math.max(a.length, b.length)).toFixed(4);
}

/** Duplicates and holes near the seams between consecutive chunks. `chunks` are {startMs, endMs} in absolute milliseconds. */
export function seamStats({words, chunks, thresholds = AB_THRESHOLDS}) {
  const zones = [];
  for (let index = 0; index + 1 < chunks.length; index += 1) zones.push([chunks[index + 1].startMs - thresholds.seamPadMs, chunks[index].endMs + thresholds.seamPadMs]);
  const inZone = (ms) => zones.some(([from, to]) => ms >= from && ms <= to);
  const touchesZone = (from, to) => zones.some(([a, b]) => from <= b && to >= a);
  let duplicates = 0, holes = 0;
  for (let k = 0; k < words.length;) {
    let found = 0;
    for (const size of [3, 2, 1]) {
      if (k + 2 * size > words.length) continue;
      const same = Array.from({length: size}, (_, offset) => words[k + offset].n === words[k + size + offset].n).every(Boolean);
      const gap = words[k + size].startMs - words[k + size - 1].endMs;
      if (same && gap < thresholds.duplicateGapMs && inZone(words[k + size].startMs)) { found = size; break; }
    }
    if (found) { duplicates += 1; k += 2 * found; } else k += 1;
  }
  for (let k = 0; k + 1 < words.length; k += 1) {
    const gap = words[k + 1].startMs - words[k].endMs;
    if (gap > thresholds.holeMs && touchesZone(words[k].endMs, words[k + 1].startMs)) holes += 1;
  }
  const defects = duplicates + holes;
  return {zones: zones.length, duplicates, holes, defects, per100: words.length ? +((defects * 100) / words.length).toFixed(3) : 0};
}

export const tailIntact = (words, windowEndMs, thresholds = AB_THRESHOLDS) => words.length > 0 && words.at(-1).endMs >= windowEndMs - thresholds.tailMs;

const round = (value, digits = 3) => (value === null || value === undefined ? null : +value.toFixed(digits));

/** Everything the verdict needs from one transcription run of one chunk size. */
export function describeRun({chunkSeconds, decodeSec, words, chunks, windowEndMs}, thresholds = AB_THRESHOLDS) {
  const normalized = normalizeWords(words);
  return {chunkSeconds, decodeSec: decodeSec === null ? null : round(decodeSec, 1), words: normalized.length, seamStats: seamStats({words: normalized, chunks, thresholds}),
    tailIntact: tailIntact(normalized, windowEndMs, thresholds)};
}

const settle = (checks) => {
  const values = Object.values(checks);
  if (values.some((check) => check.ok === false)) return 'keep';
  return values.every((check) => check.ok === true) ? 'adopt' : 'inconclusive';
};

/**
 * Verdict for one candidate chunk size on one recording, relative to the baseline run.
 * baseline / candidate / floor: {chunkSeconds, decodeSec, words, chunks, windowEndMs}. reference: reviewed words in the same window, or null.
 */
export function evaluateCandidate({baseline, candidate, floor = null, reference = null, thresholds = AB_THRESHOLDS}) {
  const keep = `keep-${baseline.chunkSeconds}`;
  const speedKnown = baseline.decodeSec > 0 && candidate.decodeSec > 0;
  const speedRatio = speedKnown ? candidate.decodeSec / baseline.decodeSec : null;
  const checks = {speed: {ok: speedKnown ? speedRatio <= thresholds.speedRatioMax : null, value: round(speedRatio), limit: thresholds.speedRatioMax}};
  const verdictOf = (result) => (result === 'adopt' ? 'adopt' : result === 'keep' ? keep : 'inconclusive');
  if (checks.speed.ok !== true) return {chunkSeconds: candidate.chunkSeconds, referenced: reference !== null, checks, verdict: verdictOf(checks.speed.ok === false ? 'keep' : 'inconclusive'),
    reasons: [speedKnown ? 'not-faster-enough' : 'speed-not-measured']};
  const base = normalizeWords(baseline.words), cand = normalizeWords(candidate.words);
  const baseSeam = seamStats({words: base, chunks: baseline.chunks, thresholds}), candSeam = seamStats({words: cand, chunks: candidate.chunks, thresholds});
  if (reference) {
    const ref = normalizeWords(reference);
    const measure = (hyp) => { const ops = alignWords(ref, hyp); return {...wordErrorRate(ops, ref.length), ...timingDeltas(ops, ref, hyp)}; };
    const b = measure(base), c = measure(cand);
    const rise = (x, y) => (x === null || y === null ? null : round(x - y, 4));
    const within = (delta, limit) => (delta === null ? null : delta <= limit);
    const werDelta = rise(c.wer, b.wer), medianDelta = rise(c.medianMs, b.medianMs), p95Delta = rise(c.p95Ms, b.p95Ms);
    Object.assign(checks, {
      wer: {ok: within(werDelta, thresholds.werDeltaMax), baseline: b.wer, candidate: c.wer, delta: werDelta, limit: thresholds.werDeltaMax},
      startMedian: {ok: within(medianDelta, thresholds.startMedianDeltaMaxMs), baseline: b.medianMs, candidate: c.medianMs, delta: medianDelta, limit: thresholds.startMedianDeltaMaxMs},
      startP95: {ok: within(p95Delta, thresholds.startP95DeltaMaxMs), baseline: b.p95Ms, candidate: c.p95Ms, delta: p95Delta, limit: thresholds.startP95DeltaMaxMs},
      seam: {ok: candSeam.per100 - baseSeam.per100 <= thresholds.seamDefectsPer100DeltaMax, baseline: baseSeam.per100, candidate: candSeam.per100, limit: thresholds.seamDefectsPer100DeltaMax},
      tail: {ok: tailIntact(cand, candidate.windowEndMs, thresholds) || !tailIntact(base, baseline.windowEndMs, thresholds)},
    });
    const result = settle(checks);
    return {chunkSeconds: candidate.chunkSeconds, referenced: true, checks, verdict: verdictOf(result), reasons: Object.entries(checks).filter(([, check]) => check.ok !== true).map(([name, check]) => `${name}-${check.ok === false ? 'failed' : 'unmeasured'}`)};
  }
  if (!floor) return {chunkSeconds: candidate.chunkSeconds, referenced: false, checks, verdict: 'inconclusive', reasons: ['no-reference-and-no-floor']};
  const floorWords = normalizeWords(floor.words);
  const toCandidate = alignWords(base, cand), toFloor = alignWords(base, floorWords);
  const agreeCandidate = agreement(base, cand), agreeFloor = agreement(base, floorWords);
  const medianCandidate = timingDeltas(toCandidate, base, cand).medianMs, medianFloor = timingDeltas(toFloor, base, floorWords).medianMs;
  Object.assign(checks, {
    agreement: {ok: agreeCandidate >= agreeFloor - thresholds.agreementSlack, candidate: agreeCandidate, floor: agreeFloor, slack: thresholds.agreementSlack},
    startMedian: {ok: medianCandidate === null || medianFloor === null ? null : medianCandidate <= medianFloor + thresholds.floorMedianSlackMs, candidate: medianCandidate, floor: medianFloor, slackMs: thresholds.floorMedianSlackMs},
  });
  const result = settle(checks);
  return {chunkSeconds: candidate.chunkSeconds, referenced: false, checks, seam: {baseline: baseSeam.per100, candidate: candSeam.per100}, verdict: verdictOf(result),
    reasons: Object.entries(checks).filter(([, check]) => check.ok !== true).map(([name, check]) => `${name}-${check.ok === false ? 'failed' : 'unmeasured'}`)};
}

/**
 * Overall verdict across recordings and candidate sizes. `adopt` needs every recording to pass for that size and at least one recording with a reviewed reference.
 * `keep-<baseline>` when a size fails everywhere it was measured and none passes; otherwise `inconclusive`. The recommended size is the largest adopted one.
 */
export function overallVerdict({candidates, baselineSeconds}) {
  const bySize = new Map();
  for (const candidate of candidates) {
    const row = bySize.get(candidate.chunkSeconds) ?? [];
    row.push(candidate);
    bySize.set(candidate.chunkSeconds, row);
  }
  const adopted = [];
  const reasons = [];
  let anyKeep = false;
  for (const [size, rows] of bySize) {
    const allAdopt = rows.every((row) => row.verdict === 'adopt');
    const referenced = rows.some((row) => row.referenced && row.verdict === 'adopt');
    if (allAdopt && referenced) adopted.push(size);
    else if (allAdopt) reasons.push(`${size}s: passed, but no recording had a reviewed reference`);
    if (rows.some((row) => row.verdict === `keep-${baselineSeconds}`)) anyKeep = true;
  }
  if (adopted.length) return {verdict: 'adopt', recommendedChunkSeconds: Math.max(...adopted), reasons};
  return {verdict: anyKeep ? `keep-${baselineSeconds}` : 'inconclusive', recommendedChunkSeconds: null, reasons};
}

export const AB_DEFAULTS = Object.freeze({lang: 'ar', startSec: 0, durationSec: 90, chunks: Object.freeze([14, 30]), overlapSec: 2, threads: 4});

/** "14,30" -> [14, 30]. The first size is the baseline; sizes are whole seconds from 2 to 30. */
export function parseChunkList(value, overlapSec = AB_DEFAULTS.overlapSec) {
  const sizes = String(value).split(',').map((part) => part.trim()).filter(Boolean).map(Number);
  if (sizes.length < 2 || sizes.some((size) => !Number.isInteger(size) || size < 2 || size > 30) || new Set(sizes).size !== sizes.length) {
    throw new Error('--chunks needs two or more different whole numbers from 2 to 30, baseline first, for example 14,30.');
  }
  if (sizes.some((size) => size <= overlapSec)) throw new Error('Every chunk size must be longer than --overlap.');
  return sizes;
}

const recordingSlug = (media, index) => `r${index + 1}-${media.replace(/^.*[\/]/, '').replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'recording'}`;

/**
 * Runs every chunk size sequentially on every recording and builds the report. Dependencies are injected so no test runs whisper:
 * transcribe(args) -> the result of transcribeMedia, readCaptions(outDir) -> caption words, readReference(file) -> reviewed words,
 * audioDurationSec(media) -> number.
 */
export async function runAbPlan({recordings, settings, outRoot, transcribe, readCaptions, readReference, audioDurationSec, now = () => new Date(), log = () => {}, thresholds = AB_THRESHOLDS}) {
  const {lang, startSec, durationSec, chunks, overlapSec, threads, reuse} = settings;
  const baselineSeconds = chunks[0];
  const floorSeconds = thresholds.floorChunkSeconds;
  const sizes = [...chunks, ...(chunks.includes(floorSeconds) ? [] : [floorSeconds])];
  const results = [];
  for (const [index, recording] of recordings.entries()) {
    const total = await audioDurationSec(recording.media);
    const startMs = Math.round(startSec * 1000);
    if (startMs >= Math.round(total * 1000)) throw new Error(`--start is outside ${recording.media}.`);
    const windowMs = Math.min(Math.round(durationSec * 1000), Math.round(total * 1000) - startMs);
    const windowEndMs = startMs + windowMs;
    let reference = null;
    if (recording.reference) {
      reference = (await readReference(recording.reference)).filter((word) => word.startMs >= startMs && word.endMs <= windowEndMs);
      if (!reference.length) throw new Error(`The reference ${recording.reference} has no words inside the compared window.`);
    }
    const runs = [];
    for (const size of sizes) {
      log(`${recording.media}: ${size} s chunks (${index + 1}/${recordings.length})`);
      const result = await transcribe({media: recording.media, lang, start: startSec, duration: windowMs / 1000, 'chunk-seconds': size, 'overlap-seconds': overlapSec, threads,
        out: `${outRoot}/${recordingSlug(recording.media, index)}/chunk-${size}s`, force: !reuse});
      const planned = result.report.chunks;
      const fresh = planned.length > 0 && planned.every((chunk) => chunk.cached !== true);
      runs.push({chunkSeconds: size, decodeSec: fresh ? planned.reduce((sum, chunk) => sum + chunk.elapsedMs, 0) / 1000 : null, words: await readCaptions(result.outDir),
        chunks: planned.map(({startMs: from, endMs: to}) => ({startMs: from, endMs: to})), windowEndMs, outDir: result.outDir});
    }
    const baseline = runs[0];
    const floor = runs.find((run) => run.chunkSeconds === floorSeconds) ?? null;
    const candidates = runs.slice(1).filter((run) => chunks.includes(run.chunkSeconds)).map((run) => evaluateCandidate({baseline, candidate: run, floor: run === floor ? null : floor, reference, thresholds}));
    const baseWords = normalizeWords(baseline.words);
    results.push({
      media: recording.media, reference: recording.reference ?? null, window: {startMs, durationMs: windowMs},
      runs: runs.map((run) => ({...describeRun(run, thresholds), outDir: run.outDir, role: run === baseline ? 'baseline' : chunks.includes(run.chunkSeconds) ? 'candidate' : 'floor'})),
      floor: floor ? {chunkSeconds: floorSeconds, agreement: agreement(baseWords, normalizeWords(floor.words)),
        medianStartDeltaMs: timingDeltas(alignWords(baseWords, normalizeWords(floor.words)), baseWords, normalizeWords(floor.words)).medianMs} : null,
      checks: candidates, verdict: overallVerdict({candidates, baselineSeconds}).verdict,
    });
  }
  const overall = overallVerdict({candidates: results.flatMap((entry) => entry.checks), baselineSeconds});
  return {schema: 1, createdAt: now().toISOString(), lang, thresholds, settings: {startSec, durationSec, chunks, overlapSec, threads, reuse},
    recordings: results, verdict: overall.verdict, recommendedChunkSeconds: overall.recommendedChunkSeconds, reasons: overall.reasons};
}
