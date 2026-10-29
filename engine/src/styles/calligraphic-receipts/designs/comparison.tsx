import {DesignText} from '../../../style-kit/digits';
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, X0, X1, pen, ramp, mix, rng, useInkLayout, Parchment, InkBlock, BrushRule, Stroke, Seal, Receipt, dashRow, lineRow, mono, naskh, BlockBar} from './kit';
import type {InkLayout, RRow} from './kit';

import type {FamilyDesignProps} from '../../family-designs';
import {DesignRoot, sceneCopy, useFonts} from './kit';
import {receiptCopy} from './copy';

export const Comparison: React.FC<FamilyDesignProps> = ({scene}) => {
  if (scene.family !== 'comparison') return null;
  const d = scene.data;
  const copy = sceneCopy(d), FONT = useFonts(), inkLayout = useInkLayout();
  const f = useCurrentFrame();
  const L = inkLayout(d.title, [{lines: 1, size: 124, min: 100, lh: 1.2}, {lines: 2, size: 112, min: 80, lh: 1.2}]);
  const top = 290, ruleTop = top + L.lines.length * L.box + 8, recTop = ruleTop + 62;
  // «بعد» is the front hero (600 px, type 64+ px); «قبل» sits behind it, smaller, dimmer, crossed out, partly covered.
  const AW = 600, PA = 28, BW = 420, PB = 26;
  const ad = inkLayout(d.afterDetail, {family: FONT.naskh, weight: 700, width: AW - 2 * PA, size: 76, min: 64, lines: 2, lh: 1.2});
  const bd = inkLayout(d.beforeDetail, {family: FONT.naskh, weight: 700, width: BW - 2 * PB, size: 56, min: 40, lines: 2, lh: 1.2});
  const dh = (lay: InkLayout, pad: number) => lay.lines.length * lay.box + pad;
  const detail = (lay: InkLayout, color: string, pad: number, px: number): RRow => ({h: dh(lay, pad), node: <div style={{height: dh(lay, pad), padding: `${pad / 2}px ${px}px`, direction: copy.dir, textAlign: copy.align}}>
    {lay.lines.map((l, i) => <div key={i} style={naskh(lay.size, {lineHeight: `${lay.box}px`, whiteSpace: 'nowrap', color})}>{l}</div>)}</div>});
  const head = (text: string, size: number, h: number, px: number, color: string, glyph: React.ReactNode): RRow => ({h, node: <div style={{height: h, padding: `0 ${px}px`, display: 'flex', alignItems: 'center', direction: copy.dir, gap: 14}}>
    <span style={naskh(size, {color, whiteSpace: 'nowrap'})}>{text}</span><span style={{flex: 1}}/>{glyph}</div>});
  const crossP = ramp(f, 64, 18, pen);
  const R = rng(5);
  const bh = 24 + 78 + 22 + dh(bd, 30) + 90 + 22 + 70;
  const crossPts: [number, number][] = Array.from({length: 24}, (_, i) => { const u = i / 23; return [mix(BW + 20, -30, u) + Math.sin(u * 5) * 5, mix(104, bh - 30, u) + Math.sin(u * 7 + 1) * 6] as [number, number]; });
  const crossW = crossPts.map((_, i) => { const u = i / 23; return 6 + 21 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.04)), 0.55) * (1 + (R() - 0.5) * 0.14); });
  const afterX = X0 + 32, beforeX = X1 - 32 - BW, beforeTop = recTop + 34;
  return <DesignRoot copy={copy}>
    <Parchment pitch={L.box} offset={top + L.baseline}/>
    <InkBlock L={L} top={top} at={-3}/>
    <BrushRule left={X1 - 500} top={ruleTop} w={500} h={32} at={4 + (L.lines.length - 1) * 18 + 16} dur={16}/>
    {/* before: right, behind, faded, tilted +3 degrees, stopped early and crossed out */}
    <Receipt left={beforeX} top={beforeTop} width={BW} start={14} rot={3} faded seed={14} rows={[
      head(d.beforeTitle, 40, 78, PB, C.inkSoft, <span style={mono(30, {color: C.inkSoft, fontWeight: 400})}><DesignText>{"01"}</DesignText></span>),
      dashRow(22, 0.4, PB),
      detail(bd, C.inkSoft, 30, PB),
      {h: 90, node: <div style={{height: 90, display: 'flex', alignItems: 'center', padding: `0 ${PB}px`, direction: 'ltr'}}>
        {[1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1].map((on, i) => <div key={i} style={{width: 18, height: 46, marginRight: 4, background: on ? 'rgba(46,32,25,0.62)' : 'rgba(46,32,25,0.08)', transform: `translateY(${(i % 3 - 1) * 4}px)`}}/>)}</div>},
      dashRow(22, 0.4, PB),
      lineRow({copy, label: receiptCopy(copy, 'result'), value: '?', h: 70, size: 38, pad: PB, labelColor: C.inkSoft, valueColor: C.inkSoft}),
    ]}/>
    <div style={{position: 'absolute', left: beforeX, top: beforeTop, width: BW, height: bh, transform: 'rotate(3deg)', transformOrigin: '50% 0'}}>
      {crossP > 0 ? <Stroke pts={crossPts} wd={crossW} p={crossP} color={C.rust} box={{x: -60, y: -40, w: BW + 120, h: bh + 80}} streak={C.thermal} seed={8}/> : null}
    </div>
    {/* after: front, left, 600 px wide, tilted -1.5 degrees, prints fresh and gets the seal on its corner */}
    <Receipt left={afterX} top={recTop} width={AW} start={34} rot={-1.5} seed={21} rows={[
      head(d.afterTitle, 54, 100, PA, C.ink, null),
      dashRow(24, 0.45, PA),
      detail(ad, C.ink, 36, PA),
      {h: 104, node: <div style={{height: 104, display: 'flex', alignItems: 'center', padding: `0 ${PA}px`, direction: 'ltr'}}>
        <BlockBar n={15} of={15} at={50} color={C.rust} cell={34} pad={0} rate={0.8}/></div>},
      dashRow(24, 0.45, PA),
      {gap: 4, h: 150, node: <div style={{height: 150, padding: `0 ${PA}px`, borderTop: `7px double ${C.ink}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', direction: copy.dir, justifyContent: 'space-between'}}>
        <span style={naskh(48)}>{receiptCopy(copy, 'result')}</span><span style={mono(84, {color: C.good})}><DesignText>{"1 / 1"}</DesignText></span></div>},
    ]}/>
    <Seal cx={870} cy={1070} size={150} at={86} angle={-14}/>
  </DesignRoot>;
};

