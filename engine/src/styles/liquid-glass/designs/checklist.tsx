import {DesignText} from '../../../style-kit/digits';
import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import React from 'react';
import {Easing, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {C, MONO, DIM, GLOW, rgba, clamp01, mix, ramp, fit, Glass, Chip, Headline, headH, StatusRing, lensState, DesignScene, X0, X1, CW} from './kit';
import {glassWord} from './copy';
// ---- checklist ----
export const checkGeo = (d: any) => {
  const total = d.items.length, compact = total >= 4;
  const titleH = headH(d.title, [{size: 112, min: 70, lines: 2}], CW - 215, 700, 1.2, d.font);
  const top = 380 + Math.max(titleH, 190) + 36;
  const panel = {x: X0, y: top, w: CW, h: 1130 - top};
  const rowH = (panel.h - 36) / total;
  const ringSize = compact ? 80 : 96;
  const lensX = X1 - 44 - ringSize / 2;
  return {total, compact, panel, rowH, ringSize, rowCy: d.items.map((_: unknown, i: number) => panel.y + 18 + rowH * (i + 0.5)), ats: d.items.map((it: {atFrame:number}) => it.atFrame), lensX};
};
const checkStops = (d: any) => { const g = checkGeo(d);
  return [{x: 880, y: g.panel.y - 90, at: 4}, ...d.items.map((it: any, i: number) => ({x: g.lensX, y: g.rowCy[i], at: it.atFrame - 2}))]; };
const ChecklistBody: React.FC<{d: any; n: string}> = ({d}) => {
  const f = useCurrentFrame();
  const g = checkGeo(d);
  const missing = d.variant === 'missing';
  const done = missing ? 0 : d.items.filter((i: any) => f >= i.atFrame + 10).length;
  const prog = missing ? 0 : clamp01(done / g.total);
  const ringSize = g.compact ? 80 : 96;
  return <>
    <Chip text={d.kicker} y={292} at={2} dot={missing ? C.rose : C.cyan}/>
    <Headline text={d.title} top={376} width={CW - 215} opts={[{size: 112, min: 70, lines: 2}]} at={6}/>
    <Glass x={X0} y={380} w={170} h={170} r={85} at={8} lite tint={missing ? 'rose' : 'none'}>
      <svg width="170" height="170" viewBox="0 0 190 190" style={{position: 'absolute', inset: 0}}>
        <circle cx="95" cy="95" r="80" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="8"/>
        <circle cx="95" cy="95" r="80" fill="none" stroke={missing ? C.rose : C.cyan} strokeWidth="8" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.max(0.001, prog)}
          transform="rotate(-90 95 95)" style={{filter: `drop-shadow(0 0 8px ${rgba(missing ? C.rose : C.cyan, 0.8)})`}}/>
      </svg>
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'ltr', fontFamily: MONO, fontWeight: 600, fontSize: 54}}>
        <span style={{color: missing ? C.rose : C.cyan}}><DesignText>{done}</DesignText></span><span style={{color: DIM, fontSize: 36}}>/<DesignText>{g.total}</DesignText></span></div>
    </Glass>
    <Glass x={g.panel.x} y={g.panel.y} w={g.panel.w} h={g.panel.h} r={52} at={10} dark={0.75} tint={missing ? 'rose' : 'none'} sweepAt={missing ? undefined : d.items[d.items.length - 1].atFrame}>
      {d.items.map((it: any, i: number) => {
        const cy = g.rowCy[i] - g.panel.y;
        const p = ramp(f, it.atFrame, 22, Easing.inOut(Easing.cubic));
        const on = ramp(f, it.atFrame - 6, 10) * (i < d.items.length - 1 ? 1 - ramp(f, g.ats[i + 1] - 16, 10) : 1);
        const t = fit(it.label, d.font, 700, 520, {size: g.compact ? 54 : 62, min: 40, lines: 1}, 1.2);
        const dd = fit(it.detail, d.font, 400, 520, {size: g.compact ? 32 : 38, min: 26, lines: 1}, 1.3);
        return <React.Fragment key={i}>
          <div style={{position: 'absolute', [d.copy.opposite]: 22, [d.copy.side]: 22, top: cy - g.rowH / 2 + 4, height: g.rowH - 8, borderRadius: 34, opacity: on,
            background: `linear-gradient(270deg, ${rgba(missing ? C.rose : C.cyan, 0.2)}, ${rgba(missing ? C.rose : C.cyan, 0)} 85%)`}}/>
          <div data-cue-at={it.atFrame} data-event-progress={p} style={{position: 'absolute', [d.copy.side]: 44, top: cy - ringSize / 2, width: ringSize, height: ringSize, opacity: ramp(f, it.atFrame - 14, 12)}}><StatusRing size={ringSize} p={p} missing={missing}/></div>
          <div style={{position: 'absolute', [d.copy.side]: 44 + ringSize + 34 + 76, width: 520, top: cy - g.rowH / 2, height: g.rowH, display: 'flex', flexDirection: 'column', justifyContent: 'center', direction: d.copy.dir, textAlign: d.copy.align,
            opacity: mix(0.5, 1, ramp(f, it.atFrame - 10, 12))}}>
            <div style={{fontFamily: d.font, fontWeight:headlineWeight(d.font,'Grid Sans',700), fontSize: t.size, lineHeight: 1.2, color: '#fff', whiteSpace: 'nowrap', textShadow: GLOW}}>{it.label}</div>
            <div style={{fontFamily: d.font, fontWeight: 400, fontSize: dd.size, lineHeight: 1.3, color: missing ? rgba(C.rose, 0.95) : DIM, whiteSpace: 'nowrap'}}>{it.detail}</div>
          </div>
          <div style={{position: 'absolute', [d.copy.opposite]: 52, top: cy - 18, fontFamily: MONO, fontWeight: 600, fontSize: 26, letterSpacing: 3, direction: 'ltr', color: missing ? rgba(C.rose, 0.95) : C.cyan, opacity: ramp(f, it.atFrame + 6, 10)}}><DesignText>{`0${i + 1} · ${glassWord(missing ? 'missing' : 'done', d.copy)}`}</DesignText></div>
          {i < d.items.length - 1 ? <div style={{position: 'absolute', [d.copy.opposite]: 44, [d.copy.side]: 44, top: cy + g.rowH / 2 - 1, height: 1.5, background: 'rgba(255,255,255,0.12)'}}/> : null}
        </React.Fragment>;
      })}
    </Glass>
  </>;
};
export const checkLens = (f: number, d: any) => {
  const s = lensState(f, checkStops(d), {appear: 2, r: Math.max(78, Math.min(120, checkGeo(d).rowH * 0.62)), zoom: 1.6, travel: 14, arc: 30});
  // Keep the magnified status ring above the rail, including its soft entrance.
  return {...s, cy:Math.min(s.cy,1149-s.r)};
};


export const Checklist: React.FC<FamilyDesignProps> = props => {
  const {scene} = props;
  if (scene.family !== 'checklist') return null;
  return <DesignScene {...props} tone={3} Body={ChecklistBody} lens={checkLens} />;
};
