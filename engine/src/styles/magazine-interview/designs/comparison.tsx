import {DesignText} from '../../../style-kit/digits';
import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {CREAM,W,X1,THIN,HEAVY,ramp,clamp01,mix,Page,Headline,Diamond,MagazineScope,useMagazine,useType} from './kit';
import {magazineCopy} from './copy';

const Drawing: React.FC<{d: {title: string; beforeTitle: string; beforeDetail: string; afterTitle: string; afterDetail: string}; n?: string}> = ({d}) => {
  const f = useCurrentFrame();
  const {copy,font:AR}=useMagazine();
  const {fit,wid,planHeadline,planColumn}=useType();
  const th = CREAM;
  const plan = planHeadline(d.title, {max: 112, min: 76, lines: 2});
  const colW = 428, colTop = 700;
  const detailB = planColumn(d.beforeDetail, colW, 92, THIN), detailA = planColumn(d.afterDetail, colW, 92, HEAVY);
  const dim = ramp(f, 70, 18);
  const colRight = [W - X1, W - X1 + colW + 94]; // right offsets of the before (right) and after (left) columns
  const Col: React.FC<{i: 0 | 1; label: string; title: string; plan: {lines: string[]; size: number; box: number}; at: number}> = ({i, label, title, plan: pl, at}) => {
    const k = ramp(f, at, 22);
    const after = i === 1;
    const tt = fit(title, {width: colW, size: 44, min: 34, lines: 1, weight: 700});
    const tw = wid(title, tt.size, 700);
    return <div style={{position: 'absolute', top: colTop, [copy.side]: colRight[i], width: colW, direction: copy.dir, opacity: after ? 1 : mix(1, 0.62, dim), transform: `translateY(${(1 - k) * 30}px)`}}>
      <div style={{opacity: clamp01(k * 1.7)}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <Diamond color={th.gold} size={12}/>
          <span style={{fontFamily: AR, fontWeight: 600, fontSize: 32, lineHeight: '44px', color: th.gold}}><DesignText>{label}</DesignText></span>
        </div>
        <div style={{position: 'relative', marginTop: 16, height: tt.box, fontFamily: AR, fontWeight: headlineWeight(AR,'Alexandria',700), fontSize: tt.size, lineHeight: `${tt.box}px`, color: after ? th.ink : th.dim, whiteSpace: 'nowrap'}}>
          {after ? <div style={{position: 'absolute', [copy.side]: -10, top: tt.box * 0.8 - tt.size * 0.12, height: tt.size * 0.43, width: (tw + 20) * ramp(f, at + 30, 22), background: th.gold, opacity: 0.55}}/> : null}
          <span style={{position: 'relative'}}>{title}</span>
        </div>
        <div style={{height: 1.5, background: th.hair, marginTop: 22, marginBottom: 20}}/>
        {pl.lines.map((l, j) => <div key={j} style={{fontFamily: AR, fontWeight: after ? HEAVY : THIN, fontSize: pl.size, lineHeight: `${pl.box}px`, color: after ? th.ink : th.dim, whiteSpace: 'nowrap'}}>{l}</div>)}
      </div>
    </div>;
  };
  const midX = (W - X1) + colW + 47;
  const vr = ramp(f, 30, 28);
  return <Page th={th} section={magazineCopy('beforeAfter',copy)} page="14">
    <Headline plan={plan} th={th} top={340} at={2}/>
    <Col i={0} label={magazineCopy('before',copy)} title={d.beforeTitle} plan={detailB} at={22}/>
    <div style={{position: 'absolute', top: colTop, [copy.side]: midX - 1, width: 2, height: 520 * vr, background: th.gold}}/>
    <div style={{position: 'absolute', top: colTop - 6 + 520 * vr, [copy.side]: midX - 6, opacity: ramp(f, 46, 10)}}><Diamond color={th.gold} size={12}/></div>
    <Col i={1} label={magazineCopy('after',copy)} title={d.afterTitle} plan={detailA} at={52}/>
  </Page>;
};

export const Comparison:React.FC<FamilyDesignProps>=({scene})=>{
  if(scene.family!=='comparison')return null;
  return <MagazineScope data={scene.data}><Drawing d={scene.data}/></MagazineScope>;
};
