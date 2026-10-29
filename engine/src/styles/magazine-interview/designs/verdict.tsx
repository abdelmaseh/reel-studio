import {DesignText} from '../../../style-kit/digits';
import {useDesignData} from '../../../style-kit/digits';
import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {CREAM,W,X0,X1,CW,HEAVY,SERIF,ramp,clamp01,mix,Page,Headline,MagazineScope,useMagazine,useType} from './kit';
import {magazineCopy} from './copy';

const Drawing: React.FC<{d: {question: string; rows: {label: string; value: number; outOf: number;atFrame:number}[]; verdict: string;verdictFrame:number}}> = ({d}) => {
  const f = useCurrentFrame();
  const {copy,font:AR}=useMagazine();
  const {fit,planHeadline}=useType();
  const th = CREAM;
  const plan = planHeadline(d.question, {max: 124, min: 84, lines: 2});
  const rowTop = 342 + plan.height + 58;
  const rowH = 116;

  const stampAt = d.verdictFrame;
  const st = ramp(f, stampAt, 14), frameP = ramp(f, stampAt - 4, 22);
  const vt = fit(d.verdict, {width: 690, size: 92, min: 60, lines: 1, weight: 800});
  const stampTop = rowTop + rowH * d.rows.length + 28;
  return <Page th={th} section={magazineCopy('judgment',copy)} page="36">
    <Headline plan={plan} th={th} top={342} at={2} marker markerAt={34}/>
    {d.rows.map((r, i) => {
      const top = rowTop + i * rowH, at = r.atFrame;
      const k = ramp(f, at, 22), fill = ramp(f, at + 6, 34);
      const valW = 200;
      return <React.Fragment key={i}>
        <div data-cue-at={at} data-event-progress={k} style={{position: 'absolute', top: top, [copy.side]: W - X1, direction: copy.dir, whiteSpace: 'nowrap', fontFamily: AR, fontWeight: headlineWeight(AR,'Alexandria',700), fontSize: 52, lineHeight: '68px', color: th.ink,
          opacity: clamp01(k * 1.7), transform: `translateY(${(1 - k) * 30}px)`}}>{r.label}</div>
        <div style={{position: 'absolute', top: top + 2, [copy.opposite]: X0, width: valW, textAlign: 'left', direction: 'ltr', fontFamily: SERIF, fontWeight: 400, fontSize: 56, lineHeight: '66px', color: th.ink,
          opacity: clamp01(k * 1.7)}}><DesignText>{Math.round(r.value * fill)}</DesignText><span style={{color: th.dim, fontSize: 34}}><DesignText>{`/${r.outOf}`}</DesignText></span></div>
        <div style={{position: 'absolute', top: top + 86, [copy.side]: W - X1, width: CW, height: 8, background: th.faint, opacity: clamp01(k * 2)}}/>
        <div style={{position: 'absolute', top: top + 86, [copy.side]: W - X1, width: CW * (r.outOf === 0 ? 0 : r.value / r.outOf) * fill, height: 8, background: th.gold}}/>
        <div style={{position: 'absolute', top: top + 80, [copy.side]: W - X1 + CW * (r.outOf === 0 ? 0 : r.value / r.outOf) * fill - 2, width: 3, height: 20, background: th.gold, opacity: fill > 0.02 ? 1 : 0}}/>
      </React.Fragment>;
    })}
    <div data-cue-at={stampAt} data-event-progress={st} style={{position: 'absolute', top: stampTop, left: X0, width: 853 - X0, height: 136, transform: `rotate(-2.5deg) scale(${mix(1.1, 1, st)})`, opacity: clamp01(st * 2)}}>
      <svg width={853 - X0} height="136" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <rect x="2" y="2" width={853 - X0 - 4} height="132" fill="none" stroke={th.gold} strokeWidth="3.5" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - frameP}/>
        <rect x="12" y="12" width={853 - X0 - 24} height="112" fill="none" stroke={th.gold} strokeOpacity="0.55" strokeWidth="1.2" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - frameP}/>
      </svg>
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: copy.dir, whiteSpace: 'nowrap', color: th.gold, fontFamily: AR, fontSize: vt.size, lineHeight: '110px'}}>
        <span style={{fontWeight: 300}}>{d.verdict.includes(':') ? d.verdict.slice(0,d.verdict.indexOf(':')) + ':' : ''}</span>
        <span style={{fontWeight: HEAVY, [copy.ar ? 'marginRight' : 'marginLeft']: d.verdict.includes(':') ? 22 : 0}}>{d.verdict.includes(':') ? d.verdict.slice(d.verdict.indexOf(':')+1).trim() : d.verdict}</span>
      </div>
    </div>
  </Page>;
};

export const Verdict:React.FC<FamilyDesignProps>=({scene})=>{
  if(scene.family!=='verdict')return null;
  const data = useDesignData(scene.data);
  return <MagazineScope data={data}><Drawing d={data}/></MagazineScope>;
};
