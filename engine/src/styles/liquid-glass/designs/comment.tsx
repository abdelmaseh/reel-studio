import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import React from 'react';
import {Easing, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {C, GLOW, rgba, ramp, widthOf, fit, RIM_MASK, Glass, Chip, Headline, DesignScene, X0, X1, CW} from './kit';
// ---- comment ----
const CommentBody: React.FC<{d: any; n: string}> = ({d}) => {
  const f = useCurrentFrame();
  const word = ramp(f, 30, 20);                                  // the whole word fades and rises in one move
  const caretOn = f < 52 ? 0 : (Math.floor((f - 52) / 14) % 2 === 0 ? 1 : 0.15);
  const kw = fit(d.keyword, d.font, 700, 640, {size: 200, min: 90, lines: 1}, 1.2);
  const kwW = widthOf(d.keyword, d.font, kw.size, 700);
  const fx = X0, fy = 640, fw = CW, fh = 380;
  const pr = fit(d.promise, d.font, 600, 587, {size: 56, min: 38, lines: 1}, 1.3);
  const fill = ramp(f, 70, 22, Easing.inOut(Easing.cubic));      // the send button fills with light after the sweep has crossed
  const S = 176;
  return <>
    <Headline text={d.copy.label('templateLine')} top={292} opts={[{size: 116, min: 76, lines: 2}]} at={2}/>
    <Glass x={fx} y={fy} w={fw} h={fh} r={68} at={10} dark={0.75} thick active={0.7} sweepAt={58}>
      <div style={{position: 'absolute', [d.copy.side]: 76, top: 0, bottom: 0, display: 'flex', alignItems: 'center', direction: d.copy.dir}}>
        <div style={{fontFamily: d.font, fontWeight:headlineWeight(d.font,'Grid Sans',700), fontSize: kw.size, lineHeight: 1.3, color: '#fff', whiteSpace: 'nowrap', textShadow: GLOW,
          opacity: word, transform: `translateY(${(1 - word) * 46}px)`, filter: word < 0.95 ? `blur(${(1 - word) * 14}px)` : undefined}}>{d.keyword}</div>
      </div>
      <div style={{position: 'absolute', top: fh / 2 - 88, width: 8, height: 176, borderRadius: 4, background: C.cyan, boxShadow: `0 0 24px ${rgba(C.cyan, 0.95)}`, opacity: caretOn * ramp(f, 50, 4), [d.copy.side]: 76 + kwW + 26}}/>
      <div style={{position: 'absolute', [d.copy.opposite]: 64, top: (fh - S) / 2, width: S, height: S, borderRadius: S / 2, boxShadow: `0 0 ${80 * fill}px ${rgba(C.cyan, 0.55 * fill)}, 0 24px 50px rgba(0,0,0,0.35)`}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: '50%', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', background: 'linear-gradient(160deg, rgba(255,255,255,0.22), rgba(255,255,255,0.07))'}}/>
        <div style={{position: 'absolute', inset: 0, borderRadius: '50%', transform: `scale(${fill})`, opacity: fill > 0 ? 1 : 0, background: `radial-gradient(circle at 36% 28%, #fff 0%, ${C.cyan} 46%, #1f9fc4 100%)`}}/>
        <div style={{position: 'absolute', inset: 0, borderRadius: '50%', padding: 2, boxSizing: 'border-box', ...RIM_MASK, background: 'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(255,255,255,0.2) 60%, rgba(255,255,255,0.45))'}}/>
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <svg width="84" height="84" viewBox="0 0 100 100" style={d.copy.ar ? undefined : {transform:'scaleX(-1)'}}><path d="M82 50 L22 50 M48 24 L20 50 L48 76" fill="none" stroke={fill > 0.55 ? C.ink : '#fff'} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>
    </Glass>
    <Chip text={d.copy.label('commentBadge')} y={fy - 38} at={14} right={X1 - 48} size={32}/>
    <Glass x={X0} y={fy + fh + 54} w={CW} h={190} r={52} at={34} dark={0.6} lite>
      <div style={{position: 'absolute', left:0, top:0, bottom:0, width:787, boxSizing:'border-box', display: 'flex', alignItems: 'center', gap: 26, padding: '0 50px', direction: d.copy.dir}}>
        <svg width="64" height="64" viewBox="0 0 100 100" style={{flex: 'none'}}><path d="M16 22 H84 V66 H46 L26 84 V66 H16 Z" fill={rgba(C.cyan, 0.18)} stroke={C.cyan} strokeWidth="6" strokeLinejoin="round" style={{filter: `drop-shadow(0 0 8px ${rgba(C.cyan, 0.7)})`}}/></svg>
        <div style={{fontFamily: d.font, fontWeight: 600, fontSize: pr.size, color: '#fff', whiteSpace: 'nowrap', textShadow: GLOW, opacity: ramp(f, 40, 16)}}>{d.promise}</div>
      </div>
    </Glass>
  </>;
};


export const Comment: React.FC<FamilyDesignProps> = props => {
  const {scene} = props;
  if (scene.family !== 'comment') return null;
  return <DesignScene {...props} tone={2} Body={CommentBody} />;
};
