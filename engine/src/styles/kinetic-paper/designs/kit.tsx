import {FittedContent} from '../../../style-kit/content-fit';
import {AbsoluteFill} from 'remotion';
import {displayWeight,displayLineHeight} from '../../../style-kit/design-safety';
// kinetic-paper V4 pilot: a letterpress poster printed on warm paper in two inks (black over lime), slightly out of register.
// Law of the style: everything is pressed onto paper and slammed into place, then holds still. Flat, loud, no gradients, no soft shadows.
import React from 'react';
import {Easing, spring, useCurrentFrame} from 'remotion';
import {fitOnLines, fitToBox, measure} from '../../../core/type';
import {useTypographyFont} from '../../../creative-kit/chapter-theme';
import type {SceneCopy} from '../../scene-copy';
import {ownSceneCopy as sceneCopy} from '../../../style-kit/design-safety';
import {styleWord} from './copy';

export const PAPER = '#F6F1E8';
export const CARD = '#FBF8F0';
export const INK = '#15231F';
export const LIME = '#DDF25E';
export const RED = '#E96245';
export const HEAD = 'Lalezar', SANS = 'Cairo', MONO = 'IBM Plex Mono';
export const W = 1080, X0 = 65, X1 = 1015, CW = X1 - X0, FPS = 30;
export const MIS = 10; // how far the second plate (lime) slips: down and to the left
export const SH = 12; // hard offset shadow, no blur

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const expo = Easing.bezier(0.16, 1, 0.3, 1);
export const ramp = (f: number, at: number, dur: number, ease: (t: number) => number = expo) => ease(clamp01((f - at) / Math.max(1, dur)));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const num = (n: number) => Math.round(n).toLocaleString('en-US');
export const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** The stamp: scale 1.35 to 1 on a hard spring plus a 2 to 3 px shake on the impact frames. Before `at` the element is not printed yet. */
export const slam = (f: number, at: number, from = 1.35) => {
  const t = f - at;
  if (t < 0) return {on: false, scale: 1, dx: 0, dy: 0, k: 0};
  const k = spring({frame: t, fps: FPS, config: {stiffness: 520, damping: 17, mass: 0.55}});
  const d = t < 6 ? 1 - t / 6 : 0, sign = t % 2 === 0 ? 1 : -1;
  return {on: true, scale: from + (1 - from) * k, dx: sign * 2.6 * d, dy: -sign * 2 * d, k};
};
export const Slam: React.FC<{at: number; from?: number; origin?: string; rot?: number; kick?: number; style?: React.CSSProperties; children?: React.ReactNode}> = ({at, from = 1.35, origin = '50% 50%', rot = 0, kick = 0, style, children}) => {
  const {copy} = useDesign();
  if (!copy.ar) origin = origin.replace('100%', '0%');
  const f = useCurrentFrame();
  const s = slam(f, at, from);
  return <div data-cue-at={at} data-event-progress={s.on?s.k:0} style={{...style, opacity: s.on ? 1 : 0, transform: `translate(${s.dx}px, ${s.dy}px) rotate(${rot + (1 - s.k) * kick}deg) scale(${s.scale})`, transformOrigin: origin}}>{children}</div>;
};

/** Halftone screen: a 45 degree dot lattice, 14 px pitch, as a CSS background tile. r is the dot radius (4.5 is about 32 percent coverage). */
export const dotTile = (r: number, color = INK) => {
  if (r < 0.15) return 'none';
  const c = color.replace('#', '%23');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><circle cx='5' cy='5' r='${r.toFixed(2)}' fill='${c}'/><circle cx='15' cy='15' r='${r.toFixed(2)}' fill='${c}'/></svg>`;
  return `url("data:image/svg+xml;utf8,${svg}")`;
};
/** The same screen as an SVG pattern for shapes that are not boxes. */
export const HtPattern: React.FC<{id: string; r: number}> = ({id, r}) =>
  <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r={Math.max(0.01, r)} fill={INK}/><circle cx="15" cy="15" r={Math.max(0.01, r)} fill={INK}/></pattern>;

/** Paper tooth: a fine grain (about 7 percent, multiply) and faint stretched fibres (about 3.5 percent), no blotch bigger than a few px. Worn-ink specks sit over the ink. */
export const PaperFx: React.FC<{style?: React.CSSProperties}> = ({style}) => <>
  <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'multiply', opacity: 0.07, pointerEvents: 'none', ...style}}>
    <filter id="kp-tooth" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" seed="23"/>
      <feColorMatrix type="matrix" values="1.6 0 0 0 -0.05  1.6 0 0 0 -0.05  1.6 0 0 0 -0.05  0 0 0 0 1"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#kp-tooth)"/>
  </svg>
  <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'multiply', opacity: 0.04, pointerEvents: 'none', ...style}}>
    <filter id="kp-fibre" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.02 0.35" numOctaves="2" seed="11"/>
      <feColorMatrix type="matrix" values="2.2 0 0 0 -0.35  2.2 0 0 0 -0.35  2.2 0 0 0 -0.35  0 0 0 0 1"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#kp-fibre)"/>
  </svg>
  <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.92, pointerEvents: 'none', ...style}}>
    <filter id="kp-speck" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="5"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.965  0 0 0 0 0.945  0 0 0 0 0.91  26 0 0 0 -18.4"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#kp-speck)"/>
  </svg>
</>;
/** Slight ink squash on every edge: a tiny turbulence displacement, so nothing looks vector-clean. */
export const InkFilterDefs: React.FC = () => <svg width="0" height="0" style={{position: 'absolute'}}>
  <filter id="kp-press" x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="4" result="w"/>
    <feDisplacementMap in="SourceGraphic" in2="w" scale="2.8" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>;

const Reg: React.FC<{x: number; y: number}> = ({x, y}) => <g transform={`translate(${x} ${y})`} stroke={INK} strokeWidth="2" fill="none"><circle r="13"/><path d="M-24 0H24M0 -24V24"/></g>;
/** Paper ground. One registration cross sits in the top margin; nothing at the sides or bottom. */
export const Ground: React.FC<{height?: number}> = ({height = 1920}) => <div style={{position: 'absolute', left: 0, top: 0, width: W, height, background: PAPER, overflow: 'hidden'}}>
  <svg width={W} height={height} style={{position: 'absolute', left: 0, top: 0}}><Reg x={540} y={62}/></svg>
</div>;

/** Torn paper: a jagged run of points along a horizontal edge. */
export const jag = (x0: number, x1: number, y: number, amp: number, seed: number, step = 15) => {
  const r = rng(seed), pts: string[] = [];
  for (let x = x0; x <= x1; x += step) pts.push(`${x.toFixed(1)} ${(y + (r() - 0.5) * 2 * amp).toFixed(1)}`);
  pts.push(`${x1} ${y}`);
  return pts;
};

const warned = new Set<string>();

/** Fit text to a box with a given face and return the lines so each can land on its own. */
export const fit = (text: string, o: {width: number; size: number; min: number; lines: number; weight?: number; family?: string; lh?: number}) => {
  const family = o.family ?? HEAD, weight = displayWeight(family,HEAD,o.weight ?? (family === HEAD ? 400 : 900)), lh = displayLineHeight(family,HEAD,o.lh ?? 1.12);
  let r = fitOnLines(text, {fontFamily: family, fontSize: o.size, fontWeight: weight}, {maxBoxWidth: o.width, maxLines: o.lines, min: o.min, max: o.size, lineHeight: lh});
  const fits = r.fits;
  if (!fits) {
    r = fitToBox(text, {fontFamily: family, fontSize: o.min, fontWeight: weight}, {maxBoxWidth: o.width, maxLines: o.lines, lineHeight: lh});
    const warning = 'kinetic-paper fit-warning: ' + JSON.stringify({text, width:o.width, size:o.min, lines:o.lines, family});
    if (!warned.has(warning)) { if(warned.size >= 256) warned.clear(); warned.add(warning); console.warn(warning); }
  }
  return {size: r.fontSize, lines: r.lines as string[], box: r.lineBox as number, family, weight, lh, fits};
};
export const canFit = (text: string, o: Parameters<typeof fit>[1]) => fitOnLines(text, {fontFamily:o.family ?? HEAD,fontSize:o.size,fontWeight:o.weight ?? 400}, {maxBoxWidth:o.width,maxLines:o.lines,min:o.min,max:o.size,lineHeight:o.lh ?? 1.12}).fits;
export const widthOf = (text: string, size: number, family = SANS, weight = 900) => measure(text, {fontFamily: family, fontSize: size, fontWeight: weight}).width;

/** The key word of each headline sits on the lime block. */
const HOT: Record<string, string> = {
  'فكرة واحدة وخطوات واضحة': 'واضحة',
  'إزاي ترتب أفكارك في خطوات واضحة يفهمها أي حد من أول مرة': 'أول مرة',
  'الفكرة بتظهر خطوة بخطوة': 'بخطوة',
  'نفس الفكرة بترتيب مختلف': 'مختلف',
  'اكتب الكلمة في التعليقات': 'التعليقات',
  'الحاجات اللي ناقصة': 'ناقصة',
};
export const hotSet = (text: string) => new Set((HOT[text] ?? text.trim().split(/\s+/).slice(-1)[0]).split(' '));

/** One headline line: the lime wipes in from the right just before the word lands, then the ink slams onto it. */
const LineRow: React.FC<{line: string; at: number; size: number; box: number; family: string; weight: number; width:number; color: string; hot: Set<string>; origin: string}> = (o) => {
  const {copy} = useDesign();
  const f = useCurrentFrame();
  const s = slam(f, o.at, 1.3);
  const safety = Math.min(1,o.width/Math.max(1,widthOf(o.line,o.size,o.family,o.weight)));
  const wipe = ramp(f, o.at - 8, 8, Easing.out(Easing.cubic));
  const segs: {t: string; hot: boolean}[] = [];
  for (const w of o.line.split(' ')) { const h = o.hot.has(w); const last = segs[segs.length - 1]; if (last && last.hot === h) last.t += ' ' + w; else segs.push({t: w, hot: h}); }
  return <div style={{height: o.box, lineHeight: `${o.box}px`, fontFamily: o.family, fontWeight: o.weight, fontSize: o.size, color: o.color, whiteSpace: 'pre', direction: copy.dir,
    transform: s.on ? `translate(${s.dx}px, ${s.dy}px) scale(${s.scale * safety})` : undefined, transformOrigin: o.origin}}>
    {segs.map((sg, k) => <React.Fragment key={k}>{k > 0 ? ' ' : ''}
      {sg.hot
        ? <span style={{position: 'relative', display: 'inline-block', padding: '0 0.03em', margin: '0 -0.03em'}}>
          <span style={{position: 'absolute', left: 0, right: 0, top: o.size * 0.06, bottom: 0, background: LIME, transform: `translate(${-MIS}px, ${MIS}px)`, clipPath: copy.ar ? `inset(0 0 0 ${(1 - wipe) * 100}%)` : `inset(0 ${(1 - wipe) * 100}% 0 0)`}}/>
          <span style={{position: 'relative', opacity: s.on ? 1 : 0}}>{sg.t}</span></span>
        : <span style={{opacity: s.on ? 1 : 0}}>{sg.t}</span>}
    </React.Fragment>)}
  </div>;
};
export const Headline: React.FC<{text: string; top: number; width?: number; right?: number; size: number; min: number; lines: number; at: number; stagger?: number; family?: string; weight?: number; color?: string; lh?: number; hot?: boolean; align?: 'right' | 'left' | 'center'}> = (o) => {
  const {copy, fit} = useDesign();
  const width = o.width ?? CW - 20;
  const t = fit(o.text, {width, size: o.size, min: o.min, lines: o.lines, family: o.family, weight: o.weight, lh: o.lh});
  const hot = o.hot === false ? new Set<string>() : hotSet(o.text);
  return <div style={{position: 'absolute', top: o.top, [copy.side]: o.right ?? (W - X1), width, display: 'flex', flexDirection: 'column', alignItems: o.align === 'center' ? 'center' : copy.ar ? 'flex-end' : 'flex-start'}}>
    {t.lines.map((line, i) => <LineRow key={i} line={line} at={o.at + i * (o.stagger ?? 5)} size={t.size} box={t.box} family={t.family} weight={t.weight} width={width} color={o.color ?? INK} hot={hot} origin={o.align === 'center' ? '50% 50%' : copy.ar ? '100% 50%' : '0% 50%'}/>)}
  </div>;
};

/** Printed label: ink pill, paper text, lime plate slipped under it. */
export const Kicker: React.FC<{text: string; top: number; at: number; right?: number; maxWidth?:number}> = ({text, top, at, right = W - X1, maxWidth}) => {
  const {copy} = useDesign();
  return <Slam at={at} from={1.25} origin="100% 50%" style={{position: 'absolute', top, [copy.side]:right}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 14, background: INK, color: PAPER, fontFamily: SANS, fontWeight: 800, fontSize: 38, lineHeight: '66px', padding: '0 30px 0 34px', borderRadius: 33, direction: copy.dir, whiteSpace: 'nowrap', boxShadow: `${-MIS}px ${MIS}px 0 ${LIME}`}}>
      <div style={{width: 16, height: 16, background: LIME, transform: 'rotate(45deg)'}}/><SafeWord text={text} width={Math.max(1,Math.min(maxWidth ?? CW-94,W-right-X0-94))} size={38} weight={800}/></div>
  </Slam>;
};

/** The clause caption for this style: an ink strip with paper text, not a pill. Drawn where the real caption sits. */
export const InkStripCaption: React.FC<{y: number; text: string}> = ({y, text}) => {
  const {copy} = useDesign();
  return <div style={{position: 'absolute', top: y - 46, left: X0, width: 853 - X0, display: 'flex', justifyContent: 'center'}}>
    <div style={{position: 'relative'}}>
      <div style={{position: 'absolute', inset: 0, background: LIME, transform: `translate(${-8}px, ${8}px)`}}/>
      <div style={{position: 'relative', background: INK, color: PAPER, fontFamily: SANS, fontWeight: 800, fontSize: 42, lineHeight: '92px', padding: '0 40px', direction: copy.dir, whiteSpace: 'nowrap'}}>{text}</div>
    </div>
  </div>;
};

/** A printed card: opaque fill, ink frame that draws on, hard offset shadow (solid or halftone), optional lime plate slipped 10 px. */
export const Box: React.FC<{x: number; y: number; w: number; h: number; at: number; fill?: string; limeAt?: number; shadow?: 'solid' | 'halftone' | 'none'; sw?: number; rot?: number; kick?: number; from?: number; stroke?: string; drawDur?: number; children?: React.ReactNode}> = (o) => {
  const {copy} = useDesign();
  const f = useCurrentFrame();
  const s = slam(f, o.at, o.from ?? 1.12);
  const sw = o.sw ?? 12, draw = ramp(f, o.at, o.drawDur ?? 9, Easing.out(Easing.quad));
  const lime = o.limeAt === undefined ? 0 : ramp(f, o.limeAt, 7, Easing.out(Easing.cubic));
  const sh = o.shadow ?? 'solid';
  const htOff = 26, htR = 4.3 * ramp(f, o.at + 2, 12, Easing.out(Easing.quad));
  return <div data-cue-at={o.at} data-event-progress={s.on?s.k:0} style={{position: 'absolute', left: copy.ar ? o.x : o.y + o.h > 1150 ? Math.min(65,W-o.x-o.w) : W - o.x - o.w, top: o.y, width: o.w, height: o.h, opacity: s.on ? 1 : 0,
    transform: `translate(${s.dx}px, ${s.dy}px) rotate(${(o.rot ?? 0) + (1 - s.k) * (o.kick ?? 0)}deg) scale(${s.scale})`, transformOrigin: '50% 50%'}}>
    {sh === 'solid' ? <div style={{position: 'absolute', left: SH, top: SH, width: o.w, height: o.h, background: INK}}/> : null}
    {sh === 'halftone' ? <div style={{position: 'absolute', left: htOff, top: htOff, width: o.w, height: o.h, backgroundImage: dotTile(htR), backgroundSize: '20px 20px'}}/> : null}
    <div style={{position: 'absolute', inset: 0, background: o.fill ?? CARD}}/>
    {lime > 0 ? <div style={{position: 'absolute', inset: 0, background: LIME, transform: `translate(${-MIS}px, ${MIS}px)`, clipPath: `inset(0 0 0 ${(1 - lime) * 100}%)`}}/> : null}
    <svg width={o.w} height={o.h} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: draw > 0.004 ? 1 : 0}}>
      <path d={`M ${o.w - sw / 2} ${sw / 2} H ${sw / 2} V ${o.h - sw / 2} H ${o.w - sw / 2} Z`} fill="none" stroke={o.stroke ?? INK} strokeWidth={sw} strokeLinecap="square" strokeLinejoin="miter" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw}/>
    </svg>
    <div style={{position: 'absolute', inset: 0}}>{o.children}</div>
  </div>;
};

export const CheckStamp: React.FC<{size: number; at: number; rot?: number; color?: string}> = ({size, at, rot = -8, color = INK}) => {
  const f = useCurrentFrame();
  const s = slam(f, at, 1.7);
  return <svg data-cue-at={at} data-event-progress={s.on?s.k:0} viewBox="0 0 100 100" width={size} height={size} style={{overflow: 'visible', opacity: s.on ? 1 : 0, transform: `translate(${s.dx}px, ${s.dy}px) rotate(${rot}deg) scale(${s.scale})`}}>
    <path d="M10 56 L38 86 L92 12" fill="none" stroke={color} strokeWidth="26" strokeLinejoin="miter" strokeLinecap="butt"/></svg>;
};
export const CrossStamp: React.FC<{size: number; at: number; rot?: number; color?: string; sw?: number}> = ({size, at, rot = -6, color = RED, sw = 24}) => {
  const f = useCurrentFrame();
  const s = slam(f, at, 1.7);
  return <svg viewBox="0 0 100 100" width={size} height={size} style={{overflow: 'visible', opacity: s.on ? 1 : 0, transform: `translate(${s.dx}px, ${s.dy}px) rotate(${rot}deg) scale(${s.scale})`}}>
    <path d="M16 16 L84 84 M84 16 L16 84" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="butt"/></svg>;
};


export const CopyContext = React.createContext<SceneCopy>(sceneCopy({lang:'ar'}));
export const useDesign = () => {
  const copy = React.useContext(CopyContext);
  const font = useTypographyFont() ?? HEAD;
  return {copy, HEAD:font, weight:displayWeight(font,HEAD,400),
    fit:(text:string,o:Parameters<typeof fit>[1])=>fit(text,{...o,family:o.family ?? font}),
    canFit:(text:string,o:Parameters<typeof fit>[1])=>canFit(text,{...o,family:o.family ?? font}),
    word:(key:Parameters<typeof styleWord>[0])=>styleWord(key,copy.ar)};
};
export const sectionNumeral = (index?:number) => index !== undefined && Number.isInteger(index) && index > 0 ? String(index).padStart(2,'0') : undefined;

/** Preserve the pilot size; only overlong supplied copy needs horizontal fit safety. */
export const SafeWord: React.FC<{text:string; width:number; size:number; family?:string; weight?:number; spacing?:number}> = ({text,width,size,family=SANS,weight=900,spacing=0}) => {
  const {copy} = useDesign();
  const natural = widthOf(text,size,family,weight) + Math.max(0,Array.from(text).length-1)*spacing;
  if(natural <= width)return <>{text}</>;
  return <span data-fit-width={width} style={{display:'inline-block',width,verticalAlign:'top',textAlign:copy.align}}><span style={{display:'inline-block',whiteSpace:'pre',transform:`scaleX(${width/Math.max(1,natural)})`,transformOrigin:copy.side}}>{text}</span></span>;
};

/** Fit the entire strip group above the measured head, including spring/rotation overscan. */
export const statementSafety = (bottom:number, headTop?:number) => {
  const ceiling = 250;
  if(headTop === undefined)return {scale:1,bottom};
  const available = headTop - 40 - ceiling;
  const scale = Math.max(0,Math.min(1,available/Math.max(1,bottom-ceiling)));
  return {scale,bottom:ceiling+(bottom-ceiling)*scale};
};

export const DesignCanvas:React.FC<{style?:React.CSSProperties;children?:React.ReactNode}>=({style,children})=><AbsoluteFill style={style}><FittedContent native="Lalezar">{children}</FittedContent></AbsoluteFill>;

Object.assign(Ground,{designBackground:true});
Object.assign(PaperFx,{designBackground:true});
