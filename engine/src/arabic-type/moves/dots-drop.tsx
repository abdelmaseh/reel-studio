import React from 'react';
import {MoveCanvas,raster,blobs,drawBlob,fontAt,layout} from '../canvas';
import {clamp,E,hash,progress as P} from '../math';
import type {ArabicMoveProps,DrawMove} from '../types';
const draw:DrawMove=(ctx,t,p)=>{
  const r=raster(p.text,p.font,p.size),all=blobs(r,p.ink),accent=blobs(r,p.accent),dots=all.filter(b=>b.kind==='dot').sort((a,b)=>b.cx-a.cx);
  r.ctx.font=fontAt(p.font,p.size*r.k);const words=layout(r.ctx,p.text.split(/\s+/),r.width/2),key=words[words.length-1];
  const lastEnd=dots.length?.35+.08*(dots.length-1)+.42:.5,exit=E.cubIn(P(t,p.durationInFrames/p.fps-.7,.45));
  ctx.globalAlpha=1-exit;ctx.translate(0,-10*exit);const ac=E.cubOut(P(t,lastEnd,.3)),bodyAlpha=E.sinOut(P(t,0,.3));
  const paint=(b:typeof all[number],options:Parameters<typeof drawBlob>[5]={})=>{
    const keyed=b.cx>=key.left-4*r.k&&b.cx<=key.right+4*r.k,alpha=options.alpha??1;
    drawBlob(ctx,r,b,135,255,{...options,alpha:alpha*(keyed?1-ac:1)});
    if(keyed&&ac>0)drawBlob(ctx,r,accent[b.id],135,255,{...options,alpha:alpha*ac});
  };
  for(const body of all.filter(b=>b.kind==='body'))paint(body,{alpha:bodyAlpha});
  dots.forEach((d,i)=>{const start=.35+.08*i,land=start+.42*.62;if(t<start)return;
    const f=P(t,start,.42),q=P(t,land,.12),squash=q>0&&q<1?Math.sin(Math.PI*q):0;
    paint(d,{alpha:clamp(f/.2),dy:-45*(1-E.back(f))+.75*squash,rotate:Math.PI/4*(1-E.cubOut(f)),sx:1+.18*squash,sy:1-.3*squash});
    const u=t-land;if(u<=0||u>=.25)return;
    const x=135+(d.cx-r.width/2)/r.k,y=255+(d.cy-r.baseline)/r.k;
    ctx.save();ctx.globalAlpha=(1-exit)*(1-u/.25);ctx.fillStyle=p.ink;
    for(let j=0;j<3;j++){const a=-Math.PI/2+(hash(d.id,j)-.5)*2.44,speed=40+hash(j,d.id)*30;
      ctx.beginPath();ctx.arc(x+Math.cos(a)*speed*u,y+Math.sin(a)*speed*u+90*u*u,Math.max(.5,1.9-1.4*u/.25),0,Math.PI*2);ctx.fill();}ctx.restore();
  });
};
export const DotsDrop:React.FC<ArabicMoveProps>=props=><MoveCanvas {...props} move="dots-drop" draw={draw}/>;
