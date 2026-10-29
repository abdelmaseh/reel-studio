// Shared drawing parts for the three calligraphic-receipts family designs (figures, chat-thread, proof-screen).
// Everything is built from the style kit: ruqaa headlines with the red brush underline, thermal receipts with torn bottoms,
// mono numbers with dotted leaders, hatched ink, red ink marks. No fixed words are printed: the creator's copy is the only text.
import React from 'react';
import {Sequence, useCurrentFrame} from 'remotion';
import {useProbe} from '../../../core/safe';
import {measure} from '../../../core/type';
import {useDesignText} from '../../../style-kit/digits';
import {BrushRule, C, CW, FONT, InkLine, Parchment, Receipt, Tooth, X0, clamp01, pen, ramp, rng, useCopy, useInkLayout, warnFit, type Ghost, type InkLayout} from './kit';

/** Takeover zone of the ig-reels-organic profile with the style caption line at y 1260: content ends at 1150, where the right rail begins. */
export const ZONE_TOP = 284, ZONE_BOTTOM = 1150;
/** The sticker slot of figures and chat-thread starts at x 848, so a headline beside it stops at x 828. */
const STICKER_EDGE = 828;

/** A scene clock far past every cue, used under the safe-zone probe so the settled state is what gets measured. */
export const Settled: React.FC<{after?: number; children: React.ReactNode}> = ({after = 900, children}) => {
  const probe = useProbe();
  return probe === null ? <>{children}</> : <Sequence from={-after} layout="none">{children}</Sequence>;
};

// ---------- numbers ----------
export const decimalsOf = (n: number) => n.toFixed(6).split('.')[1].replace(/0+$/, '').length;
/** Fixed decimals, and never a negative zero while a negative value is still counting towards its end. */
export const fixed = (n: number, decimals: number) => {
  const s = n.toFixed(decimals);
  return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s;
};

const ARABIC_DIGITS = /[٠-٩۰-۹]/;
const IS_DIGIT = /[0-9٠-٩۰-۹]/;
export type Face = {family: string; weight: number; em: (ch: string) => number; width: (text: string, size: number) => number};
/** IBM Plex Mono has no Arabic-Indic digits; when the creator chose them the numeral is set in Noto Naskh instead. */
export const useNumberFace = (): Face => {
  const shown = useDesignText();
  const arabic = ARABIC_DIGITS.test(shown('0123456789'));
  const family = arabic ? FONT.naskh : FONT.mono, weight = arabic ? 700 : 600;
  const glyph = (ch: string) => measure(ch, {fontFamily: family, fontSize: 100, fontWeight: weight}).width / 100;
  const digit = Math.max(...Array.from({length: 10}, (_, i) => glyph(shown(String(i)))));
  const em = (ch: string) => IS_DIGIT.test(ch) ? digit : glyph(ch);
  return {family, weight, em, width: (text, size) => Array.from(text).reduce((sum, ch) => sum + em(ch), 0) * size};
};

/** Number set in fixed cells: it counts without jitter, and the room for its longest form is kept from the first frame. */
export const NumberText: React.FC<{text: string; reserve: number; size: number; face: Face; color: string}> = ({text, reserve, size, face, color}) => {
  const chars = Array.from(text);
  return <div aria-label={text} style={{display: 'flex', direction: 'ltr', fontFamily: face.family, fontWeight: face.weight, fontSize: size, lineHeight: `${Math.round(size * 0.9)}px`, color, whiteSpace: 'pre'}}>
    {Array.from({length: Math.max(0, reserve - chars.length)}, (_, i) => <span key={`p${i}`} style={{width: face.em('0') * size}}/>)}
    {chars.map((ch, i) => <span key={i} style={{display: 'inline-block', width: face.em(ch) * size, textAlign: 'center'}}>{ch}</span>)}
  </div>;
};

// ---------- text ----------
export type Wrapped = {lines: string[]; size: number; box: number; width: number};
/** The fewest lines that fit `maxWidth`, broken so the widest line is as narrow as it can be: no line ends in a lonely word. */
export const wrapText = (text: string, family: string, weight: number, size: number, maxWidth: number, lh = 1.4, maxLines = 8): Wrapped => {
  const words = text.trim().split(/\s+/);
  const w = (s: string) => measure(s, {fontFamily: family, fontSize: size, fontWeight: weight}).width;
  const greedy = (limit: number) => {
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && w(next) > limit) { lines.push(line); line = word; } else line = next;
    }
    return [...lines, line];
  };
  const full = w(words.join(' '));
  if (full <= maxWidth) return {lines: [words.join(' ')], size, box: Math.round(size * lh), width: Math.ceil(full)};
  let best = greedy(maxWidth);
  const lowest = Math.max(...words.map(w));
  if (best.length <= maxLines) {
    let lo = lowest, hi = maxWidth;
    for (let i = 0; i < 12 && hi - lo > 4; i++) {
      const mid = (lo + hi) / 2, trial = greedy(mid);
      if (trial.length <= best.length) { best = trial; hi = mid; } else lo = mid;
    }
  }
  return {lines: best, size, box: Math.round(size * lh), width: Math.ceil(Math.max(...best.map(w)))};
};
/** Whether the text wraps inside `maxWidth` in few enough lines without a single word overflowing. */
const wrapFits = (wrapped: Wrapped, maxWidth: number, maxLines = 8) => wrapped.width <= maxWidth && wrapped.lines.length <= maxLines;

/** Wrapped text that steps down from `size` until every line fits `maxWidth` in at most `maxLines`. */
export const fitWrapped = (text: string, family: string, weight: number, size: number, min: number, maxWidth: number, lh = 1.4, maxLines = 8): Wrapped => {
  let s = size, wrapped = wrapText(text, family, weight, s, maxWidth, lh, maxLines);
  while (!wrapFits(wrapped, maxWidth, maxLines) && s > min) { s -= 2; wrapped = wrapText(text, family, weight, s, maxWidth, lh, maxLines); }
  if (!wrapFits(wrapped, maxWidth, maxLines)) warnFit(text, maxWidth, s, maxLines);
  return wrapped;
};

// ---------- the headline ----------
const HEAD_TRIES = [
  {lines: 1, size: 128, min: 100, lh: 1.2}, {lines: 2, size: 116, min: 84, lh: 1.15},
  {lines: 2, size: 92, min: 68, lh: 1.15}, {lines: 3, size: 80, min: 62, lh: 1.15},
];
export type Head = {L: InkLayout; left: number; width: number; top: number; ruleTop: number; ruleW: number; bottom: number};

/** The label or title as a ruqaa headline with its red brush underline. Beside a sticker it stops at x 828. */
export const useHead = (text: string | undefined, sticker: boolean, o: {top?: number; maxSize?: number} = {}): Head | null => {
  const inkLayout = useInkLayout();
  if (!text) return null;
  const top = o.top ?? 294, cap = o.maxSize ?? 128, width = sticker ? STICKER_EDGE - X0 : CW;
  const L = inkLayout(text, HEAD_TRIES.map(t => ({...t, size: Math.min(t.size, cap), min: Math.min(t.min, cap), width})));
  const spans = L.lines.map(line => measure(line, {fontFamily: L.family, fontSize: L.size, fontWeight: L.weight}).width);
  const ruleW = Math.min(width, Math.max(spans[spans.length - 1] + 40, Math.max(...spans) * 0.5));
  const ruleTop = top + L.lines.length * L.box + 6;
  return {L, left: X0, width, top, ruleTop, ruleW, bottom: ruleTop + 38};
};

export const Headline: React.FC<{head: Head; at?: number}> = ({head, at = 4}) => {
  const copy = useCopy(), f = useCurrentFrame(), {L} = head;
  // The column is laid out left-to-right on purpose: flex-end is then the physical right edge, where Arabic lines start.
  return <>
    <div style={{position: 'absolute', top: head.top, left: head.left, width: head.width, display: 'flex', flexDirection: 'column', direction: 'ltr', alignItems: copy.ar ? 'flex-end' : 'flex-start'}}>
      {L.lines.map((line, i) => <InkLine key={i} text={line} size={L.size} box={L.box} family={L.family} weight={L.weight} color={C.ink} p={ramp(f, at + i * 18, 20, pen)}/>)}
    </div>
    <BrushRule local left={head.left + (copy.ar ? head.width - head.ruleW : 0)} top={head.ruleTop} w={head.ruleW} h={36} at={at + (head.L.lines.length - 1) * 18 + 14} dur={16}/>
  </>;
};

/** Ruled parchment whose rules sit on the headline baseline, as in the style's approved scenes. */
export const Ground: React.FC<{head: Head | null}> = ({head}) =>
  head ? <Parchment pitch={head.L.box} offset={head.top + head.L.baseline}/> : <Parchment/>;

// ---------- printed marks ----------
/** A barcode made of shapes only: it fills the foot of a receipt without printing any word or number. */
export const Barcode: React.FC<{w: number; h: number; seed: number; color?: string}> = ({w, h, seed, color = C.ink}) => {
  const r = rng(seed);
  const bars: {x: number; w: number}[] = [];
  for (let x = 0; x < w;) {
    const bw = 2 + Math.floor(r() * 3) * 2;
    if (x + bw > w) break;
    bars.push({x, w: bw});
    x += bw + 2 + Math.floor(r() * 3) * 2;
  }
  return <svg width={w} height={h} style={{display: 'block'}}>{bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={h} fill={color} opacity={0.86}/>)}</svg>;
};

/** A bar of cross-hatched ink. It grows in whole cells from the start side, like characters being printed, and lands on the exact length. */
export const InkBar: React.FC<{track: number; len: number; h: number; p: number; color: string; cell?: number; outlined?: boolean}> = ({track, len, h, p, color, cell = 22, outlined}) => {
  const copy = useCopy();
  const grown = p >= 1 ? len : Math.min(len, Math.ceil(p * len / cell) * cell);
  const hatch = (deg: number) => `repeating-linear-gradient(${deg}deg, ${color} 0 3px, transparent 3px 9px)`;
  return <div style={{position: 'relative', width: track, height: h}}>
    {outlined ? <div style={{position: 'absolute', [copy.side]: 0, top: 0, width: track, height: h, boxSizing: 'border-box', border: '3px dashed rgba(46,32,25,0.38)'}}/> : null}
    {grown > 0 ? <div style={{position: 'absolute', [copy.side]: 0, top: 0, width: grown, height: h, boxSizing: 'border-box', border: `4px solid ${color}`,
      background: `repeating-linear-gradient(${copy.ar ? 270 : 90}deg, transparent 0 ${cell - 3}px, ${C.thermal} ${cell - 3}px ${cell}px), ${hatch(45)}, ${hatch(-45)}, ${color}30`}}/> : null}
  </div>;
};

/** One line of a receipt: the label (wrapped to the fewest lines), a dotted leader on its last line, then the value. */
export const LeaderRow: React.FC<{lines: string[]; size: number; box: number; value?: React.ReactNode; labelColor?: string; trail?: number}> = ({lines, size, box, value, labelColor = C.ink, trail = 0}) => {
  const copy = useCopy();
  return <div style={{display: 'flex', direction: copy.dir, alignItems: 'flex-end', gap: 16}}>
    <div style={{display: 'flex', flexDirection: 'column'}}>
      {lines.map((line, i) => <div key={i} style={{fontFamily: FONT.naskh, fontWeight: 700, fontSize: size, lineHeight: `${box}px`, height: box, color: labelColor, whiteSpace: 'pre'}}>{line}</div>)}
    </div>
    <div style={{flex: 1, minWidth: 30, height: 0, borderBottom: '3px dotted rgba(46,32,25,0.4)', marginBottom: box * 0.28}}/>
    {value}
    {trail ? <div style={{width: trail}}/> : null}
  </div>;
};

/** A small slip of thermal paper that feeds out downward, torn at the bottom. Like the kit's Receipt but with exact padding, for slips and cards. */
export const Slip: React.FC<{left: number; top: number; width: number; height: number; start: number; feed?: number; rot?: number; seed?: number; tint?: string; children?: React.ReactNode}> =
  ({left, top, width, height, start, feed = 9, rot = 0, seed = 1, tint, children}) => {
    const f = useCurrentFrame();
    const t = clamp01((f - start) / feed), E = height * (1 - (1 - t) * (1 - t));
    if (E < 2) return null;
    const TOOTH = 20, DEPTH = 10, n = Math.round(width / TOOTH), tw = width / n;
    const zig = Array.from({length: n + 1}, (_, k) => `${((n - k) * tw).toFixed(1)}px ${(E - (k % 2 ? DEPTH : 0)).toFixed(1)}px`);
    const poly = `polygon(0px 0px, ${width}px 0px, ${zig.join(', ')})`;
    const feeding = t < 1, jx = feeding ? Math.sin(f * 7.3 + seed) * 1.1 : 0, jr = feeding ? Math.sin(f * 5.1 + seed * 2) * 0.1 : 0;
    return <div style={{position: 'absolute', left, top, width, height, transform: `translateX(${jx}px) rotate(${rot + jr}deg)`, transformOrigin: '50% 0'}}>
      <div style={{position: 'absolute', left: 0, top: 12, width, height: E, filter: 'blur(10px)', opacity: 0.3}}><div style={{width, height: E, clipPath: poly, background: '#3A2414'}}/></div>
      <div style={{position: 'absolute', left: 0, top: 2, width, height: E, filter: 'blur(1.4px)', opacity: 0.24}}><div style={{width, height: E, clipPath: poly, background: '#3A2414'}}/></div>
      <div style={{position: 'relative', width, height: E, clipPath: poly, background: C.thermal}}>
        <Tooth w={width} h={height} tooth={0.1} fibre={0} seed={seed + 20} tint={[0.45, 0.4, 0.33]}/>
        {tint ? <div style={{position: 'absolute', left: 0, top: 0, width, height, background: tint}}/> : null}
        <div style={{position: 'absolute', left: 0, top: 0, width, height: 40, background: 'linear-gradient(180deg, rgba(60,40,24,0.18), rgba(60,40,24,0))'}}/>
        <div style={{position: 'absolute', left: 0, top: 0, width, height}}>{children}</div>
      </div>
    </div>;
  };

/** The paper the kit's Receipt adds above and below its rows. */
export const PAPER_HEAD = 24, PAPER_FOOT = 40;

/** One tall thermal receipt that feeds out of its slot, torn at the bottom. The content is laid out at its final size and revealed by the paper. */
export const Paper: React.FC<{left: number; top: number; width: number; height: number; start: number; feed?: number; rot?: number; seed?: number; ghosts?: Ghost[]; children: React.ReactNode}> =
  ({left, top, width, height, start, feed = 26, rot = 0, seed = 6, ghosts, children}) =>
    <Receipt left={left} top={top} width={width} start={start} per={feed} rot={rot} seed={seed} ghosts={ghosts}
      rows={[{h: height, node: <div style={{position: 'relative', height}}>{children}</div>}]}/>;

/** The printer slot a roll of paper hangs from: a dark bar with a soft shadow on the paper below it. */
export const PrinterSlot: React.FC<{y: number; left?: number; width?: number}> = ({y, left = 64, width = 952}) => {
  const f = useCurrentFrame();
  return <>
    <div style={{position: 'absolute', left: left + 14, top: y + 9, width: width - 28, height: 34, background: 'linear-gradient(180deg, rgba(30,18,8,0.30), rgba(30,18,8,0))', opacity: ramp(f, 0, 8)}}/>
    <div style={{position: 'absolute', left, top: y - 9, width, height: 18, borderRadius: 9, opacity: ramp(f, 0, 8),
      background: 'linear-gradient(180deg,#5c4a3e 0%,#2b1e17 55%,#1a110c 100%)', boxShadow: '0 7px 12px rgba(30,18,8,0.38), inset 0 1.5px 0 rgba(255,255,255,0.22)'}}/>
  </>;
};

/** A short scale pulse around frame `at`: a total landing on the receipt. */
export const usePulse = (at: number, span = 7, amount = 0.05) => {
  const f = useCurrentFrame();
  return 1 + amount * Math.max(0, 1 - Math.abs(f - at) / span) * (f >= at ? 1 : 0);
};
