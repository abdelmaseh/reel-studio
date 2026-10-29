import React from 'react';
import {useCurrentFrame} from 'remotion';
import {useProbe} from '../safe';
import {clamp01} from '../motion';
import type {TransitionProps} from '../../prepared-edit/transition-registry';

export const cubicInOut=(x:number):number=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
export const cubicOut=(x:number):number=>1-Math.pow(1-x,3);
export const useEntrance=(p:TransitionProps)=>({probe:useProbe()!==null,
  progress:clamp01((useCurrentFrame()-p.atFrame+1)/Math.max(1,p.durationInFrames)),
  box:p.box??{x:0,y:0,width:1080,height:1920}});
export const useOverlay=(p:TransitionProps)=>{
  const frame=useCurrentFrame(),probe=useProbe();
  const progress=(frame-p.atFrame)/Math.max(1,p.durationInFrames)+.5;
  return {progress,live:probe===null&&progress>0&&progress<1};
};
export const OverlaySvg:React.FC<{kind:string;children:React.ReactNode}>=({kind,children})=>
  <svg data-transition={kind} viewBox="0 0 1080 1920" width={1080} height={1920} style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden'}}>{children}</svg>;
