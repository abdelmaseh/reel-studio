import React from 'react';
import {LayerBox} from '../mask';
import {useEntrance,cubicOut} from './shared';
import type {TransitionProps} from '../../prepared-edit/transition-registry';
export const ZoomThrough:React.FC<TransitionProps>=p=>{
  const {progress,probe,box}=useEntrance(p);
  if(probe)return <>{p.children}</>;
  const rest=1-cubicOut(progress);
  return <LayerBox box={box} clip><div style={{position:'absolute',inset:0,transform:progress>=1?undefined:`scale(${1+.4*rest})`,filter:progress>=1?undefined:`blur(${18*rest}px)`,transformOrigin:'50% 50%'}}>{p.children}</div></LayerBox>;
};
