import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {checkArabic, ARABIC_CHECK_CODES, installedFonts, arabicFailureMessage, arabicReviewLines} from '../scripts/lib/arabic-check.mjs';
import {checkArabicString, checkArabicMarkup, visibleStrings} from '../engine/src/core/arabic-check.ts';
import {collectLiterals} from '../scripts/lib/text-check.mjs';
import {familyCoverage} from '../scripts/lib/font-coverage.mjs';

const fontsFolder = fileURLToPath(new URL('../engine/public/fonts/', import.meta.url));
const haveFonts = existsSync(`${fontsFolder}Cairo-arabic-400.woff2`) && existsSync(`${fontsFolder}manifest.json`);

// Code points written as escapes so no editor can normalise them away.
const SHUKRAN = 'شكرا\u064B'; // tanween on the final alef: a single mark, fine
const LAM_ALEF_FORM = '\uFEFB'; // ARABIC LIGATURE LAM WITH ALEF ISOLATED FORM: a presentation form
const ZWNJ = '\u200C';
const TATWEEL = '\u0640';
const FATHA = '\u064E';
const SHADDA = '\u0651';

const range = (from, to) => Array.from({length: to - from + 1}, (_, index) => from + index);
// A stand-in for the coverage of a font: ASCII, the Arabic alphabet, its digits, tatweel and harakat.
const cairoLike = (without = '') => {
  const covered = new Set([...range(0x20, 0x7e), 0xa0, 0xab, 0xbb, ...range(0x0621, 0x063a), ...range(0x0641, 0x064a), ...range(0x064b, 0x0652), 0x0640, ...range(0x0660, 0x0669), ...range(0x06f0, 0x06f9), 0x060c, 0x061f, 0x061b, 0x2026]);
  for (const ch of without) covered.delete(ch.codePointAt(0));
  return covered;
};
const fonts = (without) => new Map([['Cairo', cairoLike(without)]]);

const word = (text, i) => ({text, startMs: i * 400, endMs: i * 400 + 300, confidence: 1});
const manifestOf = ({words = [], scenes = [], ...rest} = {}) => ({
  version: 1, id: 'arabic-test', purpose: 'delivery', style: 'kinetic-paper', fontFamily: 'Cairo',
  captions: {status: 'reviewed', reviewer: 'test', words: words.map(word)}, scenes, sounds: [], camera: [], ...rest,
});
const scene = (data, extra = {}) => ({id: 'b1', family: 'intro', fromFrame: 0, durationInFrames: 90, layout: 'split', motion: 'land', data, ...extra});
const codes = (result, level) => result.problems.filter((problem) => !level || problem.level === level).map((problem) => problem.code);

test('the code table matches the owner decision: broken joins and missing glyphs fail, the rest goes to review', () => {
  assert.deepEqual(Object.entries(ARABIC_CHECK_CODES).filter(([, level]) => level === 'fail').map(([code]) => code).sort(),
    ['missing-glyph', 'per-letter-transform', 'presentation-forms', 'split-word-markup', 'tatweel-edge', 'zwnj-in-word']);
  assert.deepEqual(Object.entries(ARABIC_CHECK_CODES).filter(([, level]) => level === 'needs-review').map(([code]) => code).sort(),
    ['digit-style', 'long-line', 'mixed-direction', 'stacked-harakat']);
});

test('a plain Arabic caption and scene copy in Cairo is ok and reports nothing', () => {
  const manifest = manifestOf({words: [SHUKRAN, 'ليك', 'يا', 'كلود'], scenes: [scene({title: 'ببلاش', subtitle: 'جرب النهارده'})]});
  const result = checkArabic({manifest, fonts: fonts()});
  assert.equal(result.ok, true, JSON.stringify(result.problems));
  assert.deepEqual(result.problems, []);
});

test('the real Cairo font draws plain Arabic copy', {skip: !haveFonts}, async () => {
  const cairo = await familyCoverage('Cairo', {fontsDir: fontsFolder});
  const result = checkArabic({manifest: manifestOf({words: [SHUKRAN, 'كلود'], scenes: [scene({title: 'ببلاش'})]}), fonts: {Cairo: cairo}});
  assert.equal(result.ok, true, JSON.stringify(result.problems));
  assert.deepEqual(codes(result), []);
});

test('a presentation-form character in a caption word fails', () => {
  const result = checkArabic({manifest: manifestOf({words: ['كلا', `ك${LAM_ALEF_FORM}م`]}), fonts: fonts()});
  assert.equal(result.ok, false);
  const hit = result.problems.find((problem) => problem.code === 'presentation-forms');
  assert.ok(hit, JSON.stringify(result.problems));
  assert.equal(hit.level, 'fail');
  assert.equal(hit.where, 'captions.words[1]');
  assert.match(hit.detail, /FEFB/);
});

test('the honorific ligatures and the ornate parentheses are symbols, not presentation forms', () => {
  assert.deepEqual(checkArabicString('\uFDFD \uFDFA \uFD3Eب\uFD3F', {}).map((p) => p.code), []);
});

test('a tatweel at the start or the end of a word fails; a tatweel inside a word does not', () => {
  assert.deepEqual(codes(checkArabic({manifest: manifestOf({words: [`${TATWEEL}كتب`]}), fonts: fonts()}), 'fail'), ['tatweel-edge']);
  assert.deepEqual(codes(checkArabic({manifest: manifestOf({words: [`كتب${TATWEEL}`]}), fonts: fonts()}), 'fail'), ['tatweel-edge']);
  assert.deepEqual(codes(checkArabic({manifest: manifestOf({words: [`كت${TATWEEL}ب`]}), fonts: fonts()})), []);
  assert.deepEqual(codes(checkArabic({manifest: manifestOf({words: [`${TATWEEL}${TATWEEL}${TATWEEL}`]}), fonts: fonts()})), [], 'a rule made only of tatweels is decoration, not a word');
});

test('a ZWNJ between two Arabic letters fails; one beside a space does not', () => {
  const bad = checkArabic({manifest: manifestOf({words: [`كتب${ZWNJ}نا`]}), fonts: fonts()});
  assert.deepEqual(codes(bad, 'fail'), ['zwnj-in-word']);
  assert.deepEqual(codes(checkArabic({manifest: manifestOf({words: [`كتب${ZWNJ}`, 'نا']}), fonts: fonts()})), []);
});

test('a character the chosen font does not draw fails as missing-glyph, and the detail names it', () => {
  const manifest = manifestOf({scenes: [scene({title: 'ببلاش', subtitle: 'گاز'})]});
  const result = checkArabic({manifest, fonts: fonts('گ')});
  const hit = result.problems.find((problem) => problem.code === 'missing-glyph');
  assert.ok(hit, JSON.stringify(result.problems));
  assert.equal(hit.level, 'fail');
  assert.equal(hit.where, 'scenes[b1].data.subtitle');
  assert.equal(hit.text, 'گاز');
  assert.match(hit.detail, /U\+06AF/);
  assert.equal(result.ok, false);
});

test('invisible joiners and bidi marks are never a missing glyph, and an emoji or a symbol goes to review', () => {
  const result = checkArabic({manifest: manifestOf({words: ['ك\u200Dتب', 'ببلاش\u200F', 'تمام\u{1F600}', 'تمام✓']}), fonts: fonts()});
  const missing = result.problems.filter((problem) => problem.code === 'missing-glyph');
  assert.deepEqual(missing.map((problem) => problem.level), ['needs-review', 'needs-review']);
  assert.deepEqual(missing.map((problem) => problem.where), ['captions.words[2]', 'captions.words[3]']);
  assert.equal(result.ok, true, 'a symbol the system font draws never blocks delivery');
});

test('spaces of every width are never a missing glyph', () => {
  assert.deepEqual(checkArabicString('كتب\u2009\u00A0\u202F\u3000\u2003تب', {coverage: cairoLike()}), []);
});

test('the glyph check names the font it used and skips, with a note, a font whose coverage is unknown', () => {
  const manifest = manifestOf({scenes: [scene({title: 'ببلاش'}), scene({title: 'نص', font: 'Lalezar'}, {id: 'b2'})]});
  const result = checkArabic({manifest, fonts: fonts()});
  assert.equal(result.ok, true);
  assert.ok(result.notes.some((note) => /Lalezar/.test(note) && /glyph/i.test(note)), JSON.stringify(result.notes));
  assert.ok(!result.notes.some((note) => /Cairo/.test(note)));
});

test('the font comes from the scene, then the manifest, then the profile, then the style default', () => {
  const only = (coverage) => new Map(Object.entries(coverage));
  const full = Object.fromEntries(['Cairo', 'Tajawal', 'Lalezar', 'Noto Kufi Arabic'].map((name) => [name, cairoLike()]));
  const sceneWith = (font) => scene({title: 'ببلاش', ...(font ? {font} : {})});
  // scene font wins over the manifest font
  assert.equal(checkArabic({manifest: manifestOf({scenes: [sceneWith('Tajawal')]}), fonts: only({...full, Tajawal: cairoLike('ب')})}).ok, false);
  assert.equal(checkArabic({manifest: manifestOf({scenes: [sceneWith('Cairo')], fontFamily: 'Tajawal'}), fonts: only({...full, Tajawal: cairoLike('ب')})}).ok, true);
  // manifest font wins over the profile and the style
  assert.equal(checkArabic({manifest: manifestOf({scenes: [sceneWith()], fontFamily: 'Tajawal'}), fonts: only({...full, Tajawal: cairoLike('ب')})}).ok, false);
  // no manifest font: the profile's fixed font, then the style default (kinetic-paper writes in Lalezar)
  const noFont = manifestOf({scenes: [sceneWith()]});
  delete noFont.fontFamily;
  const profile = {preferences: {font: {mode: 'fixed', value: 'Noto Kufi Arabic'}}};
  assert.equal(checkArabic({manifest: noFont, profile, fonts: only({...full, 'Noto Kufi Arabic': cairoLike('ب')})}).ok, false);
  assert.equal(checkArabic({manifest: noFont, fonts: only({...full, Lalezar: cairoLike('ب')})}).ok, false, 'kinetic-paper defaults to Lalezar');
  assert.equal(checkArabic({manifest: noFont, fonts: only({...full, Cairo: cairoLike('ب')})}).ok, true, 'a hole in an unused font is not a problem');
});

test('Latin or a signed number inside an Arabic line goes to review, and a plain number does not', () => {
  const mixed = checkArabic({manifest: manifestOf({scenes: [scene({title: 'جر\u0651ب ChatGPT دلوقتي'})]}), fonts: fonts()});
  assert.deepEqual(codes(mixed), ['mixed-direction']);
  assert.equal(mixed.problems[0].level, 'needs-review');
  assert.equal(mixed.ok, true, 'a review item never blocks on its own');
  assert.deepEqual(codes(checkArabic({manifest: manifestOf({scenes: [scene({title: 'خلال 3 أيام بس'})]}), fonts: fonts()})), []);
  assert.deepEqual(codes(checkArabic({manifest: manifestOf({scenes: [scene({title: 'زيادة +3 نقاط'})]}), fonts: fonts()})), ['mixed-direction']);
  assert.deepEqual(codes(checkArabic({manifest: manifestOf({scenes: [scene({title: 'ChatGPT Plus'})]}), fonts: fonts()})), [], 'an English line is not an Arabic line');
});

test('caption words are judged in their neighbourhood: a Latin word between Arabic words is one grouped review item', () => {
  const words = ['جر\u0651ب', 'ChatGPT', 'دلوقتي', 'ولو', 'عايز', 'ChatGPT', 'تاني'];
  const result = checkArabic({manifest: manifestOf({words}), fonts: fonts()});
  const hits = result.problems.filter((problem) => problem.code === 'mixed-direction');
  assert.equal(hits.length, 1, 'the same Latin word is reported once');
  assert.equal(hits[0].where, 'captions.words[1]');
  assert.match(hits[0].detail, /2/);
  assert.deepEqual(codes(checkArabic({manifest: manifestOf({words: ['Top', '10', 'tools']}), fonts: fonts()})), []);
});

test('two harakat on one letter go to review, one mark does not', () => {
  const result = checkArabic({manifest: manifestOf({words: [`م${FATHA}${SHADDA}${TATWEEL}`]}), fonts: fonts()});
  assert.ok(codes(result, 'needs-review').includes('stacked-harakat'), JSON.stringify(result.problems));
  assert.deepEqual(codes(checkArabic({manifest: manifestOf({words: [SHUKRAN, `جر${SHADDA}ب`]}), fonts: fonts()})), []);
  const doubled = checkArabic({manifest: manifestOf({words: [`م${SHADDA}${SHADDA}`]}), fonts: fonts()});
  assert.match(doubled.problems.find((problem) => problem.code === 'stacked-harakat').detail, /doubled|twice/i);
});

test('digit style: Arabic-Indic digits against the Western default go to review, and the profile and manifest choices decide', () => {
  const manifest = manifestOf({words: ['سنة', '٢٠٢٦']});
  const western = {preferences: {digits: {mode: 'fixed', value: 'latin'}}};
  const unset = checkArabic({manifest, fonts: fonts()});
  assert.deepEqual(codes(unset), ['digit-style'], 'no choice means the Western default');
  const viaProfile = checkArabic({manifest, profile: western, fonts: fonts()});
  assert.deepEqual(codes(viaProfile), ['digit-style']);
  assert.equal(viaProfile.problems[0].level, 'needs-review');
  assert.equal(viaProfile.problems[0].where, 'captions.words[1]');
  const indic = checkArabic({manifest: {...manifest, digits: 'arabic-indic'}, fonts: fonts()});
  assert.deepEqual(codes(indic), [], 'Arabic-Indic digits are what the creator chose');
  const profileIndic = checkArabic({manifest, profile: {preferences: {digits: {mode: 'fixed', value: 'arabic-indic'}}}, fonts: fonts()});
  assert.deepEqual(codes(profileIndic), []);
  const persian = checkArabic({manifest: {...manifestOf({words: ['سنة', '۲۰۲۶']}), digits: 'arabic-indic'}, fonts: fonts()});
  assert.deepEqual(codes(persian), ['digit-style'], 'Persian digits are not the Arabic-Indic choice');
  assert.deepEqual(codes(checkArabic({manifest: manifestOf({words: ['سنة', '2026']}), fonts: fonts()})), [], 'Western digits are the default; the studio maps them while drawing');
});

test('a very long line or an unbroken run goes to review', () => {
  const long = Array.from({length: 24}, () => 'كلمة').join(' ');
  assert.deepEqual(codes(checkArabic({manifest: manifestOf({scenes: [scene({subtitle: long})]}), fonts: fonts()})), ['long-line']);
  assert.deepEqual(codes(checkArabic({manifest: manifestOf({scenes: [scene({subtitle: 'ك'.repeat(30)})]}), fonts: fonts()})), ['long-line']);
  assert.deepEqual(codes(checkArabic({manifest: manifestOf({scenes: [scene({subtitle: 'عنوان عادي وقصير'})]}), fonts: fonts()})), []);
  assert.deepEqual(codes(checkArabic({manifest: manifestOf({scenes: [scene({subtitle: 'https://example.com/a/very/long/path/that/goes/on/and/on'})]}), fonts: fonts()})), []);
});

test('markup that glues a one-letter fragment to the letter beside it fails; whole words in elements pass', () => {
  assert.deepEqual(checkArabicMarkup('<span>ك</span><span>تب</span>').map((p) => p.code), ['split-word-markup']);
  assert.deepEqual(checkArabicMarkup('<span>كتب</span> <span>AI</span>'), []);
  assert.deepEqual(checkArabicMarkup('<span>دا</span><span>ر</span>').map((p) => p.code), [], 'a non-joining letter before the break cannot break a join');
  assert.deepEqual(checkArabicMarkup('كت<br>ب'), [], 'a line break ends a word, it does not cut one');
  assert.deepEqual(checkArabicMarkup('<div>ب</div><div>وقت</div>'), [], 'a one-letter label in its own block is not glued to the next block');
  assert.deepEqual(checkArabicMarkup('<b>كت</b>ب').map((p) => p.code), ['split-word-markup']);
  assert.deepEqual(checkArabicMarkup('<span>ك</span><span>ت</span><span>ب</span>').map((p) => p.code), ['split-word-markup'], 'one report for a word cut letter by letter');
  assert.deepEqual(checkArabicMarkup('<div>كلمة</div><div>سطر</div>'), [], 'two blocks side by side are not a split word: markup alone cannot tell');
  assert.deepEqual(checkArabicMarkup('<p>كتب</p><p>نا</p>'), [], 'fragments of several letters on both sides are left to the eyes');
});

test('a transform on a single Arabic letter inside a word fails', () => {
  const found = checkArabicMarkup('<span style="display:inline-block;transform:translateY(4px)">ك</span><span>تب</span>');
  assert.deepEqual(found.map((p) => p.code).sort(), ['per-letter-transform', 'split-word-markup']);
  assert.equal(found.every((p) => p.level === 'fail'), true);
  assert.deepEqual(checkArabicMarkup('<span style="transform:scale(1.2)">و</span> <span>كتب</span>'), [], 'a one-letter word may move');
  assert.deepEqual(checkArabicMarkup('<span style="transform:scale(1.2)">كتب</span>'), []);
});

test('markup passed to checkArabic is reported with its own location and fails the check', () => {
  const result = checkArabic({manifest: manifestOf(), markup: [{where: 'frame 30', html: '<i>ك</i><i>تب</i>'}], fonts: fonts()});
  assert.equal(result.ok, false);
  assert.equal(result.problems[0].where, 'frame 30');
  assert.equal(result.problems[0].code, 'split-word-markup');
});

test('a string in a manifest field that holds markup is checked as markup', () => {
  const result = checkArabic({manifest: manifestOf({scenes: [scene({title: '<span>ك</span><span>تب</span>'})]}), fonts: fonts()});
  assert.deepEqual(codes(result, 'fail'), ['split-word-markup']);
});

test('the {keyword} placeholder of a creator CTA prompt is read as the keyword that is drawn', () => {
  const prompt = 'اكتب {keyword} وسأرسل لك الدليل';
  const arabicKeyword = checkArabic({manifest: manifestOf({scenes: [scene({prompt, keyword: 'دليل'}, {family: 'creator-cta'})]}), fonts: fonts()});
  assert.deepEqual(codes(arabicKeyword), [], 'the placeholder alone is not Latin text');
  const latinKeyword = checkArabic({manifest: manifestOf({scenes: [scene({prompt, keyword: 'GUIDE'}, {family: 'creator-cta'})]}), fonts: fonts()});
  assert.deepEqual(codes(latinKeyword), ['mixed-direction'], 'a Latin keyword inside an Arabic prompt is mixed direction');
  const fromProfile = manifestOf({scenes: [scene({prompt}, {family: 'creator-cta'})], creator: {displayName: 'محمد', handle: null, ending: {cta: 'GUIDE', followCard: false, signOff: null}}});
  assert.deepEqual(codes(checkArabic({manifest: fromProfile, fonts: fonts()})), ['mixed-direction'], 'the keyword of the creator profile fills the placeholder too');
  assert.deepEqual(codes(checkArabic({manifest: manifestOf({scenes: [scene({prompt})]}), fonts: fonts()})), [], 'no keyword known: the placeholder is ignored');
});

test('caption words that are never drawn are left out, and scene copy is still checked', () => {
  const hidden = manifestOf({words: ['\u0640كتب'], scenes: [scene({title: 'عنوان\u0640'})]});
  hidden.captions.visible = false;
  const result = checkArabic({manifest: hidden, fonts: fonts()});
  assert.deepEqual(result.problems.map((problem) => problem.where), ['scenes[b1].data.title']);
  assert.ok(result.notes.some((note) => /not drawn/.test(note)), JSON.stringify(result.notes));
  assert.equal(checkArabic({manifest: manifestOf({words: ['\u0640كتب']}), fonts: fonts()}).ok, false, 'visible captions are checked');
});

test('the creator name and ending lines are checked too', () => {
  const manifest = manifestOf({creator: {displayName: 'محمد', handle: '@example', ending: {cta: 'كلمة', followCard: false, signOff: `الى اللقاء${TATWEEL}`}}});
  const result = checkArabic({manifest, fonts: fonts()});
  const hit = result.problems.find((problem) => problem.code === 'tatweel-edge');
  assert.equal(hit?.where, 'creator.ending.signOff');
});

test('the string walker reads the very fields text-check reads, and nothing technical', () => {
  const scenes = [
    scene({title: 'عنوان', kicker: 'مقدمة', color: '#FFFFFF', src: 'Projects/a/b.png', items: [{label: 'واحد', detail: 'تفصيل', icon: 'check'}, {label: 'اتنين'}], values: [1, 2]}),
    scene({text: 'نص', font: 'Cairo', accent: '#000000', nested: {deep: {line: 'سطر', url: 'https://example.com'}}}, {id: 'b2', family: 'kinetic-text'}),
  ];
  const mine = visibleStrings(manifestOf({scenes})).filter((item) => item.kind === 'scene').map((item) => item.text);
  const theirs = collectLiterals(scenes).map((item) => item.text).filter((text) => !/^\d+$/.test(text));
  assert.deepEqual(mine.sort(), theirs.sort());
  assert.ok(!mine.includes('Cairo') && !mine.includes('#000000'));
});

test('partial and odd manifests never throw', () => {
  for (const manifest of [null, undefined, {}, {captions: null}, {captions: {words: [null, {text: 5}, {}]}}, {scenes: [null, {data: null}, {data: 'x'}, {id: 'a', data: {t: [null, [], {}]}}]}]) {
    const result = checkArabic({manifest, fonts: fonts()});
    assert.equal(result.ok, true);
  }
});

test('the failure message names the code and the place, and the review lines list every review item', () => {
  const manifest = manifestOf({words: [`${TATWEEL}كتب`, 'جر\u0651ب', 'ChatGPT', 'دلوقتي']});
  const result = checkArabic({manifest, fonts: fonts()});
  const message = arabicFailureMessage(result);
  assert.match(message, /tatweel-edge/);
  assert.match(message, /captions\.words\[0\]/);
  const lines = arabicReviewLines(result);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /mixed-direction/);
});

test('the installed fonts load lazily from engine/public/fonts and cover Arabic text', {skip: !haveFonts}, () => {
  const loader = installedFonts();
  assert.ok(loader('Cairo').has(0x0628));
  assert.equal(loader('No Such Family'), null);
  const result = checkArabic({manifest: manifestOf({words: ['كتب', 'گاز'], fontFamily: 'Tajawal'}), fonts: loader});
  assert.ok(codes(result, 'fail').includes('missing-glyph'), 'Tajawal does not draw the Persian gaf');
  assert.equal(checkArabic({manifest: manifestOf({words: ['كتب', 'گاز'], fontFamily: 'Cairo'}), fonts: loader}).ok, true);
});
