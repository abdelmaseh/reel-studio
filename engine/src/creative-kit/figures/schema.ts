import {z} from 'zod';
import {refineSceneSticker,sceneStickerSchema} from '../stickers.ts';

const text=(max:number)=>z.string().min(1).max(max).regex(/\S/);
const number=z.number().finite().min(-999999999).max(999999999).refine(n=>Number(n.toFixed(6))===n,'Figures support at most six decimal places');
const positive=number.nonnegative();
const copy={unit:text(24).optional(),label:text(80).optional(),sticker:sceneStickerSchema.optional()};
export const FIGURE_VARIANTS=['counter','slot','bars','ring'] as const;
export const FIGURE_LABELS={counter:'عدّاد',slot:'أرقام سلوت',bars:'أعمدة',ring:'دايرة نسبة'} as const;
export const figuresDataSchema=z.discriminatedUnion('variant',[
  z.object({variant:z.literal('counter'),value:number,from:number.optional(),...copy}).strict(),
  z.object({variant:z.literal('slot'),value:positive.int(),from:positive.int().optional(),...copy}).strict(),
  z.object({variant:z.literal('bars'),bars:z.array(z.object({label:text(40),value:positive}).strict()).min(1).max(6),max:positive.positive().optional(),...copy}).strict()
    .superRefine((d,ctx)=>{if(d.max!==undefined && d.bars.some(b=>b.value>d.max!))ctx.addIssue({code:'custom',message:'Bar values cannot exceed max'});}),
  z.object({variant:z.literal('ring'),value:positive,max:positive.positive(),...copy}).strict()
    .superRefine((d,ctx)=>{if(d.value>d.max)ctx.addIssue({code:'custom',message:'Ring value cannot exceed max'});}),
]);
const frame=z.number().int().min(0).max(4320000);
export const figuresSceneVariants=[z.object({id:z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),family:z.literal('figures'),fromFrame:frame,durationInFrames:frame.min(1),layout:z.literal('takeover'),motion:z.enum(['land','stagger','quiet']),data:figuresDataSchema}).superRefine(refineSceneSticker)] as const;
export const figuresSceneSchema=z.discriminatedUnion('family',figuresSceneVariants);
export type FiguresData=z.infer<typeof figuresDataSchema>;
export type FiguresScene=z.infer<typeof figuresSceneSchema>;
