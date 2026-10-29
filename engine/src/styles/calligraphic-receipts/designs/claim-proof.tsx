import {DesignText} from '../../../style-kit/digits';
import {useDesignText, useDesignData} from '../../../style-kit/digits';
import React from 'react';
import {Easing, useCurrentFrame} from 'remotion';
import {C, W, H, X0, pen, clamp01, ramp, useInkLayout, one, Parchment, InkBlock, Stroke, Seal, Receipt, dashRow, lineRow, mono, naskh, num, polyline} from './kit';

import type {FamilyDesignProps} from '../../family-designs';
import {DesignRoot, sceneCopy, useFonts} from './kit';
import {receiptCopy} from './copy';
import type {ClaimProofScene} from '../scenes/schema';

export type ClaimProofDesignProps = {scene: ClaimProofScene};
export const ClaimProof: React.FC<FamilyDesignProps | ClaimProofDesignProps> = ({scene}) => {
  if (scene.family !== 'claim-proof') return null;
  const shown = useDesignText();
  const d = useDesignData(scene.data);
  const copy = sceneCopy(d), FONT = useFonts(), inkLayout = useInkLayout();
  const f = useCurrentFrame();
  const colW = 360, colLeft = copy.ar ? 615 : 105;
  const L = inkLayout(d.claim.join(' '), {width: colW, size: d.claim.length === 4 ? 166 : 184, min: 56, lines: d.claim.length, lh: 1.14}, d.claim);
  const top = 330;
  const keyI = d.keyIndex, keyLineTop = top + keyI * L.box;
  const recW = 440, recLeft = copy.ar ? X0 + 32 : 543, recTop = 318;
  const roll = ramp(f, d.totalFrame, 22, Easing.bezier(0.2, 0.8, 0.2, 1));
  const keyW = one(d.claim[keyI], {family: FONT.ruqaa, weight: L.weight, width: colW, size: L.size, min: L.size}).width;
  // receipt geometry (heights below must match the rows): the total line decides where the connector lands
  const H_HEAD = 90, H_DASH = 28, H_ROW = 118, H_TOTAL = 300, H_NOTE = 60;
  const totalTop = recTop + 24 + H_HEAD + H_DASH + 2 * H_ROW + H_DASH;
  const ey = totalTop + 168;
  // pen loop around the key word, drawn like a brush ellipse that overshoots its start
  const kcx = copy.ar ? colLeft + colW - keyW / 2 - 4 : colLeft + keyW / 2 + 4, kcy = keyLineTop + L.box/2;
  const rx = keyW / 2 + 14, ry = Math.min(98,L.box*.48);
  const loop: [number, number][] = Array.from({length: 46}, (_, i) => { const u = i / 45, a = -Math.PI * 0.62 - u * Math.PI * 2.12; // counter-clockwise, right-hand pen start
    return [kcx + Math.cos(a) * rx * (1 + 0.02 * u), kcy + Math.sin(a) * ry * (1 - 0.03 * u)] as [number, number]; });
  const loopW = loop.map((_, i) => { const u = i / 45; return 3 + 15 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + u * 0.95)), 0.7) * (1 - 0.55 * u); });
  const loopP = ramp(f, d.totalFrame + 2, 16, pen);
  // connector: leaves the loop on its left and settles on the total line
  const sx = kcx + (copy.ar ? -rx - 6 : rx + 6), sy = kcy;
  const ex = copy.ar ? recLeft + recW + 14 : recLeft - 14;
  const conn: [number, number][] = Array.from({length: 40}, (_, i) => { const u = i / 39, a = 1 - u;
    const p0 = [sx, sy], p1 = [sx + (copy.ar ? -70 : 70), sy - 70], p2 = [ex + (copy.ar ? 80 : -80), ey + 70], p3 = [ex, ey];
    return [a * a * a * p0[0] + 3 * a * a * u * p1[0] + 3 * a * u * u * p2[0] + u * u * u * p3[0], a * a * a * p0[1] + 3 * a * a * u * p1[1] + 3 * a * u * u * p2[1] + u * u * u * p3[1]] as [number, number]; });
  const connP = ramp(f, d.totalFrame + 18, 16, pen);
  const unitSpan = <span style={naskh(34, {display: 'inline-block'})}><DesignText>{d.unit}</DesignText></span>;
  return <DesignRoot copy={copy}>
    <Parchment pitch={L.box} offset={top + L.baseline}/>
    <InkBlock L={L} top={top} at={d.claimFrame} step={14} per={20} left={colLeft} width={colW} colors={d.claim.map((_, i) => i === keyI ? C.rust : C.ink)}/>
    <Receipt left={recLeft} top={recTop} width={recW} start={d.receiptFrame} rot={-0.8} seed={51} rows={[
      {h: H_HEAD, node: <div style={{height: H_HEAD, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><span style={naskh(48, {letterSpacing: copy.ar ? 0 : 3})}>{receiptCopy(copy, 'receipt')}</span></div>},
      dashRow(H_DASH, 0.42, 30),
      lineRow({copy, label: d.rows[0].label, value: <span style={{direction: copy.dir}}><DesignText>{d.rows[0].value}</DesignText> {unitSpan}</span>, h: H_ROW, size: 44, pad: 30, vsize: 46}),
      lineRow({copy, label: d.rows[1].label, value: <span style={{direction: copy.dir}}><DesignText>{d.rows[1].value}</DesignText> {unitSpan}</span>, h: H_ROW, size: 44, pad: 30, vsize: 46}),
      dashRow(H_DASH, 0.42, 30),
      {gap: 4, h: H_TOTAL, node: <div style={{height: H_TOTAL, padding: '0 30px', borderTop: `7px double ${C.ink}`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative'}}>
        <div style={{position: 'absolute', left: 8, right: 8, top: 28, bottom: 28, background: 'rgba(165,69,34,0.10)', borderRadius: 6}}/>
        <div style={{position: 'relative', ...naskh(44, {color: C.ink})}}>{d.diff.label}</div>
        <div style={{position: 'relative', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 14, direction: 'ltr'}}>
          <span data-count-progress={roll} style={{...mono(150), lineHeight: 1, color: C.rust}}>{shown(num(d.diff.value * roll, Number.isInteger(d.diff.value) ? 0 : 2))}</span>
          <span style={naskh(40, {color: C.ink})}><DesignText>{d.unit}</DesignText></span></div></div>},
      {h: H_NOTE, node: <div style={{height: H_NOTE, display: 'flex', alignItems: 'center', justifyContent: 'center', ...naskh(34, {fontWeight: 400, color: C.inkSoft})}}>{d.note}</div>},
    ]}/>
    {loopP > 0 ? <Stroke pts={loop} wd={loopW} p={loopP} color={C.rust} box={{x: kcx - rx - 40, y: kcy - ry - 40, w: 2 * rx + 80, h: 2 * ry + 80}} streak={C.paper} seed={6}/> : null}
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible'}}>
      <path d={polyline(conn)} fill="none" stroke={C.rust} strokeWidth={4.5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - connP} opacity={0.95}/>
      <circle cx={ex} cy={ey} r={11 * clamp01((connP - 0.88) * 8)} fill={C.rust}/>
    </svg>
    <Seal cx={copy.ar?936:936} cy={1040} size={150} at={d.totalFrame + 36} angle={-10}/>
  </DesignRoot>;
};

