import {useDesignData} from '../../../style-kit/digits';
// Fixed chapter-deck design; only scene data and theme tokens vary.
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {X0, X1, expo, MaskLines, Ground, TrackRow, usePalette, sectionNumeral, sceneCopy} from './kit';

export const Process: React.FC<FamilyDesignProps> = ({scene, sectionIndex}) => {
  if (scene.family !== 'process') return null;
  const d = useDesignData(scene.data);
  const copy = sceneCopy(d);
  const n = sectionNumeral(sectionIndex);
  const P = usePalette(copy.ar);
  const f = useCurrentFrame();
  const rows = [640, 850, 1060], ats = [26, 52, 78];
  const nodeC = copy.ar ? X1 - 46 : X0 + 46;
  const fill = interpolate(f, [ats[0] + 6, ats[2] + 6], [rows[0] + 46, rows[2] + 46], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: expo});
  return <AbsoluteFill style={copy.ar ? undefined : {direction:copy.dir}}>
    <Ground copy={copy} tone={0} numeral={n}/>
    <MaskLines copy={copy} text={d.title} top={300} size={112} min={72} lines={2} at={2}/>
    <div style={{position: 'absolute', left: nodeC - 3, top: rows[0] + 46, width: 6, height: rows[2] - rows[0], background: P.faint, borderRadius: 3}}/>
    <div style={{position: 'absolute', left: nodeC - 3, top: rows[0] + 46, width: 6, height: Math.max(0, fill - rows[0] - 46), background: P.accent, borderRadius: 3}}/>
    {d.steps.map((s, i) => <TrackRow copy={copy} key={i} i={i} at={ats[i]} top={rows[i]} title={s.title} detail={s.detail} mode="number"/>)}
  </AbsoluteFill>;
};
