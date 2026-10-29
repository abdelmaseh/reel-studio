import {useDesignText} from '../../../style-kit/digits';
import React from 'react';
import {Easing, useCurrentFrame} from 'remotion';
import {C, X1, AXIS, ramp, useInkLayout, one, Parchment, InkBlock, BrushRule, Seal, Receipt, dashRow, lineRow, mono, naskh, PAD, num} from './kit';

import type {FamilyDesignProps} from '../../family-designs';
import {DesignRoot, sceneCopy, useFonts} from './kit';
import {receiptCopy} from './copy';

export const Proof: React.FC<FamilyDesignProps> = ({scene}) => {
  if (scene.family !== 'proof') return null;
  const shown = useDesignText();
  const d = scene.data;
  const copy = sceneCopy(d), FONT = useFonts(), inkLayout = useInkLayout();
  const f = useCurrentFrame();
  const L = inkLayout(d.label, [{lines: 1, size: 136, min: 100, lh: 1.2}, {lines: 2, size: 116, min: 80, lh: 1.2}]);
  const top = 290;
  const ruleTop = top + L.lines.length * L.box + 8;
  const recTop = ruleTop + 60;
  const roll = ramp(f, 56, 26, Easing.bezier(0.2, 0.8, 0.2, 1));
  const big = one(shown(num(d.value)) + d.suffix, {family: FONT.mono, weight: 600, width: 560, size: 250, min: 120});
  const sourceSize=one(d.source,{family:FONT.mono,weight:400,width:584,size:28,min:16});
  const src = inkLayout(d.source, {family: FONT.mono, weight: 400, width: 584, size: sourceSize.fontSize, min:16, lines:sourceSize.fits?1:2, lh: 1.15});
  const sourceH = Math.max(56, src.lines.length * src.box);
  const punch = 1 + 0.06 * Math.max(0, 1 - Math.abs(f - 80) / 6) * (f >= 78 ? 1 : 0);
  return <DesignRoot copy={copy}>
    <Parchment pitch={L.box} offset={top + L.baseline}/>
    <InkBlock L={L} top={top} at={4}/>
    <BrushRule left={X1 - 600} top={ruleTop} w={600} h={36} at={4 + (L.lines.length - 1) * 18 + 16} dur={18}/>
    <Receipt left={AXIS - 330} top={recTop} width={660} start={22} rot={-1} seed={5}
      ghosts={[{dx: 74, dy: 10, rot: 3.4, len: 470, tone: '#F4EAD6'}, {dx: -46, dy: 6, rot: -3, len: 520, tone: '#F7EFDF'}]}
      rows={[
      {h: 70, node: <div style={{height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><span style={naskh(44, {letterSpacing: copy.ar ? 0 : 4})}>{receiptCopy(copy, 'receipt')}</span></div>},
      dashRow(28),
      lineRow({copy, label: receiptCopy(copy, 'value'), value: shown(num(d.value)), h: 62}),
      lineRow({copy, label: receiptCopy(copy, 'unit'), value: d.suffix, h: 62}),
      lineRow({copy, label: receiptCopy(copy, 'source'), value: <span style={naskh(40, {fontWeight: 400})}>{receiptCopy(copy, 'example')}</span>, h: 62}),
      {gap: 6, h: 278, node: <div style={{height: 278, padding: `0 ${PAD}px`, margin: '12px 0 0', borderTop: `7px double ${C.ink}`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={naskh(36, {color: C.inkSoft, marginTop: 14})}>{receiptCopy(copy, 'total')}</div>
        <div style={{...mono(big.fontSize), lineHeight: 1, textAlign: 'center', transform: `scale(${punch})`}}>
          <span>{shown(num(d.value * roll))}</span><span style={{color: C.rust}}>{d.suffix}</span></div></div>},
      {h: sourceH, node: <div style={{height: sourceH, display: 'flex', flexDirection: 'column', alignItems: copy.ar ? 'flex-end' : 'flex-start', justifyContent: 'center', padding: `0 ${PAD}px`, ...mono(src.size, {fontWeight: 400, color: C.inkSoft, letterSpacing: 0})}}>{src.lines.map((line, i) => <div key={i} style={{lineHeight: `${src.box}px`}}>{line}</div>)}</div>},
    ]}/>
    <Seal cx={910} cy={Math.min(1030,recTop+350)} size={174} at={88} angle={-13}/>
  </DesignRoot>;
};

