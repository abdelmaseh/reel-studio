import test from 'node:test';
import assert from 'node:assert/strict';
import {AB_DEFAULTS, AB_THRESHOLDS, agreement, alignWords, evaluateCandidate, normalizeWord, normalizeWords, overallVerdict, parseChunkList, runAbPlan,
  seamStats, tailIntact, timingDeltas, wordErrorRate} from '../scripts/lib/transcription-compare.mjs';

const word = (text, startMs, endMs = startMs + 300) => ({text, startMs, endMs});
// 40 words, 500 ms apart: a stand-in for a reviewed transcript of a 20 second window.
const SPOKEN = Array.from({length: 40}, (_, index) => word(`كلمة${index}`, index * 500));
const shifted = (words, ms) => words.map((entry) => ({...entry, startMs: entry.startMs + ms, endMs: entry.endMs + ms}));
const planned = (sizeMs, overlapMs, endMs) => { const out = []; for (let start = 0; start < endMs; start += sizeMs - overlapMs) { out.push({startMs: start, endMs: Math.min(start + sizeMs, endMs)}); if (start + sizeMs >= endMs) break; } return out; };
const run = (chunkSeconds, decodeSec, words, extra = {}) => ({chunkSeconds, decodeSec, words, chunks: planned(chunkSeconds * 1000, 2000, 20000), windowEndMs: 20000, ...extra});

test('the thresholds are the reviewed values and cannot be changed in place', () => {
  assert.deepEqual({...AB_THRESHOLDS}, {speedRatioMax: 0.65, werDeltaMax: 0.01, startMedianDeltaMaxMs: 40, startP95DeltaMaxMs: 150, seamDefectsPer100DeltaMax: 1, agreementSlack: 0.03,
    floorMedianSlackMs: 40, holeMs: 3000, duplicateGapMs: 600, seamPadMs: 1000, tailMs: 3000, floorChunkSeconds: 12});
  assert.throws(() => { 'use strict'; AB_THRESHOLDS.speedRatioMax = 1; }, TypeError);
});

test('normalization ignores spelling variants but not words', () => {
  const same = [['أحمد', 'احمد'], ['إسلام', 'اسلام'], ['مدرسة', 'مدرسه'], ['على', 'علي'], ['مُحَمَّد', 'محمد'], ['ســــلام', 'سلام'], ['٢٠٢٥', '2025'], ['۲۰۲۵', '2025'], ['Hello,', 'hello'], ['«نعم»', 'نعم'], ['مؤمن', 'مومن'], ['شيء', 'شيء']];
  for (const [a, b] of same) assert.equal(normalizeWord(a), normalizeWord(b), `${a} = ${b}`);
  assert.notEqual(normalizeWord('كتب'), normalizeWord('كتاب'));
  assert.deepEqual(normalizeWords([{text: ' مرحبا بكم ', startMs: 10, endMs: 90}, {text: '،', startMs: 100, endMs: 110}]).map((entry) => entry.n), ['مرحبا', 'بكم']);
});

test('alignment counts matches, substitutions, insertions and deletions', () => {
  const ref = normalizeWords(['a', 'b', 'c', 'd', 'e'].map((text, index) => word(text, index * 100)));
  const hyp = normalizeWords([word('a', 0), word('x', 100), word('c', 200), word('e', 400)]);
  const ops = alignWords(ref, hyp);
  assert.deepEqual(ops.map((op) => op.type), ['match', 'sub', 'match', 'del', 'match']);
  assert.deepEqual(wordErrorRate(ops, ref.length), {wer: 0.4, substitutions: 1, insertions: 0, deletions: 1, matches: 3, refCount: 5});
  const extra = alignWords(normalizeWords([word('a', 0), word('b', 100)]), normalizeWords([word('a', 0), word('z', 50), word('b', 100)]));
  assert.deepEqual(extra.map((op) => op.type), ['match', 'ins', 'match']);
  assert.equal(wordErrorRate([], 0).wer, 0);
  assert.equal(agreement(ref, ref), 1);
  assert.equal(agreement(ref, hyp), 0.6);
  assert.equal(agreement([], []), 1);
});

test('timing deltas use the nearest-rank median and 95th percentile of matched words', () => {
  const ref = normalizeWords(Array.from({length: 20}, (_, index) => word(`w${index}`, index * 1000)));
  const hyp = normalizeWords(Array.from({length: 20}, (_, index) => word(`w${index}`, index * 1000 + (index + 1) * 10)));
  const deltas = timingDeltas(alignWords(ref, hyp), ref, hyp);
  assert.deepEqual(deltas, {count: 20, medianMs: 100, p95Ms: 190});
  assert.deepEqual(timingDeltas([], [], []), {count: 0, medianMs: null, p95Ms: null});
});

test('seam defects count a repeated word at a seam and a three second hole, but not the same word elsewhere', () => {
  const chunks = [{startMs: 0, endMs: 14000}, {startMs: 12000, endMs: 26000}];
  const steady = Array.from({length: 25}, (_, index) => word(`w${index}`, index * 1000));
  const count = (words) => seamStats({words: normalizeWords(words), chunks});
  assert.deepEqual(count(steady), {zones: 1, duplicates: 0, holes: 0, defects: 0, per100: 0});
  assert.deepEqual(count([...steady.slice(0, 13), word('w12', 12400), ...steady.slice(13)]), {zones: 1, duplicates: 1, holes: 0, defects: 1, per100: 3.846});
  assert.equal(count([...steady.slice(0, 4), word('w3', 3400), ...steady.slice(4)]).defects, 0, 'a repeat far from a seam is speech, not a defect');
  assert.deepEqual(count([...steady.slice(0, 10), ...steady.slice(15)]), {zones: 1, duplicates: 0, holes: 1, defects: 1, per100: 5});
  assert.equal(count([...steady.slice(0, 5), ...steady.slice(10)]).holes, 0, 'a long gap far from the seam is a pause, not a hole');
  const phrase = [...steady.slice(0, 13), word('w11', 12400), word('w12', 12700), ...steady.slice(13)];
  assert.equal(count(phrase).duplicates, 1, 'a repeated two-word phrase counts once');
  assert.equal(seamStats({words: [], chunks}).per100, 0);
});

test('tail intact needs the last word within three seconds of the window end', () => {
  assert.equal(tailIntact(normalizeWords([word('a', 17000, 17300)]), 20000), true);
  assert.equal(tailIntact(normalizeWords([word('a', 16000, 16300)]), 20000), false);
  assert.equal(tailIntact([], 20000), false);
});

test('with a reference, adopt needs speed, WER, timing, seams and tail together', () => {
  const baseline = run(14, 100, SPOKEN);
  const verdict = (candidate, extra = {}) => evaluateCandidate({baseline, candidate, reference: SPOKEN, ...extra});
  assert.equal(verdict(run(30, 60, shifted(SPOKEN, 10))).verdict, 'adopt');
  const slow = verdict(run(30, 70, SPOKEN));
  assert.deepEqual([slow.verdict, slow.reasons], ['keep-14', ['not-faster-enough']]);
  assert.equal(verdict(run(30, 65, SPOKEN)).verdict, 'adopt', '0.65 exactly passes');
  const worse = SPOKEN.map((entry, index) => (index === 3 ? {...entry, text: 'خطأ'} : entry));
  const wer = verdict(run(30, 60, worse));
  assert.equal(wer.verdict, 'keep-14');
  assert.ok(wer.reasons.includes('wer-failed'));
  assert.equal(wer.checks.wer.delta, 0.025);
  const late = verdict(run(30, 60, shifted(SPOKEN, 100)));
  assert.ok(late.reasons.includes('startMedian-failed'));
  const tail = verdict(run(30, 60, SPOKEN.slice(0, 30)));
  assert.equal(tail.verdict, 'keep-14');
  assert.ok(tail.reasons.includes('tail-failed'));
  const duplicated = [...SPOKEN.slice(0, 25), word(SPOKEN[24].text, 12400), ...SPOKEN.slice(25)];
  const seam = verdict(run(30, 60, duplicated, {chunks: [{startMs: 0, endMs: 14000}, {startMs: 12000, endMs: 20000}]}));
  assert.ok(seam.checks.seam.candidate > 0);
});

test('without a reference the noise floor decides, and a missing floor or speed is inconclusive', () => {
  const baseline = run(14, 100, SPOKEN);
  const floor = run(12, 110, SPOKEN.map((entry, index) => (index % 10 === 0 ? {...entry, text: `x${index}`} : entry)));
  const same = evaluateCandidate({baseline, candidate: run(30, 60, shifted(SPOKEN, 20)), floor});
  assert.equal(same.verdict, 'adopt');
  assert.equal(same.referenced, false);
  const noisier = evaluateCandidate({baseline, candidate: run(30, 60, SPOKEN.map((entry, index) => (index % 4 === 0 ? {...entry, text: `y${index}`} : entry))), floor});
  assert.equal(noisier.verdict, 'keep-14');
  assert.ok(noisier.reasons.includes('agreement-failed'));
  assert.deepEqual(evaluateCandidate({baseline, candidate: run(30, 60, SPOKEN)}).reasons, ['no-reference-and-no-floor']);
  assert.equal(evaluateCandidate({baseline, candidate: run(30, 60, SPOKEN)}).verdict, 'inconclusive');
  const unmeasured = evaluateCandidate({baseline: run(14, null, SPOKEN), candidate: run(30, 60, SPOKEN), floor});
  assert.deepEqual([unmeasured.verdict, unmeasured.reasons], ['inconclusive', ['speed-not-measured']]);
});

test('the overall verdict needs a reference somewhere and recommends the largest adopted size', () => {
  const row = (chunkSeconds, verdict, referenced) => ({chunkSeconds, verdict, referenced});
  assert.deepEqual(overallVerdict({baselineSeconds: 14, candidates: [row(30, 'adopt', true), row(30, 'adopt', false), row(20, 'adopt', true), row(20, 'adopt', false)]}),
    {verdict: 'adopt', recommendedChunkSeconds: 30, reasons: []});
  const none = overallVerdict({baselineSeconds: 14, candidates: [row(30, 'adopt', false)]});
  assert.deepEqual([none.verdict, none.recommendedChunkSeconds], ['inconclusive', null]);
  assert.match(none.reasons[0], /no recording had a reviewed reference/);
  assert.equal(overallVerdict({baselineSeconds: 14, candidates: [row(30, 'adopt', true), row(30, 'keep-14', false)]}).verdict, 'keep-14');
  assert.equal(overallVerdict({baselineSeconds: 14, candidates: [row(30, 'inconclusive', false)]}).verdict, 'inconclusive');
  assert.equal(overallVerdict({baselineSeconds: 14, candidates: [row(30, 'keep-14', true), row(20, 'adopt', true)]}).recommendedChunkSeconds, 20);
});

test('chunk lists are validated', () => {
  assert.deepEqual(parseChunkList('14,30'), [14, 30]);
  assert.deepEqual(AB_DEFAULTS.chunks, [14, 30]);
  for (const bad of ['14', '14,14', '14,31', '14,1', '14,x', '14,2.5']) assert.throws(() => parseChunkList(bad), /--chunks/);
  assert.throws(() => parseChunkList('14,3', 3), /longer than --overlap/);
});

test('the A/B run is sequential, forces fresh decoding unless reused, and measures speed only from fully decoded runs', async () => {
  const calls = [], order = [];
  const speeds = {14: 10000, 30: 6000, 12: 11000};
  const transcribe = async (args) => {
    order.push(args['chunk-seconds']);
    calls.push(args);
    const size = args['chunk-seconds'];
    const plan = planned(size * 1000, 2000, 20000);
    const cachedPartly = args.out.includes('chunk-12s') && args.force === false;
    return {outDir: args.out, report: {chunks: plan.map((chunk, index) => ({...chunk, cached: cachedPartly && index === 0, elapsedMs: speeds[size] / plan.length}))}};
  };
  const captions = {14: SPOKEN, 30: shifted(SPOKEN, 10), 12: SPOKEN};
  const settings = {lang: 'ar', startSec: 0, durationSec: 90, chunks: [14, 30], overlapSec: 2, threads: 4, reuse: false};
  const report = await runAbPlan({
    recordings: [{media: 'Raw/a.mp4', reference: 'Projects/a/captions.json'}, {media: 'Raw/b.mp4', reference: null}],
    settings, outRoot: 'state/qa/transcription-ab/20261016-100000', transcribe,
    readCaptions: async (outDir) => captions[Number(/chunk-(\d+)s/.exec(outDir)[1])],
    readReference: async () => [...SPOKEN, word('خارج', 30000)], audioDurationSec: async () => 20, now: () => new Date('2026-10-16T10:00:00Z'),
  });
  assert.deepEqual(order, [14, 30, 12, 14, 30, 12], 'sequential, per recording, noise floor last');
  assert.ok(calls.every((call) => call.force === true && call.threads === 4 && call.lang === 'ar' && call['overlap-seconds'] === 2 && call.start === 0 && call.duration === 20));
  assert.equal(calls[0].out, 'state/qa/transcription-ab/20261016-100000/r1-a/chunk-14s');
  assert.equal(report.schema, 1);
  assert.equal(report.createdAt, '2026-10-16T10:00:00.000Z');
  assert.equal(report.recordings[0].window.durationMs, 20000, 'the window is clamped to the audio length');
  assert.deepEqual(report.recordings[0].runs.map((entry) => [entry.chunkSeconds, entry.role, entry.decodeSec]), [[14, 'baseline', 10], [30, 'candidate', 6], [12, 'floor', 11]]);
  assert.equal(report.recordings[0].checks[0].referenced, true);
  assert.equal(report.recordings[0].checks[0].verdict, 'adopt');
  assert.equal(report.recordings[1].checks[0].referenced, false);
  assert.equal(report.verdict, 'adopt');
  assert.equal(report.recommendedChunkSeconds, 30);
  assert.deepEqual(Object.keys(report.recordings[0].runs[0]).sort(), ['chunkSeconds', 'decodeSec', 'outDir', 'role', 'seamStats', 'tailIntact', 'words']);
  const reused = await runAbPlan({recordings: [{media: 'Raw/a.mp4', reference: null}], settings: {...settings, reuse: true}, outRoot: 'state/qa/x', transcribe,
    readCaptions: async (outDir) => captions[Number(/chunk-(\d+)s/.exec(outDir)[1])], readReference: async () => [], audioDurationSec: async () => 20});
  assert.equal(reused.recordings[0].runs.find((entry) => entry.role === 'floor').decodeSec, null, 'a partly cached run has no honest speed');
  assert.equal(reused.verdict, 'inconclusive');
});

test('a reference with no words inside the window, or a start past the end, is an error', async () => {
  const base = {settings: {lang: 'ar', startSec: 0, durationSec: 10, chunks: [14, 30], overlapSec: 2, threads: 4, reuse: false}, outRoot: 'state/qa/x', transcribe: async () => assert.fail('nothing runs'),
    readCaptions: async () => [], audioDurationSec: async () => 20};
  await assert.rejects(runAbPlan({...base, recordings: [{media: 'Raw/a.mp4', reference: 'r.json'}], readReference: async () => [word('late', 15000)]}), /no words inside the compared window/);
  await assert.rejects(runAbPlan({...base, settings: {...base.settings, startSec: 25}, recordings: [{media: 'Raw/a.mp4', reference: null}], readReference: async () => []}), /--start is outside/);
});
