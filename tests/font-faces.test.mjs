import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bundleEngine} from './helpers/engine-bundle.mjs';

const lock = JSON.parse(await readFile(new URL('../versions.lock.json', import.meta.url), 'utf8'));
const fonts = await bundleEngine(`export {FAMILY, LOADED_FAMILIES, REGISTERED} from './engine/src/core/fonts.ts';`);
const facesOf = (family) => fonts.REGISTERED.filter((face) => face.family === family);
const pinned = (file) => lock.fonts.find((font) => font.file === file);

test('Grid Sans is one family made of Inter latin and IBM Plex Sans Arabic arabic', () => {
  assert.equal(fonts.FAMILY.gridSans, 'Grid Sans');
  assert.ok(fonts.LOADED_FAMILIES.includes('Grid Sans'));
  assert.deepEqual(facesOf('Grid Sans').map((face) => [face.subset, face.file, face.weight]), [
    ['latin', 'Inter-latin-var.woff2', '400'],
    ['arabic', 'IBMPlexSansArabic-arabic-400.woff2', '400'],
    ['latin', 'Inter-latin-var.woff2', '500'],
    ['arabic', 'IBMPlexSansArabic-arabic-500.woff2', '500'],
    ['latin', 'Inter-latin-var.woff2', '600'],
    ['arabic', 'IBMPlexSansArabic-arabic-600.woff2', '600'],
    ['latin', 'Inter-latin-var.woff2', '700'],
    ['arabic', 'IBMPlexSansArabic-arabic-700.woff2', '700'],
  ]);
  for (const face of facesOf('Grid Sans')) {
    assert.equal(face.unicodeRange, pinned(face.file).unicodeRange, `${face.file} keeps the recorded range`);
    assert.equal(face.bytes, pinned(face.file).bytes);
  }
});

test('Latin and Arabic share the same weight descriptors, so a browser keeps both scripts in one face', () => {
  // A browser picks the face for the requested weight first and applies unicode-range only among faces with the
  // same descriptors. A Latin range face ("100 900") next to static Arabic weights lost to the exact Arabic match
  // at 400 to 700 and left every Latin letter and digit in the system serif.
  const faces = facesOf('Grid Sans');
  const weights = (subset) => faces.filter((face) => face.subset === subset).map((face) => face.weight);
  assert.deepEqual(weights('latin'), ['400', '500', '600', '700'], 'one Inter face per weight, never a range');
  assert.deepEqual(weights('latin'), weights('arabic'), 'the same weights for both scripts');
  assert.equal(new Set(faces.filter((face) => face.subset === 'latin').map((face) => face.file)).size, 1, 'one Latin file serves every weight');
});

test('the families that already existed keep their faces', () => {
  assert.deepEqual(facesOf('Plex Display').map((face) => [face.subset, face.file, face.weight]), [
    ['latin', 'IBMPlexSansArabic-latin-700.woff2', '1 1000'],
    ['arabic', 'IBMPlexSansArabic-arabic-700.woff2', '1 1000'],
  ]);
  assert.deepEqual(['Cairo', 'Tajawal', 'IBM Plex Mono', 'Noto Naskh Arabic', 'Source Serif 4'].map((family) => facesOf(family).length), [2, 6, 2, 6, 6]);
  assert.equal(fonts.REGISTERED.length, 32, 'twenty-four earlier faces plus eight for Grid Sans');
});
