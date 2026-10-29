import {DesignText} from '../../../style-kit/digits';
import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {C, DISPLAY, MONO, W, DIM, GLOW, rgba, clamp01, ramp, FitOpt, fit, Glass, Headline, headH, walk, DesignScene, H, X1, CW} from './kit';
import {glassWord} from './copy';
// ---- process ----
const PROC = {cardW: 700, cardH: 170, step: 125, disc: 118};
const PROC_T: FitOpt[] = [{size: 100, min: 72, lines: 2}];
export const procGeo = (d: any) => {
  const top = 292 + headH(d.title, PROC_T, CW, 700, 1.2, d.font) + 40;
  const gap = Math.min(86, Math.max(28, (1236 - top - 3 * PROC.cardH) / 2));
  return d.steps.map((s: {title:string;detail:string}, i: number) => {
    const y = top + i * (PROC.cardH + gap);
    const right = X1 - i * PROC.step + (!d.copy.ar && y + 130 > 1150 ? 162 : 0);
    const tt = fit(s.title, d.font, 700, 300, {size: 56, min: 40, lines: 1}, 1.2), dd = fit(s.detail, d.font, 400, 300, {size: 36, min: 28, lines: 1}, 1.3);
    return {right, x: right - PROC.cardW, y, dcx: right - 34 - PROC.disc / 2, dcy: y + PROC.cardH / 2, tt, dd};
  });
};
const PROC_AT = [32, 60, 88];
const procStops = (d: any) => { const g = procGeo(d);
  return [{x: 800, y: g[0].y - 90, at: 14}, ...g.map((c: {dcx:number;dcy:number}, i: number) => ({x: c.dcx, y: c.dcy, at: PROC_AT[i]}))]; };
const bez = (p0: number[], p1: number[], p2: number[], p3: number[], u: number) => { const v = 1 - u;
  return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]]; };
const ProcessBody: React.FC<{d: any; n: string}> = ({d}) => {
  const f = useCurrentFrame();
  const g = procGeo(d);
  const w = walk(f, procStops(d), 20, 0);
  const prog = clamp01((w.idx - 1) / 2);
  const seg = (k: number) => [[g[k].dcx, g[k].dcy], [g[k].dcx, g[k].dcy + 120], [g[k + 1].dcx, g[k + 1].dcy - 120], [g[k + 1].dcx, g[k + 1].dcy]];
  const path = `M${g[0].dcx} ${g[0].dcy} C${g[0].dcx} ${g[0].dcy + 120} ${g[1].dcx} ${g[1].dcy - 120} ${g[1].dcx} ${g[1].dcy} C${g[1].dcx} ${g[1].dcy + 120} ${g[2].dcx} ${g[2].dcy - 120} ${g[2].dcx} ${g[2].dcy}`;
  // the bead: straight in to node 1, then along the same curve the trail is drawn on
  let bx = w.x, by = w.y;
  if (w.idx >= 1) { const k = Math.min(1, Math.floor(w.idx - 1 + 1e-6)); const q = seg(k); [bx, by] = bez(q[0], q[1], q[2], q[3], clamp01(w.idx - 1 - k)); }
  const beadOp = ramp(f, 14, 8) * (w.idx >= 3 ? 1 - ramp(w.since, 0, 14) : 1);
  return <>
    <Headline text={d.title} top={292} opts={PROC_T} at={2}/>
    <svg width={W} height={H} style={{position: 'absolute', inset: 0, overflow: 'visible', transform:d.copy.ar ? undefined : 'scaleX(-1)'}}>
      <defs><linearGradient id="lg-trail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.cyan}/><stop offset="0.55" stopColor="#8fb8ff"/><stop offset="1" stopColor={C.violet}/></linearGradient></defs>
      <path d={path} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="5" strokeLinecap="round" pathLength={1} strokeDasharray="0.012 0.02"/>
      <path d={path} fill="none" stroke="url(#lg-trail)" strokeWidth="10" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog}
        style={{filter: `drop-shadow(0 0 12px ${rgba(C.cyan, 0.9)})`}}/>
    </svg>
    {d.steps.map((s: {title: string; detail: string}, i: number) => {
      const c = g[i], lit = ramp(f, PROC_AT[i] - 2, 12);
      const leave = i < 2 ? ramp(f, PROC_AT[i + 1] - 20, 10) : 0;   // the light has moved on: the node stays lit but calmer
      return <Glass key={i} x={c.x} y={c.y} w={PROC.cardW} h={PROC.cardH} r={52} at={8 + i * 8} dark={0.7} active={lit * (1 - 0.4 * leave)} sweepAt={PROC_AT[i] - 2}>
        <div data-process-badge={i} style={{position: 'absolute', [d.copy.opposite]: PROC.cardW - 34 - PROC.disc, top: (PROC.cardH - PROC.disc) / 2, width: PROC.disc, height: PROC.disc, borderRadius: PROC.disc / 2,
          boxShadow: `0 0 ${56 * lit * (1 - 0.5 * leave)}px ${rgba(C.cyan, 0.65 * lit)}, inset 0 0 0 2px rgba(255,255,255,${0.32 * (1 - lit)})`, background: 'rgba(255,255,255,0.08)'}}>
          <div style={{position: 'absolute', inset: 0, borderRadius: '50%', opacity: lit, background: `radial-gradient(circle at 34% 28%, #fff 0%, ${C.cyan} 38%, #1f9fc4 100%)`}}/>
          <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY, fontWeight: 700, fontSize: 58,
            color: lit > 0.5 ? C.ink : '#fff', direction: 'ltr'}}><DesignText>{i + 1}</DesignText></div>
        </div>
        <div style={{position: 'absolute', [d.copy.side]: 34 + PROC.disc + 78, top: 34, bottom: 0, width: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center', direction: d.copy.dir, textAlign: d.copy.align}}>
          <div style={{fontFamily: d.font, fontWeight:headlineWeight(d.font,'Grid Sans',700), fontSize: c.tt.size, lineHeight: 1.2, color: '#fff', whiteSpace: 'nowrap', textShadow: GLOW}}>{s.title}</div>
          <div style={{fontFamily: d.font, fontWeight: 400, fontSize: c.dd.size, lineHeight: 1.3, color: DIM, whiteSpace: 'nowrap', marginTop: 4}}>{s.detail}</div>
        </div>
        <div data-process-tag={i} style={{position: 'absolute', [d.copy.side]: 34 + PROC.disc + 78, top: 8, width: 300, fontFamily: MONO, fontWeight: 600, fontSize: 24, lineHeight: '30px', letterSpacing: 3, whiteSpace: 'nowrap', direction: 'ltr', color: lit > 0.5 ? C.cyan : 'rgba(255,255,255,0.5)'}}><DesignText>{`${glassWord('step', d.copy)} 0${i + 1}`}</DesignText></div>
        <div style={{position: 'absolute', [d.copy.side]: 28, bottom: 14, width: 90 * lit, height: 3, borderRadius: 2, background: C.cyan, boxShadow: `0 0 12px ${rgba(C.cyan, 0.8)}`}}/>
      </Glass>;
    })}
    <div style={{position: 'absolute', [d.copy.opposite]: bx - 30, top: by - 30, width: 60, height: 60, borderRadius: '50%', opacity: beadOp,
      background: `radial-gradient(circle at 36% 30%, #fff 0%, ${C.cyan} 42%, ${rgba(C.cyan, 0)} 72%)`, boxShadow: `0 0 44px ${rgba(C.cyan, 0.9)}, 0 0 100px ${rgba(C.cyan, 0.5)}`}}/>
  </>;
};


export const Process: React.FC<FamilyDesignProps> = props => {
  const {scene} = props;
  if (scene.family !== 'process') return null;
  return <DesignScene {...props} tone={2} Body={ProcessBody} />;
};
