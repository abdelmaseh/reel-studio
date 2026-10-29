import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {collectLibraryInventory, textSha256} from '../scripts/lib/library-inventory.mjs';
import {collectLibraryEditorial, recommendLibrary} from '../scripts/lib/library-selection.mjs';
import {previewDefinitions, previewFixtureIssues} from '../engine/src/library-preview/fixtures.ts';
import {BACKDROP_KINDS, LOOK_KINDS} from '../engine/src/looks/index.ts';
import {buildEditorPlan, validateEditorBrief} from '../scripts/lib/editor-director.mjs';
import {editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {profileToBrief} from '../scripts/lib/branding.mjs';
import {dialectIn} from './helpers/dialect.mjs';

const read = async (file) => (await readFile(new URL(`../${file}`, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const KEYS = [...LOOK_KINDS.map((id) => `look:${id}`), ...BACKDROP_KINDS.map((id) => `backdrop:${id}`)];
const inventory = await collectLibraryInventory();
const editorial = await collectLibraryEditorial({inventory});

test('the looks and the girih backdrop are inventoried from the looks folder, each with a preview and a current guidance record', () => {
  for (const key of KEYS) {
    const item = inventory.items.find((entry) => entry.key === key);
    assert.ok(item, `${key} is in the inventory`);
    assert.equal(item.kind, 'effect');
    assert.ok(item.sourcePaths.includes('engine/src/looks/index.ts'), key);
    const guide = editorial.items.find((entry) => entry.key === key);
    assert.ok(guide?.editorial, `${key} has a guidance record`);
    assert.equal(guide.editorial.assessment, 'current', `${key}: its evidence hashes match the files`);
    const definition = previewDefinitions().find((entry) => entry.key === key);
    assert.ok(definition, `${key} has a preview definition`);
    assert.deepEqual(previewFixtureIssues(definition), [], key);
    assert.match(definition.labelAr, /\p{Script=Arabic}/u);
  }
  assert.ok(!editorial.unclassified.some((key) => KEYS.includes(key)));
  assert.deepEqual(editorial.orphaned.filter((key) => KEYS.includes(key)), []);
  assert.equal(inventory.countsByLayer.look, LOOK_KINDS.length);
  assert.equal(inventory.countsByLayer.backdrop, BACKDROP_KINDS.length);
});

test('every evidence file of a look record exists and the record cites the manifest root where the look is applied', async () => {
  for (const key of ['look:riso', 'look:blueprint']) {
    const record = editorial.items.find((entry) => entry.key === key).editorial;
    assert.ok(record.evidence.some((entry) => entry.path === 'engine/src/prepared-edit/PreparedEdit.tsx'), key);
    assert.ok(record.evidence.some((entry) => entry.path === 'engine/src/prepared-edit/schema.ts'), key);
    for (const entry of record.evidence) assert.equal(textSha256(await read(entry.path)), entry.sha256, `${key}: ${entry.path}`);
  }
});

test('a look recolours everything, so it is never shortlisted when the profile colours must stay', () => {
  const context = {intent: 'brand', mode: 'recording', sourceKind: 'presenter', role: 'style', limit: 20};
  const plain = recommendLibrary(editorial, context).candidates.map((candidate) => candidate.key);
  assert.ok(plain.includes('look:riso') && plain.includes('look:blueprint'), `looks are offered when nothing forbids them (${plain})`);
  assert.ok(!plain.includes('backdrop:girih'), 'the backdrop is not a packaged action until a scene takes it by name');
  const branded = recommendLibrary(editorial, {...context, style: 'section-deck', requireBrandColors: true});
  assert.ok(!branded.candidates.some((candidate) => candidate.layer === 'look'));
  assert.ok(branded.excluded.some((entry) => entry.key === 'look:riso' && entry.reasons.includes('profile-colours-not-supported')));
  const technical = recommendLibrary(editorial, {intent: 'process', mode: 'graphics', role: 'style', mood: 'technical', limit: 20}).candidates;
  assert.equal(technical.find((candidate) => candidate.layer === 'look')?.key, 'look:blueprint', 'a technical process explanation points at the blueprint look');
});

test('the planner copies a look from the brief into the manifest and refuses a bad one', async () => {
  const profile = JSON.parse(await readFile(new URL('../PROFILE.example.json', import.meta.url), 'utf8'));
  const source = {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 150};
  const words = [{text: 'شرح', startMs: 0, endMs: 400, confidence: 1}];
  const brief = (extra) => ({version: 1, id: 'look-brief', source: source.path, transcript: 'Projects/look-brief/words.json', ...profileToBrief(profile), purpose: 'tutorial', tone: 'calm',
    beats: [{id: 'hook', fromSec: 0, toSec: 2, intent: 'intro', data: {kicker: 'تجربة', title: 'شرح', subtitle: 'بسيط', caption: 'شرح'}}], ...extra});
  assert.equal('look' in buildEditorPlan(brief({}), source, words).manifest, false);
  for (const look of [{kind: 'riso'}, {kind: 'riso', inks: ['#1b2a6b', '#e8452c']}, {kind: 'blueprint'}]) {
    const plan = buildEditorPlan(brief({look}), source, words);
    assert.deepEqual(plan.manifest.look, look);
    assert.equal(editManifestSchema.safeParse(plan.manifest).success, true);
  }
  assert.throws(() => validateEditorBrief(brief({look: {kind: 'vhs'}})));
  assert.throws(() => validateEditorBrief(brief({look: {kind: 'riso', inks: ['#0078bf', '#0078bf']}})));
});

test('the guides and the settings screen mention the looks, in neutral Arabic where the text is Arabic', async () => {
  const styles = await read('instructions/STYLES.md');
  assert.match(styles, /## Looks/);
  for (const needle of ['"kind":"riso"', '"kind":"blueprint"', 'brand colours', 'girih']) assert.ok(styles.includes(needle), needle);
  assert.ok((await read('instructions/SETTINGS.md')).includes('`look` at the manifest root'));
  assert.ok((await read('instructions/REVIEW-EDITOR.md')).includes('riso (two inks'));
  const app = await read('scripts/settings-ui/app.js');
  assert.ok(app.includes('looksPreview'));
  const strings = [...app.slice(app.indexOf('const lookCards'), app.indexOf('function captionsPage')).matchAll(/'([^']*\p{Script=Arabic}[^']*)'/gu)].map((match) => match[1]);
  assert.ok(strings.length >= 6, `${strings.length} Arabic strings found in the looks preview`);
  for (const text of strings.slice(0, 12)) assert.deepEqual(dialectIn(text), [], text);
});
