import {z} from 'zod';

export const MAGAZINE_FAMILIES = ['verdict'] as const;
const frame = z.number().int().min(0).max(4320000);
const copy = (max:number) => z.string().min(1).max(max).regex(/\S/, 'Text cannot be blank');
const row = z.object({label:copy(28),value:z.number().finite().min(0),outOf:z.number().finite().min(0),atFrame:frame}).strict()
  .refine(value => value.value <= value.outOf, 'Score must be between zero and outOf');
export const magazineSceneVariants = [z.object({
  id:z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),fromFrame:frame,durationInFrames:frame.min(1),
  layout:z.literal('takeover'),motion:z.enum(['land','stagger','quiet']),family:z.literal('verdict'),
  data:z.object({question:copy(64),rows:z.array(row).min(2).max(4),verdict:copy(48),verdictFrame:frame}).strict(),
})] as const;
const magazineSceneUnion = z.discriminatedUnion('family',magazineSceneVariants);
export type MagazineScene = z.infer<typeof magazineSceneUnion>;
export const magazineSceneSchema = magazineSceneUnion.superRefine((scene,ctx) => {
  for(const message of validateMagazineTiming(scene))ctx.addIssue({code:'custom',message});
});
export type VerdictScene = MagazineScene;

// Kept separate from variants for the shared style-scene discriminated union.
export function validateMagazineTiming(scene:MagazineScene, _fps=30):string[] {
  const issues:string[] = [];
  const cues = [...scene.data.rows.map(row=>row.atFrame),scene.data.verdictFrame];
  for(let i=0;i<cues.length;i++) {
    if(cues[i] >= scene.durationInFrames)issues.push(`${scene.id}: activations must be inside the scene`);
    if(i>0 && cues[i] <= cues[i-1])issues.push(`${scene.id}: row activations and verdict must be strictly ordered`);
  }
  return issues;
}
