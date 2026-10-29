import {useDesignText} from '../../../style-kit/digits';
import React from 'react';
import {Easing,useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {NAVY,W,X1,CW,THIN,SUF_TOP,MONO,ramp,clamp01,num,Page,Lines,Kicker,Rule,MagazineScope,useMagazine,useType} from './kit';
import {magazineCopy} from './copy';

const Drawing: React.FC<{d: {label: string; value: number; suffix: string; source: string}; n?: string}> = ({d}) => {
  const shown = useDesignText();
  const f = useCurrentFrame();
  const {copy,font:AR}=useMagazine();
  const {wid}=useType();
  const final = shown(num(d.value));
  let S = 680;
  for (; S > 240; S -= 4) if (wid(final, S, THIN) + 30 + wid(d.suffix, S * 0.45, THIN) <= CW) break;
  const roll = ramp(f, 20, 48, Easing.bezier(0.2, 0.7, 0.2, 1));
  const numW = wid(final, S, THIN) + 6;
  const numTop = 490;
  const boxH = Math.round(S * 0.86);
  const lineY = numTop + boxH + 52;
  return <Page th={NAVY} section={magazineCopy('figures',copy)} page="07">
    <Kicker th={NAVY} text={magazineCopy('number',copy)} top={352} at={2}/>
    <Lines text={d.label} top={410} size={58} min={40} lines={1} weight={500} color={NAVY.ink} at={6}/>
    <div style={{position: 'absolute', top: numTop, [copy.side]: W - X1, width: CW, height: boxH, direction: 'ltr', display: 'flex', justifyContent: copy.ar ? 'flex-end' : 'flex-start', alignItems: 'flex-start',
      opacity: clamp01(ramp(f, 12, 14) * 1.6), transform: `translateY(${(1 - ramp(f, 12, 26)) * 30}px)`}}>
      <div style={{width: numW, fontFamily: AR, fontWeight: THIN, fontSize: S, lineHeight: `${S}px`, marginTop: -S * 0.12, color: NAVY.ink, whiteSpace: 'nowrap'}}>{shown(num(d.value * roll))}</div>
      <div style={{marginLeft: 20, fontFamily: AR, fontWeight: THIN, fontSize: S * 0.45, lineHeight: `${S * 0.45}px`, marginTop: SUF_TOP * S, color: NAVY.gold, opacity: ramp(f, 38, 18)}}>{d.suffix}</div>
    </div>
    <Rule top={lineY} width={CW} at={58} dur={26} color={NAVY.gold}/>
    <div style={{position: 'absolute', top: lineY + 28, [copy.side]: W - X1, width: CW, direction: 'ltr', textAlign: copy.align, fontFamily: MONO, fontWeight: 400, fontSize: 24, letterSpacing: 1.6,
      color: NAVY.dim, opacity: ramp(f, 76, 16), transform: `translateY(${(1 - ramp(f, 76, 20)) * 16}px)`}}>{d.source}</div>
  </Page>;
};

export const Proof:React.FC<FamilyDesignProps>=({scene})=>{
  if(scene.family!=='proof')return null;
  return <MagazineScope data={scene.data}><Drawing d={scene.data}/></MagazineScope>;
};
