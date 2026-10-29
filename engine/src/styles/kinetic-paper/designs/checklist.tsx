import {DesignText} from '../../../style-kit/digits';
import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import React from 'react';
import { Easing, useCurrentFrame} from 'remotion';
import {DesignCanvas} from './kit';
import type {FamilyDesignProps} from '../../family-designs';
import {W, X0, X1, CW, SH, CARD, INK, RED, SANS, MONO, ramp, HtPattern, Slam, Ground, Headline, Kicker, Box, CheckStamp, CrossStamp, useDesign, SafeWord} from './kit';


export const Checklist: React.FC<FamilyDesignProps> = ({scene}) => {
  const {copy, HEAD, fit, word} = useDesign();
  if (scene.family !== "checklist") return null;
  const d = scene.data;

  const f = useCurrentFrame();
  const missing = d.variant === 'missing';
  const total = d.items.length, compact = total >= 4;
  const T = {size: compact ? 118 : 128, min: 86, lines: 2};
  const t = fit(d.title, {width: CW - 20, ...T});
  const titleTop = 392, first = titleTop + t.lines.length * t.box + 36;
  const rowH = Math.min(158, Math.floor((1146 - first) / total));
  const done = missing ? 0 : d.items.filter((it) => f >= it.atFrame).length;
  const bsz = compact ? 82 : 98;
  const grow = ramp(f, 10, 24, Easing.out(Easing.quad));
  const stampAt = d.items[total - 1].atFrame + 8;
  return <DesignCanvas style={{direction:copy.dir,textAlign:copy.align}}>
    <Ground/>
    {/* the halftone mark behind the list: a huge tick for a done form, a huge cross for a missing one */}
    <svg width={W} height={1920} style={{position: 'absolute', [copy.opposite]: 0, top: 0}}>
      <defs><HtPattern id="cl-ht" r={4.1 * grow}/></defs>
      {missing ? <path d="M70 70 L430 430 M430 70 L70 430" transform={`translate(-30 ${first - 40})`} fill="none" stroke="url(#cl-ht)" strokeWidth="130"/>
        : <path d="M60 330 L210 480 L480 90" transform={`translate(-20 ${first - 60})`} fill="none" stroke="url(#cl-ht)" strokeWidth="130"/>}
    </svg>
    <Kicker maxWidth={CW-360} text={d.kicker} top={300} at={2}/>
    <Slam at={4} from={1.3} origin="0% 50%" style={{position: 'absolute', [copy.opposite]: X0, top: 300}}>
      <div style={{minWidth: 150, height: 66, border: `6px solid ${missing ? RED : INK}`, color: missing ? RED : INK, background: CARD, fontFamily: MONO, fontWeight: 600, fontSize: 38, lineHeight: '54px', textAlign: 'center', padding: '0 16px', direction: 'ltr', boxShadow: `${SH / 2}px ${SH / 2}px 0 ${missing ? RED : INK}`}}><DesignText>{done}</DesignText>/<DesignText>{total}</DesignText></div></Slam>
    <Headline text={d.title} top={titleTop} {...T} at={8} stagger={5}/>
    {d.items.map((it, i) => {
      const y = first + i * rowH, labelAt = 16 + i * 4;
      const rule = ramp(f, labelAt, 12, Easing.out(Easing.quad));
      return <React.Fragment key={i}>
        <div style={{position: 'absolute', top: y + rowH - 6, [copy.side]: W - X1, width: CW * rule, height: 5, background: INK}}/>
        <Box x={X1 - bsz} y={y + (rowH - 6 - bsz) / 2} w={bsz} h={bsz} at={labelAt} shadow="none" sw={9} fill={CARD} limeAt={missing ? undefined : it.atFrame}>
          {missing ? <div style={{position: 'absolute', inset: -4}}><CrossStamp size={bsz + 8} at={it.atFrame} rot={i % 2 ? 5 : -7} sw={22}/></div>
            : <div style={{position: 'absolute', [copy.opposite]: -2, top: -bsz * 0.28, width: bsz * 1.2, height: bsz * 1.2}}><CheckStamp size={bsz * 1.2} at={it.atFrame} rot={i % 2 ? -4 : -9}/></div>}
        </Box>
        <Slam at={labelAt + 2} from={1.22} origin="100% 50%" style={{position: 'absolute', top: y, [copy.side]: W - X1 + bsz + 30, height: rowH - 6, display: 'flex', flexDirection: 'column', justifyContent: 'center', direction: copy.dir, whiteSpace: 'nowrap'}}>
          <div style={{fontFamily: SANS, fontWeight: 900, fontSize: compact ? 50 : 62, lineHeight: compact ? '58px' : '72px', color: INK}}><SafeWord text={it.label} width={CW-bsz-60} size={compact ? 50 : 62}/></div>
          <div style={{fontFamily: SANS, fontWeight: 600, fontSize: compact ? 30 : 36, lineHeight: compact ? '36px' : '44px', color: missing ? RED : INK, opacity: missing ? 1 : 0.78}}><SafeWord text={it.detail} width={CW-bsz-60} size={compact ? 30 : 36} weight={600}/></div>
        </Slam>
      </React.Fragment>;
    })}
    {missing ? <Slam at={stampAt} from={1.8} origin="50% 50%" rot={-9} kick={-6} style={{position: 'absolute', [copy.opposite]: 78, top: first + rowH * 1.35}}>
      <div style={{border: `11px solid ${RED}`, outline: `4px solid ${RED}`, outlineOffset: 7, padding: '0 30px', fontFamily: HEAD, fontWeight:headlineWeight(HEAD,'Lalezar',400), fontSize: 168, lineHeight: '200px', color: RED, direction: copy.dir, mixBlendMode: 'multiply', whiteSpace: 'nowrap', background: 'transparent'}}>{word('missing')}</div></Slam> : null}
  </DesignCanvas>;
};

