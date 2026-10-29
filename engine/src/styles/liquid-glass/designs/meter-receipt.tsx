import {DesignText} from '../../../style-kit/digits';
import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import {fittedSize} from '../../../style-kit/design-safety';
import React from 'react';
import {Easing, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {C, DISPLAY, MONO, DIM, GLOW, rgba, ramp, FitOpt, fit, Glass, Chip, Headline, headH, lensState, useGlass, DesignScene, X0, X1, CW, instrumentFont, instrumentSpacing, instrumentDirection} from './kit';

// ---- meter-receipt (signature) ----
const MTR_TITLE: FitOpt[] = [{size: 112, min: 72, lines: 1}, {size: 92, min: 64, lines: 2}];
export const mtr = (d: any) => {
  const titleTop = 372, th = headH(d.title, MTR_TITLE, CW, 700, 1.2, d.font);
  const top = titleTop + th + 118, bottom = 1090, tubeW = 360, pad = 20;
  const h = bottom - top, innerH = h - 2 * pad;
  const levelY = (v: number) => top + pad + innerH * (1 - v / d.maximum);
  return {titleTop, top, h, tubeW, pad, innerH, rightX: X1 - tubeW, leftX: X0, levelY, yB: levelY(d.before.value), yA: levelY(d.after.value), maximum:d.maximum, unit:d.unit};
};
type Mtr = ReturnType<typeof mtr>;

const meterNumY = (g: Mtr, v: number) => g.top + g.pad + Math.max(16, Math.min(g.innerH - 150, g.innerH * (1 - v / g.maximum) + 36)) + 60;
const meterStops = (d: any) => { const g = mtr(d);
  return [{x: 800, y: g.top + 60, at: 20}, {x: g.rightX + g.tubeW / 2, y: meterNumY(g, d.before.value), at: (d.before.atFrame ?? 18)+26}, {x: g.leftX + g.tubeW / 2, y: meterNumY(g, d.after.value), at: (d.after.atFrame ?? 46)+34}]; };
const Tube: React.FC<{g: Mtr; x: number; value: number; fillAt: number; label: string; kind: 'before' | 'after'; at: number; active: number}> = ({g, x, value, fillAt, label, kind, at, active}) => {
  const f = useCurrentFrame();
  const d = useGlass();
  const p = ramp(f, fillAt, 36, Easing.bezier(0.3, 0.7, 0.2, 1));
  const iw = g.tubeW - 2 * g.pad, cur = value * p;
  const fillH = g.innerH * (cur / g.maximum);
  const c1 = kind === 'after' ? C.cyan : C.violet, c2 = kind === 'after' ? C.mint : C.cyan;
  const waveY = g.innerH - fillH;
  const ph = f * 0.12 + (kind === 'after' ? 2 : 0);
  const wave = Array.from({length: 25}, (_, i) => { const xx = i / 24 * iw, yy = waveY + Math.sin(ph + i * 0.55) * 7 * Math.min(1, fillH / 40); return `${i ? 'L' : 'M'}${xx} ${yy}`; }).join(' ');
  const id = `lg-liq-${kind}`;
  const suffix=g.unit==='%'?'%':'';
  const size=fittedSize(String(value)+suffix,d.display,700,112,iw-32);
  const numberY=Math.max(14,Math.min(g.innerH-size*1.3-16,waveY+36));
  return <Glass x={x} y={g.top} w={g.tubeW} h={g.h} r={120} at={at} dark={0.5} active={active} sweepAt={fillAt-2} blurIn={14}>
    <div style={{position: 'absolute', [d.copy.opposite]: g.pad, top: g.pad, width: iw, height: g.innerH, borderRadius: 100, overflow: 'hidden', background: 'rgba(5,9,22,0.4)'}}>
      <svg data-meter-at={fillAt} data-meter-progress={p} width={iw} height={g.innerH} style={{position: 'absolute', inset: 0}}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c2}/><stop offset="1" stopColor={c1}/></linearGradient></defs>
        <path d={`${wave} L${iw} ${g.innerH} L0 ${g.innerH} Z`} fill={`url(#${id})`} opacity="0.92"/>
        <path d={wave} fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="3" style={{filter: `drop-shadow(0 0 8px ${rgba(c2, 0.9)})`}}/>
        <rect x="26" y="20" width="22" height={g.innerH - 40} rx="11" fill="rgba(255,255,255,0.14)"/>
      </svg>
      <div data-vial-inner-width={iw} data-vial-inner-height={g.innerH} data-vial-number-top={numberY} data-vial-number-size={size} style={{position: 'absolute', [d.copy.opposite]: 0, [d.copy.side]: 0, top: numberY, textAlign: 'center', direction: 'ltr', fontFamily: DISPLAY, fontWeight: 700,
        fontSize: size, lineHeight: 1.1, color: fillH > 170 ? C.ink : '#fff', fontVariantNumeric: 'tabular-nums', opacity: ramp(f, fillAt, 10)}}><DesignText>{Number.isInteger(value) ? Math.round(cur) : Number(cur.toFixed(2))}</DesignText><DesignText>{suffix}</DesignText></div>
    </div>
    <div style={{position: 'absolute', top: -92, [d.copy.opposite]: 0, [d.copy.side]: 0, display: 'flex', justifyContent: 'center', direction: d.copy.dir, fontFamily: d.font, fontWeight:headlineWeight(d.font,'Grid Sans',700), fontSize: 68, color: '#fff', textShadow: GLOW}}><DesignText>{label}</DesignText></div>
  </Glass>;
};
const MeterBody: React.FC<{d: any; n: string}> = ({d}) => {
  const f = useCurrentFrame();
  const g = mtr(d);
  const mono = fit(d.note, instrumentFont(d.note,d.font), 400, 787, {size: 24, min: 17, lines: 1}, 1.2);
  const midX = (g.leftX + g.tubeW + g.rightX) / 2, gapW = g.rightX - (g.leftX + g.tubeW);
  const delta = Number((d.after.value - d.before.value).toFixed(2));
  const actA = ramp(f, (d.after.atFrame ?? 46), 12), actB = ramp(f, (d.before.atFrame ?? 18), 12) * (1 - ramp(f, (d.after.atFrame ?? 46)+12, 10) * 0.7);
  return <>
    <Chip text={d.kicker} y={292} at={2}/>
    <Headline text={d.title} top={g.titleTop} opts={MTR_TITLE} at={6}/>
    {/* the shared 0..100 scale sits between the tubes */}
    <div style={{position: 'absolute', [d.copy.opposite]: g.leftX + g.tubeW, top: g.top + g.pad, width: gapW, height: g.innerH, opacity: ramp(f, 14, 16)}}>
      {Array.from({length: 21}, (_, i) => { const v = i * g.maximum / 20, y = g.innerH * (1 - i / 20), major = i % 5 === 0;
        return <React.Fragment key={i}>
          <div style={{position: 'absolute', [d.copy.opposite]: major ? 10 : 30, [d.copy.side]: major ? 10 : 30, top: y - 1, height: 2, background: major ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.28)'}}/>
          {major ? <div style={{position: 'absolute', [d.copy.opposite]: 0, [d.copy.side]: 0, top: y - 40, textAlign: 'center', fontFamily: MONO, fontWeight: 600, fontSize: 26, color: DIM, direction: 'ltr'}}><DesignText>{Number(v.toFixed(2))}</DesignText></div> : null}
        </React.Fragment>; })}
    </div>
    <Tube g={g} x={g.rightX} value={d.before.value} fillAt={d.before.atFrame ?? 18} label={d.before.label} kind="before" at={8} active={actB}/>
    <Tube g={g} x={g.leftX} value={d.after.value} fillAt={d.after.atFrame ?? 46} label={d.after.label} kind="after" at={14} active={actA}/>
    <div style={{position: 'absolute', [d.copy.opposite]: midX - 100, top: Math.max(g.top+40,g.yA-84), width: 200, height: 64, borderRadius: 32, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', background: rgba(C.cyan, 0.16),
      boxShadow: `inset 0 0 0 2px ${rgba(C.cyan, 0.9)}, 0 0 30px ${rgba(C.cyan, 0.4)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'ltr', fontFamily: MONO, fontWeight: 600, fontSize: 30,
      color: C.cyan, opacity: ramp(f, (d.after.atFrame ?? 46)+38, 12)}}><DesignText>{`${delta >= 0 ? '+' : ''}${delta}`}</DesignText></div>
    <div style={{position:'absolute',top:g.top+g.h+12,left:X0,width:787,textAlign:'center',fontFamily:d.font,fontSize:fittedSize(d.unit,d.font,400,26,740),lineHeight:'36px',color:DIM,direction:d.copy.dir}}><DesignText>{d.unit}</DesignText></div>
    <div style={{position: 'absolute', top: g.top + g.h + 52, left: X0, width: 787, textAlign: 'center', fontFamily: instrumentFont(d.note,d.font), fontWeight: 400, fontSize: mono.size, letterSpacing: instrumentSpacing(d.note,1.4),
      color: 'rgba(255,255,255,0.58)', direction: instrumentDirection(d.note), opacity: ramp(f, 56, 16)}}>{d.note}</div>
  </>;
};
export const meterLens = (f: number, d: any) => lensState(f, meterStops(d), {appear: 14, r: 172, zoom: 1.3, travel: 24, arc: 50});


export const MeterReceipt: React.FC<FamilyDesignProps> = props => {
  const {scene} = props;
  if (scene.family !== 'meter-receipt') return null;
  return <DesignScene {...props} tone={0} Body={MeterBody} lens={meterLens} data={{...scene.data,before:scene.data.rows[0],after:scene.data.rows[1],note:scene.data.source}}/>;
};
