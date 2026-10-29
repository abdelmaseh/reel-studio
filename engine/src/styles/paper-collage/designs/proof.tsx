import {useDesignText} from '../../../style-kit/digits';
// Approved V4 pilot; parsed data and direction adapter.
import React from 'react';
import {Easing, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {C, BODY, LAT, W, clamp01, BACK, ramp, num, textW, rectShape, tornShape, fit, Stage, Piece, Tape, Txt, CutNumeral, DesignProvider, useKit} from './kit';

export const Proof: React.FC<FamilyDesignProps> = p => {
  if (p.scene.family !== 'proof') return null;
  return <DesignProvider data={p.scene.data} sectionIndex={p.sectionIndex}><ProofDrawing d={p.scene.data}/></DesignProvider>;
};

const ProofDrawing: React.FC<{d: {label: string; value: number; suffix: string; source: string}}> = ({d}) => {
  const {copy} = useKit();
  const shown = useDesignText();
  const f = useCurrentFrame();
  const roll = ramp(f, 26, 34, Easing.bezier(0.2, 0.8, 0.2, 1));
  const per = (textW(String(d.value), LAT, 100, 700) + textW(d.suffix, LAT, 62, 700)) / 100;
  const size = Math.min(600, Math.floor(840 / per));
  const punch = 1 + 0.045 * Math.max(0, 1 - Math.abs(f - 64) / 7) * (f >= 62 ? 1 : 0);
  const src = fit(d.source, {width: 640, size: 27, min: 20, lines: 1, weight: 600, family: LAT});
  const lab = fit(d.label, {width: 760, size: 70, min: 52, lines: 1, weight: 700, family: BODY});
  const slipW = Math.round(textW(d.source, LAT, src.size, 600)) + 90;
  return <Stage offcuts={{family: 'tri', colors: [C.mustard, C.terra, C.teal]}}>
    <Piece id="proof-card" x={65} y={322} w={950} h={720} rot={-1.1} color={C.teal} shape={rectShape(5)} enter={{at: 0, from: [0, -240], dur: 18, rot: 4}} z={2} depth={1}>
      <Txt text={d.label} top={46} right={58} size={lab.size} color={C.card} weight={700} family={BODY}/>
      <div style={{position: 'absolute', top: 58 + lab.box, [copy.side]: 58, width: 120 * ramp(f, 12, 18), height: 8, background: C.mustard, borderRadius: 4}}/>
      <Tape cx={64} cy={30} len={190} h={58} rot={-38} at={20} id="proof-tl"/>
      <Tape cx={886} cy={30} len={190} h={58} rot={36} at={26} from="r" id="proof-tr"/>
    </Piece>
    <div style={{position: 'absolute', left: 0, top: 420, width: W, height: size, zIndex: 8, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', direction: 'ltr',
      opacity: ramp(f, 22, 6), transform: `scale(${punch}) rotate(-1.4deg)`, transformOrigin: '50% 50%'}}>
      <CutNumeral text={shown(num(d.value * roll))} size={size} color={C.mustard} lift={ramp(f, 22, 3) < 1 ? 1 : 0}/>
      <div style={{marginLeft: 14, opacity: ramp(f, 56, 6), transform: `translate(${(1 - ramp(f, 56, 14)) * 160}px, ${(1 - ramp(f, 56, 14)) * -60}px) rotate(${(1 - BACK(clamp01((f - 56) / 14))) * 14 + 4}deg)`}}>
        <CutNumeral text={d.suffix} size={Math.round(size * 0.62)} color={C.terra} style={{marginTop: Math.round(size * 0.06)}}/>
      </div>
    </div>
    <Piece id="proof-slip" x={104} y={986} w={slipW} h={118} rot={2.6} color={C.card} shape={tornShape('b', 4.5, 6)} enter={{at: 70, from: [-120, 120], dur: 15, arc: 0.2}} z={9} depth={0.5}>
      <Txt text={d.source} top={26} left={0} width={slipW} size={src.size} family={LAT} weight={600} color={C.ink} align="center" dir="ltr" style={{letterSpacing: 1.2}}/>
      <Tape cx={34} cy={8} len={104} h={42} rot={-34} at={86} id="proof-slip"/>
    </Piece>
  </Stage>;
};

