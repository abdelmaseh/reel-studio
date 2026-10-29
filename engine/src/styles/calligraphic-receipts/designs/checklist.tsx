import {DesignText} from '../../../style-kit/digits';
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, X1, AXIS, useInkLayout, Parchment, InkBlock, BrushRule, Tick, Receipt, mono, naskh, PAD, Kicker} from './kit';
import type {RRow} from './kit';

import type {FamilyDesignProps} from '../../family-designs';
import {DesignRoot, sceneCopy} from './kit';
import {receiptCopy} from './copy';

export const Checklist: React.FC<FamilyDesignProps> = ({scene}) => {
  if (scene.family !== 'checklist') return null;
  const d = scene.data;
  const copy = sceneCopy(d), inkLayout = useInkLayout();
  const f = useCurrentFrame();
  const missing = d.variant === 'missing';
  const n = d.items.length;
  const L = inkLayout(d.title, [{lines: 1, size: 122, min: 96, lh: 1.2}, {lines: 2, size: 108, min: 76, lh: 1.2}]);
  const top = 338, ruleTop = top + L.lines.length * L.box + 8, recTop = ruleTop + 58;
  const rowH = n >= 4 ? 100 : 128;
  const done = missing ? 0 : d.items.filter((it) => f >= it.atFrame + 10).length;
  const rows: RRow[] = [
    {h: 60, at: d.items[0].atFrame - 6, node: <div style={{height: 60, padding: `0 ${PAD}px`, display: 'flex', alignItems: 'center', direction: copy.dir, justifyContent: 'space-between'}}>
      <span style={naskh(38, {color: C.inkSoft})}>{receiptCopy(copy, 'list')}</span><span style={naskh(34, {color: C.inkSoft, fontWeight: 400})}><span style={mono(32, {color: C.inkSoft, fontWeight: 400})}><DesignText>{n}</DesignText></span>{' '}{receiptCopy(copy, 'items')}</span></div>},
  ];
  d.items.forEach((it) => {
    rows.push({h: rowH, at: it.atFrame, node: <div style={{height: rowH, padding: `0 ${PAD}px`, display: 'flex', alignItems: 'center', direction: copy.dir, gap: 18, borderTop: `3px dashed rgba(46,32,25,0.34)`, boxSizing: 'border-box'}}>
      <div style={{flex: 1, minWidth: 0}}>
        <div style={naskh(n >= 4 ? 44 : 50, {whiteSpace: 'nowrap', color: missing ? C.inkSoft : C.ink, lineHeight: n >= 4 ? '54px' : '62px'})}>{it.label}</div>
        <div style={naskh(n >= 4 ? 30 : 32, {fontWeight: 400, color: C.inkSoft, whiteSpace: 'nowrap', lineHeight: n >= 4 ? '36px' : '42px'})}>{it.detail}</div>
      </div>
      {missing
        ? <span style={naskh(40, {color: C.bad, border: `3.5px solid ${C.bad}`, borderRadius: 10, padding: '0 16px', lineHeight: '58px', transform: 'rotate(-3deg)'})}>{copy.label('missing')}</span>
        : <div style={{width: 72, height: 72, border: `4px solid ${C.rust}`, borderRadius: 14, boxSizing: 'border-box', position: 'relative'}}>
          <div style={{position: 'absolute', left: 2, top: -16}}><Tick at={it.atFrame + 5} size={74}/></div></div>}
    </div>});
  });
  const lastAt = d.items[n - 1].atFrame;
  rows.push({at: lastAt + (missing ? 4 : 12), h: 116, node: <div style={{height: 116, padding: `0 ${PAD}px`, borderTop: `7px double ${C.ink}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', direction: copy.dir, justifyContent: 'space-between'}}>
    <span style={naskh(42)}>{missing ? receiptCopy(copy, 'available') : receiptCopy(copy, 'done')}</span><span style={mono(66, {color: missing ? C.bad : C.good})}><DesignText>{done}</DesignText> / <DesignText>{n}</DesignText></span></div>});
  return <DesignRoot copy={copy}>
    <Parchment pitch={L.box} offset={top + L.baseline}/>
    <Kicker text={d.kicker} top={288} at={2}/>
    <InkBlock L={L} top={top} at={4}/>
    <BrushRule left={X1 - 460} top={ruleTop} w={460} h={30} at={4 + (L.lines.length - 1) * 18 + 16} dur={16}/>
    <Receipt left={AXIS - 330} top={recTop} width={660} start={d.items[0].atFrame - 4} rot={-0.8} seed={12} rows={rows}/>
  </DesignRoot>;
};

