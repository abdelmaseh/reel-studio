// The worlds of a one-shot chain. Each world draws one full-screen page for scene time `t` from the numbers of its
// block in the timeline; the camera, the bridges between worlds and the motion blur live in ./scene.
import React from 'react';
import {evolvePath} from '@remotion/paths';
import {ArrowUp, ChevronLeft, Film} from 'lucide-react';
import {
  Badge, Cursor, EASE, H, Ring, TitleBlock, W, Words, along, at, bump, lerp, mix, numberText, prog, worldBox,
  type Ctx,
} from './kit';
import {
  BAND, CHIP, DESK, FIELD, STAT, TILE, TOGGLE, WORK, REEL, digitOf, fieldFont, fitLine, headlineSize, introLayout, karaokeStep, reelCaptionSize, statSizes,
  type AskTimes, type ClosingTimes, type FinaleTimes, type StatTimes, type ToggleTimes,
} from './math.ts';
import type {OneShotData, OneShotStep} from './schema';

type Step<K extends OneShotStep['kind']> = Extract<OneShotStep, {kind: K}>;
const ARABIC = /[؀-ۿ]/;
const familyFor = (text: string, ctx: Ctx): string => (ARABIC.test(text) ? ctx.f.ui : ctx.f.latin);

// Fixed places on the canvas that the bridges start from (every box stays inside the Instagram safe area, see ./math).
export const SEND = {x: FIELD.sendX, y: FIELD.cy, r: FIELD.sendR};
export const DOT = {x: 540, y: STAT.dotY, r: STAT.dotR};

// ---------------------------------------------------------------- home: the first and the last frame
export const IntroWorld: React.FC<{ctx: Ctx; data: OneShotData; live: boolean; clickAt: number; probe?: string | null}> = ({ctx, data, live, clickAt, probe = null}) => {
  const {t, c, f} = ctx;
  const rows = data.steps.length, L = introLayout(rows), pill = {x: 540, y: L.pillY};
  const hs = headlineSize(data.intro.top, data.intro.bottom), big = L.rowH >= 88;
  const press = live && t >= clickAt && t < clickAt + 0.14;
  const label = live ? 1 - at(t, clickAt + 0.06, clickAt + 0.28, EASE.expoIn) : 1;
  const cur = live ? along(t, [[0.12, 980, 2080], [0.95, pill.x + 220, pill.y + 200], [clickAt - 0.08, pill.x + 72, pill.y + 38]]) : null;
  return <div style={worldBox(probe ?? c.cream)}>
    <div style={{position: 'absolute', top: 262, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14,
      fontFamily: f.latin, fontWeight: 700, fontSize: 38, color: c.ink}}>
      <span style={{width: 22, height: 22, borderRadius: 11, background: c.accent, border: `3px solid ${c.ink}`, boxSizing: 'border-box'}} />{data.brand}
    </div>
    <div dir="rtl" style={{position: 'absolute', top: 330, left: 0, right: 0, textAlign: 'center', fontFamily: f.display, fontWeight: 900, fontSize: hs, lineHeight: 1.18, color: c.ink}}>
      <div>{data.intro.top}</div>
      <div style={{display: 'inline-block', background: c.accent, padding: '0 36px', borderRadius: 40, transform: 'rotate(-1.5deg)'}}>{data.intro.bottom}</div>
    </div>
    <div style={{position: 'absolute', top: 330 + Math.round(2.36 * hs) + 24, left: 75, right: 75, textAlign: 'center', fontFamily: f.ui, fontWeight: 600, fontSize: 40, color: c.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{data.intro.sub}</div>
    <div style={{position: 'absolute', left: BAND.left, top: L.cardTop, width: BAND.width, height: L.cardH, borderRadius: 52, background: c.white, boxShadow: probe ? undefined : '0 40px 90px rgba(14,17,23,0.14)'}}>
      {data.steps.map((s, i) => {
        const on = live ? bump(t, 0.2 + i * 0.28, 0.32 + i * 0.28, 0.4 + i * 0.28, 0.68 + i * 0.28) : 0;
        return <div key={i} dir="rtl" style={{position: 'absolute', left: 28, right: 28, top: 30 + i * L.pitch, height: L.rowH, borderRadius: 30, background: mix('#FFFFFF', c.accent, 0.6 * on),
          display: 'flex', alignItems: 'center', gap: 22, padding: '0 20px'}}>
          <div style={{width: big ? 64 : 56, height: big ? 64 : 56, borderRadius: 32, background: mix('#EFEAE0', c.ink, on), color: mix(c.ink, c.accent, on), display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontFamily: f.display, fontWeight: 900, fontSize: big ? 38 : 32, flexShrink: 0}}>{digitOf(i + 1, ctx.digits)}</div>
          <div style={{flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: f.ui, fontWeight: 700, fontSize: big ? 42 : 38, color: c.ink, whiteSpace: 'nowrap'}}>{`${s.title.top} ${s.title.bottom}`}</div>
          <ChevronLeft size={big ? 40 : 34} color={c.muted} style={{flexShrink: 0}} />
        </div>;
      })}
    </div>
    <div style={{position: 'absolute', left: pill.x - L.pillW / 2, top: pill.y - L.pillH / 2, width: L.pillW, height: L.pillH, borderRadius: L.pillH / 2, background: c.ink,
      transform: `scale(${press ? 0.96 : 1})`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20}}>
      <span dir="rtl" style={{fontFamily: f.display, fontWeight: 800, fontSize: 52, color: c.white, opacity: label, whiteSpace: 'nowrap'}}>{data.intro.start}</span>
      <ChevronLeft size={52} color={c.accent} strokeWidth={3} style={{opacity: label, flexShrink: 0}} />
    </div>
    {live ? <Ring x={pill.x + 72} y={pill.y + 38} t={t} t0={clickAt} color={c.ink} /> : null}
    {cur && cur[1] < H ? <Cursor x={cur[0]} y={cur[1]} press={press} ink={c.ink} /> : null}
  </div>;
};

// ---------------------------------------------------------------- the file tile becomes the chat field
export const sendCursorAt = (t: number, b: AskTimes): [number, number] =>
  along(t, [[b.curEnter, 1180, 1520], [b.curEnter + 0.7, 620, 1280], [b.curEnter + 1.33, SEND.x + 6, SEND.y + 8]]);

export const AskWorld: React.FC<{ctx: Ctx; b: AskTimes; drop?: Step<'drop'>; field: Step<'field'>; cursorOn?: boolean; probe?: string | null}> = ({ctx, b, drop, field, cursorOn = true, probe = null}) => {
  const {t, c, f} = ctx;
  const hasDrop = b.hasDrop;
  const settle = b.lead === 0 ? 1 + 0.045 * (1 - at(t, b.start, b.start + 0.8)) : 1;
  const m = hasDrop ? at(t, b.morph[0], b.morph[1], EASE.inOut) : 1;
  const fillK = hasDrop ? EASE.out(prog(m, 0.4, 0.92)) : 1;
  const invertK = hasDrop ? EASE.inOut(prog(m, 0.4, 0.8)) : 1;
  const badgeIn = at(t, b.badgeIn, b.badgeIn + 0.5, EASE.pop);
  const fromNum = hasDrop ? b.num : b.lead > 0 ? b.num - 1 : b.num, toNum = hasDrop ? b.num + 1 : b.num;
  const roll = hasDrop || b.lead > 0 ? at(t, b.roll[0], b.roll[1], EASE.inOut) : 1;
  const tileIn = hasDrop ? at(t, b.tileIn[0], b.tileIn[1]) : at(t, b.fieldOn[0], b.fieldOn[1]);
  const hover = prog(t, b.drag[1] - 0.55, b.drag[1]) * (1 - prog(t, b.drop, b.drop + 0.1));
  const dip = bump(t, b.drop, b.drop + 0.13, b.drop + 0.13, b.drop + 0.5);
  const sx = hasDrop ? 1 + 0.035 * hover - 0.05 * dip : 1, sy = hasDrop ? 1 + 0.035 * hover + 0.03 * dip : 1;
  // The tile first flattens into the height of the field and only then widens, so it never reaches the action rail on its way.
  const mh = EASE.inOut(prog(m, 0, 0.5)), mw = EASE.inOut(prog(m, 0.4, 1));
  const R = {cx: 540, cy: lerp(TILE.cy, FIELD.cy, mh), w: lerp(TILE.size, FIELD.w, mw), h: lerp(TILE.size, FIELD.h, mh), r: lerp(90, 95, m)};

  // the file: chip -> token
  const chipIn = at(t, b.chipIn, b.chipIn + 0.55);
  const u = EASE.inOut(prog(t, b.drag[0], b.drag[1]));
  const bez = (p0: number, k: number, p1: number) => (1 - u) * (1 - u) * p0 + 2 * (1 - u) * u * k + u * u * p1;
  const toToken = EASE.inOut(prog(t, b.drop, b.drop + 0.4));
  const lifted = prog(t, b.grab, b.grab + 0.15) * (1 - prog(t, b.drop, b.drop + 0.15));
  const drag: [number, number] = [bez(CHIP.x, 560, 540), bez(CHIP.y, 1200, TILE.cy)];
  const tc: [number, number] = t < b.drop ? [drag[0], drag[1] + (1 - chipIn) * 60] : [lerp(540, FIELD.tokenX, mw), lerp(TILE.cy, FIELD.cy, mh)];
  const cw = lerp(520, 300, toToken), ch = lerp(150, 80, toToken), cr = lerp(42, 40, toToken);
  const chipBg = mix(mix(c.panel, c.accent, toToken), c.ink, invertK);
  const nameColor = mix(mix(c.white, c.ink, toToken), c.accent, invertK);
  const item = drop?.item ?? '';

  // the cursor: grabs the chip, drops it and leaves; later it comes back for the send button
  let cur: [number, number] | null = null;
  let pressed = false;
  if (hasDrop) {
    if (t >= b.chipIn + 0.1 && t < b.drag[0]) cur = along(t, [[b.chipIn + 0.1, 1240, 1700], [b.grab, CHIP.x + 170, CHIP.y + 45]]);
    else if (t >= b.drag[0] && t < b.drop) { cur = [drag[0] + 170, drag[1] + 45]; pressed = true; }
    else if (t >= b.drop && t < b.drop + 0.85) cur = along(t, [[b.drop, 710, 1105], [b.drop + 0.85, 1230, 1000]]);
  }
  if (t >= b.curEnter) { cur = sendCursorAt(t, b); pressed = t >= b.click && t < b.click + 0.14; }
  const curOp = t < b.drop + 0.85 && t >= b.drop ? 1 - prog(t, b.drop + 0.35, b.drop + 0.85) : 1;

  // the sentence
  const typed = field.text.split(/\s+/).filter(Boolean);
  const size = fieldFont(field.text.length, hasDrop);
  const fieldOn = at(t, b.fieldOn[0], b.fieldOn[1]);
  const sendOn = at(t, b.sendOn, b.sendOn + 0.25, EASE.pop);
  const sendPress = t >= b.click && t < b.click + 0.14 ? 0.9 : 1;
  const iconOut = prog(t, b.iconFade[0], b.iconFade[1]);
  const bg = probe ?? c.ink;

  return <div style={worldBox(bg, {transform: `scale(${settle})`})}>
    <Badge bg={c.accent} fg={c.ink} family={f.display} fromNum={fromNum} toNum={toNum} roll={roll} scale={badgeIn} digits={ctx.digits} />
    {hasDrop && drop ? <TitleBlock t={t} top={drop.title.top} bottom={drop.title.bottom} in1={b.title1In} in2={b.title2In} out1={b.title1Out} out2={b.title2Out}
      c1={c.white} c2={c.accent} family={f.display} /> : null}
    <TitleBlock t={t} top={field.title.top} bottom={field.title.bottom} in1={b.fieldTitle1In} in2={b.fieldTitle2In} c1={c.white} c2={c.accent} family={f.display} />

    {/* the carrier: dashed folder tile -> white chat field */}
    <div style={{position: 'absolute', left: R.cx - R.w / 2, top: R.cy - R.h / 2, width: R.w, height: R.h, borderRadius: R.r,
      background: 'rgba(255,255,255,0.06)', boxShadow: probe ? undefined : `0 ${30 * fillK}px ${80 * fillK}px rgba(0,0,0,${0.45 * fillK})`,
      transform: `scale(${sx * lerp(0.92, 1, tileIn)}, ${sy * lerp(0.92, 1, tileIn)})`, opacity: tileIn}}>
      {hasDrop ? <svg width={R.w} height={R.h} style={{position: 'absolute', left: 0, top: 0, opacity: (1 - prog(m, 0, 0.45)) * (0.55 + 0.45 * hover)}}>
        <rect x={2} y={2} width={R.w - 4} height={R.h - 4} rx={R.r} fill="none" stroke={c.accent} strokeWidth={4} strokeDasharray="22 18" strokeDashoffset={-t * 40} />
      </svg> : null}
      <div style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', borderRadius: R.r, background: c.white, transform: `scaleX(${fillK})`, transformOrigin: '50% 50%'}} />
    </div>
    {hasDrop && drop ? <>
      <div style={{position: 'absolute', left: 540 - 95, top: 1010 - 85, width: 190, height: 170, opacity: tileIn * (1 - iconOut), transform: `scale(${lerp(1, 0.85, iconOut)})`}}>
        <svg width="190" height="170" viewBox="0 0 190 170">
          <path d="M14 26 H70 L92 50 H176 A12 12 0 0 1 188 62 V148 A12 12 0 0 1 176 160 H14 A12 12 0 0 1 2 148 V38 A12 12 0 0 1 14 26 Z"
            fill={c.accent} fillOpacity={0.14} stroke={c.accent} strokeWidth={7} strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{position: 'absolute', left: 540 - 150, top: 1160, width: 300, textAlign: 'center', fontFamily: familyFor(drop.target, ctx), fontWeight: 700, fontSize: 52, color: c.white,
        opacity: tileIn * (1 - iconOut)}}>{drop.target}</div>
      {t >= b.chipIn ? <div style={{position: 'absolute', left: tc[0] - cw / 2, top: tc[1] - ch / 2, width: cw, height: ch, borderRadius: cr, background: chipBg,
        border: `2px solid ${mix(c.line, c.accent, toToken)}`, boxSizing: 'border-box', boxShadow: probe ? undefined : `0 ${34 * lifted}px ${70 * lifted}px rgba(0,0,0,0.55)`, opacity: Math.min(1, chipIn * 3),
        transform: `scale(${1 + 0.06 * lifted}) rotate(${-2 * lifted}deg)`, overflow: 'hidden', direction: 'ltr'}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 22, padding: '0 20px', opacity: 1 - prog(t, b.drop + 0.05, b.drop + 0.23)}}>
          <div style={{width: 112, height: 112, borderRadius: 26, background: 'linear-gradient(135deg, #2E5BFF 0%, #7A3CFF 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
            <Film size={52} color="#FFFFFF" strokeWidth={2.2} />
          </div>
          <div style={{fontFamily: f.latin, fontWeight: 600, fontSize: 38, color: c.white, whiteSpace: 'nowrap'}}>{item}</div>
        </div>
        <div style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: prog(t, b.drop + 0.1, b.drop + 0.3)}}>
          <Film size={34} color={nameColor} strokeWidth={2.4} />
          <span style={{fontFamily: f.latin, fontWeight: 600, fontSize: 32, color: nameColor, whiteSpace: 'nowrap'}}>{item}</span>
        </div>
      </div> : null}
    </> : null}

    {/* the sentence */}
    <div style={{position: 'absolute', right: W - FIELD.textRight, top: FIELD.cy - 45, height: 90, display: 'flex', alignItems: 'center'}}>
      <div dir="rtl" style={{display: 'flex', gap: 16, fontFamily: f.ui, fontWeight: 700, fontSize: size, color: c.ink, whiteSpace: 'nowrap'}}>
        {typed.map((w, i) => {
          const p = at(t, b.words[i], b.words[i] + 0.4);
          return <span key={i} style={{display: 'inline-block', overflow: 'hidden', padding: '8px 0', margin: '-8px 0'}}>
            <span style={{display: 'inline-block', transform: `translateY(${(1 - p) * 120}%)`}}>{w}</span>
          </span>;
        })}
      </div>
    </div>
    <div dir="rtl" style={{position: 'absolute', right: W - FIELD.textRight, top: FIELD.cy - 40, height: 80, display: 'flex', alignItems: 'center', fontFamily: f.ui, fontWeight: 600, fontSize: 46,
      color: '#9AA1B0', opacity: fieldOn * (1 - at(t, b.typeStart - 0.02, b.typeStart + 0.1))}}>{field.placeholder}</div>
    <div style={{position: 'absolute', left: SEND.x - 70, top: SEND.y - 70, width: 140, height: 140, borderRadius: 70, boxSizing: 'border-box',
      background: sendOn > 0.01 ? c.accent : 'transparent', border: `5px solid ${mix('#E3E6EC', c.accent, sendOn)}`, opacity: fieldOn, transform: `scale(${lerp(1, 1.08, sendOn) * sendPress})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <ArrowUp size={66} color={mix('#B4BAC6', c.ink, sendOn)} strokeWidth={3.2} />
    </div>
    <Ring x={SEND.x + 6} y={SEND.y + 8} t={t} t0={b.click} color={c.accent} />
    {cur && cursorOn && !probe ? <Cursor x={cur[0]} y={cur[1]} press={pressed} opacity={curOp} ink={c.ink} /> : null}
  </div>;
};

// ---------------------------------------------------------------- a list of switches: the cursor turns them on
export const switchCenter = (index: number): [number, number] => [TOGGLE.switchX, TOGGLE.cardTop + 40 + index * TOGGLE.pitch + 70];

export const ToggleWorld: React.FC<{ctx: Ctx; b: ToggleTimes; step: Step<'toggle'>; cursorOn?: boolean; probe?: string | null}> = ({ctx, b, step, cursorOn = true, probe = null}) => {
  const {t, c, f} = ctx;
  const n = step.options.length, cardH = 40 + n * TOGGLE.pitch;
  const badgeIn = at(t, b.badgeIn, b.badgeIn + 0.4, EASE.pop);
  const roll = at(t, b.roll[0], b.roll[1], EASE.inOut);
  const cardIn = at(t, b.cardIn[0], b.cardIn[1], EASE.pop);
  const onIndexes = step.options.map((option, i) => (option.on ? i : -1)).filter((i) => i >= 0);
  const pts: [number, number, number][] = [[b.curEnter, 1180, 1520]];
  onIndexes.forEach((optionIndex, j) => {
    const [sx, sy] = switchCenter(optionIndex);
    pts.push([b.presses[j] - 0.15, sx + 6, sy + 8], [b.presses[j] + 0.3, sx + 6, sy + 8]);
  });
  const cur = t >= b.curEnter ? along(t, pts) : null;
  const pressing = b.presses.some((p) => t >= p && t < p + 0.14);
  return <div style={worldBox(probe ?? c.accent)}>
    <Badge bg={c.ink} fg={c.accent} family={f.display} fromNum={b.num - 1} toNum={b.num} roll={roll} scale={badgeIn} digits={ctx.digits} />
    <TitleBlock t={t} top={step.title.top} bottom={step.title.bottom} in1={b.title1In} in2={b.title2In} c1={c.ink} c2={c.ink} family={f.display} />
    <div style={{position: 'absolute', left: BAND.left, top: TOGGLE.cardTop, width: BAND.width, height: cardH, borderRadius: 56, background: c.white, boxShadow: probe ? undefined : '0 40px 90px rgba(14,17,23,0.22)',
      transform: `scale(${lerp(0.9, 1, cardIn)})`, opacity: Math.min(1, cardIn * 3)}}>
      {step.options.map((option, i) => {
        const j = onIndexes.indexOf(i);
        const k = j >= 0 ? at(t, b.presses[j], b.presses[j] + 0.3, EASE.pop) : 0;
        return <div key={i} dir="rtl" style={{position: 'absolute', left: 44, right: 44, top: 40 + i * TOGGLE.pitch, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <div style={{flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: f.ui, fontWeight: 700, fontSize: 46, color: c.ink, whiteSpace: 'nowrap'}}>{option.label}</div>
          <div style={{width: 150, height: 84, borderRadius: 42, background: mix('#E3DED2', c.ink, Math.min(1, k)), position: 'relative', flexShrink: 0}}>
            <div style={{position: 'absolute', top: 8, left: lerp(8, 150 - 8 - 68, Math.min(1.05, k)), width: 68, height: 68, borderRadius: 34, background: c.white, boxShadow: probe ? undefined : '0 4px 10px rgba(0,0,0,0.25)'}} />
          </div>
        </div>;
      })}
    </div>
    {onIndexes.map((optionIndex, j) => <Ring key={j} x={switchCenter(optionIndex)[0] + 6} y={switchCenter(optionIndex)[1] + 8} t={t} t0={b.presses[j]} color={c.ink} />)}
    {cur && cursorOn && !probe ? <Cursor x={cur[0]} y={cur[1]} press={pressing} ink={c.ink} /> : null}
  </div>;
};

/** Where the circle opens from when this toggle hands over: the last switch that was turned on. */
export const toggleAnchor = (step: Step<'toggle'>): {x: number; y: number; r: number} => {
  const last = step.options.map((option, i) => (option.on ? i : -1)).filter((i) => i >= 0).pop() ?? 0;
  const [x, y] = switchCenter(last);
  return {x, y, r: 34};
};

// ---------------------------------------------------------------- one big number
export const StatWorld: React.FC<{ctx: Ctx; b: StatTimes; step: Step<'stat'>; probe?: string | null}> = ({ctx, b, step, probe = null}) => {
  const {t, c, f} = ctx;
  const badgeIn = at(t, b.badgeIn, b.badgeIn + 0.4, EASE.pop);
  const roll = at(t, b.roll[0], b.roll[1], EASE.inOut);
  const cardIn = at(t, b.cardIn[0], b.cardIn[1], EASE.pop);
  const value = step.value * at(t, b.count[0], b.count[1], EASE.out);
  const text = numberText(value, step.decimals, ctx.digits);
  const sizes = statSizes(numberText(step.value, step.decimals, ctx.digits), step.unit);
  const label = at(t, b.labelIn, b.labelIn + 0.5);
  const dot = at(t, b.dotIn[0], b.dotIn[1], EASE.pop);
  return <div style={worldBox(probe ?? c.ink)}>
    <Badge bg={c.accent} fg={c.ink} family={f.display} fromNum={b.lead > 0 ? b.num - 1 : b.num} toNum={b.num} roll={roll} scale={badgeIn} digits={ctx.digits} />
    <TitleBlock t={t} top={step.title.top} bottom={step.title.bottom} in1={b.title1In} in2={b.title2In} c1={c.white} c2={c.accent} family={f.display} />
    <div style={{position: 'absolute', left: BAND.left, top: STAT.cardTop, width: BAND.width, height: STAT.cardH, borderRadius: 60, background: 'rgba(255,255,255,0.06)', border: `2px solid ${c.line}`, boxSizing: 'border-box',
      transform: `scale(${lerp(0.9, 1, cardIn)})`, opacity: Math.min(1, cardIn * 3)}}>
      <div dir="rtl" style={{position: 'absolute', left: 0, right: 0, top: 36, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 24}}>
        <span style={{fontFamily: f.latin, fontWeight: 700, fontSize: sizes.num, lineHeight: 1.05, color: c.accent, fontVariantNumeric: 'tabular-nums'}}>{text}</span>
        <span style={{fontFamily: f.ui, fontWeight: 700, fontSize: sizes.unit, color: c.white, whiteSpace: 'nowrap'}}>{step.unit}</span>
      </div>
      <div dir="rtl" style={{position: 'absolute', left: 40, right: 40, top: 300, textAlign: 'center', fontFamily: f.ui, fontWeight: 700, fontSize: 52, color: c.white, opacity: label,
        transform: `translateY(${(1 - label) * 40}px)`}}>{step.label}</div>
    </div>
    <div style={{position: 'absolute', left: DOT.x - DOT.r, top: DOT.y - DOT.r, width: DOT.r * 2, height: DOT.r * 2, borderRadius: DOT.r, background: c.accent, transform: `scale(${dot})`}} />
  </div>;
};

// ---------------------------------------------------------------- the finished reel
export const ReelPreview: React.FC<{ctx: Ctx; words: readonly string[]; karaoke: number; probe?: string | null}> = ({ctx, words, karaoke, probe = null}) => {
  const {t, c, f} = ctx;
  const active = t >= karaoke ? Math.floor((t - karaoke) / karaokeStep) : -1;
  const lift = 6 * Math.sin(t * 2.2);
  const split = Math.ceil(words.length / 2);
  const word = (i: number) => <span key={i} style={{display: 'inline-block', padding: '6px 26px', borderRadius: 26, background: i === active ? c.accent : 'transparent',
    color: i === active ? c.ink : c.white, transform: `scale(${i === active ? 1.06 : 1})`}}>{words[i]}</span>;
  return <div style={worldBox(probe ?? '#0B0F17', probe ? {} : {background: 'linear-gradient(180deg, #1D2B4A 0%, #0B0F17 72%)'})}>
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
      <defs>
        <radialGradient id="reelGlow" cx="50%" cy="36%" r="55%"><stop offset="0" stopColor={c.accent} stopOpacity="0.28" /><stop offset="1" stopColor={c.accent} stopOpacity="0" /></radialGradient>
        <linearGradient id="reelSkin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3B4A68" /><stop offset="1" stopColor="#1A2336" /></linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#reelGlow)" />
      <g transform={`translate(0 ${lift})`}>
        <circle cx="540" cy="690" r="170" fill="url(#reelSkin)" />
        <path d="M 110 1330 C 130 1060 330 930 540 930 C 750 930 950 1060 970 1330 Z" fill="url(#reelSkin)" />
        <path d="M 110 1330 C 130 1060 330 930 540 930 C 750 930 950 1060 970 1330" fill="none" stroke={c.accent} strokeOpacity="0.55" strokeWidth="5" />
      </g>
    </svg>
    <div dir="rtl" style={{position: 'absolute', left: 50, right: 50, top: REEL.captionTop, textAlign: 'center', fontFamily: f.display, fontWeight: 900, fontSize: reelCaptionSize(words), lineHeight: 1.3}}>
      <div style={{display: 'flex', justifyContent: 'center', gap: 14}}>{Array.from({length: split}, (_, i) => word(i))}</div>
      <div style={{display: 'flex', justifyContent: 'center', gap: 14}}>{Array.from({length: words.length - split}, (_, i) => word(split + i))}</div>
    </div>
  </div>;
};

/** Claude's work as a card of jobs, then the card becomes the reel. Without a work step only the reel card arrives. */
export const FinaleWorld: React.FC<{ctx: Ctx; b: FinaleTimes; work?: Step<'work'>; file?: string; words: readonly string[]; hideTitles?: boolean; probe?: string | null}> = ({ctx, b, work, file, words, hideTitles = false, probe = null}) => {
  const {t, c, f} = ctx;
  const hasWork = b.hasWork && work !== undefined;
  const toReel = hasWork ? at(t, b.reel[0], b.reel[1], EASE.inOut) : 1;
  const reelK = hasWork ? EASE.inOut(prog(toReel, 0.25, 0.8)) : 1;
  const dive = prog(t, b.dive[0], b.dive[1]);
  const cardIn = at(t, b.cardIn[0], b.cardIn[1], EASE.pop);
  // The card first narrows to the width of the phone and only then grows tall, so it never reaches the action rail on its way.
  const kw = EASE.inOut(prog(toReel, 0, 0.5)), kh = EASE.inOut(prog(toReel, 0.5, 1)), restCy = WORK.cardTop + WORK.cardH / 2;
  const R = {cx: 540, cy: lerp(restCy, 960, kh), w: lerp(BAND.width, 540, kw), h: lerp(WORK.cardH, 960, kh), r: lerp(lerp(56, 70, toReel), 0, EASE.expoInOut(dive))};
  const jobs = work?.jobs ?? [];
  const pct = hasWork ? Math.round(100 * prog(t, b.spins[0], b.dones[b.dones.length - 1])) : 0;
  const rowsOn = hasWork ? (1 - at(t, b.reel[0], b.reel[0] + 0.35, EASE.inOut)) * cardIn : 0;
  const exit = at(t, b.reel[0], b.reel[0] + 0.35, EASE.expoIn);
  const badgeS = hideTitles || !hasWork ? 0 : at(t, b.badgeIn, b.badgeIn + 0.4, EASE.pop) * (1 - exit);
  const roll = at(t, b.roll[0], b.roll[1], EASE.inOut);
  return <div style={worldBox(probe ?? c.accent)}>
    {hasWork ? <Badge bg={c.ink} fg={c.accent} family={f.display} fromNum={b.num - 1} toNum={b.num} roll={roll} scale={badgeS} digits={ctx.digits} /> : null}
    {hasWork && work && !hideTitles ? <TitleBlock t={t} top={work.title.top} bottom={work.title.bottom} in1={b.title1In} in2={b.title2In} out1={b.title1Out} out2={b.title2Out}
      c1={c.ink} c2={c.ink} family={f.display} /> : null}
    <div style={{position: 'absolute', left: R.cx - R.w / 2, top: R.cy - R.h / 2, width: R.w, height: R.h, borderRadius: R.r, background: c.white,
      boxShadow: probe ? undefined : '0 40px 90px rgba(14,17,23,0.22)', overflow: 'hidden', transform: `scale(${lerp(0.9, 1, cardIn)})`, opacity: cardIn > 0 ? Math.min(1, cardIn * 3) : 0}}>
      {hasWork ? <div style={{position: 'absolute', left: (R.w - BAND.width) / 2, top: (R.h - WORK.cardH) / 2, width: BAND.width, height: WORK.cardH, opacity: rowsOn, direction: 'rtl'}}>
        {file ? <div style={{position: 'absolute', right: 44, top: 28, height: 72, padding: '0 28px', borderRadius: 36, background: c.ink, color: c.accent, display: 'flex', alignItems: 'center', gap: 12, direction: 'ltr'}}>
          <Film size={34} color={c.accent} strokeWidth={2.4} />
          <span style={{fontFamily: f.latin, fontWeight: 600, fontSize: 32}}>{file}</span>
        </div> : null}
        <div style={{position: 'absolute', left: 44, top: 28, height: 72, display: 'flex', alignItems: 'center', fontFamily: f.latin, fontWeight: 700, fontSize: 42, color: c.ink, fontVariantNumeric: 'tabular-nums'}}>
          {ctx.digits === 'latin' ? `${pct}%` : `${pct.toLocaleString('ar-EG')}٪`}
        </div>
        <div style={{position: 'absolute', left: 44, right: 44, top: 116, height: 10, borderRadius: 5, background: '#ECE7DC'}}>
          <div style={{position: 'absolute', right: 0, top: 0, height: 10, borderRadius: 5, background: c.ink, width: `${pct}%`}} />
        </div>
        {jobs.map((label, i) => {
          const pitch = jobs.length <= 3 ? 96 : 72, icon = jobs.length <= 3 ? 56 : 44;
          const spinning = t >= b.spins[i] && t < b.dones[i], finished = t >= b.dones[i];
          const chk = evolvePath(prog(t, b.dones[i], b.dones[i] + 0.3), 'M 17 33 L 28 44 L 48 21');
          return <div key={i} style={{position: 'absolute', left: 44, right: 44, top: 140 + i * pitch, height: pitch - 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <div style={{flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: f.ui, fontWeight: 700, fontSize: jobs.length <= 3 ? 42 : 38, color: finished || spinning ? c.ink : '#B6B1A6', whiteSpace: 'nowrap'}}>{label}</div>
            <svg width={icon} height={icon} viewBox="0 0 68 68" style={{flexShrink: 0}}>
              {finished ? <>
                <circle cx="34" cy="34" r="32" fill={c.ink} />
                <path d="M 17 33 L 28 44 L 48 21" fill="none" stroke={c.accent} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={chk.strokeDasharray} strokeDashoffset={chk.strokeDashoffset} />
              </> : spinning ? <circle cx="34" cy="34" r="27" fill="none" stroke={c.ink} strokeWidth="7" strokeLinecap="round" strokeDasharray="60 120" transform={`rotate(${t * 420} 34 34)`} />
                : <circle cx="34" cy="34" r="27" fill="none" stroke="#DAD5C9" strokeWidth="6" />}
            </svg>
          </div>;
        })}
      </div> : null}
      <div style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', background: '#0B0F17', clipPath: `circle(${reelK * 0.53 * Math.hypot(R.w, R.h)}px at 50% 50%)`}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0',
          transform: `translate(${R.w / 2}px, ${R.h / 2}px) scale(${Math.max(R.w / W, R.h / H)}) translate(${-W / 2}px, ${-H / 2}px)`}}>
          <ReelPreview ctx={ctx} words={words} karaoke={b.karaoke} probe={probe} />
        </div>
      </div>
    </div>
  </div>;
};

// ---------------------------------------------------------------- the desk: the work was a laptop, the reel is on the phone
const LAPTOP = DESK.laptop, PHONE = DESK.phone;
export const PH = {x: PHONE.x, y: PHONE.y, w: PHONE.w, h: PHONE.h};
export const PHC = {x: PH.x + PH.w / 2, y: PH.y + PH.h / 2};
export const SPH = W / PH.w;

export const ClosingWorld: React.FC<{ctx: Ctx; data: OneShotData; closing: ClosingTimes; laptop: React.ReactNode; reel: {words: readonly string[]; karaoke: number}; e: number; probe?: string | null}> =
  ({ctx, data, closing, laptop, reel, e, probe = null}) => {
    const {t, c, f} = ctx;
    const rr = 44 * e;
    const sw = EASE.expoInOut(prog(t, closing.swipe[0], closing.swipe[1]));
    const s = PH.w / W, ls = 0.74;
    return <div style={worldBox(probe ?? c.cream)}>
      <div style={{position: 'absolute', left: LAPTOP.x - LAPTOP.bezel, top: LAPTOP.y - LAPTOP.bezel, width: LAPTOP.w + 2 * LAPTOP.bezel, height: LAPTOP.h + 2 * LAPTOP.bezel, borderRadius: 30, background: c.ink,
        boxShadow: probe ? undefined : '0 40px 80px rgba(14,17,23,0.25)'}} />
      <div style={{position: 'absolute', left: LAPTOP.x, top: LAPTOP.y, width: LAPTOP.w, height: LAPTOP.h, borderRadius: 10, overflow: 'hidden', background: probe ?? c.accent}}>
        <div style={{position: 'absolute', left: (LAPTOP.w - W * ls) / 2, top: LAPTOP.h / 2 - 940 * ls, width: W, height: H, transformOrigin: '0 0', transform: `scale(${ls})`}}>{laptop}</div>
      </div>
      <div style={{position: 'absolute', left: LAPTOP.x - LAPTOP.baseOverhang, top: LAPTOP.y + LAPTOP.h + LAPTOP.bezel, width: LAPTOP.w + 2 * LAPTOP.baseOverhang, height: LAPTOP.baseH,
        background: 'linear-gradient(#3A4050, #232733)', clipPath: 'polygon(4% 0, 96% 0, 100% 100%, 0 100%)', borderRadius: '0 0 18px 18px'}} />
      <div style={{position: 'absolute', left: PH.x - PHONE.bezel, top: PH.y - PHONE.bezel, width: PH.w + 2 * PHONE.bezel, height: PH.h + 2 * PHONE.bezel, borderRadius: 50, background: c.ink,
        boxShadow: probe ? undefined : '0 50px 100px rgba(14,17,23,0.35)'}} />
      <div style={{position: 'absolute', left: PH.x, top: PH.y, width: PH.w, height: PH.h, borderRadius: rr, overflow: 'hidden', background: c.ink}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `scale(${s}) translateY(${-H * sw}px)`}}>
          <ReelPreview ctx={ctx} words={reel.words} karaoke={reel.karaoke} probe={probe} />
        </div>
        <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `scale(${s}) translateY(${H * (1 - sw)}px)`}}>
          <IntroWorld ctx={{...ctx, t: 0}} data={data} live={false} clickAt={1.5} probe={probe} />
        </div>
      </div>
      <div style={{position: 'absolute', left: DESK.textLeft, width: DESK.textWidth, top: DESK.textTop}}>
        <Words text={data.closing.top} t={t} inAt={closing.textIn} size={fitLine(data.closing.top.split(/\s+/).reduce((a, w) => (w.length > a.length ? w : a), ''), DESK.textWidth - 30, 80, 0.62)} color={c.ink} family={f.display} />
        <div dir="rtl" style={{marginTop: 20, textAlign: 'center', fontFamily: f.ui, fontWeight: 600, fontSize: 32, color: c.muted, opacity: at(t, closing.subIn[0], closing.subIn[1])}}>{data.closing.sub}</div>
        <div style={{marginTop: 30, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12}}>
          {data.closing.platforms.map((p, i) => {
            const k = at(t, closing.chipsIn + i * 0.12, closing.chipsIn + 0.4 + i * 0.12, EASE.pop);
            return <div key={i} style={{padding: '8px 22px', borderRadius: 999, border: `2px solid ${c.ink}`, fontFamily: f.latin, fontWeight: 600, fontSize: 28, color: c.ink,
              background: i === 0 ? c.accent : 'transparent', transform: `scale(${k})`, opacity: Math.min(1, k * 2)}}>{p}</div>;
          })}
        </div>
      </div>
    </div>;
  };
