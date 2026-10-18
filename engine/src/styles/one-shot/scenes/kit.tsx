// One-shot building blocks: the easing helpers, the colours and fonts of the chain, and the pieces every world
// shares (rolling words, the step badge, the cursor and its click ring). The timing numbers live in ./math.
import React from 'react';
import {Easing} from 'remotion';
import type {SceneTheme} from '../../theme-types.ts';
import {HEAD, digitOf, fitLine, type DigitSet} from './math.ts';

export const W = 1080, H = 1920;

export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
export const prog = (t: number, a: number, b: number): number => (b === a ? (t >= b ? 1 : 0) : clamp01((t - a) / (b - a)));
export const bump = (t: number, a: number, b: number, c: number, d: number): number => prog(t, a, b) * (1 - prog(t, c, d));

export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  expoIn: Easing.bezier(0.7, 0, 0.84, 0),
  expoInOut: Easing.bezier(0.87, 0, 0.13, 1),
  pop: Easing.bezier(0.34, 1.45, 0.64, 1),
  pull: Easing.bezier(0.5, 0, 0.12, 1),
  soft: Easing.bezier(0.45, 0, 0.55, 1),
};
export const at = (t: number, a: number, b: number, ease: (x: number) => number = EASE.out): number => ease(prog(t, a, b));

const hex = (c: string): number[] => (c.startsWith('#') ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : (c.match(/\d+/g) ?? ['0', '0', '0']).map(Number));
export const mix = (c1: string, c2: string, k: number): string => {
  const a = hex(c1), b = hex(c2);
  return `rgb(${a.map((x, i) => Math.round(lerp(x, b[i], k))).join(',')})`;
};

/** A path through (time, x, y) points with an eased glide between them. */
export type Pt = readonly [number, number, number];
export const along = (t: number, pts: readonly Pt[]): [number, number] => {
  if (t <= pts[0][0]) return [pts[0][1], pts[0][2]];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [t0, x0, y0] = pts[i], [t1, x1, y1] = pts[i + 1];
    if (t <= t1) {
      const k = EASE.inOut(prog(t, t0, t1));
      return [lerp(x0, x1, k), lerp(y0, y1, k)];
    }
  }
  const z = pts[pts.length - 1];
  return [z[1], z[2]];
};

/** Camera that keeps (cx, cy) on the middle of the frame while the scale runs from 1 (e = 1) to S (e = 0), in log space. */
export const focus = (e: number, cx: number, cy: number, S: number): string =>
  `translate(${lerp(540, cx, e)}px, ${lerp(960, cy, e)}px) scale(${Math.exp((1 - e) * Math.log(S))}) translate(${-cx}px, ${-cy}px)`;

export type Colors = {cream: string; ink: string; white: string; panel: string; line: string; muted: string; soft: string; accent: string; bad: string};
export type Fonts = {display: string; ui: string; latin: string};
export const colorsOf = (theme: Omit<SceneTheme, 'grammar'>, accent?: string): Colors => ({
  cream: theme.background, ink: theme.text, white: theme.card, panel: '#1A2030', line: '#2C3447', muted: theme.dim, soft: '#8A92A3',
  accent: accent ?? theme.accent, bad: theme.bad,
});
export const fontsOf = (theme: Omit<SceneTheme, 'grammar'>): Fonts => ({display: theme.display, ui: theme.ar, latin: theme.mono});

/** Everything a world needs to draw: the scene time in seconds, the palette and the fonts. */
export type Ctx = {t: number; c: Colors; f: Fonts; digits: DigitSet};

/** Words that rise out of a mask one after another (Arabic is animated by word, never by letter). */
export const Words: React.FC<{text: string; t: number; inAt: number; outAt?: number; size: number; color: string; weight?: number; family: string}> =
  ({text, t, inAt, outAt = 1e9, size, color, weight = 900, family}) => (
    <div dir="rtl" style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `0 ${size * 0.24}px`, fontFamily: family,
      fontSize: size, fontWeight: weight, lineHeight: 1.15, color, letterSpacing: 0}}>
      {text.split(/\s+/).filter(Boolean).map((w, i) => {
        const pin = at(t, inAt + i * 0.07, inAt + i * 0.07 + 0.5);
        const pout = at(t, outAt + i * 0.05, outAt + i * 0.05 + 0.36, EASE.expoIn);
        return <span key={i} style={{display: 'inline-block', overflow: 'hidden', padding: `${size * 0.14}px 0`, margin: `${-size * 0.14}px 0`}}>
          <span style={{display: 'inline-block', transform: `translateY(${(1 - pin) * 150 - pout * 150}%)`}}>{w}</span>
        </span>;
      })}
    </div>
  );

/** The step title: two lines at the same place in every world. */
export const TitleBlock: React.FC<{t: number; top: string; bottom: string; in1: number; in2: number; out1?: number; out2?: number; c1: string; c2: string; family: string}> =
  ({t, top, bottom, in1, in2, out1, out2, c1, c2, family}) => <>
    <div style={{position: 'absolute', left: HEAD.titleSide, right: HEAD.titleSide, top: HEAD.title1Top}}><Words text={top} t={t} inAt={in1} outAt={out1} size={fitLine(top, 900, HEAD.titleSize)} color={c1} weight={800} family={family} /></div>
    <div style={{position: 'absolute', left: HEAD.titleSide, right: HEAD.titleSide, top: HEAD.title2Top}}><Words text={bottom} t={t} inAt={in2} outAt={out2} size={fitLine(bottom, 900, HEAD.titleSize)} color={c2} weight={800} family={family} /></div>
  </>;

/** A digit that rolls up into the next one. */
export const Roll: React.FC<{from: string; to: string; p: number; size: number; color: string; family: string}> = ({from, to, p, size, color, family}) => {
  const cell: React.CSSProperties = {position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontFamily: family, fontWeight: 900, fontSize: size, color, lineHeight: 1};
  return <div style={{position: 'relative', width: '100%', height: '100%', overflow: 'hidden'}}>
    <div style={{...cell, transform: `translateY(${-p * 100}%)`}}>{from}</div>
    <div style={{...cell, transform: `translateY(${(1 - p) * 100}%)`}}>{to}</div>
  </div>;
};

/** The numbered circle at the top of every step. `scale` pops it in and out; the digit rolls from `fromNum` to `toNum`. */
export const Badge: React.FC<{bg: string; fg: string; family: string; fromNum: number; toNum: number; roll: number; scale: number; digits?: DigitSet}> = ({bg, fg, family, fromNum, toNum, roll, scale, digits = 'arabic-indic'}) => (
  <div style={{position: 'absolute', left: 540 - HEAD.badgeR, top: HEAD.badgeY - HEAD.badgeR, width: HEAD.badgeR * 2, height: HEAD.badgeR * 2, borderRadius: HEAD.badgeR, background: bg,
    transform: `scale(${scale})`, overflow: 'hidden'}}>
    <Roll from={digitOf(fromNum, digits)} to={digitOf(toNum, digits)} p={roll} size={82} color={fg} family={family} />
  </div>
);

export const Cursor: React.FC<{x: number; y: number; press?: boolean; opacity?: number; ink: string}> = ({x, y, press, opacity = 1, ink}) => (
  <svg width={44} height={62} viewBox="0 0 34 48" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity,
    transform: `translate(${x}px, ${y}px) scale(${press ? 0.86 : 1})`, transformOrigin: '1px 1px', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.35))'}}>
    <path d="M1 1 L1 38 L10 30 L17 46 L24 43 L17 27 L29 27 Z" fill="#FFFFFF" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
  </svg>
);

export const Ring: React.FC<{x: number; y: number; t: number; t0: number; color: string}> = ({x, y, t, t0, color}) => {
  const p = prog(t, t0, t0 + 0.45);
  if (p <= 0 || p >= 1) return null;
  return <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
    <circle cx={x} cy={y} r={16 + 84 * EASE.out(p)} fill="none" stroke={color} strokeWidth={6} opacity={0.8 * (1 - p)} />
  </svg>;
};

/** A whole-frame world: everything is positioned on the 1080 x 1920 canvas. */
export const worldBox = (background: string, extra: React.CSSProperties = {}): React.CSSProperties =>
  ({position: 'absolute', left: 0, top: 0, width: W, height: H, background, overflow: 'hidden', ...extra});

export const numberText = (value: number, decimals: number, digits: DigitSet = 'arabic-indic'): string =>
  value.toLocaleString(digits === 'latin' ? 'en-US' : 'ar-EG', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
