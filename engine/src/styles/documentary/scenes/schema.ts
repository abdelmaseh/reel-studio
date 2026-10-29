import {z} from 'zod';
import {publicAssetSchema} from '../../../core/public-asset.ts';
import world from '../../../maps/data/world.json' with {type: 'json'};
import type {GlideAssetClaim} from '../../grid-glide/scenes/schema.ts';

export const DOCUMENTARY_FAMILIES = ['map-route', 'map-focus', 'cutout-card'] as const;
const frame=z.number().int().min(0).max(4320000);
const copy=(max:number)=>z.string().min(1).max(max).regex(/\S/,'Text cannot be blank');
const point=z.object({name:copy(24),lon:z.number().min(-180).max(180),lat:z.number().min(-90).max(90)}).strict();
const city=z.union([point,z.object({name:copy(24)}).strict().refine(p=>world.places.some((city:{name_ar:string})=>city.name_ar===p.name),'Named city is absent from the installed map; provide reviewed lon/lat')]);
const bounds=z.tuple([z.number(),z.number(),z.number(),z.number()]).refine(b=>b.every(Number.isFinite)&&b[2]>b[0]&&b[3]>b[1]&&b[2]-b[0]<=360&&b[1]>=-90&&b[3]<=90,'Use ordered geographic bounds, at most 360 degrees wide');
const base=z.object({id:z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),fromFrame:frame,durationInFrames:frame.min(1),layout:z.literal('takeover'),motion:z.enum(['land','stagger','quiet'])});
const map={title:copy(64),caption:copy(110).optional(),borders:z.boolean().default(false),bounds:bounds.optional()};
const image=z.object({src:publicAssetSchema.refine(p=>/\.(png|jpe?g|webp|avif|svg)$/i.test(p),'A creator-named still image is required'),sha256:z.string().regex(/^[a-f0-9]{64}$/),width:z.number().int().min(2).max(16384),height:z.number().int().min(2).max(16384),kind:z.literal('image')}).strict();
export const documentarySceneVariants=[
  base.extend({family:z.literal('map-route'),data:z.object({...map,places:z.array(city).min(2).max(5),drawAt:frame.default(15),drawDuration:frame.min(1).default(75)}).strict()}),
  base.extend({family:z.literal('map-focus'),data:z.object({...map,target:z.union([city,z.object({country:copy(48)}).strict().refine(p=>world.countries.some((c:{name_ar:string})=>c.name_ar===p.country),'Named country is absent from the verified installed map')]),zoom:z.number().min(1).max(4).default(2),focusAt:frame.default(15),focusDuration:frame.min(1).default(60)}).strict()}),
  base.extend({family:z.literal('cutout-card'),data:z.object({title:copy(64),image,caption:copy(110),at:frame.default(10),credit:copy(80).optional(),fit:z.enum(['contain','cover']).default('contain'),tilt:z.number().min(-4).max(4).default(-2)}).strict()}),
] as const;
export const documentarySceneSchema=z.discriminatedUnion('family',documentarySceneVariants);
export type DocumentaryScene=z.infer<typeof documentarySceneSchema>;
export type MapRouteScene=Extract<DocumentaryScene,{family:'map-route'}>;
export type MapFocusScene=Extract<DocumentaryScene,{family:'map-focus'}>;
export type CutoutCardScene=Extract<DocumentaryScene,{family:'cutout-card'}>;
export function validateDocumentaryTiming(scene:DocumentaryScene,fps=30):string[]{
  const data=scene.data;const issues:string[]=[];const hold=Math.ceil(fps*.6);
  const finish=scene.family==='map-route'?scene.data.drawAt+scene.data.drawDuration:scene.family==='map-focus'?scene.data.focusAt+scene.data.focusDuration:scene.data.at+Math.ceil(fps*.4);
  if(finish+hold>scene.durationInFrames)issues.push(`${scene.id}: animation plus a 0.6 second resolved hold must fit inside the scene`);
  if('borders' in data && data.borders && world.mode!=='countries')issues.push(`${scene.id}: borders need a verified installed country dataset; use borders:false for the independent coastline fallback`);
  return issues;
}
export function documentaryAssets(scene:DocumentaryScene):string[]{return scene.family==='cutout-card'?[scene.data.image.src]:[];}
export function documentaryAssetClaims(scene:DocumentaryScene):GlideAssetClaim[]{return scene.family==='cutout-card'?[{...scene.data.image,frames:scene.durationInFrames}]:[];}
