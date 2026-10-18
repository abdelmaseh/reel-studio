// The card shell every card kind shares: the rounded surface with its entrance and exit, pills, black stamps, shapes, icons and the pop/typing helpers.
// Under the safe-zone probe a card keeps its fill and its content (the check must see them) and only loses its shadow.
import React from 'react';
import {Box, Calendar, Clock, Cpu, Database, FileText, Folder, Globe, Image, Layers, Lock, Mail, MessageSquare, Monitor, Music, Search, Send, Shield, Smartphone, Terminal, User, Video, Wrench, Zap, type LucideIcon} from 'lucide-react';
import {FAMILY} from '../../../../core/fonts';
import {useProbe} from '../../../../core/safe';
import {CARD, EASE, clamp01, type CardT, type IconName, type Palette, type Shape} from '../math.ts';
import type {Stage} from '../scene';

export const ICON_COMPONENTS: Record<IconName, LucideIcon> = {
  mail: Mail, folder: Folder, database: Database, calendar: Calendar, cpu: Cpu, smartphone: Smartphone, monitor: Monitor, send: Send, search: Search, shield: Shield, zap: Zap,
  'file-text': FileText, image: Image, music: Music, video: Video, globe: Globe, lock: Lock, clock: Clock, wrench: Wrench, box: Box, layers: Layers, terminal: Terminal, 'message-square': MessageSquare, user: User,
};
export const Icon: React.FC<{name: IconName; size?: number; color: string}> = ({name, size = 44, color}) => {
  const C = ICON_COMPONENTS[name];
  return <C size={size} color={color} strokeWidth={2.2} aria-hidden />;
};

/** The dark editor surface used by code and monitor cards on every ground. */
export const EDITOR_FILL = '#141518';

/** 0..1 envelope of a card: expoOut entrance over 0.42 s, p-squared exit over 0.25 s after the window. */
export const cardEnvelope = (stage: Stage, card: CardT): {vis: number; local: number} => {
  const {frame, fps} = stage;
  const local = frame - card.startFrame;
  const enter = EASE.expoOut(clamp01(local / (CARD.enterSeconds * fps)));
  const out = clamp01((frame - card.endFrame) / (CARD.exitSeconds * fps));
  return {vis: Math.min(enter, 1 - out * out), local};
};
/** backOut pop over 0.38 s from a scene frame; 0 before it. */
export const pop = (stage: Stage, from: number): number => (stage.frame < from ? 0 : EASE.backOut(clamp01((stage.frame - from) / (CARD.popSeconds * stage.fps))));
/** Frames in seconds at the stage fps. */
export const sec = (stage: Stage, seconds: number): number => Math.round(seconds * stage.fps);
/** The visible part of a typed line: linear over `seconds` from `from`. Latin only (code and commands). */
export const typedChars = (text: string, stage: Stage, from: number, seconds = 0.45): string => text.slice(0, Math.round(text.length * clamp01((stage.frame - from) / (seconds * stage.fps))));
const f3 = (n: number): string => n.toFixed(3);

/** The rounded surface. `vis` drives the rise and the fade; `dark` is the editor surface. */
export const CardBox: React.FC<{stage: Stage; card: CardT; x: number; y: number; w: number; h: number; dark?: boolean; children?: React.ReactNode}> = ({stage, card, x, y, w, h, dark = false, children}) => {
  const probe = useProbe();
  const {vis} = cardEnvelope(stage, card);
  const ink = stage.ink;
  const rise = Math.round((1 - vis) * CARD.rise), scale = CARD.scaleFrom + (1 - CARD.scaleFrom) * vis;
  return <div data-card={card.id} style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: CARD.radius, background: dark ? EDITOR_FILL : ink.card, border: `2px solid ${dark ? 'rgba(255,255,255,0.08)' : ink.line}`,
    ...(probe ? {} : {boxShadow: ink.shadow}), opacity: Number(clamp01(1.6 * vis).toFixed(3)), transform: `translateY(${rise}px) scale(${f3(scale)})`, transformOrigin: '50% 100%', overflow: 'hidden', boxSizing: 'border-box'}}>
    {children}
  </div>;
};
/** A free-standing group (cards made of several small surfaces) with the same envelope. */
export const CardGroup: React.FC<{stage: Stage; card: CardT; x: number; y: number; w: number; h: number; children?: React.ReactNode}> = ({stage, card, x, y, w, h, children}) => {
  const {vis} = cardEnvelope(stage, card);
  const rise = Math.round((1 - vis) * CARD.rise);
  return <div data-card={card.id} style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: Number(clamp01(1.6 * vis).toFixed(3)), transform: `translateY(${rise}px)`}}>{children}</div>;
};
/** A small surface inside a group: card fill, line, shadow (dropped under the probe), scaled by its pop. */
export const Tile: React.FC<{stage: Stage; x: number; y: number; w: number; h: number; p: number; rot?: number; radius?: number; fill?: string; color?: string; style?: React.CSSProperties; children?: React.ReactNode}> =
  ({stage, x, y, w, h, p, rot = 0, radius = 26, fill, color, style, children}) => {
  const probe = useProbe();
  return <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: radius, background: fill ?? stage.ink.card, color: color ?? stage.ink.ink, border: `2px solid ${stage.ink.line}`,
    ...(probe ? {} : {boxShadow: stage.ink.shadow}), transform: `rotate(${rot}deg) scale(${f3(p)})`, opacity: p > 0 ? 1 : 0, boxSizing: 'border-box', ...style}}>{children}</div>;
};
const isArabic = (text: unknown): boolean => typeof text === 'string' && /[؀-ۿ]/.test(text);
/** Mono for tags, labels and code; Arabic copy (a creator may tag a card in Arabic) uses the display face, right to left, with no letter-spacing. */
export const Mono: React.FC<{color: string; size?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({color, size = 22, children, style}) => {
  const arabic = isArabic(children);
  return <div style={{fontFamily: arabic ? FAMILY.plexDisplay : FAMILY.plexMono, fontWeight: 600, fontSize: size, color, direction: arabic ? 'rtl' : 'ltr', letterSpacing: arabic ? 0 : 0.4,
    whiteSpace: 'pre', fontSynthesis: 'none', ...style, ...(arabic ? {letterSpacing: 0} : {})}}>{children}</div>;
};
/** Creator copy in the display face; it may be Arabic, so it is never letter-spaced. */
export const Label: React.FC<{color: string; size?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({color, size = 40, children, style}) => (
  <div dir="auto" style={{fontFamily: FAMILY.plexDisplay, fontWeight: 700, fontSize: size, color, lineHeight: 1.2, whiteSpace: 'nowrap', fontSynthesis: 'none', ...style}}>{children}</div>
);
/** A pill centred on (x, y): dark ink by default, accent with dark text when `accent`. */
export const Pill: React.FC<{ink: Palette; x: number; y: number; p: number; accent?: boolean; children: React.ReactNode}> = ({ink, x, y, p, accent = false, children}) => (
  <div dir="auto" style={{position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${f3(0.6 + 0.4 * p)})`, opacity: Number(clamp01(1.5 * p).toFixed(3)), padding: '10px 26px', borderRadius: 999,
    background: accent ? ink.accent : ink.pill, color: accent ? ink.onAccent : ink.pillText, fontFamily: FAMILY.plexDisplay, fontWeight: 700, fontSize: 34, whiteSpace: 'nowrap', fontSynthesis: 'none'}}>{children}</div>
);
/** The rotated stamp in the act's ink (black on paper, light on night) with the ground as its text: scale 1.8 to 1 on the pop, a hard offset shadow (dropped under the probe). */
export const Stamp: React.FC<{ink: Palette; x: number; y: number; p: number; rot?: number; children: React.ReactNode}> = ({ink, x, y, p, rot = -6, children}) => {
  const probe = useProbe();
  return <div dir="auto" data-cartoon-stamp="true" style={{position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${f3(1.8 - 0.8 * p)})`, opacity: Number(clamp01(2 * p).toFixed(3)), padding: '8px 22px',
    background: ink.ink, color: ink.ground, fontFamily: FAMILY.plexDisplay, fontWeight: 700, fontSize: 54, ...(probe ? {} : {boxShadow: '6px 6px 0 rgba(0,0,0,0.25)'}), whiteSpace: 'nowrap', fontSynthesis: 'none'}}>{children}</div>;
};
const SHAPE_PATH = (shape: Shape, size: number): string => {
  const r = size / 2, w = size * 1.6;
  if (shape === 'circle') return `M ${r} 0 A ${r} ${r} 0 1 1 ${r} ${size} A ${r} ${r} 0 1 1 ${r} 0 Z`;
  if (shape === 'triangle') return `M ${r} 0 L ${size} ${size} L 0 ${size} Z`;
  if (shape === 'square') return `M 0 0 H ${size} V ${size} H 0 Z`;
  return `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w - r} ${size} H ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
};
/** A shape chip filled with a colour; `morph` 0..1 cross-fades it into the pill. */
export const Shp: React.FC<{shape: Shape; size: number; color: string; morph?: number; style?: React.CSSProperties}> = ({shape, size, color, morph = 0, style}) => (
  <svg width={size * 1.6} height={size} viewBox={`0 0 ${size * 1.6} ${size}`} style={{display: 'block', overflow: 'visible', ...style}}>
    {morph < 1 ? <path d={SHAPE_PATH(shape, size)} fill={color} opacity={f3(1 - morph)} /> : null}
    {morph > 0 ? <path d={SHAPE_PATH('pill', size)} fill={color} opacity={f3(morph)} /> : null}
  </svg>
);
/** The three window buttons of a drawn app window. */
export const TrafficLights: React.FC<{size?: number}> = ({size = 14}) => <div style={{display: 'flex', gap: size * 0.6}}>
  {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <span key={c} style={{width: size, height: size, borderRadius: size / 2, background: c, display: 'block'}} />)}
</div>;
