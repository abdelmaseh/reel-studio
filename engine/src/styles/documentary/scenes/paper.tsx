import React from 'react';
import {AbsoluteFill} from 'remotion';
import {CanvasFill,useProbe} from '../../../core/safe';
import {FAMILY} from '../../../core/fonts';
import {fitOnLines} from '../../../core/type';
import {useDisplayText} from '../../../creative-kit/digits';

export const TORN='polygon(0 2%, 8% 0, 17% 2%, 27% 1%, 38% 3%, 49% 0, 60% 2%, 72% 1%, 83% 3%, 94% 0, 100% 2%, 99% 97%, 91% 99%, 80% 97%, 69% 100%, 57% 98%, 46% 100%, 35% 97%, 23% 99%, 12% 97%, 1% 100%)';
export const PaperGrain:React.FC=()=>{
  const probe=useProbe();if(probe)return null;
  return <AbsoluteFill data-paper-grain style={{pointerEvents:'none',opacity:.14,backgroundImage:'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'180\' height=\'180\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'.7\' numOctaves=\'3\' seed=\'12\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'.6\'/%3E%3C/svg%3E")',mixBlendMode:'multiply'}}/>;
};
const text:React.CSSProperties={fontFamily:FAMILY.tajawal,direction:'rtl',unicodeBidi:'plaintext',color:'#28251F',overflowWrap:'anywhere'};
const PaperText:React.FC<{text:string;title?:boolean}>=({text:copy,title=false})=>{
  const shown=useDisplayText(copy);
  const fit=fitOnLines(shown,{fontFamily:FAMILY.tajawal,fontSize:title?48:32,fontWeight:title?800:700},{maxBoxWidth:title?740:640,maxLines:title?2:3,min:title?28:24,max:title?48:32,lineHeight:title?1.35:1.45});
  if(!fit.fits)throw new Error(`Documentary ${title?'title':'caption'} is too long for the safe band; shorten the authored copy`);
  return <div dir="auto" style={{...text,fontSize:fit.fontSize,fontWeight:title?800:700,lineHeight:title?1.35:1.45,whiteSpace:'pre-wrap'}}>{fit.lines.join('\n')}</div>;
};
export const DocumentaryPaper:React.FC<{title:string;caption?:string;children:React.ReactNode}>=({title,caption,children})=><AbsoluteFill>
  <CanvasFill background="#EFE5D4"/>
  {children}
  <div style={{position:'absolute',left:110,top:285,width:740}}><PaperText text={title} title/></div>
  {caption?<div style={{position:'absolute',left:110,top:1230,width:690,padding:'24px 25px',boxSizing:'border-box',background:'#FFFCF3',clipPath:TORN}}><PaperText text={caption}/></div>:null}
  <PaperGrain/>
</AbsoluteFill>;
