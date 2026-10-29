// Shared drawing parts for the three liquid-glass family designs (figures, chat-thread, proof-screen).
// Everything here is built from the style kit: the same glass recipe, the same blur-to-sharp entry, the same type tokens.
import React from 'react';
import {Sequence, useCurrentFrame} from 'remotion';
import {useProbe} from '../../../core/safe';
import {fitOnLines, isArabic} from '../../../core/type';
import {C, DISPLAY, MONO, RIM_MASK, W, X1, CW, clamp01, ramp, rgba, widthOf, fit, headH, useGlass, type FitOpt} from './kit';

export type GlassScope = ReturnType<typeof useGlass>;

/** Takeover zone of the ig-reels-organic profile with the liquid-glass caption line at y 1340. Full-width objects end at 1150 (the rail starts there at x 853). */
export const ZONE = {top: 284, bottom: 1150, lowBottom: 1250, titleTop: 280};

/** A scene clock far past every cue, used under the safe-zone probe so the settled state is what gets measured. */
export const Settled: React.FC<{after?: number; children: React.ReactNode}> = ({after = 900, children}) => {
  const probe = useProbe();
  return probe === null ? <>{children}</> : <Sequence from={-after} layout="none">{children}</Sequence>;
};

// ---------- the scene headline ----------
/** Big first: one line at 96 to 132 px, then two lines, then smaller type, and three lines only for the longest labels. */
export const TITLE_OPTS: FitOpt[] = [{size: 132, min: 96, lines: 1}, {size: 116, min: 90, lines: 2}, {size: 88, min: 64, lines: 2}, {size: 76, min: 56, lines: 3}];

/** The sticker slot of figures and chat-thread sits at x 848 to 1008 from y 340, so the headline narrows to stay left of it. */
export const titleBox = (d: {sticker?: unknown; copy: GlassScope['copy']}) =>
  d.sticker ? {width: 765, right: d.copy.ar ? 250 : W - X1} : {width: CW, right: W - X1};

export const titleHeight = (d: {sticker?: unknown; font: string; copy: GlassScope['copy']}, text: string | undefined) =>
  text ? headH(text, TITLE_OPTS, titleBox(d).width, 700, 1.2, d.font) : 0;

// ---------- numbers ----------
export const decimalsOf = (n: number) => n.toFixed(6).split('.')[1].replace(/0+$/, '').length;
/** Fixed decimals, and never a negative zero while a negative value is still rolling towards its end. */
export const plain = (n: number, decimals: number) => {
  const s = n.toFixed(decimals);
  return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s;
};
/** IBM Plex Mono has no Arabic-Indic digits; when the creator chose them the numeral falls back to Plex Arabic. */
export const numberFont = (shownText: string) => /[٠-٩۰-۹]/.test(shownText) ? DISPLAY : MONO;
/** The widest of the ten digits as the creator will see them, in em. */
export const digitEm = (shown: (t: string | number) => string, family: string, weight = 700) =>
  Math.max(...Array.from({length: 10}, (_, i) => widthOf(shown(String(i)), family, 100, weight))) / 100;
export const fitNumber = (text: string, family: string, width: number, max: number, min: number, weight = 700) =>
  fitOnLines(text, {fontFamily: family, fontSize: max, fontWeight: weight}, {maxBoxWidth: width, maxLines: 1, min, max, lineHeight: 1});

// ---------- entry ----------
/** Blur-to-sharp with a rise, for whole words and lines. The line box is never masked, so dots and hamzas are never cut. */
export const enter = (f: number, at: number, o: {dur?: number; rise?: number; blur?: number} = {}): React.CSSProperties => {
  const k = ramp(f, at, o.dur ?? 24);
  return {opacity: clamp01(k * 1.4), transform: `translateY(${(1 - k) * (o.rise ?? 40)}px)`, filter: k < 0.95 ? `blur(${(1 - k) * (o.blur ?? 14)}px)` : undefined};
};

/** A small frosted capsule that sits inside a glass panel. Its contents are centred, so it is mirror-safe. */
export const Pill: React.FC<{w: number; h: number; at: number; tint?: string; active?: number; rim?: string; style?: React.CSSProperties; children?: React.ReactNode}> =
  ({w, h, at, tint, active = 0, rim, style, children}) => {
    const f = useCurrentFrame();
    const bf = 'blur(16px) saturate(140%)';
    return <div style={{position: 'relative', width: w, height: h, ...enter(f, at, {rise: 22, blur: 10}), ...style}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: h / 2, boxShadow: `0 18px 40px rgba(0,0,0,0.35)${active > 0.01 ? `, 0 0 ${46 * active}px ${rgba(C.cyan, 0.42 * active)}` : ''}`}}/>
      <div style={{position: 'absolute', inset: 0, borderRadius: h / 2, backdropFilter: bf, WebkitBackdropFilter: bf,
        background: tint ?? 'linear-gradient(160deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05))'}}/>
      <div style={{position: 'absolute', inset: 3, borderRadius: h / 2 - 3, background: 'rgba(5,9,22,0.34)'}}/>
      <div style={{position: 'absolute', inset: 0, borderRadius: h / 2, padding: 1.5, boxSizing: 'border-box', ...RIM_MASK,
        background: rim ?? 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.1) 58%, rgba(255,255,255,0.26))'}}/>
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{children}</div>
    </div>;
  };

/** The unit of a figure as a glass chip: sized from its measured text so it never clips. */
export const UnitChip: React.FC<{text: string; font: string; at: number; max?: number; size?: number}> = ({text, font, at, max = 700, size = 50}) => {
  const t = fit(text, font, 600, max - 90, {size, min: 30, lines: 1}, 1.2);
  const w = Math.ceil(t.width) + 90, h = Math.round(t.size * 2);
  return <Pill w={w} h={h} at={at}>
    <div style={{display: 'flex', alignItems: 'center', gap: 16, direction: isArabic(text) ? 'rtl' : 'ltr'}}>
      <div style={{width: 14, height: 14, borderRadius: 7, background: C.cyan, boxShadow: `0 0 18px ${C.cyan}`, flex: 'none'}}/>
      <span style={{fontFamily: font, fontWeight: 600, fontSize: t.size, color: '#fff', whiteSpace: 'nowrap', lineHeight: `${h}px`}}>{text}</span>
    </div>
  </Pill>;
};
export const unitChipHeight = (text: string, font: string, max = 700, size = 50) => Math.round(fit(text, font, 600, max - 90, {size, min: 30, lines: 1}, 1.2).size * 2);
