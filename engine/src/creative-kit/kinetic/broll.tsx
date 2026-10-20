import React from 'react';
import {Sequence} from 'remotion';
import {CanvasFill,contentBox} from '../../core/safe';
import {bestInk} from '../../core/chapters';
import {SceneClip} from '../../core/clip';
import {useClock} from '../../core/motion';
import {FitText,type SceneTheme} from '../primitives';
import type {KineticScene} from './schema';

type ScreensData=Extract<KineticScene,{family:'screens'}>['data'];
export type BrollData=Extract<ScreensData,{look:'broll'}>;

const CHIP_TOP_GAP=24;

/**
 * The ink of the label chip, which sits on the style's accent. The style's own `onAccent` when it has one; otherwise the candidate that reads best on the accent
 * (the style text is not enough: it is near-white on pale accents in half the styles). Pure, so a test can check every style without rendering.
 */
export const brollChipInk=(theme:Pick<SceneTheme,'accent'|'text'|'background'|'onAccent'>):string=>
  theme.onAccent??bestInk(theme.accent,[theme.text,theme.background,'#FFFFFF','#111111']);

/**
 * The B-roll look: the active clip fills the scene box, silent, with an optional label on a solid chip inside the platform safe zone.
 * Clips change by hard cuts; there is no window, no progress marker and no title.
 */
export const Broll:React.FC<{theme:SceneTheme;data:BrollData;layout:'takeover'|'split';seam:number}>=({theme,data,layout,seam})=>{
  const {frame}=useClock();
  let phase=0;
  for(let i=1;i<data.steps.length;i++)if(frame>=data.steps[i].atFrame)phase=i;
  const step=data.steps[phase];
  const height=layout==='split'?seam:1920;
  const box=contentBox();
  const label=step.label;
  const chipWidth=label?Math.min(box.width-46,Math.max(140,[...label].length*16+10)):0;
  const ink=brollChipInk(theme);
  return <>
    <CanvasFill background={theme.background} style={layout==='split'?{height:seam,bottom:'auto'}:undefined}/>
    <Sequence key={phase} from={step.atFrame} layout="none"><SceneClip clip={step} width={1080} height={height}/></Sequence>
    {label?<div style={{position:'absolute',left:box.left,top:box.top+CHIP_TOP_GAP,padding:'10px 20px',background:theme.accent,border:`3px solid ${ink}`}}>
      <FitText text={label} theme={theme} role="label" width={chipWidth} height={35} size={24} min={16} lines={1} color={ink}/>
    </div>:null}
  </>;
};
