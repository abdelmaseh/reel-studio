import {useDesignData} from '../../../style-kit/digits';
// Fixed chapter-deck design; only scene data and theme tokens vary.
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {W, X1, CW, ramp, mix, MaskLines, Ground, Kicker, usePalette, useFit, sectionNumeral, sceneCopy} from './kit';

export const Intro: React.FC<FamilyDesignProps> = ({scene, sectionIndex}) => {
  if (scene.family !== 'intro') return null;
  const d = useDesignData(scene.data);
  const copy = sceneCopy(d);
  const n = sectionNumeral(sectionIndex);
  const P = usePalette(copy.ar), fit = useFit(copy.ar);
  const f = useCurrentFrame();
  const settle = mix(1.05, 1, ramp(f, 0, 30));
  const rule = ramp(f, 38, 22);
  // Short titles take three big lines; long ones step down to four smaller lines instead of failing.
  const big = fit(d.title, {width: CW, size: 150, min: 96, lines: 3, weight: 900, warn: false}).fits;
  const T = big ? {size: 150, min: 96, lines: 3} : {size: 100, min: 72, lines: 4};
  const t = fit(d.title, {width: CW, ...T, weight: 900});
  const subTop = 380 + t.lines.length * t.box + 40;
  return <AbsoluteFill style={copy.ar ? undefined : {direction:copy.dir}}>
    <Ground copy={copy} tone={0} numeral={n}/>
    <AbsoluteFill style={{transform: `scale(${settle})`, transformOrigin: copy.ar ? '80% 30%' : '20% 30%'}}>
      <Kicker copy={copy} text={d.kicker} top={300} at={4}/>
      <MaskLines copy={copy} text={d.title} top={380} {...T} at={8} stagger={6}/>
      <div style={{position: 'absolute', top: subTop, [copy.side]: W - X1, width: 820, opacity: ramp(f, 30, 16), transform: `translateY(${(1 - ramp(f, 30, 20)) * 24}px)`}}>
        <MaskLines copy={copy} text={d.subtitle} top={0} width={820} size={54} min={38} lines={2} weight={600} color={P.dim} at={30} right={0}/>
      </div>
      <div style={{position: 'absolute', top: Math.min(1120, subTop + 190), [copy.side]: W - X1, width: 300 * rule, height: 6, background: P.accent, borderRadius: 3}}/>
    </AbsoluteFill>
  </AbsoluteFill>;
};
