// liquid-glass «chat-thread»: one large glass window holds the conversation. bubbles and typing: frosted glass for them, cyan glass for me.
// notifications: the newest banner is a hero with a glass orb on its start side; older banners recede in depth behind it.
import React from 'react';
import {Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import {SceneStickerSlot} from '../../../creative-kit/sticker-view';
import {chatMessageFrames, chatTypingFrames, notificationCards} from '../../../creative-kit/chat-thread/timing';
import type {ChatThreadData} from '../../../creative-kit/chat-thread/schema';
import {isArabic} from '../../../core/type';
import type {FamilyDesignProps} from '../../family-designs';
import {C, GLOW, MONO, X0, CW, RIM_MASK, clamp01, mix, ramp, rgba, widthOf, fit, Glass, Orb, DesignScene, instrumentFont, type BodyProps} from './kit';
import {ZONE, Settled, enter, Pill, type GlassScope} from './family-parts';

type ChatD = ChatThreadData & GlassScope;
type Message = ChatD['messages'][number];

const BUBBLE_W = 800, PADX = 34, PADY = 26, MARGIN = 34, TYPING = {w: 196, h: 92}, AREA_PAD = 22;
/** Bubble text is never below 46 px; a short thread grows to the largest size at which the whole thread fits the window. */
const TEXT_SIZES = [72, 66, 60, 56, 52, 48, 46];
/** The message area reaches this far under the header, so an older bubble leaves by fading as a whole and is never cut. */
const UNDER = 60;
const ARRIVE = Easing.bezier(0.16, 1, 0.3, 1);

const bubbleGeo = (text: string, font: string, size: number) => {
  const t = fit(text, font, 500, BUBBLE_W - 2 * PADX, {size, min: size, lines: 8}, 1.38);
  return {t, w: Math.ceil(t.width) + 2 * PADX, h: t.lines.length * t.box + 2 * PADY};
};
/** Opacity of a bubble from where its top edge is (relative to the header): fully visible in its resting place, gone before any text could be clipped. */
const fadeUnder = (top: number) => { const k = clamp01((top + 44) / 58); return k * k * (3 - 2 * k); };

const sideStyle = (copy: GlassScope['copy'], from: Message['from'], margin: number): React.CSSProperties =>
  from === 'them' ? {[copy.side]: margin} : {[copy.opposite]: margin};

const meRim = `linear-gradient(135deg, rgba(190,248,255,0.95), ${rgba(C.cyan, 0.3)} 58%, ${rgba(C.violet, 0.55)})`;
const themRim = 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.1) 58%, rgba(255,255,255,0.28))';
const meFill = `linear-gradient(160deg, ${rgba(C.cyan, 0.36)}, rgba(60,130,255,0.16))`;
const themFill = 'linear-gradient(160deg, rgba(255,255,255,0.2), rgba(255,255,255,0.07))';

/** One specular streak across a piece of glass when its state changes (a message lands). */
const Streak: React.FC<{p: number; radius: number}> = ({p, radius}) => p > 0 && p < 1
  ? <div style={{position: 'absolute', inset: 0, borderRadius: radius, overflow: 'hidden', pointerEvents: 'none'}}>
    <div style={{position: 'absolute', top: -10, bottom: -10, left: `${mix(-45, 120, p)}%`, width: '34%', transform: 'skewX(-20deg)', opacity: Math.sin(Math.PI * p),
      background: 'linear-gradient(90deg, rgba(190,245,255,0), rgba(190,245,255,0.45), rgba(255,255,255,0.65), rgba(190,245,255,0.45), rgba(190,245,255,0))'}}/>
  </div> : null;

// ---------- glass pieces ----------
const GlassBubble: React.FC<{d: ChatD; m: Message; w: number; h: number; p: number; fade: number; sweep: number; glow: number; lines: string[]; size: number; box: number}> = ({d, m, w, h, p, fade, sweep, glow, lines, size, box}) => {
  const me = m.from === 'me';
  const tail = (me === d.copy.ar) ? 'borderBottomLeftRadius' : 'borderBottomRightRadius';
  const radius = {borderRadius: 42, [tail]: 12} as React.CSSProperties;
  return <div style={{position: 'absolute', width: w, height: h, ...radius, ...sideStyle(d.copy, m.from, MARGIN),
    opacity: clamp01(p * 1.4) * fade, transform: `translateY(${(1 - p) * 40}px)`, filter: p < 0.95 ? `blur(${(1 - p) * 14}px)` : undefined}}>
    <div style={{position: 'absolute', inset: 0, ...radius, background: me ? meFill : themFill,
      boxShadow: me ? `0 22px 50px rgba(0,0,0,0.35), 0 0 ${40 + 40 * glow}px ${rgba(C.cyan, 0.2 + 0.25 * glow)}` : '0 22px 50px rgba(0,0,0,0.3)'}}/>
    <div style={{position: 'absolute', inset: 0, ...radius, padding: 1.5, boxSizing: 'border-box', ...RIM_MASK, background: me ? meRim : themRim}}/>
    <div style={{position: 'absolute', top: 1, left: 30, right: 30, height: 1.5, background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.8), rgba(255,255,255,0))'}}/>
    <div style={{position: 'absolute', inset: 0, padding: `${PADY}px ${PADX}px`, direction: isArabic(m.text) ? 'rtl' : 'ltr'}}>
      {lines.map((line, i) => <div key={i} style={{height: box, lineHeight: `${box}px`, fontFamily: d.font, fontWeight: 500, fontSize: size, color: '#fff', whiteSpace: 'nowrap', textAlign: 'start', textShadow: '0 2px 14px rgba(5,9,22,0.35)'}}>{line}</div>)}
    </div>
    <Streak p={sweep} radius={42}/>
  </div>;
};

const TypingCapsule: React.FC<{d: ChatD; from: Message['from']; p: number}> = ({d, from, p}) => {
  const f = useCurrentFrame();
  const me = from === 'me', {w, h} = TYPING;
  const place = sideStyle(d.copy, from, MARGIN);
  return <div data-chat-typing={'left' in place ? 'left' : 'right'} style={{position: 'absolute', width: w, height: h, borderRadius: h / 2, ...place, opacity: clamp01(p * 1.3), transform: `translateY(${(1 - p) * 26}px) scale(${0.92 + 0.08 * p})`,
    filter: p < 0.95 ? `blur(${(1 - p) * 8}px)` : undefined}}>
    <div style={{position: 'absolute', inset: 0, borderRadius: h / 2, boxShadow: '0 20px 44px rgba(0,0,0,0.3)', background: me ? meFill : themFill}}/>
    <div style={{position: 'absolute', inset: 0, borderRadius: h / 2, padding: 1.5, boxSizing: 'border-box', ...RIM_MASK, background: me ? meRim : themRim}}/>
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, direction: 'ltr'}}>
      {[0, 1, 2].map(k => { const pulse = Math.max(0, Math.sin(f * 0.32 - k * 0.9)); return <div key={k} style={{width: 24, height: 24, borderRadius: 12, background: '#fff', opacity: 0.5 + 0.5 * pulse,
        transform: `scale(${0.72 + 0.4 * pulse}) translateY(${-6 * pulse}px)`, boxShadow: `0 0 ${10 + 22 * pulse}px ${rgba(C.cyan, 0.5 + 0.5 * pulse)}`}}/>; })}
    </div>
  </div>;
};

const SendArrow: React.FC<{ar: boolean; color: string}> = ({ar, color}) =>
  <svg width="38" height="38" viewBox="0 0 100 100" style={ar ? undefined : {transform: 'scaleX(-1)'}}>
    <path d="M82 50 L22 50 M48 24 L20 50 L48 76" fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;

/** A round glass bead holding the first letter of the title. */
const Avatar: React.FC<{letter: string; size: number}> = ({letter, size}) => {
  const f = useCurrentFrame();
  return <div style={{position: 'relative', width: size, height: size, flex: 'none', ...enter(f, 6, {rise: 18, blur: 10})}}>
    <div style={{position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: `0 14px 34px rgba(0,0,0,0.4), 0 0 38px ${rgba(C.cyan, 0.3)}`,
      background: `radial-gradient(circle at 34% 24%, rgba(255,255,255,0.5), rgba(255,255,255,0.08) 42%, ${rgba(C.cyan, 0.22)} 74%, ${rgba(C.violet, 0.4)} 100%)`}}/>
    <div style={{position: 'absolute', inset: 0, borderRadius: '50%', padding: 2, boxSizing: 'border-box', ...RIM_MASK, background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.2) 55%, rgba(100,228,255,0.8))'}}/>
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plex Display', fontWeight: 700, fontSize: size * 0.54, lineHeight: 1, color: '#fff', textShadow: GLOW}}>{letter}</div>
  </div>;
};

// ---------- bubbles and typing ----------
const Thread: React.FC<{d: ChatD}> = ({d}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const times = chatMessageFrames(d, fps), typingF = chatTypingFrames(fps), typing = d.variant === 'typing';
  const header = Boolean(d.title || d.app);
  const winTop = d.sticker ? 516 : ZONE.top + 4, winH = ZONE.bottom - winTop;
  const headH = header ? 132 : 0, footH = 142, areaH = winH - headH - footH, room = areaH - AREA_PAD - 18;
  const gapBefore = d.messages.map((m, i) => i === 0 ? 0 : d.messages[i - 1].from === m.from ? 14 : 24);
  const sized = (size: number) => d.messages.map(m => bubbleGeo(m.text, d.font, size));
  const fitsWindow = (g: ReturnType<typeof sized>) => g.reduce((sum, b, i) => sum + b.h + gapBefore[i], 0) <= room;
  const geo = sized(TEXT_SIZES.find(s => fitsWindow(sized(s))) ?? TEXT_SIZES[TEXT_SIZES.length - 1]);
  const arrive = times.map(at => ramp(f, at, 16, ARRIVE));
  const typeIn = times.map(at => typing ? ramp(f, at - typingF, 8) : 0);
  // The space each message takes in the thread: the typing capsule first, then the bubble that replaces it.
  const slot = d.messages.map((_, i) => {
    const lead = gapBefore[i] * Math.max(typeIn[i], arrive[i]), typed = TYPING.h * typeIn[i];
    return lead + typed + (geo[i].h - typed) * ramp(f, times[i], 14);
  });
  // A real thread: messages flow down from the top, and once the window is full the newest push the older ones up.
  const total = slot.reduce((a, b) => a + b, 0), scroll = Math.max(0, total - room);
  const top = d.messages.map((_, i) => AREA_PAD + slot.slice(0, i).reduce((a, b) => a + b, 0) + gapBefore[i] * Math.max(typeIn[i], arrive[i]) - scroll);
  const title = d.title ?? d.app ?? '';
  const initial = Array.from(title.trim())[0] ?? '';
  const appFont = d.app ? instrumentFont(d.app, d.font) : d.font;
  const appW = d.app ? Math.ceil(widthOf(d.app, appFont, 28, 600, appFont === MONO ? 1 : 0)) + 52 : 0;
  const titleW = CW - 2 * 36 - 84 - 26 - (d.title && d.app ? appW + 26 : 0);
  const titleFit = fit(title || ' ', d.font, 700, titleW, {size: 56, min: 36, lines: 1}, 1.2);
  const sendPulse = Math.max(0, ...d.messages.map((m, i) => m.from === 'me' ? Math.max(0, 1 - Math.abs(f - (times[i] - 2)) / 10) : 0));
  return <>
    <Orb x={720} y={winTop + 300} d={540} at={4}/>
    <Glass x={X0} y={winTop} w={CW} h={winH} r={60} at={2} dark={0.8} thick active={0.7 * sendPulse}>
      <div style={{position: 'absolute', left: 0, top: headH - UNDER, width: CW, height: areaH + UNDER, overflow: 'hidden'}}>
        {d.messages.map((m, i) => {
          const g = geo[i], p = arrive[i], fade = fadeUnder(top[i]), y = top[i] + UNDER;
          return <React.Fragment key={i}>
            {typing && typeIn[i] > 0 && p < 1 ? <div style={{position: 'absolute', left: 0, top: y, width: CW, height: TYPING.h, opacity: fade}}><TypingCapsule d={d} from={m.from} p={typeIn[i] * (1 - p)}/></div> : null}
            {p > 0 ? <div style={{position: 'absolute', left: 0, top: y, width: CW, height: g.h}}>
              <GlassBubble d={d} m={m} w={g.w} h={g.h} p={p} fade={fade} sweep={clamp01((f - times[i] - 2) / 16)} glow={m.from === 'me' ? Math.max(0, 1 - (f - times[i]) / 26) : 0} lines={g.t.lines} size={g.t.size} box={g.t.box}/>
            </div> : null}
          </React.Fragment>;
        })}
      </div>
      {header ? <div style={{position: 'absolute', left: 0, top: 0, width: CW, height: headH, borderRadius: '60px 60px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.025))',
        boxShadow: 'inset 0 -1.5px 0 rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', gap: 26, padding: '0 36px', direction: d.copy.dir}}>
        <Avatar letter={initial} size={84}/>
        <div style={{flex: 1, minWidth: 0, fontFamily: d.font, fontWeight: 700, fontSize: titleFit.size, color: '#fff', whiteSpace: 'nowrap', textShadow: GLOW, lineHeight: 1.2, ...enter(f, 8, {rise: 20, blur: 10})}}>{title}</div>
        {d.title && d.app ? <Pill w={appW} h={54} at={12}><span style={{fontFamily: appFont, fontWeight: 600, fontSize: 28, letterSpacing: appFont === MONO ? 1 : 0, color: C.cyan, direction: isArabic(d.app) ? 'rtl' : 'ltr', whiteSpace: 'nowrap'}}>{d.app}</span></Pill> : null}
      </div> : null}
      <div style={{position: 'absolute', left: 34, right: 34, bottom: 30, height: 92, borderRadius: 46, background: 'rgba(5,9,22,0.42)', boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.4), 0 0 0 1.5px rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', padding: 12, direction: d.copy.dir, ...enter(f, 12, {rise: 20, blur: 8})}}>
        <div style={{flex: 1}}/>
        <div style={{width: 68, height: 68, borderRadius: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 + 0.14 * sendPulse})`,
          background: `radial-gradient(circle at 36% 28%, #fff 0%, ${C.cyan} 48%, #1f9fc4 100%)`, boxShadow: `0 0 ${24 + 40 * sendPulse}px ${rgba(C.cyan, 0.45 + 0.4 * sendPulse)}`}}>
          <SendArrow ar={d.copy.ar} color={C.ink}/>
        </div>
      </div>
    </Glass>
  </>;
};

// ---------- notifications ----------
// The newest banner is a hero: 950 px wide, text 48 px and up, a glass orb on its start side. A banner that is pushed back crossfades to a
// compact layout (text 47 px and up) and recedes by scale, blur and dim; the scale never drops below 0.86, so its text stays at 40 px and up.
const HERO = {orb: 200, pad: 36, title: 38, head: 54, text: {size: 56, min: 48, lines: 4}, radius: 64};
const COMPACT = {orb: 88, pad: 28, title: 34, head: 44, text: {size: 50, min: 47, lines: 4}, radius: 52};
const NOTE_ORB_GAP = 28;
const noteScale = (depth: number) => Math.max(0.86, 1 - 0.04 * depth);

type NoteLayout = {t: ReturnType<typeof fit>; titleFit: ReturnType<typeof fit> | null; textW: number; h: number};
const noteLayout = (d: ChatD, m: Message, k: typeof HERO | typeof COMPACT, appW: number): NoteLayout => {
  const textW = CW - 2 * k.pad - k.orb - NOTE_ORB_GAP;
  const t = fit(m.text, d.font, 600, textW, k.text, 1.3);
  const titleFit = d.title ? fit(d.title, d.font, 700, textW - (appW ? appW + 18 : 0), {size: k.title, min: 26, lines: 1}, 1.25) : null;
  return {t, titleFit, textW, h: Math.max(k.orb + 2 * k.pad, k.pad + k.head + 8 + t.lines.length * t.box + k.pad)};
};

/** The glass orb icon of a banner, drawn like the counter sphere, with a bell on it. `x` is its centre from the left edge of the banner. */
const BellOrb: React.FC<{x: number; d: number; at: number; cy: number}> = ({x, d, at, cy}) => {
  return <>
    <div style={{position: 'absolute', left: x - d * 0.7, top: cy - d * 0.7, width: d * 1.4, height: d * 1.4, borderRadius: '50%', background: `radial-gradient(closest-side, ${rgba(C.cyan, 0.4)}, ${rgba(C.violet, 0.16)} 60%, ${rgba(C.violet, 0)})`}}/>
    <Orb x={x} y={cy} d={d} at={at}/>
    <svg width={d * 0.46} height={d * 0.46} viewBox="0 0 60 60" style={{position: 'absolute', left: x - d * 0.23, top: cy - d * 0.23, filter: `drop-shadow(0 0 ${d * 0.06}px ${rgba(C.cyan, 0.9)})`}}>
      <path d="M30 8 C20 8 14 16 14 26 L14 34 L9 41 H51 L46 34 V26 C46 16 40 8 30 8 Z M24 47 H36" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </>;
};

const NoteContent: React.FC<{d: ChatD; m: Message; k: typeof HERO | typeof COMPACT; lay: NoteLayout; appW: number; at: number; opacity: number}> = ({d, m, k, lay, appW, at, opacity}) => {
  const appFont = d.app ? instrumentFont(d.app, d.font) : d.font;
  const colStart = k.pad + k.orb + NOTE_ORB_GAP;
  return <div style={{position: 'absolute', left: 0, top: 0, width: CW, height: lay.h, opacity}}>
    <BellOrb x={d.copy.ar ? CW - k.pad - k.orb / 2 : k.pad + k.orb / 2} d={k.orb} at={at} cy={lay.h / 2}/>
    <div style={{position: 'absolute', [d.copy.opposite]: k.pad, [d.copy.side]: colStart, top: k.pad, display: 'flex', alignItems: 'center', gap: 18, height: k.head, direction: d.copy.dir}}>
      {lay.titleFit ? <div style={{flex: 1, minWidth: 0, fontFamily: d.font, fontWeight: 700, fontSize: lay.titleFit.size, color: 'rgba(255,255,255,0.92)', whiteSpace: 'nowrap', lineHeight: 1.3}}>{d.title}</div> : <div style={{flex: 1}}/>}
      {d.app ? <div style={{width: appW, height: k.head - 6, borderRadius: 24, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,9,22,0.4)', boxShadow: `inset 0 0 0 1.5px ${rgba(C.cyan, 0.55)}`,
        fontFamily: appFont, fontWeight: 600, fontSize: 26, letterSpacing: appFont === MONO ? 1 : 0, color: C.cyan, whiteSpace: 'nowrap', direction: isArabic(d.app) ? 'rtl' : 'ltr'}}>{d.app}</div> : null}
    </div>
    <div style={{position: 'absolute', [d.copy.opposite]: k.pad, [d.copy.side]: colStart, top: k.pad + k.head + 8, direction: isArabic(m.text) ? 'rtl' : 'ltr'}}>
      {lay.t.lines.map((line, i) => <div key={i} style={{height: lay.t.box, lineHeight: `${lay.t.box}px`, fontFamily: d.font, fontWeight: 600, fontSize: lay.t.size, color: '#fff', whiteSpace: 'nowrap', textAlign: 'start', textShadow: GLOW}}>{line}</div>)}
    </div>
  </div>;
};

type NoteGeo = {hero: NoteLayout; comp: NoteLayout; appW: number};
const noteHeight = (g: NoteGeo, depth: number) => mix(g.hero.h, g.comp.h, clamp01(depth));

const Banner: React.FC<{d: ChatD; m: Message; g: NoteGeo; at: number; p: number; depth: number; sweep: number}> = ({d, m, g, at, p, depth, sweep}) => {
  const me = m.from === 'me', d1 = clamp01(depth), newest = 1 - d1, h = noteHeight(g, depth), radius = mix(HERO.radius, COMPACT.radius, d1);
  const bf = 'blur(22px) saturate(150%)';
  const rim = me ? meRim : `linear-gradient(135deg, rgba(255,255,255,${0.55 + 0.2 * newest}), rgba(255,255,255,0.1) 58%, rgba(255,255,255,0.28))`;
  return <div style={{position: 'absolute', left: 0, top: 0, width: CW, height: h, opacity: clamp01(p * 1.4) * Math.max(0.15, 1 - 0.15 * depth),
    transform: `translateY(${-(1 - p) * 150}px) scale(${noteScale(depth)})`, transformOrigin: '50% 0%', filter: depth > 0.05 || p < 0.95 ? `blur(${(1 - p) * 12 + 0.7 * depth}px)` : undefined}}>
    <div style={{position: 'absolute', inset: 0, borderRadius: radius, boxShadow: `0 ${34 - 10 * depth}px 70px rgba(0,0,0,0.4), 0 0 ${70 * newest}px ${rgba(C.cyan, 0.24 * newest)}`}}/>
    <div style={{position: 'absolute', inset: 0, borderRadius: radius, backdropFilter: bf, WebkitBackdropFilter: bf,
      background: me ? `linear-gradient(160deg, ${rgba(C.cyan, 0.3)}, rgba(60,130,255,0.12))` : 'radial-gradient(120% 80% at 12% 0%, rgba(255,255,255,0.26), rgba(255,255,255,0) 58%), linear-gradient(160deg, rgba(255,255,255,0.16), rgba(255,255,255,0.06))'}}/>
    <div style={{position: 'absolute', inset: 10, borderRadius: radius - 8, background: 'rgba(5,9,22,0.2)'}}/>
    <div style={{position: 'absolute', inset: 0, borderRadius: radius, padding: 1.5 + 1.5 * newest, boxSizing: 'border-box', ...RIM_MASK, background: rim}}/>
    <div style={{position: 'absolute', top: 1, left: 50, right: 50, height: 1.5, background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.85), rgba(255,255,255,0))'}}/>
    {d1 < 1 ? <NoteContent d={d} m={m} k={HERO} lay={g.hero} appW={g.appW} at={at} opacity={1 - d1}/> : null}
    {d1 > 0 ? <NoteContent d={d} m={m} k={COMPACT} lay={g.comp} appW={g.appW} at={0} opacity={d1}/> : null}
    <Streak p={sweep} radius={radius}/>
  </div>;
};

const Notifications: React.FC<{d: ChatD}> = ({d}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const times = chatMessageFrames(d, fps);
  const appFont = d.app ? instrumentFont(d.app, d.font) : d.font;
  const appW = d.app ? Math.ceil(widthOf(d.app, appFont, 26, 600, appFont === MONO ? 1 : 0)) + 44 : 0;
  const geo: NoteGeo[] = d.messages.map(m => ({hero: noteLayout(d, m, HERO, appW), comp: noteLayout(d, m, COMPACT, appW), appW}));
  const cards = notificationCards(d, f, fps);
  // The settled stack (the newest five) fills the zone from y 300 to 1150: the gaps stretch for a short thread and squeeze into a deck for a tall one.
  const top = d.sticker ? 516 : 300, avail = ZONE.bottom - top;
  const last = d.messages.map((_, i) => i).slice(-5).reverse();
  const heights = last.map((idx, k) => noteHeight(geo[idx], k) * noteScale(k)), sum = heights.reduce((a, b) => a + b, 0);
  const gap = last.length > 1 ? Math.max(-30, Math.min(56, (avail - sum) / (last.length - 1))) : 0;
  const stackTop = top + Math.max(0, (avail - (sum + gap * (last.length - 1))) / 2);
  let offset = 0;
  const placed = cards.map(c => {
    const y = stackTop + offset;
    offset += c.enter * (noteHeight(geo[c.index], c.depth) * noteScale(c.depth) + gap);
    return {...c, y};
  });
  return <>
    {placed.slice().reverse().map(c => <div key={c.index} data-notification={c.index} style={{position: 'absolute', left: X0, top: c.y, width: CW, height: noteHeight(geo[c.index], c.depth), zIndex: 20 - Math.round(c.depth * 2)}}>
      <Banner d={d} m={d.messages[c.index]} g={geo[c.index]} at={times[c.index] + 2} p={c.enter} depth={c.depth} sweep={clamp01((f - times[c.index] - 4) / 16)}/>
    </div>)}
  </>;
};

// ---------- scene ----------
const ChatBody: React.FC<BodyProps> = ({d}) => {
  const data = d as ChatD;
  return <>
    {data.variant === 'notifications' ? <Notifications d={data}/> : <Thread d={data}/>}
    <SceneStickerSlot host="chat-thread" sticker={data.sticker} ink="#FFFFFF"/>
  </>;
};

export const ChatThread: React.FC<FamilyDesignProps> = props => {
  if (props.scene.family !== 'chat-thread') return null;
  const last = Math.max(0, ...chatMessageFrames(props.scene.data));
  return <Settled after={Math.max(900, last + 90)}><DesignScene {...props} tone={2} Body={ChatBody}/></Settled>;
};
