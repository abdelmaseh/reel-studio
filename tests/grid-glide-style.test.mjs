import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  STYLE_IDS, STYLE_METAS, brandStyles, clauseCaptionsDefault, defaultCaptionsFor, defaultFontFor, getStyleMeta, isLegacyStyle, isStyleId,
  mixProfiles, ownSceneStyle, pipPolicies, purposeFit, semanticEligibility, staticCaptionStyles, styleLabels, toneFit,
} from '../engine/src/styles/registry.ts';
import gridGlide from '../engine/src/styles/grid-glide/meta.ts';
import {FONT_CHOICES} from '../engine/src/styles/types.ts';
import {EDITION_STYLE_IDS, getStyleProfile} from '../engine/src/creative-kit/styles.ts';
import {STYLE_LABELS, defaultPreferences, resolvePreferences} from '../engine/src/core/preference-options.ts';
import {SLAB, isRoundCard} from '../engine/src/creative-kit/card-shape.ts';
import {profileToBrief} from '../scripts/lib/branding.mjs';
import {recommendEditorStyle} from '../scripts/lib/editor-director.mjs';
import {CUE_KINDS} from '../scripts/lib/scene-cues.mjs';
import {loadStylePalettes, resolvePalette, validatePalettes} from '../scripts/lib/sfx-events.mjs';
import {captureRecommendations} from '../scripts/capture-style-baselines.mjs';

const GLIDE_FAMILIES = ['glide-chapter', 'glide-card', 'glide-lines', 'glide-comment', 'glide-follow'];
const EARLIER = ['split-canvas', 'section-deck', 'kinetic-paper', 'calligraphic-receipts', 'paper-collage', 'judgment-board', 'stepped-editorial',
  'liquid-glass', 'campaign-tickets', 'magazine-interview', 'scrapbook-route'];
const profile = JSON.parse(await readFile(new URL('../PROFILE.example.json', import.meta.url), 'utf8'));

test('Grid Glide follows the earlier eleven and One Shot follows it, so every earlier tie-break keeps its order', () => {
  assert.deepEqual([...STYLE_IDS], [...EARLIER, 'grid-glide', 'one-shot', 'cartoon']);
  assert.equal(STYLE_METAS.at(-3), gridGlide);
  assert.deepEqual([...EDITION_STYLE_IDS], [...STYLE_IDS]);
  assert.ok(isStyleId('grid-glide'));
});

test('the identity card carries the name, grammar, policy and defaults', () => {
  assert.equal(gridGlide.id, 'grid-glide');
  assert.deepEqual(gridGlide.label, {ar: 'كلمات وكروت', en: 'Grid glide'});
  assert.deepEqual(gridGlide.description, {
    ar: 'كلمات تنزلق إلى مكانها وكروت ثابتة تعرض لقطات حقيقية',
    en: 'Words glide into a finished layout beside still cards of real screens.',
  });
  assert.deepEqual([...gridGlide.useCases], ['explainer', 'tutorial', 'comparison']);
  assert.deepEqual(gridGlide.grammar, {typography: 'product-sans', card: 'bevel-slab', annotation: 'inverted-box', composition: 'flat-canvas', caption: 'boxless', motion: 'quiet'});
  assert.equal(gridGlide.legacy, false);
  assert.equal(gridGlide.brand, false);
  assert.deepEqual(gridGlide.pip, {allowed: false, basis: 'inference', evidence: 'Grid Glide scenes are full-frame; use presenter shots between scenes instead.'});
  assert.deepEqual(gridGlide.defaults, {font: 'Grid Sans', captionsPresentation: 'minimal', clauseCaptions: false, staticCaptions: false});
  assert.deepEqual([...gridGlide.ownScenes], GLIDE_FAMILIES);
  assert.deepEqual([...gridGlide.fit.semanticBeats], GLIDE_FAMILIES);
  assert.equal(gridGlide.mix, undefined);
  assert.equal(gridGlide.since, '2.5.0');
  assert.ok(Object.isFrozen(gridGlide));
});

test('every list derived from the registry sees Grid Glide', () => {
  assert.equal(getStyleMeta('grid-glide'), gridGlide);
  assert.deepEqual(styleLabels()['grid-glide'], {label: 'كلمات وكروت', description: 'كلمات تنزلق إلى مكانها وكروت ثابتة تعرض لقطات حقيقية'});
  assert.deepEqual(STYLE_LABELS['grid-glide'], styleLabels()['grid-glide']);
  assert.equal(defaultFontFor('grid-glide'), 'Grid Sans');
  assert.equal(defaultCaptionsFor('grid-glide'), 'minimal');
  assert.equal(clauseCaptionsDefault('grid-glide'), false);
  assert.ok(!staticCaptionStyles().includes('grid-glide'));
  assert.equal(isLegacyStyle('grid-glide'), false);
  assert.ok(!brandStyles().includes('grid-glide'));
  assert.equal(pipPolicies()['grid-glide'].allowed, false);
  assert.deepEqual(semanticEligibility()['grid-glide'], GLIDE_FAMILIES);
  for (const family of GLIDE_FAMILIES) assert.equal(ownSceneStyle(family), 'grid-glide');
  assert.equal(ownSceneStyle('intro'), undefined);
  assert.equal(mixProfiles()['grid-glide'], undefined);
  assert.deepEqual([purposeFit().explainer['grid-glide'], purposeFit().tutorial['grid-glide'], purposeFit().comparison['grid-glide']], [11, 11, 8]);
  assert.equal(toneFit().calm['grid-glide'], 2);
  assert.equal(toneFit().energetic['grid-glide'], undefined);
});

test('Grid Sans is the default font and the creative-kit profile is built from the same card', () => {
  assert.ok(FONT_CHOICES.includes('Grid Sans'));
  const resolved = resolvePreferences(defaultPreferences(), {purpose: 'explainer', tone: 'calm', style: 'grid-glide'});
  assert.equal(resolved.fontFamily, 'Grid Sans');
  assert.equal(resolved.captionsPresentation, 'minimal');
  const pinned = resolvePreferences({...defaultPreferences(), font: {mode: 'fixed', value: 'Cairo'}}, {purpose: 'explainer', tone: 'calm', style: 'grid-glide'});
  assert.equal(pinned.fontFamily, 'Cairo', 'an explicit font choice still wins');
  const kit = getStyleProfile('grid-glide');
  assert.equal(kit.label, 'Grid glide');
  assert.equal(kit.description, gridGlide.description.en);
  assert.deepEqual(kit.grammar, gridGlide.grammar);
  assert.deepEqual([...kit.useCases], [...gridGlide.useCases]);
});

const brief = (purpose, tone) => ({version: 1, id: 'grid-glide-fit', source: 'Raw/example.mp4', transcript: 'Projects/grid-glide-fit/words.json',
  ...profileToBrief({...profile, schemaVersion: 3, preferences: defaultPreferences()}), purpose, tone,
  beats: [{id: 'hook', fromSec: 0, toSec: 3, intent: 'intro', data: {kicker: 'Example', title: 'A clear idea', subtitle: 'Review the meaning', caption: 'Example'}}]});

test('Grid Glide never wins on fit alone and every earlier automatic winner is unchanged', () => {
  const winners = {
    explainer: {energetic: 'kinetic-paper', calm: 'section-deck', editorial: 'section-deck'},
    'case-study': {energetic: 'calligraphic-receipts', calm: 'calligraphic-receipts', editorial: 'calligraphic-receipts'},
    tutorial: {energetic: 'kinetic-paper', calm: 'section-deck', editorial: 'section-deck'},
    comparison: {energetic: 'split-canvas', calm: 'split-canvas', editorial: 'split-canvas'},
    opinion: {energetic: 'judgment-board', calm: 'judgment-board', editorial: 'judgment-board'},
    story: {energetic: 'paper-collage', calm: 'paper-collage', editorial: 'paper-collage'},
  };
  for (const [purpose, tones] of Object.entries(winners)) {
    for (const [tone, winner] of Object.entries(tones)) {
      const result = recommendEditorStyle(brief(purpose, tone));
      assert.equal(result.style, winner, `${purpose}/${tone}`);
      const own = result.candidates.find((candidate) => candidate.style === 'grid-glide');
      assert.ok(own.score < result.candidates[0].score, `${purpose}/${tone}: ${own.score} must stay below ${result.candidates[0].score}`);
    }
  }
});

// The pre-migration record names eleven styles and compares only those. Grid Glide never wins on fit alone, but when the
// leaders were used recently the repetition penalty can lower them below its score, and then it may legitimately win a
// live recommendation. The baseline harness takes the winner from the recorded styles only, so the record stays comparable.
test('after recent use of the leaders Grid Glide may win live while the baseline keeps its recorded winner', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/style-baselines.json', import.meta.url), 'utf8'));
  assert.ok(!fixture.styles.includes('grid-glide'), 'the record names only the eleven earlier styles');
  const live = recommendEditorStyle({...brief('explainer', 'calm'), recentStyles: ['section-deck', 'split-canvas', 'kinetic-paper']});
  assert.equal(live.style, 'grid-glide', 'the live recommendation may choose the new style');
  assert.equal(live.candidates.find((candidate) => candidate.style === 'section-deck').score, 8, 'the recent leader dropped below the new style');
  const recordedOnly = live.candidates.filter((candidate) => fixture.styles.includes(candidate.style));
  assert.equal(recordedOnly[0].style, 'stepped-editorial', 'among the recorded styles the winner is unchanged');

  const cases = await captureRecommendations(fixture.styles);
  assert.equal(cases.recent.style, 'stepped-editorial');
  assert.deepEqual(cases.recent.reasons, recordedOnly[0].reasons);
  assert.ok(!cases.recent.candidates.some((candidate) => candidate.style === 'grid-glide'), 'the record lists recorded styles only');
  assert.deepEqual(cases, fixture.recommendations, 'every recorded recommendation is reproduced exactly');
  assert.deepEqual([cases.explicit.style, cases.explicit.explicit], ['liquid-glass', true], 'an explicit choice still wins');
  assert.deepEqual([cases.saved.style, cases.saved.explicit], ['paper-collage', true], 'a saved choice still wins');
});

// This test checks completeness, validity and resolution, never which cue sounds; the mapping is asserted in
// `tests/grid-glide-sound.test.mjs`.
test('the Grid Glide sound palette is complete, validates and resolves', async () => {
  const palettes = await loadStylePalettes();
  const catalog = JSON.parse(await readFile(new URL('../Sound-Kits/catalog.json', import.meta.url), 'utf8'));
  validatePalettes(palettes, catalog);
  assert.deepEqual(Object.keys(palettes.styles), [...STYLE_IDS]);
  const entry = palettes.styles['grid-glide'];
  assert.deepEqual(Object.keys(entry.kinds).sort(), [...CUE_KINDS].sort());
  const resolved = resolvePalette(palettes, catalog, 'grid-glide');
  assert.deepEqual(Object.keys(resolved.entries).sort(), [...CUE_KINDS].sort());
  assert.deepEqual(JSON.parse(await readFile(new URL('../engine/src/styles/grid-glide/sound.json', import.meta.url), 'utf8')), entry);
});

test('the shared slab material is plain data that loads without the engine packages', () => {
  assert.deepEqual([SLAB.radius, SLAB.inset, SLAB.innerRadius], [24, 9, 15]);
  assert.equal(SLAB.bevel.split('inset').length - 1, 34, 'eight top, eight left, nine bottom and nine right layers');
  assert.ok(SLAB.shadow.split(/\),\s*/).length === 2 && SLAB.shadow.split(/\),\s*/).every((layer) => /^\d+px \d+px/.test(layer)),
    'a two-layer drop shadow that falls to the right and bottom only');
  assert.equal(isRoundCard({}), true, 'styles without a grammar are round');
  assert.equal(isRoundCard({grammar: {card: 'rounded-ui'}}), true);
  assert.equal(isRoundCard({grammar: {card: 'bevel-slab'}}), true);
  assert.equal(isRoundCard({grammar: {card: 'ink-frame'}}), false);
});

test('the settings card art has its flat rule', async () => {
  const css = await readFile(new URL('../scripts/settings-ui/app.css', import.meta.url), 'utf8');
  assert.match(css, /\.illustration\.grid-glide\{background:#f2f2f2;/);
  const rules = css.match(/\.illustration\.grid-glide[^{}]*\{[^}]*\}/g) ?? [];
  assert.ok(rules.length >= 3, 'the card, its Arabic line and its bars are styled');
  for (const rule of rules) assert.doesNotMatch(rule, /letter-spacing/, `Arabic text takes no letter-spacing: ${rule}`);
});
