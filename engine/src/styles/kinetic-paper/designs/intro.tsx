import {DesignText} from '../../../style-kit/digits';
import React from 'react';
import { Easing, useCurrentFrame} from 'remotion';
import {DesignCanvas} from './kit';
import type {FamilyDesignProps} from '../../family-designs';
import {W, X0, X1, CW, CARD, INK, SANS, MONO, ramp, HtPattern, Slam, Ground, Headline, Kicker, useDesign, sectionNumeral, SafeWord} from './kit';


export const Intro: React.FC<FamilyDesignProps> = ({scene, sectionIndex}) => {
  const {copy, fit, canFit, word} = useDesign();
  if (scene.family !== "intro") return null;
  const d = scene.data;
  const n = sectionNumeral(sectionIndex);

  const f = useCurrentFrame();
  const big = canFit(d.title, {width: CW - 20, size: 196, min: 130, lines: 3});
  const T = big ? {size: 196, min: 130, lines: 3} : {size: 124, min: 88, lines: 4, lh: 1.2};
  const t = fit(d.title, {width: CW - 20, ...T});
  const sub = fit(d.subtitle, {width: CW - 60, size: 60, min: 42, lines: 2, family: SANS, weight: 700, lh: 1.3});
  const top = 396, bottom = top + t.lines.length * t.box;
  const subTop = bottom + 52;
  const subWidth = subTop + sub.lines.length*sub.box > 1150 ? 788 : CW-60;
  const subSide = copy.ar && subTop + sub.lines.length*sub.box > 1150 ? W-853 : W-X1;
  const rule = ramp(f, 40, 10, Easing.out(Easing.quad));
  const grow = ramp(f, 0, 22, Easing.out(Easing.quad));
  return <DesignCanvas style={{direction:copy.dir,textAlign:copy.align}}>
    <Ground/>
    <svg width={W} height={1920} style={{position: 'absolute', [copy.opposite]: 0, top: 0}}>
      <defs><HtPattern id="intro-ht" r={(big ? 4.1 : 3.1) * grow}/></defs>
      <circle cx={big ? 20 : 40} cy={big ? bottom - 500 : 1400} r={big ? 470 : 300} fill="url(#intro-ht)"/>
    </svg>
    <Kicker maxWidth={CW-360} text={d.kicker} top={300} at={4}/>
    {n ? <Slam at={6} from={1.4} origin="0% 50%" rot={-3} style={{position: 'absolute', [copy.opposite]: X0 + 4, top: 304}}>
      <div style={{border: `6px solid ${INK}`, padding: '2px 20px', fontFamily: MONO, fontWeight: 600, fontSize: 30, letterSpacing: 4, color: INK, background: CARD, lineHeight: '46px'}}>{word('number')} <DesignText>{n}</DesignText></div></Slam> : null}
    <Headline text={d.title} top={top} {...T} at={10} stagger={6}/>
    <div style={{position: 'absolute', top: bottom + 22, [copy.side]: W - X1, width: 330 * rule, height: 12, background: INK}}/>
    <Slam at={46} from={1.18} origin="100% 50%" style={{position: 'absolute', top: subTop, [copy.side]: subSide, direction: copy.dir, textAlign: copy.align, fontFamily: SANS, fontWeight: 700, fontSize: sub.size, lineHeight: `${sub.box}px`, color: INK, whiteSpace: 'pre'}}>{sub.lines.map((line,i)=><React.Fragment key={i}>{i ? String.fromCharCode(10) : null}<SafeWord text={line} width={subWidth} size={sub.size} family={SANS} weight={700}/></React.Fragment>)}</Slam>
  </DesignCanvas>;
};

