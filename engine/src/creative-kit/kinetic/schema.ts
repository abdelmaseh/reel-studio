import {z} from "zod";
import {CLIP_MAX_STEPS,clipValueShape} from "../../core/clip-schema.ts";
import {publicAssetSchema} from "../../core/public-asset.ts";

// The definition lives in core/ with the clip schema; the other scene schemas keep importing it from here.
export {publicAssetSchema};
const text=(max:number)=>z.string().min(1).max(max).regex(/\S/);
const frame=z.number().int().min(0).max(4320000);
export const foregroundSchema=z.object({src:publicAssetSchema,sourceSha256:z.string().regex(/^[a-f0-9]{64}$/),sourceFromFrame:frame,frames:frame.min(1),trimBeforeFrame:frame.default(0)}).strict();
const base=z.object({id:z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),fromFrame:frame,durationInFrames:frame.min(1),layout:z.enum(['presenter','split','takeover']),motion:z.enum(['land','stagger','quiet'])});
const title={kicker:text(80),title:text(140)};
const windowScreens=z.object({look:z.literal('window').optional(),kicker:text(60),steps:z.array(z.object({atFrame:frame,title:text(100),src:publicAssetSchema,kind:z.enum(['image','video']).default('image'),fit:z.enum(['cover','contain']).default('contain'),trimBeforeFrame:frame.default(0)}).strict()).min(1).max(6)}).strict();
const brollStep=z.object({atFrame:frame,...clipValueShape,label:text(60).optional()}).strict().meta({'x-reel-clip':true});
const brollScreens=z.object({look:z.literal('broll'),steps:z.array(brollStep).min(1).max(CLIP_MAX_STEPS)}).strict();
export const kineticSceneVariants=[
  base.extend({family:z.literal('kinetic-hook'),layout:z.literal('presenter'),data:z.object({label:text(80),firstTitle:text(36),secondTitle:text(36),swapFrame:frame,stamp:text(80),stampFrame:frame,foreground:foregroundSchema.optional()}).strict()}),
  base.extend({family:z.literal('image-compare'),layout:z.literal('takeover'),data:z.object({...title,images:z.array(z.object({src:publicAssetSchema,label:text(35)}).strict()).length(2),stamp:text(35)}).strict()}),
  base.extend({family:z.literal('checklist'),layout:z.literal('takeover'),data:z.object({...title,variant:z.enum(['missing','blueprint']),label:text(80).optional(),image:publicAssetSchema.optional(),items:z.array(z.object({label:text(70),detail:text(40),atFrame:frame}).strict()).min(1).max(5)}).strict()}),
  base.extend({family:z.literal('count'),layout:z.literal('split'),data:z.object({...title,value:z.number().int().min(0).max(999999),suffix:z.string().max(8),unit:text(45),rollFrame:frame,rollDuration:frame.min(1),unitFrame:frame,badge:text(40).optional(),badgeFrame:frame.optional(),valueFit:z.enum(['rolling','final']).optional()}).strict()}),
  base.extend({family:z.literal('screens'),layout:z.enum(['takeover','split']),data:z.union([windowScreens,brollScreens])})
    .superRefine((scene,ctx)=>{if(scene.layout==='split'&&scene.data.look!=='broll')ctx.addIssue({code:'custom',message:'Only the B-roll look of screens supports the split layout',path:['layout']});}),
  base.extend({family:z.literal('statement'),layout:z.literal('presenter'),data:z.object(title).strict()}),
  base.extend({family:z.literal('outcome'),layout:z.literal('split'),data:z.object({...title,items:z.array(text(40)).min(1).max(6),footer:text(80)}).strict()}),
  base.extend({family:z.literal('creator-cta'),layout:z.literal('presenter'),data:z.object({title:text(80),keyword:text(20),prompt:text(80),handle:z.string().regex(/^@[A-Za-z0-9_.]{1,30}$/),followFrame:frame,clickedFrame:frame}).strict()}),
] as const;
export const kineticSceneSchema=z.discriminatedUnion('family',kineticSceneVariants);
export type KineticScene=z.infer<typeof kineticSceneSchema>;
export type Foreground=z.infer<typeof foregroundSchema>;

export function validateKineticTiming(scene:KineticScene):string[]{
  const issues:string[]=[];
  const inside=(n:number,label:string)=>{if(n>=scene.durationInFrames)issues.push(`${scene.id}: ${label} must land inside its scene`);};
  const ordered=(values:number[],strict=false)=>{let last=-1;for(const value of values){inside(value,'activation');if(value<last || (strict && value===last))issues.push(`${scene.id}: activations must be ${strict?'strictly ':''}ordered`);last=value;}};
  switch(scene.family){
    case 'kinetic-hook':{
      inside(scene.data.swapFrame,'swap');inside(scene.data.stampFrame,'stamp');
      const fg=scene.data.foreground;if(fg && fg.trimBeforeFrame+scene.durationInFrames>fg.frames)issues.push(`${scene.id}: foreground does not cover the scene`);break;
    }
    case 'checklist':ordered(scene.data.items.map(i=>i.atFrame));break;
    case 'count':inside(scene.data.rollFrame,'count');inside(scene.data.rollFrame+scene.data.rollDuration,'count end');inside(scene.data.unitFrame,'unit');if(scene.data.badgeFrame!==undefined)inside(scene.data.badgeFrame,'badge');break;
    case 'screens':{
      const steps:{atFrame:number}[]=scene.data.steps;
      ordered(steps.map(s=>s.atFrame),true);
      if(steps[0].atFrame!==0)issues.push(`${scene.id}: first screen must start at zero`);
      break;
    }
    case 'creator-cta':ordered([scene.data.followFrame,scene.data.clickedFrame]);break;
  }
  return issues;
}

export function kineticAssets(scene:KineticScene):string[]{
  switch(scene.family){
    case 'kinetic-hook':return scene.data.foreground?[scene.data.foreground.src]:[];
    case 'image-compare':return scene.data.images.map(i=>i.src);
    case 'checklist':return scene.data.image?[scene.data.image]:[];
    case 'screens':{const steps:{src:string}[]=scene.data.steps;return steps.map(s=>s.src);}
    default:return [];
  }
}
