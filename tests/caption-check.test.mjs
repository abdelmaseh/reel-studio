import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {captionWords, checkCaptionCopy} from '../scripts/lib/caption-check.mjs';
import {publishContext} from '../scripts/lib/publish-pack.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const profile = JSON.parse(await readFile(new URL('../PROFILE.example.json', import.meta.url), 'utf8'));
const platforms = ['instagram', 'tiktok'];
const spoken = 'النهارده هوريك إزاي تعمل موقع كامل في عشر دقايق من غير ما تكتب سطر كود واحد بنفسك';
const teaser = {
  instagram: {caption: 'موقع كامل من غير كود؟ 👀\nالخطوة التالتة هي اللي بتفرق، ومعظم الناس بتنساها.', hashtags: ['#تصميم_مواقع', '#ذكاء_اصطناعي']},
  tiktok: {caption: 'موقع كامل من غير كود في دقايق، بس فيه خطوة لو نسيتها هتعيد من الأول.', hashtags: ['#مواقع']},
};
const copied = {...teaser, tiktok: {caption: 'إزاي تعمل موقع كامل في عشر دقايق؟ تعالى أوريك', hashtags: ['#مواقع']}};

test('words are compared without tashkeel, hamza variants, punctuation or emoji', () => {
  assert.deepEqual(captionWords('إزّاي تعمل الموقعَ؟ 🚀 #مواقع'), ['ازاي', 'تعمل', 'الموقع']);
  assert.deepEqual(captionWords('٣ ۳ 3 مؤقت سائل'), ['3', '3', '3', 'موقت', 'سايل']);
});

test('the search phrase matches across Arabic-Indic and Western digits', () => {
  const copy = {instagram: {caption: '3 طرق تبني بيها موقع', hashtags: ['#مواقع']}, tiktok: {caption: '3 طرق نبني بيها حاجة تانية', hashtags: ['#مواقع']}};
  const result = checkCaptionCopy({copy, platforms, spokenText: spoken, keyword: '٣ طرق'});
  assert.deepEqual(result.failures.filter((line) => /search phrase/.test(line)), []);
});

test('the search phrase window counts characters and whole words', () => {
  const keyword = 'موقع كامل';
  const caption = (end, after) => 'ب '.repeat(60).slice(0, end - keyword.length - 1) + ' ' + keyword + after;
  const failures = (end, after) => checkCaptionCopy({copy: {instagram: {caption: caption(end, after), hashtags: ['#مواقع']}, tiktok: teaser.tiktok}, platforms, spokenText: spoken, keyword})
    .failures.filter((line) => /^Instagram: the search phrase/.test(line));
  assert.deepEqual(failures(124, '👀 كمل'), []);
  assert.deepEqual(failures(125, ' نبني'), []);
  assert.equal(failures(125, 'ين نبني').length, 1);
  assert.equal(failures(126, ' نبني').length, 1);
});

test('a teaser that names the topic in new words passes', () => {
  const result = checkCaptionCopy({copy: teaser, platforms, spokenText: spoken, keyword: 'موقع كامل'});
  assert.equal(result.ok, true, result.failures.join('\n'));
  assert.equal(result.platforms.tiktok.longestSpokenRun, 2);
  assert.equal(result.platforms.instagram.spokenPhrasePercent, 0);
});

test('a caption that retells the spoken words fails', () => {
  const result = checkCaptionCopy({copy: copied, platforms, spokenText: spoken});
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((line) => /^TikTok: repeats 7 spoken words in a row/.test(line)), result.failures.join('\n'));
  assert.ok(result.failures.some((line) => /^TikTok: 71 % of its 3-word phrases/.test(line)), result.failures.join('\n'));
});

test('the search phrase belongs in the opening of every platform', () => {
  const result = checkCaptionCopy({copy: teaser, platforms, spokenText: spoken, keyword: 'Claude Code'});
  assert.equal(result.failures.filter((line) => /search phrase «Claude Code»/.test(line)).length, 2);
});

test('filler hashtags and the same text on two platforms fail', () => {
  const filler = checkCaptionCopy({copy: {...teaser, tiktok: {...teaser.tiktok, hashtags: ['#fyp']}}, platforms, spokenText: spoken});
  assert.ok(filler.failures.some((line) => /#fyp is a filler hashtag/.test(line)));
  const same = checkCaptionCopy({copy: {...teaser, tiktok: teaser.instagram}, platforms, spokenText: spoken});
  assert.ok(same.failures.some((line) => /share 100 % of their phrases/.test(line)));
  const short = {caption: 'موقع كامل', hashtags: ['#مواقع']};
  const sameShort = checkCaptionCopy({copy: {instagram: short, tiktok: short}, platforms, spokenText: spoken});
  assert.ok(sameShort.failures.some((line) => /share 100 % of their phrases/.test(line)));
});

test('publish context follows the planned video before the saved default', () => {
  const fixedShort = {...profile, preferences: {...profile.preferences, writingStyle: {mode: 'fixed', value: 'short'}}};
  assert.deepEqual(publishContext(fixedShort, null), {cta: null, writingStyle: 'short'});
  assert.deepEqual(publishContext(fixedShort, {writingStyle: 'educational', creator: {ending: {cta: 'موقع'}}}), {cta: 'موقع', writingStyle: 'educational'});
});

test('caption-check reads the project and fails a retelling', async t => {
  const id = `caption-check-${Date.now()}`;
  const directory = path.join(root, 'Projects', id);
  await mkdir(directory, {recursive: true});
  t.after(() => rm(directory, {recursive: true, force: true}));
  const words = spoken.split(' ').map((text, i) => ({text, startMs: i * 400, endMs: i * 400 + 380, confidence: 1}));
  await writeFile(path.join(directory, 'edit.json'), JSON.stringify({creator: {ending: {cta: null}}, captions: {status: 'reviewed', words}}));
  const run = () => exec(process.execPath, ['scripts/caption-check.mjs', '--project', id, '--profile', 'PROFILE.example.json', '--keyword', 'موقع كامل'], {cwd: root, windowsHide: true});
  await writeFile(path.join(directory, 'publish-copy.json'), JSON.stringify({title: 'موقع من غير كود', ...teaser}));
  assert.equal(JSON.parse((await run()).stdout).ok, true);
  await writeFile(path.join(directory, 'publish-copy.json'), JSON.stringify({title: 'موقع من غير كود', ...copied}));
  const failed = await run().then(() => null, (error) => error);
  assert.equal(failed?.code, 1);
  assert.equal(JSON.parse(failed.stdout).ok, false);
});

test('publish-pack writes no pack for copy that retells the video', async t => {
  const id = `caption-pack-${Date.now()}`;
  const directory = path.join(root, 'Projects', id);
  await mkdir(directory, {recursive: true});
  t.after(() => rm(directory, {recursive: true, force: true}));
  const words = spoken.split(' ').map((text, i) => ({text, startMs: i * 400, endMs: i * 400 + 380, confidence: 1}));
  await writeFile(path.join(directory, 'edit.json'), JSON.stringify({creator: {ending: {cta: null}}, captions: {status: 'reviewed', words}}));
  await writeFile(path.join(directory, 'clip.mp4'), 'not-a-real-video');
  const run = () => exec(process.execPath, ['scripts/publish-pack.mjs', '--project', id, '--video', `Projects/${id}/clip.mp4`, '--profile', 'PROFILE.example.json', '--keyword', 'موقع كامل'], {cwd: root, windowsHide: true});
  await writeFile(path.join(directory, 'publish-copy.json'), JSON.stringify({title: 'موقع من غير كود', ...copied}));
  const failed = await run().then(() => null, (error) => error);
  assert.equal(failed?.code, 1);
  assert.match(JSON.parse(failed.stderr).error, /Rewrite the post description first/);
  await assert.rejects(readFile(path.join(directory, 'PUBLISH_PACK.md')));
  await writeFile(path.join(directory, 'publish-copy.json'), JSON.stringify({title: 'موقع من غير كود', ...teaser}));
  assert.equal(JSON.parse((await run()).stdout).teaserCheck, 'passed');
  assert.doesNotMatch(await readFile(path.join(directory, 'PUBLISH_PACK.md'), 'utf8'), /Language:/);
});
