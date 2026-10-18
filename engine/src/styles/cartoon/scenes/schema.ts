import {z} from 'zod';
import {publicAssetSchema} from '../../../creative-kit/kinetic/schema.ts';
import {HANDLE_PATTERN} from '../../../prepared-edit/creator.ts';
import {CARTOON_FAMILIES, FLIP, ICONS, SHAPES, THEMES, groundOf, resolveCartoonTimeline, wordIndex, type Timeline, type WordLike} from './math.ts';
import {characterIssues, DEFAULT_CHARACTER} from './character.ts';
import type {GlideAssetClaim} from '../../grid-glide/scenes/schema.ts';

export {CARTOON_FAMILIES};
export type CartoonFamily = (typeof CARTOON_FAMILIES)[number];

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const frame = z.number().int().min(0).max(4320000);
const copy = (max: number) => z.string().min(1).max(max).regex(/\S/, 'Text cannot be blank');
const latin = (max: number) => z.string().min(1).max(max).regex(/^[\x20-\x7E]+$/, 'Latin text only');
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB colour');
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const anchor = z.object({word: z.number().int().min(0).max(19999), dt: z.number().min(-2).max(2).optional()}).strict();
const icon = z.enum(ICONS);
const shape = z.enum(SHAPES);
const base = z.object({id, fromFrame: frame, durationInFrames: frame.min(1), layout: z.literal('takeover'), motion: z.enum(['land', 'stagger', 'quiet'])});

// ---- character (the Node-safe module holds the rules; zod only shapes the object) ----
export const characterSchema = z.object({
  skin: hex,
  hair: z.object({style: z.enum(['short', 'quiff', 'long', 'none']), color: hex}).strict(),
  headwear: z.object({kind: z.enum(['none', 'hijab', 'cap']), color: hex}).strict(),
  beard: z.object({kind: z.enum(['none', 'full']), color: hex}).strict(),
  glasses: z.object({kind: z.enum(['none', 'rect']), frame: hex}).strict(),
  eyes: z.object({iris: hex}).strict(),
  outfit: z.object({kind: z.enum(['tee', 'overshirt']), top: hex, base: hex}).strict(),
}).strict().superRefine((value, ctx) => { for (const message of characterIssues(value)) ctx.addIssue({code: 'custom', message}); });

// ---- cards ----
const clip = z.object({src: publicAssetSchema, sha256, width: z.number().int().min(2).max(16384), height: z.number().int().min(2).max(16384), kind: z.enum(['image', 'video'])}).strict();
const side = z.object({name: copy(14), tag: copy(12).optional()}).strict();
const cardOf = <K extends string, D extends z.ZodType>(kind: K, data: D) =>
  z.object({id, kind: z.literal(kind), from: anchor, to: z.union([anchor, z.literal('flip')]), data}).strict();
const cardVariants = [
  cardOf('term', z.object({tag: copy(16).optional(), term: copy(16), glyphs: z.array(shape).max(3).default([])}).strict()),
  cardOf('windows', z.object({left: side, right: side, linkLabel: copy(12).optional(), rightAt: anchor.optional(), leftAt: anchor.optional(), linkAt: anchor.optional()}).strict()),
  cardOf('fan', z.object({items: z.array(z.object({name: copy(14), icon, shape: shape.optional()}).strict()).min(2).max(4), caption: copy(24).optional(), hitAt: z.array(anchor).max(4).optional()}).strict()),
  cardOf('code', z.object({filename: latin(24), lines: z.array(z.object({text: latin(34), at: anchor}).strict()).min(1).max(4), prefixLen: z.number().int().min(0).max(12).optional()}).strict()),
  cardOf('link', z.object({left: z.object({icon, label: copy(14)}).strict(), right: z.object({tag: copy(12).optional(), label: copy(14), shape: shape.optional()}).strict(), stamp: copy(14).optional(), rightAt: anchor.optional(), stampAt: anchor.optional(), leftAt: anchor.optional(), cableAt: anchor.optional()}).strict()),
  cardOf('grid', z.object({items: z.array(z.object({icon, name: copy(12)}).strict()).min(3).max(6), picked: z.number().int().min(0).max(5), command: latin(34).optional(), pickAt: anchor.optional(), runAt: anchor.optional()}).strict()
    .refine((d) => d.picked < d.items.length, 'picked must be one of the items')),
  cardOf('crossed', z.object({title: copy(28), tiles: z.number().int().min(4).max(8), lit: z.number().int().min(0).max(7), crossAt: anchor.optional()}).strict()
    .refine((d) => d.lit < d.tiles, 'lit must be one of the tiles')),
  cardOf('stack', z.object({layers: z.array(z.object({text: copy(16), shapes: z.array(shape).max(3).optional(), tone: z.enum(['light', 'ink'])}).strict()).length(2), stamp: copy(14).optional(), arrowLabel: copy(8).optional(), dropAt: anchor.optional(), stampAt: anchor.optional(), arrowAt: anchor.optional()}).strict()),
  cardOf('nodes', z.object({nodes: z.array(z.object({icon: icon.optional(), text: copy(8).optional(), label: copy(14)}).strict().refine((n) => (n.icon === undefined) !== (n.text === undefined), 'A node shows an icon or a short text')).min(2).max(3), rings: z.boolean().default(false), at: z.array(anchor).max(3).optional(), ringsAt: anchor.optional()}).strict()),
  cardOf('morph', z.object({items: z.array(z.object({shape}).strict()).min(2).max(3), beforeLabel: copy(14), afterLabel: copy(14), equalsBefore: copy(10).optional(), equalsAfter: copy(10).optional(), morphAt: anchor.optional(), oneAt: anchor.optional()}).strict()),
  cardOf('monitor', z.object({clip, trimBeforeFrame: frame.optional(), crop: z.object({x: z.number().int().min(0), y: z.number().int().min(0), w: z.number().int().min(16)}).strict(), label: copy(24)}).strict()),
  cardOf('timer', z.object({label: copy(16)}).strict()),
] as const;
const card = z.discriminatedUnion('kind', cardVariants);

const place = z.object({at: anchor, x: z.number().min(0).max(1080), scale: z.number().min(0.7).max(1.1)}).strict();
const gesture = z.object({
  at: anchor, arm: z.enum(['r', 'l', 'auto']).default('auto'), kind: z.enum(['point', 'open', 'thumb', 'fist', 'wave', 'rest']),
  anchor: z.union([z.object({card: id, point: z.string().min(1).max(16)}).strict(), z.literal('camera'), z.object({x: z.number(), y: z.number()}).strict()]).optional(),
  brow: z.number().min(-1).max(1).optional(), tilt: z.number().min(-6).max(6).optional(), look: z.union([z.literal('camera'), z.object({x: z.number(), y: z.number()}).strict()]).optional(),
}).strict();
const sentences = z.array(z.object({from: z.number().int().min(0), to: z.number().int().min(0)}).strict().refine((s) => s.to >= s.from && s.to - s.from < 12, 'A sentence holds 1 to 12 words')).min(1).max(60);
const counter = z.union([z.null(), z.object({kind: z.literal('sections')}).strict(), z.object({kind: z.literal('seconds'), total: z.number().int().min(5).max(999), saidAt: anchor, stop: anchor, label: latin(10).optional()}).strict()]);
const tail = z.object({at: anchor}).strict();
const accents = z.array(z.number().int().min(0)).max(120).default([]);

const bodyData = z.object({
  character: characterSchema.default(DEFAULT_CHARACTER),
  acts: z.array(z.object({theme: z.enum(THEMES), sentence: z.number().int().min(0), tag: copy(24)}).strict()).min(2).max(6),
  sentences, accents, counter: counter.default({kind: 'sections'}), brackets: z.boolean().default(true),
  cards: z.array(card).max(30), places: z.array(place).max(40).optional(), gestures: z.array(gesture).max(120).optional(), tail: tail.optional(),
}).strict();

const endingData = z.object({
  character: characterSchema.default(DEFAULT_CHARACTER),
  fromTheme: z.enum(THEMES), theme: z.enum(THEMES), tag: copy(24), entrance: z.object({x: z.number().min(0).max(1080), scale: z.number().min(0.7).max(1.1)}).strict(),
  sentences, accents,
  comment: z.object({keyword: copy(20), promise: copy(60).optional(), at: anchor}).strict().optional(),
  follow: z.object({handle: z.string().regex(HANDLE_PATTERN), message: copy(40), at: anchor, tapAt: anchor, shareAt: anchor.optional()}).strict().optional(),
  tail: tail.optional(), places: z.array(place).max(10).optional(), gestures: z.array(gesture).max(30).optional(),
}).strict().superRefine((d, ctx) => {
  if (!d.comment && !d.follow) ctx.addIssue({code: 'custom', message: 'an ending needs a comment part, a follow part or both'});
  if (groundOf(d.fromTheme) === groundOf(d.theme)) ctx.addIssue({code: 'custom', message: 'fromTheme and theme must differ in ground: the ending opens with a reveal'});
});

export const cartoonSceneVariants = [
  base.extend({family: z.literal('cartoon'), data: bodyData}),
  base.extend({family: z.literal('cartoon-ending'), data: endingData}),
] as const;
export const cartoonSceneSchema = z.discriminatedUnion('family', cartoonSceneVariants);
export type CartoonScene = z.infer<typeof cartoonSceneSchema>;
export type CartoonBodyScene = Extract<CartoonScene, {family: 'cartoon'}>;
export type CartoonEndingScene = Extract<CartoonScene, {family: 'cartoon-ending'}>;
export type CartoonData = CartoonBodyScene['data'];
export type CartoonEndingData = CartoonEndingScene['data'];
export type CartoonCard = CartoonData['cards'][number];

/** Everything the schema cannot say without the words: word-free structural checks only. */
export function validateCartoonTiming(scene: CartoonScene, fps = 30): string[] {
  const issues: string[] = [];
  if (scene.family === 'cartoon') {
    if (scene.data.cards.some((c) => c.kind === 'timer') && scene.data.counter?.kind !== 'seconds') issues.push(`${scene.id}: a timer card needs a seconds counter`);
    for (const c of scene.data.cards) if (c.kind === 'monitor') {
      const {clip: file, crop} = c.data;
      const h = Math.round((crop.w * 9) / 22);
      if (crop.x + crop.w > file.width || crop.y + h > file.height) issues.push(`${scene.id}: card ${c.id} crop ${crop.x},${crop.y},${crop.w} (window ${crop.w}x${h}) leaves the ${file.width}x${file.height} file`);
      if (880 / crop.w > 1.25 + 1e-9) issues.push(`${scene.id}: card ${c.id} enlarges the capture ${(880 / crop.w).toFixed(2)}x; the limit is 1.25 (crop wider)`);
    }
    for (const a of scene.data.accents) if (!scene.data.sentences.some((s) => a >= s.from && a <= s.to)) issues.push(`${scene.id}: accent word ${a} is not inside a sentence`);
  } else {
    const {comment, follow} = scene.data;
    if (comment && follow && comment.at.word >= follow.at.word) issues.push(`${scene.id}: the comment part must come before the follow part`);
    if (follow && follow.tapAt.word < follow.at.word) issues.push(`${scene.id}: the follow tap cannot come before the card`);
    if (follow?.shareAt && follow.shareAt.word < follow.tapAt.word) issues.push(`${scene.id}: the share ring cannot come before the tap`);
  }
  void fps;
  return issues;
}

/** The body or the ending as a timeline (the ending is one act with its own sentences and no cards). */
export function timelineOf(scene: CartoonScene, words: readonly WordLike[], fps: number): Timeline {
  if (scene.family === 'cartoon') return resolveCartoonTimeline(scene.data, scene, words, fps);
  const d = scene.data;
  return resolveCartoonTimeline({acts: [{theme: d.theme, sentence: 0, tag: d.tag}], sentences: d.sentences, accents: d.accents, counter: {kind: 'sections'}, brackets: false, cards: [], tail: d.tail}, scene, words, fps);
}

/** The word-anchored checks: sentences tile the words, flips lead their sentences, cards and counters resolve. */
export function validateCartoonWords(scene: CartoonScene, words: readonly WordLike[], fps: number): string[] {
  const tl = timelineOf(scene, words, fps);
  const issues = tl.issues.map((m) => `${scene.id}: ${m}`);
  if (scene.family === 'cartoon-ending') {
    const first = tl.sentences[0];
    if (first && first.words.length) {
      const lead = first.startFrame / fps;
      if (lead < FLIP.min - 1e-9 || lead > FLIP.max + 1e-9) issues.push(`${scene.id}: the ending's reveal (its first frame) leads its first sentence by ${lead.toFixed(2)} s; move the scene start so the lead is ${FLIP.min}..${FLIP.max} s (the flip rule)`);
    }
    const end = scene.fromFrame + scene.durationInFrames;
    const index = wordIndex(words.filter((w) => w.fromFrame >= scene.fromFrame && w.fromFrame < end));
    const parts: [string, {word: number} | undefined][] = [['comment.at', scene.data.comment?.at], ['follow.at', scene.data.follow?.at], ['follow.tapAt', scene.data.follow?.tapAt], ['follow.shareAt', scene.data.follow?.shareAt]];
    for (const [name, at] of parts) if (at && !index.has(at.word)) issues.push(`${scene.id}: ${name} word ${at.word} is not inside this scene`);
  } else {
    const end = scene.fromFrame + scene.durationInFrames;
    const index = wordIndex(words.filter((w) => w.fromFrame >= scene.fromFrame && w.fromFrame < end));
    for (const p of scene.data.places ?? []) if (!index.has(p.at.word)) issues.push(`${scene.id}: place at word ${p.at.word} is not inside this scene`);
    const ids = new Set(tl.cards.map((c) => c.id));
    for (const g of scene.data.gestures ?? []) {
      if (!index.has(g.at.word)) issues.push(`${scene.id}: gesture at word ${g.at.word} is not inside this scene`);
      if (g.anchor && typeof g.anchor === 'object' && 'card' in g.anchor && !ids.has(g.anchor.card)) issues.push(`${scene.id}: gesture anchor names card ${g.anchor.card}, which is not in this scene`);
    }
  }
  return issues;
}

/** Rules that need the neighbours: the ending starts exactly where the body ends, from the body's last theme and place. */
export function cartoonSequenceIssues(scenes: readonly {id: string; family: string; fromFrame: number; durationInFrames: number; data?: unknown}[]): string[] {
  const issues: string[] = [];
  scenes.forEach((scene, i) => {
    if (scene.family !== 'cartoon-ending') return;
    const prev = scenes[i - 1];
    const ending = scene.data as {fromTheme: string; entrance: {x: number; scale: number}};
    if (!prev || prev.family !== 'cartoon') { issues.push(`${scene.id}: a cartoon ending must follow a cartoon body scene`); return; }
    if (prev.fromFrame + prev.durationInFrames !== scene.fromFrame) issues.push(`${scene.id}: the ending must start where the cartoon body ends (frame ${prev.fromFrame + prev.durationInFrames})`);
    const bodyData = prev.data as {acts: {theme: string}[]; places?: {x: number; scale: number}[]};
    const lastTheme = bodyData.acts.at(-1)?.theme;
    if (lastTheme !== ending.fromTheme) issues.push(`${scene.id}: fromTheme must equal the body's last act theme (${lastTheme})`);
    const lastPlace = bodyData.places?.at(-1);
    if (lastPlace && (lastPlace.x !== ending.entrance.x || lastPlace.scale !== ending.entrance.scale)) issues.push(`${scene.id}: entrance must equal the body's last place (${lastPlace.x}, ${lastPlace.scale})`);
  });
  return issues;
}

type MonitorCard = Extract<CartoonCard, {kind: 'monitor'}>;
const monitorCards = (scene: CartoonScene): MonitorCard[] => (scene.family === 'cartoon' ? scene.data.cards.filter((c): c is MonitorCard => c.kind === 'monitor') : []);
export const cartoonAssets = (scene: CartoonScene): string[] => [...new Set(monitorCards(scene).map((c) => c.data.clip.src))];
export {cartoonVideoSources} from './media.ts';
export function cartoonAssetClaims(scene: CartoonScene): GlideAssetClaim[] {
  return monitorCards(scene).map((c) => ({src: c.data.clip.src, sha256: c.data.clip.sha256, width: c.data.clip.width, height: c.data.clip.height, kind: c.data.clip.kind, frames: (c.data.trimBeforeFrame ?? 0) + scene.durationInFrames}));
}
