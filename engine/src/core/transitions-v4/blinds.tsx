import React from 'react';
import {LayerBox} from '../mask';
import {clamp01} from '../motion';
import {cubicOut,useEntrance} from './shared';
import type {TransitionProps} from '../../prepared-edit/transition-registry';
export const Blinds:React.FC<TransitionProps>=p=>{
  const {progress,probe,box}=useEntrance(p),id=React.useId();
  if(probe)return <>{p.children}</>;
  // Six horizontal slats open about their long axes; the right edge leads the left.
  // A union mask keeps the incoming scene mounted once, including any named video.
  return <LayerBox box={box} clip><svg width={0} height={0} style={{position:'absolute'}}><defs><clipPath id={id} clipPathUnits="userSpaceOnUse">
    {Array.from({length:6},(_,i)=>{
      const h=box.height/6,y=(i+.5)*h;
      const right=Math.sin(cubicOut(clamp01((progress-i*.018)/.84))*Math.PI/2)*h/2;
      const left=Math.sin(cubicOut(clamp01((progress-i*.018-.05)/.84))*Math.PI/2)*h/2;
      return <polygon key={i} data-slat={i} points={`0,${y-left} ${box.width},${y-right} ${box.width},${y+right} 0,${y+left}`}/>;
    })}
  </clipPath></defs></svg><div style={{position:'absolute',inset:0,clipPath:progress>=1?undefined:`url(#${id})`}}>{p.children}</div></LayerBox>;
};
