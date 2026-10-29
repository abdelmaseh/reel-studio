import {DesignText} from '../../../style-kit/digits';
import {useDesignData} from '../../../style-kit/digits';
// Fixed chapter-deck design; only scene data and theme tokens vary.
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {W, X0, X1, CW, ramp, MaskLines, Ground, Kicker, TrackRow, usePalette, useFit, sectionNumeral, sceneCopy} from './kit';

export const Checklist: React.FC<FamilyDesignProps> = ({scene, sectionIndex}) => {
  if (scene.family !== 'checklist') return null;
  const d = useDesignData(scene.data);
  const copy = sceneCopy(d);
  const n = sectionNumeral(sectionIndex);
  const P = usePalette(copy.ar), fit = useFit(copy.ar);
  const f = useCurrentFrame();
  const missing = d.variant === 'missing';
  const total = d.items.length;
  // A missing list counts what is present: nothing. A done list counts up as each item lands.
  const done = missing ? 0 : d.items.filter(i => f >= i.atFrame + 8).length;
  const cues = d.items.filter((it, i) => i === total - 1 || it.atFrame !== d.items[i + 1].atFrame);
  const prog = missing ? 0 : (cues.length === 1 ? 1 : interpolate(f, cues.map(it => it.atFrame), cues.map(it => (d.items.lastIndexOf(it) + 1) / total), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})) * ramp(f, d.items[0].atFrame, 10);
  const compact = total >= 4;
  const rowH = compact ? 118 : 140;
  const t = fit(d.title, {width: CW - 230, size: 104, min: 70, lines: 2, weight: 900});
  const first = 370 + t.lines.length * t.box + 80;
  const gap = Math.min(200, (1240 - rowH - first) / Math.max(1, total - 1));
  const tops = d.items.map((_, i) => first + i * gap);
  return <AbsoluteFill style={copy.ar ? undefined : {direction:copy.dir}}>
    <Ground copy={copy} tone={2} numeral={n}/>
    <Kicker copy={copy} text={d.kicker} top={300} at={2}/>
    <MaskLines copy={copy} text={d.title} top={370} size={104} min={70} lines={2} at={6} width={CW - 230}/>
    <div style={{position: 'absolute', top: 372, [copy.opposite]: X0, width: 200, height: 200, borderRadius: 100, border: `3px solid ${P.faint}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: P.font, fontWeight: 900, fontSize: 76, direction: 'ltr', opacity: ramp(f, 10, 12), background: 'rgba(0,0,0,0.18)'}}>
      <svg width="200" height="200" viewBox="0 0 200 200" style={{position: 'absolute', inset: -3, transform: 'rotate(-90deg)'}}>
        <circle cx="100" cy="100" r="98" fill="none" stroke={P.accent} strokeWidth="6" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog}/>
      </svg>
      <span style={{color: P.accent}}><DesignText>{done}</DesignText></span><span style={{color: P.dim, fontSize: 52}}>/<DesignText>{total}</DesignText></span></div>
    {d.items.map((it, i) => <React.Fragment key={i}>
      <TrackRow copy={copy} i={i} at={it.atFrame} top={tops[i]} title={it.label} detail={it.detail} mode="check" done={!missing} compact={compact}/>
      {i < total - 1 ? <div style={{position: 'absolute', top: tops[i] + rowH + (gap - rowH) / 2 - 1, [copy.side]: W - X1, width: CW * ramp(f, it.atFrame, 18), height: 2, background: P.faint}}/> : null}
    </React.Fragment>)}
  </AbsoluteFill>;
};
