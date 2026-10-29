import {useDesignData} from '../../../style-kit/digits';
// Fixed chapter-deck design; only scene data and theme tokens vary.
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {X0, CW, clamp01, ramp, pop, Ground, Check, usePalette, sectionNumeral, sceneCopy} from './kit';

export const Follow: React.FC<FamilyDesignProps> = ({scene, sectionIndex}) => {
  if (scene.family !== 'follow') return null;
  const d = useDesignData(scene.data);
  const copy = sceneCopy(d);
  const n = sectionNumeral(sectionIndex);
  const tap = 80;
  const P = usePalette(copy.ar);
  const f = useCurrentFrame();
  const card = pop(f, 6, 14, 150);
  const press = f >= tap && f < tap + 6 ? 0.93 : 1, followed = f >= tap + 4;
  const letter = d.handle.replace('@', '').slice(0, 1).toUpperCase();
  return <AbsoluteFill style={copy.ar ? undefined : {direction:copy.dir}}>
    <Ground copy={copy} tone={2} numeral={n}/>
    <div style={{position: 'absolute', top: 330, [copy.opposite]: X0, width: CW, height: 900, transform: `translateY(${(1 - card) * 80}px)`, opacity: clamp01(card * 1.4),
      display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <div style={{width: 300, height: 300, borderRadius: 150, border: `7px solid ${P.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: P.font, fontWeight: 900, fontSize: 168, color: P.ink, background: 'rgba(255,255,255,0.05)'}}>{letter}</div>
      <div style={{marginTop: 46, fontFamily: P.font, fontWeight: 900, fontSize: 112, color: P.ink, direction: 'ltr', lineHeight: 1.1}}>{d.handle}</div>
      <div style={{marginTop: 22, width: 860, textAlign: 'center', fontFamily: P.font, fontWeight: 600, fontSize: 52, lineHeight: 1.35, color: P.dim, direction: copy.dir}}>{d.message}</div>
      <div style={{marginTop: 64, width: 600, height: 140, borderRadius: 70, transform: `scale(${press})`, boxSizing: 'border-box',
        background: followed ? 'transparent' : P.accent, border: `5px solid ${P.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, direction: copy.dir}}>
        {followed ? <Check p={ramp(f, tap + 4, 10)} size={64} color={P.accent}/> : null}
        <span style={{fontFamily: P.font, fontWeight: 900, fontSize: 54, color: followed ? P.accent : P.accentInk}}>{followed ? copy.label('following') : copy.label('followPill')}</span>
      </div>
    </div>
  </AbsoluteFill>;
};
