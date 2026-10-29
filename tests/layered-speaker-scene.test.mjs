import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {STYLE_IDS, STYLE_METAS, getStyleMeta, ownSceneStyle, purposeFit, toneFit} from '../engine/src/styles/registry.ts';
import {editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {LAYERED_FAMILIES, layeredSceneSchema, validateLayeredTiming, layeredAssets} from '../engine/src/styles/layered-speaker/scenes/schema.ts';
import {layeredTemplate, layeredTemplateData, layeredTemplateFrames} from '../engine/src/styles/layered-speaker/scenes/templates.ts';
import {styleSceneFamilies, styleSceneSchema, styleSceneAssets, validateStyleSceneTiming} from '../engine/src/styles/scenes.ts';
import {captionHiddenByScene} from '../engine/src/prepared-edit/visibility.ts';
import {HEAD_GUIDE_FAMILIES} from '../engine/src/creative-kit/head-clear.ts';
import {sceneVideoSources, sceneMovingSources} from '../engine/src/core/scene-media.ts';
import {fieldLabel, fieldsForFamily, formFamilies, validateData} from '../engine/src/review-editor/panels/form-schema.ts';
import {TEMPLATE_FAMILIES, addSceneFromTemplate, sceneDemoFields, templateFamiliesFor} from '../engine/src/review-editor/ops/scenes.ts';
import {repairForegrounds, dropForegrounds} from '../engine/src/review-editor/ops/anchors.ts';
import {assertNoSampleText, autoSoundPlan, buildEditorPlan, BEAT_FAMILIES} from '../scripts/lib/editor-director.mjs';
import {loadStylePalette, loadStylePalettes} from '../scripts/lib/sfx-events.mjs';
import {sceneCues} from '../scripts/lib/scene-cues.mjs';
import {profileToBrief} from '../scripts/lib/branding.mjs';
import {reviewManifest} from './helpers/review-manifest.mjs';
import {validateManifest} from '../engine/src/review-editor/validate.ts';

const ID = 'layered-speaker';
const data = (change = (d) => d) => change(structuredClone(layeredTemplate));
const scene = (changeData = (d) => d, over = {}) => ({
  id: 'key-word', family: ID, fromFrame: 0, durationInFrames: 90, layout: 'presenter', motion: 'land', ...over, data: data(changeData),
});
const matte = (over = {}) => ({src: '_prepared/x/matte-0123456789abcdef.webm', sourceSha256: 'a'.repeat(64), sourceFromFrame: 0, frames: 120, trimBeforeFrame: 0, ...over});

const manifest = (style = ID, fps = 30) => {
  const m = reviewManifest();
  m.style = style;
  m.source.fps = fps;
  m.source.totalFrames = 600;
  m.segments = [{fromFrame: 0, toFrame: 600}];
  m.scenes = [];
  return m;
};

test('the style is registered after cartoon, owns one presenter family and fits below the asserted winners', () => {
  assert.ok(STYLE_IDS.indexOf(ID) > STYLE_IDS.indexOf('cartoon'));
  const meta = getStyleMeta(ID);
  assert.deepEqual([...meta.ownScenes], ['layered-speaker']);
  assert.deepEqual([...LAYERED_FAMILIES], ['layered-speaker']);
  assert.ok(styleSceneFamilies.includes(ID));
  assert.equal(ownSceneStyle(ID), ID);
  assert.equal(meta.since, '4.0.0');
  assert.equal(meta.label.ar, 'حوالين المتكلم');
  assert.equal(meta.label.en, 'Layered speaker');
  assert.equal(meta.brand, false);
  assert.equal(meta.pip.allowed, false);
  assert.equal(meta.legacy, false);
  assert.equal(meta.defaults.font, 'Cairo');
  assert.equal(meta.defaults.captionsPresentation, 'minimal');
  assert.deepEqual([...meta.fit.semanticBeats], ['layered-speaker']);
  // The winners other tests assert: opinion -> magazine-interview 18, story -> paper-collage 18, explainer -> section-deck 16, energetic tone -> kinetic-paper 6.
  assert.ok(meta.fit.purpose.opinion < 18 && meta.fit.purpose.story < 18 && meta.fit.purpose.explainer < 16);
  assert.ok(meta.fit.tone.energetic < 6);
  assert.equal(purposeFit().opinion[ID], meta.fit.purpose.opinion);
  assert.equal(toneFit().energetic[ID], meta.fit.tone.energetic);
  assert.equal(STYLE_METAS.filter((item) => item.id === ID).length, 1);
});

test('the sound palette is silent at the cut and sounds only the big word and the mark', () => {
  const sound = JSON.parse(readFileSync(new URL('../engine/src/styles/layered-speaker/sound.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(sound.kinds).sort(), ['click', 'count', 'reveal', 'stamp', 'swap', 'transition', 'type']);
  const voiced = Object.entries(sound.kinds).filter(([, kind]) => kind.recipe !== null).map(([name, kind]) => [name, kind.recipe]);
  assert.deepEqual(voiced, [['swap', 'highlight-swipe'], ['reveal', 'soft-pop']]);
  for (const kind of Object.values(sound.kinds)) assert.ok(!/sweep|whoosh|swipe-sweep/.test(kind.recipe ?? ''), 'no sweep');
});

const luminance = (hex) => {
  const channel = (offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('every text pair of the theme reaches 4.5:1', async () => {
  const {build} = (await import('node:module')).createRequire(new URL('../engine/package.json', import.meta.url))('esbuild');
  const result = await build({stdin: {contents: "export {getStyleTheme} from './engine/src/styles/themes';", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts'},
    nodePaths: [fileURLToPath(new URL('../engine/node_modules', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent'});
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', result.outputFiles[0].text)((await import('node:module')).createRequire(new URL('../engine/package.json', import.meta.url)), mod, mod.exports);
  const theme = mod.exports.getStyleTheme(ID);
  const pairs = [[theme.text, theme.background], [theme.text, theme.card], [theme.dim, theme.background], [theme.dim, theme.card], [theme.accentInk, theme.background],
    [theme.accentInk, theme.card], [theme.badInk, theme.background], [theme.good, theme.background], [theme.pillText, theme.pill], [theme.onAccent, theme.accent]];
  for (const [fg, bg] of pairs) assert.ok(contrast(fg, bg) >= 4.5, `${fg} on ${bg}: ${contrast(fg, bg).toFixed(2)}`);
});

test('the starter scene is valid and every rule of the schema refuses what it names', () => {
  assert.ok(layeredSceneSchema.parse(scene()));
  assert.ok(styleSceneSchema.parse(scene()));
  const bad = (change, pattern, over) => assert.throws(() => layeredSceneSchema.parse(scene(change, over)), pattern);
  bad((d) => { d.extra = 1; return d; }, /unrecognized/i);
  bad((d) => { d.words[0].extra = 1; return d; }, /unrecognized/i);
  bad((d) => { d.words = []; return d; }, /too.small|at least 1/i);
  bad((d) => { d.words.push({place: 'above', text: 'سطر', atFrame: 10}, {place: 'left', text: 'تاني', atFrame: 12}); return d; }, /Only one word can sit left|too.big|at most 4/i);
  bad((d) => { d.words[1].place = 'left'; return d; }, /Only one word can sit left/);
  bad((d) => { d.words[1].text = '  '; return d; }, /blank/i);
  bad((d) => { d.words[1].text = 'ا'.repeat(27); return d; }, /too.big|at most 26|<=26/i);
  bad((d) => { d.words[0].place = 'middle'; return d; }, /invalid/i);
  bad(undefined, /invalid/i, {layout: 'takeover'});
  bad(undefined, /invalid/i, {layout: 'split'});
  bad((d) => { d.words[0].mark = {kind: 'wave', atFrame: 10}; return d; }, /invalid/i);
});

test('the big word needs one Arabic word with a connection that can stretch', () => {
  const behind = (text) => scene((d) => { d.words[0].text = text; return d; });
  assert.ok(layeredSceneSchema.parse(behind('كبير')));
  assert.ok(layeredSceneSchema.parse(behind('الفرق')));
  for (const text of ['ورا', 'دار', 'Big', '123', 'كلمتين معا', 'ا', 'اسمٌ', 'مستشفياتهم الكبيرة']) {
    // Words with no legal slot, a Latin word, a number or two words: refused with the way out named.
    if (text === 'اسمٌ') continue;
    assert.throws(() => layeredSceneSchema.parse(behind(text)), /behind the head/, text);
  }
  assert.throws(() => layeredSceneSchema.parse(behind('مستشفيات'.repeat(2))), /behind the head/, 'longer than 12 letters');
});

test('without a matte the big word goes above the head, so a line above it is refused; with a matte both fit', () => {
  const both = (foreground) => scene((d) => { d.words.push({place: 'above', text: 'سطر فوق', atFrame: 20}); if (foreground) d.foreground = matte(); return d; });
  assert.throws(() => layeredSceneSchema.parse(both(false)), /Without a matte/);
  assert.ok(layeredSceneSchema.parse(both(true)));
});

test('at most two marks, and every mark kind is accepted', () => {
  const marks = (count) => scene((d) => {
    d.words = [{place: 'behind', text: 'كبير', atFrame: 6, mark: {kind: 'underline', atFrame: 10}}, {place: 'left', text: 'يمين', atFrame: 20, mark: {kind: 'circle', atFrame: 24}}, {place: 'right', text: 'شمال', atFrame: 30}];
    if (count > 2) d.words[2].mark = {kind: 'band', atFrame: 34};
    return d;
  });
  assert.ok(layeredSceneSchema.parse(marks(2)));
  assert.throws(() => layeredSceneSchema.parse(marks(3)), /At most 2 hand-drawn marks/);
  for (const kind of ['circle', 'band', 'strike', 'arrow', 'underline']) {
    assert.ok(layeredSceneSchema.parse(scene((d) => { d.words[1].mark = {kind, atFrame: 40}; return d; })), kind);
  }
});

test('the big word takes only the marks that fit around a word that wide', () => {
  const hero = (kind) => scene((d) => { d.words[0].mark = {kind, atFrame: 20}; return d; });
  for (const kind of ['underline', 'band', 'strike']) assert.ok(layeredSceneSchema.parse(hero(kind)), kind);
  for (const kind of ['circle', 'arrow']) assert.throws(() => layeredSceneSchema.parse(hero(kind)), /does not fit around the big word/, kind);
});

test('timing: words need time on screen, a mark waits for its word and finishes before the end, a matte covers the scene', () => {
  const issues = (change, over, fps = 30) => validateLayeredTiming(layeredSceneSchema.parse(scene(change, over)), fps);
  assert.deepEqual(issues(), [], 'the starter scene is on time');
  assert.deepEqual(validateStyleSceneTiming(styleSceneSchema.parse(scene()), 30), []);
  assert.match(issues(undefined, {durationInFrames: 60}).join('|'), /word 3 \(left\) lands at frame 48; it needs 18 frames on screen/);
  assert.match(issues((d) => { d.words[1].mark.atFrame = 20; return d; }).join('|'), /circle on word 2 \(right\) starts before the word lands/);
  assert.match(issues((d) => { d.words[1].mark.atFrame = 80; return d; }).join('|'), /circle on word 2 \(right\) needs 15 frames to draw and the scene ends first/);
  assert.match(issues(undefined, {durationInFrames: 40}).join('|'), /these words need at least \d+ frames/);
  assert.deepEqual(issues((d) => { d.foreground = matte({trimBeforeFrame: 20, frames: 120}); return d; }), []);
  assert.match(issues((d) => { d.foreground = matte({trimBeforeFrame: 50, frames: 120}); return d; }).join('|'), /key-word: foreground does not cover the scene/);
  assert.match(issues(undefined, {durationInFrames: 45}, 60).join('|'), /at least|needs/, 'a higher frame rate needs more frames for the same seconds');
});

test('the manifest refuses the family in any other style and accepts it here', () => {
  const ok = manifest();
  ok.scenes = [scene()];
  assert.ok(editManifestSchema.parse(ok));
  const elsewhere = manifest('paper-collage');
  elsewhere.scenes = [scene()];
  assert.throws(() => editManifestSchema.parse(elsewhere), /layered-speaker scenes are available only in layered-speaker/);
});

test('a matte must follow the presenter frames exactly, and the manifest says so', () => {
  const withMatte = (foreground, over = {}) => {
    const m = manifest();
    m.source.sha256 = 'a'.repeat(64);
    m.scenes = [scene((d) => { d.foreground = foreground; return d; }, over)];
    return m;
  };
  assert.ok(editManifestSchema.parse(withMatte(matte({sourceFromFrame: 0, trimBeforeFrame: 0}))), 'scene at frame 0 plays the matte from its frame 0');
  assert.ok(editManifestSchema.parse(withMatte(matte({sourceFromFrame: 0, trimBeforeFrame: 100, frames: 300}), {fromFrame: 100})));
  const wrongSource = matte({sourceSha256: 'b'.repeat(64)});
  assert.throws(() => editManifestSchema.parse(withMatte(wrongSource)), /Foreground must match the same continuous source frames/);
  assert.throws(() => editManifestSchema.parse(withMatte(matte({trimBeforeFrame: 7}))), /Foreground must match the same continuous source frames/);
  const cut = manifest();
  cut.segments = [{fromFrame: 0, toFrame: 50}, {fromFrame: 200, toFrame: 600}];
  cut.scenes = [scene((d) => { d.foreground = matte({frames: 600}); return d; })];
  assert.throws(() => editManifestSchema.parse(cut), /Foreground must match the same continuous source frames/, 'a scene that spans a cut cannot carry a matte');
});

test('the matte is a moving file of the scene, listed as an asset, and the editor can repair or drop it', () => {
  const withMatte = scene((d) => { d.foreground = matte(); return d; });
  assert.deepEqual(layeredAssets(layeredSceneSchema.parse(withMatte)), [matte().src]);
  assert.deepEqual(styleSceneAssets(styleSceneSchema.parse(withMatte)), [matte().src]);
  assert.deepEqual(sceneMovingSources(withMatte).foreground, [matte().src]);
  assert.deepEqual(sceneVideoSources(withMatte), [matte().src]);
  assert.deepEqual(sceneVideoSources(scene()), [], 'no matte, no moving file');
  const m = manifest();
  m.source.sha256 = 'a'.repeat(64);
  m.scenes = [{...withMatte, fromFrame: 30}];
  const repaired = repairForegrounds(m);
  assert.deepEqual(repaired.fixed, ['key-word']);
  assert.equal(repaired.manifest.scenes[0].data.foreground.trimBeforeFrame, 30);
  assert.deepEqual(dropForegrounds(repaired.manifest, ['key-word']).scenes[0].data.foreground, undefined);
  assert.deepEqual(dropForegrounds(repaired.manifest, ['key-word']).scenes[0].data.words, withMatte.data.words, 'the words stay');
});

test('the head guide measures this family, and the caption stays on screen under it', () => {
  assert.ok(HEAD_GUIDE_FAMILIES.includes(ID));
  assert.equal(captionHiddenByScene({family: ID}), false);
  assert.equal(captionHiddenByScene({family: 'cartoon'}), true, 'other style-owned families still hide it');
  assert.equal(captionHiddenByScene({family: 'glide-card'}), true);
});

test('the director accepts a layered-speaker beat and keeps its words', () => {
  assert.equal(BEAT_FAMILIES[ID], ID);
  const base = reviewManifest();
  const source = {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 300};
  const brief = {version: 1, id: 'layered-test', source: source.path, transcript: 'Projects/layered-test/words.json', purpose: 'opinion', tone: 'energetic', style: ID,
    ...profileToBrief(JSON.parse(readFileSync(new URL('../PROFILE.example.json', import.meta.url), 'utf8'))),
    beats: [{id: 'word', fromSec: 1, toSec: 4.5, intent: ID, data: structuredClone(layeredTemplate)}]};
  const plan = buildEditorPlan({...brief, style: ID}, source, [{text: 'شرح', startMs: 0, endMs: 400, confidence: 1}]);
  assert.equal(plan.manifest.style, ID);
  assert.equal(plan.manifest.scenes[0].family, ID);
  assert.equal(plan.manifest.scenes[0].layout, 'presenter');
  assert.deepEqual(plan.manifest.scenes[0].data.words.map((w) => w.text), layeredTemplate.words.map((w) => w.text));
  assert.ok(base);
});

test('sounds "auto" places one pop on the big word and one tap on the mark', async () => {
  const m = manifest();
  m.scenes = [scene(undefined, {fromFrame: 30})];
  const cues = sceneCues(m.scenes[0], 30);
  assert.deepEqual(cues.map((c) => [c.frame, c.kind]), [[30, 'transition'], [36, 'reveal'], [72, 'swap']]);
  const palette = await loadStylePalette(ID);
  const plan = autoSoundPlan(m, palette);
  assert.equal(plan.style, ID);
  assert.deepEqual(plan.sounds.map((s) => [s.atFrame, s.recipe]), [[36, 'soft-pop'], [72, 'highlight-swipe']]);
  const palettes = await loadStylePalettes();
  assert.ok(palettes.styles[ID]);
  assert.doesNotThrow(() => editManifestSchema.parse({...m, sounds: plan.sounds}));
});

test('the editor offers the starter scene only in this style, valid at every frame rate, and flags only the placeholder copy', () => {
  assert.ok(TEMPLATE_FAMILIES.includes(ID));
  assert.ok(templateFamiliesFor(ID).includes(ID));
  assert.equal(templateFamiliesFor('paper-collage').includes(ID), false);
  for (const fps of [30, 50, 60]) {
    const added = addSceneFromTemplate(manifest(ID, fps), ID, {atFrame: 0});
    assert.equal(added.ok, true, `${fps} fps: ${JSON.stringify(added.error ?? added.issues ?? '')}`);
    const next = added.manifest.scenes[0];
    assert.equal(next.layout, 'presenter');
    assert.equal(next.durationInFrames, layeredTemplateFrames(fps));
    assert.deepEqual(validateLayeredTiming(layeredSceneSchema.parse(next), fps), []);
  }
  assert.equal(addSceneFromTemplate({...manifest(), style: 'paper-collage'}, ID, {atFrame: 0}).ok, false);
  const demo = sceneDemoFields({family: ID, data: structuredClone(layeredTemplate)});
  assert.deepEqual(demo.sort(), ['words.0.text', 'words.1.text', 'words.2.text']);
  const edited = structuredClone(layeredTemplate);
  edited.words[0].text = 'ممتاز';
  assert.deepEqual(sceneDemoFields({family: ID, data: edited}).sort(), ['words.1.text', 'words.2.text'], 'an edited word is no longer sample text; place and mark kind never are');
  assert.deepEqual(Object.keys(layeredTemplateData), [ID]);
});

test('the form knows the family and labels its fields in Arabic', () => {
  assert.ok(formFamilies().includes(ID));
  const keys = new Set(JSON.stringify(fieldsForFamily(ID)).match(/"key":"[A-Za-z]+"/g).map((entry) => entry.slice(7, -1)));
  for (const key of ['words', 'place', 'text', 'atFrame', 'accent', 'mark', 'kind', 'foreground']) {
    assert.ok(keys.has(key), key);
    assert.match(fieldLabel(key), /\p{Script=Arabic}/u, key);
  }
  assert.deepEqual(validateData(ID, structuredClone(layeredTemplate)).issues ?? [], []);
});

test('the starter words never reach a delivered video: the delivery check names them, and real words pass', () => {
  const m = manifest();
  m.scenes = [scene()];
  assert.throws(() => assertNoSampleText(m), /Delivery sample text: scene key-word still holds the template words at data.words.0.text, data.words.1.text, data.words.2.text/);
  const real = manifest();
  real.scenes = [scene((d) => { d.words[0].text = 'ممتاز'; d.words[1].text = 'كلمتي الأولى'; d.words[2].text = 'كلمتي التانية'; return d; })];
  assert.doesNotThrow(() => assertNoSampleText(real));
});

test('the editor lists the starter words as an error to fix before delivery', () => {
  const m = manifest();
  m.scenes = [scene()];
  const result = validateManifest(m);
  const sample = (result.issues ?? []).filter((issue) => issue.code === 'delivery:sample-text');
  assert.equal(sample.length, 1, JSON.stringify(result.issues?.map((i) => i.code)));
  assert.match(sample[0].message, /key-word/);
});
