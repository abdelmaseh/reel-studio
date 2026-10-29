import {DesignText} from '../../../style-kit/digits';
import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {NAVY,W,X0,X1,SERIF,ramp,clamp01,Page,MagazineScope,useMagazine,useType} from './kit';
import {magazineCopy} from './copy';

const Drawing: React.FC<{d: {handle: string; message: string}; n?: string; tap: number}> = ({d, tap}) => {
  const f = useCurrentFrame();
  const {copy,font:AR}=useMagazine();
  const {fit,wid}=useType();
  const th = NAVY;
  const ringP = ramp(f, 12, 34), inner = ramp(f, 18, 34), frameP = ramp(f, 2, 40);
  const letter = d.handle.replace('@', '').slice(0, 1).toUpperCase();
  const press = f >= tap && f < tap + 5 ? 0.97 : 1;
  const followed = f >= tap + 3;
  const fillP = ramp(f, tap + 3, 8);
  const msg = fit(d.message, {width: 760, size: 48, min: 34, lines: 1, weight: 400});
  const hs = fit(d.handle, {width: 800, size: 116, min: 60, lines: 1, weight: 400, family: SERIF, lh: 1.1});
  const R = 160, cx = 540, cy = 590;
  // The card frame: a thin gold line with a gap on the top edge where the corner label sits.
  const fTop = 346, fBottom = 1170;
  const label = magazineCopy('contributorPage',copy);
  const labelW = wid(label, 30, 600);
  const gapRight = X1 - 40, gapLeft = gapRight - labelW - 36;
  const handleTop = 790;
  return <Page th={th} section={magazineCopy('contributors',copy)} page="30">
    <svg width={W} height={1920} style={{position: 'absolute', [copy.opposite]: 0, top: 0, overflow: 'visible'}}>
      <path d={`M ${gapLeft} ${fTop} H ${X0} V ${fBottom} H ${X1} V ${fTop} H ${gapRight}`} transform={copy.ar ? undefined : `translate(${W} 0) scale(-1 1)`} fill="none" stroke={th.gold} strokeWidth="1.5" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - frameP}/>
    </svg>
    <div style={{position: 'absolute', top: fTop - 19, [copy.side]: W - gapRight + 18, fontFamily: AR, fontWeight: 600, fontSize: 30, lineHeight: '38px', color: th.gold, direction: copy.dir, whiteSpace: 'nowrap', opacity: ramp(f, 18, 14)}}><DesignText>{label}</DesignText></div>
    <svg width="480" height="480" viewBox="0 0 480 480" style={{position: 'absolute', [copy.opposite]: cx - 240, top: cy - 240, overflow: 'visible'}}>
      <circle cx="240" cy="240" r={R + 12} fill="none" stroke={th.gold} strokeWidth="2.4" transform="rotate(-90 240 240)" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ringP}/>
      <circle cx="240" cy="240" r={R - 6} fill="rgba(245,243,236,0.04)" stroke={th.gold} strokeOpacity="0.5" strokeWidth="1" transform="rotate(-90 240 240)" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - inner}/>
    </svg>
    <div style={{position: 'absolute', [copy.opposite]: cx - 160, top: cy - 160, width: 320, height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400,
      fontSize: 210, lineHeight: 1, color: th.ink, opacity: clamp01(ramp(f, 26, 18) * 1.5), transform: `translateY(${(1 - ramp(f, 26, 22)) * 24 - 6}px)`}}>{letter}</div>
    <div style={{position: 'absolute', top: handleTop, [copy.opposite]: copy.ar?0:X0, width: copy.ar?W:W-2*X0, textAlign: copy.ar?'center':'left', direction: 'ltr', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: hs.size, lineHeight: `${hs.box}px`, color: th.ink,
      opacity: clamp01(ramp(f, 30, 18) * 1.6), transform: `translateY(${(1 - ramp(f, 30, 22)) * 30}px)`}}>{d.handle}</div>
    <div style={{position: 'absolute', top: handleTop + hs.box + 4, [copy.opposite]: W / 2 - 60 * ramp(f, 44, 20), width: 120 * ramp(f, 44, 20), height: 2, background: th.gold}}/>
    <div style={{position: 'absolute', top: handleTop + hs.box + 26, [copy.opposite]: copy.ar?0:X0, width: copy.ar?W:W-2*X0, textAlign: copy.ar?'center':'left', direction: copy.dir, fontFamily: AR, fontWeight: 400, fontSize: msg.size, lineHeight: `${msg.box}px`, color: th.dim,
      opacity: clamp01(ramp(f, 46, 18) * 1.6), transform: `translateY(${(1 - ramp(f, 46, 22)) * 24}px)`}}>{d.message}</div>
    <div style={{position: 'absolute', top: 1034, [copy.opposite]: 270, width: 540, height: 96, transform: `scale(${press})`, opacity: clamp01(ramp(f, 56, 16) * 1.6)}}>
      <div style={{position: 'absolute', inset: 0, border: `1.5px solid ${th.gold}`, boxSizing: 'border-box'}}/>
      <div style={{position: 'absolute', inset: 0, background: th.gold, clipPath: copy.ar ? `inset(0 0 0 ${(1 - fillP) * 100}%)` : `inset(0 ${(1 - fillP) * 100}% 0 0)`}}/>
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, direction: copy.dir}}>
        {followed ? <svg width="44" height="44" viewBox="0 0 100 100"><path d="M24 53 L43 72 L78 31" fill="none" stroke={th.tagInk} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ramp(f, tap + 4, 10)}/></svg> : null}
        <span style={{fontFamily: AR, fontWeight: headlineWeight(AR,'Alexandria',700), fontSize: 46, lineHeight: '64px', color: followed && fillP > 0.5 ? th.tagInk : th.gold, whiteSpace: 'nowrap'}}>{followed ? magazineCopy('followed',copy) : magazineCopy('follow',copy)}</span>
      </div>
    </div>
  </Page>;
};

export const Follow:React.FC<FamilyDesignProps>=({scene})=>{
  if(scene.family!=='follow')return null;
  return <MagazineScope data={scene.data}><Drawing d={scene.data} tap={80}/></MagazineScope>;
};
