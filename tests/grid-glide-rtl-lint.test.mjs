import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Static guard over everything under engine/src/styles/grid-glide/. The rendering tests
// (grid-glide-kit.test.mjs) prove the behaviour; this keeps later edits from reintroducing the
// patterns that break Arabic, make renders non-deterministic, or ship material the product must not carry.
const folder = fileURLToPath(new URL('../engine/src/styles/grid-glide/', import.meta.url));
const walk = async (directory) =>
  (await Promise.all((await readdir(directory, {withFileTypes: true})).map(async (entry) =>
    entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat();
const files = (await walk(folder)).filter((file) => /\.(ts|tsx)$/.test(file));
const sources = await Promise.all(files.map(async (file) => ({file: path.relative(folder, file).replaceAll('\\', '/'), text: await readFile(file, 'utf8')})));
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('the Grid Glide folder has the math module and the kit to scan', () => {
  const names = sources.map((source) => source.file);
  assert.ok(names.includes('scenes/math.ts'), names.join(', '));
  assert.ok(names.includes('scenes/kit.tsx'), names.join(', '));
});

test('Arabic is animated by whole word or line, never split into characters', () => {
  const patterns = [
    /\.split\(\s*(?:''|""|``|\/\(\?:\)\/u?|\/\/u?)\s*\)/,
    /\[\s*\.\.\.\s*[\w.]*(?:text|word|label|line|title|str)[\w.]*\s*\]/i,
    /Array\.from\(\s*[\w.]*(?:text|word|label|line|title|str)\w*\s*[,)]/i,
    /Intl\.Segmenter/,
  ];
  for (const {file, text} of sources) {
    const code = stripComments(text);
    for (const pattern of patterns) assert.equal(pattern.test(code), false, `${file} splits text into characters (${pattern})`);
  }
});

test('Arabic is never letter-spaced: any file that sets tracking also detects Arabic', () => {
  for (const {file, text} of sources) {
    const code = stripComments(text);
    if (!/letter-?spacing/i.test(code)) continue;
    assert.match(code, /isArabic/, `${file} sets letter-spacing without checking for Arabic`);
  }
});

test('renders are deterministic: no randomness, clocks, timers or CSS animation', () => {
  const forbidden = /Math\.random|Date\.now|performance\.now|new Date\(|setTimeout|setInterval|@keyframes|\banimation(?:Name)?\s*:|requestAnimationFrame/;
  for (const {file, text} of sources) assert.equal(forbidden.test(stripComments(text)), false, `${file} uses a non-deterministic API`);
});

test('fonts come from the registered Grid Sans alias, never loaded by the style', () => {
  for (const {file, text} of sources) {
    assert.equal(/loadFont|@remotion\/fonts|new FontFace|@font-face/.test(stripComments(text)), false, `${file} loads a font itself`);
  }
  const kit = sources.find((source) => source.file === 'scenes/kit.tsx').text;
  assert.match(kit, /FAMILY\.gridSans/);
});

test('no third-party or personal material ships with the style', () => {
  const forbidden = /\b(?:coral|ASTERISK_PATH|EndFade|Burst|Disc)\b|avatar|follow badge/i;
  for (const {file, text} of sources) assert.equal(forbidden.test(text), false, `${file} carries material the style must not ship: ${text.match(forbidden)?.[0]}`);
});
