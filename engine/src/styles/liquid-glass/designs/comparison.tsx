import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import React from 'react';
import {Easing, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {C, W, DIM, GLOW, rgba, clamp01, mix, ramp, fit, Glass, Headline, headH, Check, DesignScene, H, X0, CW, useGlass} from './kit';
// ---- comparison ----
export const cmpGeo = (d: any) => {
  const top = 292 + headH(d.title, [{size: 112, min: 72, lines: 2}], CW, 700, 1.2, d.font) + 40;
  const bh = 270, ah = 320;
  const before = {y: top, h: bh}, after = {y: Math.min(1236 - ah, top + bh + 78), h: ah};
  const dgW = 230, dgX = 48;   // diagram box inside each card (local)
  return {before, after, dgW, dgX,
    bcx: X0 + dgX + dgW / 2, bcy: before.y + bh / 2, acx: X0 + dgX + dgW / 2, acy: after.y + ah / 2};
};
/** Fine dots and glints behind both cards: frosted glass hides them, clear glass shows them sharp. They are what makes the blur drop readable. */
const BACK = Array.from({length: 110}, (_, i) => { const a = Math.sin(i * 127.1 + 3) * 43758.5453, b = Math.sin(i * 311.7 + 9) * 24634.6345;
  const fx = a - Math.floor(a), fy = b - Math.floor(b); return {x: 52 + fx * 976, y: fy, r: 1.2 + (((a * 13) % 1 + 1) % 1) * 1.8, o: 0.4 + (((b * 7) % 1 + 1) % 1) * 0.4, glint: i % 9 === 0}; });
const Backplate: React.FC<{y0: number; y1: number}> = ({y0, y1}) => {
  const f = useCurrentFrame();
  return <svg width={W} height={H} style={{position: 'absolute', inset: 0, opacity: ramp(f, 6, 20)}}>
    <defs><pattern id="lg-dots" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1.5" fill="#fff" fillOpacity="0.34"/></pattern></defs>
    <rect x="40" y={y0} width="1000" height={y1 - y0} fill="url(#lg-dots)"/>
    {BACK.map((d, i) => <circle key={i} cx={d.x} cy={y0 + d.y * (y1 - y0)} r={d.glint ? 3.6 : d.r} fill={d.glint ? C.cyan : '#fff'} fillOpacity={d.o * (d.glint ? 1 : 0.8) * (0.8 + 0.2 * Math.sin(f * 0.06 + i))}
      style={d.glint ? {filter: `drop-shadow(0 0 6px ${rgba(C.cyan, 0.9)})`} : undefined}/>)}
  </svg>;
};
/** Five lines of text: scattered fragments (p = 0) or one tidy block (p = 1). The same pieces in both cards. */
const PIECES = [{w: 190, x: 18, y: 12, r: -16}, {w: 130, x: 104, y: 44, r: 22}, {w: 214, x: 4, y: 82, r: 7}, {w: 150, x: 88, y: 120, r: -24}, {w: 176, x: 10, y: 150, r: 13}];
const Pieces: React.FC<{w: number; h: number; p: number; hue: 'rose' | 'cyan'; seed: number}> = ({w, h, p, hue, seed}) => {
  const f = useCurrentFrame();
  const d = useGlass();
  const col = hue === 'cyan' ? C.cyan : C.rose;
  const rowH = 24, gap = 14, total = PIECES.length * rowH + (PIECES.length - 1) * gap, top0 = (h - total) / 2;
  return <div style={{position: 'absolute', [d.copy.opposite]: 0, top: 0, width: w, height: h}}>
    {PIECES.map((pc, i) => {
      const k = clamp01((p * 1.4) - i * 0.08);
      const e = Easing.out(Easing.cubic)(clamp01(k));
      const sx = pc.x * (w / 230), sy = (h - 190) / 2 + pc.y + Math.sin(f * 0.05 + i * 1.7 + seed) * 3 * (1 - e);
      const x = mix(sx, 0, e), y = mix(sy, top0 + i * (rowH + gap), e), r = pc.r * (1 - e), pw = mix(pc.w * (w / 230), w * (i === PIECES.length - 1 ? 0.62 : 1), e);
      return <div key={i} style={{position: 'absolute', [d.copy.opposite]: x, top: y, width: pw, height: rowH, borderRadius: rowH / 2, transform: `rotate(${r}deg)`,
        background: `linear-gradient(90deg, ${rgba(col, mix(0.3, 0.5, e))}, ${rgba(col, mix(0.1, 0.2, e))})`, boxShadow: `inset 0 0 0 1.5px ${rgba(col, mix(0.55, 0.95, e))}${e > 0.5 ? `, 0 0 ${16 * e}px ${rgba(col, 0.45 * e)}` : ''}`}}/>;
    })}
  </div>;
};
const ComparisonBody: React.FC<{d: any; n: string}> = ({d}) => {
  const f = useCurrentFrame();
  const g = cmpGeo(d);
  const act = ramp(f, 66, 16), dimB = ramp(f, 62, 18), clear = ramp(f, 58, 22);
  const strike = ramp(f, 46, 14);
  const bd = fit(d.beforeDetail, d.font, 600, 560, {size: 66, min: 44, lines: 1}, 1.2), ad = fit(d.afterDetail, d.font, 700, 580, {size: 84, min: 56, lines: 1}, 1.2);
  const Tag: React.FC<{text: string; ok?: boolean}> = ({text, ok}) => <div style={{display: 'flex', alignItems: 'center', gap: 16, direction: d.copy.dir}}>
    <div style={{width: 58, height: 58, borderRadius: 29, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ok ? rgba(C.cyan, 0.2) : 'rgba(255,255,255,0.1)',
      boxShadow: ok ? `inset 0 0 0 2px ${C.cyan}, 0 0 24px ${rgba(C.cyan, 0.5)}` : 'inset 0 0 0 2px rgba(255,255,255,0.3)'}}>
      {ok ? <Check p={ramp(f, 72, 10)} size={44} color="#fff" width={11}/> : <svg width="34" height="34" viewBox="0 0 100 100"><path d="M26 26 L74 74 M74 26 L26 74" stroke={DIM} strokeWidth="11" strokeLinecap="round"/></svg>}
    </div>
    <span style={{fontFamily: d.font, fontWeight: 600, fontSize: 42, color: ok ? C.cyan : DIM, whiteSpace: 'nowrap'}}>{text}</span>
  </div>;
  return <>
    <Backplate y0={g.before.y - 10} y1={g.after.y + g.after.h + 10}/>
    <Headline text={d.title} top={292} opts={[{size: 112, min: 72, lines: 2}]} at={2}/>
    <div style={{opacity: mix(1, 0.62, dimB), transform: `scale(${mix(1, 0.97, dimB)})`, transformOrigin: '50% 60%'}}>
      <Glass x={X0} y={g.before.y} w={CW} h={g.before.h} r={52} at={8} dark={0.7}>
        <div style={{position: 'absolute', [d.copy.opposite]: g.dgX, top: 40, width: g.dgW, height: g.before.h - 80}}><Pieces w={g.dgW} h={g.before.h - 80} p={0} hue="rose" seed={0}/></div>
        <div style={{position: 'absolute', top: 36, [d.copy.side]: 52, direction: d.copy.dir}}><Tag text={d.beforeTitle}/></div>
        <div style={{position: 'absolute', [d.copy.side]: 58, bottom: 40, direction: d.copy.dir, fontFamily: d.font, fontWeight: 600, fontSize: bd.size, lineHeight: 1.3, color: DIM, whiteSpace: 'nowrap'}}>
          {d.beforeDetail}
          <div style={{position: 'absolute', top: '56%', [d.copy.side]: -12, width: `calc(${strike * 100}% + 24px)`, height: 6, borderRadius: 3, background: C.rose, opacity: strike > 0 ? 0.95 : 0, boxShadow: `0 0 18px ${rgba(C.rose, 0.7)}`}}/>
        </div>
      </Glass>
    </div>
    <svg width="80" height="70" viewBox="0 0 80 70" style={{position: 'absolute', [d.copy.opposite]: W / 2 - 40, top: g.before.y + g.before.h + 4, opacity: ramp(f, 44, 12)}}>
      <path d="M14 14 L40 40 L66 14" fill="none" stroke={C.cyan} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" style={{filter: `drop-shadow(0 0 10px ${rgba(C.cyan, 0.9)})`}}/></svg>
    <Glass x={X0} y={g.after.y} w={CW} h={g.after.h} r={52} at={16} dark={0.5} active={act} bf={mix(24, 0, clear)} sweepAt={70}>
      <div style={{position: 'absolute', [d.copy.opposite]: g.dgX, top: 40, width: g.dgW, height: g.after.h - 80}}><Pieces w={g.dgW} h={g.after.h - 80} p={ramp(f, 66, 26)} hue="cyan" seed={2}/></div>
      <div style={{position: 'absolute', top: 40, [d.copy.side]: 52, direction: d.copy.dir}}><Tag text={d.afterTitle} ok/></div>
      <div style={{position: 'absolute', [d.copy.side]: d.copy.ar ? 220 : 58, bottom: 38, direction: d.copy.dir, fontFamily: d.font, fontWeight:headlineWeight(d.font,'Grid Sans',700), fontSize: ad.size, lineHeight: 1.25, color: '#fff', whiteSpace: 'nowrap', textShadow: GLOW}}>{d.afterDetail}</div>
    </Glass>
  </>;
};


export const Comparison: React.FC<FamilyDesignProps> = props => {
  const {scene} = props;
  if (scene.family !== 'comparison') return null;
  return <DesignScene {...props} tone={4} Body={ComparisonBody} />;
};
