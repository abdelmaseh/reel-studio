import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {glideWords, textDirection} from '../engine/src/styles/grid-glide/scenes/text.ts';

test('the source carries no literal Arabic letters and no byte-order mark', async () => {
  const source = await readFile(new URL('../engine/src/styles/grid-glide/scenes/text.ts', import.meta.url), 'utf8');
  assert.equal(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(source), false, 'the Arabic ranges are written as escapes');
  assert.ok(source.includes('\\u0600-\\u06FF'), 'the main Arabic block is spelled with an escape');
  assert.ok(source.includes('\\uFE70-\\uFEFC'), 'the last range stops before the byte-order mark');
  assert.notEqual(source.charCodeAt(0), 0xfeff, 'the file does not start with a BOM');
});

test('a text with any Arabic letter is right-to-left, every other text is left-to-right', () => {
  assert.equal(textDirection('الأول'), 'rtl');
  assert.equal(textDirection('First'), 'ltr', 'pure Latin reads left-to-right');
  assert.equal(textDirection('Example Tool'), 'ltr');
  assert.equal(textDirection('Example بيكتب الكود'), 'rtl', 'an Arabic line that opens with a Latin tool name is right-to-left');
  assert.equal(textDirection('بيكتب الكود في Example'), 'rtl', 'an Arabic line that ends with a Latin tool name is right-to-left');
  assert.equal(textDirection('استخدم Example Tool'), 'rtl', 'a short Arabic line with a tool name stays right-to-left');
  assert.equal(textDirection('استخدم Tool الآن'), 'rtl', 'a tool name between Arabic words does not flip the line');
  assert.equal(textDirection('جرّب Acme Notes'), 'rtl', 'a mark on the first word does not matter');
  assert.equal(textDirection('Acme Notes مهم'), 'rtl', 'one Arabic word is enough');
});

test('digits, punctuation, marks and spaces do not decide the direction', () => {
  assert.equal(textDirection('123 الأول'), 'rtl', 'digits in front do not matter');
  assert.equal(textDirection('(الأول)'), 'rtl', 'punctuation around the word does not matter');
  assert.equal(textDirection('  - 5% First'), 'ltr');
  assert.equal(textDirection('\u0661\u0662\u0663 First'), 'ltr', 'Arabic-Indic digits are not an Arabic letter');
  assert.equal(textDirection('\u0661\u0662\u0663 \u0627\u0644\u0623\u0648\u0644'), 'rtl', 'but the Arabic word after them is');
  assert.equal(textDirection('\uFEFF\u0627\u0644\u0623\u0648\u0644'), 'rtl', 'a byte-order mark in front is skipped');
  assert.equal(textDirection('\uFEFFFirst'), 'ltr');
  assert.equal(textDirection('\uFEFB'), 'rtl', 'a presentation-form letter counts as Arabic');
});

test('a text without an Arabic letter reads left to right', () => {
  assert.equal(textDirection(''), 'ltr');
  assert.equal(textDirection('   '), 'ltr');
  assert.equal(textDirection('123'), 'ltr');
  assert.equal(textDirection('- 50% -'), 'ltr');
  assert.equal(textDirection('\u0661\u0662\u0663'), 'ltr');
});

test('words are the whitespace-separated tokens of a phrase', () => {
  assert.deepEqual(glideWords('  one   two\tthree\n'), ['one', 'two', 'three']);
  assert.deepEqual(glideWords('\u0627\u0644\u0623\u0648\u0644 \u0645\u0647\u0645'), ['\u0627\u0644\u0623\u0648\u0644', '\u0645\u0647\u0645']);
  assert.deepEqual(glideWords('   '), []);
});
