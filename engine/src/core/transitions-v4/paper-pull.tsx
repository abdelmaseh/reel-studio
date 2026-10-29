import React from 'react';
import {AbsoluteFill, Easing, useCurrentFrame} from 'remotion';
import {useProbe} from '../safe';
import type {TransitionProps} from '../../prepared-edit/transition-registry';
const W = 1080, H = 1920;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const rng = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const tornPts = (w: number, y: number, seed: number, amp: number, step = 11): [number, number][] => {
  const r = rng(seed); const pts: [number, number][] = [];
  for (let x = -step; x <= w + step; x += step) pts.push([x, y + (r() - 0.5) * amp * 2 + Math.sin(x / w * 11 + seed) * amp * 0.55]);
  return pts;
};
/** Wrap the retained, settled OUTGOING sheet. The timeline must mount the incoming scene fourteen frames early. */
export const PAPER_PULL_DURATION = 14;
export const PAPER_PULL_LEAD = 14;
export const PaperPull: React.FC<TransitionProps> = p => {
  const frame = useCurrentFrame(), probe = useProbe();
  if (probe !== null) return <>{p.children}</>;
  const box = p.box ?? {x: 0, y: 0, width: W, height: H};
  const q = (frame - p.atFrame) / Math.max(1, p.durationInFrames - 1), children = p.children;
  return <div data-transition="paper-pull" style={{position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `scale(${box.width / W}, ${box.height / H})`, transformOrigin: '0 0'}}>
      <PullSheet q={q} paper={p.paper} ink={p.ink}>{children}</PullSheet>
    </div>
  </div>;
};
const PullSheet: React.FC<{q: number; paper?: string; ink?: string; children?: React.ReactNode}> = ({q, paper = '#F4EDE1', ink = '#FBF8F0', children}) => {
  const e = Easing.bezier(0.55, 0.04, 0.3, 1)(clamp01(q));
  if (q >= 1) return null;
  const dy = -e * (H + 170), rot = -4 * e;
  const edge = tornPts(W + 80, 20, 77, 6, 12);
  const edgePoly = `polygon(0px 0px, ${W + 80}px 0px, ${[...edge].reverse().map(([x, y]) => `${x.toFixed(1)}px ${(y).toFixed(1)}px`).join(', ')})`;
  return <>
    <AbsoluteFill style={{background: `rgba(26,14,6,${0.30 * (1 - e)})`}}/>
    <AbsoluteFill style={{transform: `translateY(${dy}px) rotate(${rot}deg)`, transformOrigin: '30% 100%', overflow: 'visible'}}>
      {children}
      <div style={{position: 'absolute', left: -40, top: H - 1, width: W + 80, height: 46, filter: 'drop-shadow(0 6px 8px rgba(30,18,8,0.4))'}}>
        <div style={{position: 'absolute', inset: 0, background: ink, clipPath: `polygon(0px 0px, ${W + 80}px 0px, ${[...tornPts(W + 80, 30, 91, 5, 12)].reverse().map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(', ')})`}}/>
        <div style={{position: 'absolute', inset: 0, background: paper, clipPath: edgePoly}}/></div>
      <div style={{position: 'absolute', left: -40, top: H + 38, width: W + 80, height: 170, background: 'linear-gradient(180deg, rgba(26,14,6,0.34), rgba(26,14,6,0))'}}/>
    </AbsoluteFill>
  </>;
};

