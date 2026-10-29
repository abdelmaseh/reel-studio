import React from 'react';
import {Easing, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {C, MONO, DIM, rgba, ramp, FitOpt, fit, tryFit, Glass, Chip, Headline, lensState, DesignScene, X0, CW} from './kit';
import {glassWord} from './copy';
// ---- intro ----
const INTRO_T: FitOpt[] = [{size: 150, min: 128, lines: 3}, {size: 128, min: 100, lines: 3}, {size: 100, min: 76, lines: 4}];
export const introGeo = (d: any) => {
  const t = tryFit(d.title, d.font, 700, 830, INTRO_T, 1.2);
  const s = fit(d.subtitle, d.font, 500, 830, {size: 56, min: 38, lines: 2}, 1.35);
  const stack = t.lines.length * t.box + 36 + 2 + 36 + s.lines.length * s.box;
  const h = Math.max(640, Math.min(820, stack + 236));
  const slab = {x: X0, y: 420 + Math.round((820 - h) / 2), w: CW, h};
  const top0 = Math.round((h - stack) / 2);
  return {t, s, slab, stack, top0, lensX: X0 + 96, lensY: slab.y - 64};
};
const IntroBody: React.FC<{d: any; n: string}> = ({d, n}) => {
  const f = useCurrentFrame();
  const g = introGeo(d);
  const tilt = (1 - ramp(f, 4, 38)) * 6;
  const rule = ramp(f, 40, 40, Easing.inOut(Easing.cubic));
  const ruleTop = g.top0 + g.t.lines.length * g.t.box + 36;
  return <>
    <Chip text={d.kicker} y={g.slab.y - 114} at={2}/>
    <div style={{position: 'absolute', [d.copy.opposite]: X0 + 34, top: g.lensY - 24, fontFamily: MONO, fontWeight: 600, fontSize: 30, letterSpacing: 4, lineHeight: '48px', color: C.cyan, direction: 'ltr', opacity: ramp(f, 22, 16),
      textShadow: `0 0 20px ${rgba(C.cyan, 0.6)}`}}>{n ? `${glassWord('serial', d.copy)} ${n}` : ''}</div>
    <Glass x={g.slab.x} y={g.slab.y} w={g.slab.w} h={g.slab.h} r={56} at={6} tilt={tilt} dark={0.85} sweepAt={50}>
      <Headline text={d.title} top={g.top0} right={60} width={830} opts={INTRO_T} at={14} stagger={7}/>
      <div style={{position: 'absolute', top: ruleTop, [d.copy.side]: 60, width: 830, height: 2, background: 'rgba(255,255,255,0.16)', borderRadius: 1}}/>
      <div style={{position: 'absolute', top: ruleTop - 1, [d.copy.side]: 60 + (830 - 220) * rule, width: 220, height: 4, borderRadius: 2, opacity: rule > 0 && rule < 1 ? 1 : 0,
        background: `linear-gradient(270deg, ${rgba(C.cyan, 0)}, ${C.cyan})`, boxShadow: `0 0 20px ${rgba(C.cyan, 0.9)}`}}/>
      <div style={{position: 'absolute', top: ruleTop, [d.copy.side]: 60, width: 830, height: 2, background: `linear-gradient(270deg, ${rgba(C.cyan, 0.8)}, ${rgba(C.cyan, 0)})`, transformOrigin: '100% 50%',
        transform: `scaleX(${rule * 0.4})`}}/>
      <Headline text={d.subtitle} top={ruleTop + 38} right={g.slab.y + ruleTop + 38 + g.s.lines.length*g.s.box > 1150 && d.copy.ar ? 222 : 60} width={g.slab.y + ruleTop + 38 + g.s.lines.length*g.s.box > 1150 ? 668 : 830} opts={[{size: 56, min: 38, lines: 2}]} weight={500} lh={1.35} color={DIM} glow={false} at={34}/>
    </Glass>
  </>;
};
export const introLens = (f: number, d: any) => { const g = introGeo(d);
  return lensState(f, [{x: 860, y: g.lensY + 120, at: 30}, {x: g.lensX, y: g.lensY, at: 68}], {appear: 24, r: 104, zoom: 1.5, arc: 60}); };


export const Intro: React.FC<FamilyDesignProps> = props => {
  const {scene} = props;
  if (scene.family !== 'intro') return null;
  return <DesignScene {...props} tone={0} Body={IntroBody} lens={introLens} />;
};
