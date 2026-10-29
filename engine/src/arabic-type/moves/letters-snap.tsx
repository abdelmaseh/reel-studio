import React from 'react';
import {MoveCanvas,raster,tint} from '../canvas';
import {kashidaSlots} from '../../arabic/index.ts';
import {clamp,E,hash,progress as P} from '../math';
import type {ArabicMoveProps,DrawMove} from '../types';
// Slice the already-shaped bitmap. No isolated Arabic glyphs or per-letter DOM are ever rendered.
const draw:DrawMove=(ctx,t,p)=>{
  const r=raster(p.text,p.font,p.size),n=Array.from(p.text.replace(/[\u064B-\u065F\u0670]/g,'')).length;
  const snapAt=Math.max(1.3,.06*(n-1)+.35),pull=E.expIn(P(t,snapAt-.35,.35)),gap=Math.min(15,Math.max(0,(232-r.width/r.k+p.size*.6)/Math.max(1,n-1)))*(1-pull),snap=P(t,snapAt,.06),calm=1-P(t,snapAt-.5,.5);
  const exit=E.cubIn(P(t,p.durationInFrames/p.fps-.7,.4)),w=r.width/r.k,h=r.height/r.k,cell=r.width/n;
  ctx.globalAlpha=1-exit;
  if(snap<1)for(let i=0;i<n;i++){
    if(t<.06*i)continue;const f=E.back(P(t,.06*i,.35)),scale=.6+.4*f,tilt=(hash(i,3)-.5)*8*Math.PI/180*calm;
    const center=135+w/2-(i+.5)*w/n+(n/2-i-.5)*gap;
    ctx.save();ctx.globalAlpha=(1-exit)*clamp(f*1.5)*(1-snap);ctx.translate(center,262+Math.sin(Math.PI*t+i*1.3)*2.5*calm);
    ctx.rotate(tilt);ctx.scale(scale,scale);ctx.drawImage(tintCached(r,p.ink),r.width-(i+1)*cell,0,cell,r.height,-w/n/2,-r.baseline/r.k,w/n,h);ctx.restore();
  }
  if(snap>0){const u=t-snapAt,sx=1+.04*Math.exp(-u*6)*Math.cos(Math.PI*6*u),shake=1.5*Math.sin(Math.PI*28*u)*(1-P(u,0,.18));
    ctx.save();ctx.globalAlpha=(1-exit)*snap;ctx.translate(135+shake,262);ctx.scale(sx,1);ctx.drawImage(tintCached(r,p.ink),-w/2,-r.baseline/r.k,w,h);ctx.restore();
    const f=P(u,0,.25);if(f>0&&f<1)for(const slot of kashidaSlots(p.text)){
      const x=135+w/2-(slot.index+1)/p.text.length*w;
      ctx.save();ctx.globalAlpha=(1-exit)*.75*(1-f);ctx.strokeStyle=p.accent;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,262-p.size*.1,2.5+11.5*E.cubOut(f),0,Math.PI*2);ctx.stroke();ctx.restore();}
  }
};
const cache=new WeakMap<ReturnType<typeof raster>,Map<string,HTMLCanvasElement>>();
const tintCached=(r:ReturnType<typeof raster>,color:string)=>{let map=cache.get(r);if(!map){map=new Map();cache.set(r,map);}let image=map.get(color);if(!image){image=tint(r,color);map.set(color,image);}return image;};
export const LettersSnap:React.FC<ArabicMoveProps>=props=><MoveCanvas {...props} move="letters-snap" draw={draw}/>;
