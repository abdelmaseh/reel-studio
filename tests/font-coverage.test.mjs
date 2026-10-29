import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {fontCoverage, fontCoverageSync, parseCmap, familyCoverage, familyCoverageSync, FAMILY_SOURCES, REQUIRED_ARABIC_CODE_POINTS} from '../scripts/lib/font-coverage.mjs';
import {woff2Tables} from '../scripts/lib/woff2-axes.mjs';
import {FONT_CHOICES} from '../engine/src/styles/types.ts';

const fontFile = (name) => fileURLToPath(new URL(`../engine/public/fonts/${name}`, import.meta.url));
const cairo = fontFile('Cairo-arabic-400.woff2');
const fontsFolder = fileURLToPath(new URL('../engine/public/fonts/', import.meta.url));
const haveFonts = existsSync(cairo) && existsSync(fontFile('manifest.json'));

// ---- a tiny cmap builder: the byte layout of the OpenType cmap table, so the parser is tested without a font file ----
const u16 = (n) => Buffer.from([(n >> 8) & 0xff, n & 0xff]);
const u32 = (n) => Buffer.from([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
const format4 = (segments) => {
  // segments: {start, end, delta, glyphs?} - `glyphs` switches the segment to idRangeOffset addressing.
  const segCount = segments.length;
  const glyphArray = [];
  const offsets = segments.map((segment, index) => {
    if (!segment.glyphs) return 0;
    const offset = (segCount - index) * 2 + glyphArray.length * 2;
    glyphArray.push(...segment.glyphs);
    return offset;
  });
  const body = Buffer.concat([
    u16(segCount * 2), u16(0), u16(0), u16(0),
    ...segments.map((s) => u16(s.end)), u16(0), ...segments.map((s) => u16(s.start)),
    ...segments.map((s) => u16(s.delta & 0xffff)), ...offsets.map(u16), ...glyphArray.map(u16),
  ]);
  return Buffer.concat([u16(4), u16(6 + body.length), u16(0), body]);
};
const format12 = (groups) => Buffer.concat([u16(12), u16(0), u32(16 + groups.length * 12), u32(0), u32(groups.length),
  ...groups.flatMap((g) => [u32(g.start), u32(g.end), u32(g.glyph)])]);
const cmapTable = (records) => {
  let offset = 4 + records.length * 8;
  const heads = [], bodies = [];
  for (const record of records) {
    heads.push(Buffer.concat([u16(record.platform), u16(record.encoding), u32(offset)]));
    bodies.push(record.table);
    offset += record.table.length;
  }
  return Buffer.concat([u16(0), u16(records.length), ...heads, ...bodies]);
};

test('parseCmap reads a format 4 subtable: delta segments, glyph-array segments and glyph 0 as missing', () => {
  const table = format4([
    {start: 0x41, end: 0x43, delta: 1 - 0x41},
    {start: 0x628, end: 0x62a, delta: 0, glyphs: [5, 0, 7]},
    {start: 0xffff, end: 0xffff, delta: 1},
  ]);
  const covered = parseCmap(cmapTable([{platform: 3, encoding: 1, table}]));
  assert.deepEqual([...covered].sort((a, b) => a - b), [0x41, 0x42, 0x43, 0x628, 0x62a]);
});

test('parseCmap reads a format 12 subtable and skips a group whose first glyph is 0 only for that code', () => {
  const table = format12([{start: 0x1f600, end: 0x1f602, glyph: 10}, {start: 0x10000, end: 0x10002, glyph: 0}]);
  const covered = parseCmap(cmapTable([{platform: 3, encoding: 10, table}]));
  assert.deepEqual([...covered].sort((a, b) => a - b), [0x10001, 0x10002, 0x1f600, 0x1f601, 0x1f602]);
});

test('parseCmap unions the Unicode subtables and ignores Mac and symbol encodings', () => {
  const bmp = format4([{start: 0x41, end: 0x41, delta: 0}, {start: 0xffff, end: 0xffff, delta: 1}]);
  const full = format12([{start: 0x42, end: 0x42, glyph: 3}]);
  const mac = format4([{start: 0x7a, end: 0x7a, delta: 0}, {start: 0xffff, end: 0xffff, delta: 1}]);
  const covered = parseCmap(cmapTable([{platform: 0, encoding: 3, table: bmp}, {platform: 3, encoding: 10, table: full}, {platform: 1, encoding: 0, table: mac}]));
  assert.ok(covered.has(0x41) && covered.has(0x42));
  assert.ok(!covered.has(0x7a), 'a Mac Roman subtable is not Unicode');
});

test('parseCmap refuses truncated data and an unknown subtable format is skipped, not fatal', () => {
  assert.throws(() => parseCmap(Buffer.alloc(2)), /cmap/);
  const odd = Buffer.concat([u16(99), u16(8), u16(0), u16(0)]);
  assert.equal(parseCmap(cmapTable([{platform: 3, encoding: 1, table: odd}])).size, 0);
});

test('fontCoverage of the installed Cairo Arabic font has the letter ba and not an emoji', {skip: !haveFonts}, async () => {
  const covered = await fontCoverage(cairo);
  assert.ok(covered instanceof Set);
  assert.ok(covered.has(0x0628), 'U+0628 ARABIC LETTER BEH');
  assert.ok(covered.has(0x0640), 'tatweel');
  assert.ok(!covered.has(0x1f600), 'U+1F600 is not in Cairo');
  assert.equal(await fontCoverage(cairo), covered, 'the second read comes from the in-memory cache');
  assert.deepEqual([...fontCoverageSync(cairo)].sort((a, b) => a - b), [...covered].sort((a, b) => a - b), 'sync and async agree');
});

test('fontCoverage refuses a file that is not WOFF2', async () => {
  await assert.rejects(fontCoverage(fileURLToPath(new URL('../package.json', import.meta.url))), /WOFF2|ENOENT/);
  assert.throws(() => woff2Tables(Buffer.alloc(64)), /Not a WOFF2/);
});

test('woff2Tables exposes the cmap table of a real font', {skip: !haveFonts}, () => {
  const tables = woff2Tables(readFileSync(cairo));
  assert.ok(tables.get('cmap')?.length > 100);
  assert.ok(tables.has('head'));
});

test('every font the editor can choose has a source list, so the glyph check knows what it draws', () => {
  for (const choice of FONT_CHOICES) assert.ok(FAMILY_SOURCES[choice], `${choice} is a font choice: add it to FAMILY_SOURCES in scripts/lib/font-coverage.mjs`);
});

// A V4 family joins this check once fetch-fonts --lock pins it in the tracked template; until then it is optional, as in core/fonts.ts.
test('every source family the glyph check names is installed once the tracked template pins it', {skip: !haveFonts}, () => {
  const manifest = JSON.parse(readFileSync(fontFile('manifest.json'), 'utf8'));
  const installed = new Set(manifest.map((entry) => entry.family));
  const pinned = new Set(JSON.parse(readFileSync(fontFile('manifest.template.json'), 'utf8')).map((entry) => entry.family));
  for (const [family, sources] of Object.entries(FAMILY_SOURCES)) {
    for (const source of sources) if (pinned.has(source)) assert.ok(installed.has(source), `${family} needs ${source}`);
  }
});

test('familyCoverage is the union of its faces cut to each face unicode-range', {skip: !haveFonts}, async () => {
  const cairoSet = await familyCoverage('Cairo', {fontsDir: fontsFolder});
  assert.ok(cairoSet.has(0x0628) && cairoSet.has(0x0041) && cairoSet.has(0x0020), 'Arabic from the arabic face, Latin and space from the latin face');
  assert.ok(!cairoSet.has(0x1f600));
  const grid = await familyCoverage('Grid Sans', {fontsDir: fontsFolder});
  assert.ok(grid.has(0x0628) && grid.has(0x0041), 'Grid Sans is Inter for Latin next to Plex Sans Arabic for Arabic');
  assert.equal(await familyCoverage('No Such Family', {fontsDir: fontsFolder}), null);
  const sync = familyCoverageSync('Cairo', {fontsDir: fontsFolder});
  assert.equal(sync.size, cairoSet.size);
});

test('every installed Arabic choice has the core Arabic letters, digits, tatweel and harakat', {skip: !haveFonts}, async () => {
  for (const family of FONT_CHOICES) {
    const covered = await familyCoverage(family, {fontsDir: fontsFolder});
    if (!covered) continue; // a font choice whose files are not installed yet is the fonts check's job
    const missing = REQUIRED_ARABIC_CODE_POINTS.filter((cp) => !covered.has(cp));
    assert.deepEqual(missing.map((cp) => cp.toString(16)), [], `${family} lacks required Arabic code points`);
  }
});
