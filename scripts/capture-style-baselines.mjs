// Records what every style produces today, using only behaviour that exists before and after the
// per-style structure (public functions, never the hand-written lists themselves). The committed
// fixture is the proof that moving the lists into engine/src/styles/ changes nothing.
//
//   node scripts/capture-style-baselines.mjs            write tests/fixtures/style-baselines.json
//   node scripts/capture-style-baselines.mjs --out state/tmp/second.json   write somewhere else
//   --force                                              overwrite an existing file
//
// tests/fixtures/style-baselines.json is frozen. Never regenerate it. To audit how it was taken, run the copy of
// this script from the commit that added the fixture (git log -- tests/fixtures/style-baselines.json), on that
// commit. tests/style-baselines.test.mjs recomputes every section and compares it with the fixture.
import path from 'node:path';
import {createHash} from 'node:crypto';
import {promises as fs} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {ROOT} from './lib/project-paths.mjs';
import {createFrameRenderer} from './lib/ssr-frames.mjs';
import {STYLE_IDS, getStyleProfile} from '../engine/src/creative-kit/styles.ts';
import {STYLE_LABELS, defaultPreferences, resolvePreferences} from '../engine/src/core/preference-options.ts';
import {pipAllowed} from '../engine/src/core/pip.ts';
import {applyBrandToScenes} from '../engine/src/core/brand.ts';
import {captionEmphasisIssues} from '../engine/src/prepared-edit/caption-emphasis.ts';
import {compileEdit} from '../engine/src/prepared-edit/timeline.ts';
import {editSceneSchema} from '../engine/src/prepared-edit/schema.ts';
import {creativeGalleryDefaults, sceneFamilies} from '../engine/src/creative-kit/schema.ts';
import {semanticTemplateData} from '../engine/src/creative-kit/semantic/schema.ts';
import {CATALOG, catalogDemo, conceptSettledFrame} from '../engine/src/motion-concepts/catalog.ts';
import {normalizeMixOptions} from './lib/mix-contract.mjs';
import {EDITOR_PURPOSES, EDITOR_TONES, recommendEditorStyle} from './lib/editor-director.mjs';
import {profileToBrief} from './lib/branding.mjs';
import {editCues} from './lib/scene-cues.mjs';
import {loadStylePalette, planSfxEvents} from './lib/sfx-events.mjs';
import {normalizeGraphicsSpec} from './lib/graphics-project.mjs';

export const BASELINE_FILE = path.join(ROOT, 'tests', 'fixtures', 'style-baselines.json');
export const BASELINE_SECTIONS = Object.freeze(['lists', 'themes', 'geometry', 'palettes', 'resolvedPalettes', 'recommendations', 'soundPlans', 'markup', 'parses']);
// The graphics specifications that ship in instructions/examples/ (scene-pack.json there is a scene pack, not a specification).
export const EXAMPLE_SPECS = Object.freeze(['idea-to-results.json', 'project-scene/graphics-spec.json']);

const sortKeys = (value) => Array.isArray(value) ? value.map(sortKeys)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])])) : value;
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const canonicalHash = (value) => sha256(JSON.stringify(sortKeys(value)));
const plain = (value) => JSON.parse(JSON.stringify(value));

// --- recommendations and the fit tables they reveal -------------------------------------------------

const INTRO_BEAT = {kicker: 'Example', title: 'A clear idea', subtitle: 'Review the meaning', caption: 'Example'};
// Semantic beat families that currently earn a style a bonus, in the order the bonus tables list them.
const SEMANTIC_PROBES = ['token-lens', 'meter-receipt', 'ticket-offer', 'comment-stack', 'chapter-quote', 'route-stops', 'kinetic-text', 'evidence-wipe', 'message-board'];

async function baseBrief() {
  const profile = JSON.parse(await fs.readFile(path.join(ROOT, 'PROFILE.example.json'), 'utf8'));
  return {version: 1, id: 'style-baseline', source: 'Raw/example.mp4', transcript: 'Projects/style-baseline/words.json',
    ...profileToBrief({...profile, schemaVersion: 3, preferences: defaultPreferences()})};
}

export async function captureRecommendations(ids) {
  const base = await baseBrief();
  const brief = ({purpose = 'explainer', tone = 'calm', intent = 'intro', ...extra} = {}) => ({...base, purpose, tone, ...extra,
    beats: [{id: 'example', fromSec: 0, toSec: 3, intent, data: intent === 'intro' ? INTRO_BEAT : structuredClone(semanticTemplateData[intent])}]});
  const briefs = {};
  for (const purpose of EDITOR_PURPOSES) for (const tone of EDITOR_TONES) briefs[`combo:${purpose}/${tone}`] = brief({purpose, tone});
  for (const family of SEMANTIC_PROBES) briefs[`beat:${family}`] = brief({intent: family});
  briefs['recent'] = brief({recentStyles: ['section-deck', 'split-canvas', 'kinetic-paper']});
  briefs['explicit'] = brief({style: 'liquid-glass'});
  briefs['saved'] = brief({preferences: {...defaultPreferences(), style: {mode: 'fixed', value: 'paper-collage'}}});
  const cases = {};
  for (const [name, input] of Object.entries(briefs)) {
    const result = recommendEditorStyle(input);
    // The record compares only the styles it names. A style registered later may win a live recommendation (for example
    // when the leaders were used recently), so the winner and its reasons come from the recorded candidates, unless the
    // case pins a style explicitly or through saved preferences.
    const recorded = result.candidates.filter((candidate) => ids.includes(candidate.style));
    const lead = result.explicit ? result : recorded[0];
    cases[name] = {style: lead.style, explicit: result.explicit, reasons: lead.reasons, candidates: recorded};
  }
  return plain(cases);
}

// --- lists, derived only from behaviour ------------------------------------------------------------

const CAPTION_WORDS = Array.from({length: 12}, (_, i) => ({text: i === 5 ? 'word.' : 'word', startMs: i * 260, endMs: i * 260 + 200, confidence: 1}));
const captionShape = (style, grouping) => compileEdit({style, source: {fps: 30}, segments: [{fromFrame: 0, toFrame: 120}],
  captions: {words: CAPTION_WORDS, ...(grouping === undefined ? {} : {grouping})}}).captionGroups.map((group) => group.words.length).join(',');

function fitTables(cases) {
  const purposeFit = {}, toneFit = {}, eligibility = {};
  for (const purpose of EDITOR_PURPOSES) {
    // A score equal to the unlisted default (4 content points) is treated as unlisted.
    purposeFit[purpose] = Object.fromEntries(cases[`combo:${purpose}/calm`].candidates.filter((c) => c.contentScore !== 4).map((c) => [c.style, c.contentScore]));
  }
  for (const tone of EDITOR_TONES) {
    toneFit[tone] = Object.fromEntries(cases[`combo:explainer/${tone}`].candidates.filter((c) => c.toneScore !== 0).map((c) => [c.style, c.toneScore]));
  }
  for (const family of SEMANTIC_PROBES) for (const candidate of cases[`beat:${family}`].candidates) if (candidate.semanticScore) (eligibility[candidate.style] ??= []).push(family);
  return {purposeFit, toneFit, eligibility};
}

function captureLists(ids, themes, cases) {
  if (captionShape(ids[0], 'clauses') === captionShape(ids[0], 'compact')) throw new Error('The caption probe cannot tell clause grouping from compact grouping.');
  const brand = {primary: '#4D8DFF', accent: '#FFB020', background: null, text: null};
  const lists = {styleIds: [...ids], labels: {}, profiles: {}, defaults: {}, pip: {}, brand: {}, mixProfiles: {}};
  for (const id of ids) {
    lists.labels[id] = STYLE_LABELS[id];
    lists.profiles[id] = getStyleProfile(id);
    const resolved = resolvePreferences(defaultPreferences(), {purpose: 'explainer', tone: 'calm', style: id});
    lists.defaults[id] = {
      font: resolved.fontFamily,
      captionsPresentation: resolved.captionsPresentation,
      clauseCaptions: captionShape(id) === captionShape(id, 'clauses'),
      staticCaptions: captionEmphasisIssues(id, 3, [{sourceIndex: 0, kind: 'pop'}]).length > 0,
    };
    lists.pip[id] = pipAllowed(id);
    const branded = applyBrandToScenes(id, brand, []);
    lists.brand[id] = {applied: branded.brand !== undefined, notices: branded.notices};
    const mix = normalizeMixOptions({video: 'state/tmp/baseline-in.mp4', out: 'state/tmp/baseline-out.mp4', style: id}).styleProfile;
    if (mix) lists.mixProfiles[id] = mix;
  }
  lists.staticCaptionStyles = ids.filter((id) => lists.defaults[id].staticCaptions);
  lists.brandStyles = ids.filter((id) => lists.brand[id].applied);
  lists.legacyStyles = ids.filter((id) => themes[id].grammar === undefined);
  return plain({...lists, ...fitTables(cases)});
}

// --- palettes and sound plans ----------------------------------------------------------------------

async function assembledPalettes() {
  const sfx = await import(pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'sfx-events.mjs')).href);
  return sfx.loadStylePalettes();
}

// The assembled palette object, limited to the recorded styles: { version, provenance, cueKinds, styles }.
async function capturePalettes(ids) {
  const assembled = await assembledPalettes();
  return plain({version: assembled.version, provenance: assembled.provenance, cueKinds: assembled.cueKinds,
    styles: Object.fromEntries(ids.map((id) => [id, assembled.styles[id]]))});
}

// A hash of each style's palette after the sound catalog recipes are resolved into it.
async function captureResolvedPalettes(ids) {
  const resolved = {};
  for (const id of ids) resolved[id] = canonicalHash(await loadStylePalette(id));
  return resolved;
}

// One scene per cue shape, so every cue kind (transition, stamp, swap, click, count, reveal, type) is planned.
const SOUND_SCENES = [
  {id: 'open', family: 'intro', fromFrame: 0, durationInFrames: 60, data: {}},
  {id: 'hook', family: 'kinetic-hook', fromFrame: 60, durationInFrames: 90, data: {swapFrame: 20, stampFrame: 45}},
  {id: 'steps', family: 'checklist', fromFrame: 150, durationInFrames: 90, data: {items: [{atFrame: 8}, {atFrame: 34}, {atFrame: 60}]}},
  {id: 'figure', family: 'count', fromFrame: 240, durationInFrames: 90, data: {rollFrame: 6, unitFrame: 40, badge: 'Example', badgeFrame: 56}},
  {id: 'lens', family: 'token-lens', fromFrame: 330, durationInFrames: 90, data: {groups: [{atFrame: 8}, {atFrame: 30}], lens: {atFrame: 52}}},
  {id: 'meter', family: 'meter-receipt', fromFrame: 420, durationInFrames: 60, data: {rows: [{atFrame: 8}, {atFrame: 30}]}},
  {id: 'offer', family: 'ticket-offer', fromFrame: 480, durationInFrames: 60, data: {ticket: {atFrame: 14}}},
  {id: 'evidence', family: 'evidence-wipe', fromFrame: 540, durationInFrames: 60, data: {revealFrame: 20}},
  {id: 'typed', family: 'kinetic-text', fromFrame: 600, durationInFrames: 40, data: {}},
  {id: 'invite', family: 'creator-cta', fromFrame: 640, durationInFrames: 60, data: {followFrame: 20, clickedFrame: 44}},
  {id: 'screen', family: 'screen-recording', fromFrame: 700, durationInFrames: 100, data: {clicks: [{atFrame: 20}], callouts: [{atFrame: 40}]}},
];

async function captureSoundPlans(ids) {
  const cues = editCues({scenes: SOUND_SCENES, transitions: [{atFrame: 300, kind: 'whiteout', durationInFrames: 12}]});
  const styles = {};
  for (const id of ids) {
    const plan = planSfxEvents(cues, await loadStylePalette(id), {fps: 30, durationInFrames: 840, signoffFromFrame: 810});
    styles[id] = {events: plan.events, decisions: plan.decisions};
  }
  return plain({cues, styles});
}

// --- rendered markup -------------------------------------------------------------------------------

const SETTLED = 200;
const demo = (id, family, layout, data, durationInFrames = 240) => ({id, family, layout, motion: 'land', fromFrame: 0, durationInFrames, data: structuredClone(data)});
// The kinetic families have no shipped template, so these generic demos are the baseline's own.
const KINETIC_DEMOS = {
  'kinetic-hook': ['presenter', {label: 'THE QUESTION', firstTitle: 'One clear idea', secondTitle: 'Told in two beats', swapFrame: 45, stamp: 'EXAMPLE', stampFrame: 70}],
  'image-compare': ['takeover', {kicker: 'COMPARE', title: 'Two supplied images', images: [{src: 'examples/evidence-before.svg', label: 'Before'}, {src: 'examples/evidence-after.svg', label: 'After'}], stamp: 'EXAMPLE'}],
  checklist: ['takeover', {kicker: 'CHECKLIST', title: 'Three things to check', variant: 'missing', items: [{label: 'First check', detail: 'Short detail', atFrame: 10}, {label: 'Second check', detail: 'Short detail', atFrame: 30}, {label: 'Third check', detail: 'Short detail', atFrame: 50}]}],
  count: ['split', {kicker: 'THE NUMBER', title: 'A supplied figure', value: 42, suffix: '%', unit: 'of the sample', rollFrame: 10, rollDuration: 30, unitFrame: 50, badge: 'EXAMPLE', badgeFrame: 60}],
  screens: ['takeover', {kicker: 'SCREENS', steps: [{atFrame: 0, title: 'First screen', src: 'examples/evidence-before.svg', kind: 'image', fit: 'contain', trimBeforeFrame: 0}, {atFrame: 50, title: 'Second screen', src: 'examples/evidence-after.svg', kind: 'image', fit: 'contain', trimBeforeFrame: 0}]}],
  statement: ['presenter', {kicker: 'THE POINT', title: 'One sentence that matters'}],
  outcome: ['split', {kicker: 'RESULT', title: 'What you get', items: ['First result', 'Second result', 'Third result'], footer: 'Supplied by the creator'}],
  'creator-cta': ['presenter', {title: 'Want the full guide?', keyword: 'guide', prompt: 'Comment {keyword} and I will send it', handle: '@example.handle', followFrame: 40, clickedFrame: 70}],
};

function markupDemos() {
  const demos = [];
  for (const family of sceneFamilies) {
    const data = creativeGalleryDefaults[family];
    demos.push({key: `classic:${family}:takeover@12`, scene: demo(family, family, 'takeover', data), frame: 12});
    demos.push({key: `classic:${family}:takeover`, scene: demo(family, family, 'takeover', data), frame: SETTLED});
    demos.push({key: `classic:${family}:split`, scene: demo(family, family, 'split', data), frame: SETTLED});
  }
  for (const [family, data] of Object.entries(semanticTemplateData)) {
    if (family !== 'motion-concept') demos.push({key: `semantic:${family}`, scene: demo(family, family, 'takeover', data), frame: SETTLED});
  }
  for (const [family, [layout, data]] of Object.entries(KINETIC_DEMOS)) demos.push({key: `kinetic:${family}`, scene: demo(family, family, layout, data), frame: SETTLED});
  for (const entry of CATALOG) {
    demos.push({key: `concept:${entry.id}`, scene: demo(`concept-${entry.id}`, 'motion-concept', 'takeover', {concept: entry.id, config: catalogDemo(entry.id)}, entry.defaultFrames),
      frame: conceptSettledFrame(entry.id, 'once', entry.defaultFrames)});
  }
  return demos;
}

// A semantic, kinetic, screen or library scene whose data fails its schema falls through SceneLayer and
// renders an empty string, and the hash of nothing would pass without testing that family. Real scenes
// render hundreds of characters at least, so a short result is a broken demo.
const MIN_MARKUP_LENGTH = 100;
function recordMarkup(html, key, style) {
  if (html.length < MIN_MARKUP_LENGTH) throw new Error(`Baseline demo ${key} rendered no markup for ${style}; fix the demo data before recording.`);
  return sha256(html);
}

function captureMarkup(renderer, ids) {
  const demos = markupDemos();
  const galleryFrames = [1, 2].map((index) => index * creativeGalleryDefaults.framesPerScene + 2);
  const markup = {};
  for (const style of ids) {
    markup[style] = {};
    for (const {key, scene, frame} of demos) markup[style][key] = recordMarkup(renderer.renderScene({scene, style, frame}), key, style);
    for (const frame of galleryFrames) markup[style][`gallery:${frame}`] = recordMarkup(renderer.renderGallery({style, frame}), `gallery:${frame}`, style);
  }
  return markup;
}

// --- schema parses ---------------------------------------------------------------------------------

// What a failed parse leaves in the record: issue codes and paths only. zod's messages list every allowed
// style and scene family, so their text would change when a style is added.
const failureOutline = (error) => Array.isArray(error?.issues)
  ? {failed: error.issues.map((issue) => ({code: issue.code, path: issue.path.join('.')}))}
  : {failed: String(error?.message ?? error)};
const recordParse = (outcome) => ({ok: outcome.failed === undefined, sha256: canonicalHash(outcome)});

// The normalised parse of every template and demo scene of the markup section (style plays no part in a
// parse) and of every shipped example specification.
async function captureParses(examples) {
  const parses = {};
  for (const {key, scene} of markupDemos()) {
    const result = editSceneSchema.safeParse(scene);
    parses[`scene:${key.replace(/@\d+$/, '')}`] = recordParse(result.success ? {parsed: result.data} : failureOutline(result.error));
  }
  for (const name of examples) {
    const raw = JSON.parse(await fs.readFile(path.join(ROOT, 'instructions', 'examples', ...name.split('/')), 'utf8'));
    let outcome;
    try { outcome = {parsed: normalizeGraphicsSpec(raw)}; } catch (error) { outcome = failureOutline(error); }
    parses[`example:${name}`] = recordParse(outcome);
  }
  return parses;
}

// --- public API ------------------------------------------------------------------------------------

export async function captureStyleBaselines({styles = [...STYLE_IDS], examples = EXAMPLE_SPECS} = {}) {
  const ids = STYLE_IDS.filter((id) => styles.includes(id));
  if (ids.length !== styles.length) throw new Error(`Unknown styles in the baseline request: ${styles.filter((id) => !ids.includes(id)).join(', ')}`);
  const renderer = await createFrameRenderer();
  const themes = Object.fromEntries(ids.map((id) => [id, plain(renderer.theme(id))]));
  const geometry = Object.fromEntries(ids.map((id) => [id, Object.fromEntries(['split', 'takeover'].map((layout) => [layout, plain(renderer.geometry(id, layout))]))]));
  const recommendations = await captureRecommendations(ids);
  return plain({
    version: 1,
    styles: ids,
    lists: captureLists(ids, themes, recommendations),
    themes,
    geometry,
    palettes: await capturePalettes(ids),
    resolvedPalettes: await captureResolvedPalettes(ids),
    recommendations,
    soundPlans: await captureSoundPlans(ids),
    markup: captureMarkup(renderer, ids),
    parses: await captureParses(examples),
  });
}

async function main() {
  const args = process.argv.slice(2);
  const outAt = args.indexOf('--out');
  const target = path.resolve(ROOT, outAt >= 0 ? args[outAt + 1] ?? '' : path.relative(ROOT, BASELINE_FILE));
  if (!target.startsWith(`${ROOT}${path.sep}`)) throw new Error('--out must name a file inside the studio folder.');
  if (!args.includes('--force') && await fs.stat(target).then(() => true, () => false)) {
    throw new Error(`${path.relative(ROOT, target)} already exists. It is the frozen record of the eleven original styles; do not overwrite it. Use --out to write a copy elsewhere.`);
  }
  const result = await captureStyleBaselines();
  await fs.mkdir(path.dirname(target), {recursive: true});
  await fs.writeFile(target, `${JSON.stringify(result, null, 2)}\n`);
  const hashes = Object.values(result.markup).reduce((sum, entries) => sum + Object.keys(entries).length, 0);
  console.log(JSON.stringify({ok: true, file: path.relative(ROOT, target).split(path.sep).join('/'), styles: result.styles.length, markupHashes: hashes, parses: Object.keys(result.parses).length, soundCues: result.soundPlans.cues.length}));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
