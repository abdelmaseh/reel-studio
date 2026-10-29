// magazine-interview figures: numbers typeset as a premium print page.
// counter: navy page, two-weight headline, giant thin numeral. slot: a printed departures board of tall thin columns.
// bars: an editorial chart on a cream page. ring: a hairline gold gauge.
import React from 'react';
import {Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import type {FiguresData} from '../../../creative-kit/figures/schema';
import {slotDigitStrings, slotPosition} from '../../../creative-kit/figures/timing';
import {SceneStickerSlot} from '../../../creative-kit/sticker-view';
import {useDesignText} from '../../../style-kit/digits';
import {CREAM, NAVY, THIN, HEAVY, SUF_TOP, W, X0, X1, CW, Diamond, Headline, Mask, Rule, MagazineScope, clamp01, ramp, useMagazine, useType} from './kit';
import {DiamondLine, PlainPage, Settled, balancedLines, decimalsOf, headBox, useFormat, type HeadBox} from './family-parts';

type Of<V extends FiguresData['variant']> = Extract<FiguresData, {variant: V}>;
const settle = Easing.bezier(0.2, 0.7, 0.2, 1);
const TOP = 296, BOTTOM = 1150;

// ---------- counter ----------

const Counter: React.FC<{d: Of<'counter'>; head: HeadBox}> = ({d, head}) => {
  const f = useCurrentFrame();
  const {copy, font} = useMagazine();
  const {wid, planHeadline} = useType();
  const fmt = useFormat();
  const th = NAVY;
  const from = d.from ?? 0, dec = Math.max(decimalsOf(d.value), decimalsOf(from));
  const final = fmt(d.value, dec);
  const plan = d.label ? planHeadline(d.label, {max: 124, min: 64, lines: 3, width: head.width, maxHeight: 372}) : null;
  const headH = plan ? plan.height : 0, headGap = plan ? 44 : 0;
  const tail = d.unit ? 36 + 2 + 26 + 68 : 0;
  let S = 520;
  while (S > 200 && wid(final, S, THIN) > CW - 8) S -= 4;
  S = Math.min(S, Math.floor((BOTTOM - TOP - headH - headGap - tail) / 0.82));
  const boxH = Math.round(S * 0.82);
  const y0 = TOP + Math.max(0, BOTTOM - TOP - (headH + headGap + boxH + tail)) * 0.42;
  const numTop = y0 + headH + headGap, ruleTop = numTop + boxH + 36;
  const roll = ramp(f, 18, 58, settle);
  const numW = wid(final, S, THIN) + 6;
  const shownValue = fmt(from + (d.value - from) * roll, dec);
  return <PlainPage th={th}>
    {plan ? <Headline plan={plan} th={th} top={y0} at={4} right={head.right} width={head.width}/> : null}
    <div style={{position: 'absolute', top: numTop, [copy.side]: W - X1, width: CW, height: boxH, direction: 'ltr', display: 'flex', justifyContent: copy.ar ? 'flex-end' : 'flex-start', alignItems: 'flex-start',
      opacity: clamp01(ramp(f, 10, 14) * 1.6), transform: `translateY(${(1 - ramp(f, 10, 26)) * 36}px)`}}>
      <div data-count-progress={roll} style={{width: numW, fontFamily: font, fontWeight: THIN, fontSize: S, lineHeight: `${S}px`, marginTop: -S * 0.12, marginRight: copy.ar ? -S * 0.03 : 0, color: th.ink, whiteSpace: 'nowrap', textAlign: copy.ar ? 'right' : 'left'}}>{shownValue}</div>
    </div>
    {d.unit ? <>
      <Rule top={ruleTop} width={CW} at={64} dur={28} color={th.gold}/>
      <DiamondLine text={d.unit} top={ruleTop + 28} at={78} th={th} color={th.ink}/>
    </> : null}
  </PlainPage>;
};

// ---------- slot ----------

const STRIP = 44, FOOT = 104;

const Slot: React.FC<{d: Of<'slot'>; head: HeadBox}> = ({d, head}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {font} = useMagazine();
  const {wid, planHeadline} = useType();
  const shown = useDesignText();
  const th = NAVY;
  const {to, from} = slotDigitStrings(d.value, d.from);
  const n = to.length;
  const plan = d.label ? planHeadline(d.label, {max: 116, min: 64, lines: 3, width: head.width}) : null;
  const headH = plan ? plan.height : 0, headGap = plan ? 56 : 0;
  const foot = d.unit ? FOOT : 0;
  const cellW = Math.min(300, Math.floor(CW / n));
  const widest = Math.max(...'0123456789'.split('').map(c => wid(shown(c), 100, THIN)));
  const F = Math.min(480, Math.floor(100 * cellW * 0.8 / widest));
  const rowH = Math.round(F * 1.02);
  const winH = Math.round(rowH * 1.28);
  const boardH = STRIP + winH + foot;
  const y0 = TOP + Math.max(0, BOTTOM - TOP - headH - headGap - boardH) * 0.45;
  const boardTop = y0 + headH + headGap;
  const boardW = cellW * n, boardLeft = Math.round((W - boardW) / 2);
  const draw = ramp(f, 6, 30);
  const winTop = STRIP;
  return <PlainPage th={th}>
    {plan ? <Headline plan={plan} th={th} top={y0} at={4} right={head.right} width={head.width}/> : null}
    <div style={{position: 'absolute', left: boardLeft, top: boardTop, width: boardW, height: boardH, direction: 'ltr'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: winTop, height: winH, background: 'linear-gradient(90deg, rgba(243,199,118,0), rgba(243,199,118,0.07) 20%, rgba(243,199,118,0.07) 80%, rgba(243,199,118,0))', opacity: draw}}/>
      <div aria-label={shown(String(d.value))} style={{position: 'absolute', left: 0, right: 0, top: winTop, height: winH, display: 'flex', opacity: clamp01(ramp(f, 2, 12) * 2)}}>
        {to.split('').map((digit, i) => {
          const pos = slotPosition(Math.max(0, f - 8), i, n, Number(digit), Number(from[i]), fps);
          return <div key={i} style={{position: 'relative', width: cellW, height: winH, overflow: 'hidden', clipPath: 'inset(0)', contain: 'paint', WebkitMaskImage: 'linear-gradient(180deg, transparent 0, #000 20%, #000 80%, transparent 100%)', maskImage: 'linear-gradient(180deg, transparent 0, #000 20%, #000 80%, transparent 100%)'}}>
            <div style={{position: 'absolute', left: 0, right: 0, top: 0, transform: `translateY(${(winH - rowH) / 2 - pos * rowH}px)`}}>
              {Array.from({length: 41}, (_, k) => <div key={k} style={{height: rowH, lineHeight: `${rowH}px`, textAlign: 'center', fontFamily: font, fontWeight: THIN, fontSize: F, color: th.ink}}>{shown(String(k % 10))}</div>)}
            </div>
          </div>;
        })}
      </div>
      {Array.from({length: n}, (_, i) => <Diamond key={i} size={13} color={th.gold} style={{position: 'absolute', left: i * cellW + cellW / 2 - 6.5, top: STRIP / 2 - 6.5, opacity: ramp(f, 10 + i * 3, 12)}}/>)}
      {Array.from({length: n + 1}, (_, i) => {
        const groupEdge = i > 0 && i < n && (n - i) % 3 === 0;
        return <div key={i} style={{position: 'absolute', left: i * cellW - (groupEdge ? 1.5 : 0.75), top: 0, width: groupEdge ? 3 : 1.5, height: (STRIP + winH) * draw, background: th.gold, opacity: i === 0 || i === n ? 0.5 : groupEdge ? 0.95 : 0.55}}/>;
      })}
      <div style={{position: 'absolute', left: 0, top: -1, width: boardW * draw, height: 3, background: th.gold}}/>
      <div style={{position: 'absolute', left: 0, top: STRIP - 0.75, width: boardW * draw, height: 1.5, background: th.gold, opacity: 0.6}}/>
      <div style={{position: 'absolute', left: 0, top: STRIP + winH - 1, width: boardW * draw, height: 3, background: th.gold}}/>
    </div>
    {d.unit ? <DiamondLine text={d.unit} top={boardTop + STRIP + winH + 24} at={64} th={th} color={th.ink} right={W - boardLeft - boardW + 8} width={boardW - 8}/> : null}
  </PlainPage>;
};

// ---------- bars ----------

const Bars: React.FC<{d: Of<'bars'>; head: HeadBox}> = ({d, head}) => {
  const f = useCurrentFrame();
  const {copy, font} = useMagazine();
  const {wid, planHeadline} = useType();
  const fmt = useFormat();
  const th = CREAM;
  const n = d.bars.length;
  const max = d.max ?? Math.max(1, ...d.bars.map(b => b.value));
  const plan = d.label ? planHeadline(d.label, {max: 112, min: 64, lines: 3, width: head.width}) : null;
  const dek = d.unit ? 64 : 0;
  const headBottom = plan ? TOP + plan.height + 26 : head.sticker ? 520 : 316;
  const top = headBottom + dek + (d.unit ? 8 : 14);
  const bottom = 1140;
  const rowH = (bottom - top) / n;
  const stacked = n <= 3;
  const dense = !stacked;
  // sizes: stacked rows put the label above the bar, dense rows put label, bar and value on one line
  const L = stacked ? Math.max(56, Math.min(84, Math.floor(rowH * 0.28))) : Math.max(40, Math.min(58, Math.floor(rowH * 0.47)));
  // stacked values are the hero: up to 200 px, and they only drop below the label's band when a short bar would bring them under it
  const Vbig = Math.max(70, Math.min(200, Math.floor((rowH - 30) / 0.78))), Vsafe = Math.max(70, Math.min(200, Math.floor((rowH - L * 1.3 - 38) / 0.78)));
  const V = stacked ? Vbig : Math.max(48, Math.min(92, Math.floor(rowH * 0.64)));
  const T = stacked ? Math.max(30, Math.min(90, Math.floor(rowH * 0.32))) : Math.max(20, Math.min(30, Math.floor(rowH * 0.24)));
  // dense rows: a label takes as many lines as the row can hold, shrinking before it would touch its neighbour
  const labels = d.bars.map(b => {
    if (!dense) return null;
    const size = Array.from({length: L - 25}, (_, k) => L - k).find(sz => balancedLines(b.label, sz, 800, 440, font).length * Math.round(sz * 1.34) <= rowH - 6) ?? 26;
    return {size, lines: balancedLines(b.label, size, 800, 440, font), box: Math.round(size * 1.34)};
  });
  const Lw = dense ? Math.max(...labels.map(t => Math.max(...t!.lines.map(l => wid(l, t!.size, 800))))) : 0;
  const start = dense ? X1 - Lw - 30 : X1;
  const dec = d.bars.map(b => decimalsOf(b.value));
  const valW = Math.max(...d.bars.map((b, i) => wid(fmt(b.value, dec[i]), V, THIN))) + 28;
  const trackW = start - X0 - valW;
  return <PlainPage th={th}>
    {plan ? <Headline plan={plan} th={th} top={TOP} at={2} marker markerAt={36} right={head.right} width={head.width}/> : null}
    {d.bars.map((b, i) => {
      const at = 12 + i * 9;
      const k = ramp(f, at, 22), grow = ramp(f, at + 8, 40, settle), line = ramp(f, at + 2, 26);
      const len = trackW * (b.value / max) * grow;
      const y = top + i * rowH;
      const barY = stacked ? y + L * 1.3 + 14 + (rowH - L * 1.3 - 14 - 22 - T) / 2 : y + (rowH - T) / 2;
      const midY = barY + T / 2;
      const Vi = stacked && start - trackW * (b.value / max) - 22 > X1 - wid(b.label, L, 800) - 40 ? Vsafe : V;
      const valueText = fmt(b.value * grow, dec[i]);
      const tipX = start - len;
      const lab = labels[i];
      return <React.Fragment key={i}>
        {i > 0 ? <div style={{position: 'absolute', top: y - 1, [copy.side]: W - X1, width: CW * ramp(f, at - 4, 24), height: 1.5, background: th.gold, opacity: 0.4}}/> : null}
        {stacked
          ? <div data-cue-at={at} data-event-progress={k} style={{position: 'absolute', top: y + 14, [copy.side]: W - X1, direction: copy.dir, display: 'flex', alignItems: 'center', gap: 22}}>
            <Mask h={Math.round(L * 1.3)} pad={Math.round(L * 0.34)} k={k}>
              <div style={{fontFamily: font, fontWeight: HEAVY, fontSize: L, lineHeight: `${Math.round(L * 1.3)}px`, height: Math.round(L * 1.3), color: th.ink, whiteSpace: 'nowrap'}}>{b.label}</div>
            </Mask>
          </div>
          : <div data-cue-at={at} data-event-progress={k} style={{position: 'absolute', top: y + (rowH - lab!.box * lab!.lines.length) / 2, [copy.side]: W - X1, width: Lw, direction: copy.dir}}>
            {lab!.lines.map((l, j) => <Mask key={j} h={lab!.box} pad={Math.round(lab!.size * 0.34)} k={ramp(f, at + j * 6, 22)}>
              <div style={{fontFamily: font, fontWeight: HEAVY, fontSize: lab!.size, lineHeight: `${lab!.box}px`, height: lab!.box, color: th.ink, whiteSpace: 'nowrap', textAlign: copy.align}}>{l}</div>
            </Mask>)}
          </div>}
        <div style={{position: 'absolute', top: midY - 0.75, left: X0, width: Math.max(0, tipX - 22 - wid(valueText, Vi, THIN) - 14 - X0) * line, height: 1.5, background: 'rgba(11,26,44,0.3)'}}/>
        <div style={{position: 'absolute', top: barY, [copy.side]: W - start, width: len, height: T, background: th.gold}}/>
        <div style={{position: 'absolute', top: barY - 8, left: tipX - 4, width: 3, height: T + 16, background: th.gold, opacity: grow > 0.02 ? 1 : 0}}/>
        <div style={{position: 'absolute', top: midY - Vi * 0.5, left: tipX - 22 - 600, width: 600, height: Vi, direction: 'ltr', textAlign: 'right', fontFamily: font, fontWeight: THIN, fontSize: Vi, lineHeight: `${Vi}px`,
          color: th.ink, opacity: clamp01(k * 1.8), whiteSpace: 'nowrap'}}>{valueText}</div>
      </React.Fragment>;
    })}
    {d.unit ? <DiamondLine text={d.unit} top={headBottom} at={14} th={th} size={44}/> : null}
  </PlainPage>;
};

// ---------- ring ----------

const Ring: React.FC<{d: Of<'ring'>; head: HeadBox}> = ({d, head}) => {
  const f = useCurrentFrame();
  const {font} = useMagazine();
  const {wid, fit, planHeadline} = useType();
  const fmt = useFormat();
  const shown = useDesignText();
  const th = NAVY;
  const plan = d.label ? planHeadline(d.label, {max: 108, min: 64, lines: 3, width: head.width}) : null;
  const headH = plan ? plan.height : 0;
  const avail = 1250 - TOP - headH - (plan ? 36 : 0);
  const D = Math.min(720, avail), R = D / 2, track = D - 56;
  const cy = TOP + headH + (plan ? 36 : 0) + D / 2 + (plan ? 0 : Math.max(0, 1250 - TOP - D) * 0.12);
  const cx = W / 2;
  const frac = d.max > 0 ? Math.min(1, d.value / d.max) : 0;
  const dec = decimalsOf(d.value);
  const draw = ramp(f, 16, 62, settle), outer = ramp(f, 4, 30);
  const finalText = fmt(d.value, dec);
  const sfx = d.max === 100 ? '' : '/' + shown(String(d.max));
  const innerW = track * 0.74;
  let S = 360;
  while (S > 120 && wid(finalText, S, THIN) + (sfx ? wid(sfx, S * 0.3, THIN) + 14 : 0) > innerW) S -= 4;
  const r = track / 2, circ = 2 * Math.PI * r;
  const headAngle = -Math.PI / 2 + 2 * Math.PI * frac * draw;
  const unit = d.unit ? fit(d.unit, {width: innerW, size: 44, min: 32, lines: 2, weight: 500}) : null;
  const unitH = unit ? unit.box * unit.lines.length : 0;
  const numBox = Math.round(S * 0.82);
  const blockH = numBox + (unit ? 22 + unitH : 0);
  const blockTop = cy - blockH / 2;
  return <PlainPage th={th}>
    {plan ? <Headline plan={plan} th={th} top={TOP} at={4} right={head.right} width={head.width}/> : null}
    <svg width={W} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <circle cx={cx} cy={cy} r={R - 4} fill="none" stroke={th.gold} strokeOpacity={0.4} strokeWidth={1.5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - outer} transform={`rotate(-90 ${cx} ${cy})`}/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={th.ink} strokeOpacity={0.28} strokeWidth={2} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - outer} transform={`rotate(-90 ${cx} ${cy})`}/>
      {[0, 0.25, 0.5, 0.75].map(t => {
        const a = -Math.PI / 2 + t * 2 * Math.PI;
        return <line key={t} x1={cx + Math.cos(a) * (r - 22)} y1={cy + Math.sin(a) * (r - 22)} x2={cx + Math.cos(a) * (r + 22)} y2={cy + Math.sin(a) * (r + 22)} stroke={th.gold} strokeWidth={2} opacity={outer}/>;
      })}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={th.gold} strokeWidth={13} pathLength={circ} strokeDasharray={`${circ * frac * draw} ${circ}`} transform={`rotate(-90 ${cx} ${cy})`}/>
    </svg>
    <Diamond size={26} color={th.gold} style={{position: 'absolute', left: cx + Math.cos(headAngle) * r - 13, top: cy + Math.sin(headAngle) * r - 13, opacity: ramp(f, 16, 8)}}/>
    <div style={{position: 'absolute', left: cx - innerW / 2, top: blockTop, width: innerW, height: blockH, direction: 'ltr'}}>
      <div style={{height: numBox, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', opacity: clamp01(ramp(f, 12, 14) * 1.6), transform: `translateY(${(1 - ramp(f, 12, 26)) * 30}px)`}}>
        <div data-count-progress={draw} style={{fontFamily: font, fontWeight: THIN, fontSize: S, lineHeight: `${S}px`, marginTop: -S * 0.12, color: th.ink, whiteSpace: 'nowrap'}}>{fmt(d.value * draw, dec)}</div>
        {sfx ? <div style={{fontFamily: font, fontWeight: THIN, fontSize: S * 0.3, lineHeight: `${S * 0.3}px`, marginTop: SUF_TOP * S, marginLeft: 14, color: th.gold}}>{sfx}</div> : null}
      </div>
      {unit ? <div style={{position: 'absolute', left: 0, right: 0, top: numBox + 22, direction: copyDir(unit.lines.join(' '))}}>
        {unit.lines.map((l, j) => <Mask key={j} h={unit.box} pad={Math.round(unit.size * 0.34)} k={ramp(f, 58 + j * 6, 22)}>
          <div style={{fontFamily: font, fontWeight: 500, fontSize: unit.size, lineHeight: `${unit.box}px`, height: unit.box, color: th.ink, textAlign: 'center', whiteSpace: 'nowrap'}}>{l}</div>
        </Mask>)}
      </div> : null}
    </div>
  </PlainPage>;
};
const copyDir = (text: string): 'rtl' | 'ltr' => /\p{Script=Arabic}/u.test(text) ? 'rtl' : 'ltr';

// ---------- entry ----------

export const Figures: React.FC<FamilyDesignProps> = ({scene}) => {
  if (scene.family !== 'figures') return null;
  const d = scene.data, head = headBox(d.sticker);
  return <Settled><MagazineScope data={d}>
    {d.variant === 'counter' ? <Counter d={d} head={head}/> : d.variant === 'slot' ? <Slot d={d} head={head}/> : d.variant === 'bars' ? <Bars d={d} head={head}/> : <Ring d={d} head={head}/>}
    <SceneStickerSlot host="figures" sticker={d.sticker} ink={d.variant === 'bars' ? CREAM.ink : NAVY.ink}/>
  </MagazineScope></Settled>;
};
