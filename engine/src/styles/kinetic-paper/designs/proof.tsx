import {useDesignText} from '../../../style-kit/digits';
import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import {fittedSize} from '../../../style-kit/design-safety';
import React from 'react';
import { Easing, useCurrentFrame} from 'remotion';
import {ownSceneCopy as sceneCopy} from '../../../style-kit/design-safety';
import {DesignCanvas} from './kit';
import type {FamilyDesignProps} from '../../family-designs';
import {W, X0, X1, CW, MIS, INK, LIME, SANS, MONO, ramp, num, slam, widthOf, dotTile, Slam, Ground, Box, useDesign, SafeWord} from './kit';


export const Proof: React.FC<FamilyDesignProps> = ({scene}) => {
  const {copy, HEAD, weight, word} = useDesign();
  if (scene.family !== "proof") return null;
  const shown = useDesignText();
  const d = scene.data;
  const sourceCopy = sceneCopy({title:d.source});

  const f = useCurrentFrame();
  const roll = ramp(f, 16, 30, Easing.bezier(0.2, 0.8, 0.2, 1));
  const value = shown(num(d.value * roll));
  // Lalezar digits sit between 0.12 and 0.69 of the em box: the plate hugs that band.
  const w100 = widthOf(shown(num(d.value)), 100, HEAD, weight) + widthOf(d.suffix, 50, HEAD, weight) + 3;
  const SZ = Math.min(720, Math.floor(((CW - 120) / w100) * 100)), topD = 0.12 * SZ, hD = 0.57 * SZ;
  const numW = widthOf(shown(num(d.value)), SZ, HEAD, weight), sufW = widthOf(d.suffix, SZ * 0.5, HEAD, weight);
  const lw = Math.min(copy.ar?CW:CW-240,widthOf(d.label, 56) + 100);
  const total = numW + sufW + 14;
  const ht = ramp(f, 22, 14, Easing.out(Easing.quad));
  const punch = slam(f, 48, 1.07);
  return <DesignCanvas style={{direction:copy.dir,textAlign:copy.align}}>
    <Ground/>
    <Box x={X1 - lw} y={296} w={lw} h={116} at={2} limeAt={0} shadow="solid" sw={10} rot={0}>
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: copy.dir, fontFamily: SANS, fontWeight: 900, fontSize: 56, color: INK, whiteSpace: 'nowrap'}}><SafeWord text={d.label} width={lw-100} size={56}/></div>
    </Box>
    <Slam at={12} from={1.2} origin="100% 50%" style={{position: 'absolute', top: 540, [copy.side]: W - X1, width: total}}>
      <div style={{position: 'relative', width: total + 44, height: hD + 48, marginRight: 0, marginLeft: copy.ar ? -44 : 10}}>
        <div style={{position: 'absolute', [copy.opposite]: 0, top: 0, [copy.side]: 0, bottom: 0, background: LIME, transform: `translate(${-MIS}px, ${MIS}px)`}}/>
        <div style={{position: 'absolute', [copy.opposite]: 22 + 24, top: 24 - topD + 24, direction: 'ltr', display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap', fontFamily: HEAD, fontWeight:weight, fontSize: SZ, lineHeight: '1', backgroundImage: dotTile(4.4 * ht), backgroundSize: '20px 20px', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent'}}>
          <span style={{fontVariantNumeric: 'tabular-nums'}}>{value}</span><span style={{fontSize: SZ * 0.5, marginLeft: 14}}>{d.suffix}</span></div>
        <div style={{position: 'absolute', [copy.opposite]: 22, top: 24 - topD, direction: 'ltr', display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap', fontFamily: HEAD, fontWeight:headlineWeight(HEAD,'Lalezar',400), fontSize: SZ, lineHeight: '1', color: INK,
          transform: `translate(${punch.on ? punch.dx : 0}px, ${punch.on ? punch.dy : 0}px) scale(${f >= 48 ? 1 + 0.07 * (1 - punch.k) : 1})`, transformOrigin: '50% 60%'}}>
          <span style={{fontVariantNumeric: 'tabular-nums'}}>{value}</span><span style={{fontSize: SZ * 0.5, marginLeft: 14}}>{d.suffix}</span></div>
      </div>
    </Slam>
    <div style={{position: 'absolute', top: 540 + hD + 48 + 62, [copy.side]: W - X1, width: CW * ramp(f, 62, 12, Easing.out(Easing.quad)), height: 10, background: INK}}/>
    <div style={{position: 'absolute', top: 540 + hD + 48 + 94, [copy.side]: W - X1, direction: sourceCopy.dir, fontFamily: sourceCopy.ar ? SANS : MONO, fontWeight: 600, fontSize: 25, letterSpacing: sourceCopy.ar ? 0 : 2, color: INK, opacity: f >= 70 ? 1 : 0, whiteSpace: 'nowrap'}}><SafeWord text={d.source} width={CW} size={25} family={sourceCopy.ar ? SANS : MONO} weight={600} spacing={sourceCopy.ar ? 0 : 2}/></div>
    <Slam at={76} from={1.7} origin="50% 50%" rot={-12} kick={-8} style={{position: 'absolute', [copy.opposite]: X0 + 6, top: copy.ar?1066:294}}>
      <div style={{width: 190, height: 190, borderRadius: 95, border: `10px solid ${INK}`, outline: `4px solid ${INK}`, outlineOffset: 6, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'transparent'}}>
        <div style={{fontFamily: HEAD, fontWeight:headlineWeight(HEAD,'Lalezar',400), fontSize: fittedSize(word('example'),HEAD,weight,72,142), lineHeight: '78px', color: INK, direction: copy.dir}}>{word('example')}</div>
        <div style={{fontFamily: MONO, fontWeight: 600, fontSize: 21, letterSpacing: 3, color: INK}}>{word('sample')}</div></div></Slam>
  </DesignCanvas>;
};

