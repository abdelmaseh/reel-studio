import {DesignText} from '../../../style-kit/digits';
import {useDesignText} from '../../../style-kit/digits';
import {fittedSize} from '../../../style-kit/design-safety';
import React from 'react';
import {Easing, useCurrentFrame} from 'remotion';
import {C, X1, AXIS, ramp, useInkLayout, Parchment, InkBlock, BrushRule, Seal, Receipt, dashRow, lineRow, mono, naskh, PAD, num, Kicker, BlockBar, one} from './kit';
import type {RRow} from './kit';

import type {FamilyDesignProps} from '../../family-designs';
import {DesignRoot, sceneCopy, useFonts} from './kit';
import {receiptCopy} from './copy';

export const MeterReceipt: React.FC<FamilyDesignProps> = ({scene}) => {
  if (scene.family !== 'meter-receipt') return null;
  const shown = useDesignText();
  const d = scene.data;
  const copy = sceneCopy(d), FONT = useFonts(), inkLayout = useInkLayout();
  const f = useCurrentFrame();
  const L = inkLayout(d.title, [{lines: 1, size: 124, min: 100, lh: 1.2}, {lines: 2, size: 104, min: 78, lh: 1.2}]);
  const top = 322, ruleTop = top + L.lines.length * L.box + 8, recTop = ruleTop + 46;
  const CELLS = 20, cell = 26;
  const nb = Math.round(d.rows[0].value / d.maximum * CELLS), na = Math.round(d.rows[1].value / d.maximum * CELLS);
  const diff = Math.round((d.rows[1].value - d.rows[0].value) * 100) / 100;
  const totalFrame = Math.max(70, d.rows[1].atFrame + 28);
  const roll = ramp(f, totalFrame, 22, Easing.bezier(0.2, 0.8, 0.2, 1));
  const valRow = (label: string, v: number, at: number, color: string): RRow => lineRow({copy, label, value: `${v}${d.unit === '%' ? '' : ' '}${d.unit}`, h: 58, size: 40, at, valueColor: color});
  const sourceSize=one(d.source,{family:FONT.mono,weight:400,width:584,size:30,min:16});
  const note = inkLayout(d.source, {family: FONT.mono, weight: 400, width: 584, size: sourceSize.fontSize, min:16, lines:sourceSize.fits?1:2, lh: 1.2});
  const noteH = Math.max(44, note.lines.length * note.box);
  const barH = cell * 1.5 + 8;
  return <DesignRoot copy={copy}>
    <Parchment pitch={L.box} offset={top + L.baseline}/>
    <Kicker text={d.kicker} top={278} at={2}/>
    <InkBlock L={L} top={top} at={4}/>
    <BrushRule left={X1 - 500} top={ruleTop} w={500} h={32} at={4 + (L.lines.length - 1) * 18 + 14} dur={16}/>
    <Receipt left={AXIS - 330} top={recTop} width={660} start={16} rot={0.7} seed={41}
      ghosts={[{dx: 76, dy: 8, rot: 3, len: 430, tone: '#F4EAD6'}]} rows={[
      {at: 16, h: 54, node: <div style={{height: 54, padding: `0 ${PAD}px`, display: 'flex', alignItems: 'center', direction: copy.dir, justifyContent: 'space-between'}}>
        <span style={naskh(38, {color: C.inkSoft})}>{receiptCopy(copy, 'scale')}</span><span style={mono(34, {color: C.inkSoft, fontWeight: 400})}><DesignText>{d.maximum}</DesignText>{d.unit === '%' ? '' : ' '}<DesignText>{d.unit}</DesignText></span></div>},
      dashRow(22, 0.42, PAD, 20),
      valRow(d.rows[0].label, d.rows[0].value, d.rows[0].atFrame, C.ink),
      {at: d.rows[0].atFrame + 4, h: barH, node: <div style={{paddingTop: 4}}><BlockBar n={nb} of={CELLS} at={d.rows[0].atFrame + 8} color="rgba(46,32,25,0.72)" cell={cell} rate={1.1}/></div>},
      valRow(d.rows[1].label, d.rows[1].value, d.rows[1].atFrame, C.rust),
      {at: d.rows[1].atFrame + 4, h: barH, node: <div style={{paddingTop: 4}}><BlockBar n={na} of={CELLS} at={d.rows[1].atFrame + 8} color={C.rust} cell={cell} rate={1}/></div>},
      {at: totalFrame - 2, h: 46, node: <div style={{height: 46, padding: `0 ${PAD}px`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...mono(30, {fontWeight: 400, color: C.inkSoft})}}>
        <span><DesignText>{"0"}</DesignText></span><span><DesignText>{d.maximum / 2}</DesignText></span><span><DesignText>{d.maximum}</DesignText>{d.unit === '%' ? '' : ' '}<DesignText>{d.unit}</DesignText></span></div>},
      {at: totalFrame + 2, h: 182, node: <div style={{height: 182, padding: `0 ${PAD}px`, borderTop: `7px double ${C.ink}`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={naskh(34, {color: C.inkSoft, marginTop: 14})}>{receiptCopy(copy, 'difference')} <span style={{fontSize:24}}>{d.unit==='%'?'':d.unit}</span></div>
        <div style={{...mono(fittedSize(`${diff>=0?'+':'-'}${diff}${d.unit==='%'?'%':''}`,FONT.mono,600,150,550)), lineHeight: 1, textAlign: 'center'}}><span style={{color: C.rust}}>{diff >= 0 ? '+' : '−'}</span>{shown(num(Math.abs(diff) * roll, Number.isInteger(diff) ? 0 : 2))}<span style={{color: C.rust}}><DesignText>{d.unit==='%'?'%':''}</DesignText></span></div></div>},
      {at: totalFrame + 6, h: noteH, node: <div style={{height: noteH, padding: `0 ${PAD}px`, display: 'flex', flexDirection: 'column', alignItems: copy.ar ? 'flex-end' : 'flex-start', justifyContent: 'center', ...mono(note.size, {fontWeight: 400, color: C.inkSoft})}}>{note.lines.map((line, i) => <div key={i} style={{lineHeight: `${note.box}px`}}>{line}</div>)}</div>},
    ]}/>
    <Seal cx={890} cy={Math.min(1030,recTop+420)} size={150} at={totalFrame + 22} angle={-12}/>
  </DesignRoot>;
};

