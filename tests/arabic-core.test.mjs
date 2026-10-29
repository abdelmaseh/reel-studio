import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// The Arabic core is pure TypeScript. Node strips the types, so the tests import the modules directly
// (index.ts also re-exports the React font hook, which Node cannot load, so import the modules one by one).
const url = (name) => new URL(`../engine/src/arabic/${name}.ts`, import.meta.url);
const {joiningType, joinsForward, joinsBackward, graphemes} = await import(url('joining'));

const TATWEEL = 'ـ';
const count = (text, ch = TATWEEL) => [...text].filter((c) => c === ch).length;

test('the arabic core files exist where the spec puts them', () => {
  for (const name of ['joining.ts', 'kashida.ts', 'segment.ts', 'shaping-fixes.ts', 'fonts.tsx', 'lint.ts', 'index.ts']) {
    assert.ok(existsSync(fileURLToPath(new URL(`../engine/src/arabic/${name}`, import.meta.url))), name);
  }
});

// ---- joining -------------------------------------------------------------------------------------------------

test('joiningType classifies dual, right-joining, non-joining, transparent and join-causing characters', () => {
  assert.equal(joiningType('ب'), 'D');
  assert.equal(joiningType('س'), 'D');
  assert.equal(joiningType('ا'), 'R');
  for (const ch of 'أإآٱدذرزوؤةى') assert.equal(joiningType(ch), 'R', ch);
  assert.equal(joiningType('ء'), 'U');
  assert.equal(joiningType('َ'), 'T'); // fatha
  for (const code of [0x064b, 0x0651, 0x0652, 0x065f, 0x0670]) assert.equal(joiningType(String.fromCodePoint(code)), 'T', code.toString(16));
  assert.equal(joiningType('ـ'), 'C'); // tatweel
  assert.equal(joiningType('‍'), 'C'); // zero width joiner
  assert.equal(joiningType('A'), 'U');
  assert.equal(joiningType(' '), 'U');
  assert.equal(joiningType('5'), 'U');
  assert.equal(joiningType('‌'), 'U'); // zero width non-joiner never joins
});

test('joiningType covers the Persian and Urdu letters the core knows and ignores empty input', () => {
  for (const ch of 'پچگکی') assert.equal(joiningType(ch), 'D', ch);
  for (const ch of 'ڈڑژۆۇۈۋۅۉ') assert.equal(joiningType(ch), 'R', ch);
  assert.equal(joiningType(''), 'U');
});

test('joinsForward and joinsBackward follow the next and previous letters, skipping transparent marks', () => {
  assert.equal(joinsForward('كتب', 0), true);
  assert.equal(joinsForward('كتب', 1), true);
  assert.equal(joinsForward('كتب', 2), false, 'nothing follows the last letter');
  assert.equal(joinsForward('دار', 0), false, 'dal never joins forward');
  assert.equal(joinsForward('دار', 1), false, 'alef never joins forward');
  assert.equal(joinsForward('كَتب', 0), true, 'the fatha at index 1 is skipped: kaf still joins teh');
  assert.equal(joinsForward('كَتب', 1), false, 'a mark itself never joins');
  assert.equal(joinsForward('كَتب', 2), true, 'the teh joins the beh');
  assert.equal(joinsBackward('كتب', 1), true);
  assert.equal(joinsBackward('كتب', 0), false, 'nothing precedes the first letter');
  assert.equal(joinsBackward('دار', 1), false, 'dal does not reach forward, so alef stays isolated');
  assert.equal(joinsBackward('كتاب', 2), true, 'alef is joined by the teh before it');
});

test('a mark between two letters does not stop them joining', () => {
  // ك + fatha + ت : the kaf still joins the teh (index 0 is the kaf).
  assert.equal(joinsForward('كَت', 0), true);
  assert.equal(joinsBackward('كَت', 2), true);
  assert.equal(joinsForward('كَت', 1), false, 'a mark itself never joins');
});

test('non-Arabic characters and spaces never join', () => {
  assert.equal(joinsForward('A ب', 0), false);
  assert.equal(joinsForward('ك ب', 0), false, 'a space ends the join');
  assert.equal(joinsBackward('ك ب', 2), false);
  assert.equal(joinsForward('كA', 0), false);
});

test('tatweel and joiner extend a join', () => {
  assert.equal(joinsForward('كـتب', 0), true, 'the tatweel carries the join');
  assert.equal(joinsForward('كـتب', 1), true, 'the tatweel itself joins the next letter');
  assert.equal(joinsForward('ك‍ت', 0), true);
  assert.equal(joinsForward('ك‍', 0), true, 'a trailing joiner asks for a joined form');
});

test('index out of range is safe', () => {
  assert.equal(joinsForward('كتب', -1), false);
  assert.equal(joinsForward('كتب', 99), false);
  assert.equal(joinsBackward('كتب', -1), false);
  assert.equal(joinsBackward('كتب', 99), false);
});

test('graphemes keeps a base letter with its harakat', () => {
  assert.equal(graphemes('كَتَبَ').length, 3);
  assert.deepEqual(graphemes('كَتَبَ'), ['كَ', 'تَ', 'بَ']);
  assert.deepEqual(graphemes('كتب'), ['ك', 'ت', 'ب']);
  assert.deepEqual(graphemes('مَّا'), ['مَّ', 'ا'], 'shadda + fatha stay on the meem');
  assert.deepEqual(graphemes('ab'), ['a', 'b']);
  assert.deepEqual(graphemes(''), []);
  assert.equal(graphemes('كَتَبَ').join(''), 'كَتَبَ', 'joining the graphemes returns the text');
});

// ---- kashida -------------------------------------------------------------------------------------------------

const {kashidaSlots, stretchWord, stretchLine} = await import(url('kashida'));
const T = TATWEEL;

test('stretchWord(word, 1) follows the legal-slot table', () => {
  const table = [
    ['ببلاش', 'بب' + T + 'لاش'],
    ['كلود', 'كل' + T + 'ود'],
    ['مونتاج', 'مون' + T + 'تاج'],
    ['شكرا', 'ش' + T + 'كرا'],
    ['سريع', 'س' + T + 'ريع'],
    ['الأسهل', 'الأس' + T + 'هل'],
    ['كَتَبَ', 'كَتَ' + T + 'بَ'],
  ];
  for (const [input, expected] of table) assert.equal(stretchWord(input, 1), expected, input);
});

test('words with no legal slot, short words and non-Arabic words stay unchanged', () => {
  for (const word of ['ورد', 'دار', 'في', 'مع', 'من', 'لا', 'AI', '2026', '', 'ChatGPT', '٢٠٢٦']) assert.equal(stretchWord(word, 3), word, word);
});

test('stretchWord puts every tatweel at the best slot unless maxPerSlot spreads them', () => {
  assert.equal(stretchWord('سريع', 4), 'س' + T.repeat(4) + 'ريع');
  assert.equal(count(stretchWord('سريع', 4)), 4);
  assert.equal(stretchWord('مونتاج', 4, {maxPerSlot: 2}), 'مون' + T.repeat(2) + 'ت' + T.repeat(2) + 'اج');
  assert.equal(stretchWord('مونتاج', 3, {maxPerSlot: 2}), 'مون' + T.repeat(2) + 'ت' + T + 'اج', 'the first slot fills first');
  assert.equal(stretchWord('مونتاج', 1, {maxPerSlot: 2}), 'مون' + T + 'تاج');
});

test('stretchWord drops tatweels it has no room for and ignores a zero or negative count', () => {
  // مونتاج has three legal slots; maxPerSlot 1 can place three.
  assert.equal(count(stretchWord('مونتاج', 9, {maxPerSlot: 1})), 3);
  for (const n of [0, -2, NaN, 0.4]) assert.equal(stretchWord('سريع', n), 'سريع', String(n));
  assert.equal(count(stretchWord('سريع', 2.9)), 2, 'a fraction counts down');
});

test('kashidaSlots lists legal slots best first with their priority', () => {
  assert.deepEqual(kashidaSlots('سريع'), [{index: 0, priority: 3}, {index: 2, priority: 2}]);
  assert.deepEqual(kashidaSlots('كَتَبَ'), [{index: 3, priority: 1}, {index: 1, priority: 0}], 'the slot sits after the whole harakat cluster');
  assert.deepEqual(kashidaSlots('ببلاش').map((s) => s.index), [1, 0]);
  assert.deepEqual(kashidaSlots('مونتاج').map((s) => s.index), [2, 3, 0], 'middle first among equal priorities');
  for (const word of ['ورد', 'دار', 'في', 'AI', '2026', '']) assert.deepEqual(kashidaSlots(word), [], word);
});

test('a tie in priority and distance goes to the slot nearer the start of the word', () => {
  // Five letters, slots after letters 1 and 2 are equally far from the middle.
  assert.deepEqual(kashidaSlots('بببدا').map((s) => s.index).slice(0, 2), [1, 2]);
  assert.equal(stretchWord('بببدا', 1), 'بب' + T + 'بدا');
});

test('priorities: +3 after seen/sheen/sad/dad, +2 before the last letter, -1 before a final beh-family letter', () => {
  assert.equal(kashidaSlots('شكرا')[0].priority, 3);
  assert.equal(kashidaSlots('ليك')[0].priority, 2, 'next letter kaf is last');
  assert.equal(kashidaSlots('كتب')[0].priority, 1, 'next letter is last (+2) and a final beh (-1)');
  assert.equal(kashidaSlots('ضيف')[0].priority, 3 + 0, 'dad outranks the last-letter bonus');
  assert.equal(kashidaSlots('كلود')[0].priority, 0);
});

test('no tatweel ever lands inside lam-alef, at the word start or end, or between a letter and its own mark', () => {
  const words = ['الأسهل', 'بلاغ', 'ألآن', 'الإسلام', 'ولاية', 'كلام', 'سلام', 'علاء', 'الله', 'بسم', 'مَدْرَسَة', 'التَّعْلِيمُ', 'مُسْتَقْبَل', 'فِيلْم', 'شُكْرًا', 'ببلاش', 'مونتاج', 'كَتَبَ', 'استخدام', 'الذكاء', 'تطبيق', 'الدعوة'];
  for (const word of words) {
    for (const slot of kashidaSlots(word)) {
      const out = word.slice(0, slot.index + 1) + T + word.slice(slot.index + 1);
      assert.doesNotMatch(out, /ل[ً-ٟ]*ـ+[اأإآٱ]/, `${word} lam-alef: ${out}`);
      assert.doesNotMatch(out, /^ـ|ـ$/, `${word} edge: ${out}`);
      assert.doesNotMatch(out, /ـ[ً-ٰٟ]/, `${word} mark after tatweel: ${out}`);
      assert.doesNotMatch(out, /[اأإآٱدذرزوؤةءى][ً-ٟ]*ـ/, `${word} after a non-joining letter: ${out}`);
    }
    const stretched = stretchWord(word, 5);
    assert.doesNotMatch(stretched, /ل[ً-ٟ]*ـ+[اأإآٱ]/, word);
  }
});

test('stretchWord keeps the letters and marks in order: removing the tatweels gives the word back', () => {
  for (const word of ['ببلاش', 'كَتَبَ', 'الأسهل', 'مُسْتَقْبَل', 'شكراً', 'مدرسة']) {
    assert.equal(stretchWord(word, 7, {maxPerSlot: 3}).replaceAll(T, ''), word);
  }
});

test('stretchWord works on the Arabic run inside a token with punctuation or Latin around it', () => {
  assert.equal(stretchWord('شكرا،', 1), 'ش' + T + 'كرا،');
  assert.equal(stretchWord('«كلود»', 1), '«كل' + T + 'ود»');
  assert.equal(stretchWord('AI-ببلاش', 1), 'AI-بب' + T + 'لاش');
});

test('stretchLine spreads the extra tatweels over the words that have slots', () => {
  const line = 'شكرا ليك يا كلود';
  const out = stretchLine(line, 6);
  assert.equal(count(out), 6);
  const words = out.split(' ');
  assert.equal(words.length, 4);
  assert.equal(words[2], 'يا', 'a word with no slot stays unchanged');
  const per = words.map((w) => count(w));
  assert.ok(per[0] >= per[1] && per[1] >= per[3] && per[0] > per[3], `most to the highest priority word: ${per}`);
  assert.equal(out.replaceAll(T, ''), line);
});

test('stretchLine leaves a line alone when nothing can stretch or no extra is asked', () => {
  assert.equal(stretchLine('في AI 2026', 4), 'في AI 2026');
  assert.equal(stretchLine('شكرا ليك', 0), 'شكرا ليك');
  assert.equal(stretchLine('', 3), '');
});

test('stretchLine keeps the original spacing', () => {
  assert.equal(stretchLine('شكرا   ليك', 2).replaceAll(T, ''), 'شكرا   ليك');
});

// ---- shaping fixes -------------------------------------------------------------------------------------------

const {typewriterSlice, rubaaFix} = await import(url('shaping-fixes'));
const ZWJ = '‍';

test('typewriterSlice shows the first letters and asks for a joined form while the next letter is still hidden', () => {
  assert.equal(typewriterSlice('مونتاج', 2), 'مو', 'waw never joins forward, so no joiner');
  assert.equal(typewriterSlice('كتب', 1), 'ك' + ZWJ);
  assert.equal(typewriterSlice('كتب', 2), 'كت' + ZWJ);
  assert.equal(typewriterSlice('كتب', 3), 'كتب', 'the whole text needs no joiner');
  assert.equal(typewriterSlice('مكتبة', 4), 'مكتب' + ZWJ, 'beh still joins the final teh marbuta');
});

test('typewriterSlice counts a letter with its harakat as one step', () => {
  assert.equal(typewriterSlice('كَتب', 1), 'كَ' + ZWJ);
  assert.equal(typewriterSlice('كَتب', 2), 'كَت' + ZWJ);
});

test('typewriterSlice never joins across a space and copes with bad counts', () => {
  assert.equal(typewriterSlice('كتب بيت', 3), 'كتب');
  assert.equal(typewriterSlice('كتب بيت', 4), 'كتب ');
  assert.equal(typewriterSlice('كتب بيت', 5), 'كتب ب' + ZWJ);
  assert.equal(typewriterSlice('AB', 1), 'A');
  assert.equal(typewriterSlice('كتب', 0), '');
  assert.equal(typewriterSlice('كتب', -3), '');
  assert.equal(typewriterSlice('كتب', 1.9), 'ك' + ZWJ);
  assert.equal(typewriterSlice('كتب', 99), 'كتب');
  assert.equal(typewriterSlice('', 2), '');
});

test('rubaaFix puts a joiner before a final teh marbuta that follows a non-joining letter', () => {
  assert.equal(rubaaFix('قاعدة'), 'قاعد' + ZWJ + 'ة');
  assert.equal(rubaaFix('كبيرة'), 'كبير' + ZWJ + 'ة');
  assert.equal(rubaaFix('مدرسة'), 'مدرسة', 'seen joins, so nothing to fix');
  assert.equal(rubaaFix('جميلة'), 'جميلة');
  assert.equal(rubaaFix('قاعدة كبيرة'), 'قاعد' + ZWJ + 'ة كبير' + ZWJ + 'ة', 'every word of a line');
  assert.equal(rubaaFix('قاعدةً'), 'قاعد' + ZWJ + 'ةً', 'a tanween does not make it non-final');
});

test('rubaaFix leaves other text alone and is idempotent', () => {
  for (const text of ['كتب', 'ة', 'AI', '2026', '', 'مدرستنا', 'ChatGPT']) assert.equal(rubaaFix(text), text, text);
  const once = rubaaFix('قاعدة');
  assert.equal(rubaaFix(once), once);
  assert.equal(rubaaFix('قاعد' + ZWJ + 'ة'), 'قاعد' + ZWJ + 'ة', 'an existing joiner is respected');
  assert.equal(rubaaFix('ة ة'), 'ة ة', 'a lone teh marbuta has no letter before it to fix');
});

// ---- segmentation (pure, over ImageData-like objects) --------------------------------------------------------

const {segmentBlobs, kashidaBar, rasterLine, canvasFont, INK_ALPHA} = await import(url('segment'));

const makeImage = (width, height) => ({width, height, data: new Uint8ClampedArray(width * height * 4)});
const ink = (img, x, y, alpha = 255) => {
  const o = (y * img.width + x) * 4;
  img.data[o] = 200; img.data[o + 1] = 100; img.data[o + 2] = 50; img.data[o + 3] = alpha;
};
const rect = (img, x, y, w, h, alpha = 255) => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) ink(img, i, j, alpha);
};

test('segmentBlobs: one wide body and two small dots', () => {
  const img = makeImage(200, 80);
  rect(img, 40, 30, 100, 20);
  rect(img, 60, 8, 6, 6);
  rect(img, 90, 62, 6, 6);
  const blobs = segmentBlobs(img, 100);
  assert.equal(blobs.length, 3);
  assert.equal(blobs.filter((b) => b.kind === 'body').length, 1);
  assert.equal(blobs.filter((b) => b.kind === 'dot').length, 2);
  const body = blobs.find((b) => b.kind === 'body');
  assert.deepEqual([body.x, body.y, body.w, body.h, body.area], [40, 30, 100, 20, 2000]);
  const dot = blobs.find((b) => b.kind === 'dot' && b.x === 60);
  assert.deepEqual([dot.x, dot.y, dot.w, dot.h, dot.area], [60, 8, 6, 6, 36]);
});

test('segmentBlobs: the dot rule is h < 0.34 S, w < 0.42 S and area < 0.06 S^2', () => {
  const classify = (w, h) => {
    const img = makeImage(120, 120);
    rect(img, 10, 10, w, h);
    return segmentBlobs(img, 100)[0].kind;
  };
  assert.equal(classify(20, 20), 'dot');
  assert.equal(classify(24, 24), 'dot', '576 < 600');
  assert.equal(classify(25, 25), 'body', '625 is not < 600');
  assert.equal(classify(30, 33), 'body', 'area 990');
  assert.equal(classify(41, 14), 'dot', 'w 41 < 42, area 574');
  assert.equal(classify(42, 10), 'body', 'w must be < 42');
  assert.equal(classify(10, 34), 'body', 'h must be < 34');
  assert.equal(classify(10, 33), 'dot');
});

test('segmentBlobs connects diagonally (8-connected) and keeps a one pixel gap apart', () => {
  const touching = makeImage(40, 40);
  rect(touching, 2, 2, 5, 5);
  rect(touching, 7, 7, 5, 5);
  assert.equal(segmentBlobs(touching, 100).length, 1, 'corners touch');
  const apart = makeImage(40, 40);
  rect(apart, 2, 2, 5, 5);
  rect(apart, 8, 8, 5, 5);
  assert.equal(segmentBlobs(apart, 100).length, 2, 'a one pixel gap separates');
});

test('segmentBlobs: ink is alpha above 32, and each mask holds only its own blob', () => {
  const img = makeImage(60, 30);
  rect(img, 5, 5, 10, 10, INK_ALPHA); // exactly 32: not ink
  rect(img, 20, 5, 10, 10, INK_ALPHA + 1);
  rect(img, 40, 5, 4, 4);
  ink(img, 41, 6, 0); // a hole in the small blob
  const blobs = segmentBlobs(img, 100);
  assert.equal(blobs.length, 2);
  const big = blobs.find((b) => b.w === 10);
  assert.equal(big.x, 20);
  assert.equal(big.mask.width, 10);
  assert.equal(big.mask.height, 10);
  assert.equal(big.mask.data.length, 10 * 10 * 4);
  assert.equal(big.mask.data[3], INK_ALPHA + 1);
  assert.equal(big.mask.data[0], 200, 'colour is copied');
  const small = blobs.find((b) => b.w === 4);
  assert.equal(small.area, 15, 'the hole is not ink');
  assert.equal(small.mask.data[(1 * 4 + 1) * 4 + 3], 0, 'the hole stays transparent in the mask');
  // Masks never contain another blob's pixels.
  for (const blob of blobs) {
    let count = 0;
    for (let i = 3; i < blob.mask.data.length; i += 4) if (blob.mask.data[i] > INK_ALPHA) count += 1;
    assert.equal(count, blob.area);
  }
});

test('segmentBlobs returns blobs right to left, then top to bottom', () => {
  const img = makeImage(120, 60);
  rect(img, 10, 10, 20, 20);
  rect(img, 50, 10, 20, 20);
  rect(img, 90, 40, 20, 10);
  rect(img, 90, 5, 20, 10);
  assert.deepEqual(segmentBlobs(img, 100).map((b) => [b.x, b.y]), [[90, 5], [90, 40], [50, 10], [10, 10]]);
});

test('segmentBlobs: an empty image has no blobs and a bad size is refused', () => {
  assert.deepEqual(segmentBlobs(makeImage(20, 20), 50), []);
  assert.throws(() => segmentBlobs(makeImage(5, 5), 0), /size/);
  assert.throws(() => segmentBlobs(makeImage(5, 5), NaN), /size/);
});

test('kashidaBar finds the widest thin run with a constant top and bottom', () => {
  const img = makeImage(200, 100);
  rect(img, 0, 20, 5, 60); // an alef-like stem: tall, not thin
  rect(img, 10, 50, 60, 4); // the bar
  rect(img, 100, 30, 25, 4); // a shorter thin run
  assert.deepEqual(kashidaBar(img, 100), {x0: 10, x1: 70, top: 50, bottom: 54});
});

test('kashidaBar does not swallow a thin final stroke that drops below the baseline', () => {
  const img = makeImage(120, 100);
  rect(img, 10, 50, 60, 4); // bar, rows 50..53
  rect(img, 70, 62, 10, 4); // the stroke continues lower: bottom changes by 12
  assert.deepEqual(kashidaBar(img, 100), {x0: 10, x1: 70, top: 50, bottom: 54});
  const stepped = makeImage(120, 100);
  rect(stepped, 10, 50, 60, 4);
  rect(stepped, 70, 54, 10, 4); // continues directly below: top and bottom both move by 4, still inside the tolerance
  assert.equal(kashidaBar(stepped, 100).x1, 80, 'a 4 pixel drift is inside the tolerance');
  const far = makeImage(120, 100);
  rect(far, 10, 50, 60, 4);
  rect(far, 70, 55, 10, 4); // 5 pixels: outside
  assert.equal(kashidaBar(far, 100).x1, 70);
});

test('kashidaBar scales its tolerance with the font size', () => {
  const img = makeImage(240, 200);
  rect(img, 10, 50, 120, 8);
  rect(img, 130, 58, 20, 8); // 8 pixels lower: outside at S=100 (tolerance 4), inside at S=200 (tolerance 8)
  assert.equal(kashidaBar(img, 100).x1, 130);
  assert.equal(kashidaBar(img, 200).x1, 150);
});

test('kashidaBar: thick ink, blank images and tiny runs give null', () => {
  const block = makeImage(100, 100);
  rect(block, 10, 10, 60, 40);
  assert.equal(kashidaBar(block, 100), null, 'a solid block is not thin');
  assert.equal(kashidaBar(makeImage(50, 50), 100), null);
  const dot = makeImage(100, 100);
  rect(dot, 40, 40, 6, 6);
  assert.equal(kashidaBar(dot, 100), null, 'a dot is too narrow to be a bar');
  assert.throws(() => kashidaBar(block, -1), /size/);
});

test('kashidaBar follows a drifting bar only while it stays near its first column', () => {
  const img = makeImage(120, 100);
  for (let x = 0; x < 100; x++) rect(img, x, 40 + Math.floor(x / 10), 1, 4); // 1 pixel per 10 columns
  const bar = kashidaBar(img, 100);
  assert.ok(bar.x1 - bar.x0 >= 40 && bar.x1 - bar.x0 <= 60, `the run is cut when the drift passes 4 pixels (${bar.x1 - bar.x0})`);
});

test('canvasFont builds the font string from a family, a weight and a size', () => {
  assert.equal(canvasFont('Lalezar', 100), '100px Lalezar');
  assert.equal(canvasFont('Readex Pro', 80), '80px "Readex Pro"');
  assert.equal(canvasFont('700 Cairo', 90), '700 90px Cairo');
  assert.equal(canvasFont('italic 400 Noto Naskh Arabic', 60), 'italic 400 60px "Noto Naskh Arabic"');
  assert.equal(canvasFont('bold 50px Cairo', 90), 'bold 50px Cairo', 'a string that has a size is used as given');
  assert.equal(canvasFont('"Plex Display", Cairo', 40), '40px "Plex Display", Cairo');
});

test('rasterLine measures with the given context and draws the whole line once into a new canvas', () => {
  const calls = [];
  class FakeCanvas {
    constructor(width, height) { this.width = width; this.height = height; }
    getContext() {
      const self = this;
      return new Proxy({}, {
        set(target, key, value) { calls.push(['set', key, value]); target[key] = value; return true; },
        get(target, key) {
          if (key === 'fillText') return (text, x, y) => calls.push(['fillText', text, x, y, self.width, self.height]);
          return target[key];
        },
      });
    }
  }
  globalThis.OffscreenCanvas = FakeCanvas;
  try {
    const measuring = {
      saved: 0, restored: 0,
      save() { this.saved += 1; }, restore() { this.restored += 1; },
      measureText: () => ({width: 300, actualBoundingBoxLeft: 4, actualBoundingBoxRight: 310, actualBoundingBoxAscent: 70, actualBoundingBoxDescent: 40}),
    };
    const out = rasterLine(measuring, 'مونتاج', 'Cairo', 100);
    assert.equal(measuring.saved, 1);
    assert.equal(measuring.restored, 1);
    assert.equal(measuring.font, '100px Cairo');
    assert.equal(measuring.direction, 'rtl');
    // pad = 20; width = ceil(4 + 310) + 40; ascent = max(70, 50); descent = max(40, 10); baseline = pad + ascent
    assert.deepEqual([out.width, out.height, out.baseline], [354, 150, 90]);
    assert.equal(out.canvas.width, 354);
    const draw = calls.find((c) => c[0] === 'fillText');
    assert.deepEqual(draw.slice(1, 4), ['مونتاج', 24, 90]);
    assert.ok(calls.some((c) => c[0] === 'set' && c[1] === 'fillStyle' && c[2] === '#ffffff'));
    rasterLine(measuring, 'AI', 'Cairo', 100);
    assert.equal(measuring.direction, 'ltr');
    assert.throws(() => rasterLine(measuring, 'x', 'Cairo', 0), /size/);
  } finally {
    delete globalThis.OffscreenCanvas;
  }
});

// ---- font hook (no browser font set: static markup) ---------------------------------------------------------

test('useFontsReady is true at once where there is no browser font set, so static markup and tests never wait', async () => {
  const {bundleEngine} = await import('./helpers/engine-bundle.mjs');
  const hadDocument = 'document' in globalThis;
  try {
    const {html} = await bundleEngine(`
      import React from 'react';
      import {renderToStaticMarkup} from 'react-dom/server';
      import {useFontsReady} from './engine/src/arabic/fonts.tsx';
      const Probe = ({families}) => <b>{String(useFontsReady(families))}</b>;
      export const html = (families) => renderToStaticMarkup(<Probe families={families}/>);
    `, {ssr: true});
    assert.equal(html(['Cairo', 'Readex Pro']), '<b>true</b>');
    assert.equal(html([]), '<b>true</b>');
  } finally {
    if (!hadDocument) delete globalThis.document;
  }
});

test('the arabic index re-exports the whole core', async () => {
  const {bundleEngine} = await import('./helpers/engine-bundle.mjs');
  const hadDocument = 'document' in globalThis;
  try {
    const api = await bundleEngine(`export * from './engine/src/arabic/index.ts';`, {ssr: true});
    for (const name of ['joiningType', 'joinsForward', 'joinsBackward', 'graphemes', 'kashidaSlots', 'stretchWord', 'stretchLine', 'rasterLine',
      'segmentBlobs', 'kashidaBar', 'typewriterSlice', 'rubaaFix', 'useFontsReady', 'perLetterLint']) assert.equal(typeof api[name], 'function', name);
  } finally {
    if (!hadDocument) delete globalThis.document;
  }
});
