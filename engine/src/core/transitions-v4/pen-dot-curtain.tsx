import React from 'react';
import {clamp01} from '../motion';
import {OverlaySvg,useOverlay} from './shared';
import type {TransitionProps} from '../../prepared-edit/transition-registry';
// Demo move 9: 90px pitch lattice rotated 45 degrees, overlapping pen-dot diamonds.
const cells=Array.from({length:61*61},(_,n)=>{
  const u=(n%61-30)*90,v=(Math.floor(n/61)-30)*90;
  return {x:540+(u-v)/Math.SQRT2,y:960+(u+v)/Math.SQRT2};
}).filter(c=>c.x>=-120&&c.x<=1200&&c.y>=-120&&c.y<=2040);
export const PenDotCurtain:React.FC<TransitionProps>=p=>{
  const {progress,live}=useOverlay(p);
  if(!live)return null;
  const ink=p.ink??'#102027',accent=p.paper??'#E2B85F';
  const phase=progress<=.5?clamp01((progress-.12)/.38):(progress-.5)*2;
  return <OverlaySvg kind="pen-dot-curtain">
    {progress===.5?<rect data-cut-cover="full" width={1080} height={1920} fill={ink}/>:null}
    {progress<.16?<circle cx={540} cy={-60+1020*clamp01(progress/.12)**3} r={30} fill={ink}/>:null}
    {cells.map((c,i)=>{
      // Normalize the demo's distance/1400 + .28s envelope to each half of the chosen duration.
      const delay=Math.hypot(c.x-540,c.y-960)/1400;
      const envelope=clamp01((phase*1.3-delay)/.28);
      const g=progress<=.5?envelope:1-envelope,r=.8*90*Math.SQRT2*g*g*g;
      if(r<=0)return null;
      const outline=g<.8?1:(1-g)/.2;
      return <path key={i} d={`M ${c.x} ${c.y-r} L ${c.x+r} ${c.y} L ${c.x} ${c.y+r} L ${c.x-r} ${c.y} Z`} fill={ink} stroke={accent} strokeWidth={2*outline}/>;
    })}
  </OverlaySvg>;
};
