import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {NAVY,W,X0,X1,CW,HEAVY,ramp,clamp01,Page,Headline,MagazineScope,useMagazine,useType,railInset} from './kit';
import {magazineCopy} from './copy';

const Drawing: React.FC<{d: {keyword: string; promise: string}; n?: string}> = ({d}) => {
  const f = useCurrentFrame();
  const {copy,font:AR}=useMagazine();
  const {planHeadline}=useType();
  const th = NAVY;
  const plan = planHeadline(magazineCopy('commentTitle',copy), {max: 112, min: 76, lines: 2});
  const boxTop = 690, boxH = 380, boxX = X0, boxW = CW;
  const frameP = ramp(f, 10, 36);
  const word = ramp(f, 34, 24);
  const caret = f > 50 ? (Math.floor(f / 15) % 2 === 0 ? 1 : 0) : 1;
  const KS = 250;
  return <Page th={th} section={magazineCopy('comments',copy)} page="26">
    <Headline plan={plan} th={th} top={338} at={2} marker markerAt={34}/>
    <div style={{position: 'absolute', top: boxTop, [copy.opposite]: boxX, width: boxW, height: boxH}}>
      <svg width={boxW} height={boxH} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <rect x="1" y="1" width={boxW - 2} height={boxH - 2} fill="rgba(245,243,236,0.035)" stroke={th.gold} strokeWidth="2" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - frameP}/>
        <rect x="13" y="13" width={boxW - 26} height={boxH - 26} fill="none" stroke={th.gold} strokeOpacity="0.45" strokeWidth="1" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ramp(f, 16, 36)}/>
      </svg>
      <div style={{position: 'absolute', top: -27, [copy.side]: 54, padding: '0 22px', background: th.ground, fontFamily: AR, fontWeight: 500, fontSize: 30, lineHeight: '54px', color: th.gold, direction: copy.dir, opacity: ramp(f, 22, 14)}}>{magazineCopy('readers',copy)}</div>
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: copy.dir, gap: 18}}>
        <div style={{height: KS * 1.35, overflow: 'hidden', display: 'flex', alignItems: 'center'}}>
          <div style={{fontFamily: AR, fontWeight: HEAVY, fontSize: KS, lineHeight: `${KS * 1.35}px`, color: th.ink, opacity: clamp01(word * 1.7), transform: `translateY(${(1 - word) * 30}px)`, whiteSpace: 'nowrap'}}>{d.keyword}</div>
        </div>
        <div style={{width: 9, height: KS * 0.74, background: th.gold, opacity: caret, marginTop: KS * 0.06}}/>
      </div>
    </div>
    <div style={{position: 'absolute', top: 1096, [copy.side]: W - X1+railInset(1096,88,copy.side), display: 'flex', alignItems: 'center', gap: 22, direction: copy.dir, opacity: clamp01(ramp(f, 56, 18) * 1.6), transform: `translateY(${(1 - ramp(f, 56, 22)) * 24}px)`}}>
      <svg width="48" height="56" viewBox="0 0 48 56" style={{flex: 'none'}}><path d="M24 52 L24 8 M8 24 L24 7 L40 24" fill="none" stroke={th.gold} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
      <span style={{fontFamily: AR, fontWeight: 500, fontSize: 48, lineHeight: '64px', color: th.ink, whiteSpace: 'nowrap'}}>{d.promise}</span>
    </div>
  </Page>;
};

export const Comment:React.FC<FamilyDesignProps>=({scene})=>{
  if(scene.family!=='comment')return null;
  return <MagazineScope data={scene.data}><Drawing d={scene.data}/></MagazineScope>;
};
