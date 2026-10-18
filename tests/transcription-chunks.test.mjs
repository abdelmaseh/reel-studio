import '../scripts/lib/project-tmp.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {ROOT} from '../scripts/lib/project-paths.mjs';
import {DEFAULT_CHUNK_MS, DEFAULT_OVERLAP_MS, chunkProgressLine, mergeTranscriptionChunks, planTranscriptionChunks, transcriptionCacheKey} from '../scripts/lib/transcription.mjs';
import {normalizeTranscriptionOptions} from '../scripts/lib/transcription-run.mjs';

const starts = (plan) => plan.map((chunk) => chunk.startMs);

test('the default chunk length changes only with an adopt verdict from the A/B report', () => {
  // If a measured A/B returned adopt, this is the one line that changes (see the A/B task); it stays 14 s otherwise.
  assert.equal(DEFAULT_CHUNK_MS, 14000);
  assert.equal(DEFAULT_OVERLAP_MS, 2000);
});

test('option defaults come from the constants and the ranges are unchanged', () => {
  const base = {media: 'Raw/a.mp4'};
  const options = normalizeTranscriptionOptions(base);
  assert.equal(options.chunkMs, DEFAULT_CHUNK_MS);
  assert.equal(options.overlapMs, DEFAULT_OVERLAP_MS);
  assert.equal(normalizeTranscriptionOptions({...base, 'chunk-seconds': 14}).chunkMs, 14000, '--chunk-seconds 14 reproduces today');
  assert.equal(normalizeTranscriptionOptions({...base, 'chunk-seconds': 30}).chunkMs, 30000);
  assert.equal(normalizeTranscriptionOptions({...base, 'chunk-seconds': 2, 'overlap-seconds': 0}).overlapMs, 0);
  for (const bad of [{'chunk-seconds': 1.9}, {'chunk-seconds': 31}, {'overlap-seconds': 10.5}, {'overlap-seconds': -1}]) assert.throws(() => normalizeTranscriptionOptions({...base, ...bad}), /Invalid --/);
  assert.throws(() => normalizeTranscriptionOptions({...base, 'chunk-seconds': 5, 'overlap-seconds': 5}), /Overlap must be smaller/);
});

test('the planner facts the A/B relies on', () => {
  assert.equal(planTranscriptionChunks({durationMs: 29900, chunkMs: 30000, overlapMs: 2000}).length, 1, '29.9 s is one chunk at 30 s');
  assert.deepEqual(starts(planTranscriptionChunks({durationMs: 60000, chunkMs: 30000, overlapMs: 2000})), [0, 28000, 56000]);
  assert.equal(planTranscriptionChunks({durationMs: 600000, chunkMs: 30000, overlapMs: 2000}).length, 22);
  assert.equal(planTranscriptionChunks({durationMs: 600000, chunkMs: 14000, overlapMs: 2000}).length, 50);
  const tail = planTranscriptionChunks({durationMs: 29000, chunkMs: 14000, overlapMs: 2000}).at(-1);
  assert.ok(tail.endMs - tail.startMs > 2000, 'the last chunk is longer than the overlap when the overlap is at least one second');
  const absolute = planTranscriptionChunks({startMs: 5000, durationMs: 20000, chunkMs: 14000, overlapMs: 2000});
  assert.equal(absolute[0].startMs, 5000);
  assert.equal(absolute.at(-1).endMs, 25000, 'timestamps stay source-absolute');
});

test('a word spoken inside an overlap is kept once', () => {
  const plan = planTranscriptionChunks({durationMs: 18000, chunkMs: 10000, overlapMs: 2000});
  assert.deepEqual(plan.map((chunk) => [chunk.startMs, chunk.endMs]), [[0, 10000], [8000, 18000]]);
  const piece = (text, fromMs, toMs) => ({text, offsets: {from: fromMs, to: toMs}, tokens: [{p: 0.95}]});
  // Both chunks decoded the overlap [8 s, 10 s]: chunk 0 sees it at 8000-10000 ms, chunk 1 at 0-2000 ms.
  const first = {transcription: [piece(' one', 100, 500), piece(' early', 8300, 8700), piece(' late', 9400, 9800)]};
  const second = {transcription: [piece(' early', 300, 700), piece(' late', 1400, 1800), piece(' two', 3000, 3400)]};
  const merged = mergeTranscriptionChunks([{chunk: plan[0], raw: first}, {chunk: plan[1], raw: second}]);
  assert.deepEqual(merged.captions.map((caption) => caption.text.trim()), ['one', 'early', 'late', 'two']);
  assert.equal(merged.excludedOverlap.length, 2);
});

test('the transcript cache key depends on the chunk length', () => {
  const identity = (chunkMs) => ({sourceSha256: 'a'.repeat(64), range: {startMs: 0, durationMs: 60000, chunkMs, overlapMs: 2000}});
  assert.notEqual(transcriptionCacheKey(identity(14000)), transcriptionCacheKey(identity(30000)));
  assert.equal(transcriptionCacheKey(identity(14000)), transcriptionCacheKey(identity(14000)));
});

test('the progress line names the chunk and estimates the time from decoded chunks only', () => {
  const chunk = (index, startMs, endMs) => ({index, startMs, endMs});
  assert.equal(chunkProgressLine({chunk: chunk(0, 0, 14000), total: 22, threads: 4, decodedMs: []}), 'Chunk 1/22: 0-14 s, 4 CPU threads, estimating the time left');
  assert.equal(chunkProgressLine({chunk: chunk(3, 36000, 50000), total: 22, threads: 4, decodedMs: [20000, 40000, 30000]}), 'Chunk 4/22: 36-50 s, 4 CPU threads, about 10 min left');
  assert.match(chunkProgressLine({chunk: chunk(21, 252000, 262000), total: 22, threads: 2, decodedMs: [1000]}), /about 1 min left$/, 'never below one minute');
});

test('the help text states the default from the constants and makes no speed claim', () => {
  const help = execFileSync(process.execPath, [path.join(ROOT, 'engine/tools/transcribe.mjs'), '--help'], {cwd: ROOT, encoding: 'utf8', windowsHide: true});
  assert.match(help, new RegExp(`--chunk-seconds ${DEFAULT_CHUNK_MS / 1000}\\b`));
  assert.match(help, new RegExp(`--overlap-seconds ${DEFAULT_OVERLAP_MS / 1000}\\b`));
  assert.doesNotMatch(help, /drift|faster|slower|minutes per minute/i);
});

test('the transcription output guard applies to --out', () => {
  // The guard is the existing assertTranscriptionOutputPath: source media, Git metadata and anything outside the studio folder are refused.
  for (const out of ['Raw/x', 'Reference/x', '.git/x']) assert.throws(() => normalizeTranscriptionOptions({media: 'Raw/a.mp4', out: path.join(ROOT, out)}), /cannot write source media/, out);
  assert.throws(() => normalizeTranscriptionOptions({media: 'Raw/a.mp4', out: path.join(path.dirname(ROOT), 'x')}), /must be inside the project/);
  assert.equal(path.relative(ROOT, normalizeTranscriptionOptions({media: 'Raw/a.mp4', out: path.join(ROOT, 'Projects', 'demo', 'transcript')}).outDir).split(path.sep).join('/'), 'Projects/demo/transcript');
});
