import React from 'react';
import {OverlaySvg,useOverlay,cubicInOut} from './shared';
import type {TransitionProps} from '../../prepared-edit/transition-registry';
export const PageTurn:React.FC<TransitionProps>=p=>{
  const {progress,live}=useOverlay(p),id=React.useId();
  if(!live)return null;
  const paper=p.paper??'#F7F3E8',opening=progress>.5;
  // Demo move 8: -260..1340, 8-degree fold, travelling left to right like an Arabic book.
  // An opaque paper lead-in adapts the two-scene canvas demo to a centred overlay without cloning either scene.
  const fold=-260+1600*cubicInOut(opening?(progress-.5)*2:progress*2),flap=Math.max(0,fold+260);
  return <OverlaySvg kind="page-turn"><defs>
    <linearGradient id={id}><stop offset="0" stopColor="#000" stopOpacity={.22}/><stop offset=".3" stopColor="#000" stopOpacity={.04}/><stop offset=".75" stopColor="#fff" stopOpacity={.14}/><stop offset="1" stopColor="#000" stopOpacity={.08}/></linearGradient>
  </defs>{progress===.5?<rect data-cut-cover="full" width={1080} height={1920} fill={paper}/>:null}
    <g transform="rotate(8 540 960)">
      <rect x={opening?fold:-2000} y={-1000} width={opening?4000:fold+2000} height={4000} fill={paper}/>
      {opening?<rect x={fold-60} y={-1000} width={60} height={4000} fill="#000" opacity={.15} style={{filter:'blur(16px)'}}/>:null}
      <rect x={fold} y={-1000} width={opening?flap:70} height={4000} fill={paper} style={{filter:'drop-shadow(14px 0 40px #00000038)'}}/>
      <rect x={fold} y={-1000} width={opening?flap:70} height={4000} fill={`url(#${id})`}/>
    </g>
  </OverlaySvg>;
};
