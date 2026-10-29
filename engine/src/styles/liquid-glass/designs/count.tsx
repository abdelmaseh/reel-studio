import {DesignText} from '../../../style-kit/digits';
import {useDesignText} from '../../../style-kit/digits';
import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import {useTiming,countTiming} from '../../../style-kit/design-safety';
import React from 'react';
import {Easing, useCurrentFrame} from 'remotion';
import {fitOnLines} from '../../../core/type';
import type {FamilyDesignProps} from '../../family-designs';
import {C, DISPLAY, W, DIM, rgba, ramp, num, FitOpt, Aurora, Glass, Chip, Headline, headH, Orb, useGlass, DesignScene, H, X0, X1, CW} from './kit';
import {Spill} from './statement';
// ---- count (split) ----
const COUNT_T: FitOpt[] = [{size: 96, min: 60, lines: 2}];
export const countGeo = (d: any, shown: (text: string) => string = text => text) => {
  const titleTop = 292, th = headH(d.title, COUNT_T, CW, 700, 1.2, d.font);
  const card = {x: X0, y: titleTop + th + 34, w: CW, h: 0};
  card.h = d.seam - 70 - card.y;
  const big = fitOnLines(shown(num(d.value)) + d.suffix, {fontFamily: DISPLAY, fontSize: 340, fontWeight: 700}, {maxBoxWidth: 700, maxLines: 1, min: 140, max: 340, lineHeight: 1});
  const size = big.fontSize as number;
  const numTop = 74;
  return {titleTop, card, size, numW: big.width as number, numTop, cx: 540, cy: card.y + numTop + size * 0.5};
};
const CountGround: React.FC<{tone: number}> = ({tone}) => { const d = useGlass(); return <>
  <div style={{position: 'absolute', top: d.seam, [d.copy.opposite]: 0, width: W, height: H - d.seam, overflow: 'hidden'}}><div style={{position: 'absolute', top: -d.seam, [d.copy.opposite]: 0, width: W, height: H}}><Spill/></div></div>
  <div style={{position: 'absolute', top: 0, [d.copy.opposite]: 0, width: W, height: d.seam, overflow: 'hidden'}}><Aurora tone={tone}/></div>
</>; };
const CountBody: React.FC<{d: any; n: string}> = ({d}) => {
  const shown = useDesignText();
  const f = useCurrentFrame();
  const g = countGeo(d, shown);
  const timing=countTiming(d,useTiming(),{roll:26,duration:44,unit:66,badge:66});
  const roll = ramp(f, timing.roll, timing.duration, Easing.bezier(0.2, 0.8, 0.2, 1));
  const punch = 1 + 0.05 * Math.max(0, 1 - Math.abs(f - (timing.end+2)) / 8) * (f >= timing.end ? 1 : 0);
  const beam = ramp(f, 4, 28);
  return <>
    <Headline text={d.title} top={g.titleTop} opts={COUNT_T} at={4}/>
    <Glass x={g.card.x} y={g.card.y} w={g.card.w} h={g.card.h} r={52} at={Math.min(8,timing.roll,timing.unit,timing.badge)} dark={0.75} sweepAt={timing.end+2}>
      <Orb x={g.card.w / 2} y={g.numTop + g.size * 0.5} d={g.size * 1.18} at={10}/>
      <div style={{position: 'absolute', top: g.numTop, [d.copy.opposite]: 0, width: g.card.w, height: g.size, display: 'flex', justifyContent: 'center', alignItems: 'baseline', direction: 'ltr',
        transform: `scale(${punch})`, transformOrigin: '50% 55%'}}>
        <span style={{fontFamily: DISPLAY, fontWeight: 700, fontSize: g.size, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: -5, textShadow: '0 0 50px rgba(100,228,255,0.35), 0 6px 30px rgba(5,9,22,0.5)'}} data-count-progress={roll}>{shown(num(d.value * roll))}</span>
        <span style={{fontFamily: DISPLAY, fontWeight: 700, fontSize: g.size * 0.52, lineHeight: 1, color: C.cyan, marginLeft: 8, textShadow: `0 0 36px ${rgba(C.cyan, 0.5)}`}}>{d.suffix}</span>
      </div>
      <div style={{position: 'absolute', top: 32, [d.copy.opposite]: 50, display: 'flex', gap: 18, alignItems: 'center', direction: d.copy.dir}}>
        <span style={{fontFamily: d.font, fontWeight: 600, opacity:ramp(f,timing.unit,14), fontSize: 42, color: DIM, whiteSpace: 'nowrap'}}><DesignText>{d.unit}</DesignText></span>
        {d.badge ? <span style={{fontFamily: d.font, fontWeight:headlineWeight(d.font,'Grid Sans',700), fontSize: 30, color: C.ink, opacity:ramp(f,timing.badge,14), background: C.cyan, borderRadius: 14, padding: '2px 20px', boxShadow: `0 0 22px ${rgba(C.cyan, 0.6)}`}}>{d.badge}</span> : null}
      </div>
    </Glass>
    <Chip text={d.kicker} y={g.card.y + 28} right={X1 - 36} at={12} size={30}/>
    {/* the seam: a 2 px cyan line with a soft bloom */}
    <div style={{position: 'absolute', top: d.seam - 60, [d.copy.opposite]: 0, width: W, height: 120, opacity: beam * 0.9,
      background: `radial-gradient(60% 50% at 50% 50%, ${rgba(C.cyan, 0.38)}, ${rgba(C.cyan, 0)})`}}/>
    <div style={{position: 'absolute', top: d.seam - 1, [d.copy.opposite]: W / 2 - (W / 2) * beam, width: W * beam, height: 2, background: C.cyan, boxShadow: `0 0 18px ${rgba(C.cyan, 0.95)}, 0 0 46px ${rgba(C.cyan, 0.6)}`}}/>
  </>;
};


export const CountSplit: React.FC<FamilyDesignProps> = props => {
  const {scene} = props;
  if (scene.family !== 'count') return null;
  return <DesignScene {...props} tone={1} Body={CountBody} Ground={CountGround} />;
};
