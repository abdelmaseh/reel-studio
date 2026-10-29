// liquid-glass «figures»: a number becomes a glass instrument.
// counter: orb behind a rolling number on one big panel. slot: one tall capsule per digit. bars: glass tubes of liquid (two) or capsules of liquid (3 to 6).
// ring: a thick glass torus filled by a cyan-to-mint liquid arc.
import React from 'react';
import {Easing, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useDesignText} from '../../../style-kit/digits';
import {SceneStickerSlot} from '../../../creative-kit/sticker-view';
import {figuresAnimationFrames, slotDigitStrings, slotPosition} from '../../../creative-kit/figures/timing';
import type {FiguresData} from '../../../creative-kit/figures/schema';
import type {FamilyDesignProps} from '../../family-designs';
import {C, DISPLAY, GLOW, MONO, W, X0, X1, CW, RIM_MASK, clamp01, ramp, rgba, widthOf, fit, Glass, Headline, Orb, DesignScene, type BodyProps} from './kit';
import {ZONE, Settled, TITLE_OPTS, titleBox, titleHeight, decimalsOf, plain, numberFont, digitEm, fitNumber, enter, Pill, UnitChip, unitChipHeight, type GlassScope} from './family-parts';

type Of<V extends FiguresData['variant']> = Extract<FiguresData, {variant: V}> & GlassScope;
type FiguresD = FiguresData & GlassScope;
const ROLL = Easing.bezier(0.2, 0.8, 0.2, 1);
const mirrorX = (copy: GlassScope['copy'], x: number, w: number) => copy.ar ? x : W - x - w; // for parts that must not mirror in an LTR scene

// ---------- counter ----------
const Rail: React.FC<{w: number; p: number; at: number}> = ({w, p, at}) => {
  const f = useCurrentFrame();
  const h = 22, front = w * p;
  return <div style={{position: 'relative', width: w, height: 46, ...enter(f, at, {rise: 18, blur: 8})}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: h / 2, background: 'rgba(5,9,22,0.5)',
      boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.5), 0 0 0 1.5px rgba(255,255,255,0.22)'}}/>
    <div style={{position: 'absolute', left: 4, top: 4, width: Math.max(0, front - 8), height: h - 8, borderRadius: (h - 8) / 2,
      background: `linear-gradient(90deg, ${C.teal}, ${C.cyan} 65%, ${C.mint})`, boxShadow: `0 0 26px ${rgba(C.cyan, 0.75)}`}}/>
    <div style={{position: 'absolute', left: 8, top: 7, width: Math.max(0, front - 16), height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.5)', opacity: p > 0 ? 1 : 0}}/>
    {Array.from({length: 41}, (_, i) => {
      const major = i % 5 === 0, lit = i / 40 <= p + 0.001;
      return <div key={i} style={{position: 'absolute', left: i / 40 * w - 1.5, top: 30, width: 3, height: major ? 16 : 9, borderRadius: 2,
        background: lit ? C.cyan : 'rgba(255,255,255,0.28)', boxShadow: lit && major ? `0 0 12px ${rgba(C.cyan, 0.7)}` : undefined}}/>;
    })}
  </div>;
};

const CounterView: React.FC<{d: Of<'counter'>; top: number}> = ({d, top}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const shown = useDesignText();
  const T = figuresAnimationFrames(d, fps);
  const from = d.from ?? 0, dec = Math.max(decimalsOf(d.value), decimalsOf(from));
  const roll = ramp(f, 4, T - 4, ROLL);
  const text = shown(plain(from + (d.value - from) * roll, dec));
  const finalText = shown(plain(d.value, dec)), startText = shown(plain(from, dec));
  const panelH = ZONE.bottom - top;
  const chipH = d.unit ? unitChipHeight(d.unit, d.font, 640, 48) : 0, chipBlock = d.unit ? 18 + chipH : 0;
  const railBlock = 86, family = DISPLAY;
  // The sphere fills the panel above the rail; the digits (about 0.71 of the font size tall) and the unit chip sit together inside it.
  const orbD = Math.min(CW * 0.8, panelH - railBlock - 36), orbTop = 18;
  const size = Math.min(fitNumber(finalText, family, 860, 400, 90).fontSize, fitNumber(startText, family, 860, 400, 90).fontSize, (orbD - 26 - chipBlock) / 0.71);
  const glyphTop = orbTop + (orbD - (0.71 * size + chipBlock)) / 2, numTop = glyphTop - 0.13 * size;
  // A number wider than the sphere sits on an elliptical halo as wide as the number, so the glass always reads as light behind it.
  const orbW = Math.min(CW - 60, Math.max(orbD, Math.max(widthOf(finalText, family, size, 700), widthOf(startText, family, size, 700)) * 1.12));
  const punch = 1 + 0.045 * Math.max(0, 1 - Math.abs(f - T) / 8) * (f >= T ? 1 : 0);
  return <Glass x={X0} y={top} w={CW} h={panelH} r={64} at={2} dark={0.8} sweepAt={T + 2}>
    <div style={{position: 'absolute', left: 0, top: 0, width: CW, height: panelH, transform: `scaleY(${orbD / orbW})`, transformOrigin: `${CW / 2}px ${orbTop + orbD / 2}px`}}>
      <Orb x={CW / 2} y={orbTop + orbD / 2} d={orbW} at={6}/>
    </div>
    <Orb x={92} y={96} d={70} at={14}/>
    <Orb x={CW - 100} y={panelH - railBlock - 70} d={104} at={18}/>
    <div style={{position: 'absolute', top: numTop, left: 0, width: CW, height: size, display: 'flex', justifyContent: 'center', alignItems: 'center', direction: 'ltr',
      transform: `scale(${punch})`, transformOrigin: '50% 55%', ...enter(f, 4, {rise: 30, blur: 18})}}>
      <span data-count-progress={roll} style={{fontFamily: family, fontWeight: 700, fontSize: size, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: -size * 0.015, whiteSpace: 'nowrap',
        textShadow: `0 0 ${size * 0.16}px ${rgba(C.cyan, 0.4)}, 0 6px 30px rgba(5,9,22,0.5)`}}>{text}</span>
    </div>
    {d.unit ? <div style={{position: 'absolute', top: glyphTop + 0.71 * size + 18, left: 0, width: CW, display: 'flex', justifyContent: 'center'}}><UnitChip text={d.unit} font={d.font} at={16} max={640} size={48}/></div> : null}
    <div style={{position: 'absolute', bottom: 32, left: (CW - 790) / 2}}><Rail w={790} p={roll} at={10}/></div>
  </Glass>;
};

// ---------- slot ----------
const SlotView: React.FC<{d: Of<'slot'>; top: number}> = ({d, top}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const shown = useDesignText();
  const {to, from} = slotDigitStrings(d.value, d.from);
  const n = to.length, gap = n <= 4 ? 30 : n <= 6 ? 20 : 12;
  const cw = Math.floor(Math.min(300, (CW - gap * (n - 1)) / n));
  const size = Math.floor(Math.min(430, (cw - 26) / digitEm(shown, DISPLAY)));
  const chipH = d.unit ? unitChipHeight(d.unit, d.font, 760, 50) : 0, chipBlock = d.unit ? 34 + chipH : 0;
  const availH = ZONE.bottom - top;
  const ch = Math.min(availH - chipBlock, Math.round(size * (n > 6 ? 4.2 : 2.7)));
  const y0 = top + (availH - (ch + chipBlock)) / 2;
  const rowW = n * cw + gap * (n - 1), x0 = (W - rowW) / 2;
  const cell = Math.round(ch * 0.46);
  return <>
    <div aria-label={shown(String(d.value))} style={{display: 'contents'}}>
    <svg width="0" height="0" style={{position: 'absolute'}}>
      {to.split('').map((_, i) => {
        const index = i, stop = Math.round((1.05 + (n - 1 - index) * 0.07) * fps);
        const speed = Math.abs(slotPosition(f, index, n, Number(to[index]), Number(from[index]), fps) - slotPosition(f - 1, index, n, Number(to[index]), Number(from[index]), fps));
        const blur = f >= stop ? 0 : Math.min(26, speed * cell * 0.085);
        return <filter key={i} id={`lg-slot-blur-${i}`} x="-20%" y="-80%" width="140%" height="260%"><feGaussianBlur stdDeviation={`0 ${blur.toFixed(2)}`}/></filter>;
      })}
    </svg>
    {to.split('').map((digit, i) => {
      const stop = Math.round((1.05 + (n - 1 - i) * 0.07) * fps);
      const pos = slotPosition(f, i, n, Number(digit), Number(from[i]), fps);
      const lit = ramp(f, stop, 8), blurOn = f < stop && f > 0;
      const x = x0 + i * (cw + gap);
      const centre = Math.floor(pos);
      return <Glass key={i} x={mirrorX(d.copy, x, cw)} y={y0} w={cw} h={ch} r={cw / 2} at={1 + (n - 1 - i) * 2} dark={0.55} thick active={lit} sweepAt={stop} blurIn={14}>
        <div style={{position: 'absolute', inset: 0, borderRadius: cw / 2, opacity: lit * 0.9,
          background: `radial-gradient(80% 42% at 50% 50%, ${rgba(C.cyan, 0.55)}, ${rgba(C.cyan, 0)})`, boxShadow: `inset 0 0 60px ${rgba(C.cyan, 0.28)}`}}/>
        <div style={{position: 'absolute', left: 12, right: 12, top: 28, bottom: 28, overflow: 'hidden', direction: 'ltr',
          WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 24%, #000 76%, transparent 100%)', maskImage: 'linear-gradient(180deg, transparent 0%, #000 24%, #000 76%, transparent 100%)'}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, filter: blurOn ? `url(#lg-slot-blur-${i})` : undefined}}>
            {Array.from({length: 6}, (_, k) => centre - 2 + k).filter(k => k >= 0).map(k =>
              <div key={k} style={{position: 'absolute', left: 0, right: 0, height: cell, top: (ch - 56) / 2 + (k - pos) * cell - cell / 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: Math.abs(k - pos) < 0.5 ? 1 : 1 - lit, fontFamily: DISPLAY, fontWeight: 700, fontSize: size, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums',
                textShadow: `0 0 ${size * 0.2}px ${rgba(C.cyan, 0.2 + 0.4 * lit)}, 0 6px 26px rgba(5,9,22,0.5)`}}>{shown(String(k % 10))}</div>)}
          </div>
        </div>
      </Glass>;
    })}
    </div>
    {d.unit ? <div style={{position: 'absolute', left: 0, width: W, top: y0 + ch + 34, display: 'flex', justifyContent: 'center'}}><UnitChip text={d.unit} font={d.font} at={20} max={760}/></div> : null}
  </>;
};

// ---------- bars ----------
const tone = (hi: boolean) => hi ? {deep: '#0A7F66', mid: '#33CF98', bright: C.mint, glow: C.mint} : {deep: '#0A62B5', mid: '#25B8EE', bright: C.cyan, glow: C.cyan};
const levelSpring = (f: number, at: number, fps: number) => spring({frame: f - at, fps, config: {damping: 10, stiffness: 60, mass: 0.9}});
/** The surface ripple: large after the liquid lands and settling to a faint idle ripple. */
const rippleAmp = (f: number, landed: number, base: number) => base * (0.25 + 1.6 * Math.exp(-Math.max(0, f - landed) / 20)) * (f > landed - 14 ? 1 : 0.4);

const barStart = (i: number, fps: number) => 2 + Math.round(i * 0.12 * fps);

const Tubes: React.FC<{d: Of<'bars'>; top: number}> = ({d, top}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const shown = useDesignText();
  const values = d.bars.map(b => b.value), n = values.length;
  const max = d.max ?? Math.max(1, ...values), hi = Math.max(...values);
  const dec = Math.max(0, ...values.map(decimalsOf));
  const tubeW = n === 1 ? 470 : 400, gapX = CW - n * tubeW, pad = 18, r = Math.round(tubeW * 0.44);
  const labels = d.bars.map(b => fit(b.label, d.font, 700, tubeW, {size: 76, min: 44, lines: 2}, 1.2));
  const labelH = Math.max(...labels.map(l => l.lines.length * l.box));
  const ty = top + labelH + 22, th = ZONE.bottom - ty, ih = th - 2 * pad, iw = tubeW - 2 * pad;
  const xs = values.map((_, i) => n === 1 ? (W - tubeW) / 2 : X1 - (i + 1) * tubeW - i * (gapX));
  return <>
    {n === 2 ? <div style={{position: 'absolute', left: X0 + tubeW + 0, width: gapX, top: ty + pad, height: ih, ...enter(f, 12, {rise: 0, blur: 6})}}>
      {Array.from({length: 21}, (_, i) => { const major = i % 5 === 0;
        return <div key={i} style={{position: 'absolute', left: gapX / 2 - (major ? 34 : 18), width: major ? 68 : 36, top: ih * (1 - i / 20) - 1, height: 2, borderRadius: 1, background: major ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.28)'}}/>; })}
    </div> : null}
    {values.map((value, i) => {
      const isHi = value === hi, col = tone(isHi), at = barStart(i, fps);
      const x = xs[i], lv = Math.min(1, levelSpring(f, at + 4, fps)) * (value / max);
      const p = ramp(f, at + 4, 26), cur = value * p;
      const surface = ih * (1 - lv);
      const amp = rippleAmp(f, at + 30, 11), ph = f * 0.16 + i * 2;
      const wave = Array.from({length: 33}, (_, k) => `${k ? 'L' : 'M'}${(k / 32 * iw).toFixed(1)} ${(surface + Math.sin(ph + k * 0.5) * amp + Math.sin(ph * 0.6 + k * 1.1) * amp * 0.4).toFixed(1)}`).join(' ');
      const numberText = shown(plain(cur, dec));
      const num = fitNumber(shown(plain(value, dec)), DISPLAY, iw - 130, 130, 60);
      const buoyH = Math.round(num.fontSize * 1.3), buoyW = Math.ceil(num.width) + 76;
      const buoyY = Math.max(12, Math.min(ih - buoyH - 14, surface - buoyH * 0.62 + Math.sin(f * 0.07 + i * 2) * 4));
      const id = `lg-tube-${i}`;
      const label = labels[i];
      return <React.Fragment key={i}>
        <div style={{position: 'absolute', left: mirrorX(d.copy, x, tubeW), top: ty, width: tubeW, height: th, borderRadius: r,
          boxShadow: `0 0 ${110 * ramp(f, at + 10, 24)}px ${rgba(col.glow, 0.28)}`}}/>
        <div style={{position: 'absolute', left: mirrorX(d.copy, x, tubeW), top: top, width: tubeW, height: labelH, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', ...enter(f, at, {rise: 28})}}>
          {label.lines.map((line, k) => <div key={k} style={{height: label.box, lineHeight: `${label.box}px`, fontFamily: d.font, fontWeight: 700, fontSize: label.size, color: '#fff', whiteSpace: 'nowrap', direction: d.copy.dir,
            textShadow: isHi ? `0 0 36px ${rgba(C.mint, 0.5)}, 0 4px 24px rgba(5,9,22,0.45)` : GLOW}}>{line}</div>)}
        </div>
        <Glass x={x} y={ty} w={tubeW} h={th} r={r} at={at} dark={0.5} thick sweepAt={at + 30} blurIn={14}>
          <div style={{position: 'absolute', left: pad, top: pad, width: iw, height: ih, borderRadius: r - pad, overflow: 'hidden', background: 'rgba(5,9,22,0.42)', boxShadow: 'inset 0 6px 18px rgba(0,0,0,0.5)'}}>
            <svg width={iw} height={ih} style={{position: 'absolute', inset: 0}}>
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={col.bright}/><stop offset="0.4" stopColor={col.mid}/><stop offset="1" stopColor={col.deep}/></linearGradient>
                <linearGradient id={`${id}-glow`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.4"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient>
                <radialGradient id={`${id}-bloom`} cx="50%" cy="100%" r="70%"><stop offset="0" stopColor={col.bright} stopOpacity="0.55"/><stop offset="1" stopColor={col.bright} stopOpacity="0"/></radialGradient>
                <clipPath id={`${id}-clip`}><path d={`${wave} L${iw} ${ih} L0 ${ih} Z`}/></clipPath>
              </defs>
              <path d={`${wave} L${iw} ${ih} L0 ${ih} Z`} fill={`url(#${id})`}/>
              <g clipPath={`url(#${id}-clip)`}>
                <rect x="0" y={surface - 6} width={iw} height="130" fill={`url(#${id}-glow)`}/>
                <rect x="0" y={Math.max(0, surface)} width={iw} height={ih} fill={`url(#${id}-bloom)`}/>
              </g>
              <path d={wave} fill="none" stroke="#fff" strokeOpacity="0.9" strokeWidth="4" style={{filter: `drop-shadow(0 0 10px ${rgba(col.bright, 0.95)})`}}/>
              {Array.from({length: 7}, (_, k) => {
                const bx = iw * (0.14 + 0.72 * ((Math.sin(k * 12.9 + i) * 0.5 + 0.5))), rise = ((f * (0.9 + k * 0.23) + k * 61) % Math.max(60, ih - surface)), by = ih - 16 - rise;
                return by > surface + 12 ? <circle key={k} cx={bx} cy={by} r={4 + (k % 3) * 2.5} fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/> : null;
              })}
              <rect x={iw * 0.12} y="26" width="22" height={Math.max(0, ih - 52)} rx="11" fill="rgba(255,255,255,0.14)"/>
            </svg>
            <div style={{position: 'absolute', left: (iw - buoyW) / 2, top: buoyY, ...enter(f, at + 6, {rise: 0, blur: 10})}}>
              <Pill w={buoyW} h={buoyH} at={at + 6} active={0.6}>
                <span data-count-progress={p} style={{fontFamily: DISPLAY, fontWeight: 700, fontSize: num.fontSize, lineHeight: 1, color: '#fff', direction: 'ltr', fontVariantNumeric: 'tabular-nums',
                  textShadow: `0 0 28px ${rgba(col.bright, 0.7)}`}}>{numberText}</span>
              </Pill>
            </div>
          </div>
          {isHi ? <div style={{position: 'absolute', inset: 0, borderRadius: r, padding: 3, boxSizing: 'border-box', opacity: ramp(f, at + 14, 12), ...RIM_MASK,
            background: `linear-gradient(135deg, ${C.mint}, ${rgba(C.mint, 0.3)} 60%, ${rgba(C.cyan, 0.6)})`}}/> : null}
        </Glass>
      </React.Fragment>;
    })}
    {d.unit ? <div style={{position: 'absolute', left: 0, width: W, top: ZONE.bottom + 18, display: 'flex', justifyContent: 'center'}}><UnitChip text={d.unit} font={d.font} at={22} max={600} size={46}/></div> : null}
  </>;
};

const Rows: React.FC<{d: Of<'bars'>; top: number}> = ({d, top}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const shown = useDesignText();
  const values = d.bars.map(b => b.value), n = values.length;
  const max = d.max ?? Math.max(1, ...values), hi = Math.max(...values);
  const dec = Math.max(0, ...values.map(decimalsOf));
  const availH = ZONE.bottom - top, gap = n <= 4 ? 24 : 18;
  const rh = Math.min(200, Math.floor((availH - gap * (n - 1)) / n));
  const stackH = n * rh + gap * (n - 1), y0 = top + (availH - stackH) / 2;
  const pad = Math.max(10, Math.round(rh * 0.12)), trackH = rh - 2 * pad;
  const vSize = Math.round(Math.max(40, Math.min(80, rh * 0.5)));
  const vTexts = values.map(v => shown(plain(v, dec)));
  const vFamily = numberFont(vTexts.join(''));
  const vcw = Math.max(150, Math.ceil(Math.max(...vTexts.map(t => fitNumber(t, vFamily, 400, vSize, 30, vFamily === MONO ? 600 : 700).width))) + 64);
  const trackW = CW - 2 * pad - vcw - 12;
  return <>
    {d.bars.map((bar, i) => {
      const value = bar.value, isHi = value === hi, col = tone(isHi), at = barStart(i, fps);
      const y = y0 + i * (rh + gap);
      const lv = Math.min(1, levelSpring(f, at + 4, fps)) * (value / max);
      const fillW = trackW * lv, p = ramp(f, at + 4, 26);
      const amp = rippleAmp(f, at + 26, 7), ph = f * 0.18 + i * 2;
      const front = Array.from({length: 41}, (_, k) => `L${(fillW + Math.sin(ph + k * 0.32) * amp).toFixed(1)} ${(k / 40 * trackH).toFixed(1)}`).join(' ');
      const label = fit(bar.label, d.font, 700, trackW * 0.62, {size: Math.round(Math.min(72, rh * 0.46)), min: 32, lines: 1}, 1.2);
      const id = `lg-row-${i}`;
      return <Glass key={i} x={X0} y={y} w={CW} h={rh} r={rh / 2} at={at} dark={0.6} sweepAt={at + 30} blurIn={14}>
        {isHi ? <div style={{position: 'absolute', inset: -2, borderRadius: rh / 2 + 2, boxShadow: `0 0 ${60 * ramp(f, at + 12, 20)}px ${rgba(C.mint, 0.42)}`}}/> : null}
        <div style={{position: 'absolute', [d.copy.side]: pad, top: pad, width: trackW, height: trackH, borderRadius: trackH / 2, overflow: 'hidden', background: 'rgba(5,9,22,0.5)', boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.5)'}}>
          <svg width={trackW} height={trackH} style={{position: 'absolute', inset: 0, transform: d.copy.ar ? 'scaleX(-1)' : undefined}}>
            <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={col.deep}/><stop offset="0.5" stopColor={col.mid}/><stop offset="1" stopColor={col.bright}/></linearGradient></defs>
            {fillW > 1 ? <>
              <path d={`M0 0 ${front} L0 ${trackH} Z`} fill={`url(#${id})`}/>
              <path d={`M0 0 ${front} L0 ${trackH} Z`} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
              <rect x="0" y={trackH * 0.14} width={Math.max(0, fillW - 8)} height={trackH * 0.16} rx={trackH * 0.08} fill="rgba(255,255,255,0.2)"/>
              <path d={`M${fillW + Math.sin(ph) * amp} 0 ${front}`} fill="none" stroke="#fff" strokeOpacity="0.9" strokeWidth="4" style={{filter: `drop-shadow(0 0 10px ${rgba(col.bright, 0.95)})`}}/>
            </> : null}
          </svg>
          <div style={{position: 'absolute', [d.copy.side]: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', paddingInline: Math.round(trackH * 0.4), direction: d.copy.dir, ...enter(f, at + 2, {rise: 0, blur: 10})}}>
            <span style={{fontFamily: d.font, fontWeight: 700, fontSize: label.size, color: '#fff', whiteSpace: 'nowrap', textShadow: '0 2px 12px rgba(5,9,22,0.7), 0 0 30px rgba(5,9,22,0.35)'}}>{label.lines[0]}</span>
          </div>
        </div>
        <div style={{position: 'absolute', [d.copy.opposite]: pad, top: pad, width: vcw, height: trackH, borderRadius: trackH / 2, background: 'rgba(5,9,22,0.5)', boxShadow: `inset 0 0 0 1.5px ${rgba(col.bright, 0.55)}, 0 0 28px ${rgba(col.bright, 0.22)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'ltr', opacity: ramp(f, at + 2, 12)}}>
          <span data-count-progress={p} style={{fontFamily: vFamily, fontWeight: vFamily === MONO ? 600 : 700, fontSize: vSize, color: col.bright, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 26px ${rgba(col.bright, 0.6)}`}}>{shown(plain(value * p, dec))}</span>
        </div>
      </Glass>;
    })}
    {d.unit ? <div style={{position: 'absolute', left: 0, width: W, top: ZONE.bottom + 18, display: 'flex', justifyContent: 'center'}}><UnitChip text={d.unit} font={d.font} at={22} max={600} size={46}/></div> : null}
  </>;
};

// ---------- ring ----------
const RingView: React.FC<{d: Of<'ring'>; top: number}> = ({d, top}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const shown = useDesignText();
  const T = figuresAnimationFrames(d, fps);
  const dec = decimalsOf(d.value), maxDec = decimalsOf(d.max);
  const p = ramp(f, 4, T - 4, ROLL);
  const frac = Math.min(1, (d.value / d.max) * p);
  const D = Math.min(CW - 40, 1200 - top, 740), R = D / 2, t = Math.round(D * 0.17);
  const cy = top + (ZONE.bottom + 40 - top) / 2, cx = W / 2;
  const mid = R - t / 2, groove = t * 0.64;
  const innerR = R - t, innerW = innerR * 2;
  const valueText = shown(plain(d.value * p, dec)), finalText = shown(plain(d.value, dec));
  const numSize = fitNumber(finalText, DISPLAY, innerW * 0.72, 230, 90).fontSize;
  const maxText = shown(plain(d.max, maxDec)), maxFont = numberFont(maxText);
  const unitFit = d.unit ? fit(d.unit, d.font, 500, innerW * 0.66, {size: 44, min: 28, lines: 1}, 1.2) : null;
  const ang = -Math.PI / 2 + frac * 2 * Math.PI;
  const bulb = {x: R + Math.cos(ang) * mid, y: R + Math.sin(ang) * mid};
  const mask = `radial-gradient(closest-side, transparent ${(innerR / R) * 100 - 0.2}%, #000 ${(innerR / R) * 100 + 0.2}%)`;
  const e = ramp(f, 2, 24);
  const arc = (a0: number, a1: number, rad: number) => { const p0 = [R + Math.cos(a0) * rad, R + Math.sin(a0) * rad], p1 = [R + Math.cos(a1) * rad, R + Math.sin(a1) * rad]; return `M${p0[0]} ${p0[1]} A${rad} ${rad} 0 0 1 ${p1[0]} ${p1[1]}`; };
  const sweep = clamp01((f - (T + 2)) / 26);
  return <div style={{position: 'absolute', left: cx - R, top: cy - R, width: D, height: D, ...enter(f, 2, {rise: 40, blur: 18})}}>
    <div style={{position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: `0 40px 90px rgba(0,0,0,0.45), 0 0 ${90 * e}px ${rgba(C.cyan, 0.16)}`}}/>
    <div style={{position: 'absolute', inset: 0, borderRadius: '50%', backdropFilter: 'blur(26px) saturate(140%)', WebkitBackdropFilter: 'blur(26px) saturate(140%)',
      WebkitMaskImage: mask, maskImage: mask, background: 'linear-gradient(160deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05) 55%, rgba(255,255,255,0.1))'}}/>
    <Orb x={R} y={R} d={innerW * 0.94} at={8}/>
    <svg width={D} height={D} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <defs>
        <linearGradient id="lg-ring-liquid" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor={C.cyan}/><stop offset="1" stopColor={C.mint}/></linearGradient>
        <linearGradient id="lg-ring-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.75"/><stop offset="0.6" stopColor="#fff" stopOpacity="0.08"/><stop offset="1" stopColor="#fff" stopOpacity="0.3"/></linearGradient>
        <linearGradient id="lg-ring-rim-in" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0.6"/><stop offset="0.6" stopColor="#fff" stopOpacity="0.06"/><stop offset="1" stopColor="#fff" stopOpacity="0.25"/></linearGradient>
        <clipPath id="lg-ring-sweep"><circle cx={R} cy={R} r={mid + groove / 2 + 6}/></clipPath>
      </defs>
      <circle cx={R} cy={R} r={R - 1} fill="none" stroke="url(#lg-ring-rim)" strokeWidth="3"/>
      <circle cx={R} cy={R} r={innerR + 1} fill="none" stroke="url(#lg-ring-rim-in)" strokeWidth="3"/>
      <path d={arc(Math.PI * 1.12, Math.PI * 1.62, R - t * 0.2)} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={t * 0.1} strokeLinecap="round" opacity="0.8"/>
      <circle cx={R} cy={R} r={mid} fill="none" stroke="rgba(5,9,22,0.55)" strokeWidth={groove}/>
      <circle cx={R} cy={R} r={mid} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={groove} strokeDasharray="1 0" opacity="0.5" style={{mixBlendMode: 'overlay'}}/>
      <circle cx={R} cy={R} r={mid} fill="none" stroke="url(#lg-ring-liquid)" strokeWidth={groove * 0.84} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.max(0.0005, frac)}
        transform={`rotate(-90 ${R} ${R})`} style={{filter: `drop-shadow(0 0 ${t * 0.2}px ${rgba(C.cyan, 0.85)})`}}/>
      <circle cx={R} cy={R} r={mid + groove * 0.2} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={groove * 0.12} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.max(0.0005, frac)}
        transform={`rotate(-90 ${R} ${R})`}/>
      {frac > 0.004 ? <g style={{filter: `drop-shadow(0 0 ${t * 0.22}px ${rgba(C.mint, 0.9)})`}}>
        <circle cx={bulb.x} cy={bulb.y} r={groove * 0.5} fill="rgba(255,255,255,0.92)"/>
        <circle cx={bulb.x} cy={bulb.y} r={groove * 0.34} fill={C.mint}/>
      </g> : null}
      {sweep > 0 && sweep < 1 ? <g clipPath="url(#lg-ring-sweep)"><rect x={R - D * 0.7 + sweep * D * 1.4} y="0" width={D * 0.16} height={D} fill="rgba(210,250,255,0.4)" transform={`skewX(-20)`} opacity={Math.sin(Math.PI * sweep)}/></g> : null}
    </svg>
    <div style={{position: 'absolute', left: 0, top: 0, width: D, height: D, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: Math.round(numSize * 0.04), direction: 'ltr',
      ...enter(f, 6, {rise: 24, blur: 16})}}>
      <span data-count-progress={p} style={{fontFamily: DISPLAY, fontWeight: 700, fontSize: numSize, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: -numSize * 0.015,
        textShadow: `0 0 ${numSize * 0.16}px ${rgba(C.cyan, 0.4)}, 0 6px 30px rgba(5,9,22,0.5)`}}>{valueText}</span>
      <span style={{display: 'flex', gap: Math.round(numSize * 0.07), fontFamily: maxFont, fontWeight: maxFont === MONO ? 600 : 700, fontSize: Math.round(numSize * 0.27), color: C.cyan, lineHeight: 1.1, textShadow: `0 0 24px ${rgba(C.cyan, 0.5)}`}}><span>/</span><span>{maxText}</span></span>
      {unitFit ? <span style={{fontFamily: d.font, fontWeight: 500, fontSize: unitFit.size, color: 'rgba(255,255,255,0.88)', lineHeight: 1.35, direction: d.copy.dir, whiteSpace: 'nowrap', marginTop: 6}}>{d.unit}</span> : null}
    </div>
  </div>;
};

// ---------- scene ----------
const TONE = {counter: 1, slot: 4, bars: 0, ring: 1} as const;
const FiguresBody: React.FC<BodyProps> = ({d}) => {
  const data = d as FiguresD, box = titleBox(data);
  const top = data.label ? ZONE.titleTop + titleHeight(data, data.label) + 30 : ZONE.top + 12;
  return <>
    {data.label ? <Headline text={data.label} top={ZONE.titleTop} width={box.width} right={box.right} opts={TITLE_OPTS} at={2}/> : null}
    {data.variant === 'counter' ? <CounterView d={data} top={top}/> : null}
    {data.variant === 'slot' ? <SlotView d={data} top={top}/> : null}
    {data.variant === 'bars' ? (data.bars.length <= 2 ? <Tubes d={data} top={top}/> : <Rows d={data} top={top}/>) : null}
    {data.variant === 'ring' ? <RingView d={data} top={top}/> : null}
    <SceneStickerSlot host="figures" sticker={data.sticker} ink="#FFFFFF"/>
  </>;
};

export const Figures: React.FC<FamilyDesignProps> = props => {
  if (props.scene.family !== 'figures') return null;
  return <Settled><DesignScene {...props} tone={TONE[props.scene.data.variant]} Body={FiguresBody}/></Settled>;
};
