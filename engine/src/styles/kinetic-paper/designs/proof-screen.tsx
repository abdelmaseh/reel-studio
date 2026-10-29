// kinetic-paper proof-screen: the page is a zine printout of the site. A white sheet with a halftone shadow tilts in, the blocks print one by one,
// the camera pushes onto the focus block (and scrolls to it on long pages), then a lime marker, an ink frame and a hand-drawn arrow stamp land on it.
import React from 'react';
import {AbsoluteFill, Easing, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import type {ProofBlock, ProofScreenData} from '../../../creative-kit/proof-screen/schema';
import {proofCameraAt, proofFocusFrame} from '../../../creative-kit/proof-screen/timing';
import {useDesignText} from '../../../style-kit/digits';
import {CARD, INK, LIME, MIS, MONO, PAPER, SANS, W, Ground, SafeWord, Slam, dotTile, ramp, slam, widthOf, useDesign} from './kit';
import {Settled, decimalsOf, fixed, numberPlan, PrintedNumber} from './family-parts';

const SHEET_W = 830, SHEET_X = (W - SHEET_W) / 2, PAD_START = 92, PAD_END = 36, CONTENT_W = SHEET_W - PAD_START - PAD_END;
// The window ends at 1146 so the sheet never reaches the right-hand rail (x >= 853 once y >= 1150).
const WINDOW_TOP = 262, WINDOW_BOTTOM = 1146, WINDOW_H = WINDOW_BOTTOM - WINDOW_TOP, MARGIN = 16;
const BAR_H = 80, BAR_H_BARE = 52, URL_H = 56, BLOCK_GAP = 24, DASH_GAP = 100, COLUMN_W = Math.floor((CONTENT_W - DASH_GAP) / 2), CHAT_W = 640, ARROW = {w: 80, h: 66};
// The page is laid out at the largest type scale that fits; the camera then pushes in by `ZOOM` about the focus block.
const SCALES = [1.5, 1.4, 1.3, 1.2, 1.1, 1, 0.95, 0.9];
const ZOOM = {'tilt-in': 1.08, glide: 1.06, focus: 1.1} as const;

type Fit = ReturnType<ReturnType<typeof useDesign>['fit']>;
type Plan = ReturnType<typeof numberPlan>;
type Spec =
  | {kind: 'heading'; t: Fit}
  | {kind: 'text'; t: Fit; chat: boolean; reply: boolean}
  | {kind: 'stat'; plan: Plan; size: number; slabW: number; slabH: number; label?: Fit; compact: boolean}
  | {kind: 'row'; t: Fit; value?: string; chipW: number; chipSize: number; chipH: number}
  | {kind: 'button'; t: Fit}
  | {kind: 'image'; src: string; caption?: Fit};
/** The lime marker sits behind the words of the focus block: `o` from the start edge of the block, `y` from its top. */
type Mark = {o: number; y: number; w: number; h: number};
/** `o` is the offset from the start edge of the content area (the right edge for Arabic). */
type Placed = {i: number; spec: Spec; mark?: Mark; o: number; y: number; w: number; h: number};
type Ctx = {fit: ReturnType<typeof useDesign>['fit']; canFit: ReturnType<typeof useDesign>['canFit']; HEAD: string; weight: number; shown: (t: string | number) => string};

const measure = (block: ProofBlock, w: number, s: number, page: ProofScreenData['page'], compact: boolean, reply: boolean, ctx: Ctx): {spec: Spec; mark?: Mark; w: number; h: number} => {
  const {fit, canFit, HEAD, weight, shown} = ctx, sz = (n: number) => Math.round(n * s);
  // Body copy is wrapped at the biggest size, then narrowed while the line count holds, so no line ends on a lone word.
  const body = (text: string, width: number, size: number, min = 42, lines = 9) => {
    const o = {size, min, lines, family: SANS, weight: 800, lh: 1.4};
    let best = fit(text, {...o, width});
    if (best.lines.length < 2) return best;
    for (let w = width - 16; w >= width * 0.55; w -= 16) {
      const tight = {...o, size: best.size, min: best.size, lines: best.lines.length, width: w};
      if (!canFit(text, tight)) break;
      best = fit(text, tight);
    }
    return best;
  };
  const value = (v: number) => shown(fixed(v, decimalsOf(v)));
  const span = (t: Fit) => Math.ceil(Math.max(...t.lines.map(line => widthOf(line, t.size, t.family, t.weight)))) + 20;
  switch (block.kind) {
    case 'heading': {
      // A heading stays on one line whenever its type can stay poster-sized.
      const one = {width: w - 16, size: sz(92), min: 64, lines: 1};
      const t = canFit(block.text, one) ? fit(block.text, one) : fit(block.text, {width: w - 16, size: sz(92), min: 60, lines: 3});
      return {spec: {kind: 'heading', t}, mark: {o: 0, y: 4, w: Math.min(w, span(t)), h: t.lines.length * t.box}, w, h: t.lines.length * t.box + sz(10) + 22};
    }
    case 'text': {
      if (page === 'chat') {
        const t = body(block.text, w - 2 * 30 - 10, sz(46));
        const natural = Math.max(...t.lines.map(line => Math.ceil(widthOf(line, t.size, SANS, 800)))) + 2 * 30 + 10;
        return {spec: {kind: 'text', t, chat: true, reply}, mark: {o: 24, y: 23, w: Math.min(natural - 48, span(t)), h: t.lines.length * t.box}, w: Math.min(w, Math.max(natural, 260)), h: t.lines.length * t.box + 36 + 10};
      }
      const t = body(block.text, w - 44, sz(46));
      return {spec: {kind: 'text', t, chat: false, reply}, mark: {o: 22, y: 14, w: Math.min(w - 44, span(t)), h: t.lines.length * t.box}, w, h: t.lines.length * t.box + 28};
    }
    case 'stat': {
      const plan = numberPlan(block.value, block.value, shown, c => widthOf(c, 100, HEAD, weight));
      if (compact) {
        const label = block.text ? fit(block.text, {width: w - 40, size: sz(40), min: 34, lines: 2, family: SANS, weight: 900}) : undefined;
        const size = Math.min((w - 40 - 40) * 100 / plan.total, sz(124)), slabH = Math.round(0.57 * size + 52);
        return {spec: {kind: 'stat', plan, size, slabW: w - 40, slabH, label, compact}, mark: label ? {o: 16, y: 19, w: Math.min(w - 32, span(label)), h: label.lines.length * label.box} : undefined, w, h: 22 + (label ? label.lines.length * label.box + 12 : 0) + slabH + 22 + 10};
      }
      const slabW = block.text ? Math.round(w * 0.46) : w - 44;
      const label = block.text ? fit(block.text, {width: w - slabW - 3 * 22, size: sz(46), min: 38, lines: 3, family: SANS, weight: 900}) : undefined;
      const size = Math.min((slabW - 40) * 100 / plan.total, sz(150)), slabH = Math.round(0.57 * size + 52);
      const h = Math.max(slabH, label ? label.lines.length * label.box : 0) + 44 + 10;
      return {spec: {kind: 'stat', plan, size, slabW, slabH, label, compact}, mark: label ? {o: 27 + slabW + 22, y: (h - label.lines.length * label.box) / 2, w: Math.min(w - slabW - 3 * 22, span(label)), h: label.lines.length * label.box} : undefined, w, h};
    }
    case 'row': {
      const text = block.value === undefined ? undefined : value(block.value), chipSize = sz(62), chipH = sz(86);
      const chipW = text === undefined ? 0 : Math.ceil(widthOf(text, chipSize, HEAD, weight)) + 48;
      const t = body(block.text, w - chipW - 3 * 24 - 10, sz(46), 40, 4);
      const h = Math.max(sz(116), t.lines.length * t.box + 40, chipH + 40) + 10;
      return {spec: {kind: 'row', t, value: text, chipW, chipSize, chipH}, mark: {o: 29, y: (h - t.lines.length * t.box) / 2, w: Math.min(w - chipW - 3 * 24 - 10, span(t)), h: t.lines.length * t.box}, w, h};
    }
    case 'button': {
      const t = fit(block.text, {width: w - 96, size: sz(54), min: 40, lines: 2, family: SANS, weight: 900});
      return {spec: {kind: 'button', t}, w, h: Math.max(sz(116), t.lines.length * t.box + 48)};
    }
    case 'image': {
      const caption = block.text ? fit(block.text, {width: w - 60, size: 34, min: 30, lines: 1, family: SANS, weight: 800}) : undefined;
      return {spec: {kind: 'image', src: block.src, caption}, w, h: sz(300)};
    }
  }
};

/** Stack the blocks at one type scale. `y` counts from the top of the page area, under the browser bar; `height` includes the closing gap. */
const layoutPage = (data: ProofScreenData, s: number, ctx: Ctx) => {
  const placed: Placed[] = [];
  let y = BLOCK_GAP;
  const put = (i: number, o: number, w: number, compact = false, reply = false) => {
    const m = measure(data.blocks[i], w, s, data.page, compact, reply, ctx);
    placed.push({i, spec: m.spec, mark: m.mark, o, y, w: m.w, h: m.h});
    return m;
  };
  if (data.page === 'dashboard') {
    for (let i = 0; i < data.blocks.length;) {
      const stat = (k: number) => data.blocks[k]?.kind === 'stat';
      if (stat(i) && stat(i + 1)) {
        const a = put(i, 0, COLUMN_W, true), b = put(i + 1, COLUMN_W + DASH_GAP, COLUMN_W, true);
        const h = Math.max(a.h, b.h);
        placed[placed.length - 2].h = h; placed[placed.length - 1].h = h;
        y += h + BLOCK_GAP; i += 2;
      } else { y += put(i, 0, CONTENT_W).h + BLOCK_GAP; i += 1; }
    }
  } else {
    data.blocks.forEach((_, i) => {
      const chat = data.page === 'chat', w = chat ? CHAT_W : CONTENT_W;
      const m = put(i, 0, w, false, chat && i % 2 === 1);
      if (chat && i % 2) placed[placed.length - 1].o = CONTENT_W - m.w;
      y += m.h + BLOCK_GAP;
    });
  }
  return {placed, height: y};
};

/** A hand-drawn block arrow that thumps beside the focus block; it points at the block from the start side. */
const ArrowStamp: React.FC<{at: number; flip: boolean}> = ({at, flip}) => {
  const f = useCurrentFrame();
  const s = slam(f, at, 1.8);
  const points = '6,40 40,2 44,27 93,24 91,54 43,51 39,76';
  return <svg data-cue-at={at} width={ARROW.w} height={ARROW.h} viewBox="0 0 96 78" preserveAspectRatio="none" style={{overflow: 'visible', opacity: s.on ? 1 : 0, transform: `translate(${s.dx}px, ${s.dy}px) rotate(${(1 - s.k) * -10 + (flip ? 5 : -5)}deg) scale(${s.scale})`}}>
    <g transform={flip ? 'translate(96 0) scale(-1 1)' : undefined}>
      <polygon points={points} transform={`translate(${-MIS / 2} ${MIS / 2})`} fill={LIME}/>
      <polygon points={points} fill={INK}/>
    </g>
  </svg>;
};

/** The lime marker: a ragged highlighter stroke that sweeps from the start of the words to their end. */
const Marker: React.FC<{mark: Mark; progress: number}> = ({mark, progress}) => {
  const {copy} = useDesign();
  const {w, h} = mark, pad = Math.round(h * 0.08);
  const shape = `polygon(0 ${pad + 5}px, 2% ${pad - 2}px, 45% ${pad + 3}px, 100% ${pad}px, 98.5% ${h - pad - 6}px, 100% ${h - pad + 5}px, 55% ${h - pad - 1}px, 1.5% ${h - pad + 3}px, 0 ${h - pad - 9}px)`;
  const reveal = (1 - progress) * 100;
  return <div style={{position: 'absolute', [copy.side]: mark.o, top: mark.y, width: w, height: h, pointerEvents: 'none', mixBlendMode: 'multiply', clipPath: copy.ar ? `inset(0 0 0 ${reveal}%)` : `inset(0 ${reveal}% 0 0)`, opacity: progress > 0 ? 1 : 0}}>
    <div style={{position: 'absolute', inset: 0, background: LIME, clipPath: shape, transform: 'rotate(-0.5deg)'}}/>
  </div>;
};

/** The halftone shadow sits behind the block, the ink frame draws on over its edge. */
const FrameShadow: React.FC<{w: number; h: number; at: number}> = ({w, h, at}) => {
  const f = useCurrentFrame();
  return <div style={{position: 'absolute', left: 16, top: 16, width: w, height: h, pointerEvents: 'none', backgroundImage: dotTile(4.3 * ramp(f, at + 2, 12, Easing.out(Easing.quad))), backgroundSize: '20px 20px'}}/>;
};
const FrameStroke: React.FC<{w: number; h: number; at: number}> = ({w, h, at}) => {
  const f = useCurrentFrame();
  const draw = ramp(f, at, 9, Easing.out(Easing.quad));
  return <svg width={w + 20} height={h + 20} style={{position: 'absolute', left: -10, top: -10, overflow: 'visible', pointerEvents: 'none'}}>
    <path d={`M ${w + 16} 4 H 4 V ${h + 16} H ${w + 16} Z`} fill="none" stroke={INK} strokeWidth="8" strokeLinejoin="miter" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw}/>
  </svg>;
};

const Body: React.FC<{p: Placed; id: string; flipped: boolean}> = ({p, id, flipped}) => {
  const {copy, HEAD, weight} = useDesign();
  const {spec, w, h} = p;
  const common = {direction: copy.dir, textAlign: copy.align} as const;
  const lines = (t: Fit, color = INK) => t.lines.map((line, k) => <div key={k} style={{height: t.box, lineHeight: `${t.box}px`, whiteSpace: 'pre', color}}>{line}</div>);
  switch (spec.kind) {
    case 'heading': return <div style={{position: 'absolute', inset: 0, ...common, fontFamily: spec.t.family, fontWeight: spec.t.weight, fontSize: spec.t.size, color: INK}}>
      <div style={{padding: '0 8px'}}>{lines(spec.t)}</div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 10, background: INK}}/></div>;
    case 'text': return spec.chat
      ? <div style={{position: 'absolute', inset: 0, background: spec.reply && !flipped ? INK : CARD, border: `5px solid ${INK}`, boxSizing: 'border-box', padding: '18px 30px', ...common, fontFamily: SANS, fontWeight: 800, fontSize: spec.t.size}}>{lines(spec.t, spec.reply && !flipped ? PAPER : INK)}</div>
      : <div style={{position: 'absolute', inset: 0, padding: '14px 22px', boxSizing: 'border-box', ...common, [copy.ar ? 'borderRight' : 'borderLeft']: `8px solid ${INK}`, fontFamily: SANS, fontWeight: 800, fontSize: spec.t.size}}>{lines(spec.t)}</div>;
    case 'stat': {
      const slab = <div style={{position: 'relative', width: spec.slabW, height: spec.slabH, flex: 'none'}}>
        <div style={{position: 'absolute', inset: 0, background: LIME, transform: `translate(${-MIS / 2}px, ${MIS / 2}px)`}}/>
        <PrintedNumber id={`${id}-n`} chars={spec.plan.at(1)} widths={spec.plan.widths} size={spec.size} width={spec.slabW} height={spec.slabH} ht={0}/></div>;
      const label = spec.label ? <div style={{fontFamily: SANS, fontWeight: 900, fontSize: spec.label.size, color: INK}}>{lines(spec.label)}</div> : null;
      return <div style={{position: 'absolute', inset: 0, background: CARD, border: `5px solid ${INK}`, boxSizing: 'border-box', padding: spec.compact ? '14px 16px' : '0 22px', display: 'flex', flexDirection: spec.compact ? 'column' : 'row', alignItems: spec.compact ? 'stretch' : 'center', justifyContent: spec.compact ? 'center' : 'space-between', gap: spec.compact ? 12 : 22, ...common}}>
        {spec.compact ? <>{label}{slab}</> : <>{slab}{label ? <div style={{flex: 1}}>{label}</div> : null}</>}</div>;
    }
    case 'row': return <div style={{position: 'absolute', inset: 0, background: CARD, border: `5px solid ${INK}`, boxSizing: 'border-box', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 24, ...common}}>
      <div style={{flex: 1, fontFamily: SANS, fontWeight: 800, fontSize: spec.t.size, color: INK}}>{lines(spec.t)}</div>
      {spec.value !== undefined ? <div style={{width: spec.chipW, height: spec.chipH, flex: 'none', background: LIME, border: `5px solid ${INK}`, boxSizing: 'border-box', position: 'relative', direction: 'ltr'}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: spec.chipH / 2 - 5 - 0.405 * spec.chipSize, textAlign: 'center', fontFamily: HEAD, fontWeight: weight, fontSize: spec.chipSize, lineHeight: 1, color: INK}}>{spec.value}</div></div> : null}</div>;
    case 'button': return <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: -MIS, top: MIS, width: w, height: h, background: LIME}}/>
      <div style={{position: 'absolute', inset: 0, background: INK, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{position: 'absolute', inset: 9, border: `4px dashed ${PAPER}`, opacity: 0.7}}/>
        <div style={{...common, textAlign: 'center', fontFamily: SANS, fontWeight: 900, fontSize: spec.t.size, color: PAPER}}>{lines(spec.t, PAPER)}</div></div></div>;
    case 'image': return <div style={{position: 'absolute', inset: 0, border: `5px solid ${INK}`, boxSizing: 'border-box', background: PAPER, overflow: 'hidden'}}>
      <Img src={staticFile(spec.src)} style={{width: '100%', height: '100%', objectFit: 'cover'}}/>
      {spec.caption ? <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, background: INK, color: PAPER, padding: '6px 26px', ...common, fontFamily: SANS, fontWeight: 800, fontSize: spec.caption.size}}>
        <SafeWord text={spec.caption.lines[0]} width={w - 62} size={spec.caption.size} weight={800}/></div> : null}</div>;
  }
};

/** Whole rows of blocks, so the crop of a long page always starts and ends on a block boundary. */
const pageRows = (placed: Placed[]) => {
  const rows: {y: number; bottom: number; at: number[]}[] = [];
  for (const p of placed) {
    const row = rows.find(r => r.y === p.y);
    if (row) { row.bottom = Math.max(row.bottom, p.y + p.h); row.at.push(p.i); } else rows.push({y: p.y, bottom: p.y + p.h, at: [p.i]});
  }
  return rows;
};

const Sheet: React.FC<{data: ProofScreenData}> = ({data}) => {
  const {copy, HEAD, weight, fit, canFit} = useDesign();
  const shown = useDesignText();
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const focus = data.focus ?? 0, zoom = ZOOM[data.path ?? 'tilt-in'];
  const chromeH = (data.title ? BAR_H : BAR_H_BARE) + (data.url ? URL_H : 0), room = (WINDOW_H - 2 * MARGIN) / zoom;
  const page = React.useMemo(() => {
    const ctx: Ctx = {fit, canFit, HEAD, weight, shown};
    for (const s of SCALES) { const l = layoutPage(data, s, ctx); if (chromeH + l.height <= room) return l; }
    return layoutPage(data, 1, ctx);
  }, [data, HEAD, copy.ar]);
  const {placed, height} = page;
  const mid = placed.find(p => p.i === focus)!;
  const bx = (o: number, w: number) => copy.ar ? SHEET_W - PAD_START - o - w : PAD_START + o;
  // A page that does not fit scrolls to the focus: the crop starts on the first block that still lets the focus block show whole,
  // and ends on the last whole block that fits, so no block is ever cut by the window edges.
  let pan = 0, viewH = height;
  if (chromeH + height > room) {
    const rows = pageRows(placed), at = rows.findIndex(r => r.at.includes(focus)), avail = room - chromeH;
    const span = (from: number, to: number) => rows[to].bottom + BLOCK_GAP - (rows[from].y - BLOCK_GAP);
    let first = at;
    for (let k = 0; k <= at; k++) if (span(k, at) <= avail) { first = k; break; }
    let last = at;
    while (last + 1 < rows.length && span(first, last + 1) <= avail) last++;
    pan = rows[first].y - BLOCK_GAP; viewH = span(first, last);
  }
  const sheetH = chromeH + viewH, focusY = chromeH + mid.y + mid.h / 2 - pan;
  // The push scales about the focus block, so the sheet is placed where the zoomed page ends up centred in the window.
  const sheetTop = WINDOW_TOP + (WINDOW_H - sheetH * zoom) / 2 + focusY * (zoom - 1);
  const t = Math.max(0, Math.min(1, f / proofFocusFrame(fps))), ease = 1 - (1 - t) ** 3;
  const cam = proofCameraAt(f, fps, data.path, false), end = proofCameraAt(proofFocusFrame(fps), fps, data.path, false), enter = slam(f, 0, 1.08);
  const push = 1 + (zoom - 1) * ramp(f, 8, 24), scroll = pan * ramp(f, 8, 22);
  const marker = ramp(f, 32, 14, Easing.out(Easing.quad)), frameAt = 36, arrowAt = 44, print = Math.min(6, Math.floor(22 / Math.max(1, data.blocks.length - 1)));
  return <div style={{position: 'absolute', inset: 0, perspective: 1800}}>
    <div style={{position: 'absolute', left: SHEET_X, top: sheetTop, width: SHEET_W, height: sheetH, opacity: enter.on ? 1 : 0, transformOrigin: `${bx(mid.o, mid.w) + mid.w / 2}px ${focusY}px`,
      transform: `translate(${cam.x + enter.dx}px, ${cam.y + 44 * (1 - ease) + enter.dy}px) rotateX(${(cam.rotateX - end.rotateX) * 0.6}deg) rotateY(${(cam.rotateY - end.rotateY) * 0.6}deg) rotateZ(${-3.2 * (1 - ease)}deg) scale(${(cam.scale / end.scale) * enter.scale * push})`}}>
      <div style={{position: 'absolute', left: 18, top: 18, width: SHEET_W, height: sheetH, backgroundImage: dotTile(4.3 * ramp(f, 4, 16, Easing.out(Easing.quad))), backgroundSize: '20px 20px'}}/>
      <div style={{position: 'absolute', inset: 0, background: CARD, border: `4px solid ${INK}`, boxSizing: 'border-box', direction: copy.dir}}>
        <div style={{height: data.title ? BAR_H : BAR_H_BARE, background: INK, display: 'flex', alignItems: 'center', gap: 14, padding: '0 28px', color: PAPER}}>
          {[0, 1, 2].map(k => <div key={k} style={{width: 24, height: 24, borderRadius: 12, flex: 'none', border: `4px solid ${PAPER}`, background: k === 0 ? LIME : 'transparent', boxSizing: 'border-box'}}/>)}
          {data.title ? <div style={{flex: 1, marginInlineStart: 12, fontFamily: SANS, fontWeight: 900, fontSize: 40, whiteSpace: 'nowrap', textAlign: copy.align}}><SafeWord text={data.title} width={SHEET_W - 3 * 38 - 130} size={40}/></div> : null}
        </div>
        {data.url ? <div style={{height: URL_H, borderBottom: `4px solid ${INK}`, display: 'flex', alignItems: 'center', gap: 14, padding: '0 28px', boxSizing: 'border-box'}}>
          <div style={{width: 18, height: 18, background: INK, flex: 'none'}}/>
          <div style={{direction: 'ltr', fontFamily: MONO, fontWeight: 600, fontSize: 30, color: INK, whiteSpace: 'nowrap'}}><SafeWord text={data.url} width={SHEET_W - 28 * 2 - 40} size={30} family={MONO} weight={600}/></div></div> : null}
      </div>
      <div style={{position: 'absolute', left: 0, top: chromeH, width: SHEET_W, height: viewH - 4, overflow: 'hidden'}}>
        <div style={{position: 'absolute', inset: 0, transform: `translateY(${-scroll}px)`}}>
          {placed.map(p => {
            const focused = p.i === focus, pop = focused ? slam(f, frameAt, 1.04) : null;
            return <div key={p.i} data-proof-block={p.i} data-proof-focus={focused ? 'true' : undefined} style={{position: 'absolute', left: bx(p.o, p.w), top: p.y, width: p.w, height: p.h, transform: pop?.on ? `translate(${pop.dx}px, ${pop.dy}px) scale(${pop.scale})` : undefined}}>
              {focused ? <Slam at={frameAt} from={1.0} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}><FrameShadow w={p.w} h={p.h} at={frameAt}/></Slam> : null}
              <Slam at={2 + p.i * print} from={1.06} style={{position: 'absolute', inset: 0}}>
                <Body p={p} id={`kp-proof-${p.i}`} flipped={focused && f >= frameAt}/>
                {focused && p.mark ? <Marker mark={p.mark} progress={marker}/> : null}
              </Slam>
              {focused ? <>
                <FrameStroke w={p.w} h={p.h} at={frameAt}/>
                <div style={{position: 'absolute', [copy.side]: -(ARROW.w + 6), top: Math.min(p.h / 2, 78) - ARROW.h / 2}}><ArrowStamp at={arrowAt} flip={!copy.ar}/></div></> : null}
            </div>;
          })}
        </div>
      </div>
    </div>
  </div>;
};

export const ProofScreen: React.FC<FamilyDesignProps> = ({scene}) => {
  const {copy} = useDesign();
  if (scene.family !== 'proof-screen') return null;
  return <Settled><AbsoluteFill style={{direction: copy.dir, textAlign: copy.align}}>
    <Ground/>
    <Sheet data={scene.data}/>
  </AbsoluteFill></Settled>;
};
