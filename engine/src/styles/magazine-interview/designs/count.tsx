import {DesignText} from '../../../style-kit/digits';
import {useDesignText} from '../../../style-kit/digits';
import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import {useTiming,countTiming} from '../../../style-kit/design-safety';
import React from 'react';
import {AbsoluteFill,Easing,useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {NAVY,W,X0,X1,CW,THIN,SUF_TOP,SERIF,ramp,clamp01,num,Headline,Kicker,Rule,Ground,Furniture,Diamond,MagazineScope,useMagazine,useType} from './kit';
import {magazineCopy} from './copy';

const Drawing: React.FC<{d: {kicker: string; title: string; value: number; suffix: string; unit: string; badge?: string;rollFrame?:number;rollDuration?:number;unitFrame?:number;badgeFrame?:number}; n?: string; seam: number}> = ({d, seam}) => {
  const shown = useDesignText();
  const f = useCurrentFrame();
  const {copy,font:AR}=useMagazine();
  const {wid,planHeadline}=useType();
  const th = NAVY;
  const final = shown(num(d.value));
  const timing=countTiming(d,useTiming(),{roll:24,duration:44,unit:66,badge:84});
  const roll = ramp(f, timing.roll, timing.duration, Easing.bezier(0.2, 0.7, 0.2, 1));
  let S = 400;
  for (; S > 200; S -= 4) if (wid(final, S, THIN) + 24 + wid(d.suffix, S * 0.45, THIN) <= CW) break;
  S=Math.min(S,Math.max(120,(seam-88-650-72)/.82));
  const numW = wid(final, S, THIN) + 6;
  const plan = planHeadline(d.title, {max: 84, min: 60, lines: 2});
  const numTop = 650;
  const boxH = Math.round(S * 0.82);
  return <AbsoluteFill>
    <AbsoluteFill style={{clipPath: `inset(0 0 ${1920 - seam}px 0)`}}>
      <Ground th={th} height={seam}/>
      <Furniture th={th} section={magazineCopy('figures',copy)} page="22" bottom={false}/>
      <Kicker th={th} text={d.kicker} top={340} at={2}/>
      <Headline plan={plan} th={th} top={402} at={6}/>
      <div style={{position: 'absolute', top: numTop, [copy.side]: W - X1, width: CW, height: boxH, direction: 'ltr', display: 'flex', justifyContent: copy.ar ? 'flex-end' : 'flex-start', alignItems: 'flex-start',
        opacity: clamp01(ramp(f, Math.min(14,timing.roll), 14) * 1.6), transform: `translateY(${(1 - ramp(f, Math.min(14,timing.roll), 26)) * 30}px)`}}>
        <div style={{width: numW, fontFamily: AR, fontWeight: THIN, fontSize: S, lineHeight: `${S}px`, marginTop: -S * 0.12, color: th.ink, whiteSpace: 'nowrap'}} data-count-progress={roll}>{shown(num(d.value * roll))}</div>
        <div style={{marginLeft: 18, fontFamily: AR, fontWeight: THIN, fontSize: S * 0.45, lineHeight: `${S * 0.45}px`, marginTop: SUF_TOP * S, color: th.gold, opacity: ramp(f, 40, 18)}}>{d.suffix}</div>
      </div>
      <div style={{position: 'absolute', top: numTop + boxH + 8, [copy.side]: W - X1, display: 'flex', gap: 20, alignItems: 'center', direction: copy.dir, opacity: 1}}>
        <Diamond color={th.gold} size={11}/>
        <span style={{fontFamily: AR, fontWeight: 500, opacity:ramp(f,timing.unit,16), fontSize: 40, lineHeight: '52px', color: th.dim}}><DesignText>{d.unit}</DesignText></span>
        {d.badge ? <span style={{fontFamily: AR, fontWeight: headlineWeight(AR,'Alexandria',700), fontSize: 28, lineHeight: '40px', color: th.tagInk, background: th.gold, padding: '0 16px', opacity: ramp(f, timing.badge, 10)}}>{d.badge}</span> : null}
      </div>
    </AbsoluteFill>
    <Rule top={seam - 1} width={CW} at={4} dur={26} color={th.gold}/>
    <div style={{position: 'absolute', top: seam - 21, [copy.opposite]: X0, height: 40, padding: '0 18px', background: th.ground, border: `1.5px solid ${th.gold}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center',
      fontFamily: SERIF, fontWeight: 400, fontSize: 30, letterSpacing: 1, color: th.gold, direction: 'ltr', opacity: ramp(f, 14, 14)}}><DesignText>{"22"}</DesignText></div>
  </AbsoluteFill>;
};

export const CountSplit:React.FC<FamilyDesignProps>=({scene,seam})=>{
  if(scene.family!=='count')return null;
  return <MagazineScope data={scene.data}><Drawing d={scene.data} seam={seam}/></MagazineScope>;
};
