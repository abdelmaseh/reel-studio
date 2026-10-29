import {DesignText} from '../../../style-kit/digits';
import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {CREAM,W,X0,X1,CW,MONO,ramp,clamp01,Page,Headline,Kicker,MarkRing,MagazineScope,useMagazine,useType,railInset} from './kit';
import {magazineCopy} from './copy';

const Drawing: React.FC<{d: {kicker: string; title: string; variant: 'missing' | 'blueprint'; items: {label: string; detail: string; atFrame: number}[]}; n?: string}> = ({d}) => {
  const f = useCurrentFrame();
  const {copy,font:AR}=useMagazine();
  const {fit,planHeadline}=useType();
  const th = CREAM;
  const missing = d.variant === 'missing';
  const total = d.items.length;
  const plan = planHeadline(d.title, {max: 108, min: 76, lines: 2});
  const headTop = 412;
  const first = headTop + plan.height + 56;
  const rowH = total >= 4 ? 118 : 168;
  const R = total >= 4 ? 78 : 92;
  const gap = Math.min(rowH + 30, (1240 - first - rowH) / Math.max(1, total - 1));
  return <Page th={th} section={magazineCopy('review',copy)} page="11">
    <Kicker th={th} text={d.kicker} top={352} at={2}/>
    <Headline plan={plan} th={th} top={headTop} at={6}/>
    {d.items.map((it, i) => {
      const top = first + i * gap, at = it.atFrame;
      const k = ramp(f, at, 22);
      const ring = ramp(f, at + 2, 14), mark = ramp(f, at + 12, 14);
      const tt = fit(it.label, {width: 560, size: total >= 4 ? 50 : 58, min: 38, lines: 1, weight: 700, lh: 1.42});
      const inset=railInset(top,rowH+30,copy.side),oppositeInset=railInset(top,rowH+30,copy.opposite);
      return <React.Fragment key={i}>
        <div style={{position: 'absolute', top: top + (rowH - R) / 2 - 6, [copy.side]: W - X1 + inset}}>
          <MarkRing size={R} ring={ring} mark={mark} kind={missing ? 'cross' : 'check'} ringColor={missing ? th.faint.replace('0.10', '0.5') : th.gold} markColor={missing ? th.ink : th.gold} fillColor={th.gold} fill={ramp(f, at + 24, 12)}/>
        </div>
        <div data-cue-at={at} data-event-progress={k} style={{position: 'absolute', top: top + (rowH - tt.box - 46) / 2 - 6, [copy.side]: W - X1 + R + 34 + inset, direction: copy.dir, whiteSpace: 'nowrap', opacity: clamp01(k * 1.7), transform: `translateY(${(1 - k) * 30}px)`}}>
          <div style={{fontFamily: AR, fontWeight: headlineWeight(AR,'Alexandria',700), fontSize: tt.size, lineHeight: `${tt.box}px`, color: th.ink}}>{it.label}</div>
          <div style={{fontFamily: AR, fontWeight: 400, fontSize: total >= 4 ? 30 : 34, lineHeight: '46px', color: th.dim}}>{it.detail}</div>
        </div>
        {missing
          ? <div style={{position: 'absolute', top: top + rowH / 2 - 32, [copy.opposite]: X0+oppositeInset, height: 46, padding: '0 22px', background: th.gold, color: '#FFF7E4', fontFamily: AR, fontWeight: headlineWeight(AR,'Alexandria',700), fontSize: 28, lineHeight: '46px', direction: copy.dir,
            opacity: ramp(f, at + 16, 10), transform: `translateX(${(1 - ramp(f, at + 16, 16)) * (copy.ar?-24:24)}px)`}}>{magazineCopy('missing',copy)}</div>
          : <div style={{position: 'absolute', top: top + rowH / 2 - 22, [copy.opposite]: X0+oppositeInset, fontFamily: MONO, fontWeight: 400, fontSize: 30, color: th.dim, opacity: ramp(f, at + 14, 14), direction: 'ltr'}}><DesignText>{`0${i + 1}`}</DesignText></div>}
        {i < total - 1 ? <div style={{position: 'absolute', top: top + rowH + (gap - rowH) / 2 - 7, [copy.side]: W - X1, width: CW * ramp(f, at + 8, 26), height: 1.5, background: th.hair}}/> : null}
      </React.Fragment>;
    })}
  </Page>;
};

export const Checklist:React.FC<FamilyDesignProps>=({scene})=>{
  if(scene.family!=='checklist')return null;
  return <MagazineScope data={scene.data}><Drawing d={scene.data}/></MagazineScope>;
};
