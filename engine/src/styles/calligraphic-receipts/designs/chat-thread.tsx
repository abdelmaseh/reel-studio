// calligraphic-receipts «chat-thread»: every message is a paper slip. The title is the ruqaa headline, a printer slot hangs under it,
// and each slip is printed out of the roll one under another, tilted a little. Older slips slide up into the slot, whole slips only.
// The newest slip is the hero: bigger type, a larger slip and a red brush underline under its key word.
// me: a slip on the left with a red brush underline. them: a slip on the right. notifications: wide receipts with a red unread dot.
import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import type {ChatThreadData} from '../../../creative-kit/chat-thread/schema';
import {chatMessageFrames, chatTypingFrames, notificationCards} from '../../../creative-kit/chat-thread/timing';
import {SceneStickerSlot} from '../../../creative-kit/sticker-view';
import {measure} from '../../../core/type';
import {BrushRule, C, DesignRoot, FONT, Kicker, W, X0, X1, expo, ramp, sceneCopy, useCopy} from './kit';
import {Barcode, Ground, Headline, PrinterSlot, Settled, Slip, ZONE_BOTTOM, fitWrapped, useHead, type Wrapped} from './family-parts';

const PADX = 40, GAP = 16, CLEAR = 10, SLIP_MAX = 810, NOTE_W = 860, FEED = 9;
const TYPING = {w: 224, h: 104};
const PAD = {top: 14, bottom: 26}, HERO_PAD = {top: 24, bottom: 38};
const TILT = [1.2, 0.8, 1.5, 1.0, 0.7, 1.3, 0.9, 1.4];
const KICKER_ROOM = 54;

/** The word the hero slip underlines: where it starts along its line (from the start edge) and how wide it is. */
type Key = {line: number; offset: number; width: number};
type Item = {index: number; from: 'me' | 'them'; hero: boolean; wrapped: Wrapped; w: number; h: number; padTop: number; at: number; key: Key | null};
type Layout = {slips: Item[]; ys: number[]; start: number};

const keyWord = (w: Wrapped): Key | null => {
  const style = {fontFamily: FONT.naskh, fontSize: w.size, fontWeight: 700};
  const space = measure('a b', style).width - measure('ab', style).width;
  let best: Key | null = null, bestLen = 2;
  for (let i = 0; i < w.lines.length; i++) {
    const words = w.lines[i].split(' ');
    for (let k = 0; k < words.length; k++) {
      const len = Array.from(words[k].replace(/[،,.:؛؟?!]/g, '')).length;
      if (len > bestLen) { bestLen = len; best = {line: i, offset: k ? measure(words.slice(0, k).join(' '), style).width + space : 0, width: measure(words[k], style).width}; }
    }
  }
  return best;
};

/** Hero type sizes tried from the biggest down: 64 to 90 px (a lone message up to 120), and 48 to 72 px for notifications. */
const heroSizes = (n: number, notify: boolean) => {
  const [hi, lo] = notify ? [72, 48] : n === 1 ? [120, 64] : [90, 64];
  return Array.from({length: Math.floor((hi - lo) / 2) + 1}, (_, i) => hi - 2 * i);
};

const makeSlip = (m: ChatThreadData['messages'][number], index: number, at: number, size: number, hero: boolean, notify: boolean, floor: number): Item => {
  const dot = hero ? 38 : 30, maxText = notify ? NOTE_W - 2 * PADX - dot - 22 : SLIP_MAX - 2 * PADX;
  const wrapped = fitWrapped(m.text, FONT.naskh, 700, size, floor, maxText, 1.4, 9);
  const pad = hero ? HERO_PAD : PAD, room = !hero && !notify && m.from === 'me' ? 14 : 0;
  return {index, from: m.from, hero, wrapped, w: notify ? NOTE_W : Math.max(hero ? 540 : 320, wrapped.width + 2 * PADX), padTop: pad.top,
    h: pad.top + wrapped.lines.length * wrapped.box + pad.bottom + room, at, key: hero && !notify ? keyWord(wrapped) : null};
};

/**
 * The newest slip is the hero and gets the biggest type at which the whole thread fits, with older slips at 46 px and up (40 for notifications).
 * When it cannot all fit, older slips scroll up into the slot a whole slip at a time, the hero stays big, and the slips that stay are spread
 * so the window is full down to y 1150.
 */
const useLayout = (d: ChatThreadData, times: number[], windowH: number): Layout => {
  const notify = d.variant === 'notifications', key = `${windowH}|${d.variant}|${d.messages.map((m, i) => `${m.from}:${times[i]}:${m.text}`).join('|')}`;
  return React.useMemo(() => {
    const n = d.messages.length, floor = notify ? 40 : 46, cap = notify ? 54 : 56, sizes = heroSizes(n, notify);
    const build = (base: number, hero: number) => d.messages.map((m, i) => makeSlip(m, i, times[i], i === n - 1 ? hero : base, i === n - 1, notify, floor));
    const need = (slips: Item[], v: number) => slips.slice(v).reduce((sum, s) => sum + s.h, 0) + GAP * (n - 1 - v) + 2 * CLEAR;
    const firstVisible = (slips: Item[]) => { let v = n - 1; while (v > 0 && need(slips, v - 1) <= windowH) v--; return v; };
    let slips: Item[] | null = null;
    for (const hero of sizes) {
      for (let base = Math.min(cap, Math.round(hero * 0.8)); base >= floor && !slips; base -= 2) {
        const trial = build(base, hero);
        if (firstVisible(trial) === 0) slips = trial;
      }
      if (slips) break;
    }
    // Too much for the window: the oldest slips scroll away, and the biggest hero that still leaves its predecessor in view is kept.
    if (!slips) {
      const keep = Math.min(n, 2), found = sizes.map(hero => build(floor, hero)).find(trial => n - firstVisible(trial) >= keep);
      slips = found ?? build(floor, sizes[sizes.length - 1]);
    }
    const v0 = firstVisible(slips), left = Math.max(0, windowH - need(slips, v0)), visible = n - v0;
    const extra = visible > 1 ? Math.min(left / (visible - 1), 44) : 0, start = CLEAR + Math.max(0, (left - extra * (visible - 1)) / 2);
    const ys: number[] = [];
    slips.forEach((s, i) => ys.push(i === 0 ? start : ys[i - 1] + slips![i - 1].h + GAP + extra));
    return {slips, ys, start};
  }, [key]);
};

/** Three hand-inked dots that bounce one after another while the sender is typing. */
const InkDots: React.FC<{at: number}> = ({at}) => {
  const f = useCurrentFrame();
  const blob = ['58% 42% 52% 48% / 50% 56% 44% 50%', '46% 54% 48% 52% / 56% 44% 56% 44%', '52% 48% 44% 56% / 44% 54% 46% 56%'];
  return <div style={{height: TYPING.h - 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, direction: 'ltr'}}>
    {[0, 1, 2].map(j => <div key={j} style={{width: 28, height: 28, borderRadius: blob[j], background: j === 1 ? C.rust : C.ink, transform: `translateY(${-Math.abs(Math.sin((f - at) * 0.28 - j * 0.8)) * 16 + 6}px) rotate(${j * 40}deg)`}}/>)}
  </div>;
};

const SlipView: React.FC<{slip: Item; x: number; y: number; notify: boolean; newest: boolean}> = ({slip, x, y, notify, newest}) => {
  const f = useCurrentFrame(), copy = useCopy();
  const me = slip.from === 'me', w = slip.wrapped, inner = slip.w - 2 * PADX, dot = slip.hero ? 38 : 30;
  const rot = (me ? -1 : 1) * TILT[slip.index % TILT.length] * (notify ? 0.7 : 1) * (notify && slip.index % 2 ? -1 : 1);
  const drop = (1 - ramp(f, slip.at, 12, expo)) * -34;
  const underline = Math.min(inner, w.width + 12), key = slip.key;
  return <div style={{position: 'absolute', left: 0, top: 0, width: W, transform: `translateY(${drop}px)`}}>
    <Slip left={x} top={y} width={slip.w} height={slip.h} start={slip.at} feed={FEED} rot={rot} seed={slip.index * 7 + 3} tint={me ? 'rgba(206,170,108,0.2)' : undefined}>
      <div style={{position: 'absolute', left: PADX, right: PADX, top: slip.padTop, display: 'flex', alignItems: 'flex-start', gap: 22, direction: copy.dir}}>
        {notify ? <div style={{width: dot, height: dot, marginTop: (w.box - dot) / 2, borderRadius: dot / 2, flex: 'none', boxSizing: 'border-box', background: newest ? C.rust : 'transparent', border: `${slip.hero ? 5 : 4}px solid ${C.rust}`}}/> : null}
        <div style={{flex: 1, textAlign: copy.align}}>
          {w.lines.map((line, i) => <div key={i} style={{height: w.box, lineHeight: `${w.box}px`, fontFamily: FONT.naskh, fontWeight: 700, fontSize: w.size, color: C.ink, whiteSpace: 'pre'}}>{line}</div>)}
        </div>
        {notify ? <div style={{alignSelf: 'center', flex: 'none', opacity: 0.8}}><Barcode w={slip.hero ? 96 : 78} h={Math.min(slip.hero ? 56 : 46, w.box * 0.8)} seed={slip.index * 13 + 5}/></div> : null}
      </div>
      {key ? <BrushRule local left={PADX + (copy.ar ? inner - key.offset - key.width : key.offset) - 7} top={slip.padTop + (key.line + 1) * w.box - 8} w={key.width + 14} h={24} at={slip.at + 8} dur={14} seed={slip.index + 4} streak={C.thermal}/> : null}
      {me && !notify && !slip.hero ? <BrushRule local left={PADX + (copy.ar ? inner - underline : 0)} top={slip.padTop + w.lines.length * w.box - 2} w={underline} h={16} at={slip.at + 8} dur={12} seed={slip.index + 2} streak={C.thermal}/> : null}
    </Slip>
  </div>;
};

const TypingSlip: React.FC<{from: 'me' | 'them'; at: number; x: number; y: number; index: number}> = ({from, at, x, y, index}) => {
  const f = useCurrentFrame();
  const rot = (from === 'me' ? -1 : 1) * TILT[index % TILT.length];
  return <div data-chat-typing={x + TYPING.w / 2 < 540 ? 'left' : 'right'} style={{position: 'absolute', left: 0, top: 0, width: W, transform: `translateY(${(1 - ramp(f, at, 8, expo)) * -24}px)`}}>
    <Slip left={x} top={y} width={TYPING.w} height={TYPING.h} start={at} feed={6} rot={rot} seed={index * 5 + 1} tint={from === 'me' ? 'rgba(206,170,108,0.2)' : undefined}><InkDots at={at}/></Slip>
  </div>;
};

const Thread: React.FC<{d: ChatThreadData; times: number[]; top: number}> = ({d, times, top}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig(), copy = useCopy();
  const windowH = ZONE_BOTTOM - top, notify = d.variant === 'notifications', typing = chatTypingFrames(fps);
  const {slips, ys, start} = useLayout(d, times, windowH);
  const side = (from: 'me' | 'them', w: number) => notify ? (W - w) / 2 : (from === 'them') === copy.ar ? X1 - w : X0;
  // Every arrival raises the scroll to the next whole-slip boundary; the scroll is the sum of springs, so older slips slide up into the slot.
  const events: {at: number; target: number}[] = [];
  let reached = 0;
  const raise = (at: number, bottom: number) => {
    const needed = bottom + CLEAR - windowH, boundary = ys.map(y => y - start).find(y => y >= needed) ?? ys[ys.length - 1] - start;
    if (boundary > reached) { reached = boundary; events.push({at, target: boundary}); }
  };
  slips.forEach((s, i) => { if (d.variant === 'typing') raise(s.at - typing, ys[i] + TYPING.h); raise(s.at, ys[i] + s.h); });
  let prev = 0, scroll = 0;
  for (const e of events) {
    if (f >= e.at) scroll += (e.target - prev) * spring({frame: f - e.at, fps, config: {stiffness: 200, damping: 26, mass: 0.7}});
    prev = e.target;
  }
  const shownIdx = notify ? new Set(notificationCards(d, f, fps).map(c => c.index)) : null;
  return <div style={{position: 'absolute', left: 0, top, width: W, height: windowH + 60, overflow: 'hidden'}}>
    <div style={{position: 'absolute', inset: 0, transform: `translateY(${-scroll}px)`}}>
      {slips.map((s, i) => {
        if (shownIdx && !shownIdx.has(i)) return null;
        const newest = f < (slips[i + 1]?.at ?? Infinity) && f >= s.at;
        return <React.Fragment key={i}>
          {d.variant === 'typing' && f >= s.at - typing && f < s.at ? <TypingSlip from={s.from} at={s.at - typing} x={side(s.from, TYPING.w)} y={ys[i]} index={i}/> : null}
          <SlipView slip={s} x={side(s.from, s.w)} y={ys[i]} notify={notify} newest={newest}/>
        </React.Fragment>;
      })}
    </div>
  </div>;
};

const ChatBody: React.FC<{d: ChatThreadData}> = ({d}) => {
  const {fps} = useVideoConfig(), times = chatMessageFrames(d, fps);
  const text = d.title ?? d.app, kicker = d.title && d.app ? d.app : null;
  const head = useHead(text, !!d.sticker, {top: 294 + (kicker ? KICKER_ROOM : 0), maxSize: 116});
  const slotY = Math.max(head ? head.bottom + 22 : 300, d.sticker ? 526 : 0);
  return <>
    <Ground head={head}/>
    {kicker ? <Kicker text={kicker} top={288} at={2}/> : null}
    {head ? <Headline head={head}/> : null}
    <Thread d={d} times={times} top={slotY + 12}/>
    <PrinterSlot y={slotY}/>
    <SceneStickerSlot host="chat-thread" sticker={d.sticker} ink={C.ink}/>
  </>;
};

export const ChatThread: React.FC<FamilyDesignProps> = ({scene}) => {
  if (scene.family !== 'chat-thread') return null;
  return <DesignRoot copy={sceneCopy(scene.data)}><Settled><ChatBody d={scene.data}/></Settled></DesignRoot>;
};
