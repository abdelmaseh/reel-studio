import {z} from 'zod';
import {refineSceneSticker,sceneStickerSchema} from '../stickers.ts';

const text=(max:number)=>z.string().min(1).max(max).regex(/\S/);
const frame=z.number().int().min(0).max(4320000);
export const CHAT_THREAD_VARIANTS=['bubbles','typing','notifications'] as const;
export const CHAT_THREAD_LABELS={bubbles:'فقاعات شات',typing:'بيكتب...',notifications:'إشعارات'} as const;
const copy={app:text(40).optional(),title:text(60).optional(),sticker:sceneStickerSchema.optional(),messages:z.array(z.object({from:z.enum(['me','them']),text:text(180),at:frame.optional()}).strict()).min(1).max(8)};
export const chatThreadDataSchema=z.discriminatedUnion('variant',[
  z.object({variant:z.literal('bubbles'),...copy}).strict(),
  z.object({variant:z.literal('typing'),...copy}).strict(),
  z.object({variant:z.literal('notifications'),...copy}).strict(),
]);
export const chatThreadSceneVariants=[z.object({id:z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),family:z.literal('chat-thread'),fromFrame:frame,durationInFrames:frame.min(1),layout:z.literal('takeover'),motion:z.enum(['land','stagger','quiet']),data:chatThreadDataSchema}).superRefine(refineSceneSticker)] as const;
export const chatThreadSceneSchema=z.discriminatedUnion('family',chatThreadSceneVariants);
export type ChatThreadData=z.infer<typeof chatThreadDataSchema>;
export type ChatThreadScene=z.infer<typeof chatThreadSceneSchema>;
