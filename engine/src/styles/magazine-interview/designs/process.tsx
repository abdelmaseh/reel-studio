import {DesignText} from '../../../style-kit/digits';
import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {NAVY,W,X0,X1,CW,THIN,SERIF,ramp,clamp01,Page,Headline,MagazineScope,useMagazine,useType,railInset} from './kit';
import {magazineCopy} from './copy';

const Drawing: React.FC<{d: {title: string; steps: {title: string; detail: string}[]}; n?: string}> = ({d}) => {
  const f = useCurrentFrame();
  const {copy,font:AR}=useMagazine();
  const {fit,wid,planHeadline}=useType();
  const plan = planHeadline(d.title, {max: 118, min: 80, lines: 2});
  const rowTop = 690, rowH = 180;
  const NS = 150;
  const numW = Math.max(wid('01', NS, THIN), wid('02', NS, THIN), wid('03', NS, THIN)) + 4;
  const pages = ['12', '24', '36'];
  const ats = [30, 52, 74];
  return <Page th={NAVY} section={magazineCopy('contents',copy)} page="03">
    <Headline plan={plan} th={NAVY} top={336} at={4} marker markerAt={34}/>
    {d.steps.map((s, i) => {
      const top = rowTop + i * rowH, at = ats[i];
      const k = ramp(f, at, 22);
      const tt = fit(s.title, {width: 560, size: 62, min: 44, lines: 1, weight: 700});
      const tw = wid(s.title, tt.size, 700);
      const titleRight = X1 - numW - 40;
      const dotsRight = titleRight - tw - 30;
      const dotsW = dotsRight - (X0 + 92);
      const inset=railInset(top-6,NS+30,copy.side);
      return <React.Fragment key={i}>
        <div style={{position: 'absolute', top: top - 6, [copy.side]: W - X1+railInset(top-6,NS+30,copy.side), width: numW, fontFamily: AR, fontWeight: THIN, fontSize: NS, lineHeight: `${NS}px`, color: NAVY.gold, direction: 'ltr', textAlign: copy.align,
          opacity: clamp01(k * 1.7), transform: `translateY(${(1 - k) * 30}px)`}}><DesignText>{`0${i + 1}`}</DesignText></div>
        <div style={{position: 'absolute', top: top + 8, [copy.side]: W - titleRight+inset, direction: copy.dir, opacity: clamp01(k * 1.7), transform: `translateY(${(1 - k) * 30}px)`, whiteSpace: 'nowrap'}}>
          <div style={{fontFamily: AR, fontWeight: headlineWeight(AR,'Alexandria',700), fontSize: tt.size, lineHeight: `${tt.box}px`, color: NAVY.ink}}>{s.title}</div>
          <div style={{fontFamily: AR, fontWeight: 400, fontSize: 36, lineHeight: '52px', color: NAVY.dim}}>{s.detail}</div>
        </div>
        <div style={{position: 'absolute', top: top + 8 + tt.box * 0.74, [copy.side]: W - dotsRight+inset, width: Math.max(0,dotsW-inset) * ramp(f, at + 8, 24), height: 4, overflow: 'hidden',
          backgroundImage: `radial-gradient(circle, ${NAVY.gold} 1.7px, transparent 2.3px)`, backgroundSize: '13px 4px', backgroundRepeat: 'repeat-x', backgroundPosition: '100% 50%'}}/>
        <div style={{position: 'absolute', top: top + 8, [copy.opposite]: X0, fontFamily: SERIF, fontWeight: 400, fontSize: 40, lineHeight: `${tt.box}px`, color: NAVY.gold, opacity: ramp(f, at + 14, 16), direction: 'ltr'}}><DesignText>{pages[i]}</DesignText></div>
        {i < 2 ? <div style={{position: 'absolute', top: top + rowH - 16, [copy.side]: W - X1, width: CW * ramp(f, at + 6, 26), height: 1, background: NAVY.faint}}/> : null}
      </React.Fragment>;
    })}
  </Page>;
};

export const Process:React.FC<FamilyDesignProps>=({scene})=>{
  if(scene.family!=='process')return null;
  return <MagazineScope data={scene.data}><Drawing d={scene.data}/></MagazineScope>;
};
