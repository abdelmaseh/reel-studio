// magazine-interview chat-thread: a conversation typeset as an interview transcript on a cream page.
// bubbles and typing: older messages are paragraphs (heavy for them, ink-weight for me), the newest is a big two-weight pull-quote with a hanging gold quote mark.
// notifications: a navy page of briefs, newest card on top and larger.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import type {ChatThreadData} from '../../../creative-kit/chat-thread/schema';
import {chatMessageFrames, chatTypingFrames, notificationCards} from '../../../creative-kit/chat-thread/timing';
import {SceneStickerSlot} from '../../../creative-kit/sticker-view';
import {displayWeight} from '../../../style-kit/design-safety';
import {CREAM, NAVY, HEAVY, W, X0, X1, CW, Diamond, Kicker, Mask, MagazineScope, QuoteGlyph, clamp01, mix, ramp, useMagazine, useType} from './kit';
import {Header, PlainPage, Settled, balancedLines, headBox, useHeaderPlan, type HeadBox} from './family-parts';

const ease3 = (t: number) => 1 - (1 - clamp01(t)) ** 3;
const smooth = (t: number) => { const k = clamp01(t); return k * k * (3 - 2 * k); };

/** The header text: the title is the headline, the app (when both exist) is the gold kicker above it. */
const headerText = (d: ChatThreadData) => ({text: d.title ?? d.app, kicker: d.title && d.app ? d.app : undefined});

// ---------- transcript: bubbles and typing ----------
// A printed interview spread. Older messages are set as 52 px paragraphs; the newest one is the hero, a big two-weight pull-quote
// with a gold opening quote mark hanging in the margin on its speaker's side. When few messages exist the hero grows to fill the page.

const OLD_SIZE = 52, OLD_BOX = Math.round(OLD_SIZE * 1.34), OLD_W = 700, OLD_GAP = 44, HERO_GAP = 70;
const HERO_L = 190, HERO_R = 853, HERO_W = HERO_R - HERO_L;   // the hero column stays left of the platform rail at any height
const WIN_BOTTOM = 1230, ME_WEIGHT = 400, HERO_THIN = 300;

const Transcript: React.FC<{d: ChatThreadData; head: HeadBox}> = ({d, head}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {copy, font} = useMagazine();
  const {planHeadline} = useType();
  const th = CREAM;
  const heavy = displayWeight(font, 'Alexandria', HEAVY);
  const typing = d.variant === 'typing';
  const times = chatMessageFrames(d, fps), typingFrames = chatTypingFrames(fps);
  const {text, kicker} = headerText(d);
  const plan = useHeaderPlan(text, head.width);
  const headTop = kicker ? 348 : 296;
  const winTop = plan ? headTop + plan.height + 22 + 26 : head.sticker ? 520 : 296;
  const winH = WIN_BOTTOM - winTop;
  const n = d.messages.length, last = n - 1;
  const weightOf = (m: ChatThreadData['messages'][number]) => (m.from === 'them' ? heavy : ME_WEIGHT);

  // measured once per scene: every message as an older paragraph and as the hero
  const key = JSON.stringify([d.messages.map(m => [m.from, m.text]), font, winH]);
  const lay = React.useMemo(() => {
    const olds = d.messages.map(m => {
      const lines = balancedLines(m.text, OLD_SIZE, weightOf(m), OLD_W, font);
      return {lines, h: lines.length * OLD_BOX};
    });
    const olderTotal = olds.slice(0, last).reduce((sum, o) => sum + o.h + OLD_GAP, 0);
    const avail = Math.min(winH * 0.9, Math.max(winH * 0.36, winH - olderTotal - HERO_GAP));
    const hero = (m: ChatThreadData['messages'][number], max: number) => planHeadline(m.text, {max, min: 48, lines: 9, width: HERO_W, maxHeight: avail, thinWeight: HERO_THIN});
    const heroMax = hero(d.messages[last], 112).size;
    const heroes = d.messages.map(m => hero(m, heroMax));
    const finalH = olds.slice(0, last).reduce((sum, o, i) => sum + o.h + (i ? OLD_GAP : 0), 0) + (last ? HERO_GAP : 0) + heroes[last].height;
    return {olds, heroes, finalH};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const {olds, heroes, finalH} = lay;

  // slots: each message grows in, and the previous hero steps down to an older paragraph when the next message lands
  const heroness = (i: number) => (i === last ? 1 : 1 - ease3((f - times[i + 1]) / 12));
  const dotsH = (i: number) => heroes[i].box;
  const slot = d.messages.map((_, i) => {
    const at = times[i], target = mix(olds[i].h, heroes[i].height, heroness(i));
    if (!typing) return target * ease3((f - at) / 20);
    return f < at ? dotsH(i) * ease3((f - (at - typingFrames)) / 12) : dotsH(i) + (target - dotsH(i)) * ease3((f - at) / 20);
  });
  const ys: number[] = [];
  slot.reduce((y, h, i) => {
    ys[i] = y;
    return y + h + (i < last ? mix(OLD_GAP, HERO_GAP, heroness(i + 1)) * clamp01(slot[i + 1] / 40) : 0);
  }, 0);
  const used = Math.max(0, ...slot.map((h, i) => (h > 0 ? ys[i] + h : 0)));
  const padTop = 10, padBottom = 20;
  const baseY = finalH + padTop + padBottom < winH ? (winH - finalH) * 0.5 : padTop;
  const shift = Math.max(0, baseY + used + padBottom - winH);
  // once older lines are pushed up they fade out one whole line at a time under the header rule, so nothing is ever cut in half
  const fadeOn = clamp01(shift / 30);
  const lineAlpha = (centre: number) => 1 - fadeOn * (1 - smooth((centre - 60) / 70));

  return <PlainPage th={th}>
    {kicker ? <Kicker th={th} text={kicker} top={296} at={2} right={head.right}/> : null}
    {plan && text ? <Header plan={plan} th={th} top={headTop} at={4} right={head.right} width={head.width}/> : null}
    <div style={{position: 'absolute', left: 0, top: winTop, width: W, height: winH, overflow: 'hidden'}}>
      {d.messages.map((m, i) => {
        if (slot[i] <= 0) return null;
        const them = m.from === 'them', at = times[i];
        const side = them ? copy.side : copy.opposite;
        const y = baseY + ys[i] - shift;
        const hero = heroes[i], old = olds[i], t = heroness(i);
        const heroOpacity = clamp01((t - 0.35) / 0.65), oldOpacity = clamp01(1 - t * 1.4);
        const dotsK = ease3((f - (at - typingFrames)) / 10) * (1 - ease3((f - at) / 6));
        const lineK = ramp(f, typing ? at - typingFrames : at, 28);
        const markA = lineAlpha(y + Math.min(slot[i], old.h) / 2);
        const dotsOffset = side === copy.side ? W - HERO_R : HERO_L;
        const dotsSide = (side === 'left') === (dotsOffset < 540) ? 'left' : 'right';
        return <React.Fragment key={i}>
          {heroOpacity > 0.01 ? <>
            <QuoteGlyph open size={170} color={th.gold} p={ramp(f, at + 2, 24)} style={{top: y - 34, [side]: 96, opacity: heroOpacity * lineAlpha(y + 40)}}/>
            <div aria-label={m.text} style={{position: 'absolute', top: y, [side]: side === copy.side ? W - HERO_R : HERO_L, width: HERO_W, direction: copy.dir, opacity: heroOpacity}}>
              {hero.rows.map((row, j) => <div key={j} style={{display: 'flow-root', opacity: lineAlpha(y + j * hero.box + hero.box / 2)}}>
                <Mask h={hero.box} pad={Math.round(hero.size * 0.34)} k={ramp(f, at + 3 + j * 4, 18)}>
                  <div style={{fontFamily: font, fontWeight: row.key ? mix(HERO_THIN, heavy, ramp(f, at + 8 + j * 2, 12)) : HERO_THIN, fontSize: hero.size, lineHeight: `${hero.box}px`, height: hero.box, color: th.ink, whiteSpace: 'nowrap', textAlign: side}}>{row.text}</div>
                </Mask>
              </div>)}
            </div>
          </> : null}
          {oldOpacity > 0.01 ? <div style={{position: 'absolute', left: 0, top: y, width: W, opacity: oldOpacity}}>
            {them ? <>
              <div style={{position: 'absolute', top: Math.round(OLD_BOX * 0.12), [side]: X0 + 4, width: 2, height: Math.max(0, old.h - OLD_BOX * 0.24) * lineK, background: th.gold, opacity: markA}}/>
              <Diamond size={16} color={th.gold} style={{position: 'absolute', top: Math.round(OLD_BOX * 0.5) - 8, [side]: X0 - 4, opacity: clamp01(lineK * 3) * markA}}/>
            </> : <div style={{position: 'absolute', top: Math.round(OLD_BOX * 0.5) - 1, [side]: X0, width: 46 * ease3(lineK * 1.6), height: 2.5, background: th.gold, opacity: markA}}/>}
            <div aria-label={m.text} style={{position: 'absolute', top: 0, [side]: X0 + 64, width: OLD_W, direction: copy.dir}}>
              {old.lines.map((line, j) => <div key={j} style={{display: 'flow-root', opacity: lineAlpha(y + j * OLD_BOX + OLD_BOX / 2)}}>
                <Mask h={OLD_BOX} pad={Math.round(OLD_SIZE * 0.34)} k={ramp(f, at + 4 + j * 5, 22)}>
                  <div style={{fontFamily: font, fontWeight: weightOf(m), fontSize: OLD_SIZE, lineHeight: `${OLD_BOX}px`, height: OLD_BOX, color: th.ink, whiteSpace: 'nowrap', textAlign: side}}>{line}</div>
                </Mask>
              </div>)}
            </div>
          </div> : null}
          {typing && dotsK > 0.01 ? <div data-chat-typing={dotsSide} style={{position: 'absolute', top: y + (hero.box - 22) / 2, [side]: dotsOffset, display: 'flex', gap: 28, direction: 'ltr', opacity: dotsK * lineAlpha(y + hero.box / 2)}}>
            {[0, 1, 2].map(k => <div key={k} style={{width: 22, height: 22, borderRadius: 11, background: th.gold, transform: `scale(${0.72 + 0.55 * Math.max(0, Math.sin((f / 11 - k * 0.45) * Math.PI))})`}}/>)}
          </div> : null}
        </React.Fragment>;
      })}
    </div>
  </PlainPage>;
};

// ---------- notifications: a page of briefs ----------

/** The newest brief is set large and heavy; each older one steps down in size and width. */
const TIERS = [{size: 68, weight: 700, width: CW, pad: 40}, {size: 56, weight: 600, width: CW - 60, pad: 30}, {size: 46, weight: 600, width: CW - 120, pad: 26}] as const;
const BRIEF_SIDE = 48;
const tierOf = (depth: number) => (depth < 0.5 ? 0 : depth < 1.5 ? 1 : 2);
const stepped = (depth: number, values: readonly number[]) => depth <= 1 ? mix(values[0], values[1], clamp01(depth)) : mix(values[1], values[2], clamp01(depth - 1));

const Briefs: React.FC<{d: ChatThreadData; head: HeadBox}> = ({d, head}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {copy, font} = useMagazine();
  const th = NAVY;
  const times = chatMessageFrames(d, fps);
  const {text, kicker} = headerText(d);
  const plan = useHeaderPlan(text, head.width);
  const headTop = kicker ? 348 : 296;
  const winTop = plan ? headTop + plan.height + 22 + 26 : head.sticker ? 520 : 296;
  const cards = notificationCards(d, f, fps);
  const measured = d.messages.map(m => {
    const words = m.text.split(/\s+/);
    const lead = words.findIndex((w, i) => i < 4 && /[:：]$/.test(w)) + 1;
    const tiers = TIERS.map(t => {
      const box = Math.round(t.size * 1.34);
      const lines = balancedLines(m.text, t.size, t.weight, t.width - 2 * BRIEF_SIDE - 8, font);
      return {lines, box, h: lines.length * box + 2 * t.pad};
    });
    return {lead, tiers};
  });
  let y = 0;
  const placed = cards.map(c => {
    const m = measured[c.index], tier = tierOf(c.depth);
    const h = stepped(c.depth, m.tiers.map(t => t.h)), top = y;
    y += (h + 20) * c.enter;
    return {...c, m, tier, h, top, width: stepped(c.depth, TIERS.map(t => t.width))};
  });
  return <PlainPage th={th}>
    {kicker ? <Kicker th={th} text={kicker} top={296} at={2} right={head.right}/> : null}
    {plan && text ? <Header plan={plan} th={th} top={headTop} at={4} right={head.right} width={head.width}/> : null}
    <div style={{position: 'absolute', left: 0, top: winTop, width: W, height: 1150 - winTop, overflow: 'hidden',
      WebkitMaskImage: 'linear-gradient(180deg, #000 0, #000 calc(100% - 110px), transparent 100%)', maskImage: 'linear-gradient(180deg, #000 0, #000 calc(100% - 110px), transparent 100%)'}}>
      {[...placed].reverse().map(({index, enter, depth, m, tier, h, top, width}) => {
        const at = times[index], t = TIERS[tier], lay = m.tiers[tier];
        let word = 0;
        const newest = tier === 0;
        return <div key={index} data-notification={index} style={{position: 'absolute', [copy.side]: W - X1, top: 6 + top - (1 - enter) * 80, width, height: h, opacity: enter * Math.max(0.55, 1 - 0.12 * Math.min(depth, 4))}}>
          <svg width={width} height={h} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
            <rect x={0.75} y={0.75} width={width - 1.5} height={h - 1.5} fill={newest ? 'rgba(243,199,118,0.08)' : 'rgba(245,243,236,0.045)'} stroke={th.gold} strokeOpacity={newest ? 0.9 : 0.55} strokeWidth={newest ? 2 : 1.5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ramp(f, at, 26)}/>
            <rect x={8} y={8} width={width - 16} height={h - 16} fill="none" stroke={th.gold} strokeOpacity={0.24} strokeWidth={1} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ramp(f, at + 4, 28)}/>
          </svg>
          <div style={{position: 'absolute', [copy.side]: 0, top: 16, width: newest ? 8 : 5, height: (h - 32) * ramp(f, at + 2, 24), background: th.gold}}/>
          <Diamond size={newest ? 20 : 15} color={th.gold} style={{position: 'absolute', [copy.side]: 40, top: newest ? -10 : -8, opacity: ramp(f, at, 14)}}/>
          <div aria-label={d.messages[index].text} style={{position: 'absolute', top: (h - lay.lines.length * lay.box) / 2, [copy.side]: BRIEF_SIDE, width: width - 2 * BRIEF_SIDE - 8, direction: copy.dir}}>
            {lay.lines.map((line, j) => <Mask key={j} h={lay.box} pad={Math.round(t.size * 0.34)} k={ramp(f, at + 6 + j * 5, 22)}>
              <div style={{fontFamily: font, fontWeight: t.weight, fontSize: t.size, lineHeight: `${lay.box}px`, height: lay.box, color: th.ink, whiteSpace: 'nowrap', textAlign: copy.align}}>
                {m.lead === 0 ? <span style={{color: th.ink}}>{line}</span> : line.split(' ').map((w, k) => <React.Fragment key={k}>{k ? ' ' : ''}<span style={{color: word++ < m.lead ? th.gold : th.ink}}>{w}</span></React.Fragment>)}
              </div>
            </Mask>)}
          </div>
        </div>;
      })}
    </div>
  </PlainPage>;
};

// ---------- entry ----------

export const ChatThread: React.FC<FamilyDesignProps> = ({scene}) => {
  if (scene.family !== 'chat-thread') return null;
  const d = scene.data, head = headBox(d.sticker);
  return <Settled><MagazineScope data={d}>
    {d.variant === 'notifications' ? <Briefs d={d} head={head}/> : <Transcript d={d} head={head}/>}
    <SceneStickerSlot host="chat-thread" sticker={d.sticker} ink={d.variant === 'notifications' ? NAVY.ink : CREAM.ink}/>
  </MagazineScope></Settled>;
};
