import React from 'react';
import {Img,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {useProbe} from '../../../core/safe';
import {FAMILY} from '../../../core/fonts';
import {useDisplayText} from '../../../creative-kit/digits';
import {ease} from '../../../maps/project';
import type {CutoutCardScene} from './schema';
import {DocumentaryPaper,TORN} from './paper';

export const CutoutCardSceneView:React.FC<{scene:CutoutCardScene}>=({scene})=>{
  const frame=useCurrentFrame(),{fps}=useVideoConfig(),probe=useProbe(),d=scene.data;
  const credit=useDisplayText(d.credit??'');
  const t=probe?1:ease((frame-d.at)/(fps*.4));
  return <DocumentaryPaper title={d.title} caption={d.caption}>
    <div style={{position:'absolute',left:145,top:520,width:660,height:590,opacity:t,transform:`translateY(${(1-t)*35}px) rotate(${d.tilt}deg)`,filter:probe?undefined:'drop-shadow(10px 14px 8px #28251F30)'}}>
      <div style={{position:'absolute',inset:0,background:'#FFFCF3',clipPath:TORN,padding:22,boxSizing:'border-box'}}>
        <Img src={staticFile(d.image.src)} style={{width:'100%',height:d.credit?'86%':'100%',objectFit:d.fit,filter:'saturate(.65) contrast(1.03)'}}/>
        {credit?<div dir="auto" style={{fontFamily:FAMILY.tajawal,fontSize:22,lineHeight:1.4,color:'#655B4F',paddingTop:14,textAlign:'right',overflowWrap:'anywhere'}}>{credit}</div>:null}
      </div>
    </div>
  </DocumentaryPaper>;
};
