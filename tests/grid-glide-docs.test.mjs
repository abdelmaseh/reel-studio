import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanPublicationFile} from '../scripts/lib/publication-policy.mjs';
import {FONT_CHOICES} from '../engine/src/styles/types.ts';
import {STYLE_IDS, STYLE_METAS} from '../engine/src/styles/registry.ts';
import {GRID_GLIDE_FAMILIES} from '../engine/src/styles/grid-glide/scenes/schema.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const GUIDE = 'instructions/styles/grid-glide.md';
const indic = value => String(value).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[digit]);

test('the guide names every style-owned family; the registry owns the same ones and the director knows them', () => {
  const text = read(GUIDE);
  assert.deepEqual([...GRID_GLIDE_FAMILIES], ['glide-chapter', 'glide-card', 'glide-lines', 'glide-comment', 'glide-follow']);
  assert.deepEqual([...STYLE_METAS.find(meta => meta.id === 'grid-glide').ownScenes], [...GRID_GLIDE_FAMILIES]);
  const director = read('scripts/lib/editor-director.mjs');
  for (const family of GRID_GLIDE_FAMILIES) {
    assert.ok(text.includes(`\`${family}\``), `${family} is described in the guide`);
    assert.ok(director.includes(family), `${family} is known to the director`);
  }
  assert.ok(statSync(path.join(root, GUIDE)).size > 8000, 'the guide is the full decision system');
});

test('the guide contains no personal or third-party material', () => {
  const text = read(GUIDE);
  assert.deepEqual(scanPublicationFile(GUIDE, Buffer.from(text)), []);
  assert.equal(/https?:\/\//i.test(text), false, 'no external links');
  assert.deepEqual([...text.matchAll(/@[A-Za-z0-9_.]{3,}/g)].map(match => match[0]).filter(handle => handle !== '@example.creator'), [], 'no handles');
  assert.equal(/[A-Za-z]:[\\/]|\bStyles[\\/]|STYLE_DNA|\.claude[\\/]skills/.test(text), false, 'no private paths');
  assert.equal(/\bRaw\d|\bcoral\b|\bspark\b|asterisk|\bavatar\b|\bcloned?\b|analytics/i.test(text), false, 'no reference-specific terms');
});

test('settings and README document every font choice and one card per registered style', () => {
  const settings = read('instructions/SETTINGS.md');
  for (const font of FONT_CHOICES) assert.ok(settings.includes(`\`${font}\``), `SETTINGS.md lists ${font}`);
  const readme = read('README.md');
  assert.ok(readme.includes('Grid Sans'), 'README lists the Grid Sans font');
  for (const id of STYLE_IDS) {
    assert.ok(readme.includes(`docs/images/style-${id}.jpg`) || readme.includes(`docs/media/style-${id}.gif`), `README card for ${id}`);
  }
  assert.ok(existsSync(path.join(root, 'docs/images/style-grid-glide.jpg')), 'the Grid Glide README still exists');
  const count = indic(STYLE_IDS.length);
  assert.ok(readme.includes(`## شوف الـ${count} ستايل`), 'README heading shows the registry count');
  assert.ok(readme.includes(`>الـ${count} ستايل</a>`), 'README navigation shows the registry count');
  assert.ok(readme.includes(`واحد من ${count} ستايل`), 'README preferences table shows the registry count');
});

test('the family contracts are listed where families are chosen', () => {
  const choices = read('instructions/MOTION-CHOICES.md'), graphics = read('instructions/GRAPHICS.md');
  for (const family of GRID_GLIDE_FAMILIES) assert.ok(choices.includes(`\`${family}\``), `MOTION-CHOICES.md mentions ${family}`);
  assert.ok(choices.includes('styles/grid-glide.md') && graphics.includes('styles/grid-glide.md'), 'both pages link the guide');
});

test('the pages edited for Grid Glide pass the publication policy', () => {
  for (const file of [GUIDE, 'README.md', 'instructions/STYLES.md', 'instructions/MOTION-CHOICES.md', 'instructions/GRAPHICS.md', 'instructions/SETTINGS.md', 'docs/media/README.md']) {
    assert.deepEqual(scanPublicationFile(file, Buffer.from(read(file))), [], file);
  }
});
