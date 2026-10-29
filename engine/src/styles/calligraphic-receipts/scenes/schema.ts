import {z} from 'zod';

export const RECEIPTS_FAMILIES = ['claim-proof'] as const;
const frame = z.number().int().min(0).max(4320000);
const copy = (max: number) => z.string().min(1).max(max).regex(/\S/, 'Text cannot be blank');
const amount = z.number().finite().min(0).max(999999).multipleOf(.01);
const row = z.object({label: copy(28), value: amount}).strict();

export const claimProofDataSchema = z.object({
  claim: z.array(copy(40).regex(/^\S+$/, 'Each claim item must be one whole word')).min(1).max(4),
  keyIndex: z.number().int().min(0).max(3),
  rows: z.tuple([row, row]),
  diff: row,
  unit: copy(16),
  note: copy(90),
  claimFrame: frame.default(4),
  receiptFrame: frame.default(14),
  totalFrame: frame.default(54),
}).strict().superRefine((data, ctx) => {
  if (data.keyIndex >= data.claim.length) ctx.addIssue({code: 'custom', path: ['keyIndex'], message: 'The key must identify a supplied whole word'});
  // Compare integer hundredths to avoid rejecting creator decimals such as .3 - .1 = .2.
  if (Math.round(data.diff.value * 100) !== Math.abs(Math.round(data.rows[0].value * 100) - Math.round(data.rows[1].value * 100))) {
    ctx.addIssue({code: 'custom', path: ['diff', 'value'], message: 'Difference must equal the absolute difference between the two supplied rows'});
  }
});

const base = z.object({id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/), fromFrame: frame,
  durationInFrames: frame.min(1), layout: z.literal('takeover'), motion: z.enum(['land', 'stagger', 'quiet'])});
export const receiptsSceneVariants = [base.extend({family: z.literal('claim-proof'), data: claimProofDataSchema})] as const;
export const receiptsSceneSchema = z.discriminatedUnion('family', receiptsSceneVariants);
export type ClaimProofScene = z.infer<typeof receiptsSceneSchema>;
export type ReceiptsScene = ClaimProofScene;

export function validateReceiptsTiming(scene: ReceiptsScene, fps = 30): string[] {
  const {claimFrame, receiptFrame, totalFrame, claim} = scene.data;
  const issues: string[] = [];
  if (receiptFrame < claimFrame || totalFrame < receiptFrame + 24) issues.push(`${scene.id}: claim, receipt and total cues must be ordered; receipt rows need 24 frames before counting`);
  const finish = Math.max(claimFrame + (claim.length - 1) * 14 + 20, receiptFrame + 56, totalFrame + 41);
  if (finish + Math.ceil(fps * .6) > scene.durationInFrames) issues.push(`${scene.id}: animation plus a 0.6 second resolved hold must fit inside the scene`);
  return issues;
}
export const RECEIPTS_COPY_KEYS: ReadonlySet<string> = new Set(['claim', 'label', 'unit', 'note']);
