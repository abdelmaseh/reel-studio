import {useDesignData} from '../../../style-kit/digits';
// Fixed chapter-deck design; only scene data and theme tokens vary.
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {W, X1, CW, ramp, MaskLines, usePalette, sceneCopy} from './kit';

export const Statement: React.FC<FamilyDesignProps> = ({scene}) => {
  if (scene.family !== 'statement') return null;
  const d = useDesignData(scene.data);
  const copy = sceneCopy(d);
  const P = usePalette(copy.ar);
  const f = useCurrentFrame();
  return <AbsoluteFill style={copy.ar ? undefined : {direction:copy.dir}}>
    <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 38%)'}}/>
    <div style={{position: 'absolute', top: 292, [copy.side]: W - X1, fontFamily: P.font, fontWeight: 700, fontSize: 34, color: P.ink, opacity: ramp(f, 2, 12),
      direction: copy.dir, display: 'flex', gap: 14, alignItems: 'center'}}><div style={{width: 48, height: 6, background: P.accent}}/>{d.kicker}</div>
    <MaskLines copy={copy} text={d.title} top={350} size={96} min={64} lines={3} at={6} stagger={6} color={P.accentInk} band={P.accent} width={CW - 44} lh={1.2}/>
  </AbsoluteFill>;
};
