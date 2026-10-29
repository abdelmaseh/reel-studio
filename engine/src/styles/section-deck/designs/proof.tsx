import {useDesignData, useDesignText} from '../../../style-kit/digits';
// Fixed chapter-deck design; only scene data and theme tokens vary.
import React from 'react';
import {AbsoluteFill, Easing, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {W, X1, CW, ramp, pop, mix, num, MaskLines, Ground, usePalette, useFit, sectionNumeral, sceneCopy} from './kit';

export const Proof: React.FC<FamilyDesignProps> = ({scene, sectionIndex}) => {
  if (scene.family !== 'proof') return null;
  const d = useDesignData(scene.data);
  const shown = useDesignText();
  const copy = sceneCopy(d);
  const n = sectionNumeral(sectionIndex);
  const P = usePalette(copy.ar), fit = useFit(copy.ar);
  const f = useCurrentFrame();
  const roll = ramp(f, 22, 40, Easing.bezier(0.2, 0.8, 0.2, 1));
  const punch = 1 + 0.07 * Math.max(0, 1 - Math.abs(f - 64) / 8) * (f >= 62 ? 1 : 0);
  const value = shown(num(d.value * roll));
  const fitted = fit(shown(num(d.value)) + d.suffix, {width: CW, size: 470, min: 160, lines: 1, weight: 900, lh: 1});
  const size = fitted.size;
  return <AbsoluteFill style={copy.ar ? undefined : {direction:copy.dir}}>
    <Ground copy={copy} tone={1} numeral={n}/>
    <MaskLines copy={copy} text={d.label} top={320} size={88} min={60} lines={2} at={4}/>
    <div style={{position: 'absolute', top: 560, [copy.side]: W - X1, width: CW, height: size * 1.05, display: 'flex', justifyContent: copy.ar ? 'flex-end' : 'flex-start', alignItems: 'baseline',
      direction: 'ltr', transform: `scale(${punch * mix(0.9, 1, pop(f, 14, 13, 160))})`, transformOrigin: copy.ar ? '100% 60%' : '0% 60%', opacity: ramp(f, 12, 10)}}>
      <span style={{fontFamily: P.font, fontWeight: 900, fontSize: size, lineHeight: 1, color: P.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: -6}}>{value}</span>
      <span style={{fontFamily: P.font, fontWeight: 900, fontSize: size * 0.5, lineHeight: 1, color: P.accent, marginLeft: 12}}>{d.suffix}</span>
    </div>
    <div style={{position: 'absolute', top: 560 + size * 1.08, [copy.side]: W - X1, width: CW * ramp(f, 60, 24), height: 4, background: P.accent}}/>
    <div style={{position: 'absolute', top: 560 + size * 1.08 + 30, [copy.side]: W - X1, width: CW, textAlign: copy.align, fontFamily: 'IBM Plex Mono', fontSize: 24, letterSpacing: 1.5,
      color: P.dim, opacity: ramp(f, 72, 16), direction: 'ltr'}}>{d.source}</div>
  </AbsoluteFill>;
};
