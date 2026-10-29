import {DesignText} from '../../../style-kit/digits';
import {FittedContent} from '../../../style-kit/content-fit';
import {displayWeight,displayLineHeight} from '../../../style-kit/design-safety';
import React from 'react';
import {AbsoluteFill, Easing, useCurrentFrame} from 'remotion';
import {fitOnLines, fitToBox, measure} from '../../../core/type';
import {SafeExempt} from '../../../core/safe';
import {useTypographyFont} from '../../../creative-kit/chapter-theme';
import type {SceneCopy} from '../../scene-copy';
import {ownSceneCopy as sceneCopy} from '../../../style-kit/design-safety';
import {styleCopy} from './copy';
export {ownSceneCopy as sceneCopy} from '../../../style-kit/design-safety';

import {PAPER_COLLAGE_PALETTE} from '../theme';
export const C = PAPER_COLLAGE_PALETTE;
const HEAD = 'Reem Kufi';
const Space = React.createContext(1080);
const DesignContext = React.createContext<{copy: SceneCopy; HEAD: string; sectionIndex?: number}>({copy: sceneCopy({lang: 'ar'}), HEAD});
export const DesignProvider: React.FC<{data: unknown; sectionIndex?: number; children: React.ReactNode}> = ({data, sectionIndex, children}) => {
  const font = useTypographyFont(), copy = sceneCopy(data);
  return <DesignContext.Provider value={{copy, HEAD: font ?? HEAD, sectionIndex}}><Space.Provider value={1080}><div data-paper-design="paper-collage" style={{position: 'absolute', inset: 0, direction: copy.dir, textAlign: copy.align}}>{children}</div></Space.Provider></DesignContext.Provider>;
};
export const useKit = () => {const context = React.useContext(DesignContext); return {...context, word: styleCopy(context.copy.ar)};};
export const showOffcuts = (index?: number) => index === undefined || index % 3 === 1;
export const BODY = 'Tajawal';
export const LAT = 'Source Serif 4';
export const W = 1080;
export const X1 = 1015; // right content edge (65 px margin)

// ---------- small helpers ----------
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const expo = Easing.bezier(0.16, 1, 0.3, 1);
export const OUT3 = Easing.out(Easing.cubic);
export const INOUT3 = Easing.inOut(Easing.cubic);
export const BACK = Easing.out(Easing.back(1.5));
export const ramp = (f: number, at: number, dur: number, ease: (t: number) => number = expo) => ease(clamp01((f - at) / Math.max(1, dur)));
export const num = (n: number) => Math.round(n).toLocaleString('en-US');

export const hexRgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
/** Mix a hex colour toward white: the lighter line of a paper cut. */
export const lighten = (c: string, a: number) => { const [r, g, b] = hexRgb(c).map((v) => Math.round(v + (255 - v) * a)); return `rgb(${r},${g},${b})`; };

const warned = new Set<string>();
export const warnOnce = (warning: string) => {
  if (warned.has(warning)) return;
  if (warned.size >= 256) warned.clear();
  warned.add(warning);
  console.warn(warning);
};
export const fit = (text: string, o: {width: number; size: number; min: number; lines: number; weight: number; family: string; lh?: number}) => {
  const descriptor = {fontFamily: o.family, fontSize: o.size, fontWeight: displayWeight(o.family,HEAD,o.weight)};
  const bounds = {maxBoxWidth: o.width, maxLines: o.lines, min: o.min, max: o.size, lineHeight: displayLineHeight(o.family,HEAD,o.lh ?? 1.2)};
  let r = fitOnLines(text, descriptor, bounds);
  const fits = r.fits;
  if (!fits) {
    r = fitToBox(text, descriptor, {...bounds, fontSize: o.min});
    const warning = 'paper-collage fit-warning: ' + JSON.stringify({text, width: o.width, size: o.min, lines: o.lines, font: o.family});
    warnOnce(warning);
  }
  return {size: r.fontSize, lines: r.lines, box: r.lineBox, fits};
};
export const textW = (text: string, family: string, size: number, weight: number) => measure(text, {fontFamily: family, fontSize: size, fontWeight: weight}).width;

// ---------- seeded geometry: every cut edge is stable across frames ----------
export type Pt = [number, number];
export const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const rng = (seed: string) => {
  let a = hash(seed);
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
export const pstr = (pts: Pt[]) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

/** Scissor cut: every vertex is nudged a little and long edges get a kink, so no edge is a perfect line. */
export const cut = (verts: Pt[], seed: string, amp = 2.2, step = 90): Pt[] => {
  const r = rng(seed + ':cut');
  const out: Pt[] = [];
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i], b = verts[(i + 1) % verts.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const segs = Math.max(1, Math.round(len / step));
    for (let k = 0; k < segs; k++) {
      if (k === 0) out.push([a[0] + (r() * 2 - 1) * amp * 0.8, a[1] + (r() * 2 - 1) * amp * 0.8]);
      else { const o = (r() * 2 - 1) * amp, t = k / segs; out.push([a[0] + dx * t + nx * o, a[1] + dy * t + ny * o]); }
    }
  }
  return out;
};

export type Shape = {pts: Pt[]; fringe?: Pt[]; fringeColor?: string; hairs?: [Pt, Pt][]; edgeColor?: string};
export type ShapeFn = (w: number, h: number, id: string) => Shape;

/** A rectangle cut with scissors; `slant` tips the ends a few pixels so a strip never looks machine-made. */
export const rectShape = (slant = 0, amp = 2.2, step = 90): ShapeFn => (w, h, id) => {
  const r = rng(id + ':rect');
  const a = r() * slant, b = r() * slant, c = r() * slant, d = r() * slant;
  return {pts: cut([[a, 0], [w - b, 0], [w - c, h], [d, h]], id, amp, step)};
};
/** Rectangle with torn sides ('t','r','b','l'): evidence only. A torn edge is a rough face line, a paler fibre core just outside it, and loose fibres sticking out. */
export const tornShape = (sides: string, amp = 6.5, fringeOut = 9): ShapeFn => (w, h, id) => {
  const keys = ['t', 'r', 'b', 'l'];
  const verts: Pt[] = [[0, 0], [w, 0], [w, h], [0, h]];
  const hairsOut: [Pt, Pt][] = [];
  const make = (seed: string, out: number, a: number, hairy: boolean) => {
    const r = rng(seed);
    const pts: Pt[] = [];
    for (let i = 0; i < 4; i++) {
      const A = verts[i], B = verts[(i + 1) % 4];
      const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = uy, ny = -ux;
      const torn = sides.includes(keys[i]);
      const n = Math.max(1, Math.round(len / (torn ? 5 : 100)));
      let v = 0, drift = 0;
      for (let k = 0; k < n; k++) {
        const t = k / n;
        let o: number;
        if (torn) { v = v * 0.5 + (r() * 2 - 1) * a * 0.7; drift = drift * 0.94 + (r() * 2 - 1) * a * 0.2; o = v + drift + out; } else o = (r() * 2 - 1) * 1.8;
        const p: Pt = [A[0] + dx * t + nx * o, A[1] + dy * t + ny * o];
        pts.push(p);
        if (hairy && torn && r() < 0.6) {
          const ang = (r() * 2 - 1) * 0.85, ca = Math.cos(ang), sa = Math.sin(ang), L = 9 + r() * 20;
          const dirx = nx * ca - ny * sa, diry = nx * sa + ny * ca;
          hairsOut.push([[p[0] - dirx * 2, p[1] - diry * 2], [p[0] + dirx * L, p[1] + diry * L]]);
        }
      }
    }
    return pts;
  };
  const pts = make(id + ':torn', 0, amp, true);
  const fringe = make(id + ':fringe', fringeOut, amp * 0.9, false);
  return {pts, fringe, fringeColor: '#EFEADA', hairs: hairsOut, edgeColor: 'rgba(140,120,85,0.5)'};
};
/** A slip whose top-left corner has been torn off. */
export const cornerTornShape = (cs = 74): ShapeFn => (w, h, id) => {
  const hairsOut: [Pt, Pt][] = [];
  const diag = (seed: string, out: number, a: number, hairy: boolean) => {
    const r = rng(seed); const pts: Pt[] = []; const n = 16; let v = 0;
    for (let k = 0; k <= n; k++) {
      const t = k / n; v = v * 0.5 + (r() * 2 - 1) * a; const o = v + out;
      const p: Pt = [cs * t - o * 0.707, cs * (1 - t) - o * 0.707];
      pts.push(p);
      if (hairy && r() < 0.6) { const L = 8 + r() * 16, ang = (r() * 2 - 1) * 0.8; hairsOut.push([[p[0], p[1]], [p[0] - Math.cos(0.785 + ang) * L, p[1] - Math.sin(0.785 + ang) * L]]); }
    }
    return pts;
  };
  const base = (seed: string): Pt[] => { const r = rng(seed); const j = () => (r() * 2 - 1) * 1.6; return [[cs + j(), j()], [w + j(), j()], [w + j(), h + j()], [j(), h + j()]]; };
  return {pts: [...base(id + ':cb'), ...diag(id + ':cd', 0, 4.4, true)], fringe: [...base(id + ':cb'), ...diag(id + ':cf', 7, 3.6, false)], fringeColor: '#EFEADA', hairs: hairsOut, edgeColor: 'rgba(140,120,85,0.5)'};
};
export const polyShape = (build: (w: number, h: number, id: string) => Pt[], amp = 1.5, step = 9999): ShapeFn => (w, h, id) => ({pts: cut(build(w, h, id), id, amp, step)});

export const archVerts = (w: number, h: number): Pt[] => {
  const r = w / 2; const pts: Pt[] = [[0, h]];
  for (let i = 0; i <= 28; i++) { const a = Math.PI + (Math.PI * i) / 28; pts.push([r + r * Math.cos(a), r + r * Math.sin(a)]); }
  pts.push([w, h]); return pts;
};
export const circleVerts = (w: number, h: number): Pt[] => Array.from({length: 40}, (_, i) => { const a = (Math.PI * 2 * i) / 40; return [w / 2 + (w / 2) * Math.cos(a), h / 2 + (h / 2) * Math.sin(a)] as Pt; });
const CHECK: Pt[] = [[2, 58], [20, 40], [38, 58], [80, 8], [98, 26], [38, 96]];
export const checkVerts = (w: number, h: number): Pt[] => CHECK.map(([x, y]) => [(x * w) / 100, (y * h) / 100] as Pt);
export const bubbleVerts = (tail: {x: number; w: number; tip: Pt}, r = 70) => (w: number, h: number): Pt[] => {
  const pts: Pt[] = [];
  const arc = (cx: number, cy: number, a0: number, a1: number) => { for (let i = 0; i <= 7; i++) { const a = ((a0 + ((a1 - a0) * i) / 7) * Math.PI) / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  arc(r, r, 180, 270); arc(w - r, r, 270, 360); arc(w - r, h - r, 0, 90);
  pts.push([tail.x + tail.w, h], tail.tip, [tail.x, h]);
  arc(r, h - r, 90, 180);
  return pts;
};
/** A hill: a smooth wavy top (stable, from the id) over a flat cut bottom. */
export const hillVerts = (seed: string, base: number, a1: number, a2: number, taperL = 0) => (w: number, h: number): Pt[] => {
  const r = rng(seed); const p1 = r() * 6, p2 = r() * 6; const pts: Pt[] = [[0, h]];
  for (let x = 0; x <= w; x += 26) {
    let y = base + a1 * Math.sin(x / (w / 4.2) + p1) + a2 * Math.sin(x / (w / 11) + p2);
    if (taperL) { const t = clamp01(x / (w * taperL)); y = h - (h - y) * (t * t * (3 - 2 * t)); } // the hill rises out of the bottom edge
    pts.push([x, y]);
  }
  pts.push([w, h]); return pts;
};

// ---------- paper material ----------
/** Shared SVG filters: a fine tooth, a faint fibre and a hand-cut wobble for cut-out numerals. Defined once per scene. */
export const PaperDefs: React.FC = () => <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden>
  <defs>
    <filter id="rs-tooth" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="11" result="n"/>
      <feColorMatrix in="n" type="matrix" values="2.3 0 0 0 -0.65  2.3 0 0 0 -0.65  2.3 0 0 0 -0.65  0 0 0 0 1" result="g"/>
      <feComposite in="g" in2="SourceGraphic" operator="in"/>
    </filter>
    <filter id="rs-fibre" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.035 0.55" numOctaves="2" seed="23" result="n"/>
      <feColorMatrix in="n" type="matrix" values="2.6 0 0 0 -0.8  2.6 0 0 0 -0.8  2.6 0 0 0 -0.8  0 0 0 0 1" result="g"/>
      <feComposite in="g" in2="SourceGraphic" operator="in"/>
    </filter>
    <filter id="rs-rough" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed="5" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="7" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>
</svg>;

/** Stone paper: fine tooth, a few faint fibres, and a very soft lamp falloff. No blotches. */
export const Ground: React.FC<{color?: string}> = ({color = C.ground}) => <AbsoluteFill style={{background: color}}>
  <svg width={W} height={1920} style={{position: 'absolute', inset: 0}}>
    <rect width={W} height={1920} fill="#fff" filter="url(#rs-tooth)" style={{mixBlendMode: 'overlay'}} opacity={0.5}/>
    <rect x={-400} y={-400} width={1880} height={2720} fill="#fff" filter="url(#rs-fibre)" style={{mixBlendMode: 'overlay'}} opacity={0.34} transform="rotate(-19 540 960)"/>
  </svg>
  <AbsoluteFill style={{background: 'radial-gradient(95% 52% at 20% 6%, rgba(255,255,255,0.26), rgba(255,255,255,0) 70%)'}}/>
</AbsoluteFill>;

export const Stage: React.FC<{children: React.ReactNode; ground?: boolean; offcuts?: {family: string; colors: [string, string, string]}}> = ({children, ground = true, offcuts}) => {
  const {sectionIndex} = useKit();
  return <AbsoluteFill><PaperDefs/>{ground ? <SafeExempt><Ground/></SafeExempt> : null}{offcuts && showOffcuts(sectionIndex) ? <SafeExempt><Offcuts family={offcuts.family} colors={offcuts.colors}/></SafeExempt> : null}<FittedContent native="Reem Kufi">{children}</FittedContent></AbsoluteFill>;
};

/** The two layered shadows of the style. `lift` (1 = in the air, 0 = flat on the paper) loosens them; `depth` is how far the piece sits above what is under it. */
export const shadowFilter = (lift: number, depth: number, tight = false) => {
  if (tight) return 'drop-shadow(0 2px 3px rgba(0,0,0,0.24))';
  const t = `drop-shadow(0 ${2 + 5 * lift}px ${3 + 5 * lift}px rgba(0,0,0,0.18))`;
  const s = `drop-shadow(0 ${18 * depth + 22 * lift}px ${30 * depth + 22 * lift}px rgba(0,0,0,0.14))`;
  return `${t} ${s}`;
};

export type Enter = {at: number; from?: [number, number]; rot?: number; dur?: number; arc?: number};
/** A second move after landing: the piece rests at `from` (relative to its final spot) and slides home. */
export type Track = {at: number; dur: number; from: [number, number]; rot?: number; lift?: number};
type PieceProps = {
  id: string; x: number; y: number; w: number; h: number; rot?: number; color: string; shape?: ShapeFn; enter: Enter; track?: Track;
  dir?: 'rtl' | 'ltr'; railSafe?: boolean;
  depth?: number; z?: number; tooth?: number; edge?: boolean; noShadow?: boolean; tight?: boolean; children?: React.ReactNode;
};

/** One cut-paper piece: irregular polygon, tooth, lighter cut edge, two layered shadows, and a hand-placed landing. */
export const Piece: React.FC<PieceProps> = (p) => {
  const f = useCurrentFrame();
  const {copy} = useKit();
  const space = React.useContext(Space), ar = (p.dir ?? copy.dir) === 'rtl', sign = ar ? 1 : -1;
  const mirroredX = ar ? p.x : space - p.x - p.w;
  // The Instagram rail stays on the physical right in both languages.
  const x = p.railSafe ? Math.min(mirroredX, 844 - p.w) : mirroredX;
  const en = p.enter;
  const dur = en.dur ?? 14;
  const t = clamp01((f - en.at) / dur);
  const e = OUT3(t);
  const sgn = rng(p.id + ':dir')() > 0.5 ? 1 : -1;
  const [fx, fy] = en.from ?? [0, -120];
  const dist = Math.hypot(fx, fy) || 1;
  const bulge = Math.sin(Math.PI * t) * (en.arc ?? 0.14) * dist * sgn;
  const ex = fx * (1 - e) + (-fy / dist) * bulge;
  const ey = fy * (1 - e) + (fx / dist) * bulge;
  const rotOff = (en.rot ?? sgn * 8) * (1 - BACK(t));
  const sc = 1 + 0.04 * (1 - e);
  const tr = p.track;
  const u = tr ? clamp01((f - tr.at) / tr.dur) : 1;
  const eu = INOUT3(u);
  const mx = tr ? tr.from[0] * (1 - eu) : 0, my = tr ? tr.from[1] * (1 - eu) : 0, mr = tr ? (tr.rot ?? 0) * (1 - eu) : 0;
  const carry = tr && u > 0 && u < 1 ? Math.sin(Math.PI * u) * (tr.lift ?? 0.8) : 0;
  const landLift = f < en.at + dur ? 1 - clamp01((f - (en.at + dur - 4)) / 4) : 0;
  const lift = Math.max(landLift, carry);
  const shape = (p.shape ?? rectShape(0))(p.w, p.h, p.id);
  const edgeC = lighten(p.color, 0.5);
  const opacity = f < en.at ? 0 : clamp01((f - en.at) / 3);
  return <div data-paper-id={p.id} data-cue-at={en.at} data-event-progress={e} data-track-progress={eu} style={{position: 'absolute', left: x, top: p.y, width: p.w, height: p.h, zIndex: p.z ?? 1, opacity,
    transform: `translate(${sign * (ex + mx)}px, ${ey + my}px) rotate(${sign * ((p.rot ?? 0) + rotOff + mr)}deg) scale(${sc})`}}>
    <svg width={p.w} height={p.h} viewBox={`0 0 ${p.w} ${p.h}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', filter: p.noShadow ? undefined : shadowFilter(lift, p.depth ?? 1, p.tight)}}>
      {shape.fringe ? <polygon points={pstr(shape.fringe)} fill={shape.fringeColor ?? '#EEE9D8'} stroke="rgba(120,100,70,0.35)" strokeWidth={1} strokeLinejoin="round"/> : null}
      {shape.hairs ? shape.hairs.map((hr, i) => <g key={i}><line x1={hr[0][0]} y1={hr[0][1]} x2={hr[1][0]} y2={hr[1][1]} stroke="rgba(110,90,55,0.55)" strokeWidth={2.4} strokeLinecap="round"/><line x1={hr[0][0]} y1={hr[0][1]} x2={hr[1][0]} y2={hr[1][1]} stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" opacity={0.98}/></g>) : null}
      <polygon points={pstr(shape.pts)} fill={p.color}/>
      <polygon points={pstr(shape.pts)} fill="#fff" filter="url(#rs-tooth)" style={{mixBlendMode: 'overlay'}} opacity={p.tooth ?? 0.3}/>
      {p.edge === false ? null : <polygon points={pstr(shape.pts)} fill="none" stroke={shape.edgeColor ?? edgeC} strokeWidth={1.5} strokeLinejoin="round" opacity={0.85}/>}
    </svg>
    <Space.Provider value={p.w}>{p.children}</Space.Provider>
  </div>;
};

/** Masking tape: translucent, torn zig-zag ends, a slight rotation; it stretches in from one end after the piece has landed. Local to a piece. */
export const Tape: React.FC<{cx: number; cy: number; len?: number; h?: number; rot?: number; at: number; from?: 'l' | 'r'; id: string; children?: React.ReactNode}> = (p) => {
  const f = useCurrentFrame();
  const {copy} = useKit();
  const space = React.useContext(Space);
  const len = p.len ?? 190, h = p.h ?? 56;
  const k = ramp(f, p.at, 7, Easing.out(Easing.quad));
  if (k <= 0) return null;
  const r = rng(p.id + ':tape');
  const teeth = 6, amp = 5;
  const pts: Pt[] = [];
  for (let i = 0; i <= teeth; i++) pts.push([(i % 2 ? 0 : amp) + r() * 1.5, (h * i) / teeth]);
  for (let i = teeth; i >= 0; i--) pts.push([len - (i % 2 ? 0 : amp) - r() * 1.5, (h * i) / teeth]);
  return <div style={{position: 'absolute', left: (copy.ar ? p.cx : space - p.cx) - len / 2, top: p.cy - h / 2, width: len, height: h, zIndex: 20, transform: `rotate(${(copy.ar ? 1 : -1) * (p.rot ?? 0)}deg)`, filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.22))'}}>
    <div style={{position: 'absolute', inset: 0, transformOrigin: (p.from === 'r') === copy.ar ? '100% 50%' : '0% 50%', transform: `scaleX(${k})`}}>
      <svg width={len} height={h} viewBox={`0 0 ${len} ${h}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <polygon points={pstr(pts)} fill="rgba(240,228,190,0.75)" stroke="rgba(255,251,228,0.75)" strokeWidth={1}/>
        <line x1={8} x2={len - 8} y1={h * 0.3} y2={h * 0.3} stroke="rgba(160,130,60,0.12)" strokeWidth={1}/>
        <line x1={8} x2={len - 8} y1={h * 0.7} y2={h * 0.7} stroke="rgba(160,130,60,0.12)" strokeWidth={1}/>
      </svg>
      {p.children && k > 0.9 ? <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{p.children}</div> : null}
    </div>
  </div>;
};

// ---------- text ----------
export const Txt: React.FC<{text: string; top: number; right?: number; left?: number; width?: number; size: number; family?: string; weight?: number; color?: string;
  align?: 'right' | 'left' | 'center'; lh?: number; dir?: 'rtl' | 'ltr'; style?: React.CSSProperties}> = (p) => {
  const {copy} = useKit();
  return <div style={{position: 'absolute', top: p.top, right: copy.ar ? p.right : p.left, left: copy.ar ? p.left : p.right, width: p.width, textAlign: p.align ?? copy.align, direction: p.dir ?? copy.dir,
    fontFamily: p.family ?? BODY, fontWeight: displayWeight(p.family ?? HEAD,'Reem Kufi',p.weight ?? 700), fontSize: p.size, lineHeight: `${p.lh ?? Math.round(p.size * 1.25)}px`, color: p.color ?? C.ink, whiteSpace: 'nowrap', ...p.style}}><DesignText>{p.text}</DesignText></div>;
};

/** Text centred in a piece. The line box equals the piece height so Arabic dots and hamzas are never cut. */
export const PieceText: React.FC<{text: string; h: number; w?: number; size: number; family?: string; weight?: number; color?: string; dy?: number; ls?: number; dir?: 'rtl' | 'ltr'}> = (p) => {
  const {copy, HEAD} = useKit();
  return <div style={{position: 'absolute', left: 0, top: p.dy ?? 0, width: p.w ?? '100%', height: p.h, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: p.dir ?? copy.dir,
    fontFamily: p.family ?? HEAD, fontWeight: p.weight ?? 700, fontSize: p.size, lineHeight: `${p.h}px`, color: p.color ?? C.ink, whiteSpace: 'nowrap', letterSpacing: p.ls}}><DesignText>{p.text}</DesignText></div>;
};

/** A word pasted on its own cut-paper piece, inline in a headline. */
const KeySlot: React.FC<{word: string; size: number; box: number; at: number; color: string; ink: string; id: string; rot?: number}> = (p) => {
  const {HEAD} = useKit();
  const w = Math.round(textW(p.word, HEAD, p.size, displayWeight(HEAD,'Reem Kufi',700)));
  const padX = Math.round(p.size * 0.24);
  const sw = w + padX * 2;
  const ph = p.box;
  return <span style={{position: 'relative', display: 'inline-block', width: sw, height: p.box, verticalAlign: 'top', margin: `0 ${-Math.round(p.size * 0.03)}px`}}>
    <Space.Provider value={sw}><Piece id={p.id} x={0} y={Math.round(p.box * 0.06)} w={sw} h={ph} rot={p.rot ?? -1.8} color={p.color} shape={rectShape(8)} enter={{at: p.at, from: [0, -110], rot: 7, dur: 13}} depth={0.5} z={4}>
      <PieceText text={p.word} h={ph} size={p.size} color={p.ink} dy={-Math.round(p.size * 0.03)}/>
    </Piece></Space.Provider>
  </span>;
};

/** Ink headline in Reem Kufi; whole lines rise in, and one key word is pasted on its own piece. */
export const Headline: React.FC<{text: string; top: number; at: number; size?: number; min?: number; lines?: number; width?: number; right?: number; color?: string;
  keyWord?: string; keyColor?: string; keyInk?: string; stagger?: number; lh?: number; id: string; align?: 'right' | 'center' | 'left'}> = (p) => {
  const f = useCurrentFrame();
  const {copy, HEAD} = useKit();
  const width = p.width ?? 950;
  const t = fit(p.text, {width: width - (p.keyWord ? Math.round((p.size ?? 128) * 0.5) : 0), size: p.size ?? 128, min: p.min ?? 96, lines: p.lines ?? 2, weight: 700, family: HEAD, lh: p.lh ?? 1.14});
  return <div style={{position: 'absolute', top: p.top, [copy.side]: p.right ?? W - X1, width, direction: copy.dir, zIndex: 5}}>
    {t.lines.map((line, i) => {
      const start = p.at + i * (p.stagger ?? 5);
      const k = ramp(f, start, 16);
      const words = line.split(' ');
      return <div key={i} style={{position: 'relative', height: t.box, lineHeight: `${t.box}px`, fontSize: t.size, fontFamily: HEAD, fontWeight: displayWeight(HEAD,'Reem Kufi',700), color: p.color ?? C.ink,
        whiteSpace: 'nowrap', textAlign: p.align ?? copy.align, opacity: clamp01(k * 2.2), transform: `translateY(${(1 - k) * 34}px)`}}>
        {words.map((wd, j) => <React.Fragment key={j}>{j > 0 ? ' ' : null}
          {wd === p.keyWord ? <KeySlot word={wd} size={t.size} box={t.box} at={start + 8} color={p.keyColor ?? C.mustard} ink={p.keyInk ?? C.ink} id={`${p.id}-key`}/> : wd}</React.Fragment>)}
      </div>;
    })}
  </div>;
};
export const headBox = (text: string, o: {size?: number; min?: number; lines?: number; width?: number; key?: boolean}, family = HEAD) =>
  fit(text, {width: (o.width ?? 950) - (o.key ? Math.round((o.size ?? 128) * 0.5) : 0), size: o.size ?? 128, min: o.min ?? 96, lines: o.lines ?? 2, weight: 700, family, lh: 1.14});

/** A small taped label (kicker). */
export const Kicker: React.FC<{text: string; x: number; y: number; at: number; right?: boolean; color?: string; ink?: string; rot?: number; id: string}> = (p) => {
  const tw = Math.round(textW(p.text, BODY, 40, 700)) + 76;
  const x = p.right ? p.x - tw : p.x;
  return <Piece id={p.id} x={x} y={p.y} w={tw} h={74} rot={p.rot ?? -2.4} color={p.color ?? C.card} shape={rectShape(6)} enter={{at: p.at, from: [140, -40], dur: 14}} depth={0.6} z={6}>
    <PieceText text={p.text} h={74} size={40} family={BODY} weight={700} color={p.ink ?? C.ink} dy={-1}/>
    <Tape cx={22} cy={22} len={90} h={38} rot={-32} at={p.at + 16} id={p.id}/>
  </Piece>;
};

/** Takeover caption: an off-white cut label with a tape strip on one end. Static (it is a stand-in for the real caption). */
export const PaperLabelCaption: React.FC<{y: number; text: string}> = ({y, text}) => {
  const size = 44;
  const tw = Math.min(776, Math.round(textW(text, BODY, size, 700)) + 88);
  const left = 65 + (788 - tw) / 2;
  return <Piece id="caption" x={left} y={y - 50} w={tw} h={100} rot={-1.1} color={C.card} shape={rectShape(5)} enter={{at: -100}} depth={0.7} z={30}>
    <PieceText text={text} h={100} size={size} family={BODY} weight={700} color={C.ink} dy={-1}/>
    <Tape cx={tw - 26} cy={10} len={104} h={44} rot={32} at={-100} id="caption"/>
  </Piece>;
};



export const CutNumeral: React.FC<{text: string; size: number; color: string; lift?: number; style?: React.CSSProperties}> = (p) =>
  <span style={{fontFamily: LAT, fontWeight: 700, fontSize: p.size, lineHeight: 1, color: p.color, WebkitTextStroke: `2.5px ${lighten(p.color, 0.5)}`, paintOrder: 'stroke fill', whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums', direction: 'ltr', filter: `url(#rs-rough) ${shadowFilter(p.lift ?? 0, 0.55)}`, ...p.style}}><DesignText>{p.text}</DesignText></span>;


export const RingPiece: React.FC<{id: string; x: number; y: number; w: number; h: number; t: number; color: string; scale?: number; z?: number}> = (p) => {
  const r = rng(p.id + ':ring');
  const j = () => (r() * 2 - 1) * 1.5;
  const outer: Pt[] = [[j(), j()], [p.w + j(), j()], [p.w + j(), p.h + j()], [j(), p.h + j()]];
  const inner: Pt[] = [[p.t + j(), p.t + j()], [p.w - p.t + j(), p.t + j()], [p.w - p.t + j(), p.h - p.t + j()], [p.t + j(), p.h - p.t + j()]];
  const dd = (pts: Pt[]) => 'M' + pts.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' L') + ' Z';
  const path = dd(outer) + ' ' + dd(inner);
  return <div style={{position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h, zIndex: p.z ?? 3, transform: `scale(${p.scale ?? 1})`, filter: shadowFilter(0, 0, true)}}>
    <svg width={p.w} height={p.h} viewBox={`0 0 ${p.w} ${p.h}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <path d={path} fill={p.color} fillRule="evenodd"/>
      <path d={path} fill="#fff" fillRule="evenodd" filter="url(#rs-tooth)" style={{mixBlendMode: 'overlay'}} opacity={0.3}/>
      <path d={path} fill="none" stroke={lighten(p.color, 0.5)} strokeWidth={1.5} opacity={0.85}/>
    </svg>
  </div>;
};

/** Offcuts of the sheet the pieces were cut from, left along the table edge below and above the working area (decoration only, nothing important sits there). */
const halfDiscVerts = (w: number, h: number): Pt[] => { const r = w / 2; const pts: Pt[] = [[0, h]]; for (let i = 0; i <= 30; i++) { const a = Math.PI + (Math.PI * i) / 30; pts.push([r + r * Math.cos(a), h + (h) * Math.sin(a)]); } pts.push([w, h]); return pts; };
const triVerts = (w: number, h: number): Pt[] => [[0, h], [w, h], [w * 0.28, 0]];
const pillVerts = (w: number, h: number): Pt[] => { const r = h / 2; const pts: Pt[] = []; for (let i = 0; i <= 12; i++) { const a = (-Math.PI / 2) + (Math.PI * i) / 12; pts.push([w - r + r * Math.cos(a), r + r * Math.sin(a)]); } for (let i = 0; i <= 12; i++) { const a = Math.PI / 2 + (Math.PI * i) / 12; pts.push([r + r * Math.cos(a), r + r * Math.sin(a)]); } return pts; };
const quarterVerts = (w: number, h: number): Pt[] => { const pts: Pt[] = [[0, h]]; for (let i = 0; i <= 26; i++) { const a = (Math.PI / 2) * (i / 26); pts.push([w * Math.sin(a), h - h * Math.cos(a)]); } return pts; };
/** Offcuts left on the lower table edge. Six different shape families (strip pair, half circle, triangles, torn band, quarter circle, pills); each group stays under ~340 px tall. */
const Offcuts: React.FC<{family: string; colors: [string, string, string]}> = ({family, colors: [c0, c1, c2]}) => {
  const base = {depth: 1, z: 0};
  const circ = polyShape(circleVerts, 2);
  const pill = polyShape(pillVerts, 1.5);
  switch (family) {
    case 'strips': return <>
      <Piece id="oc-s1" x={-60} y={1690} w={780} h={78} rot={-9} color={c0} shape={rectShape(14)} enter={{at: 2, from: [-320, 40], dur: 16}} {...base}>
        <Tape cx={70} cy={34} len={110} h={44} rot={-28} at={26} id="oc-s1t"/>
      </Piece>
      <Piece id="oc-s2" x={170} y={1750} w={700} h={78} rot={6} color={c1} shape={rectShape(14)} enter={{at: 8, from: [320, 50], dur: 16}} {...base} z={1}>
        <Tape cx={630} cy={30} len={110} h={44} rot={30} at={34} from="r" id="oc-s2t"/>
      </Piece>
      <Piece id="oc-s3" x={40} y={1830} w={440} h={66} rot={2} color={c2} shape={rectShape(12)} enter={{at: 14, from: [-200, 70], dur: 15}} {...base}/>
    </>;
    case 'half': return <>
      <Piece id="oc-h1" x={30} y={1630} w={640} h={290} color={c0} shape={polyShape(halfDiscVerts, 2)} enter={{at: 2, from: [0, 260], dur: 18, rot: 2}} {...base}/>
      <Piece id="oc-h2" x={470} y={1590} w={170} h={170} color={c1} shape={circ} enter={{at: 8, from: [130, -170], dur: 16}} {...base} z={1}/>
      <Piece id="oc-h3" x={430} y={1800} w={410} h={62} rot={-6} color={c2} shape={rectShape(12)} enter={{at: 12, from: [260, 60], dur: 15}} {...base} z={1}>
        <Tape cx={26} cy={30} len={96} h={40} rot={-30} at={32} id="oc-h3t"/>
      </Piece>
    </>;
    case 'tri': return <>
      <Piece id="oc-t1" x={20} y={1610} w={470} h={310} color={c0} shape={polyShape(triVerts, 1.8)} enter={{at: 2, from: [-200, 200], dur: 18, rot: -5}} {...base}/>
      <Piece id="oc-t2" x={380} y={1670} w={360} h={250} rot={4} color={c1} shape={polyShape((w, h) => triVerts(w, h).map(([x, y]) => [w - x, y] as Pt), 1.8)} enter={{at: 8, from: [220, 160], dur: 18, rot: 5}} {...base} z={1}/>
      <Piece id="oc-t3" x={650} y={1740} w={130} h={130} color={c2} shape={circ} enter={{at: 14, from: [100, 120], dur: 14}} {...base} z={1}/>
    </>;
    case 'torn': return <>
      <Piece id="oc-b1" x={-30} y={1710} w={880} h={260} color={c0} shape={tornShape('t', 6.5, 9)} enter={{at: 2, from: [0, 240], dur: 18}} {...base}/>
      <Piece id="oc-b2" x={330} y={1668} w={420} h={120} rot={-4} color={c1} shape={pill} enter={{at: 10, from: [200, 80], dur: 16}} {...base} z={1}>
        <Tape cx={60} cy={26} len={104} h={42} rot={-34} at={34} id="oc-b2t"/>
      </Piece>
    </>;
    case 'quarter': return <>
      <Piece id="oc-q1" x={-12} y={1590} w={340} h={340} color={c0} shape={polyShape(quarterVerts, 1.8)} enter={{at: 2, from: [-180, 200], dur: 18, rot: -4}} {...base}/>
      <Piece id="oc-q2" x={350} y={1720} w={480} h={68} rot={-4} color={c1} shape={rectShape(12)} enter={{at: 8, from: [260, 50], dur: 16}} {...base} z={1}>
        <Tape cx={30} cy={30} len={100} h={42} rot={-30} at={30} id="oc-q2t"/>
      </Piece>
      <Piece id="oc-q3" x={380} y={1810} w={100} h={100} color={c2} shape={circ} enter={{at: 14, from: [0, 120], dur: 14}} {...base}/>
      <Piece id="oc-q4" x={525} y={1840} w={70} h={70} color={c2} shape={circ} enter={{at: 18, from: [0, 100], dur: 14}} {...base}/>
      <Piece id="oc-q5" x={625} y={1862} w={50} h={50} color={c2} shape={circ} enter={{at: 22, from: [0, 90], dur: 14}} {...base}/>
    </>;
    default: return <>
      <Piece id="oc-p1" x={20} y={1690} w={540} h={130} rot={-8} color={c0} shape={pill} enter={{at: 2, from: [-260, 60], dur: 16}} {...base}/>
      <Piece id="oc-p2" x={290} y={1790} w={500} h={120} rot={5} color={c1} shape={pill} enter={{at: 8, from: [260, 80], dur: 16}} {...base} z={1}>
        <Tape cx={440} cy={26} len={100} h={42} rot={32} at={30} from="r" id="oc-p2t"/>
      </Piece>
      <Piece id="oc-p3" x={650} y={1630} w={120} h={120} color={c2} shape={circ} enter={{at: 14, from: [100, -140], dur: 15}} {...base}/>
    </>;
  }
};


Object.assign(Ground,{designBackground:true});
Object.assign(Tape,{designDecoration:true});
