import {useDesignText} from '../../../style-kit/digits';
import {useTiming,countTiming} from '../../../style-kit/design-safety';
// Approved V4 pilot; parsed data and direction adapter.
import React from 'react';
import {AbsoluteFill, Easing, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {C, BODY, LAT, W, X1, ramp, num, textW, cut, rectShape, fit, PaperDefs, Piece, Tape, PieceText, Headline, headBox, Kicker, CutNumeral, DesignProvider, useKit, type ShapeFn} from './kit';

export const CountSplit: React.FC<FamilyDesignProps> = p => {
  if (p.scene.family !== 'count') return null;
  return <DesignProvider data={p.scene.data} sectionIndex={p.sectionIndex}><CountSplitDrawing d={p.scene.data} seam={p.seam}/></DesignProvider>;
};

const CountSplitDrawing: React.FC<{d: {kicker: string; title: string; value: number; suffix: string; unit: string; badge?: string;rollFrame?:number;rollDuration?:number;unitFrame?:number;badgeFrame?:number}; seam: number}> = ({d, seam}) => {
  const {HEAD, word} = useKit();
  const shown = useDesignText();
  const f = useCurrentFrame();
  const timing=countTiming(d,useTiming(),{roll:26,duration:34,unit:56,badge:70});
  const roll = ramp(f, timing.roll, timing.duration, Easing.bezier(0.2, 0.8, 0.2, 1));
  const per = (textW(String(d.value), LAT, 100, 700) + textW(d.suffix, LAT, 62, 700)) / 100;
  const size0 = Math.min(340, Math.floor(700 / per));
  const punch = 1 + 0.045 * Math.max(0, 1 - Math.abs(f - (timing.end+4)) / 7) * (f >= timing.end+2 ? 1 : 0);
  const unit = fit(d.unit, {width: 520, size: 52, min: 36, lines: 1, weight: 700, family: BODY});
  const uw = Math.round(textW(d.unit, BODY, unit.size, 700)) + 86;
  const hb = headBox(d.title, {size: 108, min: 84, lines: 2, key: true}, HEAD);
  const headTop = 340, slabTop = headTop + hb.lines.length * hb.box + 22, slabH = Math.max(120,Math.min(312,seam-88-slabTop-52));
  const size=Math.min(size0,slabH-16);
  const sheet: ShapeFn = (w, h, id) => ({pts: cut([[-20, -20], [w + 20, -20], [w + 20, h], [-20, h]], id, 2.6, 70)});
  return <AbsoluteFill>
    <PaperDefs/>

    <Piece id="cnt-sheet" x={0} y={0} w={W} h={seam - 8} color={C.ground} shape={sheet} enter={{at: -100}} z={1} depth={1.2} edge={false} tooth={0.5}>
      <svg width={W} height={seam} style={{position: 'absolute', left: 0, top: 0, overflow: 'hidden'}}>
        <rect x={-400} y={-400} width={1880} height={2720} fill="#fff" filter="url(#rs-fibre)" style={{mixBlendMode: 'overlay'}} opacity={0.3} transform="rotate(-19 540 960)"/>
      </svg>
    </Piece>
    <Piece id="cnt-edge" x={-30} y={seam - 34} w={W + 60} h={58} color={C.teal} shape={rectShape(0, 2.8, 60)} enter={{at: 2, from: [-500, 0], dur: 22, rot: 0, arc: 0}} z={2} depth={0.5}/>
    <Tape cx={950} cy={seam - 4} len={176} h={64} rot={72} at={30} id="cnt-seam"/>
    <Kicker text={d.kicker} x={65} y={276} at={4} id="cnt-kick"/>
    <Headline text={d.title} top={headTop} at={4} id="cnt-h" keyWord={word('one')} keyColor={C.mustard} size={108} min={84} width={950}/>
    <Piece id="cnt-slab" x={65} y={slabTop} w={950} h={slabH} rot={-1} color={C.terra} shape={rectShape(5)} enter={{at: Math.min(8,timing.roll), from: [0, -260], dur: 18, rot: 4}} z={3} depth={0.9}>
      <Tape cx={60} cy={26} len={170} h={54} rot={-36} at={26} id="cnt-t1"/>
    </Piece>
    <div style={{position: 'absolute', left: 0, top: slabTop + 8, width: W, height: slabH - 40, zIndex: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', direction: 'ltr',
      opacity: ramp(f, Math.min(22,timing.roll), 6), transform: `scale(${punch}) rotate(-1deg)`}}>
      <span data-count-progress={roll}><CutNumeral text={shown(num(d.value * roll))} size={size} color={C.card} lift={0}/></span>
      <CutNumeral text={d.suffix} size={Math.round(size * 0.62)} color={C.mustard} style={{marginLeft: 12, marginTop: Math.round(size * 0.05)}}/>
    </div>
    <Piece id="cnt-unit" x={X1 - uw - 30} y={slabTop + slabH - 44} w={uw} h={84} rot={1.6} color={C.mustard} shape={rectShape(8)} enter={{at: timing.unit, from: [-200, 60], dur: 14}} z={9} depth={0.5}>
      <PieceText text={d.unit} h={84} size={unit.size} family={BODY} weight={700} color={C.ink} dy={-1}/>
    </Piece>
    {d.badge ? <Piece id="cnt-badge" x={92} y={slabTop + slabH - 40} w={Math.round(textW(d.badge, BODY, 34, 800)) + 56} h={58} rot={-4} color={C.card} shape={rectShape(5)} enter={{at: timing.badge, from: [0, 70], dur: 12}} z={10} depth={0.4}>
      <PieceText text={d.badge} h={58} size={34} family={BODY} weight={800} color={C.ink}/>
    </Piece> : null}
  </AbsoluteFill>;
};

