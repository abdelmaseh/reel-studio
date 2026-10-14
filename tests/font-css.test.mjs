import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
  DECLARED_FONTS, cssRequestUrl, fontFileName, lockEntriesFromManifest, manifestWeight, matchesWeight, parseFaces, slug,
  upsertLockFonts, upsertTemplateFonts,
} from '../scripts/lib/font-css.mjs';
import {woff2Axes} from '../scripts/lib/woff2-axes.mjs';

const lock = JSON.parse(readFileSync(new URL('../versions.lock.json', import.meta.url), 'utf8'));
const fontFile = (name) => fileURLToPath(new URL(`../engine/public/fonts/${name}`, import.meta.url));
const INTER = DECLARED_FONTS.find((spec) => spec.family === 'Inter');

const STATIC_CSS = `/* arabic */
@font-face {
  font-family: 'Example Sans';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/examplesans/v1/arabic-500.woff2) format('woff2');
  unicode-range: U+0600-06FF, U+200C-200E;
}
/* latin */
@font-face {
  font-family: 'Example Sans';
  font-style: italic;
  font-weight: 700;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/examplesans/v1/latin-700-italic.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131;
}`;
const VARIABLE_CSS = `/* latin-ext */
@font-face {
  font-family: 'Example Var';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/examplevar/v1/latin-ext.woff2) format('woff2');
  unicode-range: U+0100-02BA;
}
/* latin */
@font-face {
  font-family: 'Example Var';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/examplevar/v1/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131;
}`;

test('the CSS request keeps the static form and sorts variable axes lowercase first', () => {
  assert.equal(cssRequestUrl({family: 'IBM Plex Sans Arabic', weights: [400, 500]}),
    'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500&display=swap');
  assert.equal(cssRequestUrl(INTER), 'https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&display=swap');
  assert.equal(cssRequestUrl({family: 'Example', weights: [400], axes: {wght: [100, 900], GRAD: [0, 100], wdth: [75, 100]}}),
    'https://fonts.googleapis.com/css2?family=Example:wdth,wght,GRAD@75..100,100..900,0..100&display=swap');
});

test('parseFaces reads static weights, italic styles and variable weight ranges', () => {
  const faces = parseFaces(STATIC_CSS);
  assert.deepEqual(faces.map((f) => [f.subset, f.weight, f.weightMax, f.style]), [['arabic', '500', null, 'normal'], ['latin', '700', null, 'italic']]);
  assert.equal(faces[0].unicodeRange, 'U+0600-06FF, U+200C-200E');
  assert.deepEqual(parseFaces(VARIABLE_CSS).map((f) => [f.subset, f.weight, f.weightMax]), [['latin-ext', '100', '900'], ['latin', '100', '900']]);
  assert.throws(() => parseFaces(STATIC_CSS.replace(/unicode-range:[^;]+;/, '')), /no unicode-range/);
});

test('variable files get a flat -var name and the nominal weight, static files keep their weight', () => {
  const [arabic, latin] = parseFaces(STATIC_CSS);
  const spec = {family: 'Example Sans', weights: [500, 700], subsets: ['arabic', 'latin']};
  assert.equal(fontFileName(spec, arabic), 'ExampleSans-arabic-500.woff2');
  assert.equal(fontFileName(spec, latin), 'ExampleSans-latin-700-italic.woff2');
  assert.equal(manifestWeight(spec, latin), 700);
  const [, variable] = parseFaces(VARIABLE_CSS);
  assert.equal(fontFileName(INTER, variable), 'Inter-latin-var.woff2');
  assert.equal(manifestWeight(INTER, variable), 400);
  assert.equal(slug('IBM Plex Sans Arabic'), 'IBMPlexSansArabic');
});

test('a variable request matches the declared range and a static request the exact weight', () => {
  const [staticArabic] = parseFaces(STATIC_CSS);
  const [, variableLatin] = parseFaces(VARIABLE_CSS);
  assert.equal(matchesWeight({weights: [500]}, staticArabic, 500), true);
  assert.equal(matchesWeight({weights: [500]}, staticArabic, 400), false);
  assert.equal(matchesWeight(INTER, variableLatin, 400), true);
  assert.equal(matchesWeight(INTER, staticArabic, 400), false);
  assert.equal(matchesWeight({weights: [400]}, variableLatin, 400), false, 'a variable file is never a static weight');
});

test('lock entries follow the lock layout and replace only their own family', () => {
  const manifest = [
    {family: 'Inter', file: 'Inter-latin-var.woff2', subset: 'latin', weight: 400, style: 'normal', bytes: 123, unicodeRange: 'U+0000-00FF',
      sha256: 'a'.repeat(64), sourceUrl: 'https://fonts.gstatic.com/s/inter/v1/x.woff2', cssUrl: 'not recorded', retrievedAt: 'not recorded'},
    {family: 'Cairo', file: 'Cairo-latin-400.woff2', subset: 'latin', weight: 400, style: 'normal', bytes: 9, unicodeRange: 'U+0000',
      sha256: 'b'.repeat(64), sourceUrl: 'https://fonts.gstatic.com/s/cairo/v1/y.woff2'},
  ];
  const entries = lockEntriesFromManifest(manifest, ['Inter']);
  assert.equal(entries.length, 1);
  assert.deepEqual(Object.keys(entries[0]), ['family', 'file', 'subset', 'weight', 'style', 'bytes', 'unicodeRange', 'sha256', 'url']);
  assert.equal(entries[0].url, 'https://fonts.gstatic.com/s/inter/v1/x.woff2');
  assert.throws(() => lockEntriesFromManifest([{...manifest[0], sourceUrl: undefined}], ['Inter']), /sourceUrl/);
  const before = structuredClone(lock);
  const next = upsertLockFonts(lock, entries, ['Inter']);
  assert.deepEqual(lock, before, 'the input lock is never mutated');
  assert.equal(next.fonts.filter((font) => font.family === 'Inter').length, 1);
  assert.equal(next.fonts.length, lock.fonts.filter((font) => font.family !== 'Inter').length + 1);
  const files = next.fonts.map((font) => font.file);
  assert.deepEqual(files, [...files].sort((a, b) => a.localeCompare(b, 'en')));
  assert.deepEqual(upsertLockFonts(next, entries, ['Inter']), next, 'recording twice changes nothing');
});

const six = ({family, file, subset, weight, style, bytes}) => ({family, file, subset, weight, style, bytes});

test('the tracked manifest template lists exactly the pinned fonts, in lock order', () => {
  const template = JSON.parse(readFileSync(new URL('../engine/public/fonts/manifest.template.json', import.meta.url), 'utf8'));
  assert.deepEqual(template.map(six), lock.fonts.map(six));
});

test('recording a font in the template changes only its own family and is repeatable', () => {
  const template = JSON.parse(readFileSync(new URL('../engine/public/fonts/manifest.template.json', import.meta.url), 'utf8'));
  const entry = {family: 'Inter', file: 'Inter-latin-var.woff2', subset: 'latin', weight: 400, style: 'normal', bytes: 123, unicodeRange: 'U+0000-00FF', sha256: 'a'.repeat(64), url: 'https://fonts.gstatic.com/s/inter/v1/x.woff2'};
  const before = structuredClone(template);
  const next = upsertTemplateFonts(template, [entry], ['Inter']);
  assert.deepEqual(template, before, 'the input is never mutated');
  assert.deepEqual(next.filter((font) => font.family === 'Inter'), [six(entry)], 'the six-key form only');
  assert.deepEqual(next.filter((font) => font.family !== 'Inter'), template.filter((font) => font.family !== 'Inter'), 'other entries stay exactly as they are');
  assert.deepEqual(upsertTemplateFonts(next, [entry], ['Inter']), next);
});

test('every declared family is pinned in the lock and no pinned family is undeclared', () => {
  for (const spec of DECLARED_FONTS) {
    for (const subset of spec.subsets) {
      for (const weight of spec.weights) {
        const hit = lock.fonts.find((font) => font.family === spec.family && font.subset === subset && font.weight === weight);
        assert.ok(hit, `${spec.family} ${subset} ${weight} is declared but not pinned`);
        assert.equal(hit.file.endsWith('-var.woff2'), Boolean(spec.axes), `${hit.file}: only variable fonts use the -var name`);
      }
    }
  }
  assert.deepEqual([...new Set(lock.fonts.map((font) => font.family))].sort(), DECLARED_FONTS.map((spec) => spec.family).sort());
});

test('woff2Axes reads the variation axes of real fonts and refuses other data', {skip: !existsSync(fontFile('Cairo-latin-400.woff2'))}, () => {
  assert.deepEqual(woff2Axes(readFileSync(fontFile('Cairo-latin-400.woff2'))), [{tag: 'wght', min: 200, default: 400, max: 1000}]);
  assert.deepEqual(woff2Axes(readFileSync(fontFile('IBMPlexSansArabic-arabic-700.woff2'))), []);
  assert.throws(() => woff2Axes(Buffer.alloc(64)), /Not a WOFF2/);
});

test('the pinned Inter file keeps its optical-size and weight axes', {skip: !existsSync(fontFile('Inter-latin-var.woff2'))}, () => {
  const axes = woff2Axes(readFileSync(fontFile('Inter-latin-var.woff2')));
  const opsz = axes.find((axis) => axis.tag === 'opsz');
  const wght = axes.find((axis) => axis.tag === 'wght');
  assert.ok(opsz && opsz.min <= 14 && opsz.max >= 32, 'opsz must cover 14..32');
  assert.ok(wght && wght.min <= 100 && wght.max >= 900, 'wght must cover 100..900');
});
