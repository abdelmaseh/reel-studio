import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import React from 'react';
import { Easing, useCurrentFrame} from 'remotion';
import {DesignCanvas} from './kit';
import type {FamilyDesignProps} from '../../family-designs';
import {X0, X1, CW, PAPER, CARD, INK, RED, SANS, ramp, Ground, Headline, Box, CrossStamp, useDesign, SafeWord} from './kit';


export const Comparison: React.FC<FamilyDesignProps> = ({scene}) => {
  const {copy, HEAD, fit} = useDesign();
  if (scene.family !== "comparison") return null;
  const d = scene.data;

  const f = useCurrentFrame();
  const t = fit(d.title, {width: CW - 20, size: 134, min: 92, lines: 2});
  const base = 300 + t.lines.length * t.box + 46;
  const bw = 800, bh = 232, aw = 790, ah = 262;
  const arrow = ramp(f, 56, 8, Easing.out(Easing.quad));
  return <DesignCanvas style={{direction:copy.dir,textAlign:copy.align}}>
    <Ground/>
    <Headline text={d.title} top={300} size={134} min={92} lines={2} at={2} stagger={5}/>
    <Box x={X1 - bw} y={base} w={bw} h={bh} at={16} shadow="solid" sw={10} stroke={RED} rot={-1.2} kick={-3} fill={CARD}>
      <div style={{position: 'absolute', [copy.side]: 40, top: 28, direction: copy.dir, background: RED, color: INK, fontFamily: SANS, fontWeight: 900, fontSize: 40, lineHeight: '56px', padding: '0 26px'}}><SafeWord text={d.beforeTitle} width={bw-132} size={40} family={SANS} weight={900}/></div>
      <div style={{position: 'absolute', [copy.side]: 40, top: 96, direction: copy.dir, fontFamily: SANS, fontWeight: 900, fontSize: 82, lineHeight: '110px', color: RED, whiteSpace: 'nowrap'}}><SafeWord text={d.beforeDetail} width={bw-80} size={82} family={SANS} weight={900}/></div>
    </Box>
    <div style={{position: 'absolute', [copy.opposite]: X1 - bw - 70, top: base - 56, width: 330, height: 330, zIndex: 3}}>
      <CrossStamp size={330} at={44} rot={-8} sw={26}/></div>
    <svg width="90" height="70" viewBox="0 0 90 70" style={{position: 'absolute', [copy.opposite]: 560, top: base + bh + 10, opacity: arrow > 0.01 ? 1 : 0, transform: `translateY(${(1 - arrow) * -20}px)`}}>
      <path d="M45 4 V50 M18 30 L45 58 L72 30" stroke={INK} strokeWidth="14" fill="none" strokeLinecap="butt" strokeLinejoin="miter"/></svg>
    <Box x={X0 + 2} y={base + bh + 70} w={aw} h={ah} at={62} shadow="solid" sw={13} rot={0.9} kick={3} from={1.2} limeAt={55} fill={CARD}>
      <div style={{position: 'absolute', [copy.side]: 44, top: 26, direction: copy.dir, background: INK, color: PAPER, fontFamily: SANS, fontWeight: 900, fontSize: 40, lineHeight: '56px', padding: '0 26px'}}><SafeWord text={d.afterTitle} width={aw-140} size={40} family={SANS} weight={900}/></div>
      <div style={{position: 'absolute', [copy.side]: 44, top: 92, direction: copy.dir, fontFamily: HEAD, fontWeight:headlineWeight(HEAD,'Lalezar',400), fontSize: 112, lineHeight: '150px', color: INK, whiteSpace: 'nowrap'}}><SafeWord text={d.afterDetail} width={aw-88} size={112} family={HEAD} weight={headlineWeight(HEAD,'Lalezar',400)}/></div>
    </Box>
  </DesignCanvas>;
};

