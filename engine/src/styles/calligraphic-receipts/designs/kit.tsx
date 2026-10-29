import {DesignText} from '../../../style-kit/digits';
import {FittedContent} from '../../../style-kit/content-fit';
import {displayWeight,displayLineHeight,useTiming,fittedSize,useDesignBottom,useFitEnabled} from '../../../style-kit/design-safety';
// Approved calligraphic receipts primitives: parchment, joined ink and thermal evidence.
import React from 'react';
import {useTypographyFont} from '../../../creative-kit/chapter-theme';
import type {SceneCopy} from '../../scene-copy';
import {ownSceneCopy as sceneCopy} from '../../../style-kit/design-safety';
import {receiptCopy} from './copy';
export {ownSceneCopy as sceneCopy} from '../../../style-kit/design-safety';
const CopyContext = React.createContext(sceneCopy({lang: 'ar'}));
export const useCopy = () => React.useContext(CopyContext);
export const DesignRoot: React.FC<{copy: SceneCopy; children: React.ReactNode}> = ({copy, children}) => <CopyContext.Provider value={copy}><AbsoluteFill style={{direction: copy.dir, textAlign: copy.align}}><FittedContent native="Aref Ruqaa">{children}</FittedContent></AbsoluteFill></CopyContext.Provider>;
export const useFonts = () => ({...FONT, ruqaa: useTypographyFont() ?? FONT.ruqaa});
export const useInkLayout = () => {
  const fonts = useFonts();
  return (text: string, options: InkOpts | InkOpts[], forced?: string[]) => inkLayout(text,
    (Array.isArray(options) ? options : [options]).map(o => ({...o, family: o.family ?? fonts.ruqaa, weight:o.weight ?? displayWeight(fonts.ruqaa,FONT.ruqaa,700), lh:displayLineHeight(o.family ?? fonts.ruqaa,FONT.ruqaa,o.lh ?? 1.2)})), forced);
};
export const anchor = (copy: SceneCopy, left: number, width: number) => copy.ar ? left : W - left - width;

import {AbsoluteFill, Easing, spring, useCurrentFrame} from 'remotion';
import {fitToWidth, measure} from '../../../core/type';

// ---------- tokens ----------
export const C = {paper: '#F4EDE1', guide: '#B6A28B', ink: '#2E2019', inkSoft: 'rgba(46,32,25,0.68)', rust: '#A54522', good: '#2D6948', bad: '#AF352A', thermal: '#FFFCF5', fringe: '#FBF8F0'};
export const FONT = {ruqaa: 'Aref Ruqaa', naskh: 'Noto Naskh Arabic', mono: 'IBM Plex Mono', serif: 'Source Serif 4'};
export const W = 1080, H = 1920, X0 = 65, X1 = 1015, CW = X1 - X0, FPS = 30;
export const AXIS = 459; // centre of the 65..853 band: receipts, the caption and the lower graphic share this axis
export const expo = Easing.bezier(0.16, 1, 0.3, 1);
export const pen = Easing.bezier(0.33, 0, 0.2, 1); // the pen eases in and out, never snaps
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const ramp = (f: number, at: number, dur: number, ease: (t: number) => number = expo) => ease(clamp01((f - at) / Math.max(1, dur)));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const pop = (f: number, at: number, damping = 14, stiffness = 170) => spring({frame: f - at, fps: FPS, config: {damping, stiffness, mass: 0.8}});
export const rng = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
export const uid = () => React.useId().replace(/[^a-zA-Z0-9]/g, '');

// ---------- text fitting ----------
export type InkOpts = {family?: string; weight?: number; width?: number; size: number; min: number; lines: number; lh?: number};
export type InkLayout = {lines: string[]; size: number; box: number; family: string; weight: number; width: number; baseline: number};

/** Keep the whole text, including its ink allowance, forty pixels above a measured head. */
export const statementPlacement = (L: InkLayout, head?: {y: number} | null) => {
  const original = {top: 306, kickerTop: 258, size: L.size, box: L.box, baseline: L.baseline, visible: true};
  if (!head) return original;
  const bottom = head.y - 40;
  if (306 + L.lines.length * L.box + L.size * .34 <= bottom) return original;
  const ratio = L.box / L.size, top = 298;
  const size = Math.min(L.size, Math.floor((bottom - top) / (L.lines.length * ratio + .34)));
  if (size < 70) {
    warnFit(L.lines.join(' '), L.width, 70, L.lines.length);
    return {...original, visible: false};
  }
  const box = Math.floor(size * ratio);
  return {top, kickerTop: 250, size, box, baseline: baselineIn(L.family, L.weight, size, box), visible: true};
};

/** Distance from the top of a line box to the baseline, read from the real font so ruled lines can sit under the text. */
export const baselineIn = (family: string, weight: number, size: number, box: number): number => {
  try {
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.font = `${weight} ${size}px "${family}"`;
    const m = ctx.measureText('ا');
    return (box - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
  } catch { return box * 0.64; }
};

/** Break text into n lines with the narrowest possible widest line, so a claim never ends in a lonely last word. */
export const balanced = (text: string, n: number, family: string, weight: number, size: number): string[] => {
  const words = text.trim().split(/\s+/);
  const k = Math.min(n, words.length);
  if (k <= 1) return [words.join(' ')];
  // Invalid external copy still has bounded work and keeps every whole word.
  if (words.length > 64) return Array.from({length: k}, (_, i) => words.slice(Math.floor(i * words.length / k), Math.floor((i + 1) * words.length / k)).join(' '));
  const w = (a: number, b: number) => measure(words.slice(a, b).join(' '), {fontFamily: family, fontSize: size, fontWeight: weight}).width;
  let best: number[] = [], bestW = Infinity;
  const walk = (cuts: number[], from: number) => {
    if (cuts.length === k - 1) {
      const edges = [0, ...cuts, words.length]; let worst = 0;
      for (let i = 0; i < edges.length - 1; i++) worst = Math.max(worst, w(edges[i], edges[i + 1]));
      if (worst < bestW) { bestW = worst; best = edges; }
      return;
    }
    for (let c = from; c <= words.length - (k - 1 - cuts.length); c++) walk([...cuts, c], c + 1);
  };
  walk([], 1);
  return best.slice(0, -1).map((e, i) => words.slice(e, best[i + 1]).join(' '));
};

/** Fit a block of text; `tries` are attempted in order and the first that fits wins, so short claims stay big and long ones step down. */
export const inkLayout = (text: string, tries: InkOpts | InkOpts[], forced?: string[]): InkLayout => {
  const list = Array.isArray(tries) ? tries : [tries];
  let last = '';
  for (const o of list) {
    const family = o.family ?? FONT.ruqaa, weight = o.weight ?? 700, width = o.width ?? CW, lh = o.lh ?? 1.2;
    if (forced) {
      const sizes = forced.map((l) => fitToWidth(l, {fontFamily: family, fontSize: o.size, fontWeight: weight}, width, {min: o.min, max: o.size}));
      if (sizes.every((s) => s.fits)) { const size = Math.min(...sizes.map((s) => s.fontSize)); const box = Math.round(size * lh);
        return {lines: forced, size, box, family, weight, width, baseline: baselineIn(family, weight, size, box)}; }
      last = forced.join(' / ');
      continue;
    }
    const lines = balanced(text, o.lines, family, weight, o.size);
    const widest = lines.reduce((a, b) => (measure(b, {fontFamily: family, fontSize: o.size, fontWeight: weight}).width > measure(a, {fontFamily: family, fontSize: o.size, fontWeight: weight}).width ? b : a));
    const fitted = fitToWidth(widest, {fontFamily: family, fontSize: o.size, fontWeight: weight}, width, {min: o.min, max: o.size});
    if (fitted.fits) { const size = fitted.fontSize, box = Math.round(size * lh);
      return {lines, size, box, family, weight, width, baseline: baselineIn(family, weight, size, box)}; }
    last = text;
  }
  const o = list[list.length - 1], family = o.family ?? FONT.ruqaa, weight = o.weight ?? 700;
  const size = o.min, box = Math.round(size * (o.lh ?? 1.2));
  const lines = forced ?? balanced(text, o.lines, family, weight, size);
  warnFit(last, o.width ?? CW, size, o.lines);
  return {lines, size, box, family, weight, width: o.width ?? CW, baseline: baselineIn(family, weight, size, box)};
};
const warned = new Set<string>();
export const warnFit = (text: string, width: number, size: number, lines: number) => {
  const warning = 'calligraphic-receipts fit-warning: ' + JSON.stringify({text, width, size, lines});
  if (!warned.has(warning)) {if (warned.size >= 256) warned.clear(); warned.add(warning); console.warn(warning);}
};
export const one = (text: string, o: {family: string; weight: number; width: number; size: number; min: number}) =>
  {const result = fitToWidth(text, {fontFamily: o.family, fontSize: o.size, fontWeight: o.weight}, o.width, {min: o.min, max: o.size});
    if (!result.fits) warnFit(text, o.width, o.min, 1);
    return result;};

// ---------- paper ----------
/** Fine paper tooth plus very short fibres. High frequency and low opacity: it must read as grain, never as clouds. */
export const Tooth: React.FC<{w: number; h: number; tooth?: number; fibre?: number; seed?: number; tint?: [number, number, number]}> = ({w, h, tooth = 0.2, fibre = 0.09, seed = 7, tint = [0.36, 0.26, 0.16]}) => {
  const id = uid();
  return <>
    <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0, mixBlendMode: 'multiply', opacity: tooth, pointerEvents: 'none'}}>
      <filter id={`t${id}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="1.05" numOctaves={2} seed={seed}/>
        <feColorMatrix type="matrix" values={`0 0 0 0 ${tint[0]}  0 0 0 0 ${tint[1]}  0 0 0 0 ${tint[2]}  2.1 0 0 0 -0.78`}/>
      </filter>
      <rect width={w} height={h} filter={`url(#t${id})`}/>
    </svg>
    {fibre > 0 ? <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0, mixBlendMode: 'multiply', opacity: fibre, pointerEvents: 'none'}}>
      <filter id={`b${id}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.16 0.9" numOctaves={2} seed={seed + 3}/>
        <feColorMatrix type="matrix" values={`0 0 0 0 ${tint[0]}  0 0 0 0 ${tint[1]}  0 0 0 0 ${tint[2]}  2.4 0 0 0 -1.05`}/>
      </filter>
      <rect width={w} height={h} filter={`url(#b${id})`}/>
    </svg> : null}
  </>;
};

/** Warm parchment with calligraphy-practice ruling. `pitch`/`offset` let a scene put its headline baseline exactly on a rule. */
export const PaperFill: React.FC<{w: number; h: number; pitch?: number; offset?: number; rules?: boolean}> = ({w, h, pitch = 150, offset = 0, rules = true}) =>
  <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, background: '#F7F1E6', overflow: 'hidden'}}>
    {rules ? <div style={{position: 'absolute', inset: 0, backgroundImage: `linear-gradient(to bottom, transparent ${pitch - 2}px, rgba(182,162,139,0.30) ${pitch - 2}px)`,
      backgroundSize: `100% ${pitch}px`, backgroundPosition: `0 ${((offset % pitch) + pitch) % pitch + 1}px`}}/> : null}
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(130% 80% at 50% 38%, rgba(255,250,238,0.0) 56%, rgba(139,104,60,0.07) 100%)'}}/>
    <Tooth w={w} h={h} tooth={0.12} fibre={0.05}/>
  </div>;

export const Parchment: React.FC<{pitch?: number; offset?: number; rules?: boolean}> = ({pitch, offset, rules}) =>
  <AbsoluteFill><PaperFill w={W} h={H} pitch={pitch} offset={offset} rules={rules}/></AbsoluteFill>;

export const tornPts = (w: number, y: number, seed: number, amp: number, step = 11): [number, number][] => {
  const r = rng(seed); const pts: [number, number][] = [];
  for (let x = -step; x <= w + step; x += step) pts.push([x, y + (r() - 0.5) * amp * 2 + Math.sin(x / w * 11 + seed) * amp * 0.55]);
  return pts;
};
export const polyDown = (w: number, pts: [number, number][]) => `polygon(-20px -20px, ${w + 20}px -20px, ${[...pts].reverse().map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(', ')})`;

/** A sheet of parchment whose bottom edge is torn. A lighter fringe shows along the tear, like the core of real paper. */
export const TornPaper: React.FC<{w?: number; tearY: number; height?: number; seed?: number; amp?: number; pitch?: number; offset?: number; shadow?: number; rules?: boolean; children?: React.ReactNode}> =
  ({w = W, tearY, height, seed = 5, amp = 7, pitch, offset, shadow = 1, rules = true, children}) => {
    const h = height ?? tearY + 40;
    const poly = polyDown(w, tornPts(w, tearY, seed, amp));
    return <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h}}>
      <div style={{position: 'absolute', inset: 0, transform: `translateY(${10 * shadow}px)`, filter: `blur(${16 * shadow}px)`, opacity: 0.38 * shadow}}>
        <div style={{position: 'absolute', inset: 0, background: '#28180C', clipPath: poly}}/>
      </div>
      <div style={{position: 'absolute', inset: 0, background: C.fringe, clipPath: polyDown(w, tornPts(w, tearY + 6, seed + 11, amp * 0.9))}}/>
      <div style={{position: 'absolute', inset: 0, clipPath: poly}}>
        <PaperFill w={w} h={h} pitch={pitch} offset={offset} rules={rules}/>
        {children}
      </div>
    </div>;
  };

// ---------- ink: calligraphy lines, brush strokes ----------
/** One whole line written by a soft right-to-left clip. The clip box is padded so dots and hamzas are never cut. */
export const InkLine: React.FC<{text: string; size: number; box: number; family: string; weight: number; color: string; p: number}> = ({text, size, box, family, weight, color, p}) => {
  const copy = useCopy();
  const padY = Math.round(size * 0.34), padX = Math.round(size * 0.22), S = 20;
  const m = p >= 1 ? undefined : `linear-gradient(to ${copy.ar ? 'left' : 'right'}, #000 ${p * (100 + S) - S}%, transparent ${p * (100 + S)}%)`;
  return <div data-event-progress={p} style={{position: 'relative', height: box, padding: `${padY}px ${padX}px`, margin: `${-padY}px ${-padX}px`, boxSizing: 'content-box', WebkitMaskImage: m, maskImage: m}}>
    <div style={{fontFamily: family, fontWeight: weight, fontSize: size, lineHeight: `${box}px`, color, whiteSpace: 'nowrap', direction: copy.dir,
      transform: `translateX(${(1 - p) * (copy.ar ? -10 : 10)}px)`, textShadow: '0 0 0.7px rgba(46,32,25,0.45)'}}>{text}</div>
  </div>;
};

export const InkBlock: React.FC<{L: InkLayout; top: number; at: number; per?: number; step?: number; color?: string; left?: number; width?: number; align?: 'right' | 'center' | 'left'; colors?: string[]}> =
  ({L, top, at, per = 20, step = 18, color = C.ink, left = X0, width = CW, align, colors}) => {
    const f = useCurrentFrame(), copy = useCopy();
    const aligned = align ?? copy.align;
    return <div style={{position: 'absolute', top, left, width, display: 'flex', flexDirection: 'column', alignItems: aligned === 'right' ? 'flex-end' : aligned === 'left' ? 'flex-start' : 'center'}}>
      {L.lines.map((line, i) => <InkLine key={i} text={line} size={L.size} box={L.box} family={L.family} weight={L.weight} color={colors?.[i] ?? color} p={ramp(f, at + i * step, per, pen)}/>)}
    </div>;
  };

/** Closed outline of a pen stroke: left edge forward, right edge back, widths per sample. */
export const ribbon = (pts: [number, number][], wd: number[]) => {
  const A: string[] = [], B: string[] = [];
  pts.forEach(([x, y], i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], n = Math.hypot(tx, ty) || 1, nx = -ty / n, ny = tx / n;
    A.push(`${(x + nx * wd[i] / 2).toFixed(1)} ${(y + ny * wd[i] / 2).toFixed(1)}`);
    B.push(`${(x - nx * wd[i] / 2).toFixed(1)} ${(y - ny * wd[i] / 2).toFixed(1)}`);
  });
  return `M${A.join(' L')} L${B.reverse().join(' L')} Z`;
};
export const polyline = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')}`;

/** A filled calligraphic stroke that is revealed along its own path by a round-capped mask, so the leading end reads as the pen tip. */
export const Stroke: React.FC<{pts: [number, number][]; wd: number[]; p: number; color: string; box: {x: number; y: number; w: number; h: number}; opacity?: number; streak?: string; seed?: number}> =
  ({pts, wd, p, color, box, opacity = 1, streak, seed = 3}) => {
    const id = uid(); const maxW = Math.max(...wd);
    const r = rng(seed);
    const streaks = streak ? Array.from({length: 4}, (_, k) => { const s = Math.floor(pts.length * (0.4 + r() * 0.3)), len = Math.floor(pts.length * (0.25 + r() * 0.3));
      const off = (k - 1.5) * 0.22; return polyline(pts.slice(s, s + len).map(([x, y], j) => [x, y + off * wd[s + j]] as [number, number])); }) : [];
    return <svg width={box.w} height={box.h} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} style={{position: 'absolute', left: box.x, top: box.y, overflow: 'visible', opacity}}>
      <defs><mask id={`m${id}`} maskUnits="userSpaceOnUse" x={box.x - 60} y={box.y - 60} width={box.w + 120} height={box.h + 120}>
        <path d={polyline(pts)} fill="none" stroke="#fff" strokeWidth={maxW * 2.6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p}/>
      </mask></defs>
      <g mask={`url(#m${id})`}>
        <path d={ribbon(pts, wd)} fill={color}/>
        {streaks.map((s, i) => <path key={i} d={s} fill="none" stroke={streak} strokeWidth={1.3} strokeLinecap="round" opacity={0.5}/>)}
      </g>
    </svg>;
  };

/** The brush rule under a claim. The pen lands on the right (blunt, full), drifts left and lifts off as a thin tail. */
export const BrushRule: React.FC<{left: number; top: number; w: number; h?: number; at: number; dur?: number; color?: string; seed?: number; streak?: string; opacity?: number; local?:boolean}> =
  ({left, top, w, h = 34, at, dur = 18, color = C.rust, seed = 4, streak = C.paper, opacity = 1, local=false}) => {
    const f = useCurrentFrame(), copy = useCopy();
    const p = ramp(f, at, dur, pen);
    const N = 54, r = rng(seed); const pts: [number, number][] = [], wd: number[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, cap = 0.045;
      pts.push([w * (1 - u), h * 0.5 + Math.sin(u * 2.7 + seed) * h * 0.11 - u * u * h * 0.2]);
      const capK = u < cap ? Math.sqrt(1 - Math.pow(1 - u / cap, 2)) : 1;
      wd.push(Math.max(1.4, h * capK * (0.1 + 0.9 * Math.pow(1 - u, 0.72)) * (1 + (r() - 0.5) * 0.16)));
    }
    return <div data-brush-local={local || undefined} style={{position: 'absolute', left: local?left:anchor(copy, left, w), top, width: w, height: h, transform: copy.ar ? undefined : 'scaleX(-1)'}}>
      {p > 0 ? <Stroke pts={pts} wd={wd} p={p} color={color} box={{x: 0, y: 0, w, h}} streak={streak} seed={seed} opacity={opacity}/> : null}
    </div>;
  };

/** Hand-drawn rounded rectangle path (slightly wobbly), drawn on with a dash. */
export const wobblyRect = (w: number, h: number, r: number, seed: number, amp = 2.4) => {
  const R = rng(seed); const j = () => (R() - 0.5) * amp * 2;
  return `M${r + j()} ${j()} L${w - r + j()} ${j()} Q${w + j()} ${j()} ${w + j()} ${r + j()} L${w + j()} ${h - r + j()} Q${w + j()} ${h + j()} ${w - r + j()} ${h + j()} L${r + j()} ${h + j()} Q${j()} ${h + j()} ${j()} ${h - r + j()} L${j()} ${r + j()} Q${j()} ${j()} ${r + 6 + j()} ${j() - 1}`;
};
export const PenBox: React.FC<{w: number; h: number; r?: number; at: number; dur?: number; color?: string; width?: number; seed?: number}> = ({w, h, r = 28, at, dur = 22, color = C.ink, width = 4, seed = 2}) => {
  const f = useCurrentFrame(); const p = ramp(f, at, dur, pen);
  return <svg width={w + 20} height={h + 20} viewBox={`-10 -10 ${w + 20} ${h + 20}`} style={{position: 'absolute', left: -10, top: -10, overflow: 'visible'}}>
    {[seed, seed + 9].map((s, i) => <path key={i} d={wobblyRect(w, h, r, s)} fill="none" stroke={color} strokeWidth={i ? width * 0.55 : width} strokeLinecap="round" strokeLinejoin="round"
      opacity={i ? 0.5 : 0.92} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01(p * (i ? 0.96 : 1))}/>)}
  </svg>;
};

/** A check drawn by the pen. */
export const Tick: React.FC<{at: number; size: number; color?: string; dur?: number; weight?: number}> = ({at, size, color = C.rust, dur = 10, weight = 11}) => {
  const f = useCurrentFrame(); const p = ramp(f, at, dur, pen);
  return <svg width={size} height={size} viewBox="0 0 100 100" style={{overflow: 'visible'}}>
    <path d="M17 54 C 25 60, 33 70, 40 80 C 52 52, 68 30, 90 14" fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p}/>
  </svg>;
};

// ---------- the seal ----------
/** Rust seal: double ring, a dotted ring, «مثال» in the centre. Stamps with a short scale-down and a 2-frame ink spread. It never claims authenticity. */
export const Seal: React.FC<{cx: number; cy: number; size: number; at: number; angle?: number; text?: string; color?: string; fontSize?: number}> =
  ({cx, cy, size, at, angle = -12, text, color = C.rust, fontSize = 88}) => {
    const copy = useCopy();
    const f = useCurrentFrame(); const id = uid();
    const s = f - at; if (s < 0) return null;
    const k = Easing.out(Easing.cubic)(clamp01(s / 5));
    const spread = clamp01(s / 2);
    const bloom = clamp01(s / 5);
    return <div style={{position: 'absolute', left: cx - size / 2, top: cy - size / 2, width: size, height: size, mixBlendMode: 'multiply',
      transform: `rotate(${angle + (1 - k) * -7}deg) scale(${mix(1.25, 1, k)})`, opacity: mix(0.3, 0.93, spread), filter: `blur(${(1 - spread) * 3.5}px)`}}>
      <svg width={size} height={size} viewBox="0 0 200 200" style={{overflow: 'visible'}}>
        <defs>
          <filter id={`s${id}`} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves={2} seed={11} result="n"/>
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -5.2 0 0 0 4.0" result="holes"/>
            <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves={2} seed={21} result="b"/>
            <feColorMatrix in="b" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.4 0 0 0 2.5" result="blot"/>
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={1} seed={4} result="w"/>
            <feDisplacementMap in="SourceGraphic" in2="w" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="d"/>
            <feComposite in="d" in2="holes" operator="in" result="d2"/>
            <feComposite in="d2" in2="blot" operator="in"/>
          </filter>
        </defs>
        <g filter={`url(#s${id})`} fill="none" stroke={color}>
          <circle cx="100" cy="100" r={94 + bloom * 3} strokeWidth={9 - bloom * 1.5} opacity={1 - 0.0 * bloom}/>
          <circle cx="100" cy="100" r="80" strokeWidth="3.2"/>
          <circle cx="100" cy="100" r="68" strokeWidth="3.4" strokeDasharray="0.1 8.2" strokeLinecap="round"/>
          <text x="100" y="126" textAnchor="middle" fontFamily={FONT.ruqaa} fontWeight={700} fontSize={fittedSize(text ?? receiptCopy(copy,'example'),FONT.ruqaa,700,fontSize,120)} fill={color} stroke="none">{text ?? receiptCopy(copy, 'example')}</text>
        </g>
      </svg>
    </div>;
  };

// ---------- receipt ----------
export const PAD = 38;
export type RRow = {h: number; node: React.ReactNode; gap?: number; at?: number};

export const mono = (size: number, extra: React.CSSProperties = {}): React.CSSProperties => ({fontFamily: FONT.mono, fontWeight: 600, fontSize: size, direction: 'ltr', unicodeBidi: 'isolate', ...extra});
export const naskh = (size: number, extra: React.CSSProperties = {}): React.CSSProperties => ({fontFamily: FONT.naskh, fontWeight: 700, fontSize: size, ...extra});

/** Thermal-paper strip. It grows downward from a slot, one row per `per` frames, with a zig-zag torn bottom and a tiny paper jitter while it prints. */
export type Ghost = {dx: number; dy?: number; rot: number; len: number; w?: number; tone?: string};
export const Receipt: React.FC<{rows: RRow[]; left: number; top: number; width?: number; start: number; per?: number; rot?: number; faded?: boolean; seed?: number; slot?: boolean; opacity?: number; origin?: string; ghosts?: Ghost[]}> =
  ({rows, left, top, width = 640, start, per = 4, rot = 0, faded, seed = 1, slot = true, opacity = 1, origin: _origin = '50% 0', ghosts = []}) => {
    const f = useCurrentFrame(),limit=useDesignBottom(),globalFit=useFitEnabled();
    const timing=useTiming();
    const HEAD = 24, FOOT = 40, TOOTH = 20, DEPTH = 12;
    let t = start; const times: number[] = [];
    rows.forEach((r) => { const at = timing.frame(r.at,t + (r.gap ?? 0)); times.push(at); t = at + per; });
    const lastEnd = Math.max(...times) + per;
    let printed = 0;
    rows.forEach((r, i) => { printed += r.h * Easing.out(Easing.quad)(clamp01((f - times[i]) / per)); });
    const E = HEAD + printed + FOOT * clamp01(printed / 14);
    const active = f >= start && f < lastEnd + 1;
    const jx = active ? Math.sin(f * 7.3 + seed) * 1.1 : 0, jr = active ? Math.sin(f * 5.1 + seed * 2) * 0.1 : 0;
    const nT = Math.round(width / TOOTH), tw = width / nT;
    const zig = Array.from({length: nT + 1}, (_, k) => `${((nT - k) * tw).toFixed(1)}px ${(E - (k % 2 ? DEPTH : 0)).toFixed(1)}px`);
    const poly = `polygon(0px 0px, ${width}px 0px, ${zig.join(', ')})`;
    const total = rows.reduce((s, r) => s + r.h, 0) + HEAD + FOOT + 20;
    const slotIn = ramp(f, start - 8, 8);
    const scale=globalFit?1:Math.max(.05,Math.min(1,(limit-top-24)/Math.max(1,total))); 
    return <div data-receipt-start={start} data-receipt-printed={printed} style={{position: 'absolute', left, top, width, transform: `translateX(${jx}px) rotate(${rot + jr}deg) scale(${scale})`, transformOrigin:'50% 0', opacity: opacity * (faded ? 0.8 : 1)}}>
      {ghosts.map((g, i) => <GhostStrip key={i} g={g} width={g.w ?? width} at={start + 4 + i * 5} seed={seed + i}/>)}
      {/* the shadow is its own blurred copy of the paper shape, so no filter ever sits above the text layer */}
      {printed > 0.5 ? <div style={{position: 'absolute', left: 0, top: 16, width, height: E, filter: 'blur(11px)', opacity: 0.30}}><div style={{width, height: E, clipPath: poly, background: '#3A2414'}}/></div> : null}
      {printed > 0.5 ? <div style={{position: 'absolute', left: 0, top: 2, width, height: E, filter: 'blur(1.6px)', opacity: 0.26}}><div style={{width, height: E, clipPath: poly, background: '#3A2414'}}/></div> : null}
      {printed > 0.5 ? <div style={{position: 'relative', width, height: E, clipPath: poly, background: C.thermal}}>
        <Tooth w={width} h={total} tooth={0.1} fibre={0} seed={seed + 20} tint={[0.45, 0.4, 0.33]}/>
        <div style={{position: 'absolute', left: 0, top: 0, width, height: 46, background: 'linear-gradient(180deg, rgba(60,40,24,0.20), rgba(60,40,24,0))'}}/>
        <div style={{position: 'absolute', left: 0, top: HEAD, width, color: C.ink}}>{rows.map((r, i) => <div key={i} data-receipt-row-at={times[i]} style={{height: r.h,opacity:f>=times[i]?1:0}}>{r.node}</div>)}</div>
      </div> : null}
      {slot ? <div style={{position: 'absolute', left: -32, top: -9, width: width + 64, height: 18, borderRadius: 9, opacity: slotIn,
        background: 'linear-gradient(180deg,#5c4a3e 0%,#2b1e17 55%,#1a110c 100%)', boxShadow: '0 7px 12px rgba(30,18,8,0.38), inset 0 1.5px 0 rgba(255,255,255,0.22)'}}/> : null}
    </div>;
  };

/** An older receipt half-hidden behind the live one: depth, and a hint that there is a stack of evidence. */
export const GhostStrip: React.FC<{g: Ghost; width: number; at: number; seed: number}> = ({g, width, at, seed}) => {
  const f = useCurrentFrame();
  const p = ramp(f, at, 18);
  const E = g.len * p;
  if (E < 4) return null;
  const nT = Math.round(width / 20), tw = width / nT;
  const zig = Array.from({length: nT + 1}, (_, k) => `${((nT - k) * tw).toFixed(1)}px ${(E - (k % 2 ? 12 : 0)).toFixed(1)}px`);
  const poly = `polygon(0px 0px, ${width}px 0px, ${zig.join(', ')})`;
  const r = rng(seed * 13);
  return <div style={{position: 'absolute', left: g.dx, top: g.dy ?? 4, width, height: E, transform: `rotate(${g.rot}deg)`, transformOrigin: '50% 0'}}>
    <div style={{position: 'absolute', left: 0, top: 14, width, height: E, filter: 'blur(10px)', opacity: 0.26}}><div style={{width, height: E, clipPath: poly, background: '#3A2414'}}/></div>
    <div style={{position: 'relative', width, height: E, clipPath: poly, background: g.tone ?? '#F6EEDC'}}>
      <Tooth w={width} h={g.len} tooth={0.12} fibre={0} seed={seed + 40} tint={[0.45, 0.4, 0.33]}/>
      {Array.from({length: 7}, (_, k) => <div key={k} style={{position: 'absolute', left: 36, right: 36 + ((r() * 90) | 0), top: 70 + k * 64, height: 0, borderTop: k % 3 === 2 ? '3px dashed rgba(46,32,25,0.20)' : '10px solid rgba(46,32,25,0.07)', borderRadius: 4}}/>)}
    </div>
  </div>;
};

export const dashRow = (h = 30, op = 0.42, pad = PAD, at?: number): RRow => ({h, at, node: <div style={{height: h, padding: `0 ${pad}px`, display: 'flex', alignItems: 'center'}}>
  <div style={{flex: 1, borderTop: `3px dashed rgba(46,32,25,${op})`}}/></div>});

export const lineRow = (o: {copy?: SceneCopy; label: React.ReactNode; value: React.ReactNode; h?: number; size?: number; labelColor?: string; valueColor?: string; pad?: number; at?: number; gap?: number; vsize?: number}): RRow => {
  const size = o.size ?? 38, h = o.h ?? 70, pad = o.pad ?? PAD;
  return {h, at: o.at, gap: o.gap, node: <div style={{height: h, padding: `0 ${pad}px`, display: 'flex', alignItems: 'center', direction: o.copy?.dir ?? 'rtl', gap: 14}}>
    <span style={naskh(size, {color: o.labelColor ?? C.ink, whiteSpace: 'nowrap'})}>{o.label}</span>
    <span style={{flex: 1, borderBottom: '3px dotted rgba(46,32,25,0.32)', transform: `translateY(${size * 0.28}px)`}}/>
    <span style={{...mono(o.vsize ?? size * 1.02), color: o.valueColor ?? C.ink, whiteSpace: 'nowrap'}}><DesignText>{o.value}</DesignText></span>
  </div>};
};

// ---------- caption ----------
/** The clause caption: boxless ink with a thin rust brush underline. Over footage it gets a torn slip of parchment so it stays readable. */
export const InkCaption: React.FC<{y: number; text: string; slip?: boolean}> = ({y, text, slip}) => {
  const copy = sceneCopy({text});
  const fit = one(text, {family: FONT.naskh, weight: 700, width: 788 - (slip ? 120 : 0), size: 46, min: 30});
  const tw = fit.width + 6;
  return <div style={{position: 'absolute', left: X0, top: y - 40, width: 853 - X0, height: 80, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
    {slip ? <div style={{position: 'absolute', left: (788 - tw - 90) / 2, top: -10, width: tw + 90, height: 100, transform: 'rotate(-0.8deg)', filter: 'drop-shadow(0 6px 10px rgba(30,18,8,0.45))'}}>
      <div style={{position: 'absolute', inset: 0, background: C.fringe, clipPath: `polygon(${slipEdge(tw + 90, 100)})`}}/>
      <div style={{position: 'absolute', inset: 3, background: C.paper, clipPath: `polygon(${slipEdge(tw + 84, 94)})`}}><Tooth w={tw + 90} h={100} tooth={0.18} fibre={0}/></div>
    </div> : null}
    <div style={{position: 'relative', fontFamily: FONT.naskh, fontWeight: 700, fontSize: fit.fontSize, lineHeight: '80px', color: C.ink, direction: copy.dir, whiteSpace: 'nowrap'}}>{text}
      <BrushRule left={-4} top={70} w={tw + 8} h={12} at={0} dur={1} seed={9}/></div>
  </div>;
};
export const slipEdge = (w: number, h: number) => {
  const r = rng(w), pts: string[] = [];
  for (let x = 0; x <= w; x += 14) pts.push(`${x}px ${(r() * 5).toFixed(1)}px`);
  for (let y = 0; y <= h; y += 14) pts.push(`${(w - r() * 4).toFixed(1)}px ${y}px`);
  for (let x = w; x >= 0; x -= 14) pts.push(`${x}px ${(h - r() * 5).toFixed(1)}px`);
  for (let y = h; y >= 0; y -= 14) pts.push(`${(r() * 4).toFixed(1)}px ${y}px`);
  return pts.join(', ');
};

// ---------- small shared pieces ----------
export const num = (n: number, digits = 0) => Number(n.toFixed(digits)).toLocaleString('en-US', {maximumFractionDigits: digits});
export const Kicker: React.FC<{text: string; top: number; at: number; right?: number; color?: string}> = ({text, top, at, right = W - X1, color = C.rust}) => {
  const f = useCurrentFrame(), copy = useCopy(); const p = ramp(f, at, 14, pen);
  return <div style={{position: 'absolute', top, [copy.side]: right, display: 'flex', alignItems: 'center', gap: 16, direction: copy.dir}}>
    <div style={{...naskh(34, {color, whiteSpace: 'nowrap', direction: copy.dir}), WebkitMaskImage: `linear-gradient(to ${copy.ar ? 'left' : 'right'}, #000 ${p * 130 - 30}%, transparent ${p * 130}%)`}}>{text}</div>
    <div style={{width: 58 * p, height: 5, background: color, borderRadius: 3}}/>
  </div>;
};

/** Rows made of mono blocks: each filled cell stands for 1/of of the scale. Cells appear left to right like printed characters. */
export const BlockBar: React.FC<{n: number; of: number; at: number; color: string; cell: number; pad?: number; rate?: number}> = ({n, of, at, color, cell, pad = PAD, rate = 1}) => {
  const f = useCurrentFrame();
  return <div style={{height: cell * 1.5, padding: `0 ${pad}px`, display: 'flex', alignItems: 'center', direction: 'ltr'}}>
    {Array.from({length: of}, (_, i) => {
      const on = i < n && f >= at + i * rate;
      return <div key={i} style={{width: cell, height: cell * 1.5, background: on ? color : 'rgba(46,32,25,0.10)', borderRight: `2px solid ${C.thermal}`}}/>;
    })}
  </div>;
};



Object.assign(Parchment,{designBackground:true});
