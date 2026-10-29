import React from 'react';
import type {FamilyDesignProps} from '../styles/family-designs';
import {sceneCopy} from '../styles/scene-copy';
import {measure} from '../core/type';
import fontManifest from '../../public/fonts/manifest.template.json';
import {useDesignData, DesignDigitsScope} from './digits';

const warnings = new Set<string>();
export function designWarning(style:string, detail:unknown) {
  const message = style+' fit-warning: '+JSON.stringify(detail);
  if (!warnings.has(message)) {if(warnings.size>=256)warnings.clear();warnings.add(message);console.warn(message);}
}
/** Every visible event uses the scene clock. Invalid authoring warns and fits; it never throws. */
export function sceneTiming(length=600, style='design') {
  const end = Math.max(0,Number.isFinite(length)?Math.round(length)-1:599);
  const frame = (value:unknown, pilot:number) => {
    const requested = typeof value==='number' && Number.isFinite(value)?Math.round(value):pilot;
    const fitted = Math.max(0,Math.min(end,requested));
    if(value!==undefined && (fitted!==requested || typeof value!=='number' || !Number.isFinite(value)))designWarning(style,{timing:value,fitted});
    return fitted;
  };
  const duration = (value:unknown,pilot:number,at:number) => {
    const requested = typeof value==='number' && Number.isFinite(value)?Math.round(value):pilot;
    const fitted = Math.max(1,Math.min(Math.max(1,end-at),requested));
    if(value!==undefined && fitted!==requested)designWarning(style,{duration:value,at,fitted});
    return fitted;
  };
  return {frame,duration,end};
}
const FitEnabled=React.createContext(true);
export const useFitEnabled=()=>React.useContext(FitEnabled);
const Bounds=React.createContext(1150);
export const useDesignBottom=()=>React.useContext(Bounds);
const Timing = React.createContext(sceneTiming());
export const useTiming = () => React.useContext(Timing);
export function countTiming(d:any,t:ReturnType<typeof sceneTiming>,pilot:{roll:number;duration:number;unit:number;badge:number}) {
  const roll=t.frame(d.rollFrame,pilot.roll), duration=t.duration(d.rollDuration,pilot.duration,roll), end=roll+duration;
  return {roll,duration,end,unit:t.frame(d.unitFrame,end+pilot.unit-pilot.roll-pilot.duration),badge:t.frame(d.badgeFrame,d.unitFrame!==undefined?d.unitFrame+pilot.badge-pilot.unit:end+pilot.badge-pilot.roll-pilot.duration)};
}
/** Use the first strong letter of primary copy, independent of captions, assets or saved edit language. */
export function ownSceneCopy(data:any) {
  const main = data?.title ?? data?.question ?? data?.claim?.join(' ') ?? data?.boardTitle ?? data?.label ?? data?.keyword ?? data?.message ?? data?.text ?? data?.handle ?? data?.groups?.[0]?.tokens?.join(' ') ?? data?.messages?.map((m:any)=>m.text).join(' ') ?? data?.blocks?.map((b:any)=>b.text ?? '').join(' ') ?? data?.bars?.map((b:any)=>b.label).join(' ') ?? data?.unit ?? '';
  const letter = String(main).match(/\p{L}/u)?.[0] ?? '';
  if(!letter)return sceneCopy({...data,lang:data?.lang ?? 'ar'});
  return sceneCopy({...data,lang:/\p{Script=Arabic}/u.test(letter)?'ar':'en'});
}
export const displayWeight = (family:string,pilot:string,weight:number) => {
  if(family===pilot)return weight;
  // Variable fonts in the shipped manifest are registered over their full axis in core/fonts.
  const variable:Record<string,number> = {Alexandria:900,'Reem Kufi':700,'Noto Kufi Arabic':900,'Readex Pro':700,'El Messiri':700,Marhey:700};
  return variable[family] ?? Math.max(weight,...fontManifest.filter(f=>f.family===family).map(f=>Number(f.weight)));
};
export const displayLineHeight = (family:string,pilot:string,lh:number) => family===pilot?lh:Math.max(1.3,lh);
export function fittedSize(text:string,family:string,weight:number,size:number,width:number) {
  return Math.min(size,size*width/Math.max(1,measure(text,{fontFamily:family,fontSize:size,fontWeight:weight}).width));
}
export function statementBand(height:number,head:FamilyDesignProps['headBox'],upperTop:number,captionCenter:number,style:string) {
  const lower = !head || upperTop+height>head.y-40;
  const bottom = Math.min(1150,captionCenter-88);
  const scale = lower?Math.min(1,220/Math.max(1,height)):1;
  const top=lower?bottom-height*scale:upperTop;
  if(lower && head && top<head.y+head.height+24)designWarning(style,{statement:'Lower band intersects supplied head; no complete safe vertical band',top,head});
  return {lower,top,bottom:top+height*scale,scale,width:lower?788:950};
}
export function boundedData(data:any,t:ReturnType<typeof sceneTiming>):any {
  if(Array.isArray(data))return data.map(d=>boundedData(d,t));
  if(!data || typeof data!=='object')return data;
  return Object.fromEntries(Object.entries(data).map(([k,v])=>[k,/Frame$/.test(k)?t.frame(v,0):/Duration(Frames)?$/.test(k)||k==='rollDuration'?t.duration(v,1,0):boundedData(v,t)]));
}
export function designSet(designs:Partial<Record<string,React.FC<FamilyDesignProps>>>) {
  return Object.fromEntries(Object.entries(designs).map(([family,Design])=>[family,((p:FamilyDesignProps)=>{
    const data=useDesignData(p.scene.data);
    const scene={...p.scene,data:boundedData(data,sceneTiming(p.scene.durationInFrames,p.style))} as FamilyDesignProps['scene'];
    return <DesignDigitsScope data={p.scene.data}><FitEnabled.Provider value={scene.layout==='takeover'}><Bounds.Provider value={scene.layout==='split'?Math.min(1150,p.seam-88):1150}><Timing.Provider value={sceneTiming(scene.durationInFrames,p.style)}>{Design?<Design {...p} scene={scene}/>:null}</Timing.Provider></Bounds.Provider></FitEnabled.Provider></DesignDigitsScope>;
  }) as React.FC<FamilyDesignProps>]));
}
