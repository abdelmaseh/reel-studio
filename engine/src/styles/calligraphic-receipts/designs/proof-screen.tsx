// calligraphic-receipts «proof-screen»: the page is a long printed sheet fed out of a printer slot, torn at the bottom.
// web: blocks are printed in one column. chat: blocks alternate sides as slips. dashboard: a grid of small receipts with big mono totals.
// The camera follows the path of the scene, pans down a long page to the focus block, and a red pen circles it and ticks it in the margin.
import React from 'react';
import {Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useProbe} from '../../../core/safe';
import {fitToWidth} from '../../../core/type';
import type {FamilyDesignProps} from '../../family-designs';
import type {ProofBlock, ProofScreenData} from '../../../creative-kit/proof-screen/schema';
import {proofCameraAt} from '../../../creative-kit/proof-screen/timing';
import {useDesignText} from '../../../style-kit/digits';
import {C, DesignRoot, FONT, PenBox, Tick, Tooth, W, clamp01, expo, polyDown, ramp, sceneCopy, tornPts, useCopy} from './kit';
import {Ground, Headline, LeaderRow, NumberText, PrinterSlot, Settled, Slip, ZONE_BOTTOM, decimalsOf, fitWrapped, fixed, useHead, useNumberFace, type Face, type Head, type Wrapped} from './family-parts';

const SW = 920, SHEET_LEFT = (W - SW) / 2, TOP = 306, GUTTER = 100, PAD_START = 48, IW = SW - GUTTER - PAD_START, GAP = 34, SHEET_PAD = 40;
const FEED_AT = 2, FEED = 26;
/** A block shows only while it is whole inside the window: it fades out as its top passes the window top or its bottom passes the window bottom. */
const wholeFade = (top: number, bottom: number, windowH: number) => clamp01(Math.min((top + 4) / 10, (windowH - bottom + 4) / 10));
/** The pan that keeps the focus block in view and starts on a block's top edge, so the top of the window never cuts a block in half. */
const pickPan = (tops: number[], focus: {y: number; h: number}, windowH: number, maxPan: number, margin: number) => {
  const mid = focus.y + focus.h / 2 - windowH / 2;
  const ok = (p: number) => p >= 0 && p <= maxPan && p <= focus.y - margin && p + windowH >= focus.y + focus.h + margin;
  const options = [0, ...tops.map(t => t - margin), maxPan].filter(ok);
  return options.length ? options.reduce((a, b) => Math.abs(b - mid) < Math.abs(a - mid) ? b : a) : Math.max(0, Math.min(maxPan, mid));
};
/** Type scales tried from the biggest down: a short page grows its type to fill the sheet. */
const scalesFrom = (low: number) => Array.from({length: Math.round((1.5 - low) / 0.05) + 1}, (_, i) => Math.round((1.5 - i * 0.05) * 100) / 100);
const SHEET_SCALES = scalesFrom(1), GRID_SCALES = scalesFrom(0.9);
const sz = (base: number, s: number, max: number) => Math.min(max, Math.round(base * s));
const paperAt = (t: number) => 1 - (1 - clamp01(t)) ** 2;
/** The frame at which the feeding paper, which ends at `sheetH`, passes the line `y`. */
const revealAt = (y: number, sheetH: number) => FEED_AT + Math.round(FEED * (1 - Math.sqrt(1 - Math.min(0.97, y / sheetH)))) + 2;

type Block = ProofBlock;
type Ctx = {s: number; bare?: boolean; copy: ReturnType<typeof useCopy>; shown: (t: string | number) => string; face: Face; timing: Timing};
/** Frames of the scene, stretched or squeezed so a short scene still lands its highlight. */
type Timing = {k: number; at: (n: number) => number};
type Planned = {h: number; render: (y: number, reveal: number) => React.ReactNode};
type Placed = {i: number; x: number; y: number; w: number; h: number; node: React.ReactNode};

/** A block fades in with a small drop once the paper has fed past its top edge. */
const Printed: React.FC<{at: number; children: React.ReactNode}> = ({at, children}) => {
  const f = useCurrentFrame(), p = ramp(f, at, 8);
  return <div style={{opacity: Math.min(1, p * 1.6), transform: `translateY(${(1 - p) * -8}px)`}}>{children}</div>;
};

// ---------- blocks, printed ----------
const lines = (t: Wrapped, o: {family?: string; weight?: number; color?: string; align?: 'right' | 'left'}) => t.lines.map((line, i) =>
  <div key={i} style={{height: t.box, lineHeight: `${t.box}px`, fontFamily: o.family ?? FONT.naskh, fontWeight: o.weight ?? 700, fontSize: t.size, color: o.color ?? C.ink, whiteSpace: 'pre'}}>{line}</div>);

const planHeading = (b: Extract<Block, {kind: 'heading'}>, w: number, c: Ctx): Planned => {
  const t = fitWrapped(b.text, FONT.naskh, 700, sz(72, c.s, 104), 44, w, 1.3, 3);
  return {h: t.lines.length * t.box + 28, render: () => <div style={{direction: c.copy.dir, textAlign: c.copy.align}}>{lines(t, {})}<div style={{marginTop: 12, borderTop: `7px double ${C.ink}`}}/></div>};
};

const planText = (b: Extract<Block, {kind: 'text'}>, w: number, c: Ctx): Planned => {
  const bar = !c.bare, t = fitWrapped(b.text, FONT.naskh, 700, sz(46, c.s, 60), 44, w - (bar ? 30 : 0), 1.4, 8);
  return {h: t.lines.length * t.box, render: () => <div style={{position: 'relative', direction: c.copy.dir, textAlign: c.copy.align, [c.copy.ar ? 'paddingRight' : 'paddingLeft']: bar ? 30 : 0}}>
    {bar ? <div style={{position: 'absolute', [c.copy.side]: 0, top: 8, bottom: 8, width: 5, background: C.rust, opacity: 0.85}}/> : null}{lines(t, {})}</div>};
};

const planStat = (b: Extract<Block, {kind: 'stat'}>, w: number, c: Ctx): Planned => {
  const text = c.shown(fixed(b.value, decimalsOf(b.value)));
  const size = Math.floor(Math.min(sz(190, c.s, 260), (w - 24) / (c.face.width(text, 100) / 100)));
  const label = b.text ? fitWrapped(b.text, FONT.naskh, 700, sz(46, c.s, 56), 44, w, 1.3, 2) : null;
  const labelH = label ? label.lines.length * label.box + 10 : 0, numBox = Math.round(size * 0.9);
  return {h: labelH + 8 + 18 + numBox + 22, render: () => <div style={{direction: c.copy.dir}}>
    {label ? <div style={{height: labelH}}><LeaderRow lines={label.lines} size={label.size} box={label.box}/></div> : null}
    <div style={{marginTop: 4, borderTop: `7px double ${C.ink}`, paddingTop: 18, display: 'flex', justifyContent: 'center'}}>
      <NumberText text={text} reserve={Array.from(text).length} size={size} face={c.face} color={C.ink}/></div></div>};
};

const planRow = (b: Extract<Block, {kind: 'row'}>, w: number, c: Ctx): Planned => {
  const vsize = sz(60, c.s, 80), text = b.value === undefined ? null : c.shown(fixed(b.value, decimalsOf(b.value)));
  const vw = text ? Math.ceil(c.face.width(text, vsize)) : 44;
  const t = fitWrapped(b.text, FONT.naskh, 700, sz(48, c.s, 62), 44, w - vw - 70, 1.3, 3);
  const h = Math.max(t.lines.length * t.box, Math.round(vsize * 0.9)) + 6;
  return {h, render: () => <div style={{direction: c.copy.dir}}><LeaderRow lines={t.lines} size={t.size} box={t.box}
    value={text ? <NumberText text={text} reserve={Array.from(text).length} size={vsize} face={c.face} color={C.ink}/>
      : <div style={{width: 34, height: 34, boxSizing: 'border-box', border: `4px solid ${C.ink}`, borderRadius: 6, marginBottom: t.box * 0.2}}/>}/></div>};
};

const planButton = (b: Extract<Block, {kind: 'button'}>, w: number, c: Ctx, i: number): Planned => {
  const t = fitWrapped(b.text, FONT.naskh, 700, sz(60, c.s, 84), 44, w - 90, 1.3, 2);
  const bh = Math.max(sz(120, c.s, 160), t.lines.length * t.box + 56);
  return {h: bh + 14, render: (_y, at) => <div style={{position: 'relative', height: bh, width: w}}>
    <div style={{position: 'absolute', left: 10, top: 12, width: w - 6, height: bh, borderRadius: 26, opacity: 0.42,
      background: `repeating-linear-gradient(45deg, ${C.ink} 0 3px, transparent 3px 9px)`}}/>
    <div style={{position: 'absolute', left: 0, top: 0, width: w - 6, height: bh, borderRadius: 26, background: C.thermal}}/>
    <div style={{position: 'absolute', left: 0, top: 0}}><PenBox w={w - 6} h={bh} r={28} at={at + 4} dur={20} color={C.ink} width={5} seed={i + 2}/></div>
    <div style={{position: 'absolute', left: 0, top: 0, width: w - 6, height: bh, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', direction: c.copy.dir}}>{lines(t, {})}</div></div>};
};

const planImage = (b: Extract<Block, {kind: 'image'}>, w: number, c: Ctx, i: number): Planned => {
  const imgH = sz(300, c.s, 440), cap = b.text ? fitWrapped(b.text, FONT.naskh, 400, sz(40, c.s, 46), 36, w - 40, 1.3, 2) : null;
  const capH = cap ? cap.lines.length * cap.box + 12 : 0, rot = i % 2 ? 0.9 : -0.9;
  return {h: imgH + 52 + capH, render: () => <div style={{position: 'relative', height: imgH + 52 + capH}}>
    <div style={{position: 'absolute', left: 14, top: 14, width: w - 28, height: imgH + 28, background: '#FFFDF7', transform: `rotate(${rot}deg)`, boxShadow: '0 12px 22px rgba(40,24,12,0.34), 0 1px 2px rgba(40,24,12,0.3)'}}>
      <Img src={staticFile(b.src)} style={{position: 'absolute', left: 14, top: 14, width: w - 56, height: imgH, objectFit: 'cover'}}/>
      {[18, w - 28 - 110].map((x, k) => <div key={k} style={{position: 'absolute', left: x, top: -16, width: 92, height: 32, background: 'rgba(214,186,128,0.7)', transform: `rotate(${k ? 5 : -6}deg)`}}/>)}</div>
    {cap ? <div style={{position: 'absolute', left: 0, right: 0, top: imgH + 50, direction: c.copy.dir, textAlign: 'center'}}>{lines(cap, {weight: 400, color: C.inkSoft})}</div> : null}</div>};
};

const planBlock = (b: Block, w: number, c: Ctx, i: number): Planned =>
  b.kind === 'heading' ? planHeading(b, w, c) : b.kind === 'text' ? planText(b, w, c) : b.kind === 'stat' ? planStat(b, w, c)
    : b.kind === 'row' ? planRow(b, w, c) : b.kind === 'button' ? planButton(b, w, c, i) : planImage(b, w, c, i);

// ---------- the page header ----------
const planHeader = (title: string | undefined, url: string | undefined, w: number, c: Ctx): Planned | null => {
  if (!title && !url) return null;
  const t = title ? fitWrapped(title, FONT.naskh, 700, sz(50, c.s, 66), 44, w, 1.25, 2) : null;
  const one = url ? fitToWidth(url, {fontFamily: FONT.mono, fontSize: 30, fontWeight: 400}, w - 20, {min: 20, max: 30}) : null;
  const urlSize = one ? one.fontSize : 0, urlH = one ? (one.fits ? Math.round(urlSize * 1.5) : Math.round(urlSize * 1.4 * 2)) : 0;
  const h = (t ? t.lines.length * t.box + 6 : 0) + urlH + 38;
  return {h, render: () => <div style={{direction: c.copy.dir}}>
    {t ? <div style={{textAlign: c.copy.align}}>{lines(t, {})}</div> : null}
    {one ? <div style={{marginTop: 6, direction: 'ltr', fontFamily: FONT.mono, fontWeight: 400, fontSize: urlSize, lineHeight: `${Math.round(urlSize * 1.4)}px`, color: C.inkSoft, textAlign: c.copy.ar ? 'right' : 'left', wordBreak: 'break-all'}}>{url}</div> : null}
    <div style={{marginTop: 14, borderTop: `3px dashed rgba(46,32,25,0.42)`}}/></div>};
};

// ---------- the sheet ----------
/** A long sheet of thermal paper with a torn bottom. `tear` is where the paper has fed to so far. */
const Sheet: React.FC<{w: number; h: number; tear: number; children: React.ReactNode}> = ({w, h, tear, children}) => {
  const poly = polyDown(w, tornPts(w, tear, 5, 7));
  return <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h + 40}}>
    <div style={{position: 'absolute', inset: 0, transform: 'translateY(10px)', filter: 'blur(16px)', opacity: 0.38}}><div style={{position: 'absolute', inset: 0, background: '#28180C', clipPath: poly}}/></div>
    <div style={{position: 'absolute', inset: 0, background: C.fringe, clipPath: polyDown(w, tornPts(w, tear + 6, 16, 6.3))}}/>
    <div style={{position: 'absolute', inset: 0, clipPath: poly}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden', background: C.thermal}}>
        <Tooth w={w} h={h} tooth={0.1} fibre={0.03} seed={9} tint={[0.45, 0.4, 0.33]}/>
        <div style={{position: 'absolute', left: 0, top: 0, width: w, height: 60, background: 'linear-gradient(180deg, rgba(60,40,24,0.2), rgba(60,40,24,0))'}}/>
        {children}
      </div>
    </div>
  </div>;
};

/** The red pen mark that lands on the focus block: a wash, a wobbly circle, and a tick in the margin. */
const Highlight: React.FC<{x: number; y: number; w: number; h: number; at: number; tickX: number; tickY?: number}> = ({x, y, w, h, at, tickX, tickY}) => {
  const f = useCurrentFrame();
  return <>
    <div style={{position: 'absolute', left: x - 26, top: y - 20, width: w + 52, height: h + 40, borderRadius: 30, background: 'rgba(165,69,34,0.09)', opacity: ramp(f, at, 10)}}/>
    <div style={{position: 'absolute', left: x - 26, top: y - 20}}><PenBox w={w + 52} h={h + 40} r={30} at={at} dur={22} color={C.rust} width={7} seed={7}/></div>
    <div style={{position: 'absolute', left: tickX - 42, top: (tickY ?? y + h / 2) - 44, width: 84, height: 84}}><Tick at={at + 20} size={84} dur={10} weight={13}/></div>
  </>;
};

type Page = {items: Placed[]; height: number; header: Placed | null};

/** Lay a column of blocks (web) or alternating slips (chat) out from the top of the sheet. */
const layoutSheet = (d: ProofScreenData, c: Ctx, contentLeft: number, plannedAt: (y: number) => number): Page => {
  const header = planHeader(d.title, d.url, IW, c);
  let y = 30;
  const head: Placed | null = header ? {i: -1, x: contentLeft, y, w: IW, h: header.h, node: header.render(y, 0)} : null;
  if (head) y += head.h + 8;
  const chat = d.page === 'chat', items: Placed[] = [];
  d.blocks.forEach((b, i) => {
    const gap = i === 0 ? 0 : GAP;
    if (gap && !chat) items.push({i: -2 - i, x: contentLeft, y: y + gap / 2, w: IW, h: 3, node: <div style={{borderTop: '3px dashed rgba(46,32,25,0.26)'}}/>});
    y += gap;
    if (chat && b.kind !== 'button') {
      const sw = Math.round(IW * 0.92), inner = sw - 60, p = planBlock(b, inner, {...c, bare: true}, i), h = p.h + 52, odd = i % 2 === 1;
      const x = (odd === c.copy.ar) ? contentLeft : contentLeft + IW - sw, at = plannedAt(y);
      const slip = odd
        ? <div style={{position: 'relative', width: sw, height: h}}><PenBox w={sw} h={h} r={30} at={at + 4} dur={20} color={C.ink} width={5} seed={i + 3}/><div style={{position: 'absolute', left: 30, top: 26, width: inner}}>{p.render(y, at)}</div></div>
        : <div style={{position: 'relative', width: sw, height: h}}><Slip left={0} top={0} width={sw} height={h} start={at} feed={8} rot={i % 2 ? 0.6 : -0.6} seed={i + 1} tint="rgba(206,170,108,0.26)"><div style={{position: 'absolute', left: 30, top: 26, width: inner}}>{p.render(y, at)}</div></Slip></div>;
      items.push({i, x, y, w: sw, h, node: slip});
      y += h;
    } else {
      const w = chat ? Math.round(IW * 0.72) : IW, p = planBlock(b, w, c, i), x = chat ? contentLeft + (IW - w) / 2 : contentLeft, at = plannedAt(y);
      items.push({i, x, y, w, h: p.h, node: p.render(y, at)});
      y += p.h;
    }
  });
  return {items, height: y + SHEET_PAD, header: head};
};

const SheetPage: React.FC<{d: ProofScreenData; c: Ctx; focus: number; windowH: number}> = ({d, c, focus, windowH}) => {
  const f = useCurrentFrame(), contentLeft = c.copy.ar ? GUTTER : PAD_START;
  // The biggest type scale at which the whole page fits the window; a longer page keeps the smallest and the camera pans down it.
  const page = React.useMemo(() => {
    const pageFor = (s: number) => {
      const ctx = {...c, s}, total = layoutSheet(d, ctx, contentLeft, () => 0).height, H = Math.min(windowH, total);
      return layoutSheet(d, ctx, contentLeft, y => revealAt(y, H));
    };
    return SHEET_SCALES.map(pageFor).find(p => p.height <= windowH) ?? pageFor(1);
  }, [JSON.stringify(d), windowH, c.copy.ar, c.face.family]);
  const pans = page.height > windowH, H = Math.min(windowH, page.height);
  const target = page.items.find(it => it.i === focus) ?? page.items.find(it => it.i >= 0)!;
  const pan = pans ? pickPan(page.items.filter(it => it.i >= 0).map(it => it.y), target, windowH, page.height - windowH, 24) : 0;
  const panAt = c.timing.at(46), panned = pans ? ramp(f, panAt, c.timing.at(28), expo) * pan : 0;
  const hiAt = c.timing.at(pans ? 78 : 56), tear = H * paperAt((f - FEED_AT) / FEED);
  const tickX = c.copy.ar ? GUTTER / 2 + 2 : SW - GUTTER / 2 - 2;
  return <>
    <div style={{position: 'absolute', left: SHEET_LEFT, top: TOP, width: SW, height: H + 40}}>
      <Sheet w={SW} h={H} tear={Math.max(30, tear)}>
        <div style={{position: 'absolute', left: 0, top: 0, width: SW, transform: `translateY(${-panned}px)`}}>
          {[...(page.header ? [page.header] : []), ...page.items].map(it => <div key={it.i} data-proof-block={it.i >= 0 ? it.i : undefined} data-proof-focus={it.i === focus ? 'true' : undefined} style={{position: 'absolute', left: it.x, top: it.y, width: it.w, height: it.h, opacity: pans ? wholeFade(it.y - panned, it.y + it.h - panned, H - 24) : 1}}>
            <Printed at={revealAt(it.y, H)}>{it.node}</Printed></div>)}
          {target ? <Highlight x={target.x} y={target.y} w={target.w} h={target.h} at={hiAt} tickX={tickX}/> : null}
        </div>
      </Sheet>
    </div>
    <PrinterSlot y={TOP} left={SHEET_LEFT - 26} width={SW + 52}/>
  </>;
};

// ---------- the dashboard ----------
const COL = 437, COL_GAP = 26;
const planCard = (b: Block, w: number, c: Ctx): {h: number; node: React.ReactNode} => {
  if (b.kind === 'stat') {
    const text = c.shown(fixed(b.value, decimalsOf(b.value))), inner = w - 60;
    const label = b.text ? fitWrapped(b.text, FONT.naskh, 700, sz(40, c.s, 48), 30, inner - 90, 1.3, 2) : null;
    const size = Math.floor(Math.min(sz(128, c.s, 190), inner / (c.face.width(text, 100) / 100))), numBox = Math.round(size * 0.9);
    const labelH = label ? label.lines.length * label.box : 0;
    return {h: 18 + labelH + 6 + numBox + 12, node: <div style={{position: 'relative', padding: '18px 30px 0', direction: c.copy.dir}}>
      <div style={{minHeight: labelH}}>{label ? lines(label, {}) : null}</div>
      <div style={{borderTop: `6px double ${C.ink}`, marginTop: 6, paddingTop: 2, display: 'flex', justifyContent: 'center'}}>
        <NumberText text={text} reserve={Array.from(text).length} size={size} face={c.face} color={C.ink}/></div></div>};
  }
  const p = planBlock(b, w - 60, c, 0);
  return {h: p.h + 24, node: <div style={{padding: '24px 30px 0'}}>{p.render(0, 0)}</div>};
};

const DashboardPage: React.FC<{d: ProofScreenData; c: Ctx; focus: number; head: Head | null}> = ({d, c, focus, head}) => {
  const f = useCurrentFrame(), left = (W - (2 * COL + COL_GAP)) / 2;
  const top = (head ? head.bottom + (d.url ? 70 : 28) : TOP);
  // The window starts PAD_T above the first row, so the pen circle around the first card has room.
  const PAD_T = 24, windowH = ZONE_BOTTOM - top + PAD_T;
  const grid = React.useMemo(() => {
    const gridFor = (s: number) => {
      const ctx = {...c, s}, rows: {h: number; items: {i: number; col: number; span: number; node: React.ReactNode}[]}[] = [];
      d.blocks.forEach((b, i) => {
        const span = b.kind === 'stat' ? 1 : 2, card = planCard(b, span === 1 ? COL : 2 * COL + COL_GAP, ctx), last = rows[rows.length - 1];
        const row = span === 1 && last && last.items.length === 1 && last.items[0].span === 1 ? last : rows[rows.push({h: 0, items: []}) - 1];
        row.items.push({i, col: row.items.length, span, node: card.node});
        row.h = Math.max(row.h, card.h + 30);
      });
      let y = PAD_T;
      const placed = rows.flatMap(r => { const out = r.items.map(it => ({...it, y, h: r.h})); y += r.h + COL_GAP - 8; return out; });
      return {placed, height: y - COL_GAP + 14};
    };
    return GRID_SCALES.map(gridFor).find(g => g.height <= windowH) ?? gridFor(0.9);
  }, [JSON.stringify(d), windowH, c.copy.ar, c.face.family]);
  const pans = grid.height > windowH, target = grid.placed.find(p => p.i === focus) ?? grid.placed[0];
  const pan = pans ? pickPan(grid.placed.map(p => p.y), target, windowH, grid.height - windowH, PAD_T) : 0;
  const panned = pans ? ramp(f, c.timing.at(46), c.timing.at(28), expo) * pan : 0;
  const hiAt = c.timing.at(pans ? 78 : 56);
  const xOf = (p: {col: number; span: number}) => p.span === 2 ? left : c.copy.ar ? left + (1 - p.col) * (COL + COL_GAP) : left + p.col * (COL + COL_GAP);
  const widthOf = (p: {span: number}) => p.span === 2 ? 2 * COL + COL_GAP : COL;
  return <div style={{position: 'absolute', left: 0, top: top - PAD_T, width: W, height: windowH + 40, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: W, transform: `translateY(${-panned}px)`}}>
      {grid.placed.map((p, n) => <div key={p.i} data-proof-block={p.i} data-proof-focus={p.i === focus ? 'true' : undefined} style={{position: 'absolute', left: 0, top: 0, width: W, opacity: pans ? wholeFade(p.y - panned, p.y + p.h - panned, windowH - 6) : 1}}>
        <Slip left={xOf(p)} top={p.y} width={widthOf(p)} height={p.h} start={c.timing.at(8 + n * 7)} feed={10} rot={n % 2 ? 0.7 : -0.7} seed={p.i * 3 + 1}>{p.node}</Slip></div>)}
      <Highlight x={xOf(target)} y={target.y + 6} w={widthOf(target)} h={target.h - 34} at={hiAt} tickX={c.copy.ar ? xOf(target) + 56 : xOf(target) + widthOf(target) - 56} tickY={target.y + 70}/>
    </div>
  </div>;
};

// ---------- the scene ----------
const Body: React.FC<{d: ProofScreenData}> = ({d}) => {
  const f = useCurrentFrame(), {fps, durationInFrames} = useVideoConfig(), probe = useProbe(), copy = useCopy(), shown = useDesignText(), face = useNumberFace();
  const k = Math.min(1, (durationInFrames - 10) / 112), timing: Timing = {k, at: n => Math.max(1, Math.round(n * k))};
  const c: Ctx = {s: 1, copy, shown, face, timing};
  const dashboard = d.page === 'dashboard', focus = d.focus ?? 0;
  const head = useHead(dashboard ? d.title : undefined, false, {top: 292, maxSize: 100});
  const cam = proofCameraAt(f, fps, d.path, probe !== null);
  const growth = d.path === 'focus' ? 1.04 : 1;
  const windowH = (growth > 1 ? 1108 : ZONE_BOTTOM - 14) - TOP;
  const origin = `${W / 2}px ${TOP + windowH * 0.45}px`;
  return <>
    <Ground head={head}/>
    {head ? <Headline head={head}/> : null}
    {dashboard && d.url ? <div style={{position: 'absolute', left: 65, right: 65, top: (head?.bottom ?? 300) + 6, direction: 'ltr', textAlign: copy.ar ? 'right' : 'left', fontFamily: FONT.mono, fontWeight: 400, fontSize: 30, color: C.inkSoft, whiteSpace: 'nowrap'}}>{d.url}</div> : null}
    <div style={{position: 'absolute', inset: 0, perspective: 1600}}>
      <div style={{position: 'absolute', inset: 0, transformOrigin: origin, transform: `translate(${cam.x}px, ${cam.y}px) rotateX(${cam.rotateX}deg) rotateY(${cam.rotateY}deg) scale(${cam.scale})`}}>
        {dashboard ? <DashboardPage d={d} c={c} focus={focus} head={head}/> : <SheetPage d={d} c={c} focus={focus} windowH={windowH}/>}
      </div>
    </div>
  </>;
};

export const ProofScreen: React.FC<FamilyDesignProps> = ({scene}) => {
  if (scene.family !== 'proof-screen') return null;
  return <DesignRoot copy={sceneCopy(scene.data)}><Settled><Body d={scene.data}/></Settled></DesignRoot>;
};
