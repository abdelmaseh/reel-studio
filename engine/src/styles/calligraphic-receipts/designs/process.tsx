import {DesignText} from '../../../style-kit/digits';
import React from 'react';

import {C, X1, AXIS, useInkLayout, Parchment, InkBlock, BrushRule, Tick, Receipt, dashRow, mono, naskh, PAD} from './kit';
import type {RRow} from './kit';

import type {FamilyDesignProps} from '../../family-designs';
import {DesignRoot, sceneCopy} from './kit';
import {receiptCopy} from './copy';

export const Process: React.FC<FamilyDesignProps> = ({scene}) => {
  if (scene.family !== 'process') return null;
  const d = scene.data;
  const copy = sceneCopy(d), inkLayout = useInkLayout();
  const L = inkLayout(d.title, [{lines: 1, size: 132, min: 96, lh: 1.2}, {lines: 2, size: 112, min: 80, lh: 1.2}]);
  const top = 290, ruleTop = top + L.lines.length * L.box + 8, recTop = ruleTop + 58;
  const rows: RRow[] = [
    {h: 60, at: 14, node: <div style={{height: 60, padding: `0 ${PAD}px`, display: 'flex', alignItems: 'center', direction: copy.dir, justifyContent: 'space-between'}}>
      <span style={naskh(38, {color: C.inkSoft})}>{receiptCopy(copy, 'steps')}</span><span style={mono(34, {color: C.rust})}><DesignText>{String(d.steps.length).padStart(2, '0')}</DesignText></span></div>},
    dashRow(22),
  ];
  d.steps.forEach((s, i) => {
    const a = 22 + i * 18;
    rows.push({h: 124, at: a, node: <div style={{height: 124, padding: `0 ${PAD}px`, display: 'flex', alignItems: 'center', direction: copy.dir, gap: 20}}>
      <span style={mono(42, {color: C.rust, alignSelf: 'flex-start', marginTop: 14})}><DesignText>{String(i + 1).padStart(2, '0')}</DesignText></span>
      <div style={{whiteSpace: 'nowrap'}}>
        <div style={naskh(52, {lineHeight: '66px'})}>{s.title}</div>
        <div style={naskh(34, {fontWeight: 400, color: C.inkSoft, lineHeight: '44px'})}>{s.detail}</div></div>
      <span style={{flex: 1}}/>
      <Tick at={a + 8} size={64}/></div>});
    rows.push(dashRow(24, 0.3));
  });
  rows.push({gap: 4, h: 104, node: <div style={{height: 104, padding: `0 ${PAD}px`, borderTop: `7px double ${C.ink}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', direction: copy.dir, justifyContent: 'space-between'}}>
    <span style={naskh(40)}>{receiptCopy(copy, 'total')}</span><span style={mono(54, {color: C.rust})}><DesignText>{d.steps.length}</DesignText> / <DesignText>{d.steps.length}</DesignText></span></div>});
  return <DesignRoot copy={copy}>
    <Parchment pitch={L.box} offset={top + L.baseline}/>
    <InkBlock L={L} top={top} at={-3}/>
    <BrushRule left={X1 - 560} top={ruleTop} w={560} h={34} at={4 + (L.lines.length - 1) * 18 + 16} dur={18}/>
    <Receipt left={AXIS - 350} top={recTop} width={700} start={14} rot={0.8} seed={8}
      ghosts={[{dx: 70, dy: 8, rot: 3, len: 480, tone: '#F4EAD6'}]} rows={rows}/>
  </DesignRoot>;
};


