import React from 'react';
import {MoveCanvas,text,fit} from '../canvas';
import {E,lerp,progress as P} from '../math';
import type {ArabicMoveProps,DrawMove} from '../types';
const draw:DrawMove=(ctx,t,p)=>{
  const size=fit(ctx,p.text,p.font,Math.min(p.size,42),148),gap=.82*size,yc=245-.3*size;
  const fold=E.expIn(P(t,p.durationInFrames/p.fps-.7,.4));
  const drift=-Math.min(18,10*Math.max(0,t-.5));
  for(let row=-3;row<=3;row++){
    const d=Math.abs(row),f=E.expOut(P(t,.05*d,.45));
    const base=lerp(yc+row*gap,yc,fold)+drift*(1-fold);
    ctx.save();ctx.beginPath();ctx.rect(0,base-1.15*size,270,1.5*size);ctx.clip();
    ctx.globalAlpha=(1-fold)*(row===0?1:Math.max(0,1-.13*d*1.6))+(row===0?fold:0);
    text(ctx,p.text,135,base+1.2*size*(1-f),p.font,size,row===0?p.accent:p.ink,row!==0);ctx.restore();
  }
};
export const EchoStack:React.FC<ArabicMoveProps>=props=><MoveCanvas {...props} move="echo-stack" draw={draw}/>;
