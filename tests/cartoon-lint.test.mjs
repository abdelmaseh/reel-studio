import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const folder = fileURLToPath(new URL('../engine/src/styles/cartoon/', import.meta.url));
const walk = async (directory) => (await Promise.all((await readdir(directory, {withFileTypes: true})).map(async (entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat();
const extra = ['../scripts/lib/mouth-table.mjs', '../instructions/styles/cartoon.md', './cartoon-math.test.mjs', './cartoon-scene.test.mjs', './cartoon-render.test.mjs', './cartoon-sound.test.mjs',
  './cartoon-assets.test.mjs', './cartoon-mouth.test.mjs', './cartoon-docs.test.mjs', './helpers/cartoon-fixtures.mjs'].map((file) => fileURLToPath(new URL(file, import.meta.url)));
const files = [...(await walk(folder)).filter((file) => /\.(ts|tsx|json)$/.test(file)), ...extra];
const sources = await Promise.all(files.map(async (file) => ({file: path.relative(folder, file).replaceAll('\\', '/'), text: await readFile(file, 'utf8')})));
const code = sources.filter((s) => /\.(ts|tsx)$/.test(s.file) && !s.file.startsWith('../'));
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

test('Arabic is animated by whole word, never split into characters, and never letter-spaced without an Arabic check', () => {
  for (const {file, text} of code) {
    const source = stripComments(text);
    for (const pattern of [/\.split\(\s*(?:''|""|``)\s*\)/, /Intl\.Segmenter/, /Array\.from\(\s*[\w.]*(?:text|word|label|line|title|str)\w*\s*[,)]/i]) assert.equal(pattern.test(source), false, `${file}: ${pattern}`);
    if (/letter-?spacing/i.test(source)) assert.match(source, /isArabic|\\u0600|dir="ltr"/, `${file} sets letter-spacing without guarding Arabic`);
  }
});

test('renders are deterministic and load nothing: no randomness, clocks, timers, CSS animation, fetch or binary assets', () => {
  const forbidden = /Math\.random|Date\.now|performance\.now|new Date\(|setTimeout|setInterval|@keyframes|\banimation(?:Name)?\s*:|requestAnimationFrame|fetch\(|\.woff2|\.wav\b|\.mp3|\.jpe?g\b|\.png\b/;
  for (const {file, text} of code) assert.equal(forbidden.test(stripComments(text)), false, `${file} uses a forbidden API or asset`);
});

test('no personal or third-party material: no handle, avatar photo, reference reel, private path or product name', () => {
  // Patterns only: the test itself must never spell out a private studio, project, account or reference name.
  const forbidden = /@(?!example\.creator\b|example\b)[A-Za-z0-9_][A-Za-z0-9_.]{2,}|avatar-?v?\d|instagram\.com\/|tiktok\.com\/|[A-Za-z]:[\\/](?:Users|[A-Za-z]+ pro)|traced from|his photo|her photo|likeness of|memoji/i;
  for (const {file, text} of sources) {
    const hit = forbidden.exec(text.replace(/@remotion\b|@font-face|@media/g, ''));
    assert.equal(hit, null, `${file}: ${hit?.[0]}`);
  }
});

test('the default character is the generic figure, never a bearded, spectacled, quiffed look', async () => {
  const {DEFAULT_CHARACTER} = await import('../engine/src/styles/cartoon/scenes/character.ts');
  assert.equal(DEFAULT_CHARACTER.beard.kind, 'none');
  assert.equal(DEFAULT_CHARACTER.glasses.kind, 'none');
  assert.notEqual(DEFAULT_CHARACTER.hair.style, 'quiff');
});
