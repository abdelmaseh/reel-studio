import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gridGlideSceneSchema} from '../engine/src/styles/grid-glide/scenes/schema.ts';
import {styleSceneSchema, validateStyleSceneTiming} from '../engine/src/styles/scenes.ts';
import {textDirection} from '../engine/src/styles/grid-glide/scenes/text.ts';
import {
  BAND, CHAPTER_LAYOUT, gridGlideLayoutIssues, layoutGlideCard, layoutGlideChapter, layoutGlideLines, lineBox, lineColumn,
} from '../engine/src/styles/grid-glide/scenes/layout.ts';
import {PILL} from '../engine/src/styles/grid-glide/scenes/math.ts';

const cut = {kind: 'cut'};
const clip = (name, extra = {}) => ({at: 0, src: `projects/example/${name}`, sha256: 'a'.repeat(64), width: 1600, height: 900, kind: 'image', ...extra});
const line = (role, count, at = 0) => ({words: Array.from({length: count}, (_, i) => `w${i}`), role, at, cadence: 7});
const scene = (family, data, extra = {}) => gridGlideSceneSchema.parse({id: 'glide-1', family, fromFrame: 0, durationInFrames: 420, layout: 'takeover', motion: 'quiet', data, ...extra});
const card = (data = {}) => scene('glide-card', {lines: [], media: {clips: [clip('a.png')]}, enter: cut, exit: cut, ...data}).data;
const lines = (data = {}) => scene('glide-lines', {lines: [line('lead', 1)], enter: cut, exit: cut, ...data}).data;

test('the band equals the platform contract and directions are detected per text', async () => {
  const spec = JSON.parse(await readFile(new URL('../engine/src/core/platform/instagram-reels.json', import.meta.url), 'utf8'));
  const zone = spec.profiles['ig-reels-organic'];
  assert.deepEqual({top: BAND.top, bottom: BAND.bottom, left: BAND.left, right: BAND.right, rail: BAND.rail},
    {top: zone.top, bottom: zone.bottom, left: zone.left, right: zone.right, rail: zone.rail});
  assert.equal(textDirection('الأول'), 'rtl');
  assert.equal(textDirection('First'), 'ltr');
  assert.equal(textDirection('استخدم Tool الآن'), 'rtl', 'a short Latin tool name inside an Arabic sentence keeps the line right-to-left');
  assert.equal(textDirection('Example بيكتب الكود'), 'rtl', 'an Arabic line that opens with a Latin tool name is right-to-left');
  assert.equal(textDirection('بيكتب الكود في Example'), 'rtl', 'an Arabic line that ends with a Latin tool name is right-to-left');
  assert.equal(textDirection('Example Tool'), 'ltr', 'pure Latin is left-to-right');
  assert.equal(textDirection('123'), 'ltr');
  assert.equal(textDirection('- 50% -'), 'ltr', 'digits and punctuation alone are left-to-right');
});

test('the chapter stack sits inside the band and the pill clears the action rail', () => {
  const data = scene('glide-chapter', {ordinal: 'First', heroAt: 1, pill: {label: 'Example tool'}, enter: cut, exit: cut}, {durationInFrames: 60}).data;
  const layout = layoutGlideChapter(data);
  assert.deepEqual(layout.issues, []);
  assert.equal(layout.hero.y, CHAPTER_LAYOUT.heroTop);
  assert.ok(layout.hero.y >= BAND.top);
  assert.equal(layout.hero.bottom, 723 + lineBox(142));
  assert.equal(layout.pill.y, 937);
  assert.equal(layout.pill.bottom, 937 + PILL.h);
  assert.ok(layout.pill.bottom <= BAND.rail.y, 'the pill ends above the rail zone');
  assert.ok(layout.hero.bottom < layout.pill.y);
  assert.equal(layoutGlideChapter({...data, pill: undefined}).pill, null);
  assert.equal(layoutGlideChapter({...data, ordinal: 'الأول'}).hero.dir, 'rtl');
});

test('a card scene stacks lines, a wide card and bullets inside the band', () => {
  const layout = layoutGlideCard(card({lines: [line('lead', 3), line('hero', 2)], bullets: [{text: 'open the project', at: 90}, {text: 'then the second', at: 125}]}));
  assert.deepEqual(layout.issues, []);
  assert.deepEqual(layout.lines.map((entry) => [entry.y, entry.size, entry.weight]), [[250, 70, 500], [341, 100, 700]]);
  assert.deepEqual(layout.card, {x: 127, y: 509, w: 827, h: 473, innerW: 809, innerH: 455, narrow: false});
  assert.ok(layout.card.y + layout.card.h <= BAND.rail.y);
  assert.deepEqual(layout.bullets.map((bullet) => bullet.y), [1047, 1167]);
  assert.equal(layout.bottom, 1167 + lineBox(64));
  assert.ok(layout.bottom <= BAND.bottom);
  assert.deepEqual(layout.bullets.map((bullet) => bullet.maxWidth), [727, 565], 'a row that reaches the rail ends at x 853');
});

test('a tall stack narrows the card to clear the rail, and an overfull stack is refused', () => {
  const four = [line('lead', 3), line('hero', 2), line('lead', 3), line('lead', 3)];
  const narrow = layoutGlideCard(card({lines: four, bullets: [{text: 'a b', at: 90}]}));
  assert.deepEqual(narrow.issues, []);
  assert.deepEqual(narrow.card, {x: 127, y: 691, w: 726, h: 416, innerW: 708, innerH: 398, narrow: true});
  assert.equal(narrow.card.x + narrow.card.w, BAND.rail.x, 'the narrow card ends at the rail line');
  const overfull = layoutGlideCard(card({lines: four, bullets: [{text: 'a', at: 90}, {text: 'b', at: 120}, {text: 'c', at: 150}]}));
  assert.equal(overfull.bottom, 1495);
  assert.match(overfull.issues.join('|'), /needs 1495px but the Instagram band ends at 1470px/);
  const tall = layoutGlideCard(card({lines: [line('lead', 3)], media: {clips: [clip('page.png', {width: 1000, height: 3000})]}}));
  assert.equal(tall.card.narrow, true);
  assert.equal(tall.card.h, 1009, 'a very tall capture is clamped to aspect 1.4 before the card is narrowed');
  assert.deepEqual(tall.issues, []);
});

test('the box must end above the rail and bullets follow it', () => {
  const withBox = layoutGlideCard(card({lines: [line('lead', 3)], box: {text: 'one clear idea', at: 50}, bullets: [{text: 'a', at: 90}, {text: 'b', at: 120}]}));
  assert.deepEqual(withBox.issues, []);
  assert.deepEqual(withBox.box, {y: 917, h: 128, dir: 'ltr', words: 3});
  assert.deepEqual(withBox.bullets.map((bullet) => bullet.y), [1075, 1195]);
  const crossing = layoutGlideCard(card({lines: [line('lead', 3), line('hero', 2)], box: {text: 'one clear idea', at: 50}}));
  assert.match(crossing.issues.join('|'), /the box ends at 1175px, inside the Instagram action rail/);
});

test('bullets are mirrored in Arabic: star at x 790 and a 637 px column', () => {
  const layout = layoutGlideCard(card({bullets: [{text: 'افتح المشروع الآن', at: 90}, {text: 'ثم الخطوة الثانية', at: 120}, {text: 'وانتهينا', at: 150}]}));
  assert.deepEqual(layout.issues, []);
  assert.deepEqual(layout.bullets.map((bullet) => [bullet.dir, bullet.starX, bullet.maxWidth]), [['rtl', 790, 637], ['rtl', 790, 637], ['rtl', 790, 637]]);
  assert.ok(790 + 36 <= BAND.rail.x, 'the star clears the rail');
  const english = layoutGlideCard(card({bullets: [{text: 'open it', at: 90}]}));
  assert.deepEqual([english.bullets[0].dir, english.bullets[0].starX], ['ltr', 200]);
});

test('a lines scene is centred above the rail and the largest legal stack still fits', () => {
  const small = layoutGlideLines(lines({lines: [line('lead', 3), line('hero', 2), line('lead', 3)], box: {text: 'one clear idea', at: 50}}));
  assert.deepEqual(small.issues, []);
  assert.deepEqual(small.lines.map((entry) => entry.y), [461, 552, 682], 'the 478 px block is centred in the 900 px above the rail');
  assert.deepEqual(small.box, {y: 811, h: 128, dir: 'ltr', words: 3});
  const largest = layoutGlideLines(lines({lines: Array.from({length: 5}, () => line('hero', 2)), box: {text: 'one', at: 50}}));
  assert.deepEqual(largest.issues, []);
  assert.ok(largest.bottom <= BAND.rail.y, 'five hero lines and a box end above y 1150');
  assert.ok(largest.lines[0].y >= BAND.top);
});

test('timing validation also reports layout problems with the scene id', () => {
  const four = [line('lead', 3), line('hero', 2), line('lead', 3), line('lead', 3)];
  const overfull = scene('glide-card', {lines: four, media: {clips: [clip('a.png')]}, bullets: [{text: 'a', at: 200}, {text: 'b', at: 230}, {text: 'c', at: 260}], enter: cut, exit: cut});
  assert.match(gridGlideLayoutIssues(overfull).join('|'), /^glide-1: the stack needs 1495px/);
  assert.match(validateStyleSceneTiming(styleSceneSchema.parse(overfull)).join('|'), /glide-1: the stack needs 1495px/);
  const fine = scene('glide-card', {lines: [line('lead', 3)], media: {clips: [clip('a.png')]}, enter: cut, exit: cut});
  assert.deepEqual(validateStyleSceneTiming(styleSceneSchema.parse(fine)), []);
});

test('a line column stays left of the action rail once the row reaches y 1150', () => {
  const above = lineColumn(900, 70);
  assert.deepEqual(above, {x: BAND.left, width: BAND.right - BAND.left}, 'a row that ends above the rail uses the whole band');
  assert.equal(above.x + above.width / 2, 540, 'the full-band column is centred on the canvas');
  const touching = lineColumn(1100, 70);
  assert.deepEqual(touching, {x: BAND.left, width: BAND.rail.x - BAND.left}, 'a row that reaches the rail ends at x 853');
  assert.ok(touching.x + touching.width <= BAND.rail.x);
  assert.deepEqual(lineColumn(1150 - lineBox(70), 70), above, 'a row that ends exactly on y 1150 does not touch the rail');
  assert.deepEqual(lineColumn(1150 - lineBox(70) + 1, 70), touching, 'one pixel lower it does');
});

test('placed lines carry their own safe column and a width limit inside it', () => {
  const layout = layoutGlideLines(lines({lines: [line('lead', 3), line('hero', 2)]}));
  for (const entry of layout.lines) {
    assert.ok(entry.x >= BAND.left && entry.x + entry.width <= BAND.right, 'inside the band');
    assert.ok(entry.maxWidth <= entry.width, 'the width limit never exceeds the column');
  }
  const chapter = layoutGlideChapter(scene('glide-chapter', {ordinal: 'First', heroAt: 1, enter: cut, exit: cut}, {durationInFrames: 60}).data);
  assert.deepEqual([chapter.hero.x, chapter.hero.width], [BAND.left, BAND.right - BAND.left]);
});
