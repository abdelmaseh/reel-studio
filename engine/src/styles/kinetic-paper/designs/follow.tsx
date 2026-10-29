import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import React from 'react';
import { Easing, useCurrentFrame} from 'remotion';
import {DesignCanvas} from './kit';
import type {FamilyDesignProps} from '../../family-designs';
import {X0, MIS, SH, PAPER, CARD, INK, LIME, SANS, clamp01, ramp, slam, Slam, Ground, useDesign, SafeWord} from './kit';


export const Follow: React.FC<FamilyDesignProps> = ({scene}) => {
  const {copy, HEAD} = useDesign();
  if (scene.family !== "follow") return null;
  const d = scene.data;
    const tap = 80;

  const f = useCurrentFrame();
  const CWd = 950, CH = 820, CX = X0, CY = 316, PY = 508, R = 38;
  const s = slam(f, 6, 1.14);
  const draw = ramp(f, 6, 12, Easing.out(Easing.quad));
  const letter = d.handle.replace('@', '').slice(0, 1).toUpperCase();
  // The card: perforation line with a half-circle notch bitten out of both sides.
  const path = `M 0 0 H ${CWd} V ${PY - R} A ${R} ${R} 0 0 0 ${CWd} ${PY + R} V ${CH} H 0 V ${PY + R} A ${R} ${R} 0 0 0 0 ${PY - R} Z`;
  // The button flips like a printed tab turned over: ink face, then lime face.
  const ft = clamp01((f - tap) / 9);
  const followed = ft >= 0.5;
  const rot = ft < 0.5 ? ft * 2 * 90 : -(1 - (ft - 0.5) * 2) * 90;
  const land = slam(f, tap + 5, 1.1);

  return <DesignCanvas style={{direction:copy.dir,textAlign:copy.align}}>
    <Ground/>
    <div style={{position: 'absolute', [copy.opposite]: CX, top: CY, width: CWd, height: CH, opacity: s.on ? 1 : 0, transform: `translate(${s.dx}px, ${s.dy}px) rotate(-1deg) scale(${s.scale})`, transformOrigin: '50% 50%'}}>
      <svg width={CWd} height={CH} style={{position: 'absolute', [copy.opposite]: 0, top: 0, overflow: 'visible'}}>
        <path d={path} transform={`translate(${SH} ${SH})`} fill={INK}/>
        <path d={path} fill={CARD}/>
        <path d={path} fill="none" stroke={INK} strokeWidth="12" strokeLinejoin="miter" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw}/>
        <line x1={R + 14} y1={PY} x2={CWd - R - 14} y2={PY} stroke={INK} strokeWidth="6" strokeDasharray="1 17" strokeLinecap="round"/>
      </svg>
      {/* avatar with its lime plate slipped */}
      <Slam at={14} from={1.4} origin="100% 50%" style={{position: 'absolute', [copy.side]: 70, top: 66}}>
        <div style={{position: 'relative', width: 230, height: 230}}>
          <div style={{position: 'absolute', inset: 0, borderRadius: 115, background: LIME, transform: `translate(${-MIS}px, ${MIS}px)`}}/>
          <div style={{position: 'absolute', inset: 0, borderRadius: 115, background: INK, color: PAPER, fontFamily: HEAD, fontWeight:headlineWeight(HEAD,'Lalezar',400), fontSize: 168, lineHeight: '230px', textAlign: 'center', direction: 'ltr'}}>{letter}</div></div>
      </Slam>
      <Slam at={22} from={1.3} origin="100% 50%" style={{position: 'absolute', [copy.side]: 70 + 230 + 40, top: 76, direction: 'ltr'}}>
        <div style={{position: 'relative', fontFamily: HEAD, fontWeight:headlineWeight(HEAD,'Lalezar',400), fontSize: 128, lineHeight: '150px', color: INK, whiteSpace: 'nowrap'}}>
          <div style={{position: 'absolute', [copy.opposite]: -2, [copy.side]: -2, top: 26, bottom: 10, background: LIME, transform: `translate(${-MIS}px, ${MIS}px)`}}/>
          <span style={{position: 'relative'}}><SafeWord text={d.handle} width={CWd-410} size={128} family={HEAD} weight={headlineWeight(HEAD,'Lalezar',400)}/></span></div>
      </Slam>
      <Slam at={34} from={1.18} origin="100% 50%" style={{position: 'absolute', [copy.side]: 70, top: 312, width: CWd - 140, direction: copy.dir, textAlign: copy.align, fontFamily: SANS, fontWeight: 800, fontSize: 60, lineHeight: '84px', color: INK}}><SafeWord text={d.message} width={CWd-140} size={60} weight={800}/></Slam>
      <div style={{position: 'absolute', [copy.side]: 70, top: 408, width: 330 * ramp(f, 40, 10, Easing.out(Easing.quad)), height: 10, background: INK}}/>
      <div style={{position: 'absolute', [copy.opposite]: 70, top: PY + R + 50, width: CWd - 140, height: 150, perspective: 900}}>
        <div style={{width: '100%', height: '100%', position: 'relative', transform: `rotateX(${rot}deg) scale(${followed ? land.scale : 1})`, opacity: f >= 52 ? 1 : 0}}>
          <div style={{position: 'absolute', inset: 0, background: followed ? LIME : INK, border: `8px solid ${INK}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, direction: copy.dir,
            fontFamily: SANS, fontWeight: 900, fontSize: 70, color: followed ? INK : PAPER}}>
            {followed ? <svg width="76" height="76" viewBox="0 0 100 100"><path d="M10 56 L38 86 L92 12" fill="none" stroke={INK} strokeWidth="24" strokeLinejoin="miter"/></svg> : null}
            {copy.label(followed ? 'following' : 'followPill')}
          </div>
        </div>
      </div>
    </div>
  </DesignCanvas>;
};

