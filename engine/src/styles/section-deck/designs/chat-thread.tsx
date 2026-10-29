// section-deck chat-thread: a chat slide. The title is a Cairo 900 headline with an accent avatar, bubbles are solid geometric blocks that slide in
// through a mask and push older ones up under a faded top, and notifications are stacked slide cards with big outlined index numerals.
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {measure} from '../../../core/type';
import type {FamilyDesignProps} from '../../family-designs';
import type {ChatThreadData} from '../../../creative-kit/chat-thread/schema';
import {chatMessageFrames, chatTypingFrames, notificationCards} from '../../../creative-kit/chat-thread/timing';
import {SceneStickerSlot} from '../../../creative-kit/sticker-view';
import {useDesignData} from '../../../style-kit/digits';
import {CW, W, X0, X1, Ground, MaskLines, clamp01, fit, mix, pop, ramp, sectionNumeral} from './kit';
import {STICKER_FLOOR, ZONE_BOTTOM, ZONE_TOP, Settled, headWidth, startEdge, useDeck, type Deck} from './family-parts';

const AVATAR = 128, KICKER_ROOM = 64, AVATAR_LIFT = 12;
const RADIUS = 30, TIGHT = 6, TEXT_MIN = 44, LH = 1.3;
const NOTE_PAD = 26, NOTE_GAP = 18, NOTE_NUMERAL = 150, NOTE_NUMERAL_W = 210;

/** The first letter of the title for the avatar; the Arabic article «ال» is not a letter worth showing. */
const initialOf = (title: string) => {
  const word = title.trim().split(/\s+/)[0] ?? '';
  const letters = Array.from(word.replace(/^ال(?=\p{L}{2})/u, ''));
  return (letters[0] ?? '').toLocaleUpperCase();
};

/** Header geometry: the title fits one line when it can, else two. The app name rides above as a small accent line when the title is also there. */
const headerOf = (d: ChatThreadData, deck: Deck) => {
  const title = d.title ?? d.app;
  if (!title) return null;
  const width = headWidth(!!d.sticker), room = width - AVATAR - 30;
  const t = fit(title, {width: room, size: 100, min: 60, lines: 2, weight: 900, lh: 1.3}, deck.P.font);
  const kicker = d.title && d.app ? d.app : null, height = Math.max(AVATAR, t.lines.length * t.box), top = ZONE_TOP + (kicker ? KICKER_ROOM : 0);
  return {title, kicker, width, room, size: 100, height, top, bottom: top + height, right: startEdge(!!d.sticker, deck.copy.ar), textH: t.lines.length * t.box};
};
type Header = NonNullable<ReturnType<typeof headerOf>>;

const Header: React.FC<{h: Header; deck: Deck}> = ({h, deck}) => {
  const {copy, P} = deck;
  const f = useCurrentFrame();
  const k = pop(f, 2, 12, 200);
  return <>
    {h.kicker ? <div style={{position: 'absolute', top: ZONE_TOP, [copy.side]: h.right, display: 'flex', alignItems: 'center', gap: 18, direction: copy.dir}}>
      <div style={{width: 64 * ramp(f, 2, 14), height: 8, background: P.accent, borderRadius: 4}}/>
      <div style={{fontFamily: P.font, fontWeight: 700, fontSize: 36, color: P.accent, whiteSpace: 'nowrap', opacity: ramp(f, 6, 14)}}>{h.kicker}</div>
    </div> : null}
    <div style={{position: 'absolute', top: h.top + (h.height - AVATAR) / 2, [copy.side]: h.right, width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, background: P.accent, color: P.accentInk, fontFamily: P.font, fontWeight: 900, fontSize: 78,
      lineHeight: `${AVATAR}px`, textAlign: 'center', transform: `scale(${mix(0.5, 1, k)})`, opacity: ramp(f, 2, 8)}}>
      <span style={{display: 'block', transform: `translateY(${-AVATAR_LIFT}px)`}}>{initialOf(h.title)}</span>
    </div>
    <MaskLines copy={copy} text={h.title} top={h.top + (h.height - h.textH) / 2} width={h.room} right={h.right + AVATAR + 30} size={h.size} min={60} lines={2} lh={1.3} at={4}/>
  </>;
};

type Bubble = {from: 'me' | 'them'; lines: string[]; size: number; box: number; w: number; h: number; at: number; y: number; padX: number; padY: number; radius: number; hero: boolean};
type Look = {size: number; padX: number; padY: number; maxW: number; radius: number; hero: boolean};
const BASE: Look = {size: 52, padX: 38, padY: 28, maxW: 800, radius: 30, hero: false};
const heroLook = (size: number, maxW: number): Look => ({size, padX: 50, padY: 40, maxW, radius: 44, hero: true});
const HERO_SIZES = [80, 72, 64];
/** Below y 1150 the platform rail owns x 853 and up, so a thread may run on to the caption margin only when its last bubble stays left of it. */
const THREAD_FLOOR = 1236, RAIL_X = 853;

/** A message wrapped to the fewest lines at the biggest size, then narrowed while the line count holds, so no word is left alone. */
const wrap = (text: string, look: Look, font: string) => {
  const maxW = look.maxW - 2 * look.padX, base = {min: look.hero ? look.size : TEXT_MIN, lines: 8, weight: 700, lh: LH, warn: false};
  let t = fit(text, {...base, width: maxW, size: look.size}, font), width = maxW;
  for (let i = 0; i < 40 && width > 240; i++) {
    const next = fit(text, {...base, width: width - 20, size: t.size, min: t.size, lines: t.lines.length}, font);
    if (!next.fits || next.lines.length > t.lines.length) break;
    t = next; width -= 20;
  }
  return t;
};
/** The last message is the hero of the thread: a bigger, wider block. Earlier messages stay at the base size. */
const layoutBubbles = (d: ChatThreadData, times: number[], font: string, hero: Look, gap: number): Bubble[] => {
  let y = 0;
  return d.messages.map((m, i) => {
    const look = i === d.messages.length - 1 ? hero : BASE;
    const t = wrap(m.text, look, font);
    const w = Math.ceil(Math.max(...t.lines.map(line => measure(line, {fontFamily: font, fontSize: t.size, fontWeight: 700}).width))) + 2 * look.padX;
    const h = t.lines.length * t.box + 2 * look.padY, item = {from: m.from, lines: t.lines, size: t.size, box: t.box, w, h, at: times[i], y, padX: look.padX, padY: look.padY, radius: look.radius, hero: look.hero};
    y += h + gap;
    return item;
  });
};
const totalOf = (items: Bubble[], gap: number) => items.reduce((sum, b) => sum + b.h, 0) + gap * (items.length - 1);
const leftOf = (b: Bubble, ar: boolean) => ((b.from === 'them') === ar ? X1 - b.w : X0);

/** Corner radii: one squared corner at the sender's side, at the bottom. */
const corners = (from: 'me' | 'them', ar: boolean, radius: number) => {
  const bottomRight = (from === 'them') === ar;
  return `${radius}px ${radius}px ${bottomRight ? TIGHT : radius}px ${bottomRight ? radius : TIGHT}px`;
};

const TypingDots: React.FC<{from: 'me' | 'them'; deck: Deck; at: number}> = ({from, deck, at}) => {
  const {copy, P} = deck;
  const f = useCurrentFrame();
  const color = from === 'me' ? P.accentInk : P.ink;
  return <div style={{width: 200, height: 110, borderRadius: corners(from, copy.ar, RADIUS), background: from === 'me' ? P.accent : 'rgba(255,255,255,0.11)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18,
    transform: `scale(${mix(0.6, 1, pop(f, at, 13, 200))})`, transformOrigin: (from === 'me') === copy.ar ? '0% 100%' : '100% 100%'}}>
    {[0, 1, 2].map(i => <div key={i} style={{width: 22, height: 22, borderRadius: 11, background: color, opacity: 0.45 + 0.55 * Math.max(0, Math.sin((f - at) * 0.34 - i * 0.9)), transform: `translateY(${-9 * Math.max(0, Math.sin((f - at) * 0.34 - i * 0.9))}px)`}}/>)}
  </div>;
};

const Thread: React.FC<{d: ChatThreadData; deck: Deck; top: number}> = ({d, deck, top}) => {
  const {copy, P} = deck;
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const times = chatMessageFrames(d, fps), lead = chatTypingFrames(fps), typing = d.variant === 'typing', n = d.messages.length;
  // The hero is the biggest size at which the last bubble takes no more than 45% of the window; if none does, the thread keeps one size and scrolls.
  const leftSide = (d.messages[n - 1].from === 'them') !== copy.ar, heroW = leftSide ? RAIL_X - X0 : 900;
  const plan = (look: Look, gap: number) => {
    const items = layoutBubbles(d, times, P.font, look, gap), last = items[items.length - 1];
    const bottom = leftOf(last, copy.ar) + last.w < RAIL_X ? THREAD_FLOOR : ZONE_BOTTOM;
    return {items, look, windowH: bottom - top, gap};
  };
  const chosen = [...HERO_SIZES.map(size => plan(heroLook(size, heroW), 28)), plan({...BASE, size: 56, padY: 32}, 32)]
    .find(p => p.items[p.items.length - 1].h <= p.windowH * 0.45 || !p.items[p.items.length - 1].hero)!;
  // A short thread spreads its gaps and sits on the bottom of the window; a long one scrolls.
  const slack = chosen.windowH - totalOf(chosen.items, chosen.gap), gap = n > 1 ? chosen.gap + Math.max(0, Math.min(48, slack / (n - 1))) : chosen.gap;
  const items = layoutBubbles(d, times, P.font, chosen.look, gap);
  const windowH = chosen.windowH, total = totalOf(items, gap), off = n > 1 ? Math.max(0, windowH - total) : Math.max(0, (windowH - total) / 2);
  const starts = items.map(b => (typing ? b.at - lead : b.at));
  let scroll = 0, prev = 0;
  items.forEach((b, i) => {
    const target = Math.max(0, b.y + b.h - windowH);
    if (f >= starts[i]) { scroll = mix(prev, target, ramp(f, starts[i], 16)); prev = target; }
  });
  const fade = Math.round(48 * clamp01(scroll / 40)), mask = `linear-gradient(180deg, transparent 0px, #000 ${fade}px)`;
  return <div style={{position: 'absolute', left: 0, top, width: W, height: windowH, overflow: 'hidden', WebkitMaskImage: mask, maskImage: mask}}>
    {items.map((b, i) => {
      const atStart = b.from === 'them', dir = atStart === copy.ar ? 1 : -1;
      // The hero arrives with the longest, hardest slide and a small pop.
      const e = ramp(f, b.at, b.hero ? 24 : 16), travel = b.hero ? 220 : 90, pulse = b.hero ? mix(0.9, 1, pop(f, b.at, 12, 150)) : 1;
      const left = leftOf(b, copy.ar), y = off + b.y - scroll;
      const dots = typing && f >= starts[i] && f < b.at;
      const reveal = (1 - e) * 100;
      return <React.Fragment key={i}>
        {dots ? <div data-chat-typing={atStart === copy.ar ? 'right' : 'left'} style={{position: 'absolute', top: y, left: atStart === copy.ar ? X1 - 200 : X0}}><TypingDots from={b.from} deck={deck} at={starts[i]}/></div> : null}
        {f >= b.at ? <div style={{position: 'absolute', top: y, left, width: b.w, height: b.h, borderRadius: corners(b.from, copy.ar, b.radius), background: b.from === 'me' ? P.accent : 'rgba(255,255,255,0.11)',
          boxShadow: b.from === 'me' ? '0 18px 40px rgba(0,0,0,0.28)' : 'inset 0 0 0 2px rgba(255,255,255,0.06)', transform: `translateX(${dir * (1 - e) * travel}px) scale(${pulse})`,
          transformOrigin: atStart === copy.ar ? '100% 100%' : '0% 100%', clipPath: dir > 0 ? `inset(-10px -10px -10px ${reveal}%)` : `inset(-10px ${reveal}% -10px -10px)`, direction: copy.dir, textAlign: copy.align}}>
          <div style={{position: 'absolute', top: b.padY, [copy.side]: b.padX, fontFamily: P.font, fontWeight: 700, fontSize: b.size, color: b.from === 'me' ? P.accentInk : P.ink}}>
            {b.lines.map((line, k) => <div key={k} style={{height: b.box, lineHeight: `${b.box}px`, whiteSpace: 'pre'}}>{line}</div>)}
          </div>
        </div> : null}
      </React.Fragment>;
    })}
  </div>;
};

type Note = {i: number; lines: string[]; size: number; box: number; h: number; textH: number};
/** Cards are one size for the whole scene: the largest text at which the fullest stack of five still fits above the caption margin. */
const layoutNotes = (d: ChatThreadData, room: number, font: string): Note[] => {
  const textW = CW - NOTE_NUMERAL_W - 2 * NOTE_PAD - 18, k = Math.min(5, d.messages.length);
  const floor = Math.min(220, Math.floor((room - NOTE_GAP * (k - 1)) / k));
  const build = (size: number) => d.messages.map((m, i) => {
    const t = fit(m.text, {width: textW, size, min: size, lines: 6, weight: 700, lh: LH, warn: false}, font), textH = t.lines.length * t.box;
    return {i, lines: t.lines, size: t.size, box: t.box, textH, h: Math.max(floor, textH + 2 * NOTE_PAD), fits: t.fits};
  });
  const worst = (notes: Note[], count: number) => Math.max(...notes.map((_, s) => notes.slice(s, s + count).reduce((sum, c) => sum + c.h, 0) + NOTE_GAP * (Math.min(count, notes.length - s) - 1)));
  // Short copy keeps all five cards in view; long copy keeps the newest three and lets older ones sink under the faded bottom.
  for (const count of [5, 3]) {
    for (const size of [56, 52, 48, 44, 40, 36, 34]) { const notes = build(size); if (notes.every(c => c.fits) && worst(notes, count) <= room) return notes; }
  }
  return build(34);
};

const Notifications: React.FC<{d: ChatThreadData; deck: Deck; top: number}> = ({d, deck, top}) => {
  const {copy, P, shown} = deck;
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const room = ZONE_BOTTOM - top, notes = layoutNotes(d, room, P.font);
  const shownCards = notificationCards(d, f, fps);
  const newest = shownCards[0];
  const cards: {index: number; depth: number; enter: number; out: number}[] = shownCards.map(c => ({...c, out: 0}));
  // The card pushed out by a sixth arrival slides on down and fades while the new one drops in.
  if (newest && newest.enter < 1 && newest.index >= 5 && shownCards.length === 5) cards.push({index: newest.index - 5, depth: 5, enter: 1, out: 1 - newest.enter});
  let y = 0;
  const placed = cards.map(c => {
    const at = y;
    y += (notes[c.index].h + NOTE_GAP) * c.enter;
    return {...c, y: at};
  });
  const sinks = placed.some(c => c.y + notes[c.index].h * c.enter > room + 2), mask = sinks ? 'linear-gradient(180deg, #000 calc(100% - 90px), transparent 100%)' : undefined;
  return <div style={{position: 'absolute', left: 0, top, width: W, height: room, overflow: 'hidden', WebkitMaskImage: mask, maskImage: mask}}>
    {placed.map(c => {
      const n = notes[c.index], lit = clamp01(1 - c.depth), enter = c.enter, bar = lit > 0.5;
      const numeral = shown(String(c.index + 1).padStart(2, '0')), numSize = Math.round(Math.min(NOTE_NUMERAL, n.h * 0.8));
      return <div key={c.index} data-notification={c.index} style={{position: 'absolute', left: X0, top: c.y - (1 - enter) * (n.h + 30), width: CW, height: n.h, borderRadius: 30, overflow: 'hidden', direction: copy.dir,
        background: `rgba(255,255,255,${mix(0.07, 0.17, lit)})`, boxShadow: `inset 0 0 0 2px ${bar ? P.accent : 'rgba(255,255,255,0.08)'}`, opacity: enter * (1 - c.out) * mix(0.8, 1, lit)}}>
        <div style={{position: 'absolute', top: 0, bottom: 0, [copy.side]: 0, width: 16 * clamp01(lit * 2 - 0.4), background: P.accent}}/>
        <div style={{position: 'absolute', top: (n.h - n.textH) / 2, [copy.side]: NOTE_PAD + 24, width: CW - NOTE_NUMERAL_W - 2 * NOTE_PAD - 18, fontFamily: P.font, fontWeight: 700, fontSize: n.size, color: P.ink, opacity: mix(0.7, 1, lit)}}>
          {n.lines.map((line, k) => <div key={k} style={{height: n.box, lineHeight: `${n.box}px`, whiteSpace: 'pre'}}>{line}</div>)}
        </div>
        <div style={{position: 'absolute', top: 0, bottom: 0, [copy.opposite]: 28, width: NOTE_NUMERAL_W - 28, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'ltr', fontFamily: P.font, fontWeight: 900, fontSize: numSize,
          lineHeight: 1, color: 'transparent', WebkitTextStroke: `3px ${bar ? P.accent : 'rgba(255,255,255,0.3)'}`, letterSpacing: -4}}>{numeral}</div>
      </div>;
    })}
  </div>;
};

export const ChatThread: React.FC<FamilyDesignProps> = ({scene, sectionIndex}) => {
  if (scene.family !== 'chat-thread') return null;
  const d = useDesignData(scene.data), deck = useDeck(d), header = headerOf(d, deck);
  const top = Math.max(header ? header.bottom + 40 : ZONE_TOP, d.sticker ? STICKER_FLOOR : 0);
  return <Settled><AbsoluteFill style={deck.copy.ar ? undefined : {direction: deck.copy.dir}}>
    <Ground copy={deck.copy} tone={1} numeral={d.variant === 'notifications' ? undefined : sectionNumeral(sectionIndex)}/>
    {header ? <Header h={header} deck={deck}/> : null}
    {d.variant === 'notifications' ? <Notifications d={d} deck={deck} top={top}/> : <Thread d={d} deck={deck} top={top}/>}
    <SceneStickerSlot host="chat-thread" sticker={d.sticker} ink={deck.P.ink}/>
  </AbsoluteFill></Settled>;
};
