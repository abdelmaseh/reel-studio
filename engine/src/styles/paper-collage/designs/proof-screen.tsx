// paper-collage proof-screen: the page is a paper collage of the screen. A teal paper browser panel carries a cream chrome strip
// (three paper dots, the title, the url) and the blocks as cut paper strips that slide under the chrome and a torn lip.
// Blocks drop in, the camera pans to the focus block, then a big tomato-red paper arrow drops in beside it and a fresh strip of tape slaps across its corner.
import React from 'react';
import {Easing, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useProbe} from '../../../core/safe';
import type {FamilyDesignProps} from '../../family-designs';
import type {ProofBlock, ProofScreenData} from '../../../creative-kit/proof-screen/schema';
import {proofCameraAt, proofFocusFrame} from '../../../creative-kit/proof-screen/timing';
import {useDesignText} from '../../../style-kit/digits';
import {displayWeight} from '../../../style-kit/design-safety';
import {C, BODY, LAT, ramp, textW, rectShape, polyShape, circleVerts, Stage, Piece, Tape, CutNumeral, DesignProvider, useKit, type Pt} from './kit';
import {Settled, clamp, fitBalanced, fitLines, oneLine} from './family-parts';

const MONO = 'IBM Plex Mono';
const INOUT3 = Easing.inOut(Easing.cubic);

// Panel geometry (physical frame, right-to-left coordinates; the kit mirrors an English scene). The widest camera path ends at scale 1.04.
const PANEL_W = 930, PANEL_X = (1080 - PANEL_W) / 2, PANEL_TOP = 300, PANEL_H = 846;
const ORIGIN = `540px ${PANEL_TOP + PANEL_H / 2}px`;
const EDGE = 14;                        // inset of the screen inside the panel
const GUTTER = 110;                     // a narrow margin on the side opposite the reading start; the arrow overhangs the panel edge into it
const LANE_L = EDGE + GUTTER, LANE_R = PANEL_W - EDGE - 22;
const BW = LANE_R - LANE_L;             // width of a full block
const GAP = 18, PAD_Y = 14;
const UNDER_CHROME = 8, LIP = 32;       // content slides under the chrome strip and under a torn lip; neither edge ever shows a cut block
const SCROLL_FRAMES = 28;
const ARROW_W = 148, ARROW_H = 150;

export const ProofScreen: React.FC<FamilyDesignProps> = p => {
  if (p.scene.family !== 'proof-screen') return null;
  return <DesignProvider data={p.scene.data} sectionIndex={p.sectionIndex}>
    <Stage offcuts={{family: 'quarter', colors: [C.teal, C.mustard, C.terra]}}>
      <Settled><Collage d={p.scene.data}/></Settled>
    </Stage>
  </DesignProvider>;
};

// ---------- chrome ----------
type UrlPlan = {lines: string[]; size: number; box: number; w: number; h: number};
type ChromePlan = {h: number; row: number; inline: boolean; titleLines: string[]; titleSize: number; titleBox: number; url?: UrlPlan};
const DOTS_W = 3 * 34 + 2 * 12;

function useChrome(d: ProofScreenData): ChromePlan {
  const {HEAD} = useKit();
  const width = PANEL_W - 2 * EDGE - 40, weight = displayWeight(HEAD, 'Reem Kufi', 700);
  const room = width - DOTS_W - 24 - 40;
  const one = d.title ? oneLine(d.title, HEAD, weight, {width: room, size: 52, min: 36}) : null;
  const two = d.title && !one ? fitLines(d.title, HEAD, weight, {width: room, size: 44, min: 34, lines: 2, lh: 1.15}) : null;
  const titleLines = !d.title ? [] : one ? [d.title] : two!.lines, titleSize = one ? one.size : two ? two.size : 0, titleBox = one ? Math.round(one.size * 1.2) : two ? two.box : 0;
  const titleW = one ? textW(d.title!, HEAD, one.size, weight) : 0;
  // The url shares the title's row when both fit; otherwise it gets its own row under it.
  const inlineRoom = room - titleW - 40 - 24;
  const inlineUrl = d.url && one ? fitLines(d.url, MONO, 400, {width: inlineRoom - 56, size: 30, min: 26, lines: 1}) : null;
  const ownUrl = d.url ? fitLines(d.url, MONO, 400, {width: width - 80, size: 32, min: 24, lines: 2, lh: 1.25}) : null;
  const inline = !!(inlineUrl && inlineUrl.fits);
  const url = inline ? inlineUrl : ownUrl;
  const urlPlan = url && d.url ? {lines: url.lines, size: url.size, box: url.box, w: inline ? Math.min(width - 24, Math.round(Math.max(...url.lines.map(l => textW(l, MONO, url.size, 400)))) + 56) : width - 28, h: url.lines.length * url.box + 22} : undefined;
  const row = Math.max(76, titleLines.length * titleBox + 24);
  return {h: row + (urlPlan && !inline ? urlPlan.h + 14 : 0) + 22, row, inline, titleLines, titleSize, titleBox, url: urlPlan};
}

const Chrome: React.FC<{plan: ChromePlan}> = ({plan}) => {
  const {HEAD, copy} = useKit();
  const w = PANEL_W - 2 * EDGE - 40;
  const weight = displayWeight(HEAD, 'Reem Kufi', 700);
  const dots = [C.terra, C.mustard, C.teal];
  return <Piece id="pf-chrome" x={EDGE + 20} y={EDGE + 8} w={w} h={plan.h} rot={-0.6} color={C.card} shape={rectShape(6)} enter={{at: 6, from: [0, -160], dur: 16}} depth={0.7} z={30}>
    {dots.map((color, i) => <Piece key={i} id={`pf-dot-${i}`} x={w - 24 - 34 * (i + 1) - 12 * i} y={(plan.row - 34) / 2 + 6} w={34} h={34} color={color} shape={polyShape(circleVerts, 1)} enter={{at: 14 + i * 3, from: [0, -60], dur: 12}} depth={0.3} z={2} tight/>)}
    {plan.titleLines.length ? <div style={{position: 'absolute', [copy.side]: 24 + DOTS_W + 24, top: 6, height: plan.row, display: 'flex', flexDirection: 'column', justifyContent: 'center', direction: copy.dir, fontFamily: HEAD,
      fontWeight: weight, fontSize: plan.titleSize, lineHeight: `${plan.titleBox}px`, color: C.ink, whiteSpace: 'nowrap'}}>{plan.titleLines.map((line, i) => <div key={i}>{line}</div>)}</div> : null}
    {plan.url ? <Piece id="pf-url" x={plan.inline ? 22 : w - plan.url.w - 14} y={plan.inline ? (plan.row - plan.url.h) / 2 + 6 : plan.row + 4} w={plan.url.w} h={plan.url.h} rot={0.4} color="#E9E4D2" shape={rectShape(3)} enter={{at: 12, from: [-80, 0], dur: 14}} depth={0.2} z={2} tight>
      <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', direction: 'ltr', fontFamily: MONO, fontWeight: 400, fontSize: plan.url.size, lineHeight: `${plan.url.box}px`, color: C.ink, whiteSpace: 'nowrap'}}>
        {plan.url.lines.map((line, i) => <div key={i}>{line}</div>)}</div>
    </Piece> : null}
    <Tape cx={w - 20} cy={plan.h - 12} len={96} h={38} rot={-34} at={30} from="r" id="pf-chrome-tape"/>
  </Piece>;
};

// ---------- planning the page ----------
type Item = {index: number; block: ProofBlock; x: number; y: number; w: number; h: number; fill: string; ink: string; rot: number; lines: string[]; size: number; box: number;
  tag?: {text: string; w: number; size: number}; stacked?: boolean; number?: {text: string; size: number; w: number}; photoH?: number;
  cap?: {lines: string[]; size: number; box: number; w: number}; label?: {lines: string[]; size: number; box: number}};
type PagePlan = {items: Item[]; height: number};
type Shown = (t: string | number) => string;

const DASH_CARDS = [
  {fill: C.card, ink: C.ink, num: C.terra}, {fill: C.teal, ink: C.card, num: C.card}, {fill: C.mustard, ink: C.ink, num: C.ink}, {fill: C.card, ink: C.ink, num: C.teal},
];

/** Every block cut to size at scale k (1 = the smallest type allowed): its text, tags and height. Positions come from the page layout. */
function sizeBlock(block: ProofBlock, index: number, page: ProofScreenData['page'], w: number, k: number, font: string, shown: Shown): Item {
  const base = {index, block, x: 0, y: 0, w, h: 0, fill: C.card as string, ink: C.ink as string, rot: [-0.5, 0.4, -0.3, 0.6][index % 4], lines: [] as string[], size: 0, box: 0};
  const headW = displayWeight(font, 'Reem Kufi', 700);
  const S = (size: number, min: number) => Math.max(min, Math.round(size * k));   // never below the smallest allowed size
  switch (block.kind) {
    case 'heading': {
      const t = fitBalanced(block.text, font, headW, {width: w - 68, size: S(66, 46), min: 46, lines: 3, lh: 1.15});
      return {...base, fill: C.mustard, lines: t.lines, size: t.size, box: t.box, h: t.lines.length * t.box + 44};
    }
    case 'text': {
      const t = fitBalanced(block.text, BODY, 700, {width: w - 60, size: S(46, 42), min: 42, lines: 6, lh: 1.32});
      return {...base, lines: t.lines, size: t.size, box: t.box, h: t.lines.length * t.box + 48};
    }
    case 'row': {
      const tagSize = S(52, 44), tag = block.value !== undefined ? {text: String(block.value), size: tagSize, w: Math.round(textW(shown(String(block.value)), LAT, tagSize, 700)) + 48} : undefined;
      const t = fitBalanced(block.text, BODY, 700, {width: w - (tag ? tag.w + 24 : 0) - 52, size: S(44, 42), min: 42, lines: 2, lh: 1.28});
      return {...base, lines: t.lines, size: t.size, box: t.box, tag, h: Math.max(t.lines.length * t.box + 44, tag ? Math.round(tagSize * 1.15) + 28 : 0)};
    }
    case 'stat': {
      const stacked = page === 'dashboard' && w < BW - 1, style = DASH_CARDS[index % 4];
      const text = String(block.value), per = textW(shown(text), LAT, 100, 700) / 100;
      const room = stacked ? w - 44 : Math.round(w * 0.46);
      const size = Math.floor(Math.min(S(stacked ? 112 : 96, 64), room / per));
      const label = block.text ? fitBalanced(block.text, BODY, 700, {width: stacked ? w - 44 : w - room - 76, size: S(42, 40), min: 40, lines: 2, lh: 1.28}) : null;
      const h = stacked ? Math.round(size * 0.92) + (label ? label.lines.length * label.box + 14 : 0) + 44 : Math.max(Math.round(size * 0.95), label ? label.lines.length * label.box : 0) + 48;
      return {...base, fill: stacked ? style.fill : C.card, ink: stacked ? style.ink : C.ink, number: {text, size, w: Math.round(per * size)}, label: label ? {lines: label.lines, size: label.size, box: label.box} : undefined, stacked, size, h};
    }
    case 'button': {
      const t = fitBalanced(block.text, BODY, 800, {width: w - 60, size: S(54, 44), min: 44, lines: 2, lh: 1.25});
      return {...base, fill: C.terra, ink: C.card, lines: t.lines, size: t.size, box: t.box, h: Math.max(Math.round(112 * Math.min(Math.max(k, 0.9), 1.3)), t.lines.length * t.box + 52)};
    }
    case 'image': {
      const photoH = Math.round(300 * Math.min(Math.max(k, 0.85), 1.4)), cap = block.text ? fitBalanced(block.text, BODY, 700, {width: w - 150, size: 42, min: 40, lines: 2, lh: 1.25}) : null;
      return {...base, photoH, cap: cap ? {lines: cap.lines, size: cap.size, box: cap.box, w: Math.round(cap.width + 64)} : undefined, h: photoH + 32 + (cap ? cap.lines.length * cap.box + 6 : 0)};
    }
  }
}

/** Places the blocks: one column for a web page, rows of stat cards for a dashboard, alternating sides for a chat page. */
function layoutPage(blocks: ProofBlock[], page: ProofScreenData['page'], k: number, font: string, shown: Shown): PagePlan {
  const items: Item[] = [];
  let y = 0;
  if (page === 'dashboard') {
    const half = Math.floor((BW - GAP) / 2), rows: Item[][] = [];
    let open: Item[] | null = null;
    blocks.forEach((block, i) => {
      if (block.kind !== 'stat') { open = null; rows.push([sizeBlock(block, i, page, BW, k, font, shown)]); return; }
      const card = sizeBlock(block, i, page, half, k, font, shown);
      if (open) { open.push(card); open = null; } else { open = [card]; rows.push(open); }
    });
    rows.forEach(row => {
      const cells = row.length === 1 && row[0].block.kind === 'stat' ? [sizeBlock(row[0].block, row[0].index, page, BW, k, font, shown)] : row;
      const rowH = Math.max(...cells.map(cell => cell.h));
      cells.forEach((cell, c) => { cell.h = rowH; cell.y = y; cell.x = cells.length === 1 ? LANE_L : c === 0 ? LANE_L + half + GAP : LANE_L; items.push(cell); });
      y += rowH + GAP;
    });
  } else {
    blocks.forEach((block, i) => {
      const w = page === 'chat' ? Math.round(BW * 0.82) : BW;
      const item = sizeBlock(block, i, page, w, k, font, shown);
      if (page === 'chat' && (block.kind === 'text' || block.kind === 'row' || block.kind === 'stat')) item.fill = i % 2 ? C.mustard : C.card;
      item.y = y; item.x = page === 'chat' && i % 2 ? LANE_L : LANE_R - w;
      items.push(item); y += item.h + GAP;
    });
  }
  return {items, height: Math.max(0, y - GAP)};
}

/**
 * The whole page at the largest scale that fits (a short page grows to fill the window), its vertical offset, and the camera's final scroll.
 * A long page scrolls to a block boundary so the block at the top is whole, and the focus block is always inside the window.
 */
function planCollage(d: ProofScreenData, vpH: number, font: string, shown: Shown) {
  const usable = vpH - UNDER_CHROME - LIP;
  let plan = layoutPage(d.blocks, d.page, 1, font, shown);
  for (let k = 1.6; k >= 0.849; k -= 0.05) {
    const candidate = layoutPage(d.blocks, d.page, k, font, shown);
    if (candidate.height <= usable - 2 * PAD_Y) { plan = candidate; break; }
  }
  const overflow = plan.height + 2 * PAD_Y > usable;
  const lift = UNDER_CHROME + (overflow ? PAD_Y : (usable - plan.height) / 2);
  plan.items.forEach(item => { item.y += lift; });
  const total = Math.max(vpH, plan.height + lift + PAD_Y + LIP);
  const focus = plan.items.find(item => item.index === (d.focus ?? 0)) ?? plan.items[0];
  let target = 0;
  if (overflow) {
    const centred = clamp(focus.y + focus.h / 2 - vpH / 2, 0, total - vpH);
    const top = (t: number) => t + UNDER_CHROME, bottom = (t: number) => t + vpH - LIP;
    const holds = (t: number) => focus.y >= top(t) && focus.y + focus.h <= bottom(t);
    // Every block is either whole or hidden at the end of the pan: prefer the offset that cuts the fewest, then the one nearest the centre.
    const cut = (t: number) => plan.items.filter(item => item.y + item.h > top(t) + 1 && item.y < bottom(t) - 1 && (item.y < top(t) - 1 || item.y + item.h > bottom(t) + 1)).length;
    const options = [...plan.items.flatMap(item => [item.y - UNDER_CHROME - PAD_Y, item.y + item.h - (vpH - LIP) + PAD_Y]), total - vpH].map(t => clamp(t, 0, total - vpH)).filter(holds);
    target = options.length ? options.reduce((best, t) => (cut(t) < cut(best) || (cut(t) === cut(best) && Math.abs(t - centred) < Math.abs(best - centred)) ? t : best)) : centred;
  }
  return {items: plan.items, total, target, focus};
}

// ---------- the collage ----------
const arrowShape = (ar: boolean) => (w: number, h: number): Pt[] => {
  const pts: Pt[] = [[0, h * 0.3], [w * 0.5, h * 0.3], [w * 0.5, 0], [w, h / 2], [w * 0.5, h], [w * 0.5, h * 0.7], [0, h * 0.7]];
  return ar ? pts : pts.map(([x, y]) => [w - x, y] as Pt);
};

const Collage: React.FC<{d: ProofScreenData}> = ({d}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const probe = useProbe(), shown = useDesignText();
  const {HEAD, copy} = useKit();
  const chrome = useChrome(d);
  const vpTop = EDGE + 8 + chrome.h - UNDER_CHROME, vpH = PANEL_H - 30 - vpTop;
  const focus = d.focus ?? 0;
  const key = JSON.stringify([d.page, d.blocks, d.focus, HEAD, vpH, shown('0123456789')]);
  const page = React.useMemo(() => planCollage(d, vpH, HEAD, shown), [key]);  // eslint-disable-line react-hooks/exhaustive-deps
  const camera = proofCameraAt(f, fps, d.path, probe !== null);
  const buildEnd = 10 + d.blocks.length * 4;
  const panAt = Math.max(proofFocusFrame(fps) + 12, buildEnd + 8), panEnd = page.target > 0 ? panAt + SCROLL_FRAMES : panAt;
  const focusAt = panEnd + 4, tapeAt = focusAt + 14;
  const scroll = page.target * ramp(f, panAt, SCROLL_FRAMES, INOUT3);
  const hl = ramp(f, focusAt, 10);
  const fi = page.focus;
  const arrowY = clamp(vpTop + fi.y + fi.h / 2 - page.target - ARROW_H / 2, vpTop + UNDER_CHROME - 6, vpTop + vpH - LIP - ARROW_H + 6);
  // A block that is partly tucked under the chrome or the lip fades out whole rather than showing a sliver.
  const share = (item: Item) => clamp((Math.min(item.y + item.h - scroll, vpH - LIP) - Math.max(item.y - scroll, UNDER_CHROME)) / item.h, 0, 1);
  return <div style={{position: 'absolute', inset: 0, perspective: 1600, perspectiveOrigin: ORIGIN}}>
    <div style={{position: 'absolute', inset: 0, transformOrigin: ORIGIN, transform: `translate(${camera.x}px, ${camera.y}px) rotateX(${camera.rotateX}deg) rotateY(${camera.rotateY}deg) scale(${camera.scale})`}}>
      <Piece id="pf-panel" x={PANEL_X} y={PANEL_TOP} w={PANEL_W} h={PANEL_H} rot={-0.4} color={C.teal} shape={rectShape(5)} enter={{at: 0, from: [0, -300], dur: 18, rot: 3}} depth={1.1} z={2}>
        <div style={{position: 'absolute', left: EDGE, top: vpTop, width: PANEL_W - 2 * EDGE, height: vpH, background: 'rgba(8,28,32,0.26)', borderRadius: 4}}/>
        <div style={{position: 'absolute', left: 0, top: vpTop, width: PANEL_W, height: vpH, overflow: 'hidden'}}>
          <div style={{position: 'absolute', left: 0, top: 0, width: PANEL_W, height: page.total, transform: `translateY(${-scroll}px)`}}>
            {page.items.map(item => {
              const isFocus = item.index === focus, seen = share(item);
              const fade = seen >= 0.999 ? 1 : clamp((seen - 0.93) / 0.07, 0, 1);
              return <div key={item.index} data-proof-block={item.index} data-proof-focus={isFocus ? 'true' : undefined} style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', zIndex: isFocus ? 20 : 1, opacity: fade, filter: isFocus || hl === 0 ? undefined : `brightness(${1 - 0.07 * hl})`,
                transformOrigin: `${item.x + item.w / 2}px ${item.y + item.h / 2}px`, transform: isFocus ? `scale(${1 + 0.035 * hl})` : undefined}}>
                {isFocus ? <Piece id={`pf-under-${item.index}`} x={item.x - 8} y={item.y + 6} w={item.w + 16} h={item.h + 10} rot={2.2} color={item.fill === C.terra ? C.ink : C.terra} shape={rectShape(6)} enter={{at: focusAt, from: [0, -60], dur: 12, rot: 0}} depth={0.5} z={0}/> : null}
                <BlockPiece item={item} at={10 + item.index * 4} isFocus={isFocus} tapeAt={tapeAt}/>
              </div>;
            })}
          </div>
        </div>
        {page.total > vpH ? <>
          <div style={{position: 'absolute', [copy.side]: EDGE + 8, top: vpTop + UNDER_CHROME + 6, width: 14, height: vpH - LIP - UNDER_CHROME - 12, borderRadius: 7, background: 'rgba(255,254,247,0.34)'}}/>
          <div style={{position: 'absolute', [copy.side]: EDGE + 8, top: vpTop + UNDER_CHROME + 6 + (vpH - LIP - UNDER_CHROME - 12) * (scroll / page.total), width: 14, height: (vpH - LIP - UNDER_CHROME - 12) * (vpH / page.total), borderRadius: 7, background: C.mustard, boxShadow: '0 2px 3px rgba(0,0,0,0.3)'}}/>
        </> : null}
        <Piece id="pf-lip" x={0} y={vpTop + vpH - LIP} w={PANEL_W} h={PANEL_H - (vpTop + vpH - LIP)} color={C.teal} shape={rectShape(3, 2.4, 80)} enter={{at: 2, from: [0, 80], dur: 14, rot: 0}} depth={0.4} z={26}/>
        <Chrome plan={chrome}/>
        <Piece id="pf-arrow" x={-12} y={arrowY} w={ARROW_W} h={ARROW_H} rot={-3} color={C.terra} shape={polyShape(arrowShape(copy.ar), 2)} enter={{at: focusAt, from: [-110, -150], dur: 15, rot: -12}} depth={0.9} z={40}>
          <Tape cx={30} cy={ARROW_H / 2} len={84} h={34} rot={90} at={tapeAt} id="pf-arrow-tape"/>
        </Piece>
      </Piece>
    </div>
  </div>;
};

const BlockPiece: React.FC<{item: Item; at: number; isFocus: boolean; tapeAt: number}> = ({item, at, isFocus, tapeAt}) => {
  const {HEAD, copy} = useKit();
  const {block, w, h} = item;
  const id = `pf-b${item.index}`;
  const headW = displayWeight(HEAD, 'Reem Kufi', 700);
  const slap = isFocus ? <Tape cx={copy.ar ? w - 40 : 40} cy={10} len={150} h={52} rot={copy.ar ? 34 : -34} at={tapeAt} from={copy.ar ? 'r' : 'l'} id={`${id}-slap`}/> : null;
  const text = (top: number, size: number, box: number, lines: string[], color: string, family: string, weight: number, inset: number, extra?: React.CSSProperties) =>
    <div style={{position: 'absolute', left: inset, right: inset, top, direction: copy.dir, textAlign: copy.align, fontFamily: family, fontWeight: weight, fontSize: size, lineHeight: `${box}px`, color, whiteSpace: 'nowrap', ...extra}}>{lines.map((line, i) => <div key={i}>{line}</div>)}</div>;
  const piece = (children: React.ReactNode) => <Piece id={id} x={item.x} y={item.y} w={w} h={h} rot={item.rot} color={item.fill} shape={rectShape(5)} enter={{at, from: [0, -90], dur: 13}} depth={0.6} z={3}>{children}{slap}</Piece>;
  switch (block.kind) {
    case 'heading':
      return piece(<>{text(22, item.size, item.box, item.lines, C.ink, HEAD, headW, 34)}{isFocus ? null : <Tape cx={copy.ar ? 30 : w - 30} cy={8} len={92} h={36} rot={copy.ar ? -34 : 34} at={at + 14} id={`${id}-t`}/>}</>);
    case 'text':
      return piece(text(24, item.size, item.box, item.lines, C.ink, BODY, 700, 30));
    case 'row':
      return piece(<>
        {text((h - item.lines.length * item.box) / 2 + 1, item.size, item.box, item.lines, C.ink, BODY, 700, 26, item.tag ? {[copy.side === 'right' ? 'left' : 'right']: item.tag.w + 40} : undefined)}
        {item.tag ? <Piece id={`${id}-tag`} x={14} y={(h - Math.round(item.tag.size * 1.15)) / 2} w={item.tag.w} h={Math.round(item.tag.size * 1.15)} rot={-1.6} color={C.teal} shape={rectShape(4)} enter={{at: at + 8, from: [0, -50], dur: 12}} depth={0.4} z={4}>
          <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'ltr'}}><CutNumeral text={item.tag.text} size={item.tag.size} color={C.card} lift={0}/></div>
        </Piece> : null}
      </>);
    case 'stat': {
      const num = item.number!, numColor = item.stacked ? DASH_CARDS[item.index % 4].num : C.terra;
      return piece(item.stacked
        ? <>
          <div style={{position: 'absolute', left: 0, right: 0, top: 18, display: 'flex', justifyContent: 'center', direction: 'ltr'}}><CutNumeral text={num.text} size={num.size} color={numColor} lift={0}/></div>
          {item.label ? text(18 + Math.round(num.size * 0.92) + 6, item.label.size, item.label.box, item.label.lines, item.ink, BODY, 700, 22, {textAlign: 'center'}) : null}
        </>
        : <>
          <div style={{position: 'absolute', [copy.side]: 34, top: 0, height: h, display: 'flex', alignItems: 'center', direction: 'ltr'}}><CutNumeral text={num.text} size={num.size} color={numColor} lift={0}/></div>
          {item.label ? text((h - item.label.lines.length * item.label.box) / 2, item.label.size, item.label.box, item.label.lines, C.ink, BODY, 700, 30, {[copy.side]: num.w + 70}) : null}
        </>);
    }
    case 'button':
      return <>
        <Piece id={`${id}-sh`} x={item.x + 6} y={item.y + 10} w={w} h={h} rot={item.rot} color="#8F3F25" shape={rectShape(5)} enter={{at, from: [0, -90], dur: 13}} depth={0.3} z={2} tight/>
        {piece(<div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: copy.dir, fontFamily: BODY, fontWeight: 800, fontSize: item.size, lineHeight: `${item.box}px`, color: C.card, whiteSpace: 'nowrap'}}>
          {item.lines.map((line, i) => <div key={i}>{line}</div>)}</div>)}
      </>;
    case 'image':
      return piece(<>
        <div style={{position: 'absolute', left: 16, top: 16, width: w - 32, height: item.photoH, overflow: 'hidden', background: C.ink}}>
          <Img src={staticFile(block.src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 40%'}}/>
        </div>
        {item.cap ? <Piece id={`${id}-cap`} x={w - item.cap.w - 34} y={h - item.cap.lines.length * item.cap.box - 22} w={item.cap.w} h={item.cap.lines.length * item.cap.box + 16} rot={1.4} color={C.mustard} shape={rectShape(4)} enter={{at: at + 10, from: [-80, 20], dur: 12}} depth={0.4} z={4}>
          {text(8, item.cap.size, item.cap.box, item.cap.lines, C.ink, BODY, 700, 0, {textAlign: 'center'})}
        </Piece> : null}
        <Tape cx={copy.ar ? 30 : w - 30} cy={10} len={100} h={38} rot={copy.ar ? -34 : 34} at={at + 14} id={`${id}-t`}/>
      </>);
  }
};
