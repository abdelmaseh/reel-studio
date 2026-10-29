import {z} from 'zod';
import {publicAssetSchema} from '../creative-kit/kinetic/schema.ts';
import {refineSceneSticker,sceneStickerSchema} from '../creative-kit/stickers.ts';
import {BACKDROP_KINDS} from '../looks/index.ts';
import {kashidaSlots} from '../arabic/kashida.ts';

export const ARABIC_TYPE_MOVES = ['dots-drop','pen-write','letters-snap','kufi-tiles','kashida-stretch',
  'decrypt','echo-stack','redacted-stamp','word-melt','video-in-letters','unblur'] as const;
export type ArabicTypeMove = typeof ARABIC_TYPE_MOVES[number];
const rasterMoves: readonly string[] = ['dots-drop','letters-snap','kufi-tiles','kashida-stretch'];
const copy = z.string().min(1).max(160).regex(/\S/, 'Supply authored text');
export const arabicTypeDataSchema = z.object({
  text:copy, move:z.enum(ARABIC_TYPE_MOVES), accent:z.string().regex(/^#[a-fA-F0-9]{6}$/).optional(),
  font:z.string().min(1).max(80).regex(/^[\w -]+$/).optional(), media:publicAssetSchema.optional(),
  stamp:z.string().min(1).max(24).optional(), to:copy.optional(), backdrop:z.enum(['plain',...BACKDROP_KINDS]).optional(),
  sticker:sceneStickerSchema.optional(),
}).strict().superRefine((data,ctx) => {
  if (data.move === 'word-melt' && !data.to) ctx.addIssue({code:'custom',path:['to'],message:'Supply the destination word'});
  if (data.move === 'video-in-letters' && !data.media) ctx.addIssue({code:'custom',path:['media'],message:'Supply a named source clip'});
  if (data.move === 'video-in-letters' && data.media && !/\.(mp4|webm|mov)$/i.test(data.media)) ctx.addIssue({code:'custom',path:['media'],message:'Media must be a video clip'});
  const word = data.text.trim(), words = word.split(/\s+/).length;
  // kashida-stretch draws in a fixed-width area: a second word leaves the bar no room to grow, so the line would render unstretched.
  if (data.move === 'kashida-stretch' && words > 1) {
    ctx.addIssue({code:'custom',path:['text'],message:`kashida-stretch stretches one word: use a single word, or pick another move for a phrase (this text has ${words} words)`});
    return;
  }
  // The move lengthens the word's best joint (arabic/kashida.ts); a word without one would render as plain, unmoving text.
  if (data.move === 'kashida-stretch' && kashidaSlots(word).length === 0) {
    ctx.addIssue({code:'custom',path:['text'],message:`kashida-stretch finds no place to stretch "${word}": it needs an Arabic word of three letters or more with two connected letters whose joint can lengthen, like جميل; pick another word, or another move`});
  }
  if (rasterMoves.includes(data.move) && (Array.from(data.text).length > 40 || words > 3)) {
    ctx.addIssue({code:'custom',path:['text'],message:'Letter moves support up to 40 characters and three words'});
  }
});
const frame=z.number().int().min(0).max(4320000);
export const arabicTypeSceneVariants = [z.object({id:z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  family:z.literal('arabic-type'), fromFrame:frame, durationInFrames:frame.min(1), layout:z.literal('takeover'),
  motion:z.enum(['land','stagger','quiet']), data:arabicTypeDataSchema}).superRefine(refineSceneSticker)] as const;
export const arabicTypeSceneSchema=arabicTypeSceneVariants[0];
export type ArabicTypeData=z.infer<typeof arabicTypeDataSchema>;
export type ArabicTypeScene=z.infer<typeof arabicTypeSceneSchema>;
export const arabicTypeTemplateData = {text:'اكتب فكرتك',move:'decrypt'} as const;
export const ARABIC_TYPE_LABELS: Record<ArabicTypeMove,string> = {
  'dots-drop':'النقط بتنزل','pen-write':'القلم بيكتب','letters-snap':'الحروف بتتلم','kufi-tiles':'بلاط كوفي',
  'kashida-stretch':'الكشيدة',decrypt:'فك الشفرة','echo-stack':'صدى الكلمة','redacted-stamp':'مشطوب وختم',
  'word-melt':'كلمة بتدوب في كلمة','video-in-letters':'فيديو جوه الحروف',unblur:'الكلام بيوضح',
};
