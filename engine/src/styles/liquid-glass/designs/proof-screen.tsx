// liquid-glass «proof-screen»: the page is one big glass device. Blocks are frosted inner cards that build with a blur-to-sharp stagger,
// the camera follows its path to the focus block, and the lens (this scene only) lands on that block: a glass capsule shaped to the block that shows
// only that block, magnified, while the rest of the page dims and the block's rim lights cyan.
import React from 'react';
import {Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useProbe} from '../../../core/safe';
import {useDesignText} from '../../../style-kit/digits';
import {proofCameraAt, proofFocusFrame} from '../../../creative-kit/proof-screen/timing';
import type {ProofBlock, ProofScreenData} from '../../../creative-kit/proof-screen/schema';
import {isArabic} from '../../../core/type';
import type {FamilyDesignProps} from '../../family-designs';
import {C, DIM, GLOW, MONO, RIM_MASK, clamp01, mix, ramp, soft, rgba, widthOf, fit, glideEase, Glass, Orb, DesignScene, instrumentFont, useLensVisible, type BodyProps} from './kit';
import {ZONE, Settled, enter, decimalsOf, plain, numberFont, fitNumber, type GlassScope} from './family-parts';

type ProofD = ProofScreenData & GlassScope;
type Mode = 'wide' | 'tile' | 'bubble';
type Lines = ReturnType<typeof fit>;
/** A placed block. `x` counts from the start edge of the page (the right edge in Arabic). */
type Item = {i: number; block: ProofBlock; x: number; y: number; w: number; h: number; mode: Mode; main?: Lines; label?: Lines; numSize?: number; numText?: string; valueW?: number};

// The device is 930 px wide and fills the zone; the screen inside it is a clipped viewport onto a longer page.
const DEVICE = {x: 75, y: ZONE.top, w: 930, h: ZONE.bottom - ZONE.top, r: 58};
const CHROME_H = 104;
const SCREEN = {x: 22, w: 886, top: CHROME_H, h: DEVICE.h - CHROME_H - 20};
const PW = 820, VIEW_PAD = 30, GAP = 18, PAD = 30, PAD_V = 26;
const PAGE_LEFT = DEVICE.x + SCREEN.x + (SCREEN.w - PW) / 2;
const SIZE = {heading: 64, text: 38, label: 38, number: 92, value: 56, button: 46, bubble: 40, caption: 34};
const ROLL = (t: number) => 1 - (1 - t) ** 3;
/** The lens may use the frame from the 65 px side margins and from y 275 down to y 1235 (the caption band starts 90 px below). */
const LENS_BOX = {left: 65, right: 1015, top: 275, bottom: 1235};
const LENS_PAD = 28;

const radiusOf = (it: Item) => it.block.kind === 'button' ? it.h / 2 : it.mode === 'tile' ? 46 : it.mode === 'bubble' ? 40 : 36;

// ---------- layout ----------
const place = (d: ProofD, b: ProofBlock, i: number, avail: number, mode: Mode, k: number): Omit<Item, 'x' | 'y'> => {
  const lines = (text: string, weight: number, size: number, width: number, lh: number) => fit(text, d.font, weight, width, {size, min: size, lines: 12}, lh);
  const inner = avail - 2 * PAD, bubble = mode === 'bubble';
  const base = {i, block: b, mode};
  if (b.kind === 'heading' || b.kind === 'text') {
    const main = lines(b.text, b.kind === 'heading' ? 700 : 500, (b.kind === 'heading' ? SIZE.heading : bubble ? SIZE.bubble : SIZE.text) * k, inner, b.kind === 'heading' ? 1.3 : 1.5);
    return {...base, w: bubble ? Math.min(avail, Math.ceil(main.width) + 2 * PAD) : avail, h: main.lines.length * main.box + 2 * PAD_V, main};
  }
  if (b.kind === 'button') {
    const main = lines(b.text, 700, SIZE.button * k, avail - 190, 1.25);
    return {...base, w: Math.min(avail, Math.ceil(main.width) + 190), h: main.lines.length * main.box + 62, main};
  }
  if (b.kind === 'image') return {...base, w: bubble ? Math.min(avail, 580) : avail, h: Math.round(300 * Math.min(k, 1.25))};
  const dec = b.value === undefined ? 0 : decimalsOf(b.value), numText = b.value === undefined ? '' : plain(b.value, dec);
  if (b.kind === 'row') {
    const valueSize = SIZE.value * k * 0.9, valueW = b.value === undefined ? 0 : Math.ceil(widthOf(numText, MONO, valueSize, 600)) + 64;
    const main = lines(b.text, 500, SIZE.text * 1.05 * k, inner - valueW - (valueW ? 28 : 0), 1.4);
    return {...base, w: avail, h: Math.max(main.lines.length * main.box, valueW ? valueSize * 1.2 : 0) + 2 * PAD_V, main, numText, numSize: valueSize, valueW};
  }
  if (mode === 'tile') {
    const numSize = fitNumber(numText, MONO, inner, Math.min(150, SIZE.number * 1.2 * k), 54, 600).fontSize;
    const label = b.text ? lines(b.text, 600, SIZE.label * 0.95 * k, inner, 1.3) : undefined;
    return {...base, w: avail, h: numSize * 1.15 + (label ? 10 + label.lines.length * label.box : 0) + 2 * PAD_V, label, numText, numSize};
  }
  const numSize = fitNumber(numText, MONO, inner * (b.text ? 0.46 : 1), SIZE.number * k, 54, 600).fontSize, numW = Math.ceil(widthOf(numText, MONO, numSize, 600));
  const label = b.text ? lines(b.text, 600, SIZE.label * k, inner - numW - 36, 1.3) : undefined;
  return {...base, w: bubble ? Math.min(avail, numW + (label ? Math.ceil(label.width) + 36 : 0) + 2 * PAD) : avail, h: Math.max(numSize * 1.15, label ? label.lines.length * label.box : 0) + 2 * PAD_V, label, numText, numSize};
};

const layoutAt = (d: ProofD, k: number) => {
  const items: Item[] = [], n = d.blocks.length;
  let y = 0;
  const push = (it: Omit<Item, 'x' | 'y'>, x: number, h = it.h) => { items.push({...it, x, y, h}); };
  if (d.page === 'dashboard') {
    const colW = (PW - GAP) / 2;
    for (let i = 0; i < n;) {
      const b = d.blocks[i], next = d.blocks[i + 1];
      if (b.kind === 'stat' && next?.kind === 'stat') {
        const a = place(d, b, i, colW, 'tile', k), c = place(d, next, i + 1, colW, 'tile', k), h = Math.max(a.h, c.h);
        push(a, 0, h); push(c, colW + GAP, h); y += h + GAP; i += 2;
      } else { const a = place(d, b, i, PW, 'wide', k); push(a, (PW - a.w) / 2); y += a.h + GAP; i += 1; }
    }
  } else if (d.page === 'chat') {
    d.blocks.forEach((b, i) => { const a = place(d, b, i, 600, 'bubble', k); push(a, i % 2 === 0 ? 0 : PW - a.w); y += a.h + GAP; });
  } else {
    d.blocks.forEach((b, i) => { const a = place(d, b, i, PW, 'wide', k); push(a, (PW - a.w) / 2); y += a.h + GAP; });
  }
  return {items, height: y - GAP};
};

const geoCache = new Map<string, ReturnType<typeof computeGeo>>();
/** The largest type scale (up to 1.5) at which the whole page fits the screen; a longer page stays at 1 and the camera scrolls it. */
const computeGeo = (d: ProofD) => {
  const room = SCREEN.h - 2 * VIEW_PAD;
  let k = 1.5, layout = layoutAt(d, k);
  while (layout.height > room && k > 1) { k = Math.max(1, +(k - 0.05).toFixed(2)); layout = layoutAt(d, k); }
  const fits = layout.height <= room;
  const focus = layout.items[Math.min(d.focus ?? 0, layout.items.length - 1)];
  const offsetY = fits ? (SCREEN.h - layout.height) / 2 : VIEW_PAD;
  const centreY = offsetY + focus.y + focus.h / 2;
  const maxScroll = Math.max(0, offsetY + layout.height + VIEW_PAD - SCREEN.h);
  let scroll = fits ? 0 : Math.max(0, Math.min(centreY - SCREEN.h / 2, maxScroll));
  // A longer page never leaves a block half cut under the chrome: it is either shown whole or scrolled out.
  const edge = scroll + 40, cut = fits ? undefined : layout.items.find(it => it !== focus && offsetY + it.y < edge && offsetY + it.y + it.h > edge);
  if (cut) {
    const top = offsetY + cut.y, bottom = top + cut.h;
    const snapped = Math.max(0, Math.min((bottom - edge) / cut.h < 0.5 ? bottom - 6 : top - 16, maxScroll));
    if (Math.abs(centreY - snapped - SCREEN.h / 2) <= SCREEN.h / 2 - 110) scroll = snapped;
  }
  // The lens is the block magnified plus padding. It is never moved off the block: when it would leave its box, the camera moves the page instead.
  const S = Math.max(1.1, Math.min(1.25, 942 / focus.w)), lensW = Math.min(LENS_BOX.right - LENS_BOX.left, focus.w * S + 2 * LENS_PAD), lensH = focus.h * S + 2 * LENS_PAD;
  const canvasY = (sc: number) => DEVICE.y + SCREEN.top + centreY - sc;
  const below = canvasY(scroll) + lensH / 2 - LENS_BOX.bottom, above = LENS_BOX.top - (canvasY(scroll) - lensH / 2);
  if (below > 0) scroll = Math.min(scroll + below, maxScroll + 140);
  else if (above > 0) scroll = Math.max(scroll - above, -90);
  const topS = offsetY, bottomS = offsetY + layout.height, fyS = centreY - scroll;
  const push = d.path === 'focus' ? 1.05 : d.path === 'glide' ? 1.03 : 1;
  // Never push in so far that the page edges leave the screen: the zoom is capped by the room around the focus block.
  const cap = Math.min(1 + 28 / (PW / 2), fits ? (fyS - 14) / Math.max(1, fyS - topS) : 9, fits ? (SCREEN.h - 14 - fyS) / Math.max(1, bottomS - fyS) : 9);
  const bx = d.copy.ar ? PW - (focus.x + focus.w / 2) : focus.x + focus.w / 2;     // focus centre from the left edge of the page
  const lens = {w: lensW, h: lensH, S, r: Math.min(lensH / 2, radiusOf(focus) * S + LENS_PAD), cy: canvasY(scroll),
    cx: Math.max(LENS_BOX.left + lensW / 2, Math.min(LENS_BOX.right - lensW / 2, PAGE_LEFT + bx))};
  // A neighbour the lens covers fades almost away while the lens is on the block, so the lens edge never reads as a cut word.
  const by = focus.y + focus.h / 2, lensLeft = lens.cx - PAGE_LEFT - lens.w / 2;
  const covered = new Set(layout.items.filter(it => {
    const left = d.copy.ar ? PW - (it.x + it.w) : it.x;
    return it !== focus && left < lensLeft + lens.w && left + it.w > lensLeft && it.y < by + lens.h / 2 && it.y + it.h > by - lens.h / 2;
  }).map(it => it.i));
  return {k, items: layout.items, height: layout.height, fits, focus, offsetY, scroll, maxScroll, zoom: Math.max(1, Math.min(push, cap)), bx, by, lens, covered};
};
const proofGeo = (d: ProofD) => {
  const key = [d.font, d.copy.dir, d.page, d.focus, d.path, JSON.stringify(d.blocks)].join('|');
  let g = geoCache.get(key);
  if (!g) { if (geoCache.size > 24) geoCache.clear(); g = computeGeo(d); geoCache.set(key, g); }
  return g;
};

const timeline = (fps: number) => { const pan = proofFocusFrame(fps); return {pan, panDur: 40, appear: pan + 46, arrive: pan + 64, rim: pan + 66, dim: pan + 52}; };

// ---------- blocks ----------
const dirOf = (text: string) => isArabic(text) ? 'rtl' as const : 'ltr' as const;
const TextLines: React.FC<{lines: Lines; font: string; weight: number; color: string; shadow?: string}> = ({lines, font, weight, color, shadow}) =>
  <>{lines.lines.map((line, i) => <div key={i} style={{height: lines.box, lineHeight: `${lines.box}px`, fontFamily: font, fontWeight: weight, fontSize: lines.size, color, whiteSpace: 'nowrap', direction: dirOf(line), textAlign: 'start', textShadow: shadow}}>{line}</div>)}</>;

const Figure: React.FC<{text: string; size: number; weight?: number; color?: string}> = ({text, size, weight, color = '#fff'}) => {
  const family = numberFont(text);
  return <span style={{fontFamily: family, fontWeight: weight ?? (family === MONO ? 600 : 700), fontSize: size, lineHeight: 1.1, color, direction: 'ltr', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
    textShadow: `0 0 ${size * 0.3}px ${rgba(C.cyan, 0.35)}, 0 4px 20px rgba(5,9,22,0.5)`}}>{text}</span>;
};

const BlockView: React.FC<{d: ProofD; it: Item; at: number; focus: boolean; rimAt: number; dimAt: number; dimTo?: number; marked?: boolean}> = ({d, it, at, focus, rimAt, dimAt, dimTo = 0.55, marked = true}) => {
  const f = useCurrentFrame();
  const shown = useDesignText();
  const b = it.block;
  const act = focus ? ramp(f, rimAt, 12) : 0, sweep = focus ? clamp01((f - rimAt) / 24) : 0;
  const roll = ROLL(clamp01((f - at - 6) / 34));
  const me = d.page === 'chat' && it.i % 2 === 1, tile = it.mode === 'tile';
  const radius = radiusOf(it);
  const entry = enter(f, at, {rise: 30, blur: 14}), spot = focus ? 0 : ramp(f, dimAt, 18);
  const placed: React.CSSProperties = {position: 'absolute', [d.copy.side]: it.x, top: it.y, width: it.w, height: it.h, zIndex: focus ? 5 : 1, ...entry, opacity: (entry.opacity as number) * (1 - dimTo * spot)};
  const rim = me ? `linear-gradient(135deg, rgba(190,248,255,0.95), ${rgba(C.cyan, 0.3)} 58%, ${rgba(C.violet, 0.55)})` : 'linear-gradient(135deg, rgba(255,255,255,0.6), rgba(255,255,255,0.08) 58%, rgba(255,255,255,0.22))';
  const fill = me ? `linear-gradient(160deg, ${rgba(C.cyan, 0.34)}, rgba(60,130,255,0.14))` : 'radial-gradient(120% 70% at 14% 0%, rgba(255,255,255,0.14), rgba(255,255,255,0) 55%), linear-gradient(160deg, rgba(255,255,255,0.11), rgba(255,255,255,0.04))';
  const streak = (r: number, strong: boolean) => sweep > 0 && sweep < 1
    ? <div style={{position: 'absolute', inset: 0, borderRadius: r, overflow: 'hidden', pointerEvents: 'none'}}><div style={{position: 'absolute', top: -10, bottom: -10, left: `${mix(-45, 120, sweep)}%`, width: '34%', transform: 'skewX(-20deg)', opacity: Math.sin(Math.PI * sweep),
      background: strong ? 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.85), rgba(255,255,255,0))' : 'linear-gradient(90deg, rgba(190,245,255,0), rgba(190,245,255,0.5), rgba(255,255,255,0.7), rgba(190,245,255,0.5), rgba(190,245,255,0))'}}/></div> : null;
  const content = (() => {
    if ((b.kind === 'heading' || b.kind === 'text') && it.main) return <div style={{position: 'absolute', inset: 0, padding: `${PAD_V}px ${PAD}px`}}>
      <TextLines lines={it.main} font={d.font} weight={b.kind === 'heading' ? 700 : 500} color={b.kind === 'heading' ? '#fff' : 'rgba(255,255,255,0.94)'} shadow={b.kind === 'heading' ? GLOW : undefined}/></div>;
    if (b.kind === 'image') return <div style={{position: 'absolute', inset: 10, borderRadius: radius - 10, overflow: 'hidden'}}>
      <Img src={staticFile(b.src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 14%'}}/>
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,9,22,0) 55%, rgba(5,9,22,0.55))'}}/>
      {b.text ? <div style={{position: 'absolute', [d.copy.side]: 16, bottom: 16, maxWidth: '86%', padding: '8px 26px', borderRadius: 40, background: 'rgba(5,9,22,0.55)', boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.3)',
        fontFamily: d.font, fontWeight: 700, fontSize: SIZE.caption, lineHeight: 1.5, color: '#fff', whiteSpace: 'nowrap', direction: dirOf(b.text)}}>{b.text}</div> : null}
    </div>;
    if (b.kind === 'row' && it.main) return <div style={{position: 'absolute', inset: 0, padding: `0 ${PAD}px`, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 28, direction: d.copy.dir}}>
      <div style={{flex: 'none', width: Math.ceil(it.main.width)}}><TextLines lines={it.main} font={d.font} weight={500} color="rgba(255,255,255,0.94)"/></div>
      {b.value !== undefined ? <div style={{width: it.valueW, height: (it.numSize ?? 50) * 1.2, borderRadius: 999, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,9,22,0.5)',
        boxShadow: `inset 0 0 0 1.5px ${rgba(C.cyan, 0.6)}, 0 0 26px ${rgba(C.cyan, 0.2)}`}}><Figure text={shown(plain(b.value * roll, decimalsOf(b.value)))} size={it.numSize ?? 50} color={C.cyan}/></div> : null}
    </div>;
    if (b.kind === 'stat') {
      const value = shown(plain(b.value * roll, decimalsOf(b.value)));
      if (tile) return <div style={{position: 'absolute', inset: 0, padding: `${PAD_V}px ${PAD}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10}}>
        <Figure text={value} size={it.numSize ?? 90}/>
        {it.label ? <div style={{direction: d.copy.dir}}><TextLines lines={it.label} font={d.font} weight={600} color={DIM}/></div> : null}
      </div>;
      return <div style={{position: 'absolute', inset: 0, padding: `0 ${PAD}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 36, direction: d.copy.dir}}>
        {it.label ? <div style={{flex: 'none', width: Math.ceil(it.label.width)}}><TextLines lines={it.label} font={d.font} weight={600} color={DIM}/></div> : null}
        <Figure text={value} size={it.numSize ?? 90}/>
      </div>;
    }
    return null;
  })();
  if (b.kind === 'button' && it.main) return <div data-proof-block={marked ? it.i : undefined} data-proof-focus={marked && focus ? 'true' : undefined} style={placed}>
    <div style={{position: 'absolute', inset: 0, borderRadius: it.h / 2, background: `linear-gradient(180deg, #9CF0FF 0%, ${C.cyan} 46%, #2CC0EA 100%)`,
      boxShadow: `0 22px 50px rgba(0,0,0,0.4), 0 0 ${44 + 40 * act}px ${rgba(C.cyan, 0.38 + 0.3 * act)}, inset 0 2px 0 rgba(255,255,255,0.7), inset 0 -6px 14px rgba(8,90,130,0.35)`}}/>
    {act > 0 ? <div style={{position: 'absolute', inset: -4, borderRadius: it.h / 2 + 4, padding: 4, boxSizing: 'border-box', opacity: act, ...RIM_MASK, background: 'linear-gradient(135deg, #fff, rgba(255,255,255,0.4))'}}/> : null}
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, direction: d.copy.dir}}>
      <span style={{fontFamily: d.font, fontWeight: 700, fontSize: it.main.size, lineHeight: `${it.main.box}px`, color: C.ink, whiteSpace: 'nowrap'}}>{it.main.lines[0]}</span>
      <svg width="40" height="40" viewBox="0 0 100 100" style={d.copy.ar ? undefined : {transform: 'scaleX(-1)'}}><path d="M82 50 L22 50 M48 24 L20 50 L48 76" fill="none" stroke={C.ink} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </div>
    {streak(it.h / 2, true)}
  </div>;
  return <div data-proof-block={marked ? it.i : undefined} data-proof-focus={marked && focus ? 'true' : undefined} style={placed}>
    <div style={{position: 'absolute', inset: 0, borderRadius: radius, background: fill, boxShadow: `0 18px 40px rgba(0,0,0,0.28)${act > 0.01 ? `, 0 0 ${64 * act}px ${rgba(C.cyan, 0.42 * act)}` : ''}`}}/>
    <div style={{position: 'absolute', inset: 0, borderRadius: radius, padding: 1.5, boxSizing: 'border-box', opacity: 1 - act, ...RIM_MASK, background: rim}}/>
    {act > 0.01 ? <div style={{position: 'absolute', inset: 0, borderRadius: radius, padding: 4, boxSizing: 'border-box', opacity: act, ...RIM_MASK, background: `linear-gradient(135deg, ${C.cyan}, ${rgba(C.cyan, 0.35)} 58%, ${rgba(C.violet, 0.7)})`}}/> : null}
    <div style={{position: 'absolute', top: 1, left: radius * 0.8, right: radius * 0.8, height: 1.5, background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.7), rgba(255,255,255,0))'}}/>
    {content}
    {streak(radius, false)}
  </div>;
};

// ---------- the lens ----------
/**
 * A glass capsule (rounded rectangle) the size of the focus block plus 28 px, with the radius of the block. It slides onto the block, then shows only that
 * block, magnified 1.1 to 1.25 times: no neighbour is ever inside it. Rim of refracted light, a cyan rim light and one sweep; corner marks close in on it.
 */
const BlockLens: React.FC<{d: ProofD; g: ReturnType<typeof proofGeo>; t: ReturnType<typeof timeline>}> = ({d, g, t}) => {
  const f = useCurrentFrame();
  const lensOn = useLensVisible();
  const vis = clamp01(soft(f, t.appear));
  if (!lensOn || vis < 0.02) return null;
  const {lens} = g, p = glideEase(clamp01((f - t.appear) / (t.arrive - t.appear))), sweep = clamp01((f - t.arrive - 2) / 24);
  const side = lens.cx > 540 ? -1 : 1, mark = 14 + 36 * (1 - p), r = lens.r;
  const corner = (v: 'Top' | 'Bottom', h: 'Left' | 'Right') => <div style={{position: 'absolute', [v.toLowerCase()]: 0, [h.toLowerCase()]: 0, width: 40, height: 40, borderColor: C.cyan, borderStyle: 'solid', borderWidth: 0,
    [`border${v}Width`]: 4, [`border${h}Width`]: 4, [`border${v}${h}Radius`]: Math.min(r * 0.9, 32), filter: `drop-shadow(0 0 8px ${rgba(C.cyan, 0.9)})`}}/>;
  return <div style={{position: 'absolute', left: lens.cx - lens.w / 2 + side * 150 * (1 - p), top: lens.cy - lens.h / 2 - 70 * (1 - p), width: lens.w, height: lens.h,
    opacity: clamp01(vis * 2), transform: `scale(${1 + 0.3 * (1 - p)})`, filter: p < 0.98 ? `blur(${10 * (1 - p)}px)` : undefined}}>
    <div style={{position: 'absolute', inset: 0, borderRadius: r, boxShadow: `0 36px 80px rgba(0,0,0,0.55), 0 0 ${90 * p}px ${rgba(C.cyan, 0.26)}`}}/>
    <div style={{position: 'absolute', inset: 0, borderRadius: r, overflow: 'hidden', isolation: 'isolate', background: 'linear-gradient(160deg, rgba(26,52,118,0.94), rgba(10,22,64,0.96))'}}>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(70% 90% at 50% 120%, ${rgba(C.cyan, 0.22)}, ${rgba(C.cyan, 0)})`}}/>
      <div style={{position: 'absolute', left: lens.w / 2 - g.bx, top: lens.h / 2 - g.by, width: PW, height: g.height, transformOrigin: `${g.bx}px ${g.by}px`, transform: `scale(${lens.S})`}}>
        <BlockView d={d} it={g.focus} at={0} focus marked={false} rimAt={t.rim} dimAt={t.dim}/>
      </div>
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 8% 0%, rgba(255,255,255,0.2), rgba(255,255,255,0) 52%)'}}/>
      <div style={{position: 'absolute', inset: 0, borderRadius: r, boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.3), inset 0 0 46px ${rgba(C.cyan, 0.3)}`}}/>
      {sweep > 0 && sweep < 1 ? <div style={{position: 'absolute', top: -10, bottom: -10, left: `${mix(-45, 120, sweep)}%`, width: '30%', transform: 'skewX(-20deg)', opacity: Math.sin(Math.PI * sweep),
        background: 'linear-gradient(90deg, rgba(190,245,255,0), rgba(190,245,255,0.5), rgba(255,255,255,0.75), rgba(190,245,255,0.5), rgba(190,245,255,0))'}}/> : null}
    </div>
    <div style={{position: 'absolute', inset: 0, borderRadius: r, padding: 4, boxSizing: 'border-box', ...RIM_MASK, background: `linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.22) 52%, ${rgba(C.cyan, 0.9)})`}}/>
    <div style={{position: 'absolute', inset: -mark}}>
      {corner('Top', 'Left')}{corner('Top', 'Right')}{corner('Bottom', 'Left')}{corner('Bottom', 'Right')}
    </div>
  </div>;
};

// ---------- the device ----------
const Chrome: React.FC<{d: ProofD}> = ({d}) => {
  const f = useCurrentFrame();
  const urlFont = d.url ? instrumentFont(d.url, d.font) : MONO;
  const urlSize = d.url ? fit(d.url, urlFont, 400, 400, {size: 28, min: 16, lines: 1}, 1.2).size : 28;
  const urlW = d.url ? Math.min(492, Math.ceil(widthOf(d.url, urlFont, urlSize, 400)) + 92) : 0;
  const titleW = DEVICE.w - 2 * 36 - (3 * 22 + 2 * 12) - 2 * 28 - (urlW ? urlW : 0);
  const title = d.title ? fit(d.title, d.font, 700, titleW, {size: 44, min: 28, lines: 2}, 1.25) : null;
  const dots = [C.rose, C.violet, C.cyan];
  return <div style={{position: 'absolute', left: 0, top: 0, width: DEVICE.w, height: CHROME_H, borderRadius: `${DEVICE.r}px ${DEVICE.r}px 0 0`, background: 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))',
    boxShadow: 'inset 0 -1.5px 0 rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', gap: 28, padding: '0 36px', direction: d.copy.dir}}>
    <div style={{display: 'flex', gap: 12, flex: 'none', ...enter(f, 4, {rise: 10, blur: 6})}}>{dots.map((c, i) => <div key={i} style={{width: 22, height: 22, borderRadius: 11, background: `radial-gradient(circle at 34% 28%, #fff, ${c} 62%)`, boxShadow: `0 0 14px ${rgba(c, 0.6)}`}}/>)}</div>
    <div style={{flex: 1, minWidth: 0, ...enter(f, 6, {rise: 14, blur: 8})}}>{title ? title.lines.map((line, i) => <div key={i} style={{height: title.box, lineHeight: `${title.box}px`, fontFamily: d.font, fontWeight: 700, fontSize: title.size, color: '#fff', whiteSpace: 'nowrap', textShadow: GLOW}}>{line}</div>) : null}</div>
    {d.url ? <div style={{width: urlW, height: 56, borderRadius: 28, flex: 'none', background: 'rgba(5,9,22,0.45)', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.4), inset 0 0 0 1.5px rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px', direction: 'ltr', ...enter(f, 8, {rise: 14, blur: 8})}}>
      <div style={{width: 12, height: 12, borderRadius: 6, background: C.cyan, boxShadow: `0 0 14px ${C.cyan}`, flex: 'none'}}/>
      <span style={{fontFamily: urlFont, fontWeight: 400, fontSize: urlSize, letterSpacing: urlFont === MONO ? 0.5 : 0, color: DIM, whiteSpace: 'nowrap', direction: dirOf(d.url), minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis'}}>{d.url}</span>
    </div> : null}
    <div style={{position: 'absolute', left: 0, bottom: 0, width: DEVICE.w * ramp(f, 4, 34), height: 3, background: `linear-gradient(90deg, ${rgba(C.cyan, 0)}, ${C.cyan})`, boxShadow: `0 0 16px ${rgba(C.cyan, 0.9)}`, opacity: 1 - ramp(f, 40, 20)}}/>
  </div>;
};

const ProofBody: React.FC<BodyProps> = ({d}) => {
  const data = d as ProofD, f = useCurrentFrame(), {fps} = useVideoConfig(), probe = useProbe();
  const g = proofGeo(data), t = timeline(fps), n = data.blocks.length;
  const path = data.path ?? 'tilt-in';
  const cam = proofCameraAt(f, fps, path, probe !== null), end = proofCameraAt(1e6, fps, path);
  const pan = ramp(f, t.pan, t.panDur, glideEase), zoom = 1 + (g.zoom - 1) * ramp(f, t.pan, t.panDur + 8, glideEase);
  const stagger = Math.min(5, 34 / Math.max(1, n - 1));
  // The viewport fades softly where a longer page continues beyond its edge, so a block never looks cut.
  const scrolled = g.scroll * pan, fadeTop = 18 + 30 * clamp01(scrolled / 60), fadeBottom = 18 + 30 * clamp01((g.maxScroll - scrolled) / 60);
  const mask = `linear-gradient(180deg, transparent 0px, #000 ${fadeTop}px, #000 calc(100% - ${fadeBottom}px), transparent 100%)`;
  return <>
    <Orb x={740} y={DEVICE.y + 300} d={520} at={4}/>
    <div style={{position: 'absolute', inset: 0, perspective: 1900, perspectiveOrigin: '50% 50%'}}>
      <div style={{position: 'absolute', inset: 0, transformOrigin: `540px ${DEVICE.y + DEVICE.h / 2}px`,
        transform: `translate(${cam.x}px, ${cam.y}px) rotateX(${cam.rotateX - end.rotateX}deg) rotateY(${cam.rotateY - end.rotateY}deg) scale(${cam.scale / end.scale})`}}>
        <Glass x={DEVICE.x} y={DEVICE.y} w={DEVICE.w} h={DEVICE.h} r={DEVICE.r} at={2} dark={0.8} thick>
          <Chrome d={data}/>
          <div data-proof-page={data.page} style={{position: 'absolute', left: SCREEN.x, top: SCREEN.top, width: SCREEN.w, height: SCREEN.h, overflow: 'hidden', WebkitMaskImage: mask, maskImage: mask}}>
            <div style={{position: 'absolute', left: (SCREEN.w - PW) / 2, top: 0, width: PW, height: g.height, transformOrigin: `${g.bx}px ${g.by}px`,
              transform: `translateY(${g.offsetY - scrolled}px) scale(${zoom})`}}>
              {g.items.map(it => <BlockView key={it.i} d={data} it={it} at={6 + Math.round(it.i * stagger)} focus={it === g.focus} rimAt={t.rim} dimAt={t.dim} dimTo={g.covered.has(it.i) ? 0.8 : 0.55}/>)}
            </div>
          </div>
        </Glass>
      </div>
    </div>
    <BlockLens d={data} g={g} t={t}/>
  </>;
};

export const ProofScreen: React.FC<FamilyDesignProps> = props => {
  if (props.scene.family !== 'proof-screen') return null;
  return <Settled><DesignScene {...props} tone={3} Body={ProofBody}/></Settled>;
};
