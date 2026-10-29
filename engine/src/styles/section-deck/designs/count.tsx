import {DesignText} from '../../../style-kit/digits';
import {useDesignData, useDesignText} from '../../../style-kit/digits';
// Fixed chapter-deck design; only scene data and theme tokens vary.
import React from 'react';
import {AbsoluteFill, Easing, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {W, X1, ramp, num, MaskLines, Ground, Kicker, usePalette, sectionNumeral, sceneCopy} from './kit';

export const CountSplit: React.FC<FamilyDesignProps> = ({scene, sectionIndex, seam}) => {
  if (scene.family !== 'count') return null;
  const d = useDesignData(scene.data);
  const shown = useDesignText();
  const copy = sceneCopy(d);
  const n = sectionNumeral(sectionIndex);
  const P = usePalette(copy.ar);
  const f = useCurrentFrame();
  const roll = ramp(f, 24, 40, Easing.bezier(0.2, 0.8, 0.2, 1));
  const punch = 1 + 0.07 * Math.max(0, 1 - Math.abs(f - 66) / 8) * (f >= 64 ? 1 : 0);
  return <AbsoluteFill style={copy.ar ? undefined : {direction:copy.dir}}>
    <div style={{position: 'absolute', top: 0, left: 0, width: W, height: seam, overflow: 'hidden'}}><Ground copy={copy} tone={1} numeral={n} numeralTop={60}/></div>
    <div style={{position: 'absolute', top: seam - 4, [copy.opposite]: 0, width: W * ramp(f, 4, 24), height: 8, background: P.accent}}/>
    <Kicker copy={copy} text={d.kicker} top={292} at={2}/>
    <MaskLines copy={copy} text={d.title} top={350} size={84} min={58} lines={2} at={6}/>
    <div style={{position: 'absolute', top: 590, [copy.side]: W - X1, display: 'flex', alignItems: 'baseline', direction: 'ltr', transform: `scale(${punch})`, transformOrigin: copy.ar ? '100% 70%' : '0% 70%'}}>
      <span style={{fontFamily: P.font, fontWeight: 900, fontSize: 300, lineHeight: 1, color: P.ink, letterSpacing: -4}}>{shown(num(d.value * roll))}</span>
      <span style={{fontFamily: P.font, fontWeight: 900, fontSize: 160, lineHeight: 1, color: P.accent, marginLeft: 10}}>{d.suffix}</span>
    </div>
    <div style={{position: 'absolute', top: 905, [copy.side]: W - X1, display: 'flex', gap: 18, alignItems: 'center', direction: copy.dir, opacity: ramp(f, 70, 14)}}>
      <span style={{fontFamily: P.font, fontWeight: 700, fontSize: 44, color: P.dim}}><DesignText>{d.unit}</DesignText></span>
      {d.badge ? <span style={{fontFamily: P.font, fontWeight: 800, fontSize: 32, color: P.accentInk, background: P.accent, borderRadius: 12, padding: '2px 18px', opacity: ramp(f, 90, 10)}}>{d.badge}</span> : null}
    </div>
  </AbsoluteFill>;
};
