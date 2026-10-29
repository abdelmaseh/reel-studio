// kinetic-paper chat-thread: messages are paper strips slammed onto the page, the title is an ink header strip,
// notifications are tickets that drop in and stack. The newest strip is the hero; older strips shrink and are shoved up under the header.
import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import type {ChatThreadData} from '../../../creative-kit/chat-thread/schema';
import {chatMessageFrames, chatTypingFrames, notificationCards} from '../../../creative-kit/chat-thread/timing';
import {SceneStickerSlot} from '../../../creative-kit/sticker-view';
import {DesignText, useDesignText} from '../../../style-kit/digits';
import {CARD, CW, INK, LIME, MIS, MONO, PAPER, SANS, W, X0, X1, Ground, Kicker, Slam, widthOf, useDesign} from './kit';
import {DotBand, Printed, Settled, ZONE_BOTTOM, ZONE_TOP} from './family-parts';

const STICKER_EDGE = 828, BORDER = 7, SHADOW = 16, GAP = 34, TYPING = {w: 240, h: 124};
const TILT = [1.4, 1.0, 1.5, 0.8, 1.2, 0.9, 1.3, 1.0];
const FAN_X = [0, 14, -10, 12, -14, 8, -8, 10];
const BADGE = 96, KICKER_ROOM = 80;

type Item = {from: 'me' | 'them'; text: string; lines: string[]; size: number; box: number; w: number; h: number; at: number};
type Fit = ReturnType<ReturnType<typeof useDesign>['fit']>;

/** The first letter of the title for the black circle; the Arabic article «ال» is not a letter worth showing. */
const initialOf = (title: string) => {
  const word = title.trim().split(/\s+/)[0] ?? '';
  const letters = Array.from(word.replace(/^ال(?=\p{L}{2})/u, ''));
  return (letters[0] ?? '').toLocaleUpperCase();
};

/** Header geometry: the title fits one line when it can, else two smaller ones. The app name rides above as a kicker. */
const useHeader = (d: ChatThreadData) => {
  const {fit, canFit} = useDesign();
  const title = d.title ?? d.app;
  if (!title) return null;
  const width = d.sticker ? STICKER_EDGE - X0 : CW, room = width - 30 - BADGE - 26 - 36;
  const t: Fit = canFit(title, {width: room, size: 92, min: 64, lines: 1}) ? fit(title, {width: room, size: 92, min: 64, lines: 1}) : fit(title, {width: room, size: 72, min: 52, lines: 2});
  const kicker = d.title && d.app ? KICKER_ROOM : 0, height = t.lines.length * t.box + 36, top = ZONE_TOP + kicker;
  return {title, width, room, t, kicker, height, top, bottom: top + height + MIS};
};

const Header: React.FC<{d: ChatThreadData}> = ({d}) => {
  const {copy, HEAD, weight} = useDesign();
  const h = useHeader(d);
  if (!h) return null;
  const right = d.sticker ? W - STICKER_EDGE : W - X1;
  return <>
    {h.kicker ? <Kicker text={d.app!} top={ZONE_TOP} at={0} right={right} maxWidth={h.width - 140}/> : null}
    <Slam at={2} from={1.2} origin="50% 50%" style={{position: 'absolute', top: h.top, [copy.side]: right, width: h.width, height: h.height}}>
      <div style={{position: 'relative', width: h.width, height: h.height, background: INK, boxShadow: `${-MIS}px ${MIS}px 0 ${LIME}`, direction: copy.dir}}>
        <DotBand width={Math.round(h.width * 0.3)}/>
        <div style={{position: 'absolute', [copy.side]: 30, top: (h.height - BADGE) / 2, width: BADGE, height: BADGE, borderRadius: BADGE / 2, background: INK, border: `6px solid ${PAPER}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', color: LIME, fontFamily: HEAD, fontWeight: weight, fontSize: 62, lineHeight: 1}}>
          <span style={{marginTop: 10}}>{initialOf(h.title)}</span></div>
        <div style={{position: 'absolute', [copy.side]: 30 + BADGE + 26, top: 18, width: h.room, direction: copy.dir, textAlign: copy.align, color: PAPER, fontFamily: h.t.family, fontWeight: h.t.weight, fontSize: h.t.size}}>
          {h.t.lines.map((line, i) => <div key={i} style={{height: h.t.box, lineHeight: `${h.t.box}px`, whiteSpace: 'pre'}}>{line}</div>)}</div>
      </div>
    </Slam>
  </>;
};

/** A message wrapped to the fewest lines at the biggest size, then narrowed while the line count holds, so no word is left alone. */
const wrap = (text: string, width: number, ctx: ReturnType<typeof useDesign>, size: number): Fit => {
  text = text.replace(/\s+/g, ' ').trim();
  const o = {size, min: 44, lines: 8, family: SANS, weight: 900, lh: 1.28};
  const base = ctx.fit(text, {...o, width});
  let best = base;
  for (let w = width - 24; w >= 280; w -= 24) {
    const tight = {...o, width: w, size: base.size, min: base.size};
    if (!ctx.canFit(text, tight)) break;
    const t = ctx.fit(text, tight);
    if (t.lines.length > base.lines.length) break;
    best = t;
  }
  return best;
};

/** The newest strip is the hero: big type, thick border, strong halftone. Once the next message lands it shrinks to the older size (type 52 px). */
const HERO = {border: 10, shadow: 22, padX: 40, padY: 22, maxW: 900, maxSize: 92, floor: 64, minSize: 50, older: 52, lh: 1.28, edge: 20, bottom: 20, top: 26};
type Hero = Item & {older: number};

/** Wrap a message for the hero strip, then narrow it so no word is left alone. */
const measureHero = (text: string, budget: number, maxSize: number, last: boolean, ctx: ReturnType<typeof useDesign>): Omit<Hero, 'from' | 'at'> => {
  text = text.replace(/\s+/g, ' ').trim();
  const width = HERO.maxW - 2 * (HERO.padX + HERO.border), pad = 2 * (HERO.padY + HERO.border);
  const o = {size: maxSize, min: HERO.minSize, family: SANS, weight: 900, lh: HERO.lh};
  const fits: {t: Fit; h: number}[] = [];
  for (let lines = 1; lines <= 8; lines++) {
    if (!ctx.canFit(text, {...o, width, lines})) continue;
    const t = ctx.fit(text, {...o, width, lines});
    fits.push({t, h: t.lines.length * t.box + pad});
  }
  const room = fits.filter(c => c.h <= budget);
  // The closing strip grows as far as the room allows; every other strip takes the fewest lines that keep its type at 64 px or more.
  const biggest = Math.max(0, ...room.map(c => c.t.size));
  const pick = (last ? room.find(c => c.t.size >= biggest * 0.9) : room.find(c => c.t.size >= HERO.floor)) ?? room.sort((a, b) => b.t.size - a.t.size)[0] ?? fits.sort((a, b) => a.h - b.h)[0]
    ?? (() => { const t = ctx.fit(text, {...o, width, lines: 14}); return {t, h: t.lines.length * t.box + pad}; })();
  let t = pick.t;
  for (let w = width - 24; w >= 260; w -= 24) {
    const tight = {...o, size: t.size, min: t.size, width: w, lines: pick.t.lines.length};
    if (!ctx.canFit(text, tight)) break;
    t = ctx.fit(text, tight);
  }
  const span = Math.max(...t.lines.map(line => Math.ceil(widthOf(line, t.size, SANS, 900))));
  return {text, lines: t.lines, size: t.size, box: t.box, w: Math.max(240, span + 2 * (HERO.padX + HERO.border)), h: t.lines.length * t.box + pad, older: Math.min(1, HERO.older / t.size)};
};

/** One paper strip, laid out at hero size and scaled by `k` (1 for the newest, `older` after). White for them, lime for me, a slight tilt. */
const Strip: React.FC<{item: Hero; index: number; x: number; y: number; k: number; edge: 'left' | 'right'}> = ({item, index, x, y, k, edge}) => {
  const {copy} = useDesign();
  const shown = useDesignText();
  const me = item.from === 'me', rot = (me ? -1 : 1) * TILT[index % TILT.length] * 0.8;
  return <div style={{position: 'absolute', left: x, top: y, width: item.w, height: item.h, transform: `scale(${k})`, transformOrigin: `${edge} top`}}>
    <Slam at={item.at} from={1.55} rot={rot} kick={me ? -6 : 6} style={{width: item.w, height: item.h}}>
      <Printed w={item.w} h={item.h} at={item.at} fill={me ? LIME : CARD} border={HERO.border} shadow={HERO.shadow} dot={4.8}>
        <div aria-label={shown(item.text)} style={{position: 'absolute', inset: HERO.border, padding: `${HERO.padY}px ${HERO.padX}px`, boxSizing: 'border-box', direction: copy.dir, textAlign: copy.align, fontFamily: SANS, fontWeight: 900, fontSize: item.size, color: INK}}>
          {item.lines.map((line, i) => <div key={i} style={{height: item.box, lineHeight: `${item.box}px`, whiteSpace: 'pre'}}>{line}</div>)}</div>
      </Printed>
    </Slam>
  </div>;
};

/** Three ink dots on a small strip, bouncing while the sender types. */
const TypingStrip: React.FC<{from: 'me' | 'them'; at: number; index: number; x: number; y: number}> = ({from, at, index, x, y}) => {
  const f = useCurrentFrame(), me = from === 'me';
  return <div data-chat-typing={x + TYPING.w / 2 < 540 ? 'left' : 'right'} style={{display: 'contents'}}>
    <Slam at={at} from={1.25} rot={(me ? -1 : 1) * TILT[index % TILT.length]} style={{position: 'absolute', left: x, top: y, width: TYPING.w, height: TYPING.h}}>
    <Printed w={TYPING.w} h={TYPING.h} at={at} fill={me ? LIME : CARD} border={BORDER} shadow={SHADOW}>
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22}}>
        {[0, 1, 2].map(j => <div key={j} style={{width: 28, height: 28, borderRadius: 14, background: INK, transform: `translateY(${-Math.abs(Math.sin((f - at) * 0.26 - j * 0.75)) * 18 + 8}px)`}}/>)}
      </div>
    </Printed>
    </Slam>
  </div>;
};

const Thread: React.FC<{d: ChatThreadData; times: number[]; top: number}> = ({d, times, top}) => {
  const ctx = useDesign(), {copy} = ctx;
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const windowH = ZONE_BOTTOM - top, typing = chatTypingFrames(fps), isTyping = d.variant === 'typing';
  const heroes = React.useMemo(() => {
    let olderSum = 0;
    return d.messages.map((m, i): Hero => {
      const budget = Math.max(0.45 * windowH, Math.min(0.8 * windowH, windowH - olderSum - HERO.shadow - 24));
      const hero = measureHero(m.text, budget, d.messages.length === 1 ? 140 : i === d.messages.length - 1 ? 120 : HERO.maxSize, i === d.messages.length - 1, ctx);
      olderSum += hero.h * hero.older + GAP;
      return {...hero, from: m.from, at: times[i]};
    });
  }, [d, windowH, ctx.HEAD, copy.ar]);
  // With room to spare the strips spread over the zone instead of leaving the lower half empty.
  const fitted = heroes.reduce((sum, it, i) => sum + (i < heroes.length - 1 ? it.h * it.older + GAP : it.h), HERO.top) + HERO.shadow;
  const gap = heroes.length > 1 ? Math.min(96, GAP + Math.max(0, windowH - HERO.bottom - fitted) / (heroes.length - 1)) : GAP;
  const shrinkAt = (i: number) => times[i] - (isTyping ? typing : 0);
  const kAt = (i: number) => i + 1 < heroes.length && f >= shrinkAt(i + 1)
    ? 1 - (1 - heroes[i].older) * spring({frame: f - shrinkAt(i + 1), fps, config: {stiffness: 220, damping: 24, mass: 0.7}}) : 1;
  const side = (from: 'me' | 'them') => (from === 'them') === copy.ar ? 'right' as const : 'left' as const;
  const xOf = (from: 'me' | 'them', w: number) => side(from) === 'right' ? X1 - HERO.edge - w : X0;
  // Strips stack from the top; the stack is bottom-anchored once it no longer fits, so the newest strip rests near y 1140.
  const ys: number[] = [], hs: number[] = [];
  let y = HERO.top;
  heroes.forEach((it, i) => { ys.push(y); hs.push(it.h * kAt(i)); if (times[i] <= f) y += hs[i] + gap; });
  // Every arrival (a typing strip, then its message) moves the shove target; the shove is the sum of springs.
  const events: {at: number; target: number}[] = [];
  let acc = HERO.top;
  const target = (bottom: number) => Math.max(0, bottom + HERO.shadow - (windowH - HERO.bottom));
  heroes.forEach(it => {
    if (isTyping) events.push({at: it.at - typing, target: target(acc + TYPING.h)});
    events.push({at: it.at, target: target(acc + it.h)});
    acc += it.h * it.older + gap;
  });
  let prev = 0, shove = 0;
  for (const e of events) {
    if (f >= e.at) shove += (e.target - prev) * spring({frame: f - e.at, fps, config: {stiffness: 240, damping: 24, mass: 0.6}});
    prev = e.target;
  }
  // Once the thread overflows, strips leaving under the header fade out instead of being cut by a hard edge.
  const fade = shove > 1 ? 'linear-gradient(to bottom, transparent 0px, #000 44px)' : undefined;
  return <div style={{position: 'absolute', left: 0, top, width: W, height: windowH, overflow: 'hidden', WebkitMaskImage: fade, maskImage: fade}}>
    <div style={{position: 'absolute', inset: 0, transform: `translateY(${-shove}px)`}}>
      {heroes.map((it, i) => <React.Fragment key={i}>
        {isTyping && f >= it.at - typing && f < it.at ? <TypingStrip from={it.from} at={it.at - typing} index={i} x={side(it.from) === 'right' ? X1 - HERO.edge - TYPING.w : X0} y={ys[i]}/> : null}
        <Strip item={it} index={i} x={xOf(it.from, it.w)} y={ys[i]} k={kAt(i)} edge={side(it.from)}/>
      </React.Fragment>)}
    </div>
  </div>;
};

/** A notification ticket: ink stub with the order, notches on the perforation, text on the body. */
const STUB = 128, CARD_W = 892, CARD_PAD = 16, STACK_GAP = 20;
const Ticket: React.FC<{item: Item; index: number; total: number; newest: boolean; x: number; y: number}> = ({item, index, total, newest, x, y}) => {
  const {copy} = useDesign();
  const shown = useDesignText();
  return <Slam at={item.at} from={1.22} rot={(index % 2 ? 1 : -1) * TILT[index % TILT.length]} kick={index % 2 ? 3 : -3} style={{position: 'absolute', left: x, top: y, width: CARD_W, height: item.h}}>
    <Printed w={CARD_W} h={item.h} at={item.at} fill={newest ? LIME : CARD} border={BORDER} shadow={SHADOW}>
      <div style={{position: 'absolute', inset: BORDER, overflow: 'hidden', direction: copy.dir}}>
        <div style={{position: 'absolute', [copy.side]: 0, top: 0, bottom: 0, width: STUB, background: INK, color: PAPER, fontFamily: MONO, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'ltr'}}>
          <div style={{fontSize: 52, lineHeight: '56px'}}><DesignText>{String(index + 1).padStart(2, '0')}</DesignText></div>
          <div style={{fontSize: 28, lineHeight: '34px', opacity: 0.8}}>/<DesignText>{String(total).padStart(2, '0')}</DesignText></div></div>
        {[-1, 1].map(end => <div key={end} style={{position: 'absolute', [copy.side]: STUB - 17, top: end < 0 ? -17 : undefined, bottom: end > 0 ? -17 : undefined, width: 34, height: 34, borderRadius: 17, background: PAPER, border: `${BORDER}px solid ${INK}`, boxSizing: 'border-box'}}/>)}
        <div aria-label={shown(item.text)} style={{position: 'absolute', [copy.side]: STUB + 28, top: 0, bottom: 0, width: item.w - STUB - 56, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: copy.align, fontFamily: SANS, fontWeight: 900, fontSize: item.size, color: INK}}>
          {item.lines.map((line, k) => <div key={k} style={{height: item.box, lineHeight: `${item.box}px`, whiteSpace: 'pre'}}>{line}</div>)}</div>
      </div>
    </Printed>
  </Slam>;
};

const Notifications: React.FC<{d: ChatThreadData; times: number[]; top: number}> = ({d, times, top}) => {
  const ctx = useDesign(), {copy} = ctx;
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const windowH = ZONE_BOTTOM - top;
  const items: Item[] = d.messages.map((m, i) => {
    const text = m.text.replace(/\s+/g, ' ').trim();
    const t = wrap(text, CARD_W - STUB - 56 - 2 * BORDER, ctx, 48);
    return {from: m.from, text, lines: t.lines, size: t.size, box: t.box, w: CARD_W, h: Math.max(120, t.lines.length * t.box + 2 * CARD_PAD + 2 * BORDER), at: times[i]};
  });
  const cards = notificationCards(d, f, fps);
  const steps = cards.slice(0, -1).reduce((sum, c) => sum + items[c.index].h + STACK_GAP, 0);
  const last = cards.length ? items[cards[cards.length - 1].index].h : 0;
  const room = windowH - 16 - last - SHADOW;
  const squeeze = steps > 0 ? Math.max(0.3, Math.min(1, room / steps)) : 1;
  return <div style={{position: 'absolute', left: 0, top, width: W, height: windowH, overflow: 'hidden'}}>
    {[...cards].reverse().map(({index}) => {
      const j = cards.findIndex(c => c.index === index);
      const y = 16 + cards.slice(0, j).reduce((sum, c) => sum + (items[c.index].h + STACK_GAP) * c.enter * squeeze, 0) - (j === 0 ? (1 - cards[0].enter) * 240 : 0);
      if (j > 0 && y >= windowH) return null;
      const x = X0 + (CW - CARD_W) / 2 + (copy.ar ? 1 : -1) * FAN_X[index % FAN_X.length];
      return <Ticket key={index} item={items[index]} index={index} total={d.messages.length} newest={j === 0} x={x} y={y}/>;
    })}
  </div>;
};

const ChatScene: React.FC<{d: ChatThreadData}> = ({d}) => {
  const {copy} = useDesign();
  const {fps} = useVideoConfig();
  const header = useHeader(d), times = chatMessageFrames(d, fps);
  const top = header ? header.bottom + 2 : ZONE_TOP - 16;
  return <AbsoluteFill style={{direction: copy.dir, textAlign: copy.align}}>
    {d.variant === 'notifications' ? <Notifications d={d} times={times} top={top}/> : <Thread d={d} times={times} top={top}/>}
    <Header d={d}/>
  </AbsoluteFill>;
};

export const ChatThread: React.FC<FamilyDesignProps> = ({scene}) => {
  if (scene.family !== 'chat-thread') return null;
  return <Settled>
    <Ground/>
    <ChatScene d={scene.data}/>
    <SceneStickerSlot host="chat-thread" sticker={scene.data.sticker} ink={INK}/>
  </Settled>;
};
