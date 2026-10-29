// calligraphic-receipts «figures»: a number becomes evidence on paper.
// counter: a tall receipt feeds out and its total counts, underlined twice in red. slot: an odometer clamped over the receipt.
// bars: one receipt row per bar with a hatched ink bar. ring: a red ink circle drawn around a round paper slip.
import React from 'react';
import {Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import type {FiguresData} from '../../../creative-kit/figures/schema';
import {slotDigitStrings, slotPosition} from '../../../creative-kit/figures/timing';
import {SceneStickerSlot} from '../../../creative-kit/sticker-view';
import {fitToWidth, measure} from '../../../core/type';
import {useDesignText} from '../../../style-kit/digits';
import {BrushRule, C, DesignRoot, FONT, PenBox, Stroke, Tick, W, expo, ramp, rng, sceneCopy, useCopy, Tooth} from './kit';
import {Barcode, Ground, Headline, InkBar, LeaderRow, NumberText, PAPER_FOOT, PAPER_HEAD, Paper, Settled, ZONE_BOTTOM, ZONE_TOP, decimalsOf, fixed, usePulse, useHead, useNumberFace, fitWrapped, wrapText, type Head} from './family-parts';

type Of<K extends FiguresData['variant']> = Extract<FiguresData, {variant: K}>;
const START = 6, FEED = 26, PAPER_EDGE = PAPER_HEAD + PAPER_FOOT;
const COUNT = Easing.bezier(0.2, 0.8, 0.2, 1);
const STICKER_CLEAR = 516;

/** Where the hero starts: under the headline, and below the sticker slot when there is one. */
const useHero = (d: FiguresData) => {
  const head = useHead(d.label, !!d.sticker, {maxSize: d.variant === 'bars' && d.bars.length > 3 ? 104 : 128});
  const top = head ? Math.max(head.bottom + 30, d.sticker ? STICKER_CLEAR : 0) : d.sticker ? STICKER_CLEAR : ZONE_TOP + 22;
  return {head, top, avail: ZONE_BOTTOM - top - PAPER_EDGE};
};

/** The unit as a red naskh line, fitted to `width`. */
const fitUnit = (unit: string, width: number, size: number, min = 38) => fitToWidth(unit, {fontFamily: FONT.naskh, fontSize: size, fontWeight: 700}, width, {min, max: size});

// ---------- counter ----------
const Counter: React.FC<{d: Of<'counter'>; head: Head | null; top: number; avail: number}> = ({d, head, top, avail}) => {
  const f = useCurrentFrame(), copy = useCopy(), shown = useDesignText(), face = useNumberFace();
  const RW = 780, PADX = 40, inner = RW - 2 * PADX, left = (W - RW) / 2;
  // The count ends on the value exactly as given, so it never shows more decimals than the value has.
  const from = d.from ?? 0, decimals = decimalsOf(d.value);
  const toText = shown(fixed(d.value, decimals)), fromText = shown(fixed(from, decimals));
  const reserve = Math.max(Array.from(toText).length, Array.from(fromText).length);
  const widest = Math.max(face.width(toText, 100), face.width(fromText, 100)) / 100;
  // The printed label line repeats the headline; a two-line headline already says it, so the receipt gives that room to the total.
  const label = d.label && head && head.L.lines.length === 1 ? wrapText(d.label, FONT.naskh, 700, 40, inner - 130, 1.35, 2) : null;
  const labelH = label ? label.lines.length * label.box + 44 : 0;
  const barH = avail > 560 ? 90 : 0;
  const rowH = avail - labelH - barH, PAD_Y = 24;
  const unit = d.unit ? fitUnit(d.unit, inner * 0.42, 68) : null;
  const unitW = unit ? unit.width : 0, unitBox = unit ? Math.round(unit.fontSize * 1.3) : 0, GAP = 26, UNDER = 46;
  const sideSize = Math.min(460, (inner - unitW - GAP) / widest, (rowH - 2 * PAD_Y - UNDER) / 0.9);
  const belowSize = Math.min(460, inner / widest, (rowH - 2 * PAD_Y - UNDER - unitBox) / 0.9);
  const beside = !unit || sideSize >= Math.max(260, belowSize * 0.85);
  const size = Math.floor(unit ? (beside ? sideSize : belowSize) : Math.min(460, inner / widest, (rowH - 2 * PAD_Y - UNDER) / 0.9));
  const numW = Math.ceil(widest * size * reserve / Math.max(1, reserve)), numBox = Math.round(size * 0.9);
  const clusterW = numW + (unit && beside ? GAP + unitW : 0);
  const blockH = numBox + UNDER + (unit && !beside ? unitBox + 6 : 0);
  const blockTop = labelH + 7 + (rowH - 7 - blockH) / 2;
  const clusterLeft = (RW - clusterW) / 2;
  const numX = copy.ar && unit && beside ? clusterLeft + unitW + GAP : clusterLeft;
  const unitX = unit ? (beside ? (copy.ar ? clusterLeft : clusterLeft + numW + GAP) : (RW - unitW) / 2) : 0;
  const roll = ramp(f, START + 8, 36, COUNT), end = START + 8 + 36;
  const text = shown(fixed(from + (d.value - from) * roll, decimals));
  const punch = usePulse(end + 2);
  const seed = Math.abs(Math.round(d.value * 7)) + 11;
  return <>
    <Paper left={left} top={top} width={RW} height={avail} start={START} feed={FEED} rot={-0.8} seed={6}
      ghosts={[{dx: 46, dy: 8, rot: 2.6, len: avail * 0.8, tone: '#F4EAD6'}, {dx: -40, dy: 6, rot: -2.2, len: avail * 0.86}]}>
      {label ? <div style={{position: 'absolute', left: PADX, right: PADX, top: 0, height: labelH, display: 'flex', flexDirection: 'column', justifyContent: 'center', direction: copy.dir}}>
        <LeaderRow lines={label.lines} size={label.size} box={label.box} trail={0} value={<div style={{width: 58, height: 58, marginBottom: 2}}><Tick at={end + 4} size={58}/></div>}/>
      </div> : null}
      <div style={{position: 'absolute', left: 0, right: 0, top: labelH, height: rowH, borderTop: `7px double ${C.ink}`, boxSizing: 'border-box'}}/>
      <div data-count-progress={roll} style={{position: 'absolute', left: numX, top: blockTop, transform: `scale(${punch})`, transformOrigin: '50% 50%'}}>
        <NumberText text={text} reserve={reserve} size={size} face={face} color={C.ink}/>
      </div>
      {unit ? <div style={{position: 'absolute', left: unitX, width: unitW + 4, top: beside ? blockTop + numBox - unitBox + size * 0.04 : blockTop + numBox + UNDER + 6 - 6,
        fontFamily: FONT.naskh, fontWeight: 700, fontSize: unit.fontSize, lineHeight: `${unitBox}px`, color: C.rust, whiteSpace: 'nowrap', direction: copy.dir, textAlign: beside ? undefined : 'center'}}>{d.unit}</div> : null}
      <BrushRule local left={numX} top={blockTop + numBox + 6} w={numW} h={24} at={end + 2} dur={14} seed={4}/>
      <BrushRule local left={numX + numW * 0.1} top={blockTop + numBox + 26} w={numW * 0.84} h={16} at={end + 8} dur={12} seed={9}/>
      {barH ? <div style={{position: 'absolute', left: (RW - 520) / 2, top: avail - barH + 14}}><Barcode w={520} h={46} seed={seed}/></div> : null}
    </Paper>
  </>;
};

// ---------- slot ----------
const Slot: React.FC<{d: Of<'slot'>; top: number; avail: number}> = ({d, top, avail}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig(), copy = useCopy(), shown = useDesignText(), face = useNumberFace();
  const RW = 800, PADX = 40, inner = RW - 2 * PADX, left = (W - RW) / 2;
  const {to, from} = slotDigitStrings(d.value, d.from), n = to.length;
  const unit = d.unit ? fitUnit(d.unit, inner, 64) : null;
  const unitH = unit ? Math.round(unit.fontSize * 1.3) + 30 : 0, barH = 80;
  const PAD = 26, GAPW = 8, HW_MAX = 948, em = face.em('0');
  const cellW = Math.min(210, (HW_MAX - 2 * PAD - (n - 1) * GAPW) / n);
  const free = avail - unitH - barH - 2 * PAD - 90;
  const S = Math.floor(Math.min(cellW * 0.94 / em, free / 1.18, 400)), cellH = Math.round(S * 1.18);
  const cw = Math.ceil(S * em / 0.94), HW = n * cw + (n - 1) * GAPW + 2 * PAD, HH = cellH + 2 * PAD;
  const housingTop = top + PAPER_HEAD + 18 + (avail - unitH - barH - HH - 18) / 2;
  const pop = ramp(f, START + 6, 14);
  const seed = Math.abs(d.value) % 97 + 3;
  return <>
    <Paper left={left} top={top} width={RW} height={avail} start={START} feed={FEED} rot={0.7} seed={11}
      ghosts={[{dx: -46, dy: 8, rot: -2.6, len: avail * 0.84, tone: '#F4EAD6'}, {dx: 40, dy: 6, rot: 2.2, len: avail * 0.78}]}>
      {unit ? <div style={{position: 'absolute', left: 0, right: 0, top: avail - barH - unitH, height: unitH, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT.naskh, fontWeight: 700, fontSize: unit.fontSize, color: C.rust, direction: copy.dir, whiteSpace: 'nowrap'}}>{d.unit}</div> : null}
      {unit ? <div style={{position: 'absolute', left: RW / 2 + (copy.ar ? -1 : 1) * (unit.width / 2 + 56) - 28, top: avail - barH - unitH + (unitH - 56) / 2, width: 56, height: 56}}><Tick at={START + 66} size={56}/></div> : null}
      <div style={{position: 'absolute', left: (RW - 520) / 2, top: avail - barH + 14}}><Barcode w={520} h={46} seed={seed}/></div>
      <div style={{position: 'absolute', left: 0, right: 0, top: avail - barH - 2, borderTop: `7px double ${C.ink}`}}/>
    </Paper>
    <div style={{position: 'absolute', left: (W - HW) / 2, top: housingTop, width: HW, height: HH, opacity: pop, transform: `translateY(${(1 - pop) * -36}px)`,
      borderRadius: 26, background: 'linear-gradient(180deg,#54402f 0%,#2a1d14 42%,#150d08 100%)', boxShadow: '0 22px 36px rgba(30,18,8,0.45), inset 0 2px 0 rgba(255,255,255,0.2), inset 0 -3px 6px rgba(0,0,0,0.5)'}}>
      {[[12, 12], [HW - 24, 12], [12, HH - 24], [HW - 24, HH - 24]].map(([x, y], i) => <div key={i} style={{position: 'absolute', left: x, top: y, width: 12, height: 12, borderRadius: 6, background: 'radial-gradient(circle at 35% 30%, #b7a48c, #5a4636 70%)'}}/>)}
      {[0, 1].map(side => <div key={side} style={{position: 'absolute', [side ? 'right' : 'left']: 6, top: HH / 2 - 9, width: 0, height: 0, borderTop: '9px solid transparent', borderBottom: '9px solid transparent', [side ? 'borderRight' : 'borderLeft']: `13px solid ${C.rust}`}}/>)}
      <div aria-label={shown(String(d.value))} style={{position: 'absolute', left: PAD, top: PAD, display: 'flex', direction: 'ltr', gap: GAPW}}>
        {Array.from(to).map((digit, i) => {
          const pos = slotPosition(f, i, n, Number(digit), Number(from[i]), fps), lo = Math.floor(pos) - 1;
          return <div key={i} aria-label={digit} style={{position: 'relative', width: cw, height: cellH, overflow: 'hidden', borderRadius: 10, background: C.thermal}}>
            <div style={{position: 'absolute', left: 0, top: 0, width: cw, transform: `translateY(${-pos * cellH}px)`}}>
              {Array.from({length: 4}, (_, k) => lo + k).filter(k => k >= 0 && k < 41).map(k => <div key={k} style={{position: 'absolute', left: 0, top: k * cellH, width: cw, height: cellH, textAlign: 'center',
                fontFamily: face.family, fontWeight: face.weight, fontSize: S, lineHeight: `${cellH}px`, color: C.ink}}>{shown(String(k % 10))}</div>)}
            </div>
            <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(25,12,6,0.62) 0%, rgba(25,12,6,0.08) 24%, rgba(255,255,255,0.18) 50%, rgba(25,12,6,0.08) 76%, rgba(25,12,6,0.62) 100%)'}}/>
          </div>;
        })}
      </div>
    </div>
  </>;
};

// ---------- bars ----------
/** Row sizes from big to small for one to three bars. */
const BAR_SIZES = Array.from({length: 16}, (_, i) => {
  const k = 1.3 - i * 0.04;
  return {label: Math.max(30, Math.round(68 * k)), value: Math.max(40, Math.round(112 * k)), bar: Math.round(150 * k ** 1.8), gap: Math.max(8, Math.round(44 * k)), mt: Math.max(5, Math.round(12 * k))};
});
const Bars: React.FC<{d: Of<'bars'>; top: number; avail: number}> = ({d, top, avail}) => {
  const f = useCurrentFrame(), copy = useCopy(), shown = useDesignText(), face = useNumberFace();
  const RW = 820, PADX = 40, inner = RW - 2 * PADX, left = (W - RW) / 2, n = d.bars.length;
  const max = d.max ?? Math.max(1, ...d.bars.map(b => b.value));
  const hi = d.bars.reduce((best, b, i) => b.value > d.bars[best].value ? i : best, 0);
  const footH = 58;
  const texts = d.bars.map(b => shown(fixed(b.value, decimalsOf(b.value))));
  const rowsFor = (s: typeof BAR_SIZES[number]) => d.bars.map((b, i) => {
    const unit = d.unit ? fitUnit(d.unit, 200, Math.round(s.value * 0.42), 26) : null;
    const vw = Math.ceil(face.width(texts[i], s.value)) + (unit ? unit.width + 14 : 0);
    const label = wrapText(b.label, FONT.naskh, 700, s.label, inner - vw - 70, 1.3, 2);
    const head = Math.max(label.lines.length * label.box, Math.round(s.value * 0.9));
    return {label, unit, vw, head, h: head + s.mt + s.bar};
  });
  const total = (s: typeof BAR_SIZES[number]) => rowsFor(s).reduce((sum, r) => sum + r.h + s.gap, 0) + footH;
  const s = BAR_SIZES.find(c => total(c) <= avail) ?? BAR_SIZES[BAR_SIZES.length - 1];
  const rows = rowsFor(s), extra = Math.max(0, Math.min(56, (avail - total(s)) / n));
  let y = 12 + Math.max(0, (avail - total(s) - extra * n) / 2);
  const ys = rows.map(r => { const at = y; y += r.h + s.gap + extra; return at; });
  const seed = Math.round(max * 3) + n;
  return <Paper left={left} top={top} width={RW} height={avail} start={START} feed={FEED} rot={-0.7} seed={21}
    ghosts={[{dx: 44, dy: 8, rot: 2.4, len: avail * 0.8, tone: '#F4EAD6'}, {dx: -38, dy: 6, rot: -2, len: avail * 0.86}]}>
    {d.bars.map((b, i) => {
      const r = rows[i], red = i === hi, color = red ? C.rust : C.ink;
      const p = ramp(f, START + 10 + i * 6, 30, expo), len = Math.max(b.value > 0 ? 8 : 0, inner * b.value / max);
      const shownValue = shown(fixed(b.value * p, decimalsOf(b.value)));
      const reserve = Array.from(texts[i]).length, land = START + 10 + i * 6 + 30;
      return <div key={i} style={{position: 'absolute', left: PADX, width: inner, top: ys[i]}}>
        <div style={{height: r.head, display: 'flex', alignItems: 'flex-end'}}>
          <div style={{flex: 1}}><LeaderRow lines={r.label.lines} size={r.label.size} box={r.label.box}
            value={<div style={{position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 14, direction: copy.dir}}>
              <NumberText text={shownValue} reserve={reserve} size={s.value} face={face} color={color}/>
              {r.unit ? <span style={{fontFamily: FONT.naskh, fontWeight: 700, fontSize: r.unit.fontSize, lineHeight: `${Math.round(s.value * 0.9)}px`, color: C.rust, whiteSpace: 'nowrap'}}>{d.unit}</span> : null}
              {red ? <div style={{position: 'absolute', left: -22, top: -10}}><PenBox w={r.vw + 44} h={Math.round(s.value * 0.9) + 24} r={Math.round(s.value * 0.45)} at={land} dur={18} color={C.rust} width={5} seed={5}/></div> : null}
            </div>}/></div>
        </div>
        <div style={{marginTop: s.mt}}><InkBar track={inner} len={len} h={s.bar} p={p} color={color} outlined={d.max !== undefined}/></div>
      </div>;
    })}
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: footH, borderTop: `7px double ${C.ink}`, boxSizing: 'border-box', padding: `0 ${PADX}px`, display: 'flex', alignItems: 'center', direction: copy.dir, gap: 24}}>
      <div style={{flex: 1, display: 'flex', justifyContent: 'center'}}><Barcode w={520} h={40} seed={seed}/></div>
    </div>
  </Paper>;
};

// ---------- bars, four to six ----------
/** Many bars become compact rows: the label on the start side, a hatched bar, and the value in its own column, so the type stays big. */
const CompactBars: React.FC<{d: Of<'bars'>; top: number; avail: number}> = ({d, top, avail}) => {
  const f = useCurrentFrame(), copy = useCopy(), shown = useDesignText(), face = useNumberFace();
  const RW = 900, PADX = 40, inner = RW - 2 * PADX, left = (W - RW) / 2, n = d.bars.length, COLGAP = 22;
  const max = d.max ?? Math.max(1, ...d.bars.map(b => b.value));
  const hi = d.bars.reduce((best, b, i) => b.value > d.bars[best].value ? i : best, 0);
  const footH = d.unit ? 80 : 58, rowH = Math.min(124, Math.floor((avail - footH - 24) / n));
  const texts = d.bars.map(b => shown(fixed(b.value, decimalsOf(b.value))));
  const vsize = Math.max(48, Math.min(66, Math.round(rowH * 0.56))), vw = Math.ceil(Math.max(...texts.map(t => face.width(t, vsize)))) + 8;
  const lsize = Math.max(46, Math.min(54, Math.round(rowH * 0.46))), barH = Math.round(Math.min(64, rowH * 0.58));
  const widest = Math.max(...d.bars.map(b => measure(b.label, {fontFamily: FONT.naskh, fontSize: lsize, fontWeight: 700}).width));
  const LW = Math.round(Math.max(150, Math.min(n > 4 ? 400 : 340, widest + 8))), track = inner - LW - vw - 2 * COLGAP;
  // Labels stay at 46 px and up. Only when a label would not fit its row do they step down, and never so far that two rows touch.
  const labels = d.bars.map(b => {
    for (let size = lsize; size >= 26; size -= 2) {
      const t = fitWrapped(b.label, FONT.naskh, 700, size, size, LW, 1.2, 2);
      if (t.width <= LW && t.lines.length * t.box <= rowH - 8) return t;
    }
    return fitWrapped(b.label, FONT.naskh, 700, 26, 26, LW, 1.2, 2);
  });
  const lead = Math.max(0, (avail - footH - rowH * n - 24) / 2);
  const x = (physical: number, w: number) => copy.ar ? inner - physical - w : physical; // `physical` counts from the start edge
  const seed = Math.round(max * 3) + n;
  return <Paper left={left} top={top} width={RW} height={avail} start={START} feed={FEED} rot={-0.7} seed={21}
    ghosts={[{dx: 30, dy: 8, rot: 1.6, len: avail * 0.8, tone: '#F4EAD6'}, {dx: -28, dy: 6, rot: -1.4, len: avail * 0.86}]}>
    <div style={{position: 'absolute', left: PADX, top: 12 + lead, width: inner}}>
      {d.bars.map((b, i) => {
        const red = i === hi, color = red ? C.rust : C.ink, p = ramp(f, START + 10 + i * 6, 30, expo), l = labels[i];
        const shownValue = shown(fixed(b.value * p, decimalsOf(b.value))), land = START + 10 + i * 6 + 30;
        const len = Math.max(b.value > 0 ? 8 : 0, track * b.value / max);
        return <div key={i} style={{position: 'absolute', left: 0, top: i * rowH, width: inner, height: rowH}}>
          {i ? <div style={{position: 'absolute', left: 0, right: 0, top: 0, borderTop: '3px dashed rgba(46,32,25,0.22)'}}/> : null}
          <div style={{position: 'absolute', left: x(0, LW), top: 0, width: LW, height: rowH, display: 'flex', flexDirection: 'column', justifyContent: 'center', direction: copy.dir, textAlign: copy.align}}>
            {l.lines.map((line, k) => <div key={k} style={{height: l.box, lineHeight: `${l.box}px`, fontFamily: FONT.naskh, fontWeight: 700, fontSize: l.size, color: C.ink, whiteSpace: 'pre'}}>{line}</div>)}</div>
          <div style={{position: 'absolute', left: x(LW + COLGAP, track), top: (rowH - barH) / 2}}><InkBar track={track} len={len} h={barH} p={p} color={color} outlined={d.max !== undefined}/></div>
          <div style={{position: 'absolute', left: x(LW + COLGAP + track + COLGAP, vw), top: (rowH - vsize * 0.9) / 2, width: vw}}>
            <NumberText text={shownValue} reserve={Array.from(texts[i]).length} size={vsize} face={face} color={color}/>
            {red ? <div style={{position: 'absolute', left: -14, top: -12}}><PenBox w={face.width(texts[i], vsize) + 36} h={Math.round(vsize * 0.9) + 24} r={Math.round(vsize * 0.45)} at={land} dur={18} color={C.rust} width={5} seed={5}/></div> : null}
          </div>
        </div>;
      })}
    </div>
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: footH, borderTop: `7px double ${C.ink}`, boxSizing: 'border-box', padding: `0 ${PADX}px`, display: 'flex', alignItems: 'center', direction: copy.dir, gap: 24}}>
      {d.unit ? <span style={{fontFamily: FONT.naskh, fontWeight: 700, fontSize: fitUnit(d.unit, 300, 54).fontSize, color: C.rust, whiteSpace: 'nowrap'}}>{d.unit}</span> : null}
      <div style={{flex: 1, display: 'flex', justifyContent: d.unit ? (copy.ar ? 'flex-start' : 'flex-end') : 'center'}}><Barcode w={d.unit ? 380 : 520} h={38} seed={seed}/></div>
    </div>
  </Paper>;
};

// ---------- ring ----------
/** A closed outline of a round slip of paper with a torn rim. */
const roundSlip = (cx: number, cy: number, r: number, seed: number, amp: number) => {
  const rand = rng(seed), pts = Array.from({length: 120}, (_, i) => {
    const a = (i / 120) * Math.PI * 2, rr = r + (rand() - 0.5) * amp * 2 + Math.sin(a * 7 + seed) * amp * 0.5;
    return `${(cx + Math.cos(a) * rr).toFixed(1)}px ${(cy + Math.sin(a) * rr).toFixed(1)}px`;
  });
  return `polygon(${pts.join(', ')})`;
};

const Ring: React.FC<{d: Of<'ring'>; top: number; avail: number}> = ({d, top, avail}) => {
  const f = useCurrentFrame(), copy = useCopy(), shown = useDesignText(), face = useNumberFace();
  const zone = avail + PAPER_EDGE, D = Math.min(700, zone - 8), R = D / 2, cx = W / 2, cy = top + R + 4;
  const ringR = R - 34, turn = d.value / d.max, drawn = Math.min(1.045, turn + (turn >= 0.995 ? 0.05 : 0));
  const roll = ramp(f, START + 4, 40, COUNT), p = ramp(f, START + 4, 40, COUNT);
  const N = 90, r = rng(7);
  const pts: [number, number][] = [], wd: number[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, a = -Math.PI / 2 + u * drawn * Math.PI * 2;
    const wob = 1 + 0.012 * Math.sin(a * 3 + 1.3) + 0.007 * Math.sin(a * 5), over = u > 0.9 && turn >= 0.995 ? -(u - 0.9) * 0.2 : 0;
    pts.push([cx + Math.cos(a) * ringR * (wob + over), cy + Math.sin(a) * ringR * (wob + over)]);
    const cap = u < 0.03 ? Math.sqrt(1 - Math.pow(1 - u / 0.03, 2)) : 1;
    wd.push(Math.max(3, 40 * cap * (0.3 + 0.7 * Math.pow(1 - u * 0.9, 0.6)) * (1 + (r() - 0.5) * 0.12)));
  }
  const shownValue = shown(fixed(d.value * roll, decimalsOf(d.value))), final = shown(fixed(d.value, decimalsOf(d.value)));
  const reserve = Array.from(final).length, holeW = (ringR - 28) * 2 * 0.86;
  const showMax = d.max !== 100, maxText = shown(String(d.max));
  const unit = d.unit ? fitUnit(d.unit, holeW, 56, 30) : null;
  const unitLines = unit ? wrapText(d.unit!, FONT.naskh, 700, unit.fontSize, holeW, 1.3, 2) : null;
  const unitH = unitLines ? unitLines.lines.length * unitLines.box : 0, maxH = showMax ? 64 : 0;
  const size = Math.floor(Math.min(face.width(final, 100) > 0 ? holeW / (face.width(final, 100) / 100) : 300, 340, (ringR * 2 * 0.62 - unitH - maxH) / 0.9));
  const stackH = Math.round(size * 0.9) + maxH + unitH + (unit ? 10 : 0), stackTop = cy - stackH / 2;
  const settleIn = ramp(f, START, 16), punch = usePulse(START + 44);
  return <>
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: 1920, opacity: settleIn, transform: `translateY(${(1 - settleIn) * -30}px)`}}>
      <div style={{position: 'absolute', inset: 0, filter: 'blur(18px)', opacity: 0.34, transform: 'translateY(14px)'}}>
        <div style={{position: 'absolute', inset: 0, background: '#2A1A0E', clipPath: roundSlip(cx, cy, R, 5, 6)}}/></div>
      <div style={{position: 'absolute', inset: 0, background: C.fringe, clipPath: roundSlip(cx, cy, R + 4, 9, 6)}}/>
      <div style={{position: 'absolute', inset: 0, background: C.thermal, clipPath: roundSlip(cx, cy, R, 5, 6)}}>
        <Tooth w={W} h={1920} tooth={0.1} fibre={0} seed={31} tint={[0.45, 0.4, 0.33]}/>
      </div>
      <svg width={W} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <circle cx={cx} cy={cy} r={ringR} fill="none" stroke={C.ink} strokeOpacity={0.34} strokeWidth={9} strokeLinecap="round" strokeDasharray="0.1 21"/>
        <circle cx={cx} cy={cy} r={ringR - 46} fill="none" stroke={C.ink} strokeOpacity={0.16} strokeWidth={3} strokeDasharray="10 12"/>
      </svg>
      <Stroke pts={pts} wd={wd} p={p} color={C.rust} box={{x: cx - ringR - 60, y: cy - ringR - 60, w: 2 * ringR + 120, h: 2 * ringR + 120}} streak={C.thermal} seed={3}/>
    </div>
    <div style={{position: 'absolute', left: cx - holeW / 2, top: stackTop, width: holeW, height: stackH, transform: `scale(${punch})`, transformOrigin: '50% 50%'}}>
      <div data-count-progress={roll} style={{display: 'flex', justifyContent: 'center'}}><NumberText text={shownValue} reserve={reserve} size={size} face={face} color={C.ink}/></div>
      {showMax ? <div style={{height: maxH, display: 'flex', justifyContent: 'center', fontFamily: FONT.mono, fontWeight: 600, fontSize: 48, lineHeight: `${maxH}px`, color: C.inkSoft, direction: 'ltr'}}>/ {maxText}</div> : null}
      {unitLines ? <div style={{marginTop: 10, textAlign: 'center', direction: copy.dir, fontFamily: FONT.naskh, fontWeight: 700, fontSize: unitLines.size, color: C.rust}}>
        {unitLines.lines.map((line, i) => <div key={i} style={{height: unitLines.box, lineHeight: `${unitLines.box}px`, whiteSpace: 'pre'}}>{line}</div>)}</div> : null}
    </div>
  </>;
};

export const Figures: React.FC<FamilyDesignProps> = ({scene}) => {
  if (scene.family !== 'figures') return null;
  const d = scene.data;
  return <DesignRoot copy={sceneCopy(d)}><Settled><FiguresBody d={d}/></Settled></DesignRoot>;
};

const FiguresBody: React.FC<{d: FiguresData}> = ({d}) => {
  const {head, top, avail} = useHero(d);
  return <>
    <Ground head={head}/>
    {head ? <Headline head={head}/> : null}
    {d.variant === 'counter' ? <Counter d={d} head={head} top={top} avail={avail}/>
      : d.variant === 'slot' ? <Slot d={d} top={top} avail={avail}/>
      : d.variant === 'bars' ? (d.bars.length > 3 ? <CompactBars d={d} top={top} avail={avail}/> : <Bars d={d} top={top} avail={avail}/>)
      : <Ring d={d} top={top} avail={avail}/>}
    <SceneStickerSlot host="figures" sticker={d.sticker} ink={C.ink}/>
  </>;
};
