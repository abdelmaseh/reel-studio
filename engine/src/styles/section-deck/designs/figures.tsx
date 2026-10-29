// section-deck figures: one number becomes a giant keynote object. A counter fills an outlined numeral from the bottom up, a slot rolls digit tiles,
// bars grow from the start edge as track rows and a ring sweeps its arc around the number.
import React from 'react';
import {AbsoluteFill, Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import {measure} from '../../../core/type';
import type {FamilyDesignProps} from '../../family-designs';
import type {FiguresData} from '../../../creative-kit/figures/schema';
import {slotDigitStrings, slotPosition} from '../../../creative-kit/figures/timing';
import {SceneStickerSlot} from '../../../creative-kit/sticker-view';
import {useDesignData} from '../../../style-kit/digits';
import {CW, W, X0, X1, Ground, MaskLines, clamp01, fit, mix, ramp, sectionNumeral} from './kit';
import {Chip, GLYPH, GLYPH_DROP, HeroNumber, STICKER_FLOOR, ZONE_BOTTOM, ZONE_TOP, Settled, chipSpec, decimalsOf, fixed, headWidth, numberPlan, startEdge, useDeck, type Deck} from './family-parts';

type Variant<K extends FiguresData['variant']> = Extract<FiguresData, {variant: K}>;
type Props<K extends FiguresData['variant']> = {d: Variant<K>; deck: Deck; numeral?: string};
const count = Easing.bezier(0.4, 0, 0.2, 1);
/** A centred circle stays left of x 853 even where it dips below the platform rail line, so it may use the room down to the caption margin. */
const CIRCLE_BOTTOM = 1236;
const HEAD_GAP = 46, FOOT_GAP = 40, HEAD_LH = 1.3;

/** The label as the Cairo 900 headline; it steps left of the sticker slot when the scene has a sticker. */
const headOf = (d: FiguresData, deck: Deck, size: number, lines: number, min: number) => {
  if (!d.label) return null;
  const width = headWidth(!!d.sticker);
  const t = fit(d.label, {width, size, min, lines, weight: 900, lh: HEAD_LH}, deck.P.font);
  return {text: d.label, width, right: startEdge(!!d.sticker, deck.copy.ar), size, min, lines, height: t.lines.length * t.box};
};
type Head = ReturnType<typeof headOf>;
const HeadLines: React.FC<{head: Head; top: number; copy: Deck['copy']}> = ({head, top, copy}) =>
  head ? <MaskLines copy={copy} text={head.text} top={top} width={head.width} right={head.right} size={head.size} min={head.min} lines={head.lines} lh={HEAD_LH} at={2}/> : null;

/** Head, hero and footer are centred in the zone; the hero starts below the sticker slot when there is a sticker. */
const stackTops = (headBlock: number, heroH: number, footer: number, floor: number, bottom = ZONE_BOTTOM) => {
  const top = ZONE_TOP + Math.max(0, (bottom - ZONE_TOP - (headBlock + heroH + footer)) / 2);
  const heroTop = Math.max(floor, top + headBlock);
  return {headTop: heroTop - headBlock, heroTop};
};
const heroRoom = (headBlock: number, footer: number, floor: number, bottom = ZONE_BOTTOM) => bottom - Math.max(floor, ZONE_TOP + headBlock) - footer;

const Counter: React.FC<Props<'counter'>> = ({d, deck}) => {
  const {copy, P, shown} = deck;
  const f = useCurrentFrame();
  const head = headOf(d, deck, 108, 3, 64);
  const plan = numberPlan(d.value, d.from ?? 0, shown, P.font);
  const chip = d.unit ? chipSpec(d.unit, P.font, CW, 80) : null;
  const UNDER_GAP = FOOT_GAP + 12, perPx = plan.total / 100, floor = d.sticker ? STICKER_FLOOR : 0;
  const headBlock = head ? head.height + HEAD_GAP : 0;
  const sizeFor = (below: boolean) => Math.min(CW / perPx, 560, heroRoom(headBlock, below && chip ? UNDER_GAP + chip.h : 0, floor) / GLYPH);
  let size = sizeFor(false);
  const beside = !!chip && CW - perPx * size >= chip.w + 44;
  if (chip && !beside) size = sizeFor(true);
  const below = !!chip && !beside, glyphH = GLYPH * size, numW = perPx * size;
  const {headTop, heroTop} = stackTops(headBlock, glyphH, below && chip ? UNDER_GAP + chip.h : 0, floor);
  const roll = ramp(f, 14, 52, count), enter = ramp(f, 4, 14);
  const punch = 1 + 0.035 * (f >= 58 ? Math.max(0, 1 - Math.abs(f - 58) / 8) : 0);
  const chars = plan.at(roll);
  const chipTop = beside ? heroTop + glyphH - chip!.h : heroTop + glyphH + UNDER_GAP;
  const chipSide = beside ? W - X1 + numW + 40 : W - X1;
  return <>
    <Ground copy={copy} tone={1}/>
    <HeadLines head={head} top={headTop} copy={copy}/>
    <div aria-label={shown(String(d.value))} style={{position: 'absolute', top: heroTop, [copy.side]: W - X1, opacity: enter, transform: `scale(${mix(1.07, 1, enter) * punch})`, transformOrigin: copy.ar ? '100% 100%' : '0% 100%'}}>
      <HeroNumber plan={plan} chars={chars} size={size} fill={roll} font={P.font} ink={P.ink} accent={P.accent} stroke={`rgba(255,255,255,${mix(0.62, 1, roll)})`}/>
    </div>
    {chip ? <Chip spec={chip} at={beside ? 52 : 56} frame={f} font={P.font} fill={P.accent} ink={P.accentInk} dir={copy.dir} style={{top: chipTop, [copy.side]: chipSide}}/> : null}
    {below && chip ? <div style={{position: 'absolute', top: chipTop + chip.h / 2 - 2, [copy.side]: W - X1 + chip.w + 24, width: (CW - chip.w - 24) * ramp(f, 58, 26), height: 4, background: P.accent, opacity: 0.5}}/> : null}
  </>;
};

const Slot: React.FC<Props<'slot'>> = ({d, deck, numeral}) => {
  const {copy, P, shown} = deck;
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const {to, from} = slotDigitStrings(d.value, d.from);
  const n = to.length, perRow = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / perRow), GAP = 16;
  const head = headOf(d, deck, 108, 3, 64);
  const chip = d.unit ? chipSpec(d.unit, P.font, CW, 72) : null;
  const headBlock = head ? head.height + HEAD_GAP : 0, footer = chip ? FOOT_GAP + chip.h : 0, floor = d.sticker ? STICKER_FLOOR : 0;
  const tileW = Math.min(Math.floor((CW - (perRow - 1) * GAP) / perRow), n <= 2 ? 440 : 330);
  const digitPx = numberPlan(d.value, 0, shown, P.font).digit / 100;
  const rowRoom = (heroRoom(headBlock, footer, floor) - (rows - 1) * GAP) / rows;
  const size = Math.round(Math.min((tileW - 34) / digitPx, tileW * 1.4, rowRoom / 1.15));
  const cell = Math.round(size * 0.94), tileH = Math.round(Math.min(rowRoom, cell * 1.9));
  const heroH = rows * tileH + (rows - 1) * GAP;
  const {headTop, heroTop} = stackTops(headBlock, heroH, footer, floor);
  const radius = 26, shift = -GLYPH_DROP * size;
  return <>
    <Ground copy={copy} tone={0} numeral={numeral}/>
    <HeadLines head={head} top={headTop} copy={copy}/>
    <div aria-label={shown(String(d.value))} style={{display: 'contents'}}>
    {Array.from(to).map((digit, i) => {
      const row = Math.floor(i / perRow), inRow = row < rows - 1 ? perRow : n - perRow * (rows - 1), col = i - row * perRow;
      const rowW = inRow * tileW + (inRow - 1) * GAP, x = (copy.ar ? X1 - rowW : X0) + col * (tileW + GAP), y = heroTop + row * (tileH + GAP);
      const stop = Math.round((1.05 + (n - 1 - i) * 0.07) * fps), enter = ramp(f, 2 + i * 2, 14);
      const pos = slotPosition(f, i, n, Number(digit), Number(from[i]), fps);
      const settle = clamp01((f - (stop - 3)) / 7), thump = f >= stop ? Math.max(0, 1 - (f - stop) / 7) : 0;
      const top0 = (tileH - cell) / 2, feather = 1 - settle;
      const mask = `linear-gradient(180deg, transparent ${top0 * (1 - 0.7 * feather)}px, #000 ${top0 + cell * 0.2 * feather}px, #000 ${top0 + cell - cell * 0.2 * feather}px, transparent ${top0 + cell + top0 * 0.7 * feather}px)`;
      return <div key={i} style={{position: 'absolute', left: x, top: y + (1 - enter) * 70, width: tileW, height: tileH, opacity: enter, transform: `scale(${1 + 0.05 * thump})`}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: radius, overflow: 'hidden', background: 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05))', boxShadow: `inset 0 0 0 2px ${P.faint}, 0 30px 60px rgba(0,0,0,0.35)`}}>
          <div style={{position: 'absolute', inset: 0, WebkitMaskImage: mask, maskImage: mask}}>
            <div style={{position: 'absolute', left: 0, right: 0, top: 0, transform: `translateY(${-pos * cell + top0 + shift}px)`, fontFamily: P.font, fontWeight: 900, fontSize: size, color: P.ink, direction: 'ltr'}}>
              {Array.from({length: 41}, (_, k) => <div key={k} style={{height: cell, lineHeight: `${cell}px`, textAlign: 'center'}}>{shown(String(k % 10))}</div>)}
            </div>
          </div>
          <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 10 + 8 * thump, background: P.accent}}/>
        </div>
      </div>;
    })}
    </div>
    {chip ? <Chip spec={chip} at={44} frame={f} font={P.font} fill={P.accent} ink={P.accentInk} dir={copy.dir} style={{top: heroTop + heroH + FOOT_GAP, [copy.side]: W - X1}}/> : null}
  </>;
};

const Bars: React.FC<Props<'bars'>> = ({d, deck, numeral}) => {
  const {copy, P, shown} = deck;
  const f = useCurrentFrame();
  const n = d.bars.length, values = d.bars.map(b => b.value), lead = Math.max(...values), max = d.max ?? Math.max(lead, 1e-9);
  const stacked = n <= 3, gap = n <= 2 ? 44 : n <= 3 ? 34 : n <= 5 ? 26 : 20;
  const head = headOf(d, deck, stacked ? 96 : 84, 2, 60);
  const headBlock = head ? head.height + HEAD_GAP : 0, floor = d.sticker ? STICKER_FLOOR : 0;
  const labelSize = Math.round(stacked ? 66 - (n - 1) * 6 : 54 - (n - 4) * 4);
  const labelBox = Math.round(labelSize * 1.3);
  // A short unit rides next to each value; a long one becomes a chip under the rows.
  const probeUnit = (size: number) => (d.unit ? Math.ceil(measure(d.unit, {fontFamily: P.font, fontSize: size, fontWeight: 700}).width) : 0);
  const inline = !!d.unit && probeUnit(44) <= 300;
  const chip = d.unit && !inline ? chipSpec(d.unit, P.font, CW, 64) : null;
  const footer = chip ? FOOT_GAP + chip.h : 0, room = heroRoom(headBlock, footer, floor);
  const rowH = Math.min(stacked ? 360 : 190, (room - (n - 1) * gap) / n);
  const thick = Math.round(Math.min(stacked ? 250 : 120, stacked ? rowH - labelBox - 8 : rowH - 8));
  const valueSize = Math.round(Math.min(Math.max(thick * 0.84, 54), 140));
  const unitSize = Math.round(Math.min(52, Math.max(30, valueSize * 0.38))), unitW = inline ? probeUnit(unitSize) + 16 : 0;
  const valueOf = (v: number, to = v) => shown(fixed(v, decimalsOf(to)));
  const numW = Math.ceil(Math.max(...values.map(v => measure(valueOf(v), {fontFamily: P.font, fontSize: valueSize, fontWeight: 900}).width)));
  const valueW = numW + unitW + 34;
  const labelW = stacked ? CW : Math.min(380, Math.ceil(Math.max(...d.bars.map(b => measure(b.label, {fontFamily: P.font, fontSize: labelSize, fontWeight: 800}).width))) + 12);
  const trackO = stacked ? 0 : labelW + 28, trackLen = CW - trackO - valueW;
  const heroH = n * rowH + (n - 1) * gap;
  const {headTop, heroTop} = stackTops(headBlock, heroH, footer, floor);
  const radius = Math.round(Math.min(22, thick / 2.4));
  return <>
    <Ground copy={copy} tone={0} numeral={numeral}/>
    <HeadLines head={head} top={headTop} copy={copy}/>
    {d.bars.map((b, i) => {
      const at = 8 + i * 5, p = ramp(f, at, 34), isLead = b.value === lead;
      const top = heroTop + i * (rowH + gap), barTop = stacked ? top + labelBox + 8 : top + (rowH - thick) / 2;
      const len = Math.max(b.value > 0 ? 10 : 0, trackLen * b.value / max * p), tip = W - X1 + trackO + len + 22;
      const lab = fit(b.label, {width: labelW, size: labelSize, min: 30, lines: stacked ? 1 : 2, weight: 800}, P.font);
      const labTop = stacked ? top : barTop + (thick - lab.lines.length * lab.box) / 2;
      return <React.Fragment key={i}>
        <MaskLines copy={copy} text={b.label} top={labTop} width={labelW} size={labelSize} min={30} lines={stacked ? 1 : 2} weight={800} at={at - 4}/>
        <div style={{position: 'absolute', top: barTop, [copy.side]: W - X1 + trackO, width: trackLen, height: thick, borderRadius: radius, background: 'rgba(255,255,255,0.07)', opacity: ramp(f, at - 4, 12)}}/>
        <div style={{position: 'absolute', top: barTop, [copy.side]: W - X1 + trackO, width: len, height: thick, borderRadius: radius, background: isLead ? P.accent : 'rgba(255,255,255,0.25)'}}/>
        <div style={{position: 'absolute', top: barTop, [copy.side]: tip, width: valueW, height: thick, display: 'flex', alignItems: 'baseline', justifyContent: 'flex-start', gap: 14, direction: copy.dir, fontFamily: P.font,
          opacity: ramp(f, at, 8), transform: `translateY(${-GLYPH_DROP * valueSize}px)`, whiteSpace: 'nowrap'}}>
          <span style={{direction: 'ltr', fontWeight: 900, fontSize: valueSize, lineHeight: `${thick}px`, color: isLead ? P.accent : P.ink}}>{valueOf(p >= 1 ? b.value : b.value * p, b.value)}</span>
          {inline ? <span style={{fontWeight: 700, fontSize: unitSize, lineHeight: `${thick}px`, color: P.dim}}>{d.unit}</span> : null}
        </div>
      </React.Fragment>;
    })}
    {chip ? <Chip spec={chip} at={46} frame={f} font={P.font} fill={P.accent} ink={P.accentInk} dir={copy.dir} style={{top: heroTop + heroH + FOOT_GAP, [copy.side]: W - X1}}/> : null}
  </>;
};

const Ring: React.FC<Props<'ring'>> = ({d, deck, numeral}) => {
  const {copy, P, shown} = deck;
  const f = useCurrentFrame();
  const head = headOf(d, deck, 96, 2, 70);
  const headBlock = head ? head.height + HEAD_GAP : 0, floor = d.sticker ? STICKER_FLOOR : 0;
  const D = Math.round(Math.min(720, CW - 40, heroRoom(headBlock, 36, floor, CIRCLE_BOTTOM))), stroke = Math.round(D * 0.095), r = (D - stroke) / 2;
  const {headTop, heroTop} = stackTops(headBlock, D, 36, floor, CIRCLE_BOTTOM);
  const roll = ramp(f, 12, 50, count), decimals = decimalsOf(d.value);
  const inner = D - 2 * stroke - 56;
  const numText = shown(fixed(roll >= 1 ? d.value : d.value * roll, decimals)), numFinal = shown(fixed(d.value, decimals));
  const numSize = Math.round(Math.min(D * 0.34, inner * 100 / (measure(numFinal, {fontFamily: P.font, fontSize: 100, fontWeight: 900}).width)));
  const chip = d.unit ? chipSpec(d.unit, P.font, inner, Math.round(D * 0.07)) : null;
  const maxText = d.max !== 100 ? shown('/' + fixed(d.max, decimalsOf(d.max))) : null;
  const frac = d.value / d.max, angle = frac * roll * 360;
  const tipA = (angle - 90) * Math.PI / 180;
  const left = (W - D) / 2;
  return <>
    <Ground copy={copy} tone={1} numeral={numeral}/>
    <HeadLines head={head} top={headTop} copy={copy}/>
    <div style={{position: 'absolute', left, top: heroTop, width: D, height: D, opacity: ramp(f, 4, 12), transform: `scale(${mix(0.92, 1, ramp(f, 4, 16))})`}}>
      <svg width={D} height={D} viewBox={`0 0 ${D} ${D}`} style={{position: 'absolute', inset: 0, overflow: 'visible', transform: copy.ar ? 'scaleX(-1)' : undefined}}>
        <circle cx={D / 2} cy={D / 2} r={r + stroke / 2 + 18} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={2}/>
        <circle cx={D / 2} cy={D / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke}/>
        <circle cx={D / 2} cy={D / 2} r={r} fill="none" stroke={P.accent} strokeWidth={stroke} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.min(1, frac) * roll}
          transform={`rotate(-90 ${D / 2} ${D / 2})`}/>
        {roll > 0.02 ? <circle cx={D / 2 + r * Math.cos(tipA)} cy={D / 2 + r * Math.sin(tipA)} r={stroke * 0.3} fill={P.ink}/> : null}
      </svg>
      <div style={{position: 'absolute', left: 0, top: 0, width: D, height: D, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'ltr'}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 10, fontFamily: P.font, fontWeight: 900, color: P.ink, lineHeight: 1}}>
          <span style={{fontSize: numSize, lineHeight: `${numSize * 0.9}px`}}>{numText}</span>
          {maxText ? <span style={{fontSize: Math.round(numSize * 0.3), color: P.dim, fontWeight: 800}}>{maxText}</span> : null}
        </div>
        {chip ? <div style={{position: 'relative', width: chip.w, height: chip.h, marginTop: 22}}>
          <Chip spec={chip} at={46} frame={f} font={P.font} fill={P.accent} ink={P.accentInk} dir={copy.dir} style={{left: 0, top: 0}}/></div> : null}
      </div>
    </div>
  </>;
};

export const Figures: React.FC<FamilyDesignProps> = ({scene, sectionIndex}) => {
  if (scene.family !== 'figures') return null;
  const d = useDesignData(scene.data), deck = useDeck(d), numeral = sectionNumeral(sectionIndex);
  return <Settled><AbsoluteFill style={deck.copy.ar ? undefined : {direction: deck.copy.dir}}>
    {d.variant === 'counter' ? <Counter d={d} deck={deck}/> : d.variant === 'slot' ? <Slot d={d} deck={deck} numeral={numeral}/>
      : d.variant === 'bars' ? <Bars d={d} deck={deck} numeral={numeral}/> : <Ring d={d} deck={deck} numeral={numeral}/>}
    <SceneStickerSlot host="figures" sticker={d.sticker} ink={deck.P.ink}/>
  </AbsoluteFill></Settled>;
};
