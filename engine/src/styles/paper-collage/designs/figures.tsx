// paper-collage figures: a number, digits, bars or a ring built from cut and torn paper.
// Every piece drops onto the sheet with a little overshoot, then the tape lands. Heroes fill the zone and settle by frame 100.
import React from 'react';
import {Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import type {FiguresData} from '../../../creative-kit/figures/schema';
import {slotDigitStrings, slotPosition} from '../../../creative-kit/figures/timing';
import {SceneStickerSlot} from '../../../creative-kit/sticker-view';
import {useDesignText} from '../../../style-kit/digits';
import {C, BODY, LAT, W, X1, ramp, textW, rng, hexRgb, rectShape, tornShape, polyShape, fit, pstr, shadowFilter, Stage, Piece, Tape, CutNumeral, DesignProvider, useKit, type Pt, type Shape, type ShapeFn} from './kit';
import {STICKER_EDGE, UNIT_H, UNIT_OVERHANG, X0, ZONE_BOTTOM, ZONE_TOP, Settled, StripHeadline, UnitSlip, clamp, decimalsOf, fixed, oneLine, planUnit, stripBox, useFixedX, useHeadPlan} from './family-parts';

type V<K extends FiguresData['variant']> = Extract<FiguresData, {variant: K}>;

const COUNT = Easing.bezier(0.2, 0.8, 0.2, 1);
const OUT3 = Easing.out(Easing.cubic);
const HEAD_GAP = 30;
const headWidth = (d: FiguresData) => (d.sticker ? STICKER_EDGE - X0 : 950);
const headRight = (d: FiguresData) => (d.sticker ? STICKER_EDGE : X1);
/** Top of a stack of the given height, centred in the content zone. */
const centred = (height: number) => ZONE_TOP + (ZONE_BOTTOM - ZONE_TOP - height) / 2;
const BAR_FILLS = [C.terra, C.teal, C.mustard];

export const Figures: React.FC<FamilyDesignProps> = p => {
  if (p.scene.family !== 'figures') return null;
  const d = p.scene.data;
  return <DesignProvider data={d} sectionIndex={p.sectionIndex}>
    <Stage offcuts={{family: 'half', colors: [C.teal, C.terra, C.mustard]}}>
      <Settled>
        {d.variant === 'counter' ? <Counter d={d}/> : d.variant === 'slot' ? <Slot d={d}/> : d.variant === 'bars' ? <Bars d={d}/> : <Ring d={d}/>}
        <SceneStickerSlot host="figures" sticker={d.sticker} ink={C.ink}/>
      </Settled>
    </Stage>
  </DesignProvider>;
};

// ---------- counter ----------
// The label on paper strips, then a big torn terra panel with the number cut from cream paper counting up inside it.
const PANEL_X = 80, PANEL_W = 920;

const Counter: React.FC<{d: V<'counter'>}> = ({d}) => {
  const f = useCurrentFrame();
  const shown = useDesignText();
  const head = useHeadPlan(d.label, {width: headWidth(d)});
  const unit = planUnit(d.unit);
  const from = d.from ?? 0, decimals = Math.max(decimalsOf(d.value), decimalsOf(from));
  const perSize = Math.max(textW(shown(fixed(from, decimals)), LAT, 100, 700), textW(shown(fixed(d.value, decimals)), LAT, 100, 700)) / 100;
  const headH = head ? head.height + HEAD_GAP : 0, unitH = unit ? UNIT_OVERHANG : 0;
  const avail = ZONE_BOTTOM - ZONE_TOP - headH - unitH;
  const size = Math.floor(Math.min(head ? 440 : 560, (avail - 150) / 0.66, (PANEL_W - 120) / perSize));
  const panelH = Math.round(clamp(0.66 * size + 150, 260, avail));
  const top0 = centred(headH + panelH + unitH), panelTop = top0 + headH;
  const roll = ramp(f, 16, 36, COUNT);
  const punch = 1 + 0.05 * Math.max(0, 1 - Math.abs(f - 56) / 6) * (f >= 54 ? 1 : 0);
  return <>
    {head ? <StripHeadline plan={head} top={top0} at={0} id="ct-h" right={headRight(d)}/> : null}
    <Piece id="ct-back" x={PANEL_X + 30} y={panelTop + 8} w={PANEL_W - 60} h={panelH} rot={5.5} color={C.teal} shape={rectShape(8)} enter={{at: 4, from: [0, -240], dur: 18, rot: -4}} depth={0.7} z={2}/>
    <Piece id="ct-panel" x={PANEL_X} y={panelTop} w={PANEL_W} h={panelH} rot={-1} color={C.terra} shape={tornShape('tb', 6.5, 9)} enter={{at: 8, from: [0, -300], dur: 19, rot: 4}} depth={1} z={3}>
      <div data-count-progress={roll} style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'ltr', opacity: ramp(f, 14, 6), transform: `scale(${punch}) rotate(-1deg)`}}>
        <CutNumeral text={fixed(from + (d.value - from) * roll, decimals)} size={size} color={C.card} lift={roll < 1 ? 1 : 0}/>
      </div>
      <Tape cx={64} cy={22} len={176} h={56} rot={-36} at={30} id="ct-t1"/>
      <Tape cx={PANEL_W - 64} cy={panelH - 20} len={176} h={56} rot={-34} at={36} from="r" id="ct-t2"/>
    </Piece>
    {unit ? <UnitSlip plan={unit} right={X1 - 40} top={panelTop + panelH - 34} at={58} id="ct-unit"/> : null}
  </>;
};

// ---------- slot ----------
// A split-flap board made of paper: each digit sits on a flap card whose upper flap falls until it lands. Every flap is clipped to its card.
const CARD_FILLS = [C.teal, C.terra, C.mustard];
const CARD_INKS = [C.card, C.card, C.ink];
const CARD_INSET = 5;

type FlapProps = {w: number; h: number; size: number; pos: number; color: string; ink: string};
const FlapCard: React.FC<FlapProps> = ({w, h, size, pos, color, ink}) => {
  const shown = useDesignText();
  const k = Math.floor(pos), phi = pos - k, cur = k % 10, nxt = (k + 1) % 10, half = h / 2;
  const fall = Math.cos(phi * Math.PI);
  const innerW = w - 2 * CARD_INSET;
  const digit = (n: number) => <div style={{position: 'absolute', left: 0, top: 0, width: innerW, height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'ltr',
    fontFamily: LAT, fontWeight: 700, fontSize: size, lineHeight: 1, color: ink}}>{shown(String(n))}</div>;
  // A window onto the top or the bottom half of one digit; overflow is hidden so nothing leaves the card.
  const face = (part: 'top' | 'bottom', n: number, extra: React.CSSProperties = {}, shade = 0) => <div style={{position: 'absolute', left: CARD_INSET, width: innerW, overflow: 'hidden', background: color,
    top: part === 'top' ? CARD_INSET : half, height: part === 'top' ? half - CARD_INSET : half - CARD_INSET, ...extra}}>
    <div style={{position: 'absolute', left: 0, top: part === 'top' ? -CARD_INSET : -half, width: innerW, height: h}}>{digit(n)}</div>
    {shade > 0 ? <div style={{position: 'absolute', inset: 0, background: `rgba(20,24,22,${shade})`}}/> : null}
  </div>;
  return <>
    {face('top', phi > 0 ? nxt : cur, {}, phi > 0 ? 0.16 * (1 - phi) : 0)}
    {face('bottom', cur, {}, 0.22 * Math.sin(phi * Math.PI))}
    {fall > 0.01 ? face('top', cur, {transform: `scaleY(${fall})`, transformOrigin: '50% 100%'}, 0.2 * (1 - fall)) : null}
    {fall < -0.01 ? face('bottom', nxt, {transform: `scaleY(${-fall})`, transformOrigin: '50% 0%'}, 0.2 * (1 + fall)) : null}
    <div style={{position: 'absolute', left: CARD_INSET, width: innerW, top: half - 2, height: 4, background: 'rgba(20,24,22,0.38)'}}/>
    <div style={{position: 'absolute', left: CARD_INSET, width: innerW, top: half + 2, height: 2, background: 'rgba(255,255,255,0.28)'}}/>
    {[-1, 1].map(side => <div key={side} style={{position: 'absolute', top: half - 9, [side < 0 ? 'left' : 'right']: CARD_INSET + 4, width: 18, height: 18, borderRadius: 9, background: 'rgba(20,24,22,0.5)'}}/>)}
  </>;
};

const Slot: React.FC<{d: V<'slot'>}> = ({d}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const shown = useDesignText();
  const fixedX = useFixedX();
  const head = useHeadPlan(d.label, {width: headWidth(d)});
  const unit = planUnit(d.unit);
  const {to, from} = slotDigitStrings(d.value, d.from);
  const n = to.length, rows = n <= 6 ? 1 : 2, perRow = Math.ceil(n / rows);
  const digitW = Math.max(...Array.from({length: 10}, (_, k) => textW(shown(String(k)), LAT, 100, 700))) / 100;
  const GAP = 12, BOARD_X = 20, BOARD_Y = 26, BOARD_W = 950;
  const headH = head ? head.height + HEAD_GAP : 0, unitH = unit ? UNIT_OVERHANG : 0;
  const avail = ZONE_BOTTOM - ZONE_TOP - headH - unitH;
  const rowH = (avail - 2 * BOARD_Y - (rows - 1) * GAP) / rows;
  const wide = Math.floor((BOARD_W - 2 * BOARD_X - (perRow - 1) * GAP) / perRow);
  // One row of tall flap cards (the board dominates the zone); two rows use shorter cards.
  const tall = rows === 1, fill = tall ? 0.96 : 0.84;
  const size = Math.floor(Math.min(500, wide * fill / digitW, tall ? (rowH - 20) / 1.4 : (rowH - 140) / 0.66));
  const cardW = Math.min(wide, Math.round(size * digitW / fill)), cardH = Math.round(clamp(tall ? 1.4 * size + 20 : 0.66 * size + 140, 220, rowH));
  const boardW = perRow * cardW + (perRow - 1) * GAP + 2 * BOARD_X, boardH = rows * cardH + (rows - 1) * GAP + 2 * BOARD_Y;
  const top0 = centred(headH + boardH + unitH), boardTop = top0 + headH, boardLeft = (W - boardW) / 2;
  return <>
    {head ? <StripHeadline plan={head} top={top0} at={0} id="sl-h" right={headRight(d)}/> : null}
    <Piece id="sl-board" x={boardLeft} y={boardTop} w={boardW} h={boardH} rot={-0.7} color={C.ink} shape={tornShape('tb', 5.5, 8)} enter={{at: 4, from: [0, -300], dur: 19, rot: 3}} depth={1.1} z={2}>
      <Tape cx={46} cy={14} len={150} h={50} rot={-36} at={30} id="sl-t1"/>
      <Tape cx={boardW - 46} cy={boardH - 14} len={150} h={50} rot={-34} at={36} from="r" id="sl-t2"/>
    </Piece>
    <div aria-label={shown(String(d.value))} style={{display: 'contents'}}>
    {to.split('').map((ch, i) => {
      const row = Math.floor(i / perRow), col = i % perRow, inRow = row === rows - 1 ? n - row * perRow : perRow;
      const rowW = inRow * cardW + (inRow - 1) * GAP;
      const x = boardLeft + (boardW - rowW) / 2 + col * (cardW + GAP), y = boardTop + BOARD_Y + row * (cardH + GAP);
      const pos = slotPosition(f - 12, i, n, Number(ch), Number(from[i]), fps);
      const tilt = [-1.3, 0.9, -0.6, 1.2][i % 4];
      return <Piece key={i} id={`sl-card-${i}`} x={fixedX(x, cardW)} y={y} w={cardW} h={cardH} rot={tilt} color={CARD_FILLS[i % 3]} shape={rectShape(5)} enter={{at: 6 + i * 2, from: [0, -260], dur: 16, rot: i % 2 ? 5 : -5}} depth={0.6} z={5 + i}>
        <FlapCard w={cardW} h={cardH} size={size} pos={pos} color={CARD_FILLS[i % 3]} ink={CARD_INKS[i % 3]}/>
        <Tape cx={cardW / 2 + (i % 2 ? 10 : -10)} cy={6} len={Math.min(110, Math.round(cardW * 0.62))} h={40} rot={i % 2 ? 7 : -8} at={30 + i * 2} id={`sl-ct-${i}`}/>
      </Piece>;
    })}
    </div>
    {unit ? <UnitSlip plan={unit} right={X1 - 40} top={boardTop + boardH - 34} at={60} id="sl-unit"/> : null}
  </>;
};

// ---------- bars ----------
// Each row is a cream label strip on the start side with a torn strip taped to it, growing away from the label; a value tag rides on the free end.
/** A strip cut square at its taped base and torn along its free end. The torn profile depends only on the strip's height, so it never shimmers while the strip grows. */
const barShape = (ar: boolean): ShapeFn => (w, h, id): Shape => {
  const r = rng(`${id}:bar`);
  const n = Math.max(4, Math.round(h / 6));
  let v = 0, drift = 0;
  const face = Array.from({length: n + 1}, () => { v = v * 0.5 + (r() * 2 - 1) * 5; drift = drift * 0.9 + (r() * 2 - 1) * 1.3; return v + drift + 6; });
  const out = Array.from({length: n + 1}, () => 8 + r() * 3);
  const base = ar ? w : 0, free = (k: number, extra = 0) => (ar ? face[k] - extra : w - face[k] + extra);
  const tear = (extra: boolean): Pt[] => Array.from({length: n + 1}, (_, i) => n - i).map(k => [free(k, extra ? out[k] : 0), (h * k) / n] as Pt);
  const hairs: [Pt, Pt][] = [];
  face.forEach((_, k) => {
    if (k % 2 || r() > 0.7) return;
    const len = 8 + r() * 16, y = (h * k) / n, x = free(k);
    hairs.push([[x + (ar ? 2 : -2), y], [x + (ar ? -len : len), y + (r() * 2 - 1) * 6]]);
  });
  const corners = (): Pt[] => [[base, 0], [base, h]];
  return {pts: [...corners(), ...tear(false)], fringe: [...corners(), ...tear(true)], fringeColor: '#EFEADA', hairs, edgeColor: 'rgba(140,120,85,0.5)'};
};

const LABEL_MAX_W = 360, LABEL_PAD = 64;

const Bars: React.FC<{d: V<'bars'>}> = ({d}) => {
  const f = useCurrentFrame();
  const shown = useDesignText();
  const {copy} = useKit();
  const n = d.bars.length, max = d.max ?? Math.max(1, ...d.bars.map(b => b.value));
  const head = useHeadPlan(d.label, {width: headWidth(d), size: n > 3 ? 92 : 112, min: 80, lines: 2});
  const unit = planUnit(d.unit);
  // The unit rides beside the last headline strip when there is room; otherwise it hangs below the bars.
  const lastStrip = head ? stripBox(head, head.lines.length - 1, 0, headRight(d)) : null;
  const unitBeside = !!(unit && lastStrip && lastStrip.left - 24 - unit.w >= X0 + 10);
  const decimals = Math.max(...d.bars.map(b => decimalsOf(b.value)));
  const headH = head ? head.height + HEAD_GAP : 0, unitH = unit && !unitBeside ? UNIT_OVERHANG + 10 : 0;
  const avail = ZONE_BOTTOM - ZONE_TOP - headH - unitH;
  const rowGap = Math.round(clamp(avail / n * 0.12, 14, 34)), T = Math.round(clamp(avail / n - rowGap, 56, n === 1 ? 330 : n === 2 ? 230 : 190));
  const stackH = n * T + (n - 1) * rowGap;
  const top0 = centred(headH + stackH + unitH), y0 = top0 + headH;
  // One label size for every row: one line when it fits at a good size, otherwise two lines.
  const labelWidth = LABEL_MAX_W - LABEL_PAD;
  const labelAt = (text: string) => {
    const one = oneLine(text, BODY, 800, {width: labelWidth, size: clamp(T * 0.5, 34, 62), min: 34});
    if (one && (T < 100 || one.size >= 44)) return one;
    const two = fit(text, {width: labelWidth, size: clamp((T - 16) / 2.5, 30, 62), min: 30, lines: 2, weight: 800, family: BODY, lh: 1.25});
    return {size: two.size, lines: two.lines, box: two.box};
  };
  const firstPass = d.bars.map(b => labelAt(b.label));
  const labelSize = Math.min(...firstPass.map(l => l.size));
  const labels = d.bars.map((b, i) => (firstPass[i].size === labelSize ? firstPass[i] : fit(b.label, {width: labelWidth, size: labelSize, min: labelSize, lines: 2, weight: 800, family: BODY, lh: 1.25})));
  const colW = Math.round(clamp(Math.max(...labels.flatMap(l => l.lines.map(line => textW(line, BODY, labelSize, 800)))) + LABEL_PAD, 150, LABEL_MAX_W));
  const tagFont = Math.round(clamp(T * 0.82, 44, 220));
  const tagW = (b: {value: number}) => Math.round(textW(shown(fixed(b.value, decimals)), LAT, tagFont, 700)) + 60;
  const baseX = X1 - colW + 22;
  const lengthMax = baseX - X0 - (Math.max(...d.bars.map(tagW)) - 4);
  const originX = copy.ar ? baseX : W - baseX;
  return <>
    {head ? <StripHeadline plan={head} top={top0} at={0} id="br-h" right={headRight(d)}/> : null}
    {unit && unitBeside && lastStrip && head ? <UnitSlip plan={unit} right={lastStrip.left - 24} top={top0 + lastStrip.top + (head.ph - UNIT_H) / 2} at={20} id="br-unit" rot={-2}/> : null}
    {d.bars.map((b, i) => {
      const y = y0 + i * (T + rowGap), start = 8 + i * 8, p = ramp(f, start + 6, 30, OUT3);
      const L = Math.max(14, Math.round(lengthMax * b.value / max)), tone = BAR_FILLS[i % 3];
      const tw = tagW(b), endX = baseX - L * p, grown = start + 36;
      return <React.Fragment key={i}>
        {d.max !== undefined ? <Piece id={`br-track-${i}`} x={X0} y={y} w={baseX - X0} h={T} color="#DCD8C9" shape={rectShape(0, 1.6, 120)} enter={{at: start, from: [0, -40], dur: 12, rot: 0}} depth={0.15} z={2} tight/> : null}
        <div style={{position: 'absolute', inset: 0, transformOrigin: `${originX}px 0`, transform: `scaleX(${Math.max(0.001, p)})`, zIndex: 3}}>
          <Piece id={`br-bar-${i}`} x={baseX - L} y={y} w={L} h={T} rot={i % 2 ? 0.5 : -0.4} color={tone} shape={barShape(copy.ar)} enter={{at: start, from: [0, -80], dur: 13, rot: 0}} depth={0.7}/>
        </div>
        <Piece id={`br-label-${i}`} x={X1 - colW} y={y - 4} w={colW} h={T + 8} rot={i % 2 ? 1 : -1.2} color={C.card} shape={rectShape(7)} enter={{at: start - 2, from: [260, -50], dur: 14}} depth={0.7} z={8}>
          <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: copy.dir, fontFamily: BODY, fontWeight: 800, fontSize: labelSize,
            lineHeight: `${Math.round(labelSize * 1.25)}px`, color: C.ink, whiteSpace: 'nowrap'}}>{labels[i].lines.map((line, j) => <div key={j}>{line}</div>)}</div>
          {T >= 90 || n <= 3 ? <Tape cx={colW - 46} cy={8} len={88} h={38} rot={34} at={start + 14} id={`br-lt-${i}`}/> : null}
        </Piece>
        <Piece id={`br-tag-${i}`} x={endX + 4 - tw} y={y + 2} w={tw} h={T - 4} rot={i % 2 ? -1.6 : 1.8} color={C.card} shape={rectShape(6)} enter={{at: start + 6, from: [0, -60], dur: 12}} depth={0.7} z={10}>
          <div data-count-progress={p} style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'ltr'}}>
            <CutNumeral text={fixed(b.value * p, decimals)} size={tagFont} color={tone === C.mustard ? C.ink : tone} lift={0}/>
          </div>
        </Piece>
        {T >= 90 ? <Tape cx={endX + 4} cy={y + T / 2} len={Math.min(130, Math.round(T * 0.8))} h={40} rot={84} at={grown} id={`br-gt-${i}`}/> : null}
      </React.Fragment>;
    })}
    {unit && !unitBeside ? <UnitSlip plan={unit} right={X1 - 40} top={y0 + stackH + 8} at={64} id="br-unit"/> : null}
  </>;
};

// ---------- ring ----------
// A paper ring: a cream track with terra arcs flying in around it until they reach value / max (the last arc is mustard), and the number cut from paper in a teal disc.

const sector = (a0: number, a1: number, rIn: number, dir: number): ((w: number, h: number) => Pt[]) => (w, h) => {
  const c = w / 2, rOut = c, steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 3));
  const at = (a: number, r: number): Pt => [c + r * Math.sin((a * dir * Math.PI) / 180), h / 2 - r * Math.cos((a * dir * Math.PI) / 180)];
  return [...Array.from({length: steps + 1}, (_, i) => at(a0 + ((a1 - a0) * i) / steps, rOut)), ...Array.from({length: steps + 1}, (_, i) => at(a1 - ((a1 - a0) * i) / steps, rIn))];
};

/** The cream track: one paper annulus, drawn as an even-odd path so the hole shows the sheet. */
const Track: React.FC<{cx: number; cy: number; R: number; r: number}> = ({cx, cy, R, r}) => {
  const f = useCurrentFrame();
  const k = ramp(f, 2, 14, OUT3);
  const rand = rng('rg-track');
  const circle = (rad: number, seed: number): Pt[] => Array.from({length: 72}, (_, i) => { const a = (i / 72) * Math.PI * 2; const j = (rand() * 2 - 1) * seed; return [R + (rad + j) * Math.sin(a), R - (rad + j) * Math.cos(a)] as Pt; });
  const path = (pts: Pt[]) => `M${pstr(pts).replace(/ /g, ' L')} Z`;
  const d = `${path(circle(R - 2, 1.6))} ${path(circle(r, 1.6))}`;
  const [cr, cg, cb] = hexRgb(C.card);
  return <div style={{position: 'absolute', left: cx - R, top: cy - R, width: 2 * R, height: 2 * R, zIndex: 2, opacity: k, transform: `translateY(${(1 - k) * -90}px) scale(${1 + 0.05 * (1 - k)})`, filter: shadowFilter(0, 0.8)}}>
    <svg width={2 * R} height={2 * R} viewBox={`0 0 ${2 * R} ${2 * R}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <path d={d} fill={`rgb(${cr},${cg},${cb})`} fillRule="evenodd"/>
      <path d={d} fill="#fff" fillRule="evenodd" filter="url(#rs-tooth)" style={{mixBlendMode: 'overlay'}} opacity={0.3}/>
    </svg>
  </div>;
};

const Ring: React.FC<{d: V<'ring'>}> = ({d}) => {
  const f = useCurrentFrame();
  const shown = useDesignText();
  const {copy} = useKit();
  const head = useHeadPlan(d.label, {width: headWidth(d), size: 108, min: 80, lines: 2});
  const unit = planUnit(d.unit);
  const decimals = decimalsOf(d.value), share = d.value / d.max;
  const headH = head ? head.height - 90 : 0, unitH = unit ? UNIT_OVERHANG : 0;
  const diameter = Math.floor(Math.min(820, ZONE_BOTTOM - ZONE_TOP - headH - unitH));
  const R = diameter / 2, thick = Math.round(diameter * 0.16), r = R - thick;
  const top0 = centred(headH + diameter + unitH), ringTop = top0 + headH, cx = W / 2, cy = ringTop + R;
  const dir = copy.ar ? -1 : 1;
  const total = share * 360, pieces = share <= 0 ? 0 : Math.max(share >= 0.999 ? 9 : 1, Math.ceil(total / 40)), span = total / Math.max(1, pieces);
  const roll = ramp(f, 12, 36, COUNT);
  const disc = r - 10, inner = disc * 2;
  const perSize = textW(shown(fixed(d.value, decimals)), LAT, 100, 700) / 100;
  const slash = d.max !== 100;
  const size = Math.floor(Math.min(330, (inner * 0.8) / perSize, inner * (slash ? 0.42 : 0.5)));
  const punch = 1 + 0.05 * Math.max(0, 1 - Math.abs(f - 58) / 6) * (f >= 56 ? 1 : 0);
  return <>
    {head ? <StripHeadline plan={head} top={top0} at={0} id="rg-h" right={headRight(d)}/> : null}
    <Track cx={cx} cy={cy} R={R} r={r}/>
    {Array.from({length: pieces}, (_, i) => {
      const a0 = i * span + (pieces > 1 ? 0.8 : 0), a1 = (i + 1) * span - (pieces > 1 ? 0.8 : 0), mid = ((a0 + a1) / 2) * dir * Math.PI / 180;
      return <Piece key={i} id={`rg-arc-${i}`} x={cx - R} y={cy - R} w={2 * R} h={2 * R} rot={(i % 2 ? 1 : -1) * 0.8} color={i === pieces - 1 && pieces > 1 ? C.mustard : C.terra} shape={polyShape(sector(a0, a1, r + 2, dir), 1.1)}
        enter={{at: 10 + Math.round((i * 26) / Math.max(1, pieces)), from: [Math.sin(mid) * 190, -Math.cos(mid) * 190], rot: i % 2 ? 9 : -9, dur: 15, arc: 0.06}} depth={0.5} z={4 + i}/>;
    })}
    <Piece id="rg-disc" x={cx - disc} y={cy - disc} w={2 * disc} h={2 * disc} color={C.teal} shape={polyShape((w, h) => Array.from({length: 56}, (_, i) => [w / 2 + (w / 2) * Math.cos((i / 56) * Math.PI * 2), h / 2 + (h / 2) * Math.sin((i / 56) * Math.PI * 2)] as Pt), 1.4)}
      enter={{at: 6, from: [0, -200], dur: 17, rot: 6}} depth={0.7} z={3}>
      <div data-count-progress={roll} style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'ltr', opacity: ramp(f, 14, 6), transform: `scale(${punch})`}}>
        <CutNumeral text={fixed(d.value * roll, decimals)} size={size} color={C.card} lift={roll < 1 ? 1 : 0}/>
        {slash ? <CutNumeral text={`/ ${d.max}`} size={Math.round(size * 0.3)} color={C.mustard} style={{marginTop: Math.round(size * 0.04)}}/> : null}
      </div>
    </Piece>
    <Tape cx={cx - R * 0.72} cy={cy - R * 0.72} len={170} h={54} rot={-40} at={34} id="rg-t1"/>
    <Tape cx={cx + R * 0.72} cy={cy + R * 0.72} len={170} h={54} rot={-40} at={40} id="rg-t2"/>
    {unit ? <UnitSlip plan={unit} right={Math.round(cx + Math.min(unit.w, 640) / 2)} top={cy + R - 34} at={62} id="rg-unit"/> : null}
  </>;
};
