import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createFrameRenderer} from '../scripts/lib/ssr-frames.mjs';
import {profileToBrief} from '../scripts/lib/branding.mjs';
import {buildEditorPlan} from '../scripts/lib/editor-director.mjs';
import {editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {createEditorStore} from '../engine/src/review-editor/store.ts';
import {createProjectFollower} from '../engine/src/review-editor/shell/live-project.ts';
import {reviewManifest} from './helpers/review-manifest.mjs';
import {textNodes} from './helpers/markup.mjs';

const renderer = await createFrameRenderer();
const profile = JSON.parse(await readFile(new URL('../PROFILE.example.json', import.meta.url), 'utf8'));
const source = {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 150};
const wordsOf = (...texts) => texts.map((text, i) => ({text, startMs: i * 400, endMs: i * 400 + 350, confidence: 1}));
function manifest(texts, extra = {}) {
  const brief = {version: 1, id: 'digits-captions', source: source.path, transcript: 'Projects/digits-captions/words.json', ...profileToBrief(profile),
    purpose: 'tutorial', tone: 'calm', captionsReviewedBy: 'tester',
    beats: [{id: 'hook', fromSec: 0, toSec: 4, intent: 'intro', data: {kicker: 'تجربة', title: 'اختياراتك', subtitle: 'شرح بسيط', caption: 'شرح'}}]};
  return editManifestSchema.parse({...buildEditorPlan(brief, source, wordsOf(...texts)).manifest, ...extra});
}
const cue = (edit, frame = 5) => textNodes(renderer.renderCaptions({edit, frame})).join(' ');

test('a caption shows the digits the creator chose and the reviewed words never change', () => {
  const texts = ['أفضل', '10', 'أدوات', 'بسهولة'];
  for (const [digits, expected] of [[undefined, 'أفضل 10 أدوات بسهولة'], ['latin', 'أفضل 10 أدوات بسهولة'], ['arabic-indic', 'أفضل ١٠ أدوات بسهولة']]) {
    const edit = manifest(texts, digits === undefined ? {} : {digits});
    const before = JSON.stringify(edit.captions.words);
    assert.equal(cue(edit), expected, String(digits));
    assert.equal(JSON.stringify(edit.captions.words), before, 'the words are not rewritten by drawing them');
    assert.deepEqual(edit.captions.words.map((word) => word.text), texts);
  }
});

test('Arabic-Indic digits in the words are shown in Latin when latin is chosen', () => {
  assert.equal(cue(manifest(['أفضل', '١٠', 'أدوات'], {digits: 'latin'})), 'أفضل 10 أدوات');
  assert.equal(cue(manifest(['أفضل', '١٠', 'أدوات'])), 'أفضل ١٠ أدوات', 'no choice: as recorded');
});

test('an English cue and a handle keep their digits', () => {
  assert.equal(cue(manifest(['Top', '10', 'tools'], {digits: 'arabic-indic'})), 'Top 10 tools');
  assert.equal(cue(manifest(['تابع', '@user_12', 'الآن'], {digits: 'arabic-indic'})), 'تابع @user_12 الآن');
});

test('PreparedEdit mounts the provider from the manifest, so every scene shares the caption choice', async () => {
  const source = (await readFile(new URL('../engine/src/prepared-edit/PreparedEdit.tsx', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  assert.ok(source.includes('<DigitsProvider digits={edit.digits??null}>'));
  assert.ok(source.includes('</DigitsProvider>'));
});

test('a digits change from the assistant reaches the open editor as a style change', () => {
  const base = reviewManifest();
  const project = {slug: base.id, manifestPath: `Projects/${base.id}/edit.json`, manifest: base, manifestRevision: 'a'.repeat(64), plate: null,
    needsPrepare: true, staticFiles: [], hasMotionPlan: false, motionPlanPath: null, exportModes: [], recipes: [], recipeInfo: [], warnings: []};
  const store = createEditorStore(base);
  const follower = createProjectFollower({store, initial: project, blocked: () => false, onProject: () => {}, onStatus: () => {}, now: () => 1});
  const next = structuredClone(project);
  next.manifestRevision = 'b'.repeat(64);
  next.manifest.digits = 'arabic-indic';
  follower.receive(next);
  assert.equal(store.getSnapshot().manifest.digits, 'arabic-indic');
  assert.deepEqual(follower.getStatus().changes, ['style']);
});
