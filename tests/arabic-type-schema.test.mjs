import test from 'node:test';
import assert from 'node:assert/strict';
import {ARABIC_TYPE_MOVES, arabicTypeSceneSchema} from '../engine/src/arabic-type/schema.ts';

const scene = (move, extra = {}) => ({id:'arabic-type-test', family:'arabic-type', fromFrame:0,
  durationInFrames:240, layout:'takeover', motion:'land', data:{text:'فكرة واضحة', move, ...extra}});

test('all eleven moves accept authored copy and their required inputs', () => {
  assert.equal(ARABIC_TYPE_MOVES.length, 11);
  for (const move of ARABIC_TYPE_MOVES) assert.equal(arabicTypeSceneSchema.safeParse(scene(move,
    { ...(move === 'kashida-stretch' ? {text:'جميل'} : {}), ...(move === 'word-melt' ? {to:'خطوة عملية'} : {}),
      ...(move === 'video-in-letters' ? {media:'projects/test/clip.mp4'} : {}) })).success, true, move);
});
// kashida-stretch draws in a fixed-width area: a second word leaves no room for the bar to grow, so the line rendered unstretched.
test('kashida-stretch takes one word and says so; the other letter moves keep their three-word limit', () => {
  const two = arabicTypeSceneSchema.safeParse(scene('kashida-stretch'));
  assert.equal(two.success, false);
  assert.equal(two.error.issues.length, 1, 'one clear message, not the three-word message as well');
  assert.deepEqual(two.error.issues[0].path, ['data', 'text']);
  assert.equal(two.error.issues[0].message, 'kashida-stretch stretches one word: use a single word, or pick another move for a phrase (this text has 2 words)');
  assert.match(arabicTypeSceneSchema.safeParse(scene('kashida-stretch', {text:'كل كلمة ليها معنى'})).error.issues[0].message, /this text has 4 words/);
  assert.equal(arabicTypeSceneSchema.safeParse(scene('kashida-stretch', {text:'  جميل  '})).success, true, 'spaces around the word are not a second word');
  for (const move of ['dots-drop', 'letters-snap', 'kufi-tiles']) assert.equal(arabicTypeSceneSchema.safeParse(scene(move)).success, true, move);
});
// kashida-stretch lengthens the joint between two connected letters; a word with no such joint used to render as plain text, silently.
test('kashida-stretch refuses a word it cannot stretch and names the word', () => {
  for (const text of ['ورد', 'دار', 'ولا', 'من', 'AI']) {
    const result = arabicTypeSceneSchema.safeParse(scene('kashida-stretch', {text}));
    assert.equal(result.success, false, text);
    assert.equal(result.error.issues.length, 1, text);
    assert.deepEqual(result.error.issues[0].path, ['data', 'text']);
    assert.equal(result.error.issues[0].message, `kashida-stretch finds no place to stretch "${text}": it needs an Arabic word of three letters or more with two connected letters whose joint can lengthen, like جميل; pick another word, or another move`);
  }
  assert.match(arabicTypeSceneSchema.safeParse(scene('kashida-stretch', {text:'  ورد  '})).error.issues[0].message, /stretch "ورد":/, 'the message names the word without its spaces');
  for (const text of ['جميل', 'فكرة', 'تماماً', 'سلام', 'مستقبل']) assert.equal(arabicTypeSceneSchema.safeParse(scene('kashida-stretch', {text})).success, true, text);
  const phrase = arabicTypeSceneSchema.safeParse(scene('kashida-stretch', {text:'ورد ودار'}));
  assert.equal(phrase.error.issues.length, 1, 'a phrase gets the one-word message only');
  assert.match(phrase.error.issues[0].message, /^kashida-stretch stretches one word/);
  for (const move of ['dots-drop', 'letters-snap', 'kufi-tiles']) assert.equal(arabicTypeSceneSchema.safeParse(scene(move, {text:'ورد'})).success, true, move);
});
test('required assets and destination copy cannot be fabricated by defaults', () => {
  for (const move of ['word-melt','video-in-letters','unknown']) assert.equal(arabicTypeSceneSchema.safeParse(scene(move)).success, false, move);
  assert.equal(arabicTypeSceneSchema.safeParse(scene('video-in-letters',{media:'../private.mp4'})).success, false);
  assert.equal(arabicTypeSceneSchema.safeParse(scene('decrypt',{text:'   '})).success, false);
  assert.equal(arabicTypeSceneSchema.safeParse({...scene('decrypt'),layout:'split'}).success, false);
});
test('raster letter moves stay within forty characters and three words', () => {
  for (const move of ['dots-drop','letters-snap','kufi-tiles','kashida-stretch']) {
    assert.equal(arabicTypeSceneSchema.safeParse(scene(move,{text:'ك'.repeat(41)})).success, false, move);
    assert.equal(arabicTypeSceneSchema.safeParse(scene(move,{text:'كل كلمة ليها معنى'})).success, false, move);
  }
});
