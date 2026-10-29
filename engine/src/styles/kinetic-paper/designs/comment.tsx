import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import React from 'react';
import { Easing, useCurrentFrame} from 'remotion';
import {DesignCanvas} from './kit';
import type {FamilyDesignProps} from '../../family-designs';
import {W, X0, X1, MIS, SH, PAPER, CARD, INK, LIME, SANS, ramp, slam, widthOf, jag, Slam, Ground, Headline, useDesign, SafeWord, CW} from './kit';

const tornCardPath = (w: number, h: number, seed: number) => {
  const top = jag(0, w, 18, 12, seed, 17);
  return `M ${top[0]} ` + top.slice(1).map((p) => `L ${p}`).join(' ') + ` L ${w} ${h} L 0 ${h} Z`;
};

export const Comment: React.FC<FamilyDesignProps> = ({scene}) => {
  const {copy, HEAD, word} = useDesign();
  if (scene.family !== "comment") return null;
  const d = scene.data;

  const f = useCurrentFrame();
  const CWd = 950, CH = 380, CX = X0, CY = 640, KS = 236;
  const s = slam(f, 12, 1.12);
  const draw = ramp(f, 12, 12, Easing.out(Easing.quad));
  const caret = f >= 50 ? (Math.floor(f / 8) % 2 === 0 ? 1 : 0) : 0;
  const path = tornCardPath(CWd, CH, 9);
  const kw = Math.min(CWd-210,widthOf(d.keyword, KS, HEAD, headlineWeight(HEAD,'Lalezar',400)));
  const arrow = ramp(f, 66, 10, Easing.out(Easing.quad));
  return <DesignCanvas style={{direction:copy.dir,textAlign:copy.align}}>
    <Ground/>
    <Headline text={word('commentTitle')} top={300} size={140} min={100} lines={2} at={2} stagger={5}/>
    <div style={{position: 'absolute', [copy.opposite]: CX, top: CY, width: CWd, height: CH, opacity: s.on ? 1 : 0, transform: `translate(${s.dx}px, ${s.dy}px) rotate(-0.8deg) scale(${s.scale})`, transformOrigin: '50% 50%'}}>
      <svg width={CWd} height={CH} style={{position: 'absolute', [copy.opposite]: 0, top: 0, overflow: 'visible'}}>
        <path d={path} transform={`translate(${SH} ${SH})`} fill={INK}/>
        <path d={path} fill={CARD}/>
        <path d={path} fill="none" stroke={INK} strokeWidth="11" strokeLinejoin="miter" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw}/>
      </svg>
      <div style={{position: 'absolute', [copy.side]: 34, top: 40, direction: copy.dir, display: 'flex', alignItems: 'center', gap: 12, fontFamily: SANS, fontWeight: 800, fontSize: 32, color: INK}}>
        <span style={{background: INK, color: PAPER, padding: '0 18px', lineHeight: '46px'}}>{word('comment')}</span></div>
      <div style={{position: 'absolute', [copy.opposite]: 36, top: 40, direction: copy.dir, background: INK, color: PAPER, fontFamily: SANS, fontWeight: 800, fontSize: 30, lineHeight: '46px', padding: '0 20px'}}>{word('send')}</div>
      {/* the input field: the keyword is the hero and fills it */}
      <div style={{position: 'absolute', [copy.opposite]: 36, [copy.side]: 36, top: 100, height: 252, border: `8px solid ${INK}`, background: PAPER, direction: copy.dir}}>
        <Slam at={30} from={1.5} origin="100% 50%" style={{position: 'absolute', [copy.side]: 44, top: 4, height: 232}}>
          <div style={{position: 'relative', height: 232, padding: '0 4px', margin: '0 -4px'}}>
            <div style={{position: 'absolute', [copy.opposite]: 0, [copy.side]: 0, top: 44, bottom: 14, background: LIME, transform: `translate(${-MIS}px, ${MIS}px)`}}/>
            <div style={{position: 'relative', fontFamily: HEAD, fontWeight:headlineWeight(HEAD,'Lalezar',400), fontSize: KS, lineHeight: '220px', color: INK, whiteSpace: 'nowrap'}}><SafeWord text={d.keyword} width={CWd-210} size={KS} family={HEAD} weight={headlineWeight(HEAD,'Lalezar',400)}/></div></div>
        </Slam>
        <div style={{position: 'absolute', [copy.side]: 44 + kw + 36, top: 44, width: 14, height: 150, background: INK, opacity: caret}}/>
      </div>
    </div>
    <div style={{position: 'absolute', top: CY + CH + 44, [copy.side]: W - X1, direction: copy.dir, display: 'flex', alignItems: 'center', gap: 22, opacity: arrow > 0.01 ? 1 : 0, transform: `translateX(${(1 - arrow) * 40}px)`}}>
      <svg width="76" height="64" viewBox="0 0 76 64" style={copy.ar ? undefined : {transform:'scaleX(-1)'}}><path d="M70 32 H12 M32 8 L8 32 L32 56" stroke={INK} strokeWidth="13" fill="none" strokeLinecap="butt" strokeLinejoin="miter"/></svg>
      <span style={{fontFamily: SANS, fontWeight: 900, fontSize: 56, lineHeight: '72px', color: INK, position: 'relative', whiteSpace: 'nowrap'}}>
        <span style={{position: 'absolute', [copy.opposite]: -6, [copy.side]: -6, top: 8, bottom: 6, background: LIME, transform: `translate(${-MIS}px, ${MIS}px)`}}/>
        <span style={{position: 'relative'}}><SafeWord text={d.promise} width={CW-110} size={56}/></span></span>
    </div>
  </DesignCanvas>;
};

