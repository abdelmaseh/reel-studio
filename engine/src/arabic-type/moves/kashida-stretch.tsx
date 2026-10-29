import React from 'react';
import {MoveCanvas,raster,tint,text} from '../canvas';
import {stretchWord,kashidaBar} from '../../arabic/index.ts';
import {E,lerp,progress as P} from '../math';
import type {ArabicMoveProps,DrawMove} from '../types';
const bars=new WeakMap<ReturnType<typeof raster>,ReturnType<typeof kashidaBar>>();
const draw:DrawMove=(ctx,t,p)=>{
  const size=Math.min(p.size,78),value=stretchWord(p.text,14),r=raster(value,p.font,size);
  if(!bars.has(r))bars.set(r,kashidaBar(r.ctx.getImageData(0,0,r.width,r.height),size*r.k));
  const bar=bars.get(r),pop=E.back(P(t,0,.35));
  ctx.globalAlpha=1-P(t,p.durationInFrames/p.fps-.3,.3);ctx.translate(135,262);ctx.scale(pop,pop);ctx.translate(-135,-262);
  if(value===p.text||!bar||bar.x1-bar.x0<.5*size*r.k){text(ctx,p.text,135,262,p.font,size,p.accent);return;}
  const b0=bar.x0+2,b1=bar.x1-2,m=Math.round((bar.x0+bar.x1)/2),lw=b0/r.k,rw=(r.width-b1)/r.k,min=.04*size,max=Math.max(min,230-lw-rw);
  const stretch=E.expIO(P(t,.45,1))-E.expIO(P(t,2.55,.6)),L=lerp(min,max,stretch),total=lw+rw+L,x=135-total/2,y=262-r.baseline/r.k,img=tint(r,p.accent);
  ctx.drawImage(img,0,0,b0,r.height,x,y,lw,r.height/r.k);ctx.drawImage(img,m,0,2,r.height,x+lw-.4,y,L+.8,r.height/r.k);
  ctx.drawImage(img,b1,0,r.width-b1,r.height,x+lw+L,y,rw,r.height/r.k);ctx.fillStyle=p.ink;ctx.fillRect(135-total*.94/2,279.5,total*.94,2);
};
export const KashidaStretch:React.FC<ArabicMoveProps>=props=><MoveCanvas {...props} move="kashida-stretch" draw={draw}/>;
