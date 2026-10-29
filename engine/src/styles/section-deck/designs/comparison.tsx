import {useDesignData} from '../../../style-kit/digits';
// Fixed chapter-deck design; only scene data and theme tokens vary.
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {W, X1, CW, expo, ramp, pop, mix, MaskLines, Ground, Check, usePalette, sectionNumeral, sceneCopy} from './kit';

export const Comparison: React.FC<FamilyDesignProps> = ({scene, sectionIndex}) => {
  if (scene.family !== 'comparison') return null;
  const d = useDesignData(scene.data);
  const copy = sceneCopy(d);
  const n = sectionNumeral(sectionIndex);
  const P = usePalette(copy.ar);
  const f = useCurrentFrame();
  const b = pop(f, 18, 15, 150), wipe = ramp(f, 58, 18), dimB = ramp(f, 62, 16);
  const punch = 1 + 0.04 * Math.max(0, 1 - Math.abs(f - 78) / 7) * (f >= 74 ? 1 : 0);
  const strike = ramp(f, 52, 12, expo);
  const Panel: React.FC<{top: number; title: string; detail: string; after?: boolean}> = ({top, title, detail, after}) =>
    <div style={{position: 'absolute', top, [copy.side]: W - X1, width: CW, height: after ? 290 : 250, borderRadius: 28, boxSizing: 'border-box', padding: after ? '36px 44px' : '30px 40px',
      background: after ? P.accent : 'rgba(255,255,255,0.06)', border: after ? 'none' : `2px solid ${P.faint}`, direction: copy.dir,
      boxShadow: after ? '0 30px 60px rgba(0,0,0,0.35)' : 'none'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
        <div style={{width: 52, height: 52, borderRadius: 26, background: after ? P.accentInk : 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          {after ? <Check p={1} size={52} color={P.accent}/> : <svg width="52" height="52" viewBox="0 0 100 100"><path d="M34 34 L66 66 M66 34 L34 66" stroke={P.dim} strokeWidth="10" strokeLinecap="round"/></svg>}
        </div>
        <span style={{fontFamily: P.font, fontWeight: 800, fontSize: 40, color: after ? P.accentInk : P.dim}}>{title}</span>
      </div>
      <div style={{position: 'relative', display: 'inline-block', fontFamily: P.font, fontWeight: after ? 900 : 700, fontSize: after ? 80 : 56, lineHeight: 1.3, marginTop: after ? 14 : 18, color: after ? P.accentInk : P.ink, whiteSpace: 'nowrap'}}>
        {detail}
        {/* The old way gets crossed out the moment the new one arrives. */}
        {after ? null : <div style={{position: 'absolute', top: '54%', [copy.side]: -10, width: `calc(${strike * 100}% + 20px)`, height: 7, borderRadius: 4, background: P.accent, opacity: strike > 0 ? 1 : 0}}/>}
      </div>
    </div>;
  return <AbsoluteFill style={copy.ar ? undefined : {direction:copy.dir}}>
    <Ground copy={copy} tone={0} numeral={n}/>
    <MaskLines copy={copy} text={d.title} top={300} size={110} min={72} lines={2} at={2}/>
    <AbsoluteFill style={{opacity: mix(1, 0.5, dimB), transform: `translateY(${(1 - b) * 60}px) scale(${mix(1, 0.96, dimB)})`, transformOrigin: '50% 725px'}}>
      <Panel top={600} title={d.beforeTitle} detail={d.beforeDetail}/></AbsoluteFill>
    <div style={{position: 'absolute', top: 862, left: W / 2 - 28, opacity: ramp(f, 50, 10)}}>
      <svg width="56" height="44" viewBox="0 0 56 44"><path d="M8 8 L28 34 L48 8" fill="none" stroke={P.accent} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
    <AbsoluteFill style={{clipPath: copy.ar ? `inset(0 0 0 ${(1 - wipe) * 100}%)` : `inset(0 ${(1 - wipe) * 100}% 0 0)`, transform: `scale(${punch})`, transformOrigin: '50% 1045px'}}>
      <Panel top={900} title={d.afterTitle} detail={d.afterDetail} after/></AbsoluteFill>
  </AbsoluteFill>;
};
