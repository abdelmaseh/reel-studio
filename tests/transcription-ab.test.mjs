import '../scripts/lib/project-tmp.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {ROOT} from '../scripts/lib/project-paths.mjs';
import {planTranscriptionChunks} from '../scripts/lib/transcription.mjs';
import {parseAbArgs, runAbCommand} from '../scripts/transcription-ab.mjs';

const NOW = {now: () => new Date('2026-10-16T10:15:30.123Z')};
const cli = (...args) => spawnSync(process.execPath, [path.join(ROOT, 'scripts/transcription-ab.mjs'), ...args], {cwd: ROOT, encoding: 'utf8', windowsHide: true});

test('defaults: 90 s window, 14 s baseline against 30 s, a stamped folder under state/qa', () => {
  const parsed = parseAbArgs(['Raw/a.mp4'], NOW);
  assert.deepEqual(parsed.settings, {lang: 'ar', startSec: 0, durationSec: 90, chunks: [14, 30], overlapSec: 2, threads: 4, reuse: false});
  assert.equal(parsed.outRoot, 'state/qa/transcription-ab/20261016-101530');
  assert.deepEqual(parsed.recordings, [{media: 'Raw/a.mp4', reference: null}]);
});

test('the reference belongs to the first recording, and --reuse does not swallow the next recording', () => {
  const parsed = parseAbArgs(['Raw/a.mp4', '--reuse', 'Raw/b.mp4', '--reference', 'Projects/a/captions.json', '--chunks', '14,20,30', '--lang', 'EN'], NOW);
  assert.deepEqual(parsed.recordings, [{media: 'Raw/a.mp4', reference: 'Projects/a/captions.json'}, {media: 'Raw/b.mp4', reference: null}]);
  assert.equal(parsed.settings.reuse, true);
  assert.deepEqual(parsed.settings.chunks, [14, 20, 30]);
  assert.equal(parsed.settings.lang, 'en');
});

test('bad input is refused with a reason', () => {
  // --out goes through the existing assertProjectOutput (outside the studio, Raw/, Reference/ and .git are refused with its messages),
  // then it must be a new folder under state/qa/, which refuses every other place inside the studio.
  const bad = [[[], /Name at least one recording/], [['a.mp4', '--chunks', '14'], /--chunks/], [['a.mp4', '--chunks', '14,3', '--overlap', '3'], /longer than --overlap/],
    [['a.mp4', '--overlap', '11'], /Invalid --overlap/], [['a.mp4', '--threads', '2.5'], /integer/], [['a.mp4', '--duration', '5'], /Invalid --duration/],
    [['a.mp4', '--lang', 'arabic'], /language/], [['a.mp4', '--unknown', 'x'], /Unknown or repeated option/], [['a.mp4', '--lang', 'ar', '--lang', 'en'], /Unknown or repeated option/],
    [['a.mp4', '--out', 'Projects/demo/ab'], /under state\/qa/], [['a.mp4', '--out', 'state/tmp/ab'], /under state\/qa/], [['a.mp4', '--out', 'state/qa'], /under state\/qa/],
    [['a.mp4', '--out', 'scripts/ab'], /under state\/qa/], [['a.mp4', '--out', 'engine/ab'], /under state\/qa/],
    [['a.mp4', '--out', 'Raw/ab'], /read-only/], [['a.mp4', '--out', 'Reference/ab'], /read-only/], [['a.mp4', '--out', '../ab'], /Output must be inside the project/]];
  for (const [argv, pattern] of bad) assert.throws(() => parseAbArgs(argv, NOW), pattern, argv.join(' '));
  assert.equal(parseAbArgs(['a.mp4', '--out', 'State/QA/my-run'], NOW).outRoot, 'State/QA/my-run', 'folder names are matched without regard to case, as on Windows');
});

test('a junction inside state/qa is refused, so state/qa cannot become a way to write elsewhere', t => {
  const target = path.join(ROOT, 'state', 'tmp', `zz-ab-link-target-${process.pid}`);
  const link = path.join(ROOT, 'state', 'qa', `zz-ab-link-${process.pid}`);
  mkdirSync(target, {recursive: true});
  t.after(() => { rmSync(link, {force: true}); rmSync(target, {recursive: true, force: true}); });
  mkdirSync(path.dirname(link), {recursive: true}); // state/ is not tracked: a clean checkout has no state/qa until something writes there
  symlinkSync(target, link, 'junction');
  assert.throws(() => parseAbArgs(['a.mp4', '--out', `state/qa/zz-ab-link-${process.pid}/run`], NOW), /symlink or junction/);
});

test('the whole command, with a fake transcription, writes a report with studio-relative paths and never reuses its folder', async t => {
  const folder = `state/qa/zz-ab-run-${process.pid}`;
  const media = `state/tmp/zz-ab-run-${process.pid}.wav`;
  const reference = `state/tmp/zz-ab-run-${process.pid}.json`;
  const spoken = Array.from({length: 40}, (_, index) => ({text: ` كلمة${index}`, startMs: index * 500, endMs: index * 500 + 300}));
  writeFileSync(path.join(ROOT, media), 'only its existence matters: the duration is injected');
  writeFileSync(path.join(ROOT, reference), JSON.stringify(spoken));
  t.after(() => { for (const file of [media, reference]) rmSync(path.join(ROOT, file), {force: true}); rmSync(path.join(ROOT, folder), {recursive: true, force: true}); });
  const decodeMs = {14: 10000, 30: 6000, 12: 11000};
  const calls = [];
  const transcribeMedia = async (args, {onProgress}) => { // what transcribeMedia returns, without decoding anything
    calls.push(args);
    onProgress('fake progress');
    mkdirSync(args.out, {recursive: true});
    writeFileSync(path.join(args.out, 'captions.json'), JSON.stringify(spoken));
    const chunks = planTranscriptionChunks({startMs: args.start * 1000, durationMs: args.duration * 1000, chunkMs: args['chunk-seconds'] * 1000, overlapMs: args['overlap-seconds'] * 1000});
    return {outDir: args.out, report: {chunks: chunks.map((chunk) => ({...chunk, cached: false, elapsedMs: decodeMs[args['chunk-seconds']] / chunks.length}))}};
  };
  const options = {transcribeMedia, audioDurationSec: async () => 20, write: () => {}, now: () => new Date('2026-10-16T10:15:30.123Z')};
  const argv = [media, '--reference', reference, '--out', folder];
  const summary = await runAbCommand(argv, options);
  assert.deepEqual([summary.ok, summary.report, summary.verdict, summary.recommendedChunkSeconds], [true, `${folder}/ab-report.json`, 'adopt', 30]);
  assert.deepEqual(calls.map((args) => args['chunk-seconds']), [14, 30, 12], 'sequential, noise floor last');
  assert.ok(calls.every((args) => path.isAbsolute(args.media) && path.isAbsolute(args.out) && args.force === true && args.duration === 20), 'absolute paths, forced decoding, the window clamped to the audio');
  const report = JSON.parse(readFileSync(path.join(ROOT, summary.report), 'utf8'));
  assert.equal(report.createdAt, '2026-10-16T10:15:30.123Z');
  assert.deepEqual(report.recordings[0].runs.map((run) => run.outDir), [14, 30, 12].map((size) => `${folder}/r1-zz-ab-run-${process.pid}/chunk-${size}s`), 'the report holds studio-relative paths');
  await assert.rejects(runAbCommand(argv, options), /never reused/);
});

test('the command line refuses before touching whisper, and an existing output folder is never reused', t => {
  const none = cli();
  assert.equal(none.status, 1);
  assert.match(JSON.parse(none.stderr).error, /Name at least one recording/);
  const folder = `state/qa/zz-ab-test-${process.pid}`;
  mkdirSync(path.join(ROOT, folder), {recursive: true});
  t.after(() => rmSync(path.join(ROOT, folder), {recursive: true, force: true}));
  const reused = cli('Raw/none.mp4', '--out', folder);
  assert.equal(reused.status, 1);
  assert.match(JSON.parse(reused.stderr).error, /never reused/);
  const missing = cli('Raw/zz-not-here.mp4', '--out', `${folder}-new`);
  t.after(() => rmSync(path.join(ROOT, `${folder}-new`), {recursive: true, force: true}));
  assert.equal(missing.status, 1);
  assert.match(JSON.parse(missing.stderr).error, /Recording not found: Raw\/zz-not-here\.mp4/);
  assert.equal(existsSync(path.join(ROOT, `${folder}-new`)), false, 'a missing recording stops the run before the comparison folder is created');
});
