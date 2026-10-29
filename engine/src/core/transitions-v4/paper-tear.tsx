import React from 'react';
import {OverlaySvg,useOverlay,cubicInOut} from './shared';
import type {TransitionProps} from '../../prepared-edit/transition-registry';
// Fixed seeded tear, reused at every frame. Both halves share the exact edge.
const edge=Array.from({length:49},(_,i)=>({y:i*40,x:540+(Math.sin(i*127.1+37)*43758.5453%1)*32}));
const seam=edge.map(q=>`${q.x},${q.y}`).join(' ');
export const PaperTear:React.FC<TransitionProps>=p=>{
  const {progress,live}=useOverlay(p);
  if(!live)return null;
  const paper=p.paper??'#F7F3E8';
  if(progress<=.5)return <OverlaySvg kind="paper-tear"><rect data-cut-cover={progress===.5?'full':undefined} x={1080*(1-cubicInOut(progress*2))} y={0} width={1080} height={1920} fill={paper}/></OverlaySvg>;
  const travel=cubicInOut((progress-.5)*2)*1160;
  return <OverlaySvg kind="paper-tear">
    <polygon points={`-100,0 ${seam} -100,1920`} fill={paper} transform={`translate(${-travel} 0)`} style={{filter:'drop-shadow(10px 0 8px #00000040)'}}/>
    <polygon points={`1180,0 ${seam} 1180,1920`} fill={paper} transform={`translate(${travel} 0)`} style={{filter:'drop-shadow(-10px 0 8px #00000040)'}}/>
  </OverlaySvg>;
};
