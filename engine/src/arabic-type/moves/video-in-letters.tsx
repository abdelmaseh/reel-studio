import React,{useLayoutEffect,useState} from 'react';
import {Footage} from '../../core/plate';
import {useProbe} from '../../core/safe';
import {MoveCanvas,useTypeFonts,raster,context,fit,thickest} from '../canvas';
import {clamp,E,lerp,progress as P} from '../math';
import type {ArabicMoveProps} from '../types';
export const VideoInLetters:React.FC<ArabicMoveProps>=p=>{
  const ready=useTypeFonts(p.font,p.text),probe=useProbe();
  const [mask,setMask]=useState<{url:string;x:number;y:number;size:number}|null>(null);
  useLayoutEffect(()=>{
    if(!ready)return;const scratch=document.createElement('canvas'),c=context(scratch);
    const size=fit(c,p.text,p.font,150,235),r=raster(p.text,p.font,size),point=thickest(r);
    const x0=135-r.width/(2*r.k),y0=280-r.baseline/r.k;
    const canvas=document.createElement('canvas');canvas.width=p.width;canvas.height=p.height;
    context(canvas).drawImage(r.canvas,x0*p.width/270,y0*p.height/480,r.width/r.k*p.width/270,r.height/r.k*p.height/480);
    setMask({url:canvas.toDataURL(),x:(x0+point.x/r.k)*p.width/270,y:(y0+point.y/r.k)*p.height/480,size});
  },[ready,p.text,p.font,p.width,p.height]);
  if(probe)return <MoveCanvas {...p} move="video-in-letters" draw={()=>{}}/>;
  const t=p.frame/p.fps,full=t>=3,scale=lerp(.85,1,E.expOut(P(t,0,.35)))*14**E.expIn(P(t,2.5,.5));
  const image=mask?'url("'+mask.url+'")':undefined;
  return <div aria-label={p.text} data-arabic-move="video-in-letters" style={{position:'absolute',inset:0,overflow:'hidden'}}>
    {(mask||full)&&<div style={{position:'absolute',inset:0,opacity:clamp(t/.2),maskImage:full?undefined:image,WebkitMaskImage:full?undefined:image,maskSize:'100% 100%',maskRepeat:'no-repeat',transform:full?undefined:'scale('+scale+')',transformOrigin:mask?mask.x+'px '+mask.y+'px':undefined}}>
      <Footage src={p.media!} muted objectFit="cover"/>
    </div>}
    {!full&&mask&&<svg width={p.width} height={p.height} viewBox="0 0 270 480" style={{position:'absolute',inset:0,opacity:clamp(t/.2),transform:'scale('+scale+')',transformOrigin:mask.x+'px '+mask.y+'px'}}>
      <text x={135} y={280} fontFamily={p.font} fontWeight={900} fontSize={mask.size} textAnchor="middle" direction="rtl" fill="none" stroke={p.ink??'#F5F2E8'} strokeWidth={.8/scale}>{p.text}</text>
    </svg>}
  </div>;
};
