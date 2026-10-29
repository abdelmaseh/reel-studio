import React from 'react';
import {AbsoluteFill, Easing, Sequence, useCurrentFrame} from 'remotion';
import {useProbe} from '../safe';
import {LayerBox} from '../mask';
import type {TransitionProps} from '../../prepared-edit/transition-registry';
import {GlassLensSuppression, LensDisc, LensBezel, clamp01, mix, type LensState} from '../../styles/liquid-glass/designs/kit';
import {fullPicture,hiddenPicture,lensPictureMasks} from './picture-mask';

// Entrance, not a centred overlay: the pilot's frame 0 starts on the incoming boundary.
export const LENS_ZOOM_DEFAULTS = {durationInFrames:14,centred:false,phase:'entrance',allowedLayouts:['takeover','split']} as const;
export type LensZoomProps = TransitionProps & {
  /** The previous graphics SceneLayer without its own Sequence; its local clock is frozen below. */
  outgoing?: React.ReactNode;
  outgoingLens?: LensState;
};
const settle = Easing.bezier(0.16,1,0.3,1), inOut = Easing.inOut(Easing.quad);
export const lensZoomMotion = (f: number, ls: LensState, width=1080, height=1920) => {
  const {cx,cy,r:r0} = ls;
  const Rmax = Math.max(Math.hypot(cx,cy),Math.hypot(width-cx,cy),Math.hypot(cx,height-cy),Math.hypot(width-cx,height-cy))+40;
  const q = clamp01(f/10), swap = inOut(clamp01((f-2)/4));
  return {R:mix(r0,Rmax,0.5*q+0.5*q*q),swap,zoomA:ls.zoom*(1+1.6*q*q),
    zoomB:mix(1.45,1,settle(clamp01((f-2)/11))),rim:1-clamp01((f-9)/4),q};
};
export const lensZoomPictureMasks = (local:number,duration:number,ls:LensState,width=1080,height=1920) => {
  if(local<0)return {incoming:hiddenPicture,outgoing:fullPicture};
  if(local>=duration)return {incoming:fullPicture,outgoing:hiddenPicture};
  return lensPictureMasks(ls.cx,ls.cy,lensZoomMotion(local*13/Math.max(1,duration-1),ls,width,height).R,width,height);
};
let warned = false;
export const LensZoom: React.FC<LensZoomProps> = p => {
  const current = useCurrentFrame(), probe = useProbe();
  const box = p.box ?? {x:0,y:0,width:1080,height:1920};
  if (probe) return <>{p.children}</>;
  if (!p.outgoing || !p.outgoingLens) {
    if (!warned) { warned=true; console.warn('lens-zoom requires outgoing and outgoingLens from the preceding graphics scene; transition skipped.'); }
    return <>{p.children}</>;
  }
  const local = current-p.atFrame;
  // Duration remaps the same 0..13 trajectory; 14 frames reproduces the pilot exactly.
  const f = local*13/Math.max(1,p.durationInFrames-1);
  const ls = p.outgoingLens;
  const incoming = p.timingManaged ? p.children : <Sequence from={p.atFrame-14} layout="none">{p.children}</Sequence>;
  const frozenA = p.timingManaged ? p.outgoing : <Sequence from={current-120} layout="none">{p.outgoing}</Sequence>;
  if (local < 0) return <>{frozenA}</>;
  if (local >= p.durationInFrames) return <>{incoming}</>;
  const m = lensZoomMotion(f,ls,box.width,box.height);
  return <GlassLensSuppression><LayerBox box={box} clip><AbsoluteFill>
    {frozenA}
    <LensDisc cx={ls.cx} cy={ls.cy} R={m.R} rim={m.rim} layers={[
      {node:frozenA,zoom:m.zoomA,blur:2.5*m.q,opacity:1-m.swap},
      {node:incoming,zoom:m.zoomB,opacity:m.swap,blur:(1-m.swap)*5},
    ]}/>
    <LensBezel cx={ls.cx} cy={ls.cy} R={m.R} spin={3} zoom={m.zoomA} vis={m.rim}/>
  </AbsoluteFill></LayerBox></GlassLensSuppression>;
};
