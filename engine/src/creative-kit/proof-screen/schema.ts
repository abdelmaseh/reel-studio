import {z} from 'zod';
import {publicAssetSchema} from '../../core/public-asset.ts';

const copy=(max:number)=>z.string().min(1).max(max).regex(/\S/);
const frame=z.number().int().min(0).max(4320000);
// Project-owned stills only. A path names the asset; preparation verifies the actual file bytes.
const image=publicAssetSchema.refine(src=>/^projects\/[a-z0-9][a-z0-9-]{0,63}\/(?:[^/]+\/)*[^/]+\.(png|jpe?g|webp|svg)$/i.test(src),'Use a named image under projects/<project-id>/');
export const proofBlockSchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('heading'),text:copy(70)}).strict(),
  z.object({kind:z.literal('text'),text:copy(120)}).strict(),
  z.object({kind:z.literal('stat'),text:copy(45).optional(),value:z.number().finite().min(-999999999).max(999999999)}).strict(),
  z.object({kind:z.literal('button'),text:copy(45)}).strict(),
  z.object({kind:z.literal('image'),src:image,text:copy(60).optional()}).strict(),
  z.object({kind:z.literal('row'),text:copy(90),value:z.number().finite().min(-999999999).max(999999999).optional()}).strict(),
]);
export const proofScreenDataSchema=z.object({
  page:z.enum(['web','chat','dashboard']),title:copy(70).optional(),url:copy(100).optional(),
  blocks:z.array(proofBlockSchema).min(1).max(10),focus:z.number().int().min(0).optional(),
  path:z.enum(['tilt-in','glide','focus']).optional(),
}).strict().superRefine((data,ctx)=>{
  if(data.focus!==undefined && data.focus>=data.blocks.length)ctx.addIssue({code:'custom',path:['focus'],message:'Focus must identify an authored block'});
});
export const proofScreenSceneVariants=[z.object({
  id:z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),family:z.literal('proof-screen'),fromFrame:frame,
  durationInFrames:frame.min(1),layout:z.literal('takeover'),motion:z.enum(['land','stagger','quiet']),data:proofScreenDataSchema,
})] as const;
export const proofScreenSceneSchema=z.discriminatedUnion('family',proofScreenSceneVariants);
export type ProofScreenSceneSpec=z.infer<typeof proofScreenSceneSchema>;
export type ProofScreenData=z.infer<typeof proofScreenDataSchema>;
export type ProofBlock=z.infer<typeof proofBlockSchema>;
export function proofScreenAssets(scene:ProofScreenSceneSpec):string[]{
  return [...new Set(scene.data.blocks.flatMap(block=>block.kind==='image'?[block.src]:[]))];
}
