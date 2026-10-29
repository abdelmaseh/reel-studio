// kinetic-paper figures: a number, digits, bars or a ring printed as a riso poster. Hero objects are slammed onto the paper and hold still.
import React from 'react';
import {AbsoluteFill, Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import type {FiguresData} from '../../../creative-kit/figures/schema';
import {slotDigitStrings, slotPosition} from '../../../creative-kit/figures/timing';
import {SceneStickerSlot} from '../../../creative-kit/sticker-view';
import {useDesignText} from '../../../style-kit/digits';
import {CARD, CW, HtPattern, INK, LIME, MIS, PAPER, RED, SANS, W, X0, X1, Ground, Headline, Slam, dotTile, ramp, slam, widthOf, useDesign} from './kit';
import {STRIP_H, Settled, UnitStrip, ZONE_BOTTOM, ZONE_TOP, decimalsOf, fixed, numberPlan, PrintedNumber} from './family-parts';

type Variant<K extends FiguresData['variant']> = Extract<FiguresData, {variant: K}>;
const HEAD_GAP = 34, UNIT_GAP = 24, DIGIT_BAND = 0.57, STICKER_EDGE = 828;
const count = Easing.bezier(0.2, 0.8, 0.2, 1);
const between = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The label as the ink headline. It steps around the sticker slot when the scene has a sticker. */
const useHead = (d: FiguresData, size: number, lines: number) => {
  const {fit} = useDesign();
  if (!d.label) return null;
  const width = d.sticker ? STICKER_EDGE - X0 : CW - 20;
  const t = fit(d.label, {width, size, min: 70, lines});
  return {width, size, lines, right: d.sticker ? W - STICKER_EDGE : undefined, height: t.lines.length * t.box};
};
type Head = ReturnType<typeof useHead>;
const HeadLine: React.FC<{head: Head; text?: string; top: number}> = ({head, text, top}) =>
  head && text ? <Headline text={text} top={top} width={head.width} right={head.right} size={head.size} min={70} lines={head.lines} at={0} stagger={5}/> : null;

const Counter: React.FC<{d: Variant<'counter'>}> = ({d}) => {
  const {copy, HEAD, weight} = useDesign();
  const shown = useDesignText();
  const f = useCurrentFrame();
  const head = useHead(d, 124, 3);
  const plan = numberPlan(d.value, d.from ?? 0, shown, c => widthOf(c, 100, HEAD, weight));
  const headH = head ? head.height + HEAD_GAP : 0, unitH = d.unit ? UNIT_GAP + STRIP_H : 0, padY = 52, slabW = CW - MIS;
  const avail = ZONE_BOTTOM - ZONE_TOP - headH - unitH;
  const size = between(Math.min((slabW - 2 * 44 - 30) * 100 / plan.total, (avail - 2 * padY) / DIGIT_BAND, 600), 100, 600);
  const slabH = Math.round(DIGIT_BAND * size + 2 * padY);
  const top = ZONE_TOP + (ZONE_BOTTOM - ZONE_TOP - (headH + slabH + unitH)) / 2;
  const slabTop = top + headH, land = 36;
  const roll = ramp(f, 4, 32, count), punch = slam(f, land, 1.06);
  return <>
    <HeadLine head={head} text={d.label} top={top}/>
    <Slam at={2} from={1.12} origin="50% 50%" style={{position: 'absolute', top: slabTop, [copy.side]: W - X1, width: slabW, height: slabH}}>
      <div style={{position: 'relative', width: slabW, height: slabH, transform: punch.on ? `translate(${punch.dx}px, ${punch.dy}px) scale(${punch.scale})` : undefined}}>
        <div style={{position: 'absolute', inset: 0, background: LIME, transform: `translate(${-MIS}px, ${MIS}px)`}}/>
        <PrintedNumber id="kp-count" chars={plan.at(roll)} widths={plan.widths} size={size} width={slabW} height={slabH} ht={ramp(f, 6, 18, Easing.out(Easing.quad))} progress={roll}/>
      </div>
    </Slam>
    {d.unit ? <UnitStrip text={d.unit} top={slabTop + slabH + UNIT_GAP} at={30}/> : null}
  </>;
};

/** A portrait ticket: card with notches on the perforation, an ink stub with punched holes below it. The path is inset by half the border so the stroke stays inside the box. */
const TicketFace: React.FC<{w: number; h: number; stub: number; border: number; notch: number}> = ({w, h, stub, border, notch}) => {
  const b = border / 2, ny = h - stub, r = notch;
  const d = `M ${b} ${b} H ${w - b} V ${ny - r} A ${r} ${r} 0 0 0 ${w - b} ${ny + r} V ${h - b} H ${b} V ${ny + r} A ${r} ${r} 0 0 0 ${b} ${ny - r} Z`;
  return <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
    <defs><clipPath id={`kp-tk-${w}-${h}`}><path d={d}/></clipPath></defs>
    <path d={d} fill={CARD}/>
    <g clipPath={`url(#kp-tk-${w}-${h})`}>
      <rect x={0} y={ny + 10} width={w} height={stub} fill={INK}/>
      {[0.25, 0.5, 0.75].map(k => <circle key={k} cx={w * k} cy={ny + 10 + (stub - 10) / 2} r={Math.min(10, w * 0.06)} fill={CARD}/>)}
    </g>
    <path d={`M ${b + r + 6} ${ny} H ${w - b - r - 6}`} stroke={INK} strokeWidth={5} strokeDasharray="11 9" fill="none"/>
    <path d={d} fill="none" stroke={INK} strokeWidth={border} strokeLinejoin="miter"/>
  </svg>;
};

const Slot: React.FC<{d: Variant<'slot'>}> = ({d}) => {
  const {HEAD, weight} = useDesign();
  const shown = useDesignText();
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const head = useHead(d, 124, 3);
  const {to, from} = slotDigitStrings(d.value, d.from);
  const n = to.length, perRow = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / perRow);
  const GAP = 6, SHADOW = 12, BORDER = 7, PLATE = 14, STUB = 64, NOTCH = 15;
  const cell = Math.max(...Array.from(new Set(to + from), digit => widthOf(shown(digit), 100, HEAD, weight)));
  const headH = head ? head.height + HEAD_GAP : 0, unitH = d.unit ? UNIT_GAP + STRIP_H : 0;
  const rowLeft = X0 + MIS + PLATE, rowMax = X1 - PLATE - rowLeft;
  const tw = Math.min(Math.floor((rowMax - (perRow - 1) * GAP) / perRow), 340);
  const chrome = 2 * PLATE + MIS + (rows - 1) * GAP;
  const thMax = Math.floor((ZONE_BOTTOM - ZONE_TOP - headH - unitH - chrome) / rows);
  const size = between(Math.min((tw - 2 * BORDER - 2) * 100 / cell, (thMax - STUB - 90) / DIGIT_BAND, 420), 80, 420);
  const th = Math.round(rows === 1 ? between(DIGIT_BAND * size + 120 + STUB, 300, Math.min(340, thMax)) : thMax);
  const body = th - STUB - BORDER - 6;
  const plateH = rows * th + (rows - 1) * GAP + 2 * PLATE;
  const total = headH + plateH + MIS + unitH;
  const top = ZONE_TOP + (ZONE_BOTTOM - ZONE_TOP - total) / 2, plateTop = top + headH;
  const rowW = perRow * tw + (perRow - 1) * GAP;
  return <>
    <HeadLine head={head} text={d.label} top={top}/>
    <Slam at={1} from={1.12} style={{position: 'absolute', left: rowLeft - PLATE, top: plateTop, width: rowMax + 2 * PLATE, height: plateH}}>
      <div style={{position: 'absolute', left: -MIS, top: MIS, width: rowMax + 2 * PLATE, height: plateH, background: LIME}}/>
    </Slam>
    <div aria-label={shown(String(d.value))} style={{display: 'contents'}}>
    {Array.from(to).map((digit, i) => {
      const row = Math.floor(i / perRow), inRow = row < rows - 1 ? perRow : n - perRow * (rows - 1), col = i - row * perRow;
      const x = rowLeft + (rowW - (inRow * tw + (inRow - 1) * GAP)) / 2 + col * (tw + GAP), y = plateTop + PLATE + row * (th + GAP);
      const enter = 2 + i * 2, thump = slam(f, Math.round((1.05 + (n - 1 - i) * 0.07) * fps), 1.07);
      const pos = slotPosition(f, i, n, Number(digit), Number(from[i]), fps);
      return <div key={i} style={{position: 'absolute', left: x, top: y, width: tw, height: th, transform: thump.on ? `translate(${thump.dx}px, ${thump.dy}px) scale(${thump.scale})` : undefined}}>
        <Slam at={enter} from={1.35} style={{width: tw, height: th}}>
          <div style={{position: 'absolute', left: SHADOW, top: SHADOW, width: tw, height: th, backgroundImage: dotTile(4.4 * ramp(f, enter + 2, 12, Easing.out(Easing.quad))), backgroundSize: '20px 20px'}}/>
          <TicketFace w={tw} h={th} stub={STUB} border={BORDER} notch={NOTCH}/>
          <div aria-label={digit} style={{position: 'absolute', left: BORDER, top: BORDER, width: tw - 2 * BORDER, height: body, overflow: 'hidden', direction: 'ltr'}}>
            <div style={{transform: `translateY(${-pos * body}px)`}}>
              {Array.from({length: 41}, (_, k) => <div key={k} style={{position: 'relative', height: body}}>
                <div style={{position: 'absolute', left: 0, right: 0, top: body / 2 - 0.405 * size, textAlign: 'center', fontFamily: HEAD, fontWeight: weight, fontSize: size, lineHeight: 1, color: INK}}>{shown(k % 10)}</div>
              </div>)}
            </div>
          </div>
        </Slam>
      </div>;
    })}
    </div>
    {d.unit ? <UnitStrip text={d.unit} top={plateTop + plateH + MIS + UNIT_GAP} at={22}/> : null}
  </>;
};

const Bars: React.FC<{d: Variant<'bars'>}> = ({d}) => {
  const {copy, HEAD, weight, fit} = useDesign();
  const shown = useDesignText();
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const n = d.bars.length;
  const head = useHead(d, n > 3 ? 100 : 118, n > 3 ? 2 : 3);
  const max = d.max ?? Math.max(1, ...d.bars.map(b => b.value));
  const hi = d.bars.reduce((best, b, i) => b.value > d.bars[best].value ? i : best, 0);
  const lo = n === 2 && d.bars[0].value !== d.bars[1].value ? (d.bars[0].value < d.bars[1].value ? 0 : 1) : -1;
  const strip = n > 3 ? 76 : STRIP_H;
  const headH = head ? head.height + HEAD_GAP : 0, unitH = d.unit ? UNIT_GAP + strip : 0;
  const chartTop = ZONE_TOP + headH, chartH = ZONE_BOTTOM - chartTop - unitH;
  const rowH = chartH / n, barH = Math.round(Math.min(rowH * 0.84, 210));
  const labelSize = between(barH * 0.62, 44, 96);
  const labW = between(Math.max(...d.bars.map(b => widthOf(b.label, labelSize, HEAD, weight))) + 8, 130, 330);
  const xb = X1 - labW - 26;
  const texts = d.bars.map(b => shown(fixed(b.value, decimalsOf(b.value))));
  const wide = Math.max(...texts.map(t => widthOf(t, 100, HEAD, weight)));
  const stampSize = Math.min(barH * 0.82, 132, (xb - X0 - MIS - 300) * 100 / wide);
  const stampW = Math.ceil(wide * stampSize / 100) + 8, maxLen = xb - X0 - MIS - stampW - 22;
  const mx = (x: number, w: number) => copy.ar ? x : W - x - w;
  const grow = Math.round(0.7 * fps), stagger = Math.round(0.12 * fps);
  return <>
    <HeadLine head={head} text={d.label} top={ZONE_TOP}/>
    <div style={{position: 'absolute', left: mx(xb + 7, 12), top: chartTop - 6, width: 12, height: (chartH + 12) * ramp(f, 0, 10, Easing.out(Easing.quad)), background: INK}}/>
    {d.bars.map((bar, i) => {
      const len = Math.max(0, maxLen * bar.value / max), start = i * stagger + 2, p = ramp(f, start, grow, count), land = start + grow;
      const y = chartTop + i * rowH + (rowH - barH) / 2, w = len * p;
      const tone = i === hi ? {fill: LIME, band: INK, outlined: true} : i === lo ? {fill: RED, band: INK, outlined: true} : {fill: INK, band: PAPER, outlined: false};
      const label = fit(bar.label, {width: labW, size: labelSize, min: 34, lines: 2});
      return <React.Fragment key={i}>
        {d.max !== undefined ? <div style={{position: 'absolute', left: mx(xb - maxLen, maxLen), top: y, width: maxLen, height: barH, border: `4px dashed ${INK}`, opacity: 0.45, boxSizing: 'border-box'}}/> : null}
        <Slam at={start} from={1.18} origin="100% 50%" style={{position: 'absolute', left: mx(X1 - labW, labW), top: y, width: labW, height: barH, display: 'flex', alignItems: 'center', justifyContent: 'flex-end'}}>
          <div style={{width: labW, textAlign: copy.align, direction: copy.dir, fontFamily: label.family, fontWeight: label.weight, fontSize: label.size, lineHeight: `${label.box}px`, color: INK}}>
            {label.lines.map((line, k) => <div key={k} style={{whiteSpace: 'nowrap'}}>{line}</div>)}</div>
        </Slam>
        <div style={{position: 'absolute', left: mx(xb - w, w), top: y, width: w, height: barH, opacity: p > 0.01 ? 1 : 0, background: tone.fill, border: `${tone.outlined ? 10 : 0}px solid ${INK}`, boxSizing: 'border-box', overflow: 'hidden',
          boxShadow: tone.outlined ? `${copy.ar ? -MIS : MIS}px ${MIS}px 0 ${INK}` : undefined}}>
          <div style={{position: 'absolute', [copy.side]: 0, bottom: 0, width: len, height: barH * 0.36, backgroundImage: dotTile(3.3, tone.band), backgroundSize: '20px 20px'}}/>
        </div>
        <Slam at={land} from={1.6} origin="50% 50%" style={{position: 'absolute', left: mx(xb - len - 22 - stampW, stampW), top: y, width: stampW, height: barH}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: barH / 2 - 0.405 * stampSize, textAlign: 'right', direction: 'ltr', fontFamily: HEAD, fontWeight: weight, fontSize: stampSize, lineHeight: 1, whiteSpace: 'nowrap', color: INK}}>{texts[i]}</div>
        </Slam>
      </React.Fragment>;
    })}
    {d.unit ? <UnitStrip text={d.unit} top={chartTop + chartH + UNIT_GAP} at={26} height={strip} size={n > 3 ? 46 : 54}/> : null}
  </>;
};

/** The annular sector from the top, clockwise; a full turn is a plain annulus. */
const sector = (cx: number, cy: number, r0: number, r1: number, turn: number) => {
  const pt = (a: number, r: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  if (turn >= 0.9995) return `M ${cx + r1} ${cy} A ${r1} ${r1} 0 1 1 ${cx - r1} ${cy} A ${r1} ${r1} 0 1 1 ${cx + r1} ${cy} Z M ${cx + r0} ${cy} A ${r0} ${r0} 0 1 0 ${cx - r0} ${cy} A ${r0} ${r0} 0 1 0 ${cx + r0} ${cy} Z`;
  const a0 = -Math.PI / 2, a1 = a0 + 2 * Math.PI * turn, large = turn > 0.5 ? 1 : 0;
  return `M ${pt(a0, r1)} A ${r1} ${r1} 0 ${large} 1 ${pt(a1, r1)} L ${pt(a1, r0)} A ${r0} ${r0} 0 ${large} 0 ${pt(a0, r0)} Z`;
};

const Ring: React.FC<{d: Variant<'ring'>}> = ({d}) => {
  const {copy, HEAD, weight, fit} = useDesign();
  const shown = useDesignText();
  const f = useCurrentFrame();
  const head = useHead(d, 118, 3);
  const headH = head ? head.height + 26 : 0, ringTop0 = ZONE_TOP + headH;
  const D = between(Math.min(700, 1190 - ringTop0), 360, 700);
  const ringTop = head ? ringTop0 : ZONE_TOP + (1190 - ZONE_TOP - D) / 2;
  const R = D / 2, t = D * 0.21, cx = W / 2, cy = ringTop + R, rIn = R - t, land = 36;
  const roll = ramp(f, 4, 32, count), turn = d.value / d.max * roll, punch = f >= land ? slam(f, land, 1.05) : slam(f, 2, 1.12);
  const plan = numberPlan(d.value, 0, shown, c => widthOf(c, 100, HEAD, weight));
  const holeW = 2 * rIn, showMax = d.max !== 100;
  const unit = d.unit ? fit(d.unit, {width: holeW * 0.72, size: 40, min: 26, lines: 2, family: SANS, weight: 900}) : null;
  const unitH = unit ? unit.lines.length * unit.box + 16 : 0, unitW = unit ? Math.max(...unit.lines.map(line => widthOf(line, unit.size, SANS, 900))) + 32 : 0;
  const stack = (n: number) => DIGIT_BAND * n + (showMax ? 0.36 * n + 6 : 0) + (unit ? unitH + 18 : 0);
  let size = Math.min(holeW * 0.84 * 100 / plan.total, 300);
  while (stack(size) > holeW * 0.72 && size > 60) size *= 0.96;
  const stackH = stack(size), stackTop = cy - stackH / 2, numberH = DIGIT_BAND * size + 20;
  return <>
    <HeadLine head={head} text={d.label} top={ZONE_TOP}/>
    <svg width={W} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <defs><HtPattern id="kp-ring" r={4.2 * ramp(f, 4, 16, Easing.out(Easing.quad))}/></defs>
      <g transform={`translate(${punch.on ? punch.dx : 0} ${punch.on ? punch.dy : 0}) translate(${cx} ${cy}) scale(${punch.on ? punch.scale : 1}) translate(${-cx} ${-cy})`} opacity={punch.on ? 1 : 0}>
        <path d={sector(cx, cy, rIn, R, 1)} fill="url(#kp-ring)" fillRule="evenodd"/>
        <path d={sector(cx, cy, rIn, R, 1)} fill="none" stroke={INK} strokeWidth="8" fillRule="evenodd"/>
        {turn > 0.0005 ? <>
          <path d={sector(cx, cy, rIn, R, turn)} fill={LIME} fillRule="evenodd" transform={`translate(${-MIS} ${MIS})`}/>
          <path d={sector(cx, cy, rIn, R, turn)} fill="none" stroke={INK} strokeWidth="10" strokeLinejoin="miter" fillRule="evenodd"/></> : null}
      </g>
    </svg>
    <div style={{position: 'absolute', left: cx - holeW / 2, top: stackTop - 10, width: holeW, height: stackH + 20, transform: punch.on ? `translate(${punch.dx}px, ${punch.dy}px) scale(${punch.scale})` : undefined}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: holeW, height: numberH}}>
        <PrintedNumber id="kp-ring-num" chars={plan.at(roll)} widths={plan.widths} size={size} width={holeW} height={numberH} ht={0} progress={roll}/></div>
      {showMax ? <div style={{position: 'absolute', left: 0, right: 0, top: 10 + DIGIT_BAND * size + 6, textAlign: 'center', direction: 'ltr', fontFamily: HEAD, fontWeight: weight, fontSize: 0.3 * size, lineHeight: 1.2, color: INK, opacity: ramp(f, land - 6, 8)}}>/ {shown(String(d.max))}</div> : null}
      {unit ? <Slam at={28} from={1.3} style={{position: 'absolute', left: (holeW - unitW) / 2, top: 10 + stackH - unitH, width: unitW, height: unitH}}>
        <div style={{width: unitW, height: unitH, background: INK, boxShadow: `${-MIS / 2}px ${MIS / 2}px 0 ${LIME}`, color: PAPER, direction: copy.dir, textAlign: 'center', fontFamily: SANS, fontWeight: 900, fontSize: unit.size, padding: '8px 0', boxSizing: 'border-box'}}>
          {unit.lines.map((line, k) => <div key={k} style={{height: unit.box, lineHeight: `${unit.box}px`, whiteSpace: 'pre'}}>{line}</div>)}</div>
      </Slam> : null}
    </div>
  </>;
};

export const Figures: React.FC<FamilyDesignProps> = ({scene}) => {
  const {copy} = useDesign();
  if (scene.family !== 'figures') return null;
  const d = scene.data;
  return <Settled><AbsoluteFill style={{direction: copy.dir, textAlign: copy.align}}>
    <Ground/>
    {d.variant === 'counter' ? <Counter d={d}/> : d.variant === 'slot' ? <Slot d={d}/> : d.variant === 'bars' ? <Bars d={d}/> : <Ring d={d}/>}
    <SceneStickerSlot host="figures" sticker={d.sticker} ink={INK}/>
  </AbsoluteFill></Settled>;
};
