import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import {useTiming} from '../../../style-kit/design-safety';
import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {NAVY,W,X0,X1,CW,THIN,ramp,Page,Headline,Lines,Rule,QuoteGlyph,MagazineScope,useMagazine,useType,railInset} from './kit';

const Drawing: React.FC<{d: {chapter: string; title:string; quote: string; speaker: string; role: string;quoteFrame?:number}}> = ({d}) => {
  const f = useCurrentFrame();
  const {copy,font:AR}=useMagazine();
  const {fit,planHeadline}=useType();
  const th = NAVY;
  const timing=useTiming(),at=timing.frame(d.quoteFrame,20);
  const plan = planHeadline(d.quote, {max: 128, min: 70, lines: 4, width: CW - 220, maxHeight: 320});
  const chap = fit(d.title, {width: 600, size: 112, min: 70, lines: 1, weight: THIN});
  const q = ramp(f, timing.frame(at-6,14), 28), q2 = ramp(f, timing.frame(at+24,44), 26);
  const qTop = 516, textTop = 650;
  const textBottom = textTop + plan.height;
  return <Page th={th} section={d.title} page="33">
    <Lines text={d.title} top={332} width={600} size={chap.size} min={70} lines={1} weight={THIN} color={th.ink} at={2}/>
    <div style={{position: 'absolute', top: 332, [copy.opposite]: X0, fontFamily: AR, fontWeight: THIN, fontSize: 200, lineHeight: '200px', color: th.gold, opacity: ramp(f, 6, 24), direction: 'ltr', transform: `translateY(${(1 - ramp(f, 6, 26)) * 30}px)`}}>{d.chapter}</div>
    <Rule top={510} width={CW} at={12} dur={28} color={th.gold}/>
    <QuoteGlyph open size={300} color={th.gold} p={q} style={{top: qTop, [copy.side]: X0 - 8}}/>
    <Headline plan={plan} th={th} top={textTop} at={at} marker markerAt={timing.frame(at+40,60)} width={CW - 220} right={W - X1 + 10}/>
    <QuoteGlyph open={false} size={300} color={th.gold} p={q2} style={{top: textBottom - plan.box + Math.round(plan.box * 0.15) - 32, [copy.opposite]: X0 - 8}}/>
    <div style={{position: 'absolute', top: textBottom + 46, [copy.side]: W - X1+railInset(textBottom+46,104,copy.side), direction: copy.dir, opacity: ramp(f, timing.frame(at+50,70), 18)}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
        <div style={{width: 70 * ramp(f, timing.frame(at+46,66), 16), height: 2, background: th.gold}}/>
        <span style={{fontFamily: AR, fontWeight: headlineWeight(AR,'Alexandria',700), fontSize: 44, lineHeight: '60px', color: th.ink}}>{d.speaker}</span>
      </div>
      <div style={{fontFamily: AR, fontWeight: 400, fontSize: 30, lineHeight: '44px', color: th.dim, [copy.ar ? 'marginRight' : 'marginLeft']: 86}}>{d.role}</div>
    </div>
  </Page>;
};

export const ChapterQuote:React.FC<FamilyDesignProps>=({scene})=>{
  if(scene.family!=='chapter-quote')return null;
  return <MagazineScope data={scene.data}><Drawing d={scene.data}/></MagazineScope>;
};
