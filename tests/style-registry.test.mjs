import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs, readdirSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT} from '../scripts/lib/project-paths.mjs';
import {v4Baseline} from './helpers/v4-baseline.mjs';
import * as registry from '../engine/src/styles/registry.ts';
import {CAPTION_PRESENTATION, EDITOR_TONES, FONT_CHOICES, STYLE_USE_CASES} from '../engine/src/styles/types.ts';

// The fixture holds the hand-written lists as they were before they moved into engine/src/styles/.
// Later styles are appended to the registry, so every comparison is limited to the styles it recorded.
const fixture = JSON.parse(await fs.readFile(path.join(ROOT, 'tests', 'fixtures', 'style-baselines.json'), 'utf8'));
const v4Director = JSON.parse(await fs.readFile(path.join(ROOT, 'tests', 'fixtures', 'v4-director-tables.json'), 'utf8'));
const {lists} = v4Baseline(fixture);
const recorded = fixture.styles;
const STYLES_DIR = path.join(ROOT, 'engine', 'src', 'styles');

const restrict = (record) => Object.fromEntries(Object.entries(record).filter(([id]) => recorded.includes(id)));
const metaOf = (id) => registry.getStyleMeta(id);

test('the registry keeps the recorded order, with unique ids', () => {
  assert.deepEqual([...registry.STYLE_IDS], v4Director.styleIds);
  assert.equal(registry.STYLE_IDS.length, 11);
  assert.deepEqual(registry.STYLE_IDS.slice(0, recorded.length), recorded);
  assert.deepEqual(registry.STYLE_IDS.slice(0, recorded.length), lists.styleIds);
  assert.equal(new Set(registry.STYLE_IDS).size, registry.STYLE_IDS.length);
  assert.deepEqual(registry.STYLE_METAS.map((meta) => meta.id), [...registry.STYLE_IDS]);
  for (const id of registry.STYLE_IDS) assert.equal(registry.isStyleId(id), true);
  assert.equal(registry.isStyleId('not-a-style'), false);
  assert.equal(registry.isStyleId('constructor'), false);
});

test('every style folder has a meta whose id is the folder name, and every folder is registered', () => {
  const folders = readdirSync(STYLES_DIR, {withFileTypes: true}).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.deepEqual(folders, [...registry.STYLE_IDS].sort());
  for (const id of registry.STYLE_IDS) {
    assert.equal(metaOf(id).id, id);
    assert.ok(readdirSync(path.join(STYLES_DIR, id)).includes('meta.ts'), `${id} needs a meta.ts`);
  }
});

test('labels, descriptions, use cases and grammar equal the recorded profiles and settings labels', () => {
  assert.deepEqual(restrict(registry.styleLabels()), lists.labels);
  for (const id of recorded) {
    const meta = metaOf(id), profile = lists.profiles[id];
    assert.deepEqual({label: meta.label.en, description: meta.description.en, useCases: [...meta.useCases], grammar: meta.grammar},
      {label: profile.label, description: profile.description, useCases: profile.useCases, grammar: profile.grammar}, id);
  }
});

test('font, caption presentation, clause grouping and static captions equal the recorded defaults', () => {
  for (const id of recorded) {
    assert.deepEqual({font: registry.defaultFontFor(id), captionsPresentation: registry.defaultCaptionsFor(id),
      clauseCaptions: registry.clauseCaptionsDefault(id), staticCaptions: registry.staticCaptionStyles().includes(id)}, lists.defaults[id], id);
  }
  assert.deepEqual(registry.staticCaptionStyles().filter((id) => recorded.includes(id)), lists.staticCaptionStyles);
});

test('PiP policy, brand styles, legacy styles and mix profiles equal the recorded values', () => {
  assert.deepEqual(restrict(registry.pipPolicies()), lists.pip);
  assert.deepEqual(registry.brandStyles().filter((id) => recorded.includes(id)), lists.brandStyles);
  assert.deepEqual(registry.STYLE_IDS.filter((id) => registry.isLegacyStyle(id) && recorded.includes(id)), lists.legacyStyles);
  assert.deepEqual(restrict(registry.mixProfiles()), lists.mixProfiles);
});

test('purpose fit, tone fit and semantic eligibility equal the recorded director tables', () => {
  const purposes = registry.purposeFit(), tones = registry.toneFit();
  assert.deepEqual(purposes, v4Director.purposeFit);
  assert.deepEqual(tones, v4Director.toneFit);
  assert.deepEqual(registry.semanticEligibility(), v4Director.eligibility);
  assert.deepEqual(Object.keys(purposes).sort(), [...STYLE_USE_CASES].sort());
  assert.deepEqual(Object.keys(tones).sort(), [...EDITOR_TONES].sort());
  for (const purpose of STYLE_USE_CASES) assert.deepEqual(restrict(purposes[purpose]), lists.purposeFit[purpose], purpose);
  for (const tone of EDITOR_TONES) assert.deepEqual(restrict(tones[tone]), lists.toneFit[tone], tone);
  assert.deepEqual(Object.fromEntries(Object.entries(restrict(registry.semanticEligibility())).map(([id, families]) => [id, [...families].sort()])),
    Object.fromEntries(Object.entries(restrict(v4Director.eligibility)).map(([id, families]) => [id, [...families].sort()])));
});

test('unknown ids keep the original fallbacks and error text', () => {
  assert.equal(registry.defaultFontFor('not-a-style'), 'Cairo');
  assert.equal(registry.defaultCaptionsFor('not-a-style'), 'pill');
  assert.equal(registry.clauseCaptionsDefault('not-a-style'), false);
  assert.equal(registry.isLegacyStyle('not-a-style'), false);
  assert.equal(registry.ownSceneStyle('intro'), undefined);
  assert.throws(() => registry.getStyleMeta('nope'), new Error(`Unknown style "nope". Choose one of: ${registry.STYLE_IDS.join(', ')}.`));
});

test('every meta stays inside the shared vocabulary', () => {
  const claimed = new Map();
  for (const meta of registry.STYLE_METAS) {
    assert.match(meta.id, /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
    assert.ok(meta.label.ar.trim() && meta.label.en.trim() && meta.description.ar.trim() && meta.description.en.trim(), meta.id);
    assert.ok(meta.useCases.length > 0 && meta.useCases.every((value) => STYLE_USE_CASES.includes(value)), meta.id);
    assert.ok(FONT_CHOICES.includes(meta.defaults.font) && CAPTION_PRESENTATION.includes(meta.defaults.captionsPresentation), meta.id);
    for (const [key, score] of Object.entries(meta.fit.purpose)) assert.ok(STYLE_USE_CASES.includes(key) && Number.isInteger(score) && score > 0, `${meta.id} purpose ${key}`);
    for (const [key, score] of Object.entries(meta.fit.tone)) assert.ok(EDITOR_TONES.includes(key) && Number.isInteger(score) && score > 0, `${meta.id} tone ${key}`);
    assert.match(meta.since, /^\d+\.\d+\.\d+$/);
    assert.ok(meta.pip.evidence.trim(), meta.id);
    if (meta.mix) assert.ok(meta.mix.lraMax > 0 && meta.mix.slug && meta.mix.source && meta.mix.section, meta.id);
    for (const family of meta.ownScenes) {
      assert.equal(claimed.get(family), undefined, `${family} is claimed by two styles`);
      claimed.set(family, meta.id);
      assert.equal(registry.ownSceneStyle(family), meta.id);
    }
  }
  assert.deepEqual(registry.STYLE_METAS.filter((meta) => meta.legacy).map((meta) => meta.id), ['section-deck']);
});

test('the registry, the styles facade and the preference options load in plain Node with no packages', async (t) => {
  const base = path.join(ROOT, 'state', 'tmp');
  await fs.mkdir(base, {recursive: true});
  const root = await fs.mkdtemp(path.join(base, 'style-registry-'));
  t.after(async () => { assert.equal(path.dirname(root), base); await fs.rm(root, {recursive: true, force: true}); });
  const files = ['engine/src/styles/types.ts', 'engine/src/styles/registry.ts', 'engine/src/creative-kit/styles.ts', 'engine/src/core/preference-options.ts',
    ...registry.STYLE_IDS.map((id) => `engine/src/styles/${id}/meta.ts`)];
  for (const file of files) {
    await fs.mkdir(path.dirname(path.join(root, file)), {recursive: true});
    await fs.copyFile(path.join(ROOT, file), path.join(root, file));
  }
  await fs.writeFile(path.join(root, 'check.mjs'), [
    "import {STYLE_IDS, purposeFit} from './engine/src/styles/registry.ts';",
    "import {STYLE_IDS as FACADE_IDS, getStyleProfile} from './engine/src/creative-kit/styles.ts';",
    "import {PREFERENCE_VALUES, STYLE_LABELS} from './engine/src/core/preference-options.ts';",
    'console.log(JSON.stringify({ids: [...STYLE_IDS], facade: [...FACADE_IDS], first: getStyleProfile(STYLE_IDS[0]).id, labels: Object.keys(STYLE_LABELS), choices: [...PREFERENCE_VALUES.style], purposes: Object.keys(purposeFit())}));',
  ].join('\n'));
  const run = spawnSync(process.execPath, ['check.mjs'], {cwd: root, encoding: 'utf8', windowsHide: true});
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const seen = JSON.parse(run.stdout.trim().split(/\r?\n/).at(-1));
  assert.deepEqual(seen.ids, [...registry.STYLE_IDS]);
  assert.deepEqual(seen.facade, [...registry.STYLE_IDS]);
  assert.deepEqual(seen.choices, [...registry.STYLE_IDS]);
  assert.deepEqual(seen.labels, [...registry.STYLE_IDS]);
  assert.equal(seen.first, registry.STYLE_IDS[0]);
  assert.deepEqual(seen.purposes, [...STYLE_USE_CASES]);
});

const anyStyleId = new RegExp(`['"](?:${registry.STYLE_IDS.join('|')})['"]`);
// Files that used to hold a hand-written copy of a list the registry now derives.
// Each migration task adds the files it converted; a pattern that matches means a copy is back.
const DERIVED = [
  ['engine/src/creative-kit/styles.ts', anyStyleId],
  ['engine/src/core/preference-options.ts', anyStyleId],
  ['engine/src/core/pip.ts', anyStyleId],
  ['engine/src/prepared-edit/caption-emphasis.ts', anyStyleId],
  ['engine/src/prepared-edit/timeline.ts', anyStyleId],
  ['scripts/lib/mix-contract.mjs', anyStyleId],
  ['engine/src/core/brand.ts', /BRAND_STYLES[^=\n]*=\s*\[|apply to split-canvas and section-deck/],
  ['engine/src/prepared-edit/PreparedEdit.tsx', /style\s*!==?\s*['"](?:split-canvas|section-deck)['"]|style\s*===?\s*['"]section-deck['"]/],
  ['engine/src/creative-kit/primitives.tsx', /const adapted = style !==/],
  ['scripts/lib/editor-director.mjs', anyStyleId],
];

test('no consumer keeps its own copy of a list that the registry derives', async () => {
  const stale = [];
  for (const [file, pattern] of DERIVED) {
    if (pattern.test(await fs.readFile(path.join(ROOT, file), 'utf8'))) stale.push(file);
  }
  assert.deepEqual(stale, [], 'These files still carry style lists; derive them from engine/src/styles/registry.ts.');
});

test('PiP, brand, static caption and clause defaults are read from the registry for every style', async () => {
  const {PIP_POLICY, pipAllowed} = await import('../engine/src/core/pip.ts');
  const {BRAND_STYLES, BRAND_STYLE_BASES, BRAND_STYLE_DEFAULTS, applyBrandToScenes} = await import('../engine/src/core/brand.ts');
  const {STATIC_CAPTION_STYLES, captionEmphasisIssues} = await import('../engine/src/prepared-edit/caption-emphasis.ts');
  const {compileEdit} = await import('../engine/src/prepared-edit/timeline.ts');
  assert.deepEqual(PIP_POLICY, registry.pipPolicies());
  assert.deepEqual([...BRAND_STYLES], registry.brandStyles());
  for (const style of BRAND_STYLES) assert.ok(BRAND_STYLE_BASES[style] && BRAND_STYLE_DEFAULTS[style], `${style} takes brand colours, so brand.ts needs its tokens`);
  assert.deepEqual([...STATIC_CAPTION_STYLES], registry.staticCaptionStyles());
  const words = Array.from({length: 12}, (_, i) => ({text: i === 5 ? 'word.' : 'word', startMs: i * 260, endMs: i * 260 + 200, confidence: 1}));
  const groups = (style, grouping) => compileEdit({style, source: {fps: 30}, segments: [{fromFrame: 0, toFrame: 120}],
    captions: {words, ...(grouping === undefined ? {} : {grouping})}}).captionGroups.length;
  for (const style of registry.STYLE_IDS) {
    assert.equal(pipAllowed(style).allowed, registry.getStyleMeta(style).pip.allowed, style);
    assert.equal(captionEmphasisIssues(style, 3, [{sourceIndex: 0, kind: 'pop'}]).length > 0, registry.getStyleMeta(style).defaults.staticCaptions, style);
    assert.equal(groups(style) === groups(style, 'clauses'), registry.getStyleMeta(style).defaults.clauseCaptions, style);
    const applied = applyBrandToScenes(style, {primary: '#4D8DFF', accent: '#FFB020', background: null, text: null}, []);
    if (!registry.getStyleMeta(style).brand) assert.match(applied.notices[0], /keeps its own colours/, style);
  }
});
