import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {promises as fs} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertDeliveryReady} from '../scripts/lib/editor-director.mjs';
import {validateManifest} from '../engine/src/review-editor/validate.ts';
import {renderArabicGate} from '../scripts/lib/arabic-check.mjs';
import {checkArabicMarkup} from '../engine/src/core/arabic-check.ts';
import {editManifestSchema, editSceneSchema} from '../engine/src/prepared-edit/schema.ts';
import {createFrameRenderer} from '../scripts/lib/ssr-frames.mjs';
import {ARABIC_SCENES} from './fixtures/arabic-scenes.mjs';
import {checkFontGlyphs} from '../scripts/lib/studio-doctor.mjs';
import {REQUIRED_ARABIC_CODE_POINTS} from '../scripts/lib/font-coverage.mjs';
import {ROOT} from '../scripts/lib/job-paths.mjs';
import {createProductionPlan} from '../scripts/lib/production-manager.mjs';
import {acceptTask} from '../scripts/lib/production-accept.mjs';
import {reviewManifest} from './helpers/review-manifest.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const fontsFolder = path.join(root, 'engine', 'public', 'fonts');
const haveFonts = existsSync(path.join(fontsFolder, 'Cairo-arabic-400.woff2')) && existsSync(path.join(fontsFolder, 'manifest.json'));
const TATWEEL = '\u0640';

const word = (text, i) => ({text, startMs: i * 400, endMs: i * 400 + 380, confidence: 1});
// A recording that is ready to deliver, with the given caption words (the first scene keeps its own, already clean, copy).
const ready = (words = ['شرح']) => {
  const m = reviewManifest('arabic-gates');
  m.purpose = 'delivery';
  m.captions.status = 'reviewed';
  m.captions.reviewer = 'Recorded words reviewed';
  m.captions.words = words.map(word);
  return m;
};
const ids = (report) => Object.fromEntries(report.checks.map((item) => [item.id, item.status]));

test('assertDeliveryReady stops a caption word with a tatweel at its edge and names the place', () => {
  assert.equal(assertDeliveryReady(ready()).ok, true);
  assert.throws(() => assertDeliveryReady(ready([`${TATWEEL}شرح`])), (error) => {
    assert.match(error.message, /^Delivery Arabic check:/);
    assert.match(error.message, /tatweel-edge at captions\.words\[0\]/);
    return true;
  });
});

test('assertDeliveryReady stops presentation forms and a ZWNJ inside a scene title', () => {
  const m = ready();
  m.scenes[0].data.title = `ك\uFEFBم`;
  assert.throws(() => assertDeliveryReady(m), /presentation-forms at scenes\[hook\]\.data\.title/);
  const n = ready();
  n.scenes[0].data.subtitle = 'كتب\u200Cنا';
  assert.throws(() => assertDeliveryReady(n), /zwnj-in-word at scenes\[hook\]\.data\.subtitle/);
});

test('assertDeliveryReady stops a character the installed font lacks', {skip: !haveFonts}, () => {
  const m = ready(['كتب', 'گاز']);
  m.fontFamily = 'Tajawal';
  assert.throws(() => assertDeliveryReady(m), /missing-glyph at captions\.words\[1\]/);
  m.fontFamily = 'Cairo';
  assert.equal(assertDeliveryReady(m).ok, true);
});

test('assertDeliveryReady lets review items through: they are decided in the QA report, not here', () => {
  const m = ready(['جر\u0651ب', 'ChatGPT', 'دلوقتي']);
  assert.equal(assertDeliveryReady(m).ok, true);
});

test('the editor lists a broken join as a delivery error and a review item as a warning', () => {
  const bad = validateManifest(ready([`${TATWEEL}شرح`, 'جر\u0651ب', 'ChatGPT', 'دلوقتي']));
  assert.equal(bad.ok, true, 'saving and previewing are never blocked');
  assert.equal(bad.deliveryReady, false);
  const error = bad.issues.find((issue) => issue.code === 'delivery:arabic-tatweel-edge');
  assert.equal(error.severity, 'error');
  assert.equal(error.stage, 'delivery');
  assert.equal(error.path, 'captions.words.0');
  assert.match(error.message, /كشيدة/);
  assert.match(error.detail, /tatweel/i);
  const warning = bad.issues.find((issue) => issue.code === 'delivery:arabic-mixed-direction');
  assert.equal(warning.severity, 'warning');
  assert.equal(warning.path, 'captions.words.2');
  const good = validateManifest(ready(['جر\u0651ب', 'ChatGPT', 'دلوقتي']));
  assert.equal(good.deliveryReady, true, 'a warning never stops delivery');
  assert.equal(good.issues.filter((issue) => issue.severity === 'warning' && issue.code.startsWith('delivery:arabic-')).length, 1);
  assert.deepEqual(validateManifest(ready()).issues.filter((issue) => issue.code.startsWith('delivery:arabic-')), []);
});

test('renderArabicGate reads the manifest inside the render props and is silent when there is none', () => {
  assert.equal(renderArabicGate({}), null);
  assert.equal(renderArabicGate({edit: null}), null);
  const bad = renderArabicGate({edit: ready([`شرح${TATWEEL}`])});
  assert.equal(bad.ok, false);
  assert.match(bad.message, /tatweel-edge/);
  const review = renderArabicGate({edit: ready(['جر\u0651ب', 'ChatGPT', 'دلوقتي'])});
  assert.equal(review.ok, true);
  assert.equal(review.review.length, 1);
  assert.match(review.review[0], /mixed-direction/);
});

test('arabic-check reads a project, prints JSON and exits 1 only on a fail', async (t) => {
  const id = `arabic-check-${randomUUID().slice(0, 8)}`;
  const directory = path.join(root, 'Projects', id);
  await fs.mkdir(directory, {recursive: true});
  t.after(() => fs.rm(directory, {recursive: true, force: true}));
  const run = (...args) => exec(process.execPath, ['scripts/arabic-check.mjs', ...args], {cwd: root, windowsHide: true});
  await fs.writeFile(path.join(directory, 'edit.json'), JSON.stringify(ready(['جر\u0651ب', 'ChatGPT', 'دلوقتي'])));
  const review = JSON.parse((await run('--project', id)).stdout);
  assert.equal(review.ok, true);
  assert.deepEqual(review.problems.map((problem) => `${problem.level}:${problem.code}`), ['needs-review:mixed-direction']);
  assert.equal(review.problems[0].where, 'captions.words[1]');
  await fs.writeFile(path.join(directory, 'edit.json'), JSON.stringify(ready([`${TATWEEL}شرح`])));
  const failed = await run('--manifest', `Projects/${id}/edit.json`).then(() => null, (error) => error);
  assert.equal(failed?.code, 1);
  const body = JSON.parse(failed.stdout);
  assert.equal(body.ok, false);
  assert.equal(body.problems[0].code, 'tatweel-edge');
  const none = await run().then(() => null, (error) => error);
  assert.equal(none?.code, 1);
  assert.match(JSON.parse(none.stderr).error, /Usage: node scripts\/arabic-check\.mjs/);
});

test('arabic-check applies the digits choice of a profile file', async (t) => {
  const id = `arabic-check-${randomUUID().slice(0, 8)}`;
  const directory = path.join(root, 'Projects', id);
  await fs.mkdir(directory, {recursive: true});
  t.after(() => fs.rm(directory, {recursive: true, force: true}));
  const manifest = ready(['سنة', '٢٠٢٦']);
  await fs.writeFile(path.join(directory, 'edit.json'), JSON.stringify(manifest));
  const profile = JSON.parse(await fs.readFile(path.join(root, 'PROFILE.example.json'), 'utf8'));
  profile.preferences.digits = {mode: 'fixed', value: 'arabic-indic'};
  await fs.writeFile(path.join(directory, 'profile.json'), JSON.stringify(profile));
  const run = (...args) => exec(process.execPath, ['scripts/arabic-check.mjs', '--project', id, ...args], {cwd: root, windowsHide: true});
  assert.deepEqual(JSON.parse((await run('--profile', 'PROFILE.example.json')).stdout).problems.map((problem) => problem.code), ['digit-style']);
  assert.deepEqual(JSON.parse((await run('--profile', `Projects/${id}/profile.json`)).stdout).problems, []);
});

async function acceptFixture(t, role) {
  const id = `arabic-accept-${randomUUID().slice(0, 8)}`, base = `Projects/${id}`;
  await fs.mkdir(path.join(ROOT, base), {recursive: true});
  t.after(async () => { assert.match(id, /^arabic-accept-/); await fs.rm(path.join(ROOT, base), {recursive: true, force: true}); });
  const put = async (file, data) => { await fs.mkdir(path.dirname(path.join(ROOT, file)), {recursive: true}); await fs.writeFile(path.join(ROOT, file), typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`, 'utf8'); return file; };
  const copy = await put(`${base}/copy.md`, 'Illustrative copy.');
  const request = await put(`${base}/production-request.json`, {version: 1, id, runId: 'r1', mode: 'graphics', interaction: 'delegated', objective: 'Accept-test run.',
    inputs: [{role: 'copy', path: copy}], tasks: [{id: 't1', role, objective: 'Do the role.', dependsOn: []}]});
  await createProductionPlan(request);
  return {id, base, task: `${base}/production/r1/tasks/t1`, put};
}

test('the edit acceptance fails a candidate with broken Arabic and warns about review items', async (t) => {
  const f = await acceptFixture(t, 'edit');
  const candidate = (words) => ({style: 'kinetic-paper', fontFamily: 'Cairo', source: {fps: 30, totalFrames: 90}, segments: [{fromFrame: 0, toFrame: 90}], captions: {words: words.map(word)}, scenes: [], sounds: []});
  await f.put(`${f.task}/brief.json`, {tone: 'calm'});
  await f.put(`${f.task}/checks.json`, {version: 1});
  await f.put(`${f.task}/edit.json`, candidate([`${TATWEEL}شرح`]));
  const bad = ids(await acceptTask({role: 'edit', task: f.task}));
  assert.equal(bad['arabic-check'], 'fail');
  await f.put(`${f.task}/edit.json`, candidate(['جر\u0651ب', 'ChatGPT', 'دلوقتي']));
  const review = ids(await acceptTask({role: 'edit', task: f.task}));
  assert.equal(review['arabic-check'], 'pass');
  assert.equal(review['arabic-review'], 'warn');
  await f.put(`${f.task}/edit.json`, candidate(['شرح']));
  const clean = ids(await acceptTask({role: 'edit', task: f.task}));
  assert.equal(clean['arabic-check'], 'pass');
  assert.equal(clean['arabic-review'], undefined);
});

test('the QA acceptance wants a written decision for every Arabic item that needs review', async (t) => {
  const f = await acceptFixture(t, 'qa');
  const safe = `${f.base}/safe-check-report`;
  await f.put(`${safe}/summary.md`, '0 violations\n');
  const report = (arabic) => `## File\nx.mp4\n\n## Technical\nPASS probe\n\n## Safe zones\n${safe}\n\n## Head keep-out\nPASS\n\n## Encode\nPASS\n\n## Editorial\nok\n\n## Arabic\n${arabic}\n\n## Open problems\nnone\n`;
  await f.put(`${f.task}/ig-check.json`, {ok: true});
  await f.put(`${f.base}/edit.json`, ready(['جر\u0651ب', 'ChatGPT', 'دلوقتي']));
  await f.put(`${f.task}/QC_REPORT.md`, report('NEEDS-REVIEW mixed-direction captions.words[1]\nDecision: ChatGPT reads left to right inside the Arabic line; checked on the paused frame.'));
  const good = ids(await acceptTask({role: 'qa', task: f.task}));
  assert.equal(good['arabic-decided'], 'pass');
  await f.put(`${f.task}/QC_REPORT.md`, report('PASS arabic-check, nothing to review'));
  assert.equal(ids(await acceptTask({role: 'qa', task: f.task}))['arabic-decided'], 'fail', 'no decision for the review item');
  await f.put(`${f.base}/edit.json`, ready());
  assert.equal(ids(await acceptTask({role: 'qa', task: f.task}))['arabic-decided'], undefined, 'nothing to decide');
  await f.put(`${f.base}/edit.json`, ready([`${TATWEEL}شرح`]));
  assert.equal(ids(await acceptTask({role: 'qa', task: f.task}))['arabic-clean'], 'fail', 'a broken join in the live edit is a failure');
});

test('the doctor warns when an installed Arabic font file lacks required glyphs or cannot be read', {skip: !haveFonts}, async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reel-glyph-doctor-'));
  t.after(() => fs.rm(dir, {recursive: true, force: true}));
  const fonts = path.join(dir, 'engine', 'public', 'fonts');
  await fs.mkdir(fonts, {recursive: true});
  await fs.copyFile(path.join(fontsFolder, 'Cairo-arabic-400.woff2'), path.join(fonts, 'Cairo-arabic-400.woff2'));
  await fs.writeFile(path.join(fonts, 'Junk-arabic-400.woff2'), 'not a font');
  const lock = {fonts: [
    {family: 'Cairo', subset: 'arabic', file: 'Cairo-arabic-400.woff2', sha256: 'a'.repeat(64)},
    {family: 'Cairo', subset: 'latin', file: 'Cairo-latin-400.woff2', sha256: 'b'.repeat(64)},
    {family: 'Absent', subset: 'arabic', file: 'Absent-arabic-400.woff2', sha256: 'c'.repeat(64)},
  ]};
  const healthy = await checkFontGlyphs(dir, lock);
  assert.deepEqual(healthy, {ok: true, warnOnly: true, missing: [], unreadable: []}, 'a file that is not installed is the fonts check job, and a latin file is not asked for Arabic');
  const gap = await checkFontGlyphs(dir, lock, {required: [...REQUIRED_ARABIC_CODE_POINTS, 0x1f600]});
  assert.equal(gap.ok, false);
  assert.deepEqual(gap.missing, [{family: 'Cairo', file: 'Cairo-arabic-400.woff2', count: 1, first: ['U+1F600']}]);
  const junk = await checkFontGlyphs(dir, {fonts: [...lock.fonts, {family: 'Junk', subset: 'arabic', file: 'Junk-arabic-400.woff2', sha256: 'd'.repeat(64)}]});
  assert.deepEqual(junk.unreadable, ['Junk-arabic-400.woff2']);
  assert.equal(junk.ok, false);
});

test('every installed Arabic font file draws the required Arabic code points (the doctor check on this very install)', {skip: !haveFonts}, async () => {
  const lock = JSON.parse(await fs.readFile(path.join(root, 'versions.lock.json'), 'utf8'));
  const result = await checkFontGlyphs(root, lock);
  assert.deepEqual(result.missing, [], JSON.stringify(result.missing));
  assert.deepEqual(result.unreadable, []);
});

test('the rendered Arabic scenes and the caption track keep every word in one element (the markup rules on real output)', async () => {
  const renderer = await createFrameRenderer();
  for (const style of ['section-deck', 'kinetic-paper']) {
    for (const scene of ARABIC_SCENES) {
      const html = renderer.renderScene({scene: editSceneSchema.parse(scene), style, frame: Math.min(scene.durationInFrames - 1, 200)});
      assert.match(html, /[\u0600-ۿ]/, `${style}/${scene.family} drew no Arabic, so the scan would prove nothing`);
      assert.deepEqual(checkArabicMarkup(html).map((problem) => problem.code), [], `${style}/${scene.family}`);
    }
  }
  const edit = ready(['جر\u0651ب', 'كلود', 'ببلاش', 'دلوقتي']);
  edit.style = 'kinetic-paper'; // section-deck keeps its caption pills static, so it refuses the animated pop
  edit.captions.emphasis = [{sourceIndex: 1, kind: 'pop'}, {sourceIndex: 2, kind: 'underline'}];
  const captions = renderer.renderCaptions({edit: editManifestSchema.parse(edit), frame: 20});
  assert.match(captions, /كلود/);
  assert.deepEqual(checkArabicMarkup(captions).map((problem) => problem.code), [], 'a popped caption word moves as a whole word');
});
