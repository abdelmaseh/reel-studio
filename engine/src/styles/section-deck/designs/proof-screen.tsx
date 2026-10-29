// section-deck proof-screen: the page is a white keynote card on the navy ground. Blocks build as big rows, the camera pushes to the focus block,
// and the focus block takes a solid accent bar, a tint and a giant outlined index numeral while the rest of the card dims.
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {measure} from '../../../core/type';
import {useProbe} from '../../../core/safe';
import {useDesignData} from '../../../style-kit/digits';
import type {FamilyDesignProps} from '../../family-designs';
import type {ProofBlock, ProofScreenData} from '../../../creative-kit/proof-screen/schema';
import {proofCameraAt, proofFocusFrame} from '../../../creative-kit/proof-screen/timing';
import {W, Ground, MaskLines, clamp01, fit, mix, ramp} from './kit';
import {GLYPH, GLYPH_DROP, GLYPH_TOP, ZONE_BOTTOM, ZONE_TOP, Settled, decimalsOf, fixed, useDeck, type Deck} from './family-parts';

const CARD_W = 900, CARD_X = (W - CARD_W) / 2, PAD = 56, IW = CARD_W - 2 * PAD, CARD_MIN = 760, CARD_MAX = ZONE_BOTTOM - 20 - ZONE_TOP;
const GAP = 26, VIEW_PAD = 34, COLUMN_GAP = 24, TILE_W = (IW - COLUMN_GAP) / 2;
const MONO = 'IBM Plex Mono';
const INK = '#0A1428', DIM = 'rgba(10,20,40,0.62)', HAIR = 'rgba(10,20,40,0.1)', TINT = 'rgba(10,20,40,0.055)';
/** Blocks that are not in focus step toward these cool greys instead of turning translucent, so nothing looks washed out by accident. */
const GREY = '#9AA3B4', GREY_LABEL = '#B4BBC8', GREY_DARK_FILL = '#E3E7EE', GREY_ON_LIGHT = '#8C95A6', GREY_PILL = '#C4CAD6', NEUTRAL_FILL = '#EDF0F5', NEUTRAL_EDGE = '#C9D0DC';
const lerpHex = (a: string, b: string, t: number) => {
  const rgb = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const [x, y] = [rgb(a), rgb(b)];
  return `rgb(${x.map((v, i) => Math.round(mix(v, y[i], t))).join(',')})`;
};

type Fit = ReturnType<typeof fit>;
type Spec =
  | {kind: 'heading'; text: string; size: number; lines: number; h: number}
  | {kind: 'text'; t: Fit; bubble: boolean; h: number}
  | {kind: 'stat'; value: string; size: number; label?: Fit; tile: boolean; h: number}
  | {kind: 'row'; t: Fit; value?: string; pillW: number; pillSize: number; pillH: number; h: number}
  | {kind: 'button'; t: Fit; h: number}
  | {kind: 'image'; src: string; caption?: Fit; h: number};
/** `o` is the offset from the start edge of the page content (the right edge for Arabic). */
type Placed = {i: number; spec: Spec; o: number; y: number; w: number; h: number};

/** `scale` grows every type size and row height of a sparse page, so a short page still fills the card. */
type Ctx = {font: string; shown: (t: string | number) => string; page: ProofScreenData['page']; scale: number};
const SCALES = [1.8, 1.65, 1.5, 1.35, 1.2, 1.1, 1];

const measureBlock = (b: ProofBlock, w: number, tile: boolean, ctx: Ctx): {spec: Spec; w: number; h: number} => {
  const {font, shown, page} = ctx, k = (n: number) => Math.round(n * ctx.scale);
  const text = (s: string, width: number, size: number, min: number, lines: number, weight: number) => fit(s, {width, size: k(size), min, lines, weight, lh: 1.3}, font);
  switch (b.kind) {
    case 'heading': {
      const head = Math.min(130, k(78)), t = fit(b.text, {width: w, size: head, min: 60, lines: 3, weight: 900, lh: 1.3}, font);
      return {spec: {kind: 'heading', text: b.text, size: head, lines: 3, h: t.lines.length * t.box}, w, h: t.lines.length * t.box};
    }
    case 'text': {
      const bubble = page === 'chat', inner = bubble ? Math.min(w, 720) - 2 * 34 : w;
      const t = text(b.text, inner, 44, 36, 6, 700);
      const natural = Math.ceil(Math.max(...t.lines.map(line => measure(line, {fontFamily: font, fontSize: t.size, fontWeight: 700}).width)));
      const h = t.lines.length * t.box + (bubble ? 44 : 4);
      return {spec: {kind: 'text', t, bubble, h}, w: bubble ? Math.min(w, natural + 68) : w, h};
    }
    case 'stat': {
      const value = shown(fixed(b.value, decimalsOf(b.value)));
      const unit = measure(value, {fontFamily: font, fontSize: 100, fontWeight: 900}).width / 100;
      if (tile) {
        const size = Math.min(k(136), (w - 56) / unit), label = b.text ? text(b.text, w - 56, 38, 34, 2, 700) : undefined;
        return {spec: {kind: 'stat', value, size, label, tile, h: 0}, w, h: Math.round(size * 0.9 + (label ? label.lines.length * label.box + 14 : 0) + 56)};
      }
      const size = Math.min(k(176), (w * (b.text ? 0.52 : 1)) / unit), label = b.text ? text(b.text, w - size * unit - 36, 40, 34, 3, 700) : undefined;
      return {spec: {kind: 'stat', value, size, label, tile, h: 0}, w, h: Math.round(Math.max(size * 0.9, label ? label.lines.length * label.box : 0))};
    }
    case 'row': {
      const value = b.value === undefined ? undefined : shown(fixed(b.value, decimalsOf(b.value)));
      const pillSize = k(56), pillW = value === undefined ? 0 : Math.ceil(measure(value, {fontFamily: font, fontSize: pillSize, fontWeight: 900}).width) + 52;
      const t = text(b.text, w - pillW - (pillW ? 28 : 0) - 8, 44, 36, 3, 800);
      return {spec: {kind: 'row', t, value, pillW, pillSize, pillH: k(80), h: 0}, w, h: Math.max(k(112), t.lines.length * t.box + 36, k(80) + 32)};
    }
    case 'button': {
      const t = text(b.text, w - 96, 50, 36, 2, 900);
      const natural = Math.ceil(Math.max(...t.lines.map(line => measure(line, {fontFamily: font, fontSize: t.size, fontWeight: 900}).width)));
      return {spec: {kind: 'button', t, h: 0}, w: Math.min(w, Math.max(380, natural + 130)), h: Math.max(k(120), t.lines.length * t.box + 48)};
    }
    case 'image': {
      const caption = b.text ? text(b.text, w - 64, 34, 30, 1, 700) : undefined;
      return {spec: {kind: 'image', src: b.src, caption, h: 0}, w, h: k(320)};
    }
  }
};

/** Stack the blocks of the page: one column for web and chat (chat alternates sides), two columns of tiles for a dashboard. */
const layoutPage = (data: ProofScreenData, ctx: Ctx) => {
  const placed: Placed[] = [];
  let y = 0;
  const put = (i: number, o: number, w: number, tile = false) => {
    const m = measureBlock(data.blocks[i], w, tile, ctx);
    const spec = {...m.spec, h: m.h} as Spec;
    placed.push({i, spec, o, y, w: m.w, h: m.h});
    return m;
  };
  const gap = data.page === 'chat' ? 20 : GAP;
  if (data.page === 'dashboard') {
    for (let i = 0; i < data.blocks.length;) {
      const stat = (k: number) => data.blocks[k]?.kind === 'stat';
      if (stat(i) && stat(i + 1)) {
        const a = put(i, 0, TILE_W, true), b = put(i + 1, TILE_W + COLUMN_GAP, TILE_W, true), h = Math.max(a.h, b.h);
        placed[placed.length - 2].h = h; placed[placed.length - 1].h = h;
        y += h + gap; i += 2;
      } else { y += put(i, 0, stat(i) ? TILE_W * 2 + COLUMN_GAP : IW, stat(i)).h + gap; i += 1; }
    }
  } else {
    data.blocks.forEach((_, i) => {
      const m = put(i, 0, IW);
      if (data.page === 'chat' && i % 2 === 1) placed[placed.length - 1].o = IW - m.w;
      y += m.h + gap;
    });
  }
  return {placed, height: y - gap};
};

type Chrome = {h: number; hasTitle: boolean; hasUrl: boolean};
const chromeOf = (data: ProofScreenData): Chrome => ({h: data.title && data.url ? 154 : data.title || data.url ? 96 : 56, hasTitle: !!data.title, hasUrl: !!data.url});

const Dots: React.FC<{accent: string}> = ({accent}) => <div style={{display: 'flex', gap: 14, flex: 'none', direction: 'ltr'}}>
  {[accent, INK, INK].map((c, i) => <div key={i} style={{width: 22, height: 22, borderRadius: 11, background: c, opacity: i === 0 ? 1 : 0.16}}/>)}
</div>;

const UrlPill: React.FC<{url: string; width: number}> = ({url, width}) => {
  const t = fit(url, {width: width - 100, size: 28, min: 20, lines: 1, weight: 500}, MONO);
  return <div style={{width, height: 58, borderRadius: 29, background: TINT, display: 'flex', alignItems: 'center', gap: 16, padding: '0 28px', boxSizing: 'border-box', direction: 'ltr', flex: 'none'}}>
    <div style={{width: 16, height: 16, borderRadius: 8, border: `4px solid ${DIM}`, boxSizing: 'border-box', flex: 'none'}}/>
    <div style={{fontFamily: MONO, fontWeight: 500, fontSize: t.size, color: DIM, whiteSpace: 'nowrap'}}>{url}</div>
  </div>;
};

const ChromeBar: React.FC<{data: ProofScreenData; c: Chrome; deck: Deck}> = ({data, c, deck}) => {
  const {copy, P} = deck;
  const titleW = CARD_W - 2 * 40 - 94 - 30;
  const t = data.title ? fit(data.title, {width: titleW, size: 46, min: 34, lines: 1, weight: 900}, P.font) : null;
  return <div style={{position: 'absolute', left: 0, top: 0, width: CARD_W, height: c.h, background: '#F3F5FA', borderBottom: `2px solid ${HAIR}`, direction: copy.dir}}>
    <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: c.hasTitle && c.hasUrl ? 88 : c.h, display: 'flex', alignItems: 'center', gap: 30, padding: '0 40px'}}>
      <Dots accent={P.accent}/>
      {t ? <div style={{fontFamily: P.font, fontWeight: 900, fontSize: t.size, lineHeight: `${t.box}px`, color: INK, whiteSpace: 'nowrap'}}>{data.title}</div>
        : data.url ? <UrlPill url={data.url} width={CARD_W - 2 * 40 - 94 - 30}/> : null}
    </div>
    {c.hasTitle && c.hasUrl ? <div style={{position: 'absolute', top: 84, left: 40, right: 40}}><UrlPill url={data.url!} width={CARD_W - 80}/></div> : null}
  </div>;
};

/** `dim` is 0 for the focus block and rises to 1 once the camera has arrived. */
const BlockBody: React.FC<{p: Placed; deck: Deck; focused: boolean; hl: number; dim: number; at: number; end: boolean}> = ({p, deck, focused, hl, dim, at, end}) => {
  const {copy, P} = deck;
  const {spec, w, h} = p, mark = focused ? hl : 0;
  const ink = lerpHex(INK, GREY, dim), body = lerpHex('#1B2538', GREY, dim), label = lerpHex('#5E6677', GREY_LABEL, dim);
  const lines = (t: Fit, color: string) => t.lines.map((line, k) => <div key={k} style={{height: t.box, lineHeight: `${t.box}px`, whiteSpace: 'pre', color}}>{line}</div>);
  const common = {direction: copy.dir, textAlign: copy.align, fontFamily: P.font} as const;
  switch (spec.kind) {
    case 'heading': return <MaskLines copy={copy} text={spec.text} top={0} width={w} right={0} size={spec.size} min={60} lines={spec.lines} lh={1.3} at={at} color={ink}/>;
    case 'text': return spec.bubble
      ? <div style={{position: 'absolute', inset: 0, borderRadius: 30, background: end ? lerpHex(INK, GREY_DARK_FILL, dim) : TINT, padding: '22px 34px', boxSizing: 'border-box', ...common, fontWeight: 700, fontSize: spec.t.size}}>
        {lines(spec.t, end ? lerpHex('#FFFFFF', GREY_ON_LIGHT, dim) : ink)}</div>
      : <div style={{position: 'absolute', inset: 0, ...common, fontWeight: 700, fontSize: spec.t.size}}>{lines(spec.t, body)}</div>;
    case 'stat': return spec.tile
      ? <div style={{position: 'absolute', inset: 0, borderRadius: 30, background: mark > 0 ? 'rgba(10,20,40,0.03)' : TINT, padding: '28px', boxSizing: 'border-box', ...common}}>
        <div style={{direction: 'ltr', fontWeight: 900, fontSize: spec.size, lineHeight: `${spec.size * 0.9}px`, color: ink}}>{spec.value}</div>
        {spec.label ? <div style={{marginTop: 14, fontWeight: 700, fontSize: spec.label.size, textAlign: copy.align}}>{lines(spec.label, label)}</div> : null}</div>
      : <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 36, direction: copy.dir, fontFamily: P.font}}>
        <div style={{direction: 'ltr', fontWeight: 900, fontSize: spec.size, lineHeight: `${spec.size * 0.9}px`, color: ink, transform: `translateY(${-GLYPH_DROP * spec.size * 0.5}px)`}}>{spec.value}</div>
        {spec.label ? <div style={{fontWeight: 700, fontSize: spec.label.size, textAlign: copy.align, flex: 1}}>{lines(spec.label, label)}</div> : null}</div>;
    case 'row': return <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 28, direction: copy.dir, fontFamily: P.font, borderBottom: `2px solid ${HAIR}`}}>
      <div style={{flex: 1, fontWeight: 800, fontSize: spec.t.size, textAlign: copy.align}}>{lines(spec.t, ink)}</div>
      {spec.value !== undefined ? <div style={{width: spec.pillW, height: spec.pillH, borderRadius: 24, background: mark > 0.5 ? P.accent : lerpHex(INK, GREY_PILL, dim), color: mark > 0.5 ? P.accentInk : '#FFFFFF', direction: 'ltr', textAlign: 'center',
        fontWeight: 900, fontSize: spec.pillSize, lineHeight: `${spec.pillH}px`, flex: 'none'}}>{spec.value}</div> : null}</div>;
    case 'button': return <div style={{position: 'absolute', inset: 0, ...common, textAlign: 'center', fontWeight: 900, fontSize: spec.t.size}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: h / 2, background: P.accent, opacity: 1 - dim, boxShadow: '0 16px 36px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div>{lines(spec.t, P.accentInk)}</div></div>
      <div style={{position: 'absolute', inset: 0, borderRadius: h / 2, background: NEUTRAL_FILL, boxShadow: `inset 0 0 0 3px ${NEUTRAL_EDGE}`, opacity: dim, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div>{lines(spec.t, GREY)}</div></div></div>;
    case 'image': return <div style={{position: 'absolute', inset: 0, borderRadius: 26, overflow: 'hidden', background: TINT}}>
      <Img src={staticFile(spec.src)} style={{width: '100%', height: '100%', objectFit: 'cover'}}/>
      <div style={{position: 'absolute', inset: 0, background: '#FFFFFF', opacity: 0.4 * dim}}/>
      {spec.caption ? <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 30px 14px', background: 'rgba(10,20,40,0.82)', ...common, fontWeight: 700, fontSize: spec.caption.size}}>
        {lines(spec.caption, '#FFFFFF')}</div> : null}</div>;
  }
};

const Card: React.FC<{data: ProofScreenData; deck: Deck; probe: boolean}> = ({data, deck, probe}) => {
  const {copy, P, shown} = deck;
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const focus = data.focus ?? 0, chrome = chromeOf(data);
  const layout = React.useMemo(() => {
    const at = (scale: number) => layoutPage(data, {font: P.font, shown, page: data.page, scale});
    for (const scale of SCALES.slice(0, -1)) { const l = at(scale); if (chrome.h + l.height + 2 * VIEW_PAD <= CARD_MAX) return l; }
    return at(1);
  }, [data, P.font, copy.ar]);
  const {placed, height} = layout;
  const cardH = Math.round(Math.min(CARD_MAX, Math.max(CARD_MIN, chrome.h + height + 2 * VIEW_PAD))), view = cardH - chrome.h;
  const cardTop = ZONE_TOP + (CARD_MAX - cardH) / 2;
  const contentH = height + 2 * VIEW_PAD, base = Math.max(0, (view - contentH) / 2), maxScroll = Math.max(0, contentH - view);
  const mid = placed.find(p => p.i === focus)!;
  // The window starts on a block boundary, as near the focus-centred position as keeps the whole focus block in view.
  const focusY = VIEW_PAD + mid.y + mid.h / 2, desired = Math.min(maxScroll, Math.max(0, focusY - view / 2)), MARGIN = 24;
  const inView = (s: number) => VIEW_PAD + mid.y - s >= MARGIN - 1 && VIEW_PAD + mid.y + mid.h - s <= view - MARGIN + 1;
  const stops = [0, maxScroll, ...placed.map(p => VIEW_PAD + p.y - MARGIN)].filter(s => s >= 0 && s <= maxScroll && inView(s));
  const target = stops.length ? stops.reduce((best, s) => (Math.abs(s - desired) < Math.abs(best - desired) ? s : best)) : maxScroll;
  const scroll = target * ramp(f, 8, 30);
  const focusFrame = proofFocusFrame(fps), hl = probe ? 1 : ramp(f, Math.round(focusFrame * 0.6), 14), cam = proofCameraAt(f, fps, data.path, probe), end = proofCameraAt(focusFrame, fps, data.path, probe);
  const edge = (o: number, ww: number) => (copy.ar ? CARD_W - PAD - o - ww : PAD + o);
  const originX = edge(mid.o, mid.w) + mid.w / 2, originY = chrome.h + base + focusY - target;
  const n = Math.max(1, data.blocks.length - 1), stagger = Math.min(5, 26 / n);
  const full = mid.w >= IW - 4, bandLeft = full ? 0 : edge(mid.o, mid.w) - 20, bandW = full ? CARD_W : mid.w + 40;
  const numeral = shown(String(focus + 1).padStart(2, '0')), numSize = Math.round(Math.min(360, Math.max(220, mid.h * 1.3))), numGlyph = GLYPH * numSize;
  // The numeral stays whole inside the card: it centres on the focus block, or rides above it when the block is near an edge. It may bleed off the side edge only.
  const blockCentre = base + VIEW_PAD + mid.y + mid.h / 2 - scroll, glyphTop = Math.min(view - numGlyph - 10, Math.max(10, blockCentre - numGlyph / 2));
  // A block that does not span the card leaves free room on its end side: the numeral stands there, beside it. Otherwise it sits behind the block and bleeds off the side edge.
  const free = copy.ar ? bandLeft : CARD_W - bandLeft - bandW, numW = 1.2 * numSize, beside = free >= numW * 0.9;
  const sideGap = (beside ? free - 12 - numW : free - numSize * 0.1) + (1 - hl) * 120;
  return <div style={{position: 'absolute', inset: 0, perspective: 1800}}>
    <div style={{position: 'absolute', left: CARD_X, top: cardTop, width: CARD_W, height: cardH, borderRadius: 44, overflow: 'hidden', background: '#FFFFFF', boxShadow: probe ? 'none' : '0 50px 110px rgba(0,0,0,0.5)',
      transformOrigin: `${originX}px ${originY}px`, transform: `translate(${cam.x}px, ${cam.y}px) rotateX(${cam.rotateX - end.rotateX}deg) rotateY(${cam.rotateY - end.rotateY}deg) scale(${cam.scale})`}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: chrome.h, height: view, overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: bandLeft, top: base + VIEW_PAD + mid.y - scroll, width: bandW, height: mid.h, opacity: hl}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: -14, bottom: -14, background: P.accent, opacity: 0.13}}/>
          {mid.spec.kind === 'stat' && mid.spec.tile
            ? <div style={{position: 'absolute', left: 0, right: 0, top: -14, height: 16, background: P.accent, transformOrigin: copy.ar ? '100% 0%' : '0% 0%', transform: `scaleX(${hl})`}}/>
            : <div style={{position: 'absolute', [copy.side]: 0, top: -14, bottom: -14, width: 20, background: P.accent, transform: `scaleY(${hl})`}}/>}
        </div>
        <div style={{position: 'absolute', [copy.opposite]: sideGap, top: glyphTop - GLYPH_TOP * numSize, fontFamily: P.font, fontWeight: 900, fontSize: numSize, lineHeight: `${numSize}px`, direction: 'ltr', color: 'transparent',
          WebkitTextStroke: `4px ${P.accent}`, opacity: (mid.spec.kind === 'stat' && mid.spec.tile ? 0.14 : 0.32) * hl, letterSpacing: -10}}>{numeral}</div>
        {placed.map((p, i) => {
          const at = 4 + Math.round(i * stagger), e = ramp(f, at, 16), focused = p.i === focus, y = base + VIEW_PAD + p.y - scroll, dim = focused ? 0 : hl;
          // A block that crosses the top or bottom edge of the window fades out whole instead of being cut.
          const seen = (Math.min(y + p.h, view) - Math.max(y, 0)) / p.h, edgeFade = clamp01((seen - 0.5) / 0.5);
          return <div key={p.i} data-proof-block={p.i} data-proof-focus={focused ? 'true' : undefined} style={{position: 'absolute', [copy.side]: PAD + p.o, top: y + (p.spec.kind === 'heading' ? 0 : (1 - e) * 34), width: p.w, height: p.h,
            opacity: (p.spec.kind === 'heading' ? clamp01(e * 2) : e) * edgeFade}}>
            <BlockBody p={p} deck={deck} focused={focused} hl={hl} dim={dim} at={at} end={data.page === 'chat' && p.i % 2 === 1}/>
          </div>;
        })}
      </div>
      <ChromeBar data={data} c={chrome} deck={deck}/>
    </div>
  </div>;
};

export const ProofScreen: React.FC<FamilyDesignProps> = ({scene}) => {
  if (scene.family !== 'proof-screen') return null;
  const probe = useProbe() !== null, data = useDesignData(scene.data), deck = useDeck(data);
  return <Settled><AbsoluteFill style={deck.copy.ar ? undefined : {direction: deck.copy.dir}}>
    <Ground copy={deck.copy} tone={0}/>
    <Card data={data} deck={deck} probe={probe}/>
  </AbsoluteFill></Settled>;
};
