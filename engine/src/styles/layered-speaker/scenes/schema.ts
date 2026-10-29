import { z } from 'zod';
import { kashidaSlots } from '../../../arabic/kashida.ts';
import { roughDrawFrames } from '../../../creative-kit/marks/rough.ts';
import { foregroundSchema } from '../../../creative-kit/kinetic/schema.ts';
import { HERO_MARKS, LAYERED_FAMILIES, LIMITS, MARK_KINDS, PLACES, TIMING, frames, layeredMinFrames, type LayeredData } from './math.ts';

export { LAYERED_FAMILIES };
export type LayeredSceneFamily = (typeof LAYERED_FAMILIES)[number];

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const frame = z.number().int().min(0).max(4320000);
const copy = (max: number) => z.string().min(1).max(max).regex(/\S/, 'Text cannot be blank');

const word = z.object({
  place: z.enum(PLACES),
  text: copy(LIMITS.lineChars),
  atFrame: frame,
  accent: z.boolean().optional(),
  mark: z.object({ kind: z.enum(MARK_KINDS), atFrame: frame }).strict().optional(),
}).strict();

const base = z.object({
  id, fromFrame: frame, durationInFrames: frame.min(1),
  layout: z.literal('presenter'), motion: z.enum(['land', 'stagger', 'quiet']),
});

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿ]/;

export const layeredSceneVariants = [
  base.extend({
    family: z.literal('layered-speaker'),
    data: z.object({
      words: z.array(word).min(1).max(LIMITS.words),
      // The speaker cut out of the source (scripts/matte.mjs, or a creator-supplied alpha video). Words behind the head need it.
      foreground: foregroundSchema.optional(),
    }).strict(),
  }).superRefine((scene, ctx) => {
    const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: 'custom', message, path: ['data', ...path] });
    const places = new Set<string>();
    scene.data.words.forEach((entry, index) => {
      if (places.has(entry.place)) issue(`Only one word can sit ${entry.place}; place the others elsewhere.`, ['words', index, 'place']);
      places.add(entry.place);
      if (entry.place === 'behind') {
        if (entry.mark && !HERO_MARKS.includes(entry.mark.kind)) issue(`A ${entry.mark.kind} does not fit around the big word; mark it with ${HERO_MARKS.join(', ')} instead.`, ['words', index, 'mark', 'kind']);
        const text = entry.text.trim();
        if (/\s/.test(text) || text.length > LIMITS.behindChars) issue(`The word behind the head is one word of at most ${LIMITS.behindChars} letters.`, ['words', index, 'text']);
        else if (!ARABIC.test(text) || kashidaSlots(text).length === 0) {
          issue('The word behind the head needs a connection to stretch (an Arabic word of three letters or more with letters that join, like كبير). Put other words above or beside the head.', ['words', index, 'text']);
        }
      }
    });
    if (!scene.data.foreground && places.has('behind') && places.has('above')) {
      issue('Without a matte the big word goes above the head, so a second line above it has no room. Cut a matte (scripts/matte.mjs) or drop one of the two.', ['words']);
    }
    const marks = scene.data.words.filter((entry) => entry.mark);
    if (marks.length > LIMITS.marks) issue(`At most ${LIMITS.marks} hand-drawn marks per scene.`, ['words']);
  }),
] as const;

export const layeredSceneSchema = z.discriminatedUnion('family', layeredSceneVariants);
export type LayeredScene = z.infer<typeof layeredSceneSchema>;
export type LayeredSceneData = LayeredScene['data'];

/** Everything the schema cannot say: times inside the scene, a word kept long enough to read and a matte that covers the scene. */
export function validateLayeredTiming(scene: LayeredScene, fps = 30): string[] {
  const issues: string[] = [];
  const hold = frames(TIMING.holdSeconds, fps);
  scene.data.words.forEach((entry, index) => {
    const name = `word ${index + 1} (${entry.place})`;
    if (entry.atFrame + hold > scene.durationInFrames) issues.push(`${scene.id}: ${name} lands at frame ${entry.atFrame}; it needs ${hold} frames on screen before the scene ends`);
    if (entry.mark) {
      const draw = roughDrawFrames(entry.mark.kind, fps);
      if (entry.mark.atFrame < entry.atFrame) issues.push(`${scene.id}: the ${entry.mark.kind} on ${name} starts before the word lands`);
      if (entry.mark.atFrame + draw > scene.durationInFrames) issues.push(`${scene.id}: the ${entry.mark.kind} on ${name} needs ${draw} frames to draw and the scene ends first`);
    }
  });
  const need = layeredMinFrames(scene.data as LayeredData, fps);
  if (scene.durationInFrames < need) issues.push(`${scene.id}: these words need at least ${need} frames (${(need / fps).toFixed(1)} s at ${fps} fps) and the scene lasts ${scene.durationInFrames}`);
  const matte = scene.data.foreground;
  if (matte && matte.trimBeforeFrame + scene.durationInFrames > matte.frames) issues.push(`${scene.id}: foreground does not cover the scene`);
  return issues;
}

/** The files this scene mounts that are not part of the plate: the matte clip, when there is one. */
export function layeredAssets(scene: LayeredScene): string[] {
  return scene.data.foreground ? [scene.data.foreground.src] : [];
}
