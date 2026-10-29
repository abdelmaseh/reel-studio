import React from 'react';
import {useCurrentFrame,useVideoConfig} from 'remotion';
import {CanvasFill,useProbe} from '../../core/safe';
import {displayDigits} from '../../core/digits.ts';
import {formatNumber} from '../../core/numbers';
import {CountUp,RingGauge,useNumberBox} from '../numbers';
import {FitText} from '../primitives';
import {useSceneTheme} from '../chapter-theme';
import {useStatDigits} from '../digits';
import {SceneStickerSlot} from '../sticker-view';
import type {StyleFamily} from '../schema';
import type {FiguresScene} from './schema.ts';
import {slotPosition,slotDigitStrings} from './timing.ts';

const LEFT=120,WIDTH=700;
const decimals=(n:number)=>n.toFixed(6).split('.')[1].replace(/0+$/,'').length;
const ramp=(f:number,n:number)=>1-(1-Math.max(0,Math.min(1,f/n)))**3;

export const FiguresSceneView:React.FC<{scene:FiguresScene;style:StyleFamily}>=({scene,style})=>{
  const theme=useSceneTheme(style),digits=useStatDigits(),probe=useProbe();
  const frame=useCurrentFrame(),{fps}=useVideoConfig(),d=scene.data;
  const value='value' in d?d.value:0;
  const slotBox=useNumberBox({values:[0,value,...('from' in d?[d.from??0]:[])],format:{digits,grouping:false},maxWidth:WIDTH,size:130,min:42},theme);
  const numeric=(n:number)=>formatNumber(n,{digits,decimals:decimals(n),grouping:false});
  const accent=theme.accentInk??theme.accent;
  return <><CanvasFill background={theme.background}/>
    {d.label?<div style={{position:'absolute',left:LEFT,top:340,width:WIDTH}}><FitText text={d.label} theme={theme} role="title" width={WIDTH} height={125} size={54} min={28} lines={2} align="center"/></div>:null}
    {d.variant==='counter'?<CountUp theme={theme} from={d.from??0} to={d.value} at={0} durF={Math.round(1.2*fps)} format={{digits,decimals:Math.max(decimals(d.value),decimals(d.from??0)),grouping:false}} left={LEFT} top={620} width={WIDTH} size={160} min={42} align="center"/>:null}
    {d.variant==='ring'?<RingGauge theme={theme} value={d.value} max={d.max} at={0} durF={Math.round(1.2*fps)} format={{digits,grouping:false,decimals:decimals(d.value)}} left={LEFT} top={520} width={WIDTH} radius={210} thickness={26}/>:null}
    {d.variant==='slot'?<div aria-label={numeric(d.value)} style={{position:'absolute',left:LEFT,top:625,width:WIDTH,height:slotBox.height,display:'flex',justifyContent:'center',direction:'ltr',overflow:'hidden',fontFamily:digits==='arabic-indic'?theme.ar:theme.display,fontSize:slotBox.fontSize,fontWeight:800,fontVariantNumeric:'tabular-nums',color:accent}}>
      {slotDigitStrings(d.value,d.from).to.split('').map((digit,i,all)=>{
        const cellW=Math.floor(Math.min(WIDTH/all.length,slotBox.fontSize*.78));
        const pos=probe?30+Number(digit):slotPosition(frame,i,all.length,Number(digit),Number(slotDigitStrings(d.value,d.from).from[i]),fps);
        return <div key={i} style={{position:'relative',width:cellW,height:slotBox.height,overflow:'hidden'}}><div style={{transform:`translateY(${-pos*slotBox.height}px)`}}>{Array.from({length:41},(_,n)=><div key={n} style={{height:slotBox.height,lineHeight:`${slotBox.height}px`,textAlign:'center'}}>{displayDigits(String(n%10),digits)}</div>)}</div></div>;
      })}
    </div>:null}
    {d.variant==='bars'?<div style={{position:'absolute',left:LEFT,top:540,width:WIDTH,height:560,display:'flex',flexDirection:'row-reverse',alignItems:'flex-end',gap:16,borderBottom:`2px solid ${theme.border}`}}>
      {d.bars.map((bar,i)=>{
        const width=(WIDTH-16*(d.bars.length-1))/d.bars.length,max=d.max??Math.max(1,...d.bars.map(b=>b.value));
        const p=probe?1:ramp(frame-Math.round(i*.12*fps),Math.round(.7*fps));
        return <div key={i} style={{position:'relative',width,height:560}}>
          <div style={{position:'absolute',bottom:64,width,height:400*bar.value/max*p,background:accent,borderRadius:'10px 10px 0 0'}}/>
          <div style={{position:'absolute',bottom:74+400*bar.value/max*p,width}}><FitText text={numeric(bar.value)} theme={theme} role="title" width={width} height={50} size={34} min={16} lines={1} align="center"/></div>
          <div style={{position:'absolute',bottom:0,width}}><FitText text={bar.label} theme={theme} role="body" width={width} height={60} size={30} min={16} lines={2} align="center"/></div>
        </div>;
      })}
    </div>:null}
    {d.unit?<div style={{position:'absolute',left:LEFT,top:d.variant==='bars'?1140:d.variant==='ring'?1000:840,width:WIDTH}}><FitText text={d.unit} theme={theme} role="body" width={WIDTH} height={90} size={40} min={24} lines={2} align="center"/></div>:null}
    <SceneStickerSlot host="figures" sticker={d.sticker} ink={theme.text}/>
  </>;
};
