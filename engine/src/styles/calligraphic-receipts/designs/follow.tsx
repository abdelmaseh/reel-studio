import React from 'react';
import {Easing, useCurrentFrame} from 'remotion';
import {C, FONT, AXIS, clamp01, ramp, mix, uid, useInkLayout, one, Parchment, Tick, Receipt, dashRow, mono, naskh, PAD} from './kit';

import type {FamilyDesignProps} from '../../family-designs';
import {DesignRoot, sceneCopy, useFonts} from './kit';
import {receiptCopy} from './copy';

export const Follow: React.FC<FamilyDesignProps> = ({scene}) => {
  if (scene.family !== 'follow') return null;
  const d = scene.data;
  const copy = sceneCopy(d), FONT = useFonts(), inkLayout = useInkLayout();
  const tap = 80;
  const f = useCurrentFrame();
  // Beats: 1 the account card prints, 2 the button waits and breathes, 3 tap: ripple and press, the stamp lands on the card, 4 the button flips to its followed state and the tick is drawn.
  const msg = inkLayout(d.message, [{family: FONT.naskh, weight: 700, width: 600, size: 58, min: 46, lines: 1, lh: 1.25}, {family: FONT.naskh, weight: 700, width: 600, size: 52, min: 36, lines: 2, lh: 1.22}]);
  const hs = one(d.handle, {family: FONT.mono, weight: 600, width: 590, size: 150, min: 70});
  const RW = 700, rl = AXIS - RW / 2, rt = 330;
  const H_HEAD = 96, H_DASH = 26, H_MSG = msg.lines.length * msg.box + 44, H_TOTAL = 238, H_STATUS = 120;
  const statusCy = rt + 24 + H_HEAD + H_DASH + H_MSG + H_DASH + H_TOTAL + H_STATUS / 2;
  // stamp
  const s = f - tap, landed = s >= 0;
  const k = Easing.out(Easing.cubic)(clamp01(s / 5)), spread = clamp01(s / 2);
  const SW = 500, SH = 124;
  // button
  const appear = ramp(f, 38, 14), breathe = f > 50 && f < tap ? 1 + 0.018 * Math.sin((f - 50) * 0.45) : 1;
  const press = f >= tap && f < tap + 5 ? 0.94 : 1;
  const followed = f >= tap + 6;
  const BW = 560, BH = 128, bx = AXIS - BW / 2, by = rt + 24 + H_HEAD + H_DASH + H_MSG + H_DASH + H_TOTAL + H_STATUS + 40 + 56;
  const ripple = clamp01((f - tap) / 12);
  return <DesignRoot copy={copy}>
    <Parchment/>
    <Receipt left={rl} top={rt} width={RW} start={6} rot={-1.2} seed={61}
      ghosts={[{dx: 62, dy: 8, rot: 3.2, len: 540, tone: '#F4EAD6'}, {dx: -44, dy: 6, rot: -2.8, len: 580, tone: '#F7EFDF'}]}
      rows={[
        {h: H_HEAD, node: <div style={{height: H_HEAD, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><span style={naskh(56, {letterSpacing: copy.ar ? 0 : 2})}>{receiptCopy(copy, 'accountCard')}</span></div>},
        dashRow(H_DASH),
        {h: H_MSG, node: <div style={{height: H_MSG, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'}}>
          {msg.lines.map((l, i) => <div key={i} style={naskh(msg.size, {lineHeight: `${msg.box}px`, whiteSpace: 'nowrap', color: C.inkSoft})}>{l}</div>)}</div>},
        dashRow(H_DASH),
        {gap: 8, h: H_TOTAL, node: <div style={{height: H_TOTAL, padding: `0 ${PAD}px`, borderTop: `7px double ${C.ink}`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          <div style={naskh(40, {color: C.inkSoft, marginTop: 10})}>{receiptCopy(copy, 'account')}</div>
          <div style={{...mono(hs.fontSize), lineHeight: 1.05, textAlign: 'center'}}>{d.handle}</div></div>},
        {h: H_STATUS, node: <div style={{height: H_STATUS, padding: `0 ${PAD}px`, display: 'flex', alignItems: 'center', direction: copy.dir, gap: 14}}>
          <span style={naskh(42, {color: C.ink, whiteSpace: 'nowrap'})}>{receiptCopy(copy, 'status')}</span>
          <span style={{flex: 1, borderBottom: '3px dotted rgba(46,32,25,0.32)', transform: 'translateY(14px)'}}/></div>},
      ]}/>
    {/* the stamp lands on the status line of the card: same ink, same texture and same density as the seals */}
    {landed ? <div style={{position: 'absolute', left: copy.ar?AXIS-70-SW/2:AXIS+120-SW/2, top: statusCy - SH / 2 + 16, width: SW, height: SH, mixBlendMode: 'multiply',
      transform: `rotate(${-6 + (1 - k) * -6}deg) scale(${mix(1.25, 1, k)})`, opacity: mix(0.3, 0.93, spread), filter: `blur(${(1 - spread) * 3.5}px)`}}>
      <StampPill w={SW} h={SH} text={copy.label('following')} progress={clamp01((f - (tap + 4)) / 10)}/></div> : null}
    {/* the button */}
    <div style={{position: 'absolute', left: bx, top: by + (1 - appear) * 30, width: BW, height: BH, opacity: appear, transform: `scale(${press * breathe})`}}>
      {followed
        ? <div style={{position: 'absolute', inset: 0, borderRadius: BH / 2, border: `5px solid ${C.rust}`, boxSizing: 'border-box', background: 'rgba(255,252,245,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, direction: copy.dir}}>
          <span style={naskh(58, {color: C.rust})}>{copy.label('followPill')}</span>
          <Tick at={tap + 8} size={64} weight={12}/></div>
        : <div style={{position: 'absolute', inset: 0, borderRadius: BH / 2, background: C.rust, boxShadow: '0 14px 22px rgba(120,50,20,0.35), inset 0 2px 0 rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <span style={naskh(62, {color: '#FFF4E6'})}>{copy.label('followPill')}</span></div>}
      {ripple > 0 && ripple < 1 ? <div style={{position: 'absolute', left: BW / 2 - 160 * ripple, top: BH / 2 - 160 * ripple, width: 320 * ripple, height: 320 * ripple, borderRadius: '50%', border: `5px solid ${C.rust}`, opacity: 0.8 * (1 - ripple)}}/> : null}
    </div>
  </DesignRoot>;
};

/** Pill-shaped rust stamp with a double rule and a drawn tick. Ink density matches Seal. */
const StampPill: React.FC<{w: number; h: number; text: string; progress: number}> = ({w, h, text, progress}) => {
  const id = uid();
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{overflow: 'visible'}}>
    <defs><filter id={`p${id}`} x="-5%" y="-10%" width="110%" height="120%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves={2} seed={11} result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -5.2 0 0 0 4.0" result="holes"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves={2} seed={21} result="b"/>
      <feColorMatrix in="b" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.4 0 0 0 2.5" result="blot"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={1} seed={4} result="w"/>
      <feDisplacementMap in="SourceGraphic" in2="w" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feComposite in="d" in2="holes" operator="in" result="d2"/>
      <feComposite in="d2" in2="blot" operator="in"/></filter></defs>
    <g filter={`url(#p${id})`} fill="none" stroke={C.rust}>
      <rect x="5" y="5" width={w - 10} height={h - 10} rx={(h - 10) / 2} strokeWidth="10"/>
      <rect x="20" y="20" width={w - 40} height={h - 40} rx={(h - 40) / 2} strokeWidth="3.4"/>
      <text x={w / 2 + 36} y={h / 2 + 18} textAnchor="middle" fontFamily={FONT.naskh} fontWeight={700} fontSize="54" fill={C.rust} stroke={C.rust} strokeWidth="2">{text}</text>
      <path d={`M${w / 2 - 196} ${h / 2 + 2} L${w / 2 - 170} ${h / 2 + 26} L${w / 2 - 122} ${h / 2 - 24}`} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - progress}/>
    </g></svg>;
};

