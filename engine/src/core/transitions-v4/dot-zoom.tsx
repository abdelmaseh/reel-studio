import React from 'react';
import {ClipReveal,LayerBox} from '../mask';
import {useEntrance,cubicOut} from './shared';
import type {TransitionProps} from '../../prepared-edit/transition-registry';
export const DotZoom:React.FC<TransitionProps>=p=>{
  const {progress,probe,box}=useEntrance(p),o=p.origin??{x:.5,y:.5};
  if(probe)return <>{p.children}</>;
  // The demo's 90x exponential dive is played out into the incoming scene. No source is re-decoded.
  const zoom=Math.pow(90,Math.pow(1-progress,5));
  return <LayerBox box={box} clip style={{background:progress>=1?undefined:p.ink??'#102027'}}>
    <ClipReveal shape="circle" origin={o} progress={cubicOut(progress)} box={{x:0,y:0,width:box.width,height:box.height}}>
      <div style={{position:'absolute',inset:0,transform:progress>=1?undefined:`scale(${zoom})`,transformOrigin:`${o.x*100}% ${o.y*100}%`}}>{p.children}</div>
    </ClipReveal>
  </LayerBox>;
};
