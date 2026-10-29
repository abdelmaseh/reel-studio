import {useDesignText} from '../../../style-kit/digits';
import {useTiming,countTiming} from '../../../style-kit/design-safety';
import React from 'react';
import {Easing, useCurrentFrame} from 'remotion';
import {C, X1, AXIS, ramp, useInkLayout, one, TornPaper, InkBlock, BrushRule, Seal, Receipt, lineRow, mono, naskh, PAD, num, Kicker} from './kit';

import type {FamilyDesignProps} from '../../family-designs';
import {DesignRoot, sceneCopy, useFonts} from './kit';
import {receiptCopy} from './copy';

export const CountSplit: React.FC<FamilyDesignProps> = ({scene, seam}) => {
  if (scene.family !== 'count') return null;
  const shown = useDesignText();
  const d = scene.data;
  const copy = sceneCopy(d), FONT = useFonts(), inkLayout = useInkLayout();
  const f = useCurrentFrame();
  const L = inkLayout(d.title, [{lines: 1, size: 112, min: 84, lh: 1.15}, {lines: 2, size: 92, min: 66, lh: 1.12}]);
  const top = 318, ruleTop = top + L.lines.length * L.box + 8, recTop = ruleTop + 42;
  const timing=countTiming(d,useTiming(),{roll:26,duration:34,unit:56,badge:92});
  const roll = ramp(f, timing.roll, timing.duration, Easing.bezier(0.2, 0.8, 0.2, 1));
  const big = one(shown(num(d.value)) + d.suffix, {family: FONT.mono, weight: 600, width: 560, size: 236, min: 120});
  const punch = 1 + 0.06 * Math.max(0, 1 - Math.abs(f - (timing.end+2)) / 6) * (f >= timing.end ? 1 : 0);
  return <DesignRoot copy={copy}>
    <TornPaper tearY={seam} seed={17} amp={9} height={seam + 40} pitch={L.box} offset={top + L.baseline}>
      <Kicker text={d.kicker} top={286} at={2}/>
      <InkBlock L={L} top={top} at={4}/>
      <BrushRule left={X1 - 460} top={ruleTop} w={460} h={30} at={4 + (L.lines.length - 1) * 18 + 14} dur={16}/>
      <Receipt left={AXIS - 330} top={recTop} width={660} start={20} rot={-0.9} seed={6} rows={[
        {at:timing.roll,gap: 6, h: 268, node: <div style={{height: 268, padding: `0 ${PAD}px`, borderTop: `7px double ${C.ink}`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          <div style={naskh(34, {color: C.inkSoft, marginTop: 22})}>{receiptCopy(copy, 'total')}</div>
          <div style={{...mono(big.fontSize), lineHeight: 1, textAlign: 'center', transform: `scale(${punch})`}}><span data-count-progress={roll}>{shown(num(d.value * roll))}</span><span style={{color: C.rust}}>{d.suffix}</span></div></div>},
        lineRow({copy, at: timing.unit, label: d.unit, value: <span style={naskh(40, {fontWeight: 400})}>{receiptCopy(copy, 'example')}</span>, h: 80}),
      ]}/>
      {d.badge ? <Seal cx={AXIS + 330 + 8} cy={recTop + 300} size={220} at={timing.badge} angle={-12} text={d.badge}/> : null}
    </TornPaper>
  </DesignRoot>;
};

