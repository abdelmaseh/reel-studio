import {DesignText} from '../../../style-kit/digits';
import {displayWeight,displayLineHeight} from '../../../style-kit/design-safety';
// Liquid-glass: «زجاج وعدسة».
// Law of the style: a precision instrument of glass floats over a living aurora. Every scene has a glass object, and a lens
// (a circular disc that re-renders the scene scaled and clipped) glides onto the one part that matters.
import React from 'react';
import {AbsoluteFill, Easing, spring, useCurrentFrame} from 'remotion';
import {fitOnLines, fitToBox, measure, isArabic} from '../../../core/type';
import {useTypographyFont} from '../../../creative-kit/chapter-theme';
import type {FamilyDesignProps} from '../../family-designs';
import type {SceneCopy} from '../../scene-copy';
import {ownSceneCopy as sceneCopy} from '../../../style-kit/design-safety';
export {ownSceneCopy as sceneCopy} from '../../../style-kit/design-safety';

// ---------- tokens ----------
export const COLOR = {ink: '#050916', cyan: '#64E4FF', violet: '#7B5CFF', mint: '#86E8BC', rose: '#FF8DAB', white: '#FFFFFF', teal: '#12C4DC', blue: '#3563FF'};
export const C = COLOR;
export const SANS = 'Grid Sans'; // IBM Plex Sans Arabic 400-700 (Inter for Latin)
export const DISPLAY = 'Plex Display'; // IBM Plex Sans Arabic 700, Arabic and Latin
export const MONO = 'IBM Plex Mono';
export const instrumentFont = (text: string, font: string) => isArabic(text) ? font : MONO;
export const instrumentSpacing = (text: string, spacing: number) => isArabic(text) ? 0 : spacing;
export const instrumentDirection = (text: string) => isArabic(text) ? 'rtl' as const : 'ltr' as const;
export const W = 1080, H = 1920, X0 = 65, X1 = 1015, CW = X1 - X0;
export const FPS = 30;
export const DIM = 'rgba(255,255,255,0.74)';
export const GLOW = '0 0 40px rgba(100,228,255,0.25), 0 4px 26px rgba(5,9,22,0.4)';

export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const expo = Easing.bezier(0.16, 1, 0.3, 1);
export const glideEase = Easing.bezier(0.6, 0, 0.2, 1);
export const ramp = (f: number, at: number, dur: number, ease: (t: number) => number = expo) => ease(clamp01((f - at) / Math.max(1, dur)));
/** Soft spring for glass: low stiffness, damping about 18, settles in about 25 frames. */
export const soft = (f: number, at: number) => spring({frame: f - at, fps: FPS, config: {damping: 18, stiffness: 90, mass: 1}});
export const num = (n: number) => Math.round(n).toLocaleString('en-US');

// ---------- text fitting ----------
export type FitOpt = {size: number; min: number; lines: number};
export const widthOf = (text: string, family: string, size: number, weight: number, ls = 0) =>
  measure(text, {fontFamily: family, fontSize: size, fontWeight: weight, letterSpacing: ls}).width;
/** Re-breaks a fitted text into the same number of lines with the most even widths, so a headline never leaves one word alone on a line. */
export const balance = (text: string, family: string, weight: number, size: number, n: number): string[] | null => {
  const words = text.split(/\s+/).filter(Boolean);
  if (n <= 1 || words.length <= n || words.length > 32) return null;
  const memo = new Map<string, number>();
  const wd = (i: number, j: number) => { const k = `${i},${j}`; let v = memo.get(k); if (v === undefined) { v = widthOf(words.slice(i, j).join(' '), family, size, weight); memo.set(k, v); } return v; };
  let best: number[] | null = null, bestMax = Infinity, bestSq = Infinity;
  const rec = (start: number, left: number, cuts: number[]) => {
    if (left === 1) {
      const all = [...cuts, words.length]; let prev = 0, mx = 0, sq = 0;
      for (const c of all) { const w = wd(prev, c); mx = Math.max(mx, w); sq += w * w; prev = c; }
      if (Math.round(mx) < Math.round(bestMax) || (Math.round(mx) === Math.round(bestMax) && sq < bestSq)) { best = all; bestMax = mx; bestSq = sq; }
      return;
    }
    for (let c = start + 1; c <= words.length - (left - 1); c++) rec(c, left - 1, [...cuts, c]);
  };
  rec(0, n, []);
  if (!best) return null;
  let prev = 0; return (best as number[]).map((c) => { const line = words.slice(prev, c).join(' '); prev = c; return line; });
};
export const fit = (text: string, family: string, weight: number, width: number, o: FitOpt, lh = 1.22) => {
  weight=weight>=700?displayWeight(family,SANS,weight):weight;
  const r = fitOnLines(text, {fontFamily: family, fontSize: o.size, fontWeight: weight}, {maxBoxWidth: width, maxLines: o.lines, min: o.min, max: o.size, lineHeight: lh});
  if (!r.fits) return fallbackFit(text, family, weight, width, o, lh);
  let lines = r.lines as string[], w = r.width as number;
  const bal = balance(text, family, weight, r.fontSize as number, lines.length);
  if (bal) { const bw = Math.max(...bal.map((l) => widthOf(l, family, r.fontSize as number, weight))); if (bw <= width) { lines = bal; w = Math.ceil(bw); } }
  return {size: r.fontSize as number, lines, box: r.lineBox as number, width: w};
};
/** Tries each option in order, so a long title steps down to smaller type or more lines instead of overflowing. */
export const tryFit = (text: string, family: string, weight: number, width: number, opts: FitOpt[], lh = 1.22) => {
  weight=weight>=700?displayWeight(family,SANS,weight):weight;
  for (const o of opts) {
    const r = fitOnLines(text, {fontFamily: family, fontSize: o.size, fontWeight: weight}, {maxBoxWidth: width, maxLines: o.lines, min: o.min, max: o.size, lineHeight: lh});
    if (r.fits) return fit(text, family, weight, width, o, lh);
  }
  return fallbackFit(text, family, weight, width, opts[opts.length - 1], lh);
};
// ---------- the living aurora ----------
export const TONES = [{dx: 0, dy: 0, ph: 0}, {dx: -150, dy: 230, ph: 1.7}, {dx: 130, dy: -170, ph: 3.1}, {dx: -70, dy: 420, ph: 4.4}, {dx: 170, dy: 140, ph: 5.3}];
// Round 2: saturated teal, violet and deep blue only. Pastel mint over near-black went grey-green, so it is no longer used in the aurora.
export const BLOBS = [
  {c: C.teal, x: 110, y: 340, r: 920, a: 0.66, sx: 130, sy: 110, sp: 0.036, ph: 0},
  {c: C.violet, x: 990, y: 820, r: 980, a: 0.8, sx: 150, sy: 120, sp: 0.028, ph: 2.1},
  {c: C.blue, x: 200, y: 1200, r: 860, a: 0.6, sx: 140, sy: 100, sp: 0.04, ph: 4.2},
  {c: '#6A3DFF', x: 840, y: 1560, r: 700, a: 0.3, sx: 120, sy: 90, sp: 0.033, ph: 1.1},
];
/** Hanging aurora curtains: tall soft bands that sway slowly. */
export const CURTAINS = [
  {c: C.teal, x: 150, w: 220, y: -80, h: 1150, a: 0.62, ph: 0.4, sk: -10},
  {c: '#4F7BFF', x: 520, w: 160, y: -120, h: 980, a: 0.46, ph: 2.2, sk: 8},
  {c: C.violet, x: 900, w: 250, y: 100, h: 1100, a: 0.6, ph: 3.5, sk: -6},
  {c: C.blue, x: 330, w: 230, y: 760, h: 1000, a: 0.42, ph: 1.3, sk: 9},
  {c: C.violet, x: 760, w: 190, y: 900, h: 900, a: 0.34, ph: 4.4, sk: -8},
];
export const STARS = Array.from({length: 44}, (_, i) => {
  const s = Math.sin(i * 91.7) * 43758.5453, t = Math.sin(i * 17.3 + 4) * 24634.6345;
  return {x: (s - Math.floor(s)) * W, y: (t - Math.floor(t)) * H, r: 0.8 + ((s * 7) % 1 + 1) % 1 * 1.5, ph: i * 1.9};
});

/** Near-black ground, drifting aurora blobs, hanging curtains, a soft ribbon, faint stars and fine noise against banding. The lower third falls to near-black blue. */
export const Aurora: React.FC<{tone?: number}> = ({tone = 0}) => {
  const f = useCurrentFrame();
  const T = TONES[tone % TONES.length];
  return <AbsoluteFill style={{background: `linear-gradient(180deg, ${C.ink}, #070c22 55%, ${C.ink})`, overflow: 'hidden'}}>
    {BLOBS.map((b, i) => {
      const x = b.x + T.dx * (i === 1 ? -0.6 : 1) + Math.sin(f * b.sp + b.ph + T.ph) * b.sx;
      const y = b.y + T.dy * (i >= 2 ? 0.5 : 1) + Math.cos(f * b.sp * 0.8 + b.ph + T.ph) * b.sy;
      return <div key={i} style={{position: 'absolute', left: x - b.r, top: y - b.r, width: b.r * 2, height: b.r * 2, borderRadius: '50%',
        background: `radial-gradient(closest-side, ${rgba(b.c, b.a)} 0%, ${rgba(b.c, b.a * 0.62)} 36%, ${rgba(b.c, b.a * 0.2)} 68%, ${rgba(b.c, 0)} 100%)`}}/>;
    })}
    {CURTAINS.map((c, i) => <div key={i} style={{position: 'absolute', left: c.x - c.w / 2 + Math.sin(f * 0.026 + c.ph + T.ph) * 70 + T.dx * 0.3, top: c.y + T.dy * 0.2, width: c.w, height: c.h,
      transform: `skewX(${c.sk}deg)`, filter: 'blur(36px)', opacity: c.a * (0.82 + 0.18 * Math.sin(f * 0.04 + c.ph)),
      background: `linear-gradient(${i < 3 ? 180 : 0}deg, ${rgba(c.c, 1)} 0%, ${rgba(c.c, 0.5)} 38%, ${rgba(c.c, 0)} 100%)`}}/>)}
    <div style={{position: 'absolute', left: -380, top: 760 + T.dy * 0.4 + Math.sin(f * 0.03 + T.ph) * 60, width: 1900, height: 240, transform: 'rotate(-24deg)', opacity: 0.42, filter: 'blur(60px)',
      background: `linear-gradient(90deg, ${rgba(C.teal, 0)}, ${rgba(C.teal, 0.6)} 30%, ${rgba(C.violet, 0.6)} 62%, ${rgba(C.blue, 0.5)} 84%, ${rgba(C.blue, 0)})`}}/>
    <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(4,7,22,0) 56%, rgba(4,7,22,0.6) 74%, rgba(3,6,20,0.93) 100%)'}}/>
    <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
      {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={0.18 + 0.16 * Math.sin(f * 0.07 + s.ph)}/>)}
    </svg>
    <AbsoluteFill style={{background: 'radial-gradient(125% 90% at 50% 46%, rgba(5,9,22,0) 45%, rgba(5,9,22,0.55) 100%)'}}/>
    <svg width={W} height={H} style={{position: 'absolute', inset: 0, opacity: 0.1, mixBlendMode: 'overlay'}}>
      <filter id="lg-noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11"/><feColorMatrix type="saturate" values="0"/></filter>
      <rect width={W} height={H} filter="url(#lg-noise)"/>
    </svg>
  </AbsoluteFill>;
};

// ---------- glass ----------
export type Tint = 'none' | 'cyan' | 'rose' | 'mint';
export const TINT: Record<Tint, string> = {none: 'rgba(255,255,255,0)', cyan: 'rgba(100,228,255,0.13)', rose: 'rgba(255,141,171,0.15)', mint: 'rgba(134,232,188,0.13)'};
export const RIM_MASK: React.CSSProperties = {
  WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor',
  mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', maskComposite: 'exclude',
} as React.CSSProperties;

/**
 * One glass panel: frosted body (backdrop blur 28 px, saturate 140%), 1.5 px gradient rim, top highlight line, soft shadow.
 * It enters with blur-to-sharp and a 40 px rise on a soft spring. `active` (0..1) turns the rim and glow cyan; `sweepAt` sends one
 * specular streak across when the state changes. `dark` puts a slightly darker inner plate under dense text.
 */
export const Glass: React.FC<{
  x: number; y: number; w: number; h: number; r?: number; at?: number; tint?: Tint; active?: number; dark?: number; sweepAt?: number; tilt?: number;
  rise?: number; blurIn?: number; fade?: number; children?: React.ReactNode; rimWidth?: number; lite?: boolean; bf?: number; thick?: boolean;
}> = (p) => {
  const f = useCurrentFrame();
  const {copy} = useGlass();
  const r = p.r ?? 48;
  const k = p.at === undefined ? 1 : soft(f, p.at);
  const e = clamp01(k * 1.12) * (p.fade ?? 1);
  const sharp = p.at === undefined ? 1 : ramp(f, p.at, 26);
  const blur = (1 - sharp) * (p.blurIn ?? 18);
  const rise = (1 - Math.min(1, k)) * (p.rise ?? 40);
  const a = p.active ?? 0;
  const sw = p.sweepAt === undefined ? -1 : clamp01((f - p.sweepAt) / 22);
  const swE = Easing.inOut(Easing.quad)(sw);
  const bf = `blur(${p.bf ?? 28}px) saturate(140%)`;
  const rim = p.rimWidth ?? 1.5;
  return <div data-cue-at={p.at} data-event-progress={e} style={{position: 'absolute', left: copy.ar ? p.x : W - p.x - p.w, top: p.y, width: p.w, height: p.h,
    transform: p.tilt ? `perspective(1700px) rotateX(${p.tilt}deg) translateY(${rise}px)` : `translateY(${rise}px)`, transformOrigin: '50% 60%'}}>
    <div style={{position: 'absolute', inset: 0, borderRadius: r, opacity: e,
      boxShadow: `0 40px 80px rgba(0,0,0,${p.lite ? 0.3 : 0.45})${a > 0.01 ? `, 0 0 ${70 * a}px ${rgba(C.cyan, 0.34 * a)}` : ''}`}}/>
    <div style={{position: 'absolute', inset: 0, borderRadius: r, backdropFilter: bf, WebkitBackdropFilter: bf, opacity: e,
      filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
      background: `linear-gradient(${TINT[p.tint ?? 'none']}, ${TINT[p.tint ?? 'none']}), radial-gradient(120% 70% at 14% 0%, rgba(255,255,255,0.16), rgba(255,255,255,0) 55%), linear-gradient(160deg, rgba(255,255,255,0.10), rgba(255,255,255,0.045) 55%, rgba(255,255,255,0.07))`}}/>
    {p.dark ? <div style={{position: 'absolute', inset: 12, borderRadius: Math.max(8, r - 12), background: `rgba(5,9,22,${0.36 * p.dark})`, opacity: e,
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)'}}/> : null}
    <div style={{position: 'absolute', inset: 0, borderRadius: r, padding: rim, boxSizing: 'border-box', opacity: e * (1 - a), ...RIM_MASK,
      background: 'linear-gradient(135deg, rgba(255,255,255,0.65), rgba(255,255,255,0.08) 58%, rgba(255,255,255,0.24))'}}/>
    {a > 0.01 ? <div style={{position: 'absolute', inset: 0, borderRadius: r, padding: rim + 1, boxSizing: 'border-box', opacity: e * a, ...RIM_MASK,
      background: `linear-gradient(135deg, ${rgba(C.cyan, 1)}, ${rgba(C.cyan, 0.3)} 60%, ${rgba(C.violet, 0.6)})`}}/> : null}
    <div style={{position: 'absolute', top: 1, left: r * 0.7, right: r * 0.7, height: 1.5, opacity: e, background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.85), rgba(255,255,255,0))'}}/>
    {p.thick ? <>
      <div style={{position: 'absolute', inset: 9, borderRadius: Math.max(8, r - 9), boxShadow: 'inset 0 7px 16px rgba(255,255,255,0.10), inset 0 -12px 24px rgba(5,9,22,0.38)', opacity: e}}/>
      <div style={{position: 'absolute', inset: 9, borderRadius: Math.max(8, r - 9), padding: 1.5, boxSizing: 'border-box', opacity: e, ...RIM_MASK,
        background: 'linear-gradient(315deg, rgba(255,255,255,0.6), rgba(255,255,255,0.06) 55%, rgba(255,255,255,0.2))'}}/>
    </> : null}
    {sw >= 0 && sw < 1 ? <div style={{position: 'absolute', inset: 0, borderRadius: r, overflow: 'hidden', pointerEvents: 'none'}}>
      <div style={{position: 'absolute', top: -20, bottom: -20, left: `${mix(-45, 120, swE)}%`, width: '34%', transform: 'skewX(-20deg)', opacity: Math.sin(Math.PI * sw),
        background: 'linear-gradient(90deg, rgba(190,245,255,0), rgba(190,245,255,0.5), rgba(255,255,255,0.7), rgba(190,245,255,0.5), rgba(190,245,255,0))'}}/>
    </div> : null}
    <div style={{position: 'absolute', inset: 0, opacity: e, filter: blur > 0.3 ? `blur(${blur * 0.55}px)` : undefined}}>{p.children}</div>
  </div>;
};

/** Small glass chip, right-anchored by default. Used for kickers and tags. */
export const Chip: React.FC<{text: string; y: number; at: number; right?: number; left?: number; dot?: string; mono?: boolean; size?: number; tint?: Tint; active?: number}> = (p) => {
  const {copy, font} = useGlass();
  const size = p.size ?? 34;
  const family = p.mono ? MONO : font, weight = p.mono ? 600 : 600, ls = p.mono ? 2 : 0;
  const tw = Math.ceil(widthOf(p.text, family, size, weight, ls));
  const w = tw + 36 + (p.dot === '' ? 0 : 38) + 12, h = Math.round(size * 2.05);
  const x = p.left !== undefined ? p.left : (p.right !== undefined ? p.right : X1) - w;
  return <Glass x={x} y={p.y} w={w} h={h} r={h / 2} at={p.at} rise={22} blurIn={12} tint={p.tint} active={p.active} lite>
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, direction: p.mono ? 'ltr' : copy.dir}}>
      {p.dot === '' ? null : <div style={{width: 14, height: 14, borderRadius: 7, background: p.dot ?? C.cyan, boxShadow: `0 0 16px ${p.dot ?? C.cyan}`}}/>}
      <span style={{fontFamily: family, fontWeight: weight, fontSize: size, letterSpacing: ls, color: '#fff', whiteSpace: 'nowrap', lineHeight: `${h}px`}}><DesignText>{p.text}</DesignText></span>
    </div>
  </Glass>;
};

/** Whole-line headline: each line fades up out of blur. No masks, so Arabic dots and hamzas are never cut. */
export const Headline: React.FC<{text: string; top: number; width?: number; right?: number; opts: FitOpt[]; weight?: number; family?: string; at: number; stagger?: number;
  lh?: number; color?: string; glow?: boolean; align?: 'right' | 'center' | 'left'}> = (p) => {
  const f = useCurrentFrame();
  const {copy, font} = useGlass();
  const width = p.width ?? CW;
  const t = tryFit(p.text, p.family ?? font, displayWeight(p.family ?? font,SANS,p.weight ?? 700), width, p.opts, displayLineHeight(p.family ?? font,SANS,p.lh ?? 1.2));
  return <div style={{position: 'absolute', top: p.top, [copy.side]: p.right ?? W - X1, width, display: 'flex', flexDirection: 'column',
    alignItems: (p.align ?? copy.align) === 'left' ? 'flex-start' : p.align === 'center' ? 'center' : 'flex-end'}}>
    {t.lines.map((line, i) => {
      const k = ramp(f, p.at + i * (p.stagger ?? 6), 22);
      return <div key={i} style={{height: t.box, lineHeight: `${t.box}px`, fontFamily: p.family ?? font, fontWeight: displayWeight(p.family ?? font,SANS,p.weight ?? 700), fontSize: t.size, color: p.color ?? '#fff',
        whiteSpace: 'nowrap', direction: copy.dir, opacity: clamp01(k * 1.4), transform: `translateY(${(1 - k) * 34}px)`, filter: k < 0.95 ? `blur(${(1 - k) * 14}px)` : undefined,
        textShadow: p.glow === false ? undefined : GLOW}}>{line}</div>;
    })}
  </div>;
};
export const headH = (text: string, opts: FitOpt[], width = CW, weight = 700, lh = 1.2, family = SANS) => { const t = tryFit(text, family, displayWeight(family,SANS,weight), width, opts, displayLineHeight(family,SANS,lh)); return t.lines.length * t.box; };

/** The clause caption, as it will sit in the new layout: a small glass pill with white Plex Sans Arabic 700. */
export const GlassCaption: React.FC<{y: number; text: string}> = ({y, text}) => {
  const {copy, font} = useGlass();
  const t = fit(text, font, 700, 700, {size: 44, min: 32, lines: 1}, 1.2);
  const w = Math.min(853 - X0, Math.ceil(t.width) + 84), h = 88;
  const cx = (X0 + 853) / 2;
  const bf = 'blur(28px) saturate(140%)';
  return <div style={{position: 'absolute', left: cx - w / 2, top: y - h / 2, width: w, height: h}}>
    <div style={{position: 'absolute', inset: 0, borderRadius: h / 2, boxShadow: '0 30px 60px rgba(0,0,0,0.45)'}}/>
    <div style={{position: 'absolute', inset: 0, borderRadius: h / 2, backdropFilter: bf, WebkitBackdropFilter: bf,
      background: 'linear-gradient(160deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))'}}/>
    <div style={{position: 'absolute', inset: 5, borderRadius: h / 2 - 5, background: 'rgba(5,9,22,0.34)'}}/>
    <div style={{position: 'absolute', inset: 0, borderRadius: h / 2, padding: 1.5, boxSizing: 'border-box', ...RIM_MASK,
      background: 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.1) 58%, rgba(255,255,255,0.26))'}}/>
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: copy.dir,
      fontFamily: font, fontWeight: 700, fontSize: t.size, color: '#fff', whiteSpace: 'nowrap', textShadow: '0 2px 12px rgba(5,9,22,0.5)'}}>{text}</div>
  </div>;
};
export const CaptionMock = GlassCaption;

// ---------- small drawn parts ----------
export const Check: React.FC<{p: number; size: number; color: string; width?: number}> = ({p, size, color, width = 9}) =>
  <svg width={size} height={size} viewBox="0 0 100 100"><path d="M22 53 L42 72 L79 31" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
    pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p}/></svg>;

/** A ring that fills, then draws a check (done) or a dash (missing). */
export const StatusRing: React.FC<{size: number; p: number; missing?: boolean}> = ({size, p, missing}) => {
  const col = missing ? C.rose : C.cyan;
  const ring = clamp01(p / 0.55), body = clamp01((p - 0.35) / 0.4), mark = clamp01((p - 0.6) / 0.4);
  return <svg width={size} height={size} viewBox="0 0 100 100" style={{overflow: 'visible'}}>
    <circle cx="50" cy="50" r="43" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.28)" strokeWidth="3"/>
    <circle cx="50" cy="50" r="38" fill={rgba(col, 0.26 * body)}/>
    <circle cx="50" cy="50" r="43" fill="none" stroke={col} strokeWidth="6" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ring}
      transform="rotate(-90 50 50)" style={{filter: `drop-shadow(0 0 ${8 * ring}px ${rgba(col, 0.9)})`}}/>
    {missing
      ? <path d="M33 50 H67" stroke={col} strokeWidth="9" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - mark}/>
      : <path d="M29 53 L44 67 L72 35" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - mark}/>}
  </svg>;
};

/** A glass sphere behind a hero number: refraction rim, specular highlight, inner glow. Drawn first, so it can never cover a digit. */
export const Orb: React.FC<{x: number; y: number; d: number; at: number}> = ({x, y, d, at}) => {
  const f = useCurrentFrame();
  const e = clamp01(soft(f, at));
  const bob = Math.sin(f * 0.05) * 5;
  const bf = 'blur(10px) saturate(150%)';
  return <div style={{position: 'absolute', left: x - d / 2, top: y - d / 2 + bob + (1 - e) * 36, width: d, height: d, borderRadius: '50%', opacity: e, filter: e < 0.95 ? `blur(${(1 - e) * 16}px)` : undefined}}>
    <div style={{position: 'absolute', inset: 0, borderRadius: '50%', backdropFilter: bf, WebkitBackdropFilter: bf,
      background: `radial-gradient(circle at 34% 24%, rgba(255,255,255,0.2), rgba(255,255,255,0.04) 42%, ${rgba(C.cyan, 0.08)} 68%, ${rgba(C.violet, 0.3)} 100%)`,
      boxShadow: `inset 0 0 0 1.5px rgba(255,255,255,0.3), inset 0 0 ${d * 0.13}px ${rgba(C.cyan, 0.34)}, 0 30px 70px rgba(0,0,0,0.35)`}}/>
    <div style={{position: 'absolute', left: '14%', top: '6%', width: '50%', height: '27%', borderRadius: '50%', transform: 'rotate(-24deg)', background: 'linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0.02))'}}/>
    <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle at 72% 86%, rgba(18,196,220,0.3), rgba(18,196,220,0) 38%)'}}/>
  </div>;
};

// ---------- the lens ----------
export type LensState = {cx: number; cy: number; r: number; zoom: number; blur: number; vis: number; spin: number; label?: string; tag?: boolean};
export type Stop = {x: number; y: number; at: number; r?: number};

/** Where the lens is at frame f: it arrives at each stop on its frame, glides along a bezier-eased arc, and pauses in between. */
export const walk = (f: number, stops: Stop[], travel = 18, arc = 40) => {
  let x = stops[0].x, y = stops[0].y, moving = 0, since = f - stops[0].at, idx = 0, r = stops[0].r ?? 0;
  for (let i = 1; i < stops.length; i++) {
    const dep = stops[i].at - travel;
    if (f < dep) continue;
    const p = clamp01((f - dep) / travel), e = glideEase(p);
    const a = stops[i - 1], b = stops[i];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const off = Math.sin(Math.PI * e) * arc * (i % 2 ? 1 : -1);
    x = a.x + dx * e + (-dy / len) * off; y = a.y + dy * e + (dx / len) * off;
    moving = Math.sin(Math.PI * p); since = p >= 1 ? f - stops[i].at : -1; idx = p >= 1 ? i : i - 1 + e;
    r = mix(a.r ?? b.r ?? 0, b.r ?? a.r ?? 0, e);
  }
  return {x, y, moving, since, idx, r};
};
export const lensState = (f: number, stops: Stop[], o: {appear: number; r: number; zoom?: number; travel?: number; arc?: number; label?: string; tag?: boolean}): LensState => {
  const w = walk(f, stops, o.travel ?? 18, o.arc ?? 40);
  const settle = w.since < 0 ? 0 : ramp(w.since, 0, 16);
  return {cx: w.x, cy: w.y, r: w.r || o.r, zoom: (o.zoom ?? 1.6) * mix(0.85, 1, settle), blur: 10 * (1 - settle), vis: clamp01(soft(f, o.appear)), spin: w.idx, label: o.label, tag: o.tag};
};

/** The glass disc: scene layers re-rendered scaled about the lens centre and clipped to a circle, plus rim, refraction and highlights. */
export const LensDisc: React.FC<{cx: number; cy: number; R: number; layers: {node: React.ReactNode; zoom: number; blur?: number; opacity?: number}[]; rim?: number}> = ({cx, cy, R, layers, rim = 1}) =>
  <>
    <div style={{position: 'absolute', left: cx - R, top: cy - R, width: R * 2, height: R * 2, borderRadius: '50%', opacity: rim,
      boxShadow: '0 36px 80px rgba(0,0,0,0.55), 0 0 90px rgba(100,228,255,0.2)'}}/>
    {/* clip-path makes this its own backdrop root, so glass inside the copy blurs only the magnified copy */}
    <div style={{position: 'absolute', left: cx - R, top: cy - R, width: R * 2, height: R * 2, clipPath: `circle(${R}px at 50% 50%)`, isolation: 'isolate'}}>
      {layers.map((l, i) => <div key={i} style={{position: 'absolute', left: -(cx - R), top: -(cy - R), width: W, height: H, transform: `scale(${l.zoom})`,
        transformOrigin: `${cx}px ${cy}px`, opacity: l.opacity ?? 1, filter: l.blur && l.blur > 0.3 ? `blur(${l.blur}px)` : undefined}}>{l.node}</div>)}
      <div style={{position: 'absolute', inset: 0, opacity: rim, background: `radial-gradient(circle closest-side, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 60%, ${rgba(C.cyan, 0.12)} 82%, ${rgba(C.violet, 0.34)} 100%)`}}/>
      <div style={{position: 'absolute', inset: 0, opacity: rim, background: 'radial-gradient(circle at 74% 84%, rgba(18,196,220,0.28), rgba(18,196,220,0) 34%)'}}/>
      <div style={{position: 'absolute', left: '8%', top: '5%', width: '62%', height: '40%', borderRadius: '50%', opacity: rim * 0.9, transform: 'rotate(-24deg)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.42), rgba(255,255,255,0.02) 85%)'}}/>
      <div style={{position: 'absolute', inset: 0, borderRadius: '50%', padding: Math.max(3, R * 0.022), boxSizing: 'border-box', opacity: rim, ...RIM_MASK,
        background: `linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.22) 52%, ${rgba(C.cyan, 0.8)})`}}/>
      <div style={{position: 'absolute', inset: 0, borderRadius: '50%', opacity: rim, boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.3), inset 0 0 46px ${rgba(C.cyan, 0.3)}`}}/>
    </div>
  </>;

/** Bezel ticks and a cyan scan arc that sweeps while the lens travels, plus the magnification chip. */
export const LensBezel: React.FC<{cx: number; cy: number; R: number; spin: number; zoom: number; vis: number; tag?: boolean}> = ({cx, cy, R, spin, zoom, vis, tag}) => {
  const f = useCurrentFrame();
  const pad = 46, S = (R + pad) * 2, c = R + pad;
  const ticks = Array.from({length: 72}, (_, i) => i);
  const arcA = -60 + spin * 150 + f * 0.25, arcLen = 70;
  const pt = (deg: number, rad: number) => [c + Math.cos(deg * Math.PI / 180) * rad, c + Math.sin(deg * Math.PI / 180) * rad];
  const [ax, ay] = pt(arcA, R + 22), [bx, by] = pt(arcA + arcLen, R + 22);
  const chipA = -46, [chx, chy] = pt(chipA, R + 26);
  const label = `${zoom.toFixed(1)}×`;
  return <div style={{position: 'absolute', left: cx - c, top: cy - c, width: S, height: S, opacity: vis}}>
    <svg width={S} height={S} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      {ticks.map((i) => { const deg = i * 5 + f * 0.2, major = i % 6 === 0; const [x1, y1] = pt(deg, R + 12), [x2, y2] = pt(deg, R + (major ? 28 : 20));
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeOpacity={major ? 0.55 : 0.26} strokeWidth={major ? 2.4 : 1.6} strokeLinecap="round"/>; })}
      <path d={`M${ax} ${ay} A${R + 22} ${R + 22} 0 0 1 ${bx} ${by}`} fill="none" stroke={C.cyan} strokeWidth="5" strokeLinecap="round" style={{filter: `drop-shadow(0 0 8px ${rgba(C.cyan, 0.9)})`}}/>
    </svg>
    {tag ? <div style={{position: 'absolute', left: chx - 50, top: chy - 22, width: 100, height: 44, borderRadius: 22, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      background: 'rgba(5,9,22,0.5)', boxShadow: `inset 0 0 0 1.5px ${rgba(C.cyan, 0.7)}`, color: C.cyan, fontFamily: MONO, fontWeight: 600, fontSize: 24, letterSpacing: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'ltr'}}><DesignText>{label}</DesignText></div> : null}
  </div>;
};

/** The signature object. `ground` and `children` are rendered a second time here, scaled and clipped to the disc. */
export const Lens: React.FC<{s: LensState; ground: React.ReactNode; children: React.ReactNode}> = ({s, ground, children}) => {
  const {copy} = useGlass();
  if (s.vis < 0.02) return null;
  const R = s.r * s.vis;
  const cx = copy.ar ? s.cx : W - s.cx;
  return <div data-lens-visibility={s.vis} data-lens-zoom={s.zoom} style={{position: 'absolute', inset: 0, opacity: clamp01(s.vis * 2)}}>
    <LensDisc cx={cx} cy={s.cy} R={R} layers={[{node: <>{ground}{children}</>, zoom: s.zoom, blur: s.blur}]}/>
    <LensBezel cx={cx} cy={s.cy} R={R} spin={s.spin} zoom={s.zoom} vis={s.vis} tag={s.tag}/>
  </div>;
};


const warned = new Set<string>();
export const warnFit = (detail: unknown) => {
  const warning = 'liquid-glass fit-warning: ' + JSON.stringify(detail);
  if (!warned.has(warning)) { if (warned.size >= 256) warned.clear(); warned.add(warning); console.warn(warning); }
};
const fallbackFit = (text: string, family: string, weight: number, width: number, o: FitOpt, lh: number) => {
  const r = fitToBox(text, {fontFamily: family, fontSize: o.min, fontWeight: weight}, {maxBoxWidth: width, maxLines: o.lines, fontSize: o.min, lineHeight: lh});
  warnFit({text, width, size: o.min, lines: o.lines, font: family});
  return {size: r.fontSize, lines: r.lines, box: r.lineBox, width: r.width};
};
type GlassContext = {copy: SceneCopy; font: string; display: string; seam: number; headTop: number | null};
const GlassCtx = React.createContext<GlassContext>({copy: sceneCopy({lang:'ar'}), font: SANS, display: DISPLAY, seam: 1080, headTop: null});
export const useGlass = () => React.useContext(GlassCtx);
export type BodyProps = {d: any; n: string};
export type DesignOptions = FamilyDesignProps & {tone: number; Body: React.FC<BodyProps>; Ground?: React.FC<{tone: number}>; lens?: (f: number, d: any) => LensState; data?: object};
const SceneContent: React.FC<DesignOptions> = p => {
  const f = useCurrentFrame(), context = useGlass();
  const d = {...(p.data ?? p.scene.data), ...context};
  const Ground = p.Ground ?? Aurora;
  const ground = <Ground tone={p.tone}/>;
  const n = p.sectionIndex && Number.isInteger(p.sectionIndex) && p.sectionIndex > 0 ? String(p.sectionIndex).padStart(2,'0') : '';
  const body = <p.Body d={d} n={n}/>;
  const lenses = React.useContext(LensVisibleCtx);
  const ls = lenses ? p.lens?.(f,d) : null;
  return <AbsoluteFill style={context.copy.ar ? undefined : {direction:'ltr',textAlign:'left'}}>{ground}{body}{ls ? <Lens s={ls} ground={ground}>{body}</Lens> : null}</AbsoluteFill>;
};
export const DesignScene: React.FC<DesignOptions> = p => {
  const savedFont = useTypographyFont();
  const context = {copy:sceneCopy(p.scene.data),font:savedFont ?? SANS,display:savedFont ?? DISPLAY,seam:p.seam,headTop:p.headBox?.y ?? null};
  return <GlassCtx.Provider value={context}><SceneContent {...p}/></GlassCtx.Provider>;
};

const LensVisibleCtx = React.createContext(true);
export const GlassLensSuppression: React.FC<{children?:React.ReactNode}> = ({children}) => <LensVisibleCtx.Provider value={false}>{children}</LensVisibleCtx.Provider>;
/** False inside GlassLensSuppression, so a design's own lens hides together with the style's lenses. */
export const useLensVisible = (): boolean => React.useContext(LensVisibleCtx);
