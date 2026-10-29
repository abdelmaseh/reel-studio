import test from 'node:test';
import assert from 'node:assert/strict';

// lint.ts is Node-safe on purpose: the same functions guard SSR markup in tests and, later, source files.
const {perLetterLint, perLetterSourceLint} = await import(new URL('../engine/src/arabic/lint.ts', import.meta.url));

test('Arabic letters of one word split across elements are one problem', () => {
  const problems = perLetterLint('<span>ك</span><span>تب</span>');
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0], /ك/);
});

test('whole words in separate elements, separated by a space, are fine', () => {
  assert.deepEqual(perLetterLint('<span>كتب</span> <span>AI</span>'), []);
  assert.deepEqual(perLetterLint('<span>ك</span> <span>تب</span>'), [], 'a space ends the word');
  assert.deepEqual(perLetterLint('<p>كتب</p>'), []);
  assert.deepEqual(perLetterLint(''), []);
  assert.deepEqual(perLetterLint('no arabic here <b>at</b><i>all</i>'), []);
});

test('every letter in its own span is flagged once per word', () => {
  const problems = perLetterLint('<span>م</span><span>ك</span><span>ت</span><span>ب</span>');
  assert.equal(problems.length, 1, problems.join('\n'));
  const two = perLetterLint('<span>م</span><span>ك</span><span>ت</span><span>ب</span> <span>ب</span><span>ي</span><span>ت</span>');
  assert.equal(two.length, 2, two.join('\n'));
});

test('a word split by a nested inline element is flagged, and a mark in its own element too', () => {
  assert.equal(perLetterLint('<span>ك<b>تب</b></span>').length, 1);
  assert.equal(perLetterLint('<span>ك</span><span>َ</span><span>تب</span>').length, 1);
});

test('letters that never join forward may sit in separate elements', () => {
  assert.deepEqual(perLetterLint('<span>دار</span>'), []);
  assert.deepEqual(perLetterLint('<span>ا</span><span>ب</span>'), [], 'alef does not join forward');
  assert.deepEqual(perLetterLint('<span>و</span><span>ك</span>'), []);
});

test('block, absolute and line-break boundaries separate words', () => {
  assert.deepEqual(perLetterLint('<div>مرحبا بك</div><div>ابدأ</div>'), []);
  assert.deepEqual(perLetterLint('<span style="position:absolute;left:0">بكتب</span><span style="position:absolute;left:90px">اللي</span>'), []);
  assert.deepEqual(perLetterLint('<span>ك</span><br/><span>تب</span>'), []);
  assert.deepEqual(perLetterLint('<div style="display:block">كتب</div><div style="display:block">ابدأ</div>'), []);
});

test('React comment markers between text nodes of one element are not a split', () => {
  assert.deepEqual(perLetterLint('<span>ك<!-- -->تب</span>'), []);
});

test('single letters in flex or absolute boxes that would join the next box are flagged', () => {
  const flex = '<div style="display:flex"><span>ك</span><span>ت</span><span>ب</span></div>';
  assert.equal(perLetterLint(flex).length, 1, perLetterLint(flex).join('\n'));
  const abs = '<span style="position:absolute;left:10px">ك</span><span style="position:absolute;left:40px">تب</span>';
  assert.equal(perLetterLint(abs).length, 1);
  assert.deepEqual(perLetterLint('<div style="display:flex"><span>كتب</span><span>في</span></div>'), []);
  assert.deepEqual(perLetterLint('<div style="display:flex"><span>و</span><span>بيت</span></div>'), [], 'waw is a word of its own');
});

test('inline-block boxes are boxes: whole words are fine, one letter per box is not', () => {
  const words = '<span style="display:inline-block;margin:0 8px">بكتب</span><span style="display:inline-block">اللي</span>';
  assert.deepEqual(perLetterLint(words), []);
  const letters = '<span style="display:inline-block">م</span><span style="display:inline-block">ك</span><span style="display:inline-block">ت</span><span style="display:inline-block">ب</span>';
  assert.equal(perLetterLint(letters).length, 1, perLetterLint(letters).join(' / '));
});

test('a transform on a single Arabic letter is flagged, a transform on a whole word is not', () => {
  assert.equal(perLetterLint('<span style="transform:rotate(3deg)">ك</span>').length, 1);
  assert.equal(perLetterLint('<span style="display:inline-block;transform:translateY(4px)">ب</span>').length, 1);
  assert.equal(perLetterLint('<span style="translate:0 4px">كَ</span>').length, 1, 'a letter with its mark is still one letter');
  assert.deepEqual(perLetterLint('<span style="display:inline-block;transform:translateY(4px)">كتب</span>'), []);
  assert.deepEqual(perLetterLint('<span style="transform:scale(1.1)">و</span>'), [], 'a lone waw is a word');
  assert.deepEqual(perLetterLint('<span style="transform:rotate(3deg)">A</span>'), [], 'Latin letters are free');
});

test('letter-spacing on Arabic text is flagged, zero spacing and Latin spacing are not', () => {
  assert.equal(perLetterLint('<span style="letter-spacing:4px">كتب</span>').length, 1);
  assert.equal(perLetterLint('<div style="letter-spacing:0.02em"><span>كتب</span></div>').length, 1);
  assert.equal(perLetterLint('<span style="letter-spacing:-1px">كتب</span>').length, 1);
  assert.deepEqual(perLetterLint('<span style="letter-spacing:0">كتب</span>'), []);
  assert.deepEqual(perLetterLint('<span style="letter-spacing:0px">كتب</span>'), []);
  assert.deepEqual(perLetterLint('<span style="letter-spacing:normal">كتب</span>'), []);
  assert.deepEqual(perLetterLint('<span style="letter-spacing:4px">STUDIO</span>'), []);
  assert.deepEqual(perLetterLint('<div style="letter-spacing:4px"><span style="letter-spacing:0">كتب</span></div>'), []);
});

test('markup helpers: entities, scripts and attributes with angle brackets do not confuse the lint', () => {
  assert.deepEqual(perLetterLint('<span data-x="a>b">كتب</span> <span>&amp; &#1603;</span>'), []);
  assert.deepEqual(perLetterLint('<script>var a = "<span>ك</span><span>تب</span>";</script>'), []);
  assert.equal(perLetterLint('<span>&#1603;</span><span>تب</span>').length, 1, 'a numeric entity is the letter kaf');
});

// ---- source scan (the guard grid-glide and cartoon use over their TypeScript) --------------------------------

test('perLetterSourceLint finds code that splits Arabic text into characters', () => {
  assert.equal(perLetterSourceLint("const a = text.split('');").length, 1);
  assert.equal(perLetterSourceLint('const a = label.split("");').length, 1);
  assert.equal(perLetterSourceLint('const a = title.split(``);').length, 1);
  assert.equal(perLetterSourceLint('const a = word.split(/(?:)/u);').length, 1);
  assert.equal(perLetterSourceLint('const a = word.split(//u);').length, 1);
  assert.equal(perLetterSourceLint('const a = [...text];').length, 1);
  assert.equal(perLetterSourceLint('const a = [...props.title];').length, 1);
  assert.equal(perLetterSourceLint('const a = Array.from(word);').length, 1);
  assert.equal(perLetterSourceLint('const a = Array.from(labelText, f);').length, 1);
  assert.equal(perLetterSourceLint('const s = new Intl.Segmenter("en", {granularity: "grapheme"});').length, 1);
});

test('perLetterSourceLint ignores comments, harmless code and guarded letter-spacing', () => {
  assert.deepEqual(perLetterSourceLint("// text.split('') is forbidden\nconst a = 1;"), []);
  assert.deepEqual(perLetterSourceLint("/* Array.from(text) */ const a = 1;"), []);
  assert.deepEqual(perLetterSourceLint('const words = text.split(" ");'), []);
  assert.deepEqual(perLetterSourceLint('const a = Array.from({length: 3}, (_, i) => i);'), []);
  assert.deepEqual(perLetterSourceLint('const s = {letterSpacing: "2px"}; if (isArabic(text)) return;'), []);
});

test('perLetterSourceLint wants an Arabic guard wherever letter-spacing is set', () => {
  assert.equal(perLetterSourceLint('const s = {letterSpacing: "2px"};').length, 1);
  assert.equal(perLetterSourceLint('const s = {"letter-spacing": 2};').length, 1);
  assert.deepEqual(perLetterSourceLint('const s = {letterSpacing: 2}; if (isArabic(t)) {}', {guard: /isArabic/}), []);
  assert.equal(perLetterSourceLint('const s = {letterSpacing: 2}; const g = <p dir="ltr"/>;', {guard: /isArabic/}).length, 1, 'a custom guard is stricter than the default');
  assert.deepEqual(perLetterSourceLint('const s = {letterSpacing: 2}; const g = <p dir="ltr"/>;'), [], 'the default also accepts a forced ltr box');
});
