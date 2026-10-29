import React from 'react';
import {Img,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {CanvasFill,useProbe} from '../../core/safe';
import {displayDigits} from '../../core/digits.ts';
import {useDigits} from '../digits';
import {useSceneTheme} from '../chapter-theme';
import {FitText} from '../primitives';
import type {StyleFamily} from '../schema';
import type {ProofScreenSceneSpec} from './schema.ts';
import {proofCameraAt,proofFocusFrame} from './timing.ts';
import {WebLayout} from './layouts/web';
import {ChatLayout} from './layouts/chat';
import {DashboardLayout} from './layouts/dashboard';
import {proofFocusOrigin} from './layouts/geometry.ts';

export const ProofScreenScene:React.FC<{scene:ProofScreenSceneSpec;style?:StyleFamily}>=({scene,style='section-deck'})=>{
  const frame=useCurrentFrame(),{fps}=useVideoConfig(),probe=useProbe(),digits=useDigits(),theme=useSceneTheme(style);
  const {data}=scene,focus=data.focus??0;
  const camera=proofCameraAt(frame,fps,data.path,probe!==null);
  const highlight=probe?1:Math.max(0,Math.min(1,(frame-proofFocusFrame(fps)*.6)/(fps*.4)));
  const Layout=data.page==='chat'?ChatLayout:data.page==='dashboard'?DashboardLayout:WebLayout;
  const renderBlock=(index:number,width:number,height:number)=>{
    const block=data.blocks[index],selected=index===focus,innerW=width-40,innerH=height-24;
    const text=(value:string,w=innerW,h=innerH,size=block.kind==='heading'?34:26)=>
      <FitText text={displayDigits(value,digits)} theme={theme} width={w} height={h} size={size} min={14} lines={6} color={theme.text}/>;
    return <div data-proof-block={index} data-proof-focus={selected?'true':undefined} style={{
      width,height,boxSizing:'border-box',borderRadius:data.page==='chat'?22:12,position:'relative',padding:'10px 18px',
      border:`2px solid ${selected?theme.accent:theme.border}`,background:theme.card,
      boxShadow:selected&&!probe?`0 0 0 ${Math.round(5*highlight)}px ${theme.accent}33`:'none',
    }}>
      {block.kind==='image'?<><Img src={staticFile(block.src)} style={{width:innerW,height:block.text?Math.max(1,innerH-30):innerH,objectFit:'contain'}}/>
        {block.text?<div style={{position:'absolute',bottom:5}}>{text(block.text,innerW,28,20)}</div>:null}</>
        :block.kind==='stat'?<div style={{display:'flex',alignItems:'center',gap:12,height:innerH}}>
          <div dir="ltr">{text(String(block.value),block.text?Math.floor(innerW*.52):innerW,innerH,42)}</div>
          {block.text?text(block.text,Math.floor(innerW*.43),innerH,23):null}</div>
        :block.kind==='row'&&block.value!==undefined?<div style={{display:'flex',alignItems:'center',gap:12}}>
          {text(block.text,Math.floor(innerW*.62))}<div dir="ltr">{text(String(block.value),Math.floor(innerW*.33))}</div></div>
        :<div style={{height:innerH,display:'flex',alignItems:'center',justifyContent:block.kind==='button'?'center':undefined,
          ...(block.kind==='button'?{borderRadius:8,background:theme.background}:null)}}>{text(block.text??'')}</div>}
    </div>;
  };
  return <>
    <CanvasFill background={theme.background}/>
    <div style={{position:'absolute',left:130,top:320,width:700,height:1000,perspective:1600}}>
      <div dir="rtl" data-proof-page={data.page} style={{width:700,height:1000,boxSizing:'border-box',borderRadius:20,
        background:theme.card,border:`2px solid ${theme.border}`,color:theme.text,
        boxShadow:probe?'none':'0 18px 28px #00000020',
        transform:`translate(${camera.x}px,${camera.y}px) rotateX(${camera.rotateX}deg) rotateY(${camera.rotateY}deg) scale(${camera.scale})`,
        transformOrigin:proofFocusOrigin(data),overflow:'hidden'}}>
        <div style={{height:78,boxSizing:'border-box',padding:'10px 26px',borderBottom:`2px solid ${theme.border}`,display:'flex',gap:20,alignItems:'center'}}>
          {data.title?<FitText text={displayDigits(data.title,digits)} theme={theme} width={data.url?360:644} height={54} size={30} min={18} lines={2} color={theme.text}/>:null}
          {data.url?<div dir="auto"><FitText text={displayDigits(data.url,digits)} theme={theme} width={data.title?264:644} height={54} size={23} min={14} lines={2} color={theme.dim}/></div>:null}
        </div>
        <div style={{padding:'20px 26px'}}><Layout blocks={data.blocks} renderBlock={renderBlock}/></div>
      </div>
    </div>
  </>;
};
