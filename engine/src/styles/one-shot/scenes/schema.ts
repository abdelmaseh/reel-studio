import {z} from 'zod';
import {CLOSING_LIMIT, MAX_JOBS, MAX_OPTIONS, MAX_STEPS, MAX_TYPED_WORDS, ONE_SHOT_FAMILIES, chainIssues, closingColumn, oneShotMinFrames} from './math.ts';

export {ONE_SHOT_FAMILIES};
export type OneShotFamily = (typeof ONE_SHOT_FAMILIES)[number];

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const frame = z.number().int().min(0).max(4320000);
const copy = (max: number) => z.string().min(1).max(max).regex(/\S/, 'Text cannot be blank');
const word = z.string().min(1).max(14).regex(/^\S+$/, 'A word cannot contain spaces');
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB colour');
const base = z.object({
  id, fromFrame: frame, durationInFrames: frame.min(1),
  layout: z.enum(['split', 'takeover']), motion: z.enum(['land', 'stagger', 'quiet']),
});

// Every step has a two-line title: the first line is white (or ink on an accent world), the second takes the accent.
const title = z.object({top: copy(26), bottom: copy(26)}).strict();
const dropStep = z.object({kind: z.literal('drop'), title, item: copy(28), target: copy(14)}).strict();
const fieldStep = z.object({kind: z.literal('field'), title, text: copy(48), placeholder: copy(24)}).strict();
const toggleStep = z.object({
  kind: z.literal('toggle'), title,
  options: z.array(z.object({label: copy(26), on: z.boolean().default(true)}).strict()).min(1).max(MAX_OPTIONS),
}).strict();
const statStep = z.object({
  kind: z.literal('stat'), title, value: z.number().finite().min(0).max(99999), decimals: z.number().int().min(0).max(2).default(0),
  unit: copy(12), label: copy(30),
}).strict();
const workStep = z.object({kind: z.literal('work'), title, jobs: z.array(copy(26)).min(2).max(MAX_JOBS), file: copy(28).optional()}).strict();
const step = z.discriminatedUnion('kind', [dropStep, fieldStep, toggleStep, statStep, workStep]);

const chainData = z.object({
  accent: color.optional(),
  brand: copy(24),
  intro: z.object({top: copy(24), bottom: copy(24), sub: copy(48), start: copy(16)}).strict(),
  steps: z.array(step).min(1).max(MAX_STEPS),
  result: z.object({words: z.array(word).min(4).max(6)}).strict(),
  closing: z.object({top: copy(24), sub: copy(40), platforms: z.array(copy(16)).min(1).max(3)}).strict(),
}).strict();

export const oneShotSceneVariants = [
  base.extend({family: z.literal('one-shot'), layout: z.literal('takeover'), data: chainData}),
] as const;
export const oneShotSceneSchema = z.discriminatedUnion('family', oneShotSceneVariants);
export type OneShotScene = z.infer<typeof oneShotSceneSchema>;
export type OneShotData = OneShotScene['data'];
export type OneShotStep = OneShotData['steps'][number];

const words = (text: string): number => text.split(/\s+/).filter(Boolean).length;

/** Everything the schema cannot say: the colour grammar, the typed sentence, the height of the closing words and the scene length. */
export function validateOneShotTiming(scene: OneShotScene, fps = 30): string[] {
  const issues = chainIssues(scene.data.steps).map((message) => `${scene.id}: ${message}`);
  scene.data.steps.forEach((step, index) => {
    if (step.kind !== 'field') return;
    const attached = scene.data.steps[index - 1]?.kind === 'drop';
    if (words(step.text) > MAX_TYPED_WORDS) issues.push(`${scene.id}: step ${index + 1} types at most ${MAX_TYPED_WORDS} words`);
    const room = attached ? 22 : 34;
    if (step.text.length > room) issues.push(`${scene.id}: step ${index + 1} types at most ${room} characters${attached ? ' beside the file name' : ''}`);
  });
  const column = closingColumn(scene.data.closing);
  if (column.bottom > CLOSING_LIMIT) {
    const levers: string[] = [];
    if (column.headlineLines > 1) levers.push('shorten the headline');
    if (column.subLines > 1) levers.push('shorten the sub to one line');
    if (column.chipRows > 1) levers.push('drop a platform');
    const advice = levers.length > 1 ? `${levers.slice(0, -1).join(', ')} or ${levers[levers.length - 1]}` : levers[0] ?? 'shorten the closing text';
    issues.push(`${scene.id}: closing text would end at y=${column.bottom}, limit ${CLOSING_LIMIT}: ${advice}`);
  }
  const need = oneShotMinFrames(scene.data, fps);
  if (scene.durationInFrames < need) issues.push(`${scene.id}: this chain needs at least ${need} frames (${(need / fps).toFixed(1)} s at ${fps} fps) and the scene lasts ${scene.durationInFrames}`);
  return issues;
}
