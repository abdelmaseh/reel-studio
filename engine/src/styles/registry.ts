// The one ordered list of styles, and every list that used to be written by hand next to it.
//
// Node-safe: loads in plain Node with type stripping before `npm ci`. Keep explicit `.ts` import
// extensions, no JSX, no packages. Add a style by creating engine/src/styles/<id>/meta.ts and
// appending it to STYLE_METAS; instructions/STYLE-AUTHORING.md lists the remaining steps.
import sectionDeck from './section-deck/meta.ts';
import kineticPaper from './kinetic-paper/meta.ts';
import calligraphicReceipts from './calligraphic-receipts/meta.ts';
import paperCollage from './paper-collage/meta.ts';
import liquidGlass from './liquid-glass/meta.ts';
import magazineInterview from './magazine-interview/meta.ts';
import gridGlide from './grid-glide/meta.ts';
import oneShot from './one-shot/meta.ts';
import cartoon from './cartoon/meta.ts';
import documentary from './documentary/meta.ts';
import layeredSpeaker from './layered-speaker/meta.ts';
import {EDITOR_TONES, STYLE_USE_CASES, SHARED_SCENE_FAMILIES} from './types.ts';
import type {CaptionPresentation, EditorPurpose, EditorTone, MixProfile, PipPolicy, PreferredFont, StyleMeta} from './types.ts';

// Registry order is the old STYLE_IDS order: recommendation ties follow it, so a new style goes last.
export const STYLE_METAS = [
  sectionDeck, kineticPaper, calligraphicReceipts, paperCollage, liquidGlass,
  magazineInterview, gridGlide, oneShot, cartoon, documentary, layeredSpeaker,
] as const;

type Meta = (typeof STYLE_METAS)[number];
export type StyleId = Meta['id'];
export const STYLE_IDS = STYLE_METAS.map((meta) => meta.id) as unknown as readonly [StyleId, ...StyleId[]];

export const STYLE_ALIASES = Object.freeze({
  'split-canvas': 'section-deck',
  'scrapbook-route': 'documentary',
  'stepped-editorial': 'magazine-interview',
  'judgment-board': 'magazine-interview',
  'campaign-tickets': 'kinetic-paper',
} as const satisfies Record<string, StyleId>);

/** Only own keys are aliases. Unknown ids remain unknown, including prototype names. */
export function normalizeStyleId<T>(id: T, notice: (message: string) => void = console.warn): T | StyleId {
  if (typeof id !== 'string' || !Object.hasOwn(STYLE_ALIASES, id)) return id;
  const replacement = STYLE_ALIASES[id as keyof typeof STYLE_ALIASES];
  notice(styleAliasNotice(id)!);
  return replacement;
}

export function styleAliasNotice(id: unknown, language: 'en' | 'ar' = 'en'): string | null {
  if (typeof id !== 'string' || !Object.hasOwn(STYLE_ALIASES, id)) return null;
  const replacement = STYLE_ALIASES[id as keyof typeof STYLE_ALIASES];
  return language === 'ar' ? `الستايل ده اتدمج في ${replacement}.` : `Style "${id}" was merged into "${replacement}".`;
}

const METAS: readonly StyleMeta[] = STYLE_METAS;
const BY_ID = new Map<string, Meta>(STYLE_METAS.map((meta) => [meta.id, meta] as const));
if (BY_ID.size !== STYLE_METAS.length) throw new Error('styles/registry: two styles share an id.');

export const SCENE_FAMILIES: readonly string[] = [...SHARED_SCENE_FAMILIES, ...METAS.flatMap(meta => meta.ownScenes)];
const knownFamilies = new Set(SCENE_FAMILIES);
for (const meta of METAS) for (const family of meta.familiesOff ?? []) {
  if (!knownFamilies.has(family)) throw new Error(`styles/registry: ${meta.id} familiesOff contains unknown family ${family}.`);
  if (meta.ownScenes.includes(family)) throw new Error(`styles/registry: ${meta.id} familiesOff overlaps ownScenes: ${family}.`);
}

const idsWhere = (test: (meta: StyleMeta) => boolean): StyleId[] => METAS.filter(test).map((meta) => meta.id as StyleId);
const forEachStyle = <T>(read: (meta: StyleMeta) => T): Record<StyleId, T> =>
  Object.fromEntries(METAS.map((meta) => [meta.id, read(meta)])) as Record<StyleId, T>;

export function isStyleId(id: string): id is StyleId {
  return BY_ID.has(id);
}

export function getStyleMeta(id: string): Meta {
  const meta = BY_ID.get(normalizeStyleId(id));
  if (!meta) throw new Error(`Unknown style ${JSON.stringify(id)}. Choose one of: ${STYLE_IDS.join(', ')}.`);
  return meta;
}

/** Arabic label and description shown on the settings page. */
export function styleLabels(): Record<StyleId, {label: string; description: string}> {
  return forEachStyle((meta) => ({label: meta.label.ar, description: meta.description.ar}));
}

/** Unknown styles fall back to the original defaults (Cairo, pill, no clause grouping). */
export function defaultFontFor(style: string): PreferredFont {
  return BY_ID.get(normalizeStyleId(style))?.defaults.font ?? 'Cairo';
}
export function defaultCaptionsFor(style: string): CaptionPresentation {
  return BY_ID.get(normalizeStyleId(style))?.defaults.captionsPresentation ?? 'pill';
}
export function clauseCaptionsDefault(style: string): boolean {
  return BY_ID.get(normalizeStyleId(style))?.defaults.clauseCaptions ?? false;
}

/** Styles whose caption pills stay static, so the animated `pop` emphasis is refused. */
export function staticCaptionStyles(): StyleId[] {
  return idsWhere((meta) => meta.defaults.staticCaptions);
}

/** The styles whose meta says `legacy: true`; the type follows the metas, nothing is listed by hand. */
export type LegacyStyleId = Extract<Meta, {readonly legacy: true}>['id'];

/** Legacy styles keep their own token module and are not themed through the adapted-style table. */
export function isLegacyStyle(style: string): style is LegacyStyleId {
  return BY_ID.get(normalizeStyleId(style))?.legacy ?? false;
}

/** Styles that take the creator's brand colours. */
export function brandStyles(): StyleId[] {
  return idsWhere((meta) => meta.brand);
}

export function pipPolicies(): Record<StyleId, PipPolicy> {
  return forEachStyle((meta) => ({...meta.pip}));
}

/** Editorial points per purpose; a style that is not listed scores the director's default. */
export function purposeFit(): Record<EditorPurpose, Partial<Record<StyleId, number>>> {
  const table = Object.fromEntries(STYLE_USE_CASES.map((purpose) => [purpose, {}])) as Record<EditorPurpose, Partial<Record<StyleId, number>>>;
  for (const meta of METAS) {
    for (const [purpose, score] of Object.entries(meta.fit.purpose)) table[purpose as EditorPurpose][meta.id as StyleId] = score as number;
  }
  return table;
}

/** Points per tone; a style that is not listed scores the director's default. */
export function toneFit(): Record<EditorTone, Partial<Record<StyleId, number>>> {
  const table = Object.fromEntries(EDITOR_TONES.map((tone) => [tone, {}])) as Record<EditorTone, Partial<Record<StyleId, number>>>;
  for (const meta of METAS) {
    for (const [tone, score] of Object.entries(meta.fit.tone)) table[tone as EditorTone][meta.id as StyleId] = score as number;
  }
  return table;
}

/** Semantic beat families that earn a style the director's visual-grammar bonus. */
export function semanticEligibility(): Partial<Record<StyleId, string[]>> {
  const table: Partial<Record<StyleId, string[]>> = {};
  for (const meta of METAS) if (meta.fit.semanticBeats.length > 0) table[meta.id as StyleId] = [...meta.fit.semanticBeats];
  return table;
}

/** The style that owns a scene family, or undefined when the family is shared. */
export function ownSceneStyle(family: string): StyleId | undefined {
  return METAS.find((meta) => meta.ownScenes.includes(family))?.id as StyleId | undefined;
}

/** A style may opt out of a shared or owned family without changing its data schema. */
export function familySupported(style: string, family: string): boolean {
  return !((getStyleMeta(style) as StyleMeta).familiesOff ?? []).includes(family);
}

/** Measured loudness-range profiles; only styles with a recorded reference have one. */
export function mixProfiles(): Partial<Record<StyleId, MixProfile>> {
  const table: Partial<Record<StyleId, MixProfile>> = {};
  for (const meta of METAS) if (meta.mix) table[meta.id as StyleId] = {...meta.mix};
  return table;
}
