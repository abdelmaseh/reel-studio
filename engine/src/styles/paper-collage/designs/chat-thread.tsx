// paper-collage chat-thread: speech bubbles cut from paper with a tail, tape and a coloured under-layer.
// `them` is cream on the right, `me` is teal or saffron on the left. Each message drops in at its frame; newer ones push older ones up
// and out of a masked window under the header strip. The NEWEST message is the hero: a big bubble (64-90 px type) that drops in hardest
// and grows to fill the thread down to y 1150. Older bubbles stay at 46-52 px, and no text is ever smaller than 46 px.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import type {ChatThreadData} from '../../../creative-kit/chat-thread/schema';
import {chatMessageFrames, chatTypingFrames, notificationCards} from '../../../creative-kit/chat-thread/timing';
import {SceneStickerSlot} from '../../../creative-kit/sticker-view';
import {displayWeight} from '../../../style-kit/design-safety';
import {C, BODY, X1, rectShape, polyShape, bubbleVerts, circleVerts, fit, Stage, Piece, Tape, PieceText, Kicker, DesignProvider, useKit} from './kit';
import {STICKER_EDGE, X0, ZONE_BOTTOM, ZONE_TOP, Settled, balancedLines, clamp, oneLine} from './family-parts';

type Message = ChatThreadData['messages'][number];

const WIN_BOTTOM = ZONE_BOTTOM, CLIP_BOTTOM = 1196;
const TEXT_WEIGHT = 700, LINE = 1.3, GAP = 10;
const OLD_SIZES = [52, 50, 48, 46], OLD_TEXT_W = 740;
const HERO_MAX = 90, HERO_MIN = 64, FLOOR = 46, HERO_TEXT_W = 830;
const MAX_OLDER = 3;
const ME_FILLS = [C.teal, C.mustard];
const UNDER: Record<string, string> = {[C.card]: C.terra, [C.teal]: C.mustard, [C.mustard]: C.teal};
const NOTE_FILLS = [C.card, C.teal, C.card, C.mustard, C.card];
const NOTE_MARKS = [C.terra, C.mustard, C.teal];
const NOTE_ROT = [-2.4, 1.9, -1.4, 2.6, -2];
const NOTE_SHIFT = [0, 36, 12, 48, 20];
const SCROLL_FRAMES = 12;
const NOTE_SIZES = Array.from({length: 11}, (_, i) => 66 - i * 2);
const ease3 = (t: number) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;

export const ChatThread: React.FC<FamilyDesignProps> = p => {
  if (p.scene.family !== 'chat-thread') return null;
  const d = p.scene.data;
  return <DesignProvider data={d} sectionIndex={p.sectionIndex}>
    <Stage offcuts={{family: 'strips', colors: [C.teal, C.mustard, C.terra]}}>
      <Settled>
        <Thread d={d}/>
        <SceneStickerSlot host="chat-thread" sticker={d.sticker} ink={C.ink}/>
      </Settled>
    </Stage>
  </DesignProvider>;
};

// ---------- header: a headline strip with the first letter on a round paper piece ----------
const CIRCLE = 150;
/** The letter shown on the round piece: the first letter of the title, skipping a leading definite article. */
const initialOf = (title: string) => Array.from(title.replace(/^ال(?=\p{L}{2})/u, '').trim())[0] ?? '';

type HeaderPlan = {text: string; kicker?: string; lines: string[]; size: number; box: number; h: number; top: number; right: number; width: number; bottom: number};

function useHeader(d: ChatThreadData): HeaderPlan | null {
  const {HEAD} = useKit();
  const text = d.title ?? d.app;
  if (!text) return null;
  const kicker = d.title && d.app ? d.app : undefined;
  const right = d.sticker ? STICKER_EDGE : X1, width = right - X0, room = width - CIRCLE - 40;
  const one = oneLine(text, HEAD, displayWeight(HEAD, 'Reem Kufi', 700), {width: room, size: 88, min: 56});
  const two = one ? null : fit(text, {width: room, size: 64, min: 44, lines: 2, weight: 700, family: HEAD, lh: 1.1});
  const lines = one ? [text] : two!.lines, size = one ? one.size : two!.size, box = one ? Math.round(size * 1.1) : two!.box;
  const h = lines.length === 1 ? 124 : lines.length * box + 34;
  const top = kicker ? ZONE_TOP + 56 : ZONE_TOP + 10;
  return {text, kicker, lines, size, box, h, top, right, width, bottom: top + h + 14};
}

const Header: React.FC<{head: HeaderPlan}> = ({head}) => {
  const {HEAD, copy} = useKit();
  const weight = displayWeight(HEAD, 'Reem Kufi', 700);
  return <>
    <Piece id="ch-strip" x={X0} y={head.top} w={head.width} h={head.h} rot={-0.8} color={C.terra} shape={rectShape(8)} enter={{at: 0, from: [-300, -60], dur: 16}} depth={0.8} z={30}>
      <div style={{position: 'absolute', [copy.side]: CIRCLE + 16, top: 0, height: head.h, display: 'flex', flexDirection: 'column', justifyContent: 'center', direction: copy.dir, fontFamily: HEAD, fontWeight: weight, fontSize: head.size,
        lineHeight: `${head.box}px`, color: C.card, whiteSpace: 'nowrap'}}>{head.lines.map((line, i) => <div key={i}>{line}</div>)}</div>
      <Tape cx={head.width - 150} cy={head.h - 8} len={110} h={42} rot={-8} at={24} from="r" id="ch-st"/>
    </Piece>
    <Piece id="ch-circle" x={head.right - CIRCLE} y={head.top + (head.h - CIRCLE) / 2 - 4} w={CIRCLE} h={CIRCLE} color={C.mustard} shape={polyShape(circleVerts, 1.4)} enter={{at: 6, from: [90, -150], dur: 16, rot: 8}} depth={0.7} z={32}>
      <PieceText text={initialOf(head.text)} h={CIRCLE} size={92} family={HEAD} weight={weight} color={C.ink} dy={-Math.round(92 * 0.04)}/>
      <Tape cx={CIRCLE - 22} cy={20} len={84} h={34} rot={36} at={26} from="r" id="ch-ct"/>
    </Piece>
    {head.kicker ? <Kicker text={head.kicker} x={head.right - CIRCLE - 10} y={head.top - 62} right color={C.card} at={10} id="ch-kick"/> : null}
  </>;
};

// ---------- sizing ----------
type Look = {size: number; padX: number; padY: number; tail: number};
type Dim = {lines: string[]; h: number; width: number};
const olderLook = (size: number): Look => ({size, padX: Math.round(size * 0.7), padY: Math.round(size * 0.38), tail: Math.round(size * 0.7)});
const heroLook = (size: number): Look => ({size, padX: Math.round(size * 0.6), padY: Math.round(size * 0.34), tail: Math.round(size * 0.62)});

const dimOf = (text: string, look: Look, width: number): Dim => {
  const t = balancedLines(text.replace(/\s+/g, ' ').trim(), BODY, TEXT_WEIGHT, look.size, width);
  return {lines: t.lines, h: t.lines.length * Math.round(look.size * LINE) + 2 * look.padY, width: t.width};
};

type ThreadPlan = {looks: Look[]; dims: Dim[]; gaps: number[]; offset: number; hero: number};

/**
 * The newest message is the hero: aim for 80 to 90 px with up to three older bubbles at 52 px, then with fewer older ones, then a hero of 64 px or more,
 * and last a hero alone (which may shrink to 46 px for a very long message). Spare height widens the gaps; what is left is split
 * above and below. A thread longer than the window keeps its newest messages whole and the rest slide out under the header strip.
 */
function planThread(messages: Message[], winH: number): ThreadPlan {
  const last = messages.length - 1;
  const gapAfter = (i: number) => (i === last - 1 ? GAP + 10 : GAP);
  const cache = new Map<number, Dim[]>();
  const olderAt = (size: number) => {
    let dims = cache.get(size);
    if (!dims) { dims = messages.slice(0, last).map(m => dimOf(m.text, olderLook(size), OLD_TEXT_W)); cache.set(size, dims); }
    return dims;
  };
  const attempt = (older: number, hero: number) => {
    const oldLook = olderLook(older), top = heroLook(hero), oldDims = olderAt(older), heroDim = dimOf(messages[last].text, top, HERO_TEXT_W);
    let used = heroDim.h + top.tail, kept = 0;
    for (let i = last - 1; i >= 0; i--) {
      const next = used + oldDims[i].h + oldLook.tail + gapAfter(i);
      if (next > winH) break;
      used = next; kept++;
    }
    return {oldLook, top, dims: [...oldDims, heroDim], used, kept};
  };
  // Preference order: a very big hero (80+) with up to three older bubbles, then fewer older ones, then a smaller hero (64+), then a hero alone.
  const older = Math.min(last, MAX_OLDER);
  const tiers = [...Array.from({length: older}, (_, i) => [older - i, 80]), ...Array.from({length: older}, (_, i) => [older - i, HERO_MIN]), [0, FLOOR]];
  let chosen: ReturnType<typeof attempt> | null = null;
  for (const [want, floor] of tiers) {
    for (const olderSize of OLD_SIZES) {
      for (let hero = HERO_MAX; hero >= floor && !chosen; hero -= 2) {
        const hit = attempt(olderSize, hero);
        if (hit.kept >= want && hit.used <= winH) chosen = hit;
      }
      if (chosen) break;
    }
    if (chosen) break;
  }
  const pick = chosen ?? attempt(FLOOR, FLOOR);
  const spare = Math.max(0, winH - pick.used);
  const gapExtra = pick.kept ? Math.min(40, spare / pick.kept) : 0;
  return {
    looks: [...messages.slice(0, last).map(() => pick.oldLook), pick.top], dims: pick.dims, hero: last,
    gaps: messages.map((_, i) => gapAfter(i) + gapExtra), offset: pick.kept === last ? Math.max(0, (spare - gapExtra * pick.kept) / 2) : 0,
  };
}

const Thread: React.FC<{d: ChatThreadData}> = ({d}) => {
  const head = useHeader(d);
  const winTop = Math.max(head ? head.bottom + 10 : ZONE_TOP, d.sticker ? 510 : 0);
  return <>
    {d.variant === 'notifications' ? <Notifications d={d} winTop={winTop}/> : <Bubbles d={d} winTop={winTop}/>}
    {head ? <Header head={head}/> : null}
  </>;
};

/** The masked window: everything inside is clipped to the band between the header strip and the caption line. */
const Window: React.FC<{top: number; children?: React.ReactNode}> = ({top, children}) =>
  <div style={{position: 'absolute', inset: 0, clipPath: `inset(${top}px 0 ${1920 - CLIP_BOTTOM}px 0)`}}>{children}</div>;

/** Three paper dots that hop in turn. */
const Dots: React.FC<{at: number; ink: string; dot: number}> = ({at, ink, dot}) => {
  const f = useCurrentFrame();
  return <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: dot * 0.7, direction: 'ltr'}}>
    {[0, 1, 2].map(k => <div key={k} style={{width: dot, height: dot, borderRadius: dot / 2, background: ink, boxShadow: '0 3px 4px rgba(0,0,0,0.28)',
      transform: `translateY(${-Math.abs(Math.sin((f - at) * 0.28 - k * 0.85)) * dot * 0.5}px)`}}/>)}
  </div>;
};

/** The bubble outline with its tail at the physical side of the speaker. */
const bubbleShape = (h: number, look: Look, rightSide: boolean, radius: number) => (w: number) => {
  const tailW = Math.round(look.size * 1.05), r = Math.min(radius, Math.floor(h / 2) - 2), x = rightSide ? w - r - 26 - tailW : r + 26;
  return polyShape(bubbleVerts({x, w: tailW, tip: [rightSide ? x + tailW + 14 : x - 14, h + look.tail]}, r), 1.4);
};

const DOTS_W = 210, HERO_DOTS_W = 340;

const Bubbles: React.FC<{d: ChatThreadData; winTop: number}> = ({d, winTop}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const {copy} = useKit();
  const winH = WIN_BOTTOM - winTop, typing = d.variant === 'typing';
  const times = chatMessageFrames(d, fps), lead = chatTypingFrames(fps);
  const key = JSON.stringify([d.messages.map(m => m.text), winH]);
  const plan = React.useMemo(() => planThread(d.messages, winH), [key]);  // eslint-disable-line react-hooks/exhaustive-deps
  const {looks, dims, gaps, offset, hero} = plan;
  const ys: number[] = [];
  dims.reduce((y, dim, i) => { ys[i] = winTop + offset + y; return y + dim.h + looks[i].tail + gaps[i]; }, 0);
  const dotsH = (i: number) => Math.round(looks[i].size * LINE) + 2 * looks[i].padY;
  // Scroll: after each event (the dots appear, the message lands) the thread eases up until the newest slot ends on the window's last line.
  const bottomOf = (i: number, h: number) => Math.max(0, ys[i] + h + looks[i].tail - WIN_BOTTOM);
  const events = d.messages.flatMap((_, i) => (typing
    ? [{at: times[i] - lead, target: bottomOf(i, dotsH(i))}, {at: times[i], target: bottomOf(i, dims[i].h)}]
    : [{at: times[i], target: bottomOf(i, dims[i].h)}]));
  let scroll = 0;
  events.forEach((e, i) => { if (f >= e.at) { const from = i ? events[i - 1].target : 0; scroll = from + (e.target - from) * ease3((f - e.at) / SCROLL_FRAMES); } });
  let meCount = -1;
  return <Window top={winTop}>
    <div style={{position: 'absolute', inset: 0, transform: `translateY(${-scroll}px)`}}>
      {d.messages.map((m, i) => {
        const dim = dims[i], look = looks[i], isHero = i === hero, mine = m.from === 'me';
        if (mine) meCount++;
        const fill = mine ? ME_FILLS[meCount % 2] : C.card, ink = fill === C.teal ? C.card : C.ink;
        const rightSide = copy.ar ? !mine : mine;   // physical side of the bubble after the kit mirrors an English scene
        const w = Math.round(Math.max(dim.width + 2 * look.padX, DOTS_W));
        const dotsW = isHero ? HERO_DOTS_W : DOTS_W, radius = isHero ? 64 : 46;
        const x = mine ? X0 : X1 - w, rot = (i % 2 ? 1 : -1) * (isHero ? 1.5 : 0.7 + (i % 3) * 0.3);
        const at = times[i], sign = mine ? -1 : 1;
        // A message that has been pushed partly under the header fades out whole instead of showing half a bubble.
        const shownShare = clamp((ys[i] - scroll + dim.h + look.tail - winTop) / (dim.h + look.tail), 0, 1);
        const fade = shownShare >= 0.999 ? 1 : clamp(shownShare * 1.7 - 0.6, 0, 1);
        const typingNow = typing && f >= at - lead && f < at;
        const land = isHero ? {from: [sign * 150, -480] as [number, number], rot: sign * 16, dur: 18} : {from: [sign * 60, -140] as [number, number], rot: sign * 7, dur: 14};
        const hit = isHero && f >= at + 15 ? 1 + 0.05 * Math.max(0, 1 - Math.abs(f - (at + 18)) / 6) : 1;
        const shape = bubbleShape(dim.h, look, rightSide, radius)(w);
        const lift = isHero ? 16 : 8, tapeLen = Math.round(clamp(look.size * 1.9, 90, 150)), tapeH = Math.round(clamp(look.size * 0.7, 36, 58));
        return <React.Fragment key={i}>
          {typingNow ? <Piece id={`ch-dots-${i}`} x={mine ? X0 : X1 - dotsW} y={ys[i]} w={dotsW} h={dotsH(i)} rot={rot} color={fill} shape={bubbleShape(dotsH(i), look, rightSide, radius)(dotsW)}
            enter={{at: at - lead, from: [0, -50], dur: 8}} depth={0.7} z={4}>
            <div data-chat-typing={rightSide ? 'right' : 'left'} style={{display: 'contents'}}>
              <Dots at={at - lead} ink={ink} dot={isHero ? 44 : 30}/>
            </div>
          </Piece> : null}
          {f >= at ? <div style={{opacity: fade, position: 'absolute', inset: 0, transformOrigin: `${x + w / 2}px ${ys[i] + dim.h / 2}px`, transform: hit === 1 ? undefined : `scale(${hit})`}}>
            <Piece id={`ch-under-${i}`} x={x + (rightSide === copy.ar ? lift + 1 : -lift - 1)} y={ys[i] + lift} w={w} h={dim.h} rot={rot + sign * (isHero ? -3.4 : -2.2)} color={UNDER[fill]} shape={shape}
              enter={{at: at + 2, from: land.from, dur: land.dur, rot: land.rot}} depth={isHero ? 0.5 : 0.3} z={4 + i}/>
            <Piece id={`ch-msg-${i}`} x={x} y={ys[i]} w={w} h={dim.h} rot={rot} color={fill} shape={shape} enter={{at, from: land.from, dur: land.dur, rot: land.rot}} depth={isHero ? 1.3 : 0.8} z={5 + i}>
              <div style={{position: 'absolute', left: look.padX, right: look.padX, top: look.padY, direction: copy.dir, textAlign: copy.align, fontFamily: BODY, fontWeight: TEXT_WEIGHT, fontSize: look.size,
                lineHeight: `${Math.round(look.size * LINE)}px`, color: ink, whiteSpace: 'nowrap'}}>
                {dim.lines.map((line, j) => <div key={j}>{line}</div>)}
              </div>
              <Tape cx={rightSide ? w - (isHero ? 26 : 56) : (isHero ? 26 : 56)} cy={isHero ? 2 : 6} len={tapeLen} h={tapeH} rot={rightSide ? 32 : -32} at={at + (isHero ? 17 : 14)} from={rightSide ? 'r' : 'l'} id={`ch-tape-${i}`}/>
              {isHero ? <Tape cx={rightSide ? 10 : w - 10} cy={dim.h - 2} len={Math.round(tapeLen * 0.8)} h={tapeH} rot={rightSide ? -34 : 34} at={at + 24} from={rightSide ? 'l' : 'r'} id={`ch-tape2-${i}`}/> : null}
            </Piece>
          </div> : null}
        </React.Fragment>;
      })}
    </div>
  </Window>;
};

// ---------- notifications: paper cards pinned with tape, newest on top ----------
const CARD_W = 880, MARK = 112, CARD_TEXT_W = CARD_W - MARK - 40;

type NotePlan = {size: number; padY: number; dims: Dim[]; gap: number; offset: number; fit: number};

/** The newest five cards at the largest type (66 down to 46 px) that stacks whole in the window; a stack that cannot fit shows fewer cards. */
function planNotes(messages: Message[], winH: number): NotePlan {
  const recent = messages.slice(-5).reverse();
  const at = (size: number, pad: number): NotePlan => {
    const look = {...olderLook(size), padY: Math.round(size * pad), tail: 0};
    const dims = recent.map(m => dimOf(m.text, look, CARD_TEXT_W));
    let used = 0, count = 0;
    for (const dim of dims) { const next = used + dim.h + (count ? GAP : 0); if (next > winH) break; used = next; count++; }
    const gap = GAP + (count > 1 ? Math.min(30, (winH - used) / (count - 1)) : 0);
    const shown = dims.slice(0, count).reduce((sum, dim) => sum + dim.h, 0) + (count - 1) * gap;
    return {size, padY: look.padY, dims, gap, fit: count, offset: count === recent.length ? Math.max(0, (winH - shown) / 2) : 0};
  };
  for (const size of NOTE_SIZES) {
    for (const pad of [0.5, 0.44, 0.38]) { const plan = at(size, pad); if (plan.fit === recent.length) return plan; }
  }
  return at(NOTE_SIZES[NOTE_SIZES.length - 1], 0.38);
}

const Notifications: React.FC<{d: ChatThreadData; winTop: number}> = ({d, winTop}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const {copy} = useKit();
  const winH = WIN_BOTTOM - 14 - winTop;
  const times = chatMessageFrames(d, fps);
  const key = JSON.stringify([d.messages.map(m => m.text), winH]);
  const plan = React.useMemo(() => planNotes(d.messages, winH), [key]);  // eslint-disable-line react-hooks/exhaustive-deps
  const cards = notificationCards(d, f, fps).slice(0, plan.fit);
  const last = d.messages.length - 1;
  const stackTop = winTop + plan.offset;
  return <Window top={winTop}>
    {cards.map((c, m) => {
      const dim = plan.dims[last - c.index];
      const pushed = cards.slice(0, m).reduce((sum, q) => sum + (plan.dims[last - q.index].h + plan.gap) * q.enter, 0);
      const fill = NOTE_FILLS[c.index % 5], ink = fill === C.teal ? C.card : C.ink, rightSide = copy.ar;
      return <Piece key={c.index} id={`ch-note-${c.index}`} x={X1 - CARD_W - NOTE_SHIFT[c.index % 5]} y={stackTop + pushed} w={CARD_W} h={dim.h} rot={NOTE_ROT[c.index % 5]} color={fill} shape={rectShape(6)}
        enter={{at: times[c.index], from: [0, -110], dur: 12}} depth={0.8} z={10 + c.index}>
        <div style={{position: 'absolute', [copy.side]: 30, top: (dim.h - 64) / 2, width: 64, height: 64, borderRadius: 32, background: NOTE_MARKS[c.index % 3], boxShadow: '0 3px 5px rgba(0,0,0,0.25)'}}/>
        <div style={{position: 'absolute', [copy.side]: MARK + 10, top: plan.padY, width: CARD_TEXT_W, direction: copy.dir, textAlign: copy.align, fontFamily: BODY, fontWeight: TEXT_WEIGHT, fontSize: plan.size,
          lineHeight: `${Math.round(plan.size * LINE)}px`, color: ink, whiteSpace: 'nowrap'}}>
          {dim.lines.map((line, j) => <div key={j}>{line}</div>)}
        </div>
        <Tape cx={rightSide ? CARD_W - 70 : 70} cy={6} len={110} h={40} rot={rightSide ? 30 : -30} at={times[c.index] + 14} from={rightSide ? 'r' : 'l'} id={`ch-nt-${c.index}`}/>
      </Piece>;
    })}
  </Window>;
};
