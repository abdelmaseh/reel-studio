import {useDesignData} from '../../../style-kit/digits';
// Fixed chapter-deck design; only scene data and theme tokens vary.
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {W, X1, CW, clamp01, ramp, pop, mix, MaskLines, Ground, usePalette, sectionNumeral, sceneCopy} from './kit';

export const Comment: React.FC<FamilyDesignProps> = ({scene, sectionIndex}) => {
  if (scene.family !== 'comment') return null;
  const d = useDesignData(scene.data);
  const copy = sceneCopy(d);
  const n = sectionNumeral(sectionIndex);
  const P = usePalette(copy.ar);
  const f = useCurrentFrame();
  const box = pop(f, 10, 13, 170), word = ramp(f, 26, 14);
  const caret = f > 40 ? (Math.floor(f / 15) % 2 === 0 ? 1 : 0) : 1;
  return <AbsoluteFill style={copy.ar ? undefined : {direction:copy.dir}}>
    <Ground copy={copy} tone={1} numeral={n}/>
    <MaskLines copy={copy} text={copy.label('templateLine')} top={330} size={92} min={64} lines={2} at={2}/>
    <div style={{position: 'absolute', top: 640, [copy.side]: W - X1, width: CW, height: 300, borderRadius: 44, border: `5px solid ${P.accent}`, boxSizing: 'border-box',
      background: 'rgba(255,255,255,0.06)', transform: `scale(${mix(0.85, 1, box)})`, opacity: clamp01(box * 1.5), display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
      padding: '0 56px', direction: copy.dir, gap: 10, boxShadow: '0 30px 80px rgba(0,0,0,0.4)'}}>
      <span style={{fontFamily: P.font, fontWeight: 900, fontSize: 176, color: P.ink, clipPath: copy.ar ? `inset(-20% 0 -20% ${(1 - word) * 100}%)` : `inset(-20% ${(1 - word) * 100}% -20% 0)`, lineHeight: 1.1}}>{d.keyword}</span>
      <div style={{width: 9, height: 150, background: P.accent, opacity: caret, borderRadius: 5}}/>
      <div style={{position: 'absolute', top: -34, [copy.side]: 60, background: P.accent, color: P.accentInk, fontFamily: P.font, fontWeight: 800, fontSize: 30,
        borderRadius: 14, padding: '2px 18px'}}>{copy.label('commentBadge')}</div>
    </div>
    <div style={{position: 'absolute', top: 1010, [copy.side]: W - X1, width: CW, display: 'flex', gap: 20, alignItems: 'flex-start', direction: copy.dir,
      opacity: ramp(f, 48, 14), transform: `translateY(${(1 - ramp(f, 48, 18)) * 24}px)`}}>
      <svg width="64" height="64" viewBox="0 0 100 100" style={{flex: 'none', marginTop: 8, ...(copy.ar ? {} : {transform:'scaleX(-1)'})}}><path d="M80 50 L24 50 M44 28 L22 50 L44 72" fill="none" stroke={P.accent} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/></svg>
      <MaskLines copy={copy} text={d.promise} top={0} width={CW - 90} size={58} min={42} lines={2} weight={700} at={48} right={0}/>
    </div>
  </AbsoluteFill>;
};
