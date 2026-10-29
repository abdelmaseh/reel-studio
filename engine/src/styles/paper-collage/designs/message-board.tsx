import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {useTiming,displayWeight} from '../../../style-kit/design-safety';
import {C,BODY,rectShape,fit,textW,Stage,Piece,Tape,DesignProvider,useKit,ramp} from './kit';

export const boardSlots=(count:number)=>{
 const rows=count<=2?1:count<=4?2:3,w=396,h=rows===3?180:230,gap=rows===3?30:40;
 const total=rows*h+(rows-1)*gap,top=454+(636-total)/2;
 return Array.from({length:count},(_,i)=>({x:count%2 && i===count-1?342:i%2===0?110:574,y:top+Math.floor(i/2)*(h+gap),w,h,rot:[-3,2.5,2,-2.6,-2,2.4][i]}));
};
const Drawing:React.FC<{d:any}>=({d})=>{
 const {HEAD,copy}=useKit(),f=useCurrentFrame(),timing=useTiming(),slots=boardSlots(d.items.length);
 const gather=timing.frame(d.gatherFrame,10),gd=timing.duration(d.gatherDurationFrames,20,gather),focus=timing.frame(d.focusFrame,66),fd=timing.duration(d.focusDurationFrames,20,focus),closing=timing.frame(d.closingFrame,100);
 const fills=[C.terra,C.mustard,C.ink,C.teal],inks=[C.card,C.ink,C.card,C.card];
 const heading=f>=closing&&d.closingFrame!==undefined?d.closingTitle:f>=focus?d.focusTitle:f>=gather?d.boardTitle:d.initialTitle;
 const ht=fit(d.boardTitle,{width:790,size:48,min:28,lines:2,weight:700,family:HEAD});
 return <Stage offcuts={{family:'quarter',colors:[C.teal,C.mustard,C.terra]}}>
  <Piece id="mb-board" x={80} y={270} w={920} h={860} color={C.card} shape={rectShape(4)} enter={{at:0,from:[0,80],dur:20}} depth={1.1}>
   <div style={{position:'absolute',inset:24,border:'2px solid rgba(40,50,46,.12)'}}/>
   <Tape cx={28} cy={12} len={92} h={32} rot={-36} at={24} id="mb-t1"/>
   <Tape cx={892} cy={12} len={92} h={32} rot={36} at={28} id="mb-t2"/>
  </Piece>
  <div data-board-heading={f>=gather} style={{position:'absolute',top:304,left:145,width:790,zIndex:5,fontFamily:HEAD,fontWeight:displayWeight(HEAD,'Reem Kufi',700),fontSize:ht.size,lineHeight:ht.box+'px',direction:copy.dir,textAlign:copy.align}}>{ht.lines.map((l,i)=><div key={i}>{l}</div>)}<div style={{fontSize:22,lineHeight:"30px"}}>{heading===d.boardTitle?"":heading}</div></div>
  {d.items.map((item:any,i:number)=>{const p=slots[i],isFocus=i===d.focusIndex,k=isFocus?ramp(f,focus,fd):0;
   const title=fit(item.label,{width:p.w-72,size:64,min:28,lines:2,weight:700,family:HEAD}),detail=fit(item.detail??'',{width:p.w-72,size:30,min:18,lines:2,weight:500,family:BODY});
   const width=Math.max(1,...title.lines.map(l=>textW(l,HEAD,title.size,displayWeight(HEAD,'Reem Kufi',700))),...detail.lines.map(l=>textW(l,BODY,detail.size,500)));
   const height=title.lines.length*title.box+(item.detail?8+detail.lines.length*detail.box:0);
   const scale=Math.min(1,(p.w-72)/width,(p.h-48)/Math.max(1,height));
   title.size*=scale;title.box*=scale;detail.size*=scale;detail.box*=scale;
   return <Piece key={item.id} id={'mb-'+i} x={p.x} y={p.y-18*k} w={p.w} h={p.h} rot={p.rot*(1-k*.5)} color={fills[i%4]} shape={rectShape(9)} enter={{at:4+i*2,from:[i%2?-80:80,-20],dur:15}} track={{at:gather,dur:gd,from:[i%2?-14:14,i%2?-10:10],rot:2,lift:.6}} z={isFocus&&f>=focus?18:4+i} depth={.8+k}>
    <div data-focus={isFocus?k:0} style={{position:'absolute',inset:'30px 36px 18px',display:'flex',flexDirection:'column',justifyContent:'center',direction:copy.dir,textAlign:copy.align,color:inks[i%4]}}>
     <div style={{fontFamily:HEAD,fontWeight:displayWeight(HEAD,'Reem Kufi',700),fontSize:title.size,lineHeight:title.box+'px'}}>{title.lines.map((l,j)=><div key={j}>{l}</div>)}</div>
     {item.detail?<div style={{fontFamily:BODY,fontWeight:500,fontSize:detail.size,lineHeight:detail.box+'px',marginTop:8}}>{detail.lines.map((l,j)=><div key={j}>{l}</div>)}</div>:null}
    </div>
    <Tape cx={i%2?p.w-12:12} cy={8} len={76} h={28} rot={i%2?36:-40} at={20+i*2} id={'mb-pt'+i}/>
   </Piece>;
  })}
 </Stage>;
};
export const MessageBoard:React.FC<FamilyDesignProps>=p=>p.scene.family==='message-board'?<DesignProvider data={p.scene.data} sectionIndex={p.sectionIndex}><Drawing d={p.scene.data}/></DesignProvider>:null;
