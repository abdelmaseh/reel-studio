import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, X1, ramp, useInkLayout, Parchment, InkBlock, BrushRule, Receipt, dashRow, naskh, PAD, Kicker} from './kit';

import type {FamilyDesignProps} from '../../family-designs';
import {DesignRoot, sceneCopy, useFonts} from './kit';
import {receiptCopy} from './copy';

export const Intro: React.FC<FamilyDesignProps> = ({scene}) => {
  if (scene.family !== 'intro') return null;
  const d = scene.data;
  const copy = sceneCopy(d), FONT = useFonts(), inkLayout = useInkLayout();
  const f = useCurrentFrame();
  // The claim is hero one: as big as the width allows (about 200 px for the sample), 2 or 3 balanced lines.
  const L = inkLayout(d.title, [{lines: 2, size: 236, min: 150, lh: 1.14}, {lines: 3, size: 176, min: 96, lh: 1.12}]);
  const n = L.lines.length;
  const titleTop = n === 2 ? 350 : 314;
  const ruleTop = titleTop + n * L.box + 8, ruleH = 42;
  // Hero two is the receipt stub: it prints the real subtitle as its one line item, under the label «المصدر».
  const RW = 620, RX = 66, ROT = -5, rise = RW * Math.sin(Math.abs(ROT) * Math.PI / 180);
  const recTop = Math.max(950, Math.round(ruleTop + ruleH + 8 + rise));
  const S = inkLayout(d.subtitle, [{family: FONT.naskh, weight: 700, width: RW - 2 * PAD, size: 54, min: 44, lines: 1, lh: 1.25}, {family: FONT.naskh, weight: 700, width: RW - 2 * PAD, size: 42, min: 32, lines: 2, lh: 1.22}]);
  const itemH = S.lines.length * S.box + 28;
  const tIn = ramp(f, 30, 24);
  return <DesignRoot copy={copy}>
    <Parchment pitch={L.box} offset={titleTop + L.baseline}/>
    <Kicker text={d.kicker} top={titleTop - 58} at={2}/>
    <InkBlock L={L} top={titleTop} at={6}/>
    <BrushRule left={X1 - 640} top={ruleTop} w={640} h={ruleH} at={6 + (n - 1) * 18 + 14} dur={20}/>
    <Receipt left={RX + (1 - tIn) * -170} top={recTop + (1 - tIn) * 110} width={RW} rot={ROT} origin="0 0" start={34} seed={3}
      rows={[
        {h: 60, node: <div style={{height: 60, padding: `0 ${PAD}px`, display: 'flex', alignItems: 'center', direction: copy.dir}}><span style={naskh(52, {color: C.ink})}>{receiptCopy(copy, 'source')}</span></div>},
        dashRow(18),
        {h: itemH, node: <div style={{height: itemH, padding: `0 ${PAD}px`, display: 'flex', flexDirection: 'column', justifyContent: 'center', direction: copy.dir}}>
          {S.lines.map((l, i) => <div key={i} style={naskh(S.size, {lineHeight: `${S.box}px`, whiteSpace: 'nowrap', color: C.ink})}>{l}</div>)}</div>},
      ]}/>
  </DesignRoot>;
};

