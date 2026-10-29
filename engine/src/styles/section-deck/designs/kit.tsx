import {DesignText} from '../../../style-kit/digits';
import {sceneCopy, type SceneCopy} from '../../scene-copy.ts';
export {sceneCopy} from '../../scene-copy.ts';
import React from 'react';
import {AbsoluteFill, Easing, spring, useCurrentFrame} from 'remotion';
import {fitOnLines, fitToBox} from '../../../core/type';
import {SafeExempt} from '../../../core/safe';
import {useChapter, useTypographyFont} from '../../../creative-kit/chapter-theme';
import {getStyleTheme} from '../../themes';

const ARABIC_COPY = sceneCopy({lang:'ar'});

export type Tone = 0 | 1 | 2;
export type Palette = {grounds: [string, string][]; ink: string; dim: string; faint: string; accent: string; accentInk: string; font: string};
export const W = 1080, X0 = 65, X1 = 1015, CW = X1 - X0;
export const FPS = 30;
export const expo = Easing.bezier(0.16, 1, 0.3, 1);
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const ramp = (f: number, at: number, dur: number, ease = expo) => ease(clamp01((f - at) / Math.max(1, dur)));
export const pop = (f: number, at: number, damping = 14, stiffness = 170) => spring({frame: f - at, fps: FPS, config: {damping, stiffness, mass: 0.8}});
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Fit text to a box with the deck face; returns the lines so each one can be revealed through its own mask. */
export type FitOptions = {width: number; size: number; min: number; lines: number; weight: number; lh?: number; warn?: boolean};
const warned = new Set<string>();
export const fit = (text: string, o: FitOptions, font: string) => {
  const lh = o.lh ?? 1.22;
  const descriptor = {fontFamily: font, fontSize: o.size, fontWeight: o.weight};
  const bounds = {maxBoxWidth: o.width, maxLines: o.lines, min: o.min, max: o.size, lineHeight: lh};
  let r = fitOnLines(text, descriptor, bounds);
  const fits = r.fits;
  if (!fits) {
    r = fitToBox(text, descriptor, {...bounds, fontSize: o.min});
    const warning = 'section-deck fit-warning: ' + JSON.stringify({text, width: o.width, size: o.min, lines: o.lines, font});
    if (o.warn !== false && !warned.has(warning)) {
      if (warned.size >= 256) warned.clear();
      warned.add(warning);
      console.warn(warning);
    }
  }
  return {size: r.fontSize, lines: r.lines, box: r.lineBox, fits};
};
export const useFit = (ar = true) => {
  const P = usePalette(ar);
  return (text: string, o: FitOptions) => fit(text, o, P.font);
};

/** Lines that rise out of a mask, one after another. Arabic stays whole: only whole lines move. */
export const MaskLines: React.FC<{copy?: SceneCopy; text: string; top: number; width?: number; size: number; min: number; lines: number; weight?: number;
  color?: string; at: number; stagger?: number; align?: 'right' | 'left' | 'center'; right?: number; lh?: number; band?: string}> = (p) => {
  const copy = p.copy ?? ARABIC_COPY;
  const P = usePalette(copy.ar), fit = useFit(copy.ar);
  const f = useCurrentFrame();
  const width = p.width ?? CW;
  const t = fit(p.text, {width, size: p.size, min: p.min, lines: p.lines, weight: p.weight ?? 900, lh: p.lh});
  const right = p.right ?? (W - X1);
  return <div style={{position: 'absolute', top: p.top, [copy.side]: right, width, display: 'flex', flexDirection: 'column',
    alignItems: (p.align ?? copy.align) === 'left' ? 'flex-start' : p.align === 'center' ? 'center' : 'flex-end'}}>
    {t.lines.map((line, i) => {
      const k = pop(f, p.at + i * (p.stagger ?? 5), 16, 140);
      const bandP = ramp(f, p.at + i * (p.stagger ?? 5) - 2, 12);
      // The mask reaches past the line box so Arabic dots and hamzas are never cut; the line starts fully below it.
      const pad = Math.round(t.size * 0.32);
      return <div key={i} style={{position: 'relative', height: t.box, overflow: 'hidden', paddingInline: p.band ? 22 : 0,
        paddingTop: pad, paddingBottom: pad, marginTop: -pad, marginBottom: -pad, boxSizing: 'content-box'}}>
        {p.band ? <div style={{position: 'absolute', top: pad + t.box * 0.1, bottom: pad + t.box * 0.06, [copy.side]: 0, width: `${bandP * 100}%`, background: p.band}}/> : null}
        <div style={{position: 'relative', transform: `translateY(${(1 - k) * (t.box + 2 * pad + 4)}px)`, fontFamily: P.font, fontWeight: p.weight ?? 900,
          fontSize: t.size, lineHeight: `${t.box}px`, color: p.color ?? P.ink, whiteSpace: 'nowrap', direction: copy.dir}}>{line}</div>
      </div>;
    })}
  </div>;
};

/** Deep ground with a top light, fine grain and the giant section numeral bleeding off the left edge. */
export const Ground: React.FC<{copy?: SceneCopy; tone: Tone; numeral?: string; numeralTop?: number}> = ({tone, numeral, numeralTop = 120, copy = ARABIC_COPY}) => {
  const P = usePalette(copy.ar);
  const f = useCurrentFrame();
  const [base, light] = P.grounds[tone];
  const n = ramp(f, 0, 26);
  return <SafeExempt><AbsoluteFill style={{background: base, overflow: 'hidden'}}>
    <AbsoluteFill style={{background: `radial-gradient(120% 70% at ${copy.ar ? 88 : 12}% -8%, ${light} 0%, ${base} 62%)`}}/>
    <AbsoluteFill style={{background: `radial-gradient(90% 50% at ${copy.ar ? 0 : 100}% 108%, ${light}55 0%, transparent 70%)`}}/>
    {numeral ? <div style={{position: 'absolute', [copy.opposite]: -70 + (1 - n) * -140 + f * 0.25, top: numeralTop, fontFamily: P.font, fontWeight: 900,
      fontSize: 640, lineHeight: 1, color: 'transparent', WebkitTextStroke: `3px rgba(255,255,255,${0.13 * n})`, letterSpacing: -20, direction: 'ltr'}}><DesignText>{numeral}</DesignText></div> : null}
    <svg width="1080" height="1920" style={{position: 'absolute', inset: 0, opacity: 0.09, mixBlendMode: 'overlay'}}>
      <filter id={`grain${tone}`}><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/></filter>
      <rect width="1080" height="1920" filter={`url(#grain${tone})`}/>
    </svg>
  </AbsoluteFill></SafeExempt>;
};

export const Kicker: React.FC<{copy?: SceneCopy; text: string; top: number; at: number}> = ({text, top, at, copy = ARABIC_COPY}) => {
  const P = usePalette(copy.ar);
  const f = useCurrentFrame();
  const bar = ramp(f, at, 14), txt = ramp(f, at + 4, 16);
  return <div style={{position: 'absolute', top, [copy.side]: W - X1, display: 'flex', alignItems: 'center', gap: 18, direction: copy.dir}}>
    <div style={{width: 64 * bar, height: 8, background: P.accent, borderRadius: 4}}/>
    <div style={{fontFamily: P.font, fontWeight: 700, fontSize: 36, color: P.accent, clipPath: copy.ar ? `inset(0 0 0 ${(1 - txt) * 100}%)` : `inset(0 ${(1 - txt) * 100}% 0 0)`, whiteSpace: 'nowrap'}}>{text}</div>
  </div>;
};

export const Check: React.FC<{p: number; size: number; color: string; width?: number}> = ({p, size, color, width = 9}) =>
  <svg width={size} height={size} viewBox="0 0 100 100"><path d="M22 53 L42 72 L79 31" fill="none" stroke={color} strokeWidth={width * 100 / size * 1.4} strokeLinecap="round" strokeLinejoin="round"
    pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p}/></svg>;

export const num = (n: number) => Math.round(n).toLocaleString('en-US');


/** Fixed deck grounds stay intact when the creator supplies a brand accent. */
export const usePalette = (ar = true): Palette => {
  const theme = getStyleTheme('section-deck');
  const chapter = useChapter();
  const font = useTypographyFont();
  return {grounds: theme.sectionDeck!.grounds, ink: theme.text, dim: theme.dim, faint: theme.sectionDeck!.faint,
    accent: chapter?.accent ?? theme.accent, accentInk: chapter?.onAccent ?? theme.onAccent!, font: font ?? (ar ? 'Cairo' : theme.display || 'Cairo')};
};
export const sectionNumeral = (index?: number): string | undefined =>
  index !== undefined && Number.isInteger(index) && index > 0 ? String(index).padStart(2, '0') : undefined;

export const TrackRow: React.FC<{copy?: SceneCopy; i: number; at: number; top: number; title: string; detail: string; mode: 'number' | 'check'; done?: boolean; label?: string; compact?: boolean}> = ({i, at, top, title, detail, mode, done = true, label, compact, copy = ARABIC_COPY}) => {
  const P = usePalette(copy.ar), fit = useFit(copy.ar);
  const f = useCurrentFrame();
  const on = ramp(f, at, 14), k = pop(f, at, 13, 170);
  const node = compact ? 76 : 92;
  const nodeX = copy.ar ? X1 - node : X0;
  const t = fit(title, {width: 760, size: compact ? 56 : 66, min: 42, lines: 1, weight: 800});
  return <>
    <div style={{position: 'absolute', top, left: nodeX, width: node, height: node, borderRadius: mode === 'check' ? node * 0.26 : node / 2,
      background: on > 0.5 && done ? P.accent : 'transparent', border: `4px solid ${on > 0.05 ? P.accent : P.faint}`, boxSizing: 'border-box',
      transform: `scale(${mix(0.6, 1, k)})`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      {mode === 'number'
        ? <span style={{fontFamily: P.font, fontWeight: 900, fontSize: 46, color: on > 0.5 ? P.accentInk : P.dim, direction: 'ltr'}}><DesignText>{i + 1}</DesignText></span>
        : done ? <Check p={ramp(f, at + 4, 12)} size={node} color={P.accentInk}/> : <div style={{width: node * 0.37 * ramp(f, at + 4, 10), height: 6, borderRadius: 3, background: P.accent}}/>}
    </div>
    <div style={{position: 'absolute', top: top - 6, [copy.side]: (copy.ar ? W - nodeX : nodeX + node) + 30, width: 760, textAlign: copy.align, direction: copy.dir,
      opacity: mix(0.28, 1, on), transform: `translateX(${(1 - on) * (copy.ar ? -36 : 36)}px)`}}>
      <div style={{fontFamily: P.font, fontWeight: 800, fontSize: t.size, lineHeight: 1.25, color: P.ink, whiteSpace: 'nowrap'}}>{title}</div>
      <div style={{display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'flex-start', marginTop: 2}}>
        {label ? <span style={{fontFamily: P.font, fontWeight: 800, fontSize: 26, color: P.accentInk, background: P.accent, borderRadius: 8, padding: '0 12px', lineHeight: '40px'}}><DesignText>{label}</DesignText></span> : null}
        <span style={{fontFamily: P.font, fontWeight: 600, fontSize: compact ? 32 : 38, lineHeight: 1.3, color: P.dim, whiteSpace: 'nowrap'}}>{detail}</span>
      </div>
    </div>
  </>;
};

