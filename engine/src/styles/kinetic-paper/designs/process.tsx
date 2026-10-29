import {DesignText} from '../../../style-kit/digits';
import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import React from 'react';
import { Easing, useCurrentFrame} from 'remotion';
import {DesignCanvas} from './kit';
import type {FamilyDesignProps} from '../../family-designs';
import {X0, CW, MIS, PAPER, INK, LIME, SANS, MONO, ramp, Ground, Headline, Box, useDesign, SafeWord} from './kit';


export const Process: React.FC<FamilyDesignProps> = ({scene}) => {
  const {copy, HEAD, fit} = useDesign();
  if (scene.family !== "process") return null;
  const d = scene.data;

  const f = useCurrentFrame();
  const t = fit(d.title, {width: CW - 20, size: 132, min: 90, lines: 2});
  const base = 300 + t.lines.length * t.box + 44;
  const H = 150, GAP = 20, ats = [20, 44, 68];
  const rots = [-1.4, 1.1, -0.7];
  return <DesignCanvas style={{direction:copy.dir,textAlign:copy.align}}>
    <Ground/>
    <Headline text={d.title} top={300} size={132} min={90} lines={2} at={2} stagger={5}/>
    {d.steps.map((s, i) => {

      const y = base + i * (H + GAP);
      const next = i < d.steps.length - 1 ? ats[i + 1] : 9999;
      const limeIn = ramp(f, ats[i] - 2, 6, Easing.out(Easing.cubic)), limeOut = ramp(f, next - 2, 6, Easing.out(Easing.cubic));
      return <Box key={i} x={X0} y={y} w={CW} h={H} at={ats[i]} shadow={i === d.steps.length - 1 ? 'halftone' : 'solid'} sw={10} rot={rots[i]} kick={-3} from={1.18} limeAt={i === d.steps.length - 1 || limeOut < 0.01 ? ats[i] - 2 : undefined}>
        {/* a lime plate that moves on to the next ticket once it lands */}
        {i < d.steps.length - 1 && limeOut > 0 ? <div style={{position: 'absolute', inset: 0, background: LIME, transform: `translate(${-MIS}px, ${MIS}px)`, clipPath: `inset(0 ${limeOut * 100}% 0 ${(1 - limeIn) * 100}%)`}}/> : null}
        <div style={{position: 'absolute', [copy.side]: 0, top: 0, width: H, height: H, background: INK, color: PAPER, fontFamily: HEAD, fontWeight:headlineWeight(HEAD,'Lalezar',400), fontSize: 118, lineHeight: `${H}px`, textAlign: 'center', direction: 'ltr', paddingTop: 2}}><DesignText>{i + 1}</DesignText></div>
        <div style={{position: 'absolute', [copy.side]: H + 34, top: 0, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'center', direction: copy.dir, whiteSpace: 'nowrap'}}>
          <div style={{fontFamily: SANS, fontWeight: 900, fontSize: 70, lineHeight: '82px', color: INK}}><SafeWord text={s.title} width={CW-H-34-170} size={70}/></div>
          <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 40, lineHeight: '48px', color: INK, opacity: 0.85}}><SafeWord text={s.detail} width={CW-H-34-170} size={40} weight={700}/></div>
        </div>
        <div style={{position: 'absolute', [copy.opposite]: 150, top: 18, bottom: 18, borderLeft: `5px dotted ${INK}`}}/>
        <div style={{position: 'absolute', [copy.opposite]: 26, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontFamily: MONO, fontWeight: 600, fontSize: 34, letterSpacing: 2, color: INK}}><DesignText>{"0"}</DesignText><DesignText>{i + 1}</DesignText><DesignText>{"/03"}</DesignText></div>
        <div style={{position: 'absolute', [copy.opposite]: 54, top: -10, width: 46, height: 18, background: INK, transform: 'rotate(-10deg)'}}/>
      </Box>;
    })}
  </DesignCanvas>;
};

