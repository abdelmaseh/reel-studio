import {DesignText} from '../../../style-kit/digits';
import {useDesignText} from '../../../style-kit/digits';
import {useTiming,countTiming} from '../../../style-kit/design-safety';
import React from 'react';
import {AbsoluteFill, Easing, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {W, X1, CW, MIS, PAPER, CARD, INK, LIME, SANS, ramp, num, slam, widthOf, Slam, Ground, Headline, Kicker, PaperFx, useDesign, SafeWord, X0} from './kit';


export const CountSplit: React.FC<FamilyDesignProps> = ({scene, seam}) => {
  const {copy, HEAD, weight, fit} = useDesign();
  if (scene.family !== "count") return null;
  const shown = useDesignText();
  const d = scene.data;

  const f = useCurrentFrame();
  const timing=countTiming(d,useTiming(),{roll:22,duration:30,unit:34,badge:34});
  const roll = ramp(f, timing.roll, timing.duration, Easing.bezier(0.2, 0.8, 0.2, 1));
  const value = shown(num(d.value * roll));
  const t = fit(d.title, {width: CW - 20, size: 112, min: 76, lines: 2});
  const SZ = 500, topD = 0.12 * SZ, hD = 0.57 * SZ;
  const numW = widthOf(shown(num(d.value)), SZ, HEAD, weight), sufW = widthOf(d.suffix, SZ * 0.5, HEAD, weight);
  const total = numW + sufW + 12;
  const titleTop = 372, numTop = titleTop + t.lines.length * t.box + 40;
  // The lime plate hugs the number so the 10 px slip shows: bare lime lower left, the ink overhangs upper right.
  const padX = 20, padY = 22;
  const slabH = hD + padY * 2, slabW = total + padX * 2;
  const punch = slam(f, timing.end, 1.07);
  const seamDraw = ramp(f, 2, 12, Easing.out(Easing.quad));
  const tagH = slabH - 98;
  const unitSize = Math.min(46, Math.floor((tagH - 28) / (widthOf(d.unit, 46) / 46)));
  const tagLeft = X1 - slabW - 84 - 30;
  const numberScale = Math.min(1,CW/(slabW+114),Math.max(.1,(seam-88-numTop)/(slabH+12)));
  return <AbsoluteFill style={{direction:copy.dir,textAlign:copy.align}}>

    <div style={{position: 'absolute', [copy.opposite]: 0, top: 0, width: W, height: seam, overflow: 'hidden'}}>
      <Ground height={seam}/>
      <Kicker text={d.kicker} top={300} at={2}/>
      <Headline text={d.title} top={titleTop} size={112} min={76} lines={2} at={8} stagger={5}/>
      <div data-number-scale={numberScale} style={{position:'absolute',inset:0,transform:numberScale < 1 ? `scale(${numberScale})` : undefined,transformOrigin:`${copy.ar ? X1 : X0}px ${numTop}px`}}>
      <Slam at={Math.min(14,timing.roll)} from={1.15} origin="100% 50%" style={{position: 'absolute', top: numTop, [copy.side]: W - X1, width: slabW, height: slabH}}>
        <div style={{position: 'relative', width: slabW, height: slabH}}>
          <div style={{position: 'absolute', inset: 0, background: LIME, transform: `translate(${-MIS}px, ${MIS}px)`}}/>
          <div style={{position: 'absolute', [copy.opposite]: padX, top: padY - topD, direction: 'ltr', display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap', fontFamily: HEAD, fontWeight:weight, fontSize: SZ, lineHeight: '1', color: INK,
            transform: `translate(${punch.on ? punch.dx : 0}px, ${punch.on ? punch.dy : 0}px) scale(${f >= timing.end ? 1 + 0.06 * (1 - punch.k) : 1})`, transformOrigin: '50% 60%'}}>
            <span style={{fontVariantNumeric: 'tabular-nums'}} data-count-progress={roll}>{value}</span><span style={{fontSize: SZ * 0.5, marginLeft: 12}}>{d.suffix}</span></div>
        </div>
      </Slam>
      {/* the unit reads down the edge like a spine label, the badge is a small printed square under it */}
      <Slam at={timing.unit} from={1.3} origin="50% 50%" style={{position: 'absolute', [copy.opposite]: tagLeft, top: numTop, width: 84, height: slabH + 12}}>
        <div style={{position: 'absolute', [copy.opposite]: 0, top: 0, width: 84, height: tagH, background: INK}}>
          <div style={{position: 'absolute', [copy.opposite]: 0, top: tagH, width: tagH, height: 84, transformOrigin: '0 0', transform: 'rotate(-90deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', direction: copy.dir, whiteSpace: 'nowrap', color: PAPER, fontFamily: SANS, fontWeight: 900, fontSize: unitSize}}><DesignText>{d.unit}</DesignText></div></div>
      </Slam>
        {d.badge ? <Slam at={timing.badge} style={{position:"absolute",[copy.opposite]:tagLeft,top:numTop}}><div style={{position: 'absolute', [copy.opposite]: 0, top: tagH + 14, width: 84, height: 84, border: `7px solid ${INK}`, boxSizing: 'border-box', background: CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 900, fontSize: 25, color: INK, direction: copy.dir}}><SafeWord text={d.badge} width={70} size={25}/></div></Slam> : null}
      </div>
      <PaperFx/>
    </div>
    {/* the seam: a 12 px ink rule with a lime strip under it, slipped like the second plate */}
    <div style={{position: 'absolute', [copy.opposite]: 0, top: seam - 6, width: W * seamDraw, height: 12, background: INK}}/>
    <div style={{position: 'absolute', [copy.opposite]: -MIS, top: seam + 6 + 2, width: W * seamDraw, height: 20, background: LIME}}/>
  </AbsoluteFill>;
};

