import {useDesignText} from '../../../style-kit/digits';
import React from 'react';
import {Easing, useCurrentFrame} from 'remotion';
import {fitOnLines} from '../../../core/type';
import type {FamilyDesignProps} from '../../family-designs';
import {C, DISPLAY, DIM, rgba, mix, ramp, soft, num, Glass, Headline, Orb, DesignScene, X0, CW, instrumentFont, instrumentSpacing, instrumentDirection} from './kit';
// ---- proof ----
export const proofGeo = (d: any, shown: (text: string) => string = text => text) => {
  const card = {x: X0, y: 330, w: CW, h: 900};
  const big = fitOnLines(shown(num(d.value)) + d.suffix, {fontFamily: DISPLAY, fontSize: 440, fontWeight: 700}, {maxBoxWidth: 760, maxLines: 1, min: 160, max: 440, lineHeight: 1});
  const size = big.fontSize as number;
  const numTop = 170;
  return {card, size, numTop, numW: big.width as number, cx: 540, cy: card.y + numTop + size * 0.5, rulerY: numTop + size + 46};
};
const ProofBody: React.FC<{d: any; n: string}> = ({d}) => {
  const shown = useDesignText();
  const f = useCurrentFrame();
  const g = proofGeo(d, shown);
  const roll = ramp(f, 24, 44, Easing.bezier(0.2, 0.8, 0.2, 1));
  const punch = 1 + 0.05 * Math.max(0, 1 - Math.abs(f - 70) / 8) * (f >= 68 ? 1 : 0);
  const val = shown(num(d.value * roll));
  const pRuler = (d.value * roll) / 50;
  const rw = 790;
  return <Glass x={g.card.x} y={g.card.y} w={g.card.w} h={g.card.h} r={56} at={4} dark={0.8} sweepAt={70}>
    <Orb x={g.card.w / 2} y={g.numTop + g.size * 0.5} d={g.size * 1.2} at={8}/>
    <Headline text={d.label} top={44} right={80} width={790} opts={[{size: 72, min: 48, lines: 1}]} weight={600} at={12} glow={false} color={DIM}/>
    <div style={{position: 'absolute', top: g.numTop, [d.copy.opposite]: 0, width: g.card.w, height: g.size, display: 'flex', justifyContent: 'center', alignItems: 'baseline', direction: 'ltr',
      opacity: ramp(f, 14, 12), transform: `scale(${punch * mix(0.92, 1, soft(f, 14))})`, transformOrigin: '50% 55%'}}>
      <span style={{fontFamily: DISPLAY, fontWeight: 700, fontSize: g.size, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: -6, textShadow: '0 0 60px rgba(100,228,255,0.35), 0 6px 30px rgba(5,9,22,0.5)'}}>{val}</span>
      <span style={{fontFamily: DISPLAY, fontWeight: 700, fontSize: g.size * 0.52, lineHeight: 1, color: C.cyan, marginLeft: 10, textShadow: `0 0 40px ${rgba(C.cyan, 0.5)}`}}>{d.suffix}</span>
    </div>
    <div style={{position: 'absolute', top: g.rulerY, [d.copy.opposite]: (g.card.w - rw) / 2, width: rw, height: 80, opacity: ramp(f, 20, 14)}}>
      {Array.from({length: 51}, (_, i) => { const major = i % 10 === 0, mid = i % 5 === 0, lit = i / 50 <= pRuler + 0.001;
        return <div key={i} style={{position: 'absolute', [d.copy.opposite]: i / 50 * rw - 1.5, top: major ? 8 : mid ? 18 : 28, width: 3, height: major ? 52 : mid ? 40 : 30, borderRadius: 2,
          background: lit ? C.cyan : 'rgba(255,255,255,0.3)', boxShadow: lit && major ? `0 0 14px ${rgba(C.cyan, 0.7)}` : undefined}}/>; })}
      <div style={{position: 'absolute', [d.copy.opposite]: pRuler * rw - 2, top: -6, width: 4, height: 76, borderRadius: 2, background: '#fff', boxShadow: `0 0 18px ${rgba(C.cyan, 0.95)}`}}/>
    </div>
    <div style={{position: 'absolute', bottom: 62, left: 0, width: 787, textAlign: 'center', fontFamily: instrumentFont(d.source,d.font), fontWeight: 400, fontSize: 25, letterSpacing: instrumentSpacing(d.source,1.6), color: DIM,
      direction: instrumentDirection(d.source), opacity: ramp(f, 66, 16)}}>{d.source}</div>
  </Glass>;
};


export const Proof: React.FC<FamilyDesignProps> = props => {
  const {scene} = props;
  if (scene.family !== 'proof') return null;
  return <DesignScene {...props} tone={1} Body={ProofBody} />;
};
