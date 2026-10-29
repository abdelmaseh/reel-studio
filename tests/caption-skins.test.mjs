import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {ROOT} from '../scripts/lib/project-paths.mjs';
import {createFrameRenderer} from '../scripts/lib/ssr-frames.mjs';
import {editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {setLook, lookResetPatch} from '../engine/src/review-editor/ops/look.ts';
import {setEmphasis} from '../engine/src/review-editor/ops/captions.ts';
import * as emphasis from '../engine/src/prepared-edit/caption-emphasis.ts';
import {normalizeProfile, profileToBrief} from '../scripts/lib/branding.mjs';
import {buildEditorPlan} from '../scripts/lib/editor-director.mjs';
import {bundleEngine, setSsrFrame} from './helpers/engine-bundle.mjs';
import {compileEdit} from '../engine/src/prepared-edit/timeline.ts';
import {textNodes} from './helpers/markup.mjs';
import crypto from 'node:crypto';
import {collectLibraryInventory} from '../scripts/lib/library-inventory.mjs';
import {getPreviewDefinition, previewFixtureIssues} from '../engine/src/library-preview/fixtures.ts';
import {collectLibraryEditorial, recommendLibrary} from '../scripts/lib/library-selection.mjs';

const skins = ['spoken-box', 'karaoke', 'bold-outline', 'soft-shadow', 'paper-tag'];
const source = {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 180};
const words = ['سريع', 'بوضوح', 'AI'].map((text, i) => ({text, startMs: 1000 + i * 1000, endMs: 1800 + i * 1000, confidence: 1}));
const base = () => ({version: 1, id: 'caption-skins', purpose: 'test', style: 'section-deck', source,
  segments: [{fromFrame: 0, toFrame: 180}], captions: {status: 'draft', grouping: 'compact', words}, scenes: [], sounds: [], camera: []});
const renderer = await createFrameRenderer();

test('caption skin is an optional strict enum, independent of presentation', () => {
  assert.ok(editManifestSchema.safeParse(base()).success);
  for (const skin of skins) assert.ok(editManifestSchema.safeParse({...base(), captions: {...base().captions, skin}}).success, skin);
  for (const patch of [{skin: 'unknown'}, {skin: null}, {skin: 'karaoke', surprise: true}]) {
    assert.equal(editManifestSchema.safeParse({...base(), captions: {...base().captions, ...patch}}).success, false);
  }
});

test('every skin draws intact words and identifies the spoken word at the actual mapped time', () => {
  for (const skin of skins) {
    const edit = {...base(), captions: {...base().captions, skin, presentation: 'ink-strip'}};
    const markup = renderer.renderCaptions({edit, frame: 35, center: 1390});
    assert.match(markup, new RegExp(`data-caption-skin="${skin}"`));
    assert.match(markup, /data-source-index="0" data-spoken="true"/);
    assert.match(markup, /سريع/);
    assert.doesNotMatch(markup, /background:#102027;/, 'skin overrides ink-strip paint');
    const next = renderer.renderCaptions({edit, frame: 65, center: 1390});
    assert.match(next, /data-source-index="1" data-spoken="true"/);
    assert.doesNotMatch(next, /data-source-index="0" data-spoken="true"/);
  }
});

test('spoken box uses word bounds, not cue bounds, and resolves overlaps to the newest word', async () => {
  const {spokenWordIndex} = await bundleEngine(`export {spokenWordIndex} from './engine/src/prepared-edit/caption-skins';`);
  const mapped = [{fromFrame: 10, toFrame: 20}, {fromFrame: 15, toFrame: 30}];
  for (const [frame, expected] of [[9, -1], [10, 0], [14, 0], [15, 1], [29, 1], [30, -1]]) assert.equal(spokenWordIndex(mapped, frame), expected);
});

test('stretch grows and relaxes inside the word window without changing Latin or slotless words', () => {
  assert.ok(emphasis.CAPTION_EMPHASIS_KINDS.includes('stretch'));
  assert.equal(typeof emphasis.stretchCaptionWord, 'function');
  const stretch = (text, frame, probe = false) => emphasis.stretchCaptionWord(text, frame, 30, 90, 30, probe);
  assert.equal(stretch('سريع', 29), 'سريع');
  assert.equal(stretch('سريع', 30), 'سريع');
  assert.equal((stretch('سريع', 45).match(/ـ/g) ?? []).length, 6);
  assert.equal(stretch('سريع', 90), 'سريع');
  assert.equal(stretch('سريع', 45, true), 'سريع');
  for (const text of ['AI', '2026', 'ورد', 'في']) assert.equal(stretch(text, 45), text);
  assert.equal(stretch('سريع', 45).replaceAll('ـ', ''), 'سريع');
  assert.equal(emphasis.stretchCaptionWord('سريع', 15, 10, 20, 30, false).includes('ـ'), true, 'short spoken windows still pulse');
});

test('stretch caption markup is fitted at a fixed size and keeps the original transcript', () => {
  const edit = {...base(), style: 'paper-collage', captions: {...base().captions, emphasis: [{sourceIndex: 0, kind: 'stretch'}]}};
  const before = JSON.stringify(edit);
  const start = renderer.renderCaptions({edit, frame: 30, center: 1390});
  const peak = renderer.renderCaptions({edit, frame: 42, center: 1390});
  assert.match(peak, /سـ+ريع/);
  assert.doesNotMatch(peak, /aria-hidden="true"/, 'no hidden widest form is left in the line: the room follows the word');
  assert.equal(start.match(/font-size:[^;]+/)[0], peak.match(/font-size:[^;]+/)[0]);
  assert.equal(JSON.stringify(edit), before);
});

test('static caption styles refuse stretch in schema and editor operations', () => {
  assert.equal(setEmphasis({...base(), style: 'paper-collage'}, 0, 'stretch').ok, true);
  for (const style of emphasis.STATIC_CAPTION_STYLES) {
    const m = {...base(), style};
    assert.equal(setEmphasis(m, 0, 'stretch').ok, false, style);
    assert.equal(editManifestSchema.safeParse({...m, captions: {...m.captions, emphasis: [{sourceIndex: 0, kind: 'stretch'}]}}).success, false, style);
  }
});

test('stretch fit chunks a crowded cue using its reserved width', () => {
  const edit = {...base(), style: 'paper-collage', fontFamily: 'Cairo', captions: {...base().captions, grouping: 'clauses',
    words: Array.from({length: 9}, (_, i) => ({text: 'سريع', startMs: i * 300, endMs: i * 300 + 290, confidence: 1})),
    emphasis: Array.from({length: 9}, (_, i) => ({sourceIndex: i, kind: 'stretch'}))}};
  for (const frame of [1, 10, 20, 30, 40, 50, 60, 70]) assert.doesNotThrow(() => renderer.renderCaptions({edit, frame, center: 1390}));
});

test('each skin, presentation and stretch has an inventory contract and a valid library fixture', async () => {
  const inventory = await collectLibraryInventory();
  for (const key of [...skins.map(skin => `caption-skin:${skin}`), ...['pill', 'minimal', 'ink-strip'].map(shape => `caption-presentation:${shape}`), 'caption-emphasis:stretch']) {
    assert.ok(inventory.items.some(item => item.key === key), key);
    assert.deepEqual(previewFixtureIssues(getPreviewDefinition(key)), [], key);
  }
});

test('new caption library records describe current implementations', async () => {
  const catalog = await collectLibraryEditorial();
  for (const key of [...skins.map(skin => `caption-skin:${skin}`), ...['pill', 'minimal', 'ink-strip'].map(shape => `caption-presentation:${shape}`), 'caption-emphasis:stretch']) {
    const item = catalog.items.find(item => item.key === key);
    assert.equal(item?.editorial?.assessment, 'current', key);
    assert.ok(item.editorial.requirements.length > 0);
  }
});

test('library recommendations refuse stretch with static captions and retain it with animated captions', async () => {
  const catalog = await collectLibraryEditorial();
  const recommend = style => recommendLibrary(catalog, {mode: 'recording', sourceKind: 'presenter', style, intent: 'word-emphasis',
    role: 'emphasis', assets: ['reviewed-words'], limit: 100});
  assert.ok(recommend('paper-collage').candidates.some(item => item.key === 'caption-emphasis:stretch'));
  for (const style of emphasis.STATIC_CAPTION_STYLES) assert.equal(recommend(style).candidates.some(item => item.key === 'caption-emphasis:stretch'), false, style);
});

test('skins retain the left-to-right order of an English phrase inside Arabic', async (t) => {
  const browserExecutable = path.join(ROOT, '.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe');
  if (!existsSync(browserExecutable)) return t.skip('Installed local Chromium is absent; never download for a test.');
  const {requireFromEngine} = await import('../scripts/lib/bundle.mjs');
  const browser = await requireFromEngine('@remotion/renderer').openBrowser('chrome', {browserExecutable, logLevel: 'error'});
  try {
    const page = await browser.newPage({context: () => null, logLevel: 'error', indent: false, pageIndex: 0, onBrowserLog: null, onLog: () => {}});
    for (const skin of skins) {
      const texts = ['جرّب', 'Visual', 'Studio', 'Code', 'دلوقتي'];
      const edit = {...base(), fontFamily: 'Cairo', captions: {...base().captions, grouping: 'clauses', skin, words: texts.map((text, i) => ({text,
        startMs: 1000 + i * 200, endMs: 1180 + i * 200, confidence: 1}))}};
      const markup = renderer.renderCaptions({edit, frame: 35, center: 1390});
      const positions = await page.evaluate(html => {
        document.body.innerHTML = html;
        return Array.from(document.querySelectorAll('[data-source-index]')).map(node => node.getBoundingClientRect().left);
      }, markup);
      assert.equal(positions.length, 5);
      assert.ok(positions[1] < positions[2] && positions[2] < positions[3], `${skin}: Visual Studio Code stays in reading order (${positions})`);
    }
  } finally {await browser.close({silent: true});}
});

test('look operations set, reset and reject skins while preserving other caption choices', () => {
  const m = base();
  const result = setLook(m, {captionsSkin: 'karaoke'});
  assert.equal(result.ok, true);
  assert.equal(result.manifest.captions.skin, 'karaoke');
  assert.deepEqual(result.manifest.captions.words, words);
  const reset = setLook(result.manifest, lookResetPatch(result.manifest, 'captionsSkin'));
  assert.equal(reset.ok, true);
  assert.equal(Object.hasOwn(reset.manifest.captions, 'skin'), false);
  assert.equal(setLook(m, {captionsSkin: 'invented'}).ok, false);
  assert.equal(setLook({...m, contentMode: 'graphics'}, {captionsSkin: 'karaoke'}).ok, false);
});

test('optional saved skin survives profile normalization and director planning', async () => {
  const profile = JSON.parse(await readFile(new URL('../PROFILE.example.json', import.meta.url), 'utf8'));
  const legacy = normalizeProfile(profile);
  assert.equal(Object.hasOwn(legacy.preferences, 'captionsSkin'), false);
  profile.preferences.captionsSkin = {mode: 'fixed', value: 'spoken-box'};
  const normalized = normalizeProfile(profile);
  const brief = {version: 1, id: 'caption-skins', source: source.path, ...profileToBrief(normalized), purpose: 'tutorial', tone: 'calm',
    transcript: 'Projects/caption-skins/words.json', beats: [{id: 'intro', intent: 'intro', fromSec: 0, toSec: 4,
      data: {kicker: 'مثال', title: 'فكرة', subtitle: 'شرح', caption: 'مثال'}}]};
  assert.equal(buildEditorPlan(brief, source, words).manifest.captions.skin, 'spoken-box');
  assert.equal(buildEditorPlan({...brief, captionsSkin: 'paper-tag'}, source, words).manifest.captions.skin, 'paper-tag');
});

// ---- the caption room follows the word -----------------------------------------------------------------------
// Owner decision for V4: "the words move and close the gap" (captions too). A stretching caption word takes the room of its current width,
// so the words around it glide apart and back, and the caption keeps its size and chunking, both decided with the longest form.

const T = 'ـ';
const pillOf = (html) => {
  const hit = html.match(/^<div[^>]*left:(-?\d+)px;top:(-?\d+)px;width:(\d+)px;height:(\d+)px/);
  assert.ok(hit, 'a caption is drawn');
  return {left: Number(hit[1]), width: Number(hit[3])};
};
const roomOf = (html) => {
  const hit = html.match(/display:inline-flex;justify-content:center;vertical-align:baseline;width:([\d.]+)px/);
  return hit ? Number(hit[1]) : null;
};
const sha = (parts) => crypto.createHash('sha256').update(parts.join('\n--frame--\n')).digest('hex');
const CAPTION_FRAMES = [5, 20, 30, 33, 36, 42, 48, 53, 54, 58, 65, 75, 95, 125];
const hashCaptions = (edit) => sha(CAPTION_FRAMES.map((frame) => renderer.renderCaptions({edit, frame, center: 1390})));
const withCaptions = (patch, over = {}) => ({...base(), style: 'paper-collage', ...over, captions: {...base().captions, ...patch}});
const stretchEdit = (patch = {}, over = {}) => withCaptions({emphasis: [{sourceIndex: 0, kind: 'stretch'}], ...patch}, over);

test('captions without a stretch word render exactly the markup they rendered before the room followed the word', () => {
  // Hashes taken from the code before the change.
  const expected = {
    plain: ['cebfef8282c2c0be269d774122a5bf87b4f304d1142e57a836e9bf064af28ffd', withCaptions({})],
    accent: ['a082f1c8e01c6ebb357484ff83407ac20093514b7570992c99faac39f15a0185', withCaptions({emphasis: [{sourceIndex: 0, kind: 'accent'}, {sourceIndex: 1, kind: 'underline'}]})],
    pop: ['d55a71e8fd39926229c510584c56e05601abe98b8f94d1e5b9df1b27e0074815', withCaptions({emphasis: [{sourceIndex: 0, kind: 'pop'}]})],
    minimal: ['15fb14b3a5da3f012e659702d12956a83fb4ee54db6c2c94931d742cdc34e17f', withCaptions({presentation: 'minimal'})],
    strip: ['513576f5864ef642d93ed7a56b8086631fe80da4a9c6167112cffa5f8dc3a3b1', withCaptions({presentation: 'ink-strip'})],
    'spoken-box': ['8457443a799f4f1ec2fdaff73ae4d049b7c9f857c7591639ae9c589f27a8ae5d', withCaptions({skin: 'spoken-box', presentation: 'ink-strip'})],
    karaoke: ['6a5ea9997346442c3fc4e96f00b83500918b12004eb29bc992879009a74d75e0', withCaptions({skin: 'karaoke', presentation: 'ink-strip'})],
    'bold-outline': ['3ac4b2709c369ce8d7431633b38f805161f7811a54981e22f5f98eef3323333f', withCaptions({skin: 'bold-outline', presentation: 'ink-strip'})],
    'soft-shadow': ['a62f850e71f24f01c65cbcc82decc69d33632ae63dd96607dd416657a9828a22', withCaptions({skin: 'soft-shadow', presentation: 'ink-strip'})],
    'paper-tag': ['0d22b25583c52b681f265a8895303ff556653b5a89b77c1c2c92515fc43fcfe5', withCaptions({skin: 'paper-tag', presentation: 'ink-strip'})],
    static: ['d246ece91223cb81ecbfc585343624e8363748b012c17bdf59f6c0ea83c16ed3', withCaptions({}, {style: 'section-deck'})],
  };
  for (const [name, [hash, edit]] of Object.entries(expected)) assert.equal(hashCaptions(edit), hash, name);
});

test('a stretch on a word that cannot stretch leaves the caption exactly as it was', () => {
  const latin = withCaptions({emphasis: [{sourceIndex: 2, kind: 'stretch'}]});
  assert.equal(hashCaptions(latin), '77060c2947b006e53cf4d543a0ef516150d11156cafac79bbe16f1056edf90f3');
  const slotless = withCaptions({words: ['ورد', 'سريع', 'AI'].map((text, i) => ({text, startMs: 1000 + i * 1000, endMs: 1800 + i * 1000, confidence: 1})),
    emphasis: [{sourceIndex: 0, kind: 'stretch'}]});
  assert.equal(hashCaptions(slotless), 'c89444dbbe6736161326487a9a9d8fb1a001b44b8316c5cf9a4d7c8d0e73dd89');
});

test('the safe-zone probe still draws the plain word in a box as wide as the longest form', async () => {
  const bundle = await bundleEngine(`
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {CaptionTrack} from './engine/src/prepared-edit/PreparedEdit';
    import {SafeRoot} from './engine/src/core/safe';
    export const render = (edit, compiled, probe) => renderToStaticMarkup(React.createElement(SafeRoot, {probe}, React.createElement(CaptionTrack, {edit, compiled, center: 1390})));
  `, {ssr: true, media: true});
  // Hashes taken from the code before the change.
  const expected = {
    stretch: ['f9e0d84887b04ec95affe7d4a1f56ac84a52868cf4f0ca7d86f0c6ebe9319c52', {}],
    'stretch with spoken-box': ['fa5dab23a2d7efe41873846ec83fbc9d29079632e52945fc2bbf32b04aa5aa2d', {skin: 'spoken-box'}],
  };
  for (const [name, [hash, patch]] of Object.entries(expected)) {
    const edit = editManifestSchema.parse(stretchEdit(patch));
    const compiled = compileEdit(edit);
    const parts = CAPTION_FRAMES.map((frame) => { setSsrFrame(frame); return bundle.render(edit, compiled, '#00ff00'); });
    assert.equal(sha(parts), hash, name);
    assert.match(parts[5], /aria-hidden="true"[^>]*>ســــــريع<\/span>/, `${name}: the probe sees the longest form as the box`);
    assert.equal(roomOf(parts[5]), null, `${name}: no moving room under the probe`);
  }
});

test('at rest the stretching caption word takes exactly its plain width, before and after the stretch', () => {
  const stretch = stretchEdit();
  const plain = withCaptions({});
  const rest = [30, 54, 75, 100].map((frame) => renderer.renderCaptions({edit: stretch, frame, center: 1390}));
  const widths = rest.map(roomOf);
  assert.ok(widths.every((width) => width !== null && width === widths[0]), `the same room at every rest frame (${widths})`);
  for (const [index, frame] of [30, 54, 75, 100].entries()) {
    const plainPill = pillOf(renderer.renderCaptions({edit: plain, frame, center: 1390}));
    const pill = pillOf(rest[index]);
    assert.ok(Math.abs(pill.width - plainPill.width) <= 1, `frame ${frame}: the caption is as wide as the plain caption (${pill.width} vs ${plainPill.width})`);
    assert.ok(Math.abs(pill.left - plainPill.left) <= 1, `frame ${frame}: and sits where it sits`);
    assert.doesNotMatch(rest[index], /aria-hidden/, `frame ${frame}: no reserved, hidden widest form is left in the line`);
  }
});

test('the room grows with the stretch and the caption grows by exactly what the word gained, never stepping', () => {
  const edit = stretchEdit();
  const frames = Array.from({length: 35}, (_, i) => 30 + i);
  const shown = frames.map((frame) => renderer.renderCaptions({edit, frame, center: 1390}));
  const rest = {room: roomOf(shown[frames.indexOf(30)]), pill: pillOf(shown[frames.indexOf(30)])};
  const peak = {room: roomOf(shown[frames.indexOf(42)]), pill: pillOf(shown[frames.indexOf(42)])};
  const tatweel = (peak.room - rest.room) / emphasis.CAPTION_STRETCH_TATWEELS;
  assert.ok(tatweel > 10, `a tatweel is a real width (${tatweel})`);
  frames.forEach((frame, index) => {
    const room = roomOf(shown[index]);
    const pill = pillOf(shown[index]);
    const amount = emphasis.stretchCaptionAmount(frame, 30, 54, 30, false);
    assert.ok(Math.abs(room - (rest.room + tatweel * amount)) <= 0.05, `frame ${frame}: the room follows the continuous amount (${room}, amount ${amount})`);
    assert.ok(Math.abs((pill.width - rest.pill.width) - (room - rest.room)) <= 1.5, `frame ${frame}: the caption is exactly as wide as its words need`);
    assert.ok(Math.abs((pill.left + pill.width / 2) - (rest.pill.left + rest.pill.width / 2)) <= 1, `frame ${frame}: the caption stays centred, so both neighbours move by half the growth`);
  });
  const longest = withCaptions({words: [{...words[0], text: 'سـ'.concat(T.repeat(5), 'ريع')}, words[1], words[2]]});
  assert.ok(Math.abs(peak.pill.width - pillOf(renderer.renderCaptions({edit: longest, frame: 42, center: 1390})).width) <= 1, 'at the peak the caption is as wide as the longest form needs');
  const half = frames.filter((frame) => { const amount = emphasis.stretchCaptionAmount(frame, 30, 54, 30, false); return amount % 1 > 0.25 && amount % 1 < 0.75; });
  assert.ok(half.length >= 3, 'the check covers frames between whole tatweels');
});

test('the drawn word is still one joined string with the original transcript untouched', () => {
  const edit = stretchEdit();
  const before = JSON.stringify(edit);
  for (const frame of [30, 33, 36, 42, 48, 53, 54]) {
    const markup = renderer.renderCaptions({edit, frame, center: 1390});
    const word = textNodes(markup).find((node) => node.replaceAll(T, '') === 'سريع');
    assert.ok(word, `the word is drawn at frame ${frame}`);
    assert.match(word, /^سـ*ريع$/, `one run of tatweels inside the word (frame ${frame})`);
    assert.equal(markup.match(/font-size:[^;]+/)[0], 'font-size:50px', 'the type size never changes');
  }
  assert.equal(JSON.stringify(edit), before);
});

test('chunking and type size stay decided by the longest form during a stretch', () => {
  const edit = {...base(), style: 'paper-collage', fontFamily: 'Cairo', captions: {...base().captions, grouping: 'clauses',
    words: Array.from({length: 9}, (_, i) => ({text: 'سريع', startMs: i * 300, endMs: i * 300 + 290, confidence: 1})),
    emphasis: Array.from({length: 9}, (_, i) => ({sourceIndex: i, kind: 'stretch'}))}};
  let windows = 0;
  for (let word = 0; word < 9; word++) {
    const from = Math.round(word * 0.3 * 30), to = Math.round((word * 300 + 290) / 1000 * 30);
    const seen = new Set();
    for (let frame = from + 1; frame < to; frame++) {
      const markup = renderer.renderCaptions({edit, frame, center: 1390});
      seen.add(`${markup.match(/font-size:[^;]+/)[0]}|${textNodes(markup).map((node) => node.replaceAll(T, '')).join(',')}`);
    }
    if (to - from > 3) { windows += 1; assert.equal(seen.size, 1, `word ${word}: the chunk and the size hold for its whole stretch (${[...seen]})`); }
  }
  assert.ok(windows >= 5, 'the check covered several stretching words');
});

test('a skin box wraps the moving word box and static styles keep refusing stretch', () => {
  const edit = stretchEdit({skin: 'spoken-box'});
  const widths = [30, 33, 36, 42, 75].map((frame) => {
    const markup = renderer.renderCaptions({edit, frame, center: 1390});
    const skin = markup.match(/<span data-source-index="0" data-spoken="(true|false)" style="([^"]*)">/);
    assert.ok(skin, `the skin wraps the word at frame ${frame}`);
    assert.doesNotMatch(skin[2], /width/, 'the skin box takes the width of its content, so it follows the word');
    assert.equal(skin[1], frame < 55 ? 'true' : 'false');
    assert.ok(markup.indexOf('display:inline-flex') > markup.indexOf('data-source-index="0"') && markup.indexOf('display:inline-flex') < markup.indexOf('data-source-index="1"'),
      `the moving room is inside the skin box (frame ${frame})`);
    return roomOf(markup);
  });
  assert.ok(widths[1] > widths[0] && widths[2] > widths[1] && widths[3] > widths[2], 'the skin box grows with the word');
  assert.equal(widths[4], widths[0]);
  for (const style of emphasis.STATIC_CAPTION_STYLES) {
    // The schema refuses the combination; a hand-made manifest that slips past it still draws a still word.
    const markup = renderer.renderCaptions({edit: stretchEdit({}, {style}), frame: 42, center: 1390});
    assert.doesNotMatch(markup, /ـ|inline-flex|inline-grid|aria-hidden/, `${style}: a static caption has no moving word`);
  }
});

test('in a real layout the spoken box wraps the moving word box and the gaps to its neighbours never change', async (t) => {
  const browserExecutable = path.join(ROOT, '.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe');
  if (!existsSync(browserExecutable)) return t.skip('Installed local Chromium is absent; never download for a test.');
  const {requireFromEngine} = await import('../scripts/lib/bundle.mjs');
  const browser = await requireFromEngine('@remotion/renderer').openBrowser('chrome', {browserExecutable, logLevel: 'error'});
  try {
    const page = await browser.newPage({context: () => null, logLevel: 'error', indent: false, pageIndex: 0, onBrowserLog: null, onLog: () => {}});
    const edit = stretchEdit({skin: 'spoken-box'});
    const rows = [];
    for (const frame of [30, 33, 36, 42, 50, 54, 75]) {
      const markup = renderer.renderCaptions({edit, frame, center: 1390});
      rows.push(await page.evaluate(html => {
        document.body.innerHTML = html;
        const rect = node => node.getBoundingClientRect();
        const skin = document.querySelector('[data-source-index="0"]');
        const next = document.querySelector('[data-source-index="1"]');
        const room = Array.from(skin.querySelectorAll('span')).find(node => getComputedStyle(node).display === 'inline-flex');
        return {skinLeft: rect(skin).left, skinWidth: rect(skin).width, roomLeft: rect(room).left, roomWidth: rect(room).width, gap: rect(skin).left - rect(next).right};
      }, markup));
    }
    rows.forEach((row, index) => {
      assert.ok(Math.abs(row.skinWidth - row.roomWidth) <= 1.5, `row ${index}: the skin box is as wide as the word's room (${row.skinWidth} vs ${row.roomWidth})`);
      assert.ok(Math.abs(row.skinLeft - row.roomLeft) <= 1.5, `row ${index}: and starts where the room starts`);
      assert.ok(Math.abs(row.gap - rows[0].gap) <= 1.5, `row ${index}: the gap to the next word is the normal word gap (${row.gap} vs ${rows[0].gap})`);
    });
    assert.ok(rows[3].roomWidth > rows[0].roomWidth + 20, 'the box really grows with the word');
    assert.ok(Math.abs(rows[6].roomWidth - rows[0].roomWidth) <= 1.5, 'and goes back to the plain word width');
  } finally {await browser.close({silent: true});}
});

test('stretchCaptionAmount is the continuous curve behind stretchCaptionWord: same timing, no rounding', () => {
  for (const fps of [24, 30, 60]) {
    for (const [from, to] of [[30, 90], [10, 20], [5, 9], [0, 300]]) {
      for (let frame = from - 2; frame <= to + 2; frame++) {
        const amount = emphasis.stretchCaptionAmount(frame, from, to, fps, false);
        const drawn = emphasis.stretchCaptionWord('سريع', frame, from, to, fps, false);
        assert.equal((drawn.match(/ـ/g) ?? []).length, Math.round(amount), `${fps} fps, ${from}-${to}, frame ${frame}`);
        assert.ok(amount >= 0 && amount <= emphasis.CAPTION_STRETCH_TATWEELS);
        assert.equal(emphasis.stretchCaptionAmount(frame, from, to, fps, true), 0, 'the probe sees the plain word');
      }
    }
  }
  assert.equal(emphasis.stretchCaptionAmount(30, 30, 90, 30, false), 0);
  assert.equal(emphasis.stretchCaptionAmount(90, 30, 90, 30, false), 0);
  assert.equal(emphasis.stretchCaptionAmount(45, 30, 90, 30, false), emphasis.CAPTION_STRETCH_TATWEELS);
  assert.equal(emphasis.stretchCaptionAmount(45, 30, 90, 0, false), 0, 'no fps, no stretch');
  let last = 0;
  let between = 0;
  for (let i = 3000; i <= 9000; i++) {
    const amount = emphasis.stretchCaptionAmount(i / 100, 30, 90, 30, false);
    assert.ok(Math.abs(amount - last) < 0.06, `a smooth curve at frame ${i / 100}: ${last} -> ${amount}`);
    if (amount % 1 > 0.05 && amount % 1 < 0.95) between += 1;
    last = amount;
  }
  assert.ok(between > 100, 'it spends its time between whole tatweels, not only on them');
});
