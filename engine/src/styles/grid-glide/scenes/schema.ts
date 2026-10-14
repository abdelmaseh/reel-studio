import {z} from 'zod';
import {publicAssetSchema} from '../../../creative-kit/kinetic/schema.ts';
import {minFramesAtFps} from '../../../motion-concepts/timeline.ts';
import {HANDLE_PATTERN} from '../../../prepared-edit/creator.ts';
import {CADENCE, DIP, ENTER_FRAMES, EXIT_FRAMES, PILL, framesAtFps, pillStart, scale, wipeFrames} from './math.ts';
import {glideWords} from './text.ts';

export const GRID_GLIDE_FAMILIES = ['glide-chapter', 'glide-card', 'glide-lines', 'glide-comment', 'glide-follow'] as const;
export type GridGlideFamily = (typeof GRID_GLIDE_FAMILIES)[number];

// Frame budget. The motion law is authored at 30 fps: every count below is a 30 fps count and the validator scales it
// by fps / 30. Authored `at`, `heroAt` and `pillAt` are frames of the edit's own frame rate; a line's `cadence` is a
// rhythm in 30 fps frames (the kit scales it when it draws).
export const CUE_LEAD_FRAMES = 4;          // every cue begins at least this long before the exit begins
export const PUSH_FRAMES = EXIT_FRAMES;    // a push exit moves over the scene's last 15 frames
export const SLIDE_FRAMES = ENTER_FRAMES;  // a slide enter settles after 30 frames
export const DIP_FRAMES = DIP.before;      // a dip blurs the 5 frames before the boundary (and 5 after it)
export const CHAPTER_MIN_FRAMES = 60;      // the shortest chapter, scaled with minFramesAtFps
export const ENDING_HOLD_FRAMES = 24;      // an ending's last element is settled this long before the exit begins (scaled)

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const frame = z.number().int().min(0).max(4320000);
const cue = z.number().finite().min(0).max(4320000);
const copy = (max: number) => z.string().min(1).max(max).regex(/\S/, 'Text cannot be blank');
const phrase = (max: number, words: number) => copy(max).refine((text) => glideWords(text).length <= words, `Use at most ${words} words`);
const word = z.string().min(1).max(40).regex(/^\S+$/, 'A word cannot contain spaces');
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const dimension = z.number().int().min(1).max(16384);
const unit = z.number().finite().min(0).max(1);
const base = z.object({
  id, fromFrame: frame, durationInFrames: frame.min(1),
  layout: z.enum(['split', 'takeover']), motion: z.enum(['land', 'stagger', 'quiet']),
});

export const glideAssetSchema = z.object({src: publicAssetSchema, sha256, width: dimension, height: dimension}).strict();
export const glideClipSchema = z.object({
  at: frame, src: publicAssetSchema, sha256, width: dimension, height: dimension,
  kind: z.enum(['image', 'video']),
  scroll: z.object({from: unit, to: unit}).strict().optional(),
}).strict().superRefine((clip, ctx) => {
  if (clip.kind === 'video' && clip.scroll) ctx.addIssue({code: 'custom', message: 'Scroll applies to image clips only; a video plays as recorded'});
});
export const glideEnterSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('cut')}).strict(),
  z.object({kind: z.literal('slide'), from: z.enum(['left', 'right']), distance: z.literal([400, 500]).default(400)}).strict(),
  z.object({kind: z.literal('dip')}).strict(),
]);
export const glideExitSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('cut')}).strict(),
  z.object({kind: z.literal('push'), dir: z.enum(['left', 'right', 'up', 'down'])}).strict(),
  z.object({kind: z.literal('dip')}).strict(),
]);
export const glideLineSchema = z.object({
  words: z.array(word).min(1).max(6), role: z.enum(['lead', 'hero']), at: cue,
  cadence: z.number().finite().min(4).max(9).default(7),
}).strict();
export const glideBoxSchema = z.object({text: phrase(60, 6), at: cue}).strict();
export const glideBulletSchema = z.object({text: phrase(48, 5), at: cue}).strict();

const watermark = copy(40).optional();
const chapterData = z.object({
  ordinal: phrase(30, 2), heroAt: cue,
  pill: z.object({label: copy(24), logo: glideAssetSchema.optional()}).strict().optional(), pillAt: cue.optional(),
  enter: glideEnterSchema, exit: glideExitSchema, watermark,
}).strict();
const cardData = z.object({
  lines: z.array(glideLineSchema).max(4), box: glideBoxSchema.optional(),
  media: z.object({clips: z.array(glideClipSchema).min(1).max(6)}).strict(),
  bullets: z.array(glideBulletSchema).max(4).default([]),
  enter: glideEnterSchema, exit: glideExitSchema, watermark,
}).strict();
const linesData = z.object({
  lines: z.array(glideLineSchema).min(1).max(5), box: glideBoxSchema.optional(), grid: z.boolean().default(false),
  enter: glideEnterSchema, exit: glideExitSchema, watermark,
}).strict();

// The comment CTA: lead-in lines, the keyword as the hero, and an optional promise box that wipes in after it. The keyword
// must equal the profile's CTA word (a profile CTA holds up to 20 characters); three words keep it one glance.
const commentData = z.object({
  lines: z.array(glideLineSchema).min(1).max(3), keyword: phrase(20, 3), heroAt: cue, box: glideBoxSchema.optional(),
  enter: glideEnterSchema, exit: glideExitSchema, watermark,
}).strict();
// The follow card: optional lead-in lines, the complete profile handle as the hero, and the FOLLOW pill (no logo, so no tile).
const followData = z.object({
  lines: z.array(glideLineSchema).max(2).default([]), handle: z.string().regex(HANDLE_PATTERN, 'Use a complete @handle, up to 30 characters'),
  heroAt: cue, pill: z.object({label: copy(24)}).strict(), pillAt: cue.optional(),
  enter: glideEnterSchema, exit: glideExitSchema, watermark,
}).strict();

// `motion` is carried for manifest compatibility; Grid Glide has one motion law and ignores it.
export const gridGlideSceneVariants = [
  base.extend({family: z.literal('glide-chapter'), layout: z.literal('takeover'), data: chapterData}),
  base.extend({family: z.literal('glide-card'), layout: z.literal('takeover'), data: cardData}),
  base.extend({family: z.literal('glide-lines'), layout: z.literal('takeover'), data: linesData}),
  base.extend({family: z.literal('glide-comment'), layout: z.literal('takeover'), data: commentData}),
  base.extend({family: z.literal('glide-follow'), layout: z.literal('takeover'), data: followData}),
] as const;
export const gridGlideSceneSchema = z.discriminatedUnion('family', gridGlideSceneVariants);

export type GridGlideScene = z.infer<typeof gridGlideSceneSchema>;
export type GlideAsset = z.infer<typeof glideAssetSchema>;
export type GlideClip = z.infer<typeof glideClipSchema>;
export type GlideEnter = z.infer<typeof glideEnterSchema>;
export type GlideExit = z.infer<typeof glideExitSchema>;
export type GlideLine = z.infer<typeof glideLineSchema>;
export type GlideBox = z.infer<typeof glideBoxSchema>;
export type GlideBullet = z.infer<typeof glideBulletSchema>;
export type GlideChapterData = Extract<GridGlideScene, {family: 'glide-chapter'}>['data'];
export type GlideCardData = Extract<GridGlideScene, {family: 'glide-card'}>['data'];
export type GlideLinesData = Extract<GridGlideScene, {family: 'glide-lines'}>['data'];
export type GlideCommentData = Extract<GridGlideScene, {family: 'glide-comment'}>['data'];
export type GlideFollowData = Extract<GridGlideScene, {family: 'glide-follow'}>['data'];

/** First frame of the pill slide: `pillAt`, else `heroAt + 14.75` at 30 fps, scaled to the edit frame rate. */
export const glideChapterPillAt = (data: {heroAt: number; pillAt?: number}, fps = 30): number => pillStart(data.heroAt, data.pillAt, fps);

/** First frame of the exit: `duration - 15` for a push and `duration - 5` for a dip (scaled by fps / 30), `duration` for a cut. */
const exitStart = (scene: GridGlideScene, fps: number): number => {
  const exit = scene.data.exit, total = scene.durationInFrames;
  return exit.kind === 'push' ? total - scale(PUSH_FRAMES, fps) : exit.kind === 'dip' ? total - scale(DIP_FRAMES, fps) : total;
};

const shown = (value: number): string => String(Math.round(value * 100) / 100);

export function validateGridGlideTiming(scene: GridGlideScene, fps = 30): string[] {
  const issues: string[] = [], name = scene.id, total = scene.durationInFrames, stop = exitStart(scene, fps);
  const lead = scale(CUE_LEAD_FRAMES, fps), latest = stop - lead;
  const {enter, exit} = scene.data;
  const pushMin = framesAtFps(PUSH_FRAMES, fps), slideMin = framesAtFps(SLIDE_FRAMES, fps), dipMin = framesAtFps(DIP_FRAMES, fps);
  if (exit.kind === 'push' && total < pushMin) issues.push(`${name}: a push exit needs at least ${pushMin} frames at ${fps} fps`);
  if (enter.kind === 'slide' && total < slideMin) issues.push(`${name}: a slide enter needs at least ${slideMin} frames at ${fps} fps`);
  if ((enter.kind === 'dip' || exit.kind === 'dip') && total < dipMin) issues.push(`${name}: a dip needs at least ${dipMin} frames at ${fps} fps`);
  // An entering and a leaving motion never overlap: the scene is long enough for both, one after the other.
  const enterLength = enter.kind === 'slide' ? slideMin : enter.kind === 'dip' ? dipMin : 0;
  const exitLength = exit.kind === 'push' ? pushMin : exit.kind === 'dip' ? dipMin : 0;
  if (enterLength > 0 && exitLength > 0 && total >= Math.max(enterLength, exitLength) && total < enterLength + exitLength) {
    issues.push(`${name}: a ${enter.kind} enter and a ${exit.kind} exit need at least ${enterLength + exitLength} frames at ${fps} fps so the two motions never overlap`);
  }
  const inside = (at: number, label: string): boolean => {
    if (at < total) return true;
    issues.push(`${name}: ${label} must land inside its scene`);
    return false;
  };
  // A cue (a word start, the box, the pill) begins at least 4 frames (scaled) before the exit begins. It may still be settling then.
  const cue = (at: number, label: string) => {
    if (!inside(at, label)) return;
    if (at > latest) issues.push(`${name}: ${label} starts at frame ${shown(at)} but the ${exit.kind} exit starts at frame ${shown(stop)}; every cue must begin at least ${shown(lead)} frames before the exit (latest start: frame ${shown(latest)})`);
  };
  const ordered = (values: readonly number[], label: string, strict = false) => {
    values.forEach((value, index) => {
      if (index > 0 && (strict ? value <= values[index - 1] : value < values[index - 1])) issues.push(`${name}: ${label} must be ${strict ? 'strictly ' : ''}ordered`);
    });
  };
  const checkLines = (lines: readonly GlideLine[]) => {
    lines.forEach((line, index) => cue(line.at + (line.words.length - 1) * scale(line.cadence, fps), `the last word of line ${index + 1}`));
    ordered(lines.map((line) => line.at), 'line cues');
  };
  const checkBox = (box: GlideBox | undefined) => {
    if (box) cue(box.at, 'the box');
  };
  // A row of `count` words that starts at `at` has settled once its last word has risen: `at` + steps + the 30 frame entrance (scaled).
  const settles = (at: number, count: number, step: number): number => at + (count - 1) * scale(step, fps) + scale(ENTER_FRAMES, fps);
  // An ending is the last thing the viewer reads: its last element rests for 24 frames (scaled) before the exit begins.
  const hold = (finish: number) => {
    const rest = scale(ENDING_HOLD_FRAMES, fps);
    if (finish + rest > stop) issues.push(`${name}: the ending must hold its last element for at least ${shown(rest)} frames before the exit; it finishes at frame ${shown(finish)} but the ${exit.kind} exit starts at frame ${shown(stop)}`);
  };
  switch (scene.family) {
    case 'glide-chapter': {
      const data = scene.data, minimum = minFramesAtFps(CHAPTER_MIN_FRAMES, fps);
      if (total < minimum) issues.push(`${name}: a chapter needs at least ${minimum} frames at ${fps} fps`);
      cue(data.heroAt + (glideWords(data.ordinal).length - 1) * scale(CADENCE.stack, fps), 'the last ordinal word');
      if (data.pillAt !== undefined && !data.pill) issues.push(`${name}: pillAt needs a pill`);
      if (data.pill) {
        const start = glideChapterPillAt(data, fps);
        if (start < data.heroAt) issues.push(`${name}: the pill cannot start before the ordinal`);
        cue(start, 'the pill');
      }
      break;
    }
    case 'glide-card': {
      const data = scene.data, clips = data.media.clips;
      checkLines(data.lines);
      checkBox(data.box);
      if (clips[0].at !== 0) issues.push(`${name}: the first media clip must start at frame 0 so the card is never empty`);
      ordered(clips.map((clip) => clip.at), 'media clips', true);
      clips.forEach((clip) => inside(clip.at, 'a media clip'));
      data.bullets.forEach((bullet, index) => {
        cue(bullet.at + (glideWords(bullet.text).length - 1) * scale(CADENCE.bullet, fps), `the last word of bullet ${index + 1}`);
      });
      ordered(data.bullets.map((bullet) => bullet.at), 'bullet cues', true);
      break;
    }
    case 'glide-lines':
      checkLines(scene.data.lines);
      checkBox(scene.data.box);
      break;
    case 'glide-comment': {
      const data = scene.data, words = glideWords(data.keyword).length;
      checkLines(data.lines);
      const leadIn = data.lines.at(-1);
      if (leadIn && data.heroAt < leadIn.at) issues.push(`${name}: the keyword cannot start before its lead-in lines`);
      cue(data.heroAt + (words - 1) * scale(CADENCE.stack, fps), 'the last keyword word');
      checkBox(data.box);
      if (data.box && data.box.at < data.heroAt) issues.push(`${name}: the box cannot start before the keyword`);
      hold(Math.max(
        ...data.lines.map((line) => settles(line.at, line.words.length, line.cadence)),
        settles(data.heroAt, words, CADENCE.stack),
        data.box ? data.box.at + wipeFrames(glideWords(data.box.text).length, fps) : 0,
      ));
      break;
    }
    case 'glide-follow': {
      const data = scene.data, start = glideChapterPillAt(data, fps);
      checkLines(data.lines);
      const leadIn = data.lines.at(-1);
      if (leadIn && data.heroAt < leadIn.at) issues.push(`${name}: the handle cannot start before its lead-in lines`);
      cue(data.heroAt, 'the handle');
      if (start < data.heroAt) issues.push(`${name}: the pill cannot start before the handle`);
      cue(start, 'the pill');
      hold(Math.max(
        ...data.lines.map((line) => settles(line.at, line.words.length, line.cadence)),
        settles(data.heroAt, 1, CADENCE.stack),
        start + scale(PILL.slide.frames, fps),
      ));
      break;
    }
  }
  return issues;
}

type Sequenced = {id: string; family: string; fromFrame: number; durationInFrames: number};

/** Scenes must be ordered. A dip is a pair: the exit blur of one scene and the enter blur of the next. */
export function gridGlideDipIssues(scenes: readonly Sequenced[]): string[] {
  const issues: string[] = [];
  const parsed = scenes.map((scene) => { const result = gridGlideSceneSchema.safeParse(scene); return result.success ? result.data : null; });
  scenes.forEach((_, index) => {
    const here = parsed[index];
    if (!here) return;
    if (here.data.exit.kind === 'dip') {
      const next = scenes[index + 1], following = parsed[index + 1];
      if (!next || next.fromFrame !== here.fromFrame + here.durationInFrames) issues.push(`${here.id}: a dip exit must be followed immediately by the next scene`);
      else if (!following || following.data.enter.kind !== 'dip') issues.push(`${here.id}: a dip exit needs the next scene to be a Grid Glide scene that enters with a dip`);
    }
    if (here.data.enter.kind === 'dip' && here.fromFrame > 0) {
      const previous = parsed[index - 1];
      const joined = previous != null && previous.fromFrame + previous.durationInFrames === here.fromFrame && previous.data.exit.kind === 'dip';
      if (!joined) issues.push(`${here.id}: a dip enter must follow a Grid Glide scene that exits with a dip`);
    }
  });
  return issues;
}

/** What preparation must verify on disk: declared hash, size and (for clips) how long a video has to play. */
export type GlideAssetClaim = {src: string; sha256: string; width: number; height: number; kind: 'image' | 'video'; frames: number};

export function gridGlideAssetClaims(scene: GridGlideScene): GlideAssetClaim[] {
  if (scene.family === 'glide-chapter') {
    const logo = scene.data.pill?.logo;
    return logo ? [{...logo, kind: 'image', frames: 0}] : [];
  }
  if (scene.family === 'glide-card') {
    const clips = scene.data.media.clips;
    return clips.map((clip, index) => ({
      src: clip.src, sha256: clip.sha256, width: clip.width, height: clip.height, kind: clip.kind,
      frames: (clips[index + 1]?.at ?? scene.durationInFrames) - clip.at,
    }));
  }
  return [];
}

export function gridGlideAssets(scene: GridGlideScene): string[] {
  return [...new Set(gridGlideAssetClaims(scene).map((claim) => claim.src))];
}
