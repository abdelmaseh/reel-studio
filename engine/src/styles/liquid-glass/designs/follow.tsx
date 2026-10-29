import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {C, DIM, GLOW, rgba, ramp, fit, RIM_MASK, Glass, Check, DesignScene, X0, CW} from './kit';
// ---- follow ----
const FOLLOW = {x: X0, y: 296, w: CW, h: 850, tap: 80, btnW: 640, btnH: 140, btnTop: 626};
const FollowBody: React.FC<{d: any; n: string}> = ({d}) => {
  const f = useCurrentFrame();
  const {tap, btnW, btnH} = FOLLOW;
  const press = f >= tap && f < tap + 6 ? 0.94 : 1, followed = f >= tap + 4;
  const act = ramp(f, tap + 2, 10);
  const letter = d.handle.replace('@', '').slice(0, 1).toUpperCase();
  const angle = f * 2.4;
  const h = fit(d.handle, d.display, 700, 780, {size: 108, min: 70, lines: 1}, 1.15);
  const m = fit(d.message, d.font, 500, 800, {size: 54, min: 38, lines: 1}, 1.3);
  const A = 310;
  return <Glass x={FOLLOW.x} y={FOLLOW.y} w={FOLLOW.w} h={FOLLOW.h} r={64} at={4} dark={0.55} sweepAt={tap + 2}>
    <div style={{position: 'absolute', [d.copy.opposite]: (FOLLOW.w - A) / 2, top: 50, width: A, height: A}}>
      <div style={{position: 'absolute', inset: -14, borderRadius: '50%', filter: 'blur(22px)', opacity: 0.75, background: `conic-gradient(from ${angle}deg, ${C.cyan}, ${C.violet}, ${C.mint}, ${C.cyan})`}}/>
      <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: `conic-gradient(from ${angle}deg, ${C.cyan}, ${C.violet}, ${C.mint}, ${C.cyan})`}}/>
      <div style={{position: 'absolute', inset: 12, borderRadius: '50%', background: '#0a1126'}}/>
      <div style={{position: 'absolute', inset: 12, borderRadius: '50%', background: 'radial-gradient(circle at 34% 26%, rgba(255,255,255,0.3), rgba(255,255,255,0.04) 55%, rgba(255,255,255,0.1))',
        boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: d.display, fontWeight: 700, fontSize: 160, color: '#fff', direction: 'ltr',
        textShadow: GLOW}}>{letter}</div>
    </div>
    <div style={{position: 'absolute', top: 384, [d.copy.opposite]: 0, width: FOLLOW.w, textAlign: 'center', fontFamily: d.display, fontWeight: 700, fontSize: h.size, lineHeight: 1.15, color: '#fff', direction: 'ltr',
      textShadow: GLOW, opacity: ramp(f, 14, 16), transform: `translateY(${(1 - ramp(f, 14, 20)) * 24}px)`}}>{d.handle}</div>
    <div style={{position: 'absolute', top: 384 + h.size * 1.15 + 12, [d.copy.opposite]: 0, width: FOLLOW.w, textAlign: 'center', fontFamily: d.font, fontWeight: 500, fontSize: m.size, lineHeight: 1.3, color: DIM, direction: d.copy.dir,
      opacity: ramp(f, 22, 16)}}>{d.message}</div>
    <div style={{position: 'absolute', [d.copy.opposite]: (FOLLOW.w - btnW) / 2, top: FOLLOW.btnTop, width: btnW, height: btnH, borderRadius: btnH / 2, transform: `scale(${press})`,
      boxShadow: `0 0 ${70 * act}px ${rgba(C.cyan, 0.5 * act)}, 0 24px 50px rgba(0,0,0,0.35)`}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: btnH / 2, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', background: 'linear-gradient(160deg, rgba(255,255,255,0.2), rgba(255,255,255,0.08))'}}/>
      <div style={{position: 'absolute', inset: 0, borderRadius: btnH / 2, opacity: act, background: `linear-gradient(135deg, #b4f3ff, ${C.cyan} 50%, #3fc6ee)`}}/>
      <div style={{position: 'absolute', inset: 0, borderRadius: btnH / 2, padding: 2, boxSizing: 'border-box', ...RIM_MASK, background: 'linear-gradient(135deg, rgba(255,255,255,0.8), rgba(255,255,255,0.18) 60%, rgba(255,255,255,0.4))'}}/>
      <div style={{position: 'absolute', [d.copy.side]: 28, top: (btnH - 94) / 2, width: 94, height: 94, borderRadius: 47, background: followed ? C.ink : 'rgba(255,255,255,0.12)',
        boxShadow: followed ? `0 0 24px ${rgba(C.ink, 0.5)}` : 'inset 0 0 0 2.5px rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        {followed ? <Check p={ramp(f, tap + 4, 10)} size={66} color={C.cyan} width={12}/> : <svg width="44" height="44" viewBox="0 0 100 100"><path d="M50 16 V84 M16 50 H84" stroke="#fff" strokeWidth="11" strokeLinecap="round"/></svg>}
      </div>
      <div style={{position: 'absolute', [d.copy.opposite]: 0, [d.copy.side]: 100, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: d.copy.dir}}>
        <span style={{fontFamily: d.font, fontWeight:headlineWeight(d.font,'Grid Sans',700), fontSize: 56, color: followed ? C.ink : '#fff', whiteSpace: 'nowrap'}}>{d.copy.label(followed ? 'following' : 'followPill')}</span>
      </div>
    </div>
  </Glass>;
};


export const Follow: React.FC<FamilyDesignProps> = props => {
  const {scene} = props;
  if (scene.family !== 'follow') return null;
  return <DesignScene {...props} tone={3} Body={FollowBody} />;
};
