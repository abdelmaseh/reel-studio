import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile, readdir} from 'node:fs/promises';
import {STYLE_IDS} from '../engine/src/styles/registry.ts';
import {assembleStylePalettes, loadStylePalettes, resolvePalette, validatePalettes} from '../scripts/lib/sfx-events.mjs';

// The captured baseline of the old central file. Shapes used here: baseline.styles is the list of
// recorded style ids; baseline.palettes is the assembled {version, provenance, cueKinds, styles}
// object limited to those styles.
const baseline = JSON.parse(await readFile(new URL('./fixtures/style-baselines.json', import.meta.url), 'utf8'));
const catalog = JSON.parse(await readFile(new URL('../Sound-Kits/catalog.json', import.meta.url), 'utf8'));
const readJson = async (relative) => JSON.parse(await readFile(new URL(`../${relative}`, import.meta.url), 'utf8'));

test('the assembled palette object equals the captured baseline for the recorded styles, key order included', async () => {
  const palettes = await loadStylePalettes();
  const recorded = baseline.styles;
  // Styles added after the capture (grid-glide) are covered by their own tests.
  const restricted = {...palettes, styles: Object.fromEntries(recorded.map((id) => [id, palettes.styles[id]]))};
  assert.deepEqual(restricted, baseline.palettes);
  assert.equal(JSON.stringify(restricted), JSON.stringify(baseline.palettes));
  assert.deepEqual(Object.keys(palettes), ['version', 'provenance', 'cueKinds', 'styles']);
  assert.deepEqual(Object.keys(palettes.styles), [...STYLE_IDS]);
  assert.deepEqual(Object.keys(palettes.styles).slice(0, recorded.length), recorded);
});

test('every style folder keeps its own sound palette in the old entry shape', async () => {
  for (const id of STYLE_IDS) {
    assert.deepEqual(Object.keys(await readJson(`engine/src/styles/${id}/sound.json`)), ['dna', 'kinds'], id);
  }
  assert.deepEqual(Object.keys(await readJson('engine/src/styles/sound-palettes.json')), ['version', 'provenance', 'cueKinds']);
});

test('the assembled palettes validate against the sound catalog and resolve for every style', async () => {
  const palettes = await loadStylePalettes();
  assert.doesNotThrow(() => validatePalettes(palettes, catalog));
  for (const id of STYLE_IDS) assert.equal(resolvePalette(palettes, catalog, id).style, id);
});

test('the old central palette file is gone and no palette sits in an unregistered folder', async () => {
  assert.equal(existsSync(new URL('../Sound-Kits/style-palettes.json', import.meta.url)), false);
  const folders = (await readdir(new URL('../engine/src/styles/', import.meta.url), {withFileTypes: true}))
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  for (const folder of folders) {
    if (existsSync(new URL(`../engine/src/styles/${folder}/sound.json`, import.meta.url))) {
      assert.ok(STYLE_IDS.includes(folder), `${folder} has a sound.json but is not a registered style`);
    }
  }
});

test('a missing style palette or a stray header field is reported by name', async () => {
  const palettes = await loadStylePalettes();
  const header = {version: palettes.version, provenance: palettes.provenance, cueKinds: palettes.cueKinds};
  const incomplete = {...palettes.styles};
  delete incomplete[STYLE_IDS[0]];
  assert.throws(() => assembleStylePalettes(header, incomplete), new RegExp(`Style ${STYLE_IDS[0]} has no sound palette`));
  assert.throws(() => assembleStylePalettes({...header, styles: {}}, palettes.styles), /exactly these fields/);
});
