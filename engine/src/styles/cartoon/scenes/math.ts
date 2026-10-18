// Cartoon: constants, palettes, geometry and the timeline that every renderer, script and test shares.
// Node-safe (scripts and setup import it before `npm ci`): no packages, no JSX, no imports.
// Every time is authored in seconds and turned into frames with the edit's fps.

export const CARTOON_FAMILIES = ['cartoon', 'cartoon-ending'] as const;
export type CartoonFamily = (typeof CARTOON_FAMILIES)[number];
/** The brief's `sourceKind` for a cartoon video: the recorded picture is never shown, so the edit has no presenter. */
export const CARTOON_SOURCE_KIND = 'cartoon' as const;

export const THEMES = ['light', 'dark', 'pink'] as const;
export type Theme = (typeof THEMES)[number];
export type Ground = 'paper' | 'night';
export const groundOf = (theme: Theme): Ground => (theme === 'dark' ? 'night' : 'paper');

export type Palette = {ground: string; ink: string; accent: string; accentInk: string; onAccent: string; card: string; line: string; dim: string; shadow: string; pill: string; pillText: string};
/** Per-act palettes. Text uses `accentInk`; fills, glow, halftone and stamps use `accent`. A test measures every text pair at 4.5:1. */
export const PALETTES: Record<Theme, Palette> = {
  light: {ground: '#EEEBE4', ink: '#141414', accent: '#E8472B', accentInk: '#BF3D27', onAccent: '#141414', card: '#FFFFFF', line: 'rgba(20,20,20,0.09)', dim: '#555552', shadow: '0 22px 50px rgba(40,30,20,0.16)', pill: '#141414', pillText: '#FFFFFF'},
  dark: {ground: '#0D0D0E', ink: '#F4F3EE', accent: '#D5F53B', accentInk: '#D5F53B', onAccent: '#141414', card: '#17181A', line: 'rgba(255,255,255,0.12)', dim: '#AFAEAB', shadow: '0 24px 60px rgba(0,0,0,0.55)', pill: '#F4F3EE', pillText: '#141414'},
  pink: {ground: '#EEEBE4', ink: '#141414', accent: '#FF3D8B', accentInk: '#C0326B', onAccent: '#141414', card: '#FFFFFF', line: 'rgba(20,20,20,0.09)', dim: '#555552', shadow: '0 22px 50px rgba(40,30,20,0.16)', pill: '#141414', pillText: '#FFFFFF'},
};

/** The Instagram Reels organic safe area the delivery gate checks. */
export const SAFE = {top: 250, bottom: 1470, left: 65, right: 1015, railX: 853, railY: 1150} as const;
export const W = 1080, H = 1920;
/** The headline column (RTL, top-right anchored). */
export const HEADLINE = {left: 65, top: 318, width: 950, arabicSize: 84, latinSize: 96, lineHeight: 1.3, gap: 22, maxLines: 3, maxLinesOverMonitor: 2, riseSeconds: 0.2, risePx: 22, flipFadeSeconds: 0.12} as const;
/** The top band: tag on the right, counter on the left. */
export const BAND = {top: 262, side: 65, size: 26, typeSeconds: 0.35, fadeSeconds: 0.3, popSeconds: 0.35} as const;
/** Where cards sit. The monitor card alone starts at y 600; nodes rings may reach y 1290. */
export const CARD_BAND = {top: 680, bottom: 1110, left: 65, right: 1015} as const;
export const MONITOR_TOP = 600;
export const CARD = {enterSeconds: 0.42, exitSeconds: 0.25, rise: 60, scaleFrom: 0.86, popSeconds: 0.38, radius: 28, afterFlipSeconds: 0.2} as const;
/** The circle reveal: radius 0 to 2400 px over 0.36 s with bezier(0.65, 0, 0.35, 1). */
export const REVEAL = {seconds: 0.36, radius: 2400} as const;
/** Where a flip lands relative to the next sentence's first onset and the previous sentence's last onset. */
export const FLIP = {lead: 0.36, after: 0.06, min: 0.2, max: 0.5} as const;
export const ACT_MIN_SECONDS = 3;
export const TAIL = {fadeSeconds: 0.3, slideSeconds: 0.5, place: {x: 540, scale: 1}} as const;

export const CARD_KINDS = ['term', 'windows', 'fan', 'code', 'link', 'grid', 'crossed', 'stack', 'nodes', 'morph', 'monitor', 'timer'] as const;
export type CardKind = (typeof CARD_KINDS)[number];
export const SHAPES = ['circle', 'triangle', 'square', 'pill'] as const;
export type Shape = (typeof SHAPES)[number];
export const ICONS = ['mail', 'folder', 'database', 'calendar', 'cpu', 'smartphone', 'monitor', 'send', 'search', 'shield', 'zap', 'file-text', 'image', 'music', 'video', 'globe', 'lock', 'clock', 'wrench', 'box', 'layers', 'terminal', 'message-square', 'user'] as const;
export type IconName = (typeof ICONS)[number];

// ---- easing (same curves as core/motion.ts, re-implemented so this file stays import-free) ----
const bezier = (x1: number, y1: number, x2: number, y2: number) => (p: number): number => {
  if (!(p > 0)) return 0;
  if (p >= 1) return 1;
  const q = p;
  // Solve the cubic bezier for t by bisection (24 steps), then return y(t).
  const cx = (t: number) => 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t;
  const cy = (t: number) => 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i += 1) { const mid = (lo + hi) / 2; if (cx(mid) < q) lo = mid; else hi = mid; }
  return cy((lo + hi) / 2);
};
export const EASE = {
  morph: bezier(0.65, 0, 0.35, 1),
  slide: bezier(0.16, 1, 0.3, 1),
  expoOut: (p: number): number => (p >= 1 ? 1 : p <= 0 ? 0 : 1 - Math.pow(2, -10 * p)),
  backOut: (p: number, s = 1.70158): number => { const q = Math.max(0, Math.min(1, p)) - 1; return q * q * ((s + 1) * q + s) + 1; },
  bell: (p: number): number => Math.sin(Math.max(0, Math.min(1, p)) * Math.PI),
} as const;
export const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

// ---- the mouth table (built at prepare time by scripts/lib/mouth-table.mjs) ----
/** One openness value (0..1) per edit frame, calibrated on the recording itself. */
export type MouthTable = {version: number; fps: number; values: number[]; calibration: Record<string, number | null>; source?: string; segments?: unknown; identity?: string};

// ---- word anchors ----
export type WordAnchor = {word: number; dt?: number};
export type WordLike = {sourceIndex: number; fromFrame: number; toFrame: number; text: string};
export type WordIndex = Map<number, WordLike>;
export const wordIndex = (words: readonly WordLike[]): WordIndex => new Map(words.map((word) => [word.sourceIndex, word]));
/** The edit frame of an anchor, or null when the word is not in the index. */
export const anchorFrame = (anchor: WordAnchor, index: WordIndex, fps: number): number | null => {
  const word = index.get(anchor.word);
  if (!word) return null;
  return word.fromFrame + Math.round((anchor.dt ?? 0) * fps);
};

// ---- reveal ----
export const revealRadius = (seconds: number): number => REVEAL.radius * EASE.morph(clamp01(seconds / REVEAL.seconds));
/** Frames after a flip at which text, cards and the glow switch to the new ink: the first frame whose radius covers the farthest ground-level text corner. */
export const inkFlipOffset = (origin: {x: number; y: number}, fps: number): number => {
  const bottom = HEADLINE.top + HEADLINE.maxLines * HEADLINE.arabicSize * HEADLINE.lineHeight;
  const corners = [[HEADLINE.left, BAND.top], [HEADLINE.left + HEADLINE.width, BAND.top], [HEADLINE.left, bottom], [HEADLINE.left + HEADLINE.width, bottom]];
  const need = Math.max(...corners.map(([x, y]) => Math.hypot(x - origin.x, y - origin.y)));
  const last = Math.ceil(REVEAL.seconds * fps);
  for (let k = 1; k <= last; k += 1) if (revealRadius(k / fps) >= need) return k;
  return last;
};
/** The flip frame for an act whose first sentence starts at `nextOnset` and whose predecessor's last word starts at `prevLastOnset` (same time base). */
export const flipFrameFor = (nextOnset: number, prevLastOnset: number, fps: number): number =>
  Math.round(Math.max(nextOnset - FLIP.lead * fps, prevLastOnset + FLIP.after * fps));

// ---- headline width estimate ----
// Average advance per character class at 84 px Plex Display 700 (Arabic) and 96 px Source Serif italic (Latin); conservative by design.
const ARABIC = /[؀-ۿ]/;
const WIDE_ARABIC = /[معهسشصضطظكلـ]/;
export const tokenWidth = (text: string): number => {
  let width = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) width += 24;
    else if (ARABIC.test(ch)) width += WIDE_ARABIC.test(ch) ? 46 : 30;
    else if (/[0-9]/.test(ch)) width += 48;
    else if (/[A-Z]/.test(ch)) width += 62;
    else width += 46;
  }
  return width;
};
export const estimateHeadlineLines = (texts: readonly string[], width: number = HEADLINE.width): number => {
  let lines = 1, used = 0;
  for (const text of texts) {
    const w = Math.min(width, tokenWidth(text));
    if (used === 0) used = w;
    else if (used + HEADLINE.gap + w <= width) used += HEADLINE.gap + w;
    else { lines += 1; used = w; }
  }
  return lines;
};
export const hasLatin = (text: string): boolean => /[A-Za-z0-9]/.test(text);

// ---- data shapes the timeline reads (the zod schema narrows them) ----
export type ActIn = {theme: Theme; sentence: number; tag: string};
export type SentenceIn = {from: number; to: number};
export type CounterIn = null | {kind: 'sections'} | {kind: 'seconds'; total: number; saidAt: WordAnchor; stop: WordAnchor; label?: string};
export type CardIn = {id: string; kind: CardKind; from: WordAnchor; to: WordAnchor | 'flip'; data: Record<string, unknown>};
export type PlaceIn = {at: WordAnchor; x: number; scale: number};
export type GestureIn = {at: WordAnchor; arm?: 'r' | 'l' | 'auto'; kind: 'point' | 'open' | 'thumb' | 'fist' | 'wave' | 'rest'; anchor?: {card: string; point: string} | 'camera' | {x: number; y: number}; brow?: number; tilt?: number; look?: 'camera' | {x: number; y: number}};
export type BodyIn = {acts: readonly ActIn[]; sentences: readonly SentenceIn[]; accents?: readonly number[]; counter?: CounterIn; brackets?: boolean; cards: readonly CardIn[]; places?: readonly PlaceIn[]; gestures?: readonly GestureIn[]; tail?: {at: WordAnchor}};
export type SceneSpan = {fromFrame: number; durationInFrames: number};

export type SentenceT = {index: number; from: number; to: number; startFrame: number; endFrame: number; words: WordLike[]; lines: number};
export type ActT = {index: number; theme: Theme; tag: string; startSentence: number; flipFrame: number; endFrame: number};
export type CardT = {id: string; kind: CardKind; startFrame: number; endFrame: number; endsAtFlip: boolean; act: number; data: Record<string, unknown>};
export type CounterT = {kind: 'sections'; total: number} | {kind: 'seconds'; total: number; label: string; stopFrame: number} | null;
/** Every frame is scene-relative except the words, which keep their edit frames (subtract `sceneFrom`). */
export type Timeline = {sceneFrom: number; sentences: SentenceT[]; acts: ActT[]; cards: CardT[]; counter: CounterT; tailFrame: number | null; endFrame: number; issues: string[]};

const digitsOf = (text: string): string => text.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^0-9]/g, '');

/**
 * Turns the authored data plus the compiled words into scene-relative frames. Never throws: every fault is an issue
 * string the validator reports, so the editor can show it and the renderer can draw what resolves.
 */
export function resolveCartoonTimeline(data: BodyIn, scene: SceneSpan, words: readonly WordLike[], fps: number): Timeline {
  const issues: string[] = [];
  const end = scene.fromFrame + scene.durationInFrames;
  const inScene = words.filter((w) => w.fromFrame >= scene.fromFrame && w.fromFrame < end).sort((a, b) => a.fromFrame - b.fromFrame || a.sourceIndex - b.sourceIndex);
  const index = wordIndex(inScene);
  const local = (frame: number) => frame - scene.fromFrame;
  const frameOf = (anchor: WordAnchor, what: string): number | null => {
    const frame = anchorFrame(anchor, index, fps);
    if (frame === null) issues.push(`${what}: word ${anchor.word} is not inside this scene (cut away or outside its window)`);
    return frame === null ? null : local(frame);
  };
  // The tail is the recorded sign-off: its words belong to no sentence.
  const tailFrame = data.tail ? frameOf(data.tail.at, 'tail') : null;
  const spoken = tailFrame === null ? inScene : inScene.filter((w) => local(w.fromFrame) < tailFrame);
  // Sentences tile the spoken scene words in order.
  const sentences: SentenceT[] = [];
  let cursor = 0;
  data.sentences.forEach((s, i) => {
    const run = spoken.slice(cursor).filter((w) => w.sourceIndex >= s.from && w.sourceIndex <= s.to);
    if (!run.length || spoken[cursor]?.sourceIndex !== s.from) issues.push(`sentence ${i + 1}: sentences must tile the scene words in order (expected to start at word ${spoken[cursor]?.sourceIndex ?? 'none'})`);
    cursor += run.length;
    const lines = estimateHeadlineLines(run.map((w) => w.text));
    sentences.push({index: i, from: s.from, to: s.to, startFrame: run.length ? local(run[0].fromFrame) : 0, endFrame: 0, words: run, lines});
  });
  if (cursor !== spoken.length) issues.push(`sentences must tile the scene words in order (${spoken.length - cursor} word(s) are not covered)`);
  const last = tailFrame ?? scene.durationInFrames;
  sentences.forEach((s, i) => { s.endFrame = sentences[i + 1]?.startFrame ?? last; });
  // Acts and flips.
  const acts: ActT[] = [];
  data.acts.forEach((a, i) => {
    if (i === 0 && a.sentence !== 0) issues.push('act 1 must start at sentence 0');
    const s = sentences[a.sentence];
    if (!s) { issues.push(`act ${i + 1}: sentence ${a.sentence} does not exist`); return; }
    const prev = acts[acts.length - 1];
    if (prev && groundOf(prev.theme) === groundOf(a.theme)) issues.push(`act ${i + 1}: ${a.theme} after ${prev.theme} keeps the same ground; alternate paper and night`);
    if (prev && a.sentence <= prev.startSentence) issues.push(`act ${i + 1} must start at a later sentence than act ${i}`);
    const prevLast = sentences[a.sentence - 1]?.words.at(-1);
    const flipFrame = i === 0 ? 0 : flipFrameFor(s.startFrame, prevLast ? local(prevLast.fromFrame) : 0, fps);
    if (i > 0) {
      const lead = (s.startFrame - flipFrame) / fps;
      if (lead < FLIP.min - 1e-9 || lead > FLIP.max + 1e-9) issues.push(`act ${i + 1}: the flip lands ${lead.toFixed(2)} s before its sentence; the words around sentence ${a.sentence + 1} are too tight for a ${FLIP.min}..${FLIP.max} s lead`);
    }
    acts.push({index: i, theme: a.theme, tag: a.tag, startSentence: a.sentence, flipFrame, endFrame: 0});
  });
  acts.forEach((a, i) => {
    // The last act's ground stays through the sign-off tail, so it lasts to the scene end (the headline still stops at the tail).
    a.endFrame = acts[i + 1]?.flipFrame ?? scene.durationInFrames;
    if (a.endFrame - a.flipFrame < ACT_MIN_SECONDS * fps - 1e-9) issues.push(`act ${i + 1} lasts ${((a.endFrame - a.flipFrame) / fps).toFixed(2)} s; an act needs at least ${ACT_MIN_SECONDS} s`);
  });
  const actAt = (frame: number): number => { let k = 0; acts.forEach((a, i) => { if (a.flipFrame <= frame) k = i; }); return k; };
  // Cards.
  const cards: CardT[] = [];
  const ids = new Set<string>();
  data.cards.forEach((c, i) => {
    if (ids.has(c.id)) issues.push(`card ${c.id}: duplicate id`);
    ids.add(c.id);
    const start = frameOf(c.from, `card ${c.id}`);
    if (start === null) return;
    const act = actAt(start);
    let endFrame: number;
    if (c.to === 'flip') {
      const next = acts[act + 1];
      if (!next) { issues.push(`card ${c.id}: "flip" needs a following act`); return; }
      const laterInAct = data.cards.slice(i + 1).some((other) => { const f = anchorFrame(other.from, index, fps); return f !== null && actAt(local(f)) === act; });
      if (laterInAct) issues.push(`card ${c.id}: only the last card of an act may end at the flip`);
      endFrame = next.flipFrame + Math.round(CARD.afterFlipSeconds * fps);
    } else {
      const e = frameOf(c.to, `card ${c.id}`);
      if (e === null) return;
      endFrame = e;
    }
    if (endFrame <= start) issues.push(`card ${c.id}: ends before it starts`);
    const prev = cards[cards.length - 1];
    if (prev && start < prev.startFrame) issues.push(`card ${c.id}: cards must be listed in time order`);
    // A card that outlives its act's flip by 0.2 s may be followed by the next act's first card on the flip's sentence.
    if (prev && start < (prev.endsAtFlip ? prev.endFrame - Math.round(CARD.afterFlipSeconds * fps) : prev.endFrame)) issues.push(`card ${c.id}: overlaps card ${prev.id}`);
    if (c.kind === 'timer' && data.counter?.kind !== 'seconds') issues.push(`card ${c.id}: a timer card needs a seconds counter`);
    cards.push({id: c.id, kind: c.kind, startFrame: start, endFrame, endsAtFlip: c.to === 'flip', act, data: c.data});
  });
  // Headline lines, two at most over a monitor window.
  for (const s of sentences) {
    const overMonitor = cards.some((c) => c.kind === 'monitor' && c.startFrame < s.endFrame && c.endFrame > s.startFrame);
    const limit = overMonitor ? HEADLINE.maxLinesOverMonitor : HEADLINE.maxLines;
    if (s.lines > limit) issues.push(`sentence ${s.index + 1} needs about ${s.lines} headline lines; the limit is ${limit}${overMonitor ? ' over a monitor card' : ''}. Split it or shorten it`);
  }
  // Counter.
  let counter: CounterT = null;
  const c = data.counter === undefined ? {kind: 'sections' as const} : data.counter;
  if (c?.kind === 'sections') counter = {kind: 'sections', total: acts.length};
  else if (c?.kind === 'seconds') {
    const said = index.get(c.saidAt.word);
    if (!said || !digitsOf(said.text).includes(String(c.total))) issues.push(`counter: the word at saidAt (${said?.text ?? c.saidAt.word}) must contain the digits of ${c.total}; the counter only counts a number the recording states`);
    const stop = frameOf(c.stop, 'counter stop');
    if (stop !== null && said && stop <= local(said.fromFrame)) issues.push('counter: stop must come after saidAt');
    counter = {kind: 'seconds', total: c.total, label: c.label ?? 'SEC', stopFrame: stop ?? 0};
  }
  return {sceneFrom: scene.fromFrame, sentences, acts, cards, counter, tailFrame, endFrame: last, issues};
}

/** Frames a body scene needs: the last sentence's first onset plus one second, or the tail, whichever is later. */
export const cartoonMinFrames = (tl: Timeline, fps: number): number => Math.max(tl.tailFrame ?? 0, (tl.sentences.at(-1)?.startFrame ?? 0) + fps);

// ---- card layouts (canvas px) and the anchor points a gesture may name ----
export type Box = {x: number; y: number; w: number; h: number};
export const CARD_LAYOUT: Record<CardKind, Box> = {
  term: {x: 330, y: 740, w: 420, h: 230}, windows: {x: 150, y: 760, w: 780, h: 250}, fan: {x: 150, y: 706, w: 780, h: 354},
  code: {x: 120, y: 686, w: 840, h: 350}, link: {x: 150, y: 740, w: 780, h: 260}, grid: {x: 220, y: 700, w: 720, h: 406},
  crossed: {x: 150, y: 700, w: 780, h: 320}, stack: {x: 180, y: 620, w: 620, h: 330}, nodes: {x: 180, y: 740, w: 720, h: 330},
  morph: {x: 150, y: 690, w: 780, h: 344}, monitor: {x: 100, y: 600, w: 880, h: 414}, timer: {x: 190, y: 720, w: 700, h: 250},
};
/** The term card's type size: 96 px serif italic for Latin and 80 px display for Arabic, shrunk (never below 32 px) so the
 * estimated width fits inside the card's 24 px side margins; a 16-character term would otherwise run past the card. */
export const termFontSize = (term: string, latin: boolean): number => {
  const base = latin ? 96 : 80, inner = CARD_LAYOUT.term.w - 48;
  const width = (tokenWidth(term) * base) / (latin ? 96 : 84);
  return Math.max(32, Math.floor(base * Math.min(1, inner / width)));
};
type Pt = {x: number; y: number};
const centreOf = (b: Box): Pt => ({x: b.x + b.w / 2, y: b.y + b.h / 2});
const countOf = (value: unknown, max: number): number => Math.min(max, Array.isArray(value) ? value.length : 0);
/** Named points on a card in canvas px, RTL: item 0 sits on the right. */
export function cardAnchors(card: Pick<CardT, 'kind' | 'data'>): Record<string, Pt> {
  const box = CARD_LAYOUT[card.kind], out: Record<string, Pt> = {centre: centreOf(box)};
  const row = (n: number, y: number, key: string) => { for (let i = 0; i < n; i += 1) out[`${key}${i}`] = {x: box.x + box.w - (box.w / n) * (i + 0.5), y}; };
  const d = card.data as Record<string, unknown>;
  switch (card.kind) {
    case 'term': row(countOf(d.glyphs, 3), box.y + box.h - 40, 'glyph'); break;
    case 'windows': out.right = {x: 780, y: 885}; out.left = {x: 300, y: 885}; out.link = {x: 540, y: 885}; break;
    case 'fan': row(countOf(d.items, 4), box.y + box.h / 2 + 60, 'item'); out.caption = {x: 540, y: box.y - 16}; break;
    case 'code': row(countOf(d.lines, 4), box.y + 90, 'line'); break;
    case 'link': out.right = {x: 765, y: 870}; out.left = {x: 300, y: 870}; out.stamp = {x: 760, y: 712}; out.cable = {x: 540, y: 870}; break;
    case 'grid': {
      const items = countOf(d.items, 6);
      for (let i = 0; i < items; i += 1) out[`item${i}`] = {x: 830 - (i % 3) * 240, y: 778 + Math.floor(i / 3) * 170};
      out.picked = out[`item${typeof d.picked === 'number' ? d.picked : 0}`] ?? out.centre;
      out.command = {x: 705, y: 1095};
      break;
    }
    case 'crossed': out.cross = {x: 540, y: 860}; break;
    case 'stack': out.layer0 = {x: 490, y: 875}; out.layer1 = {x: 490, y: 695}; out.stamp = {x: 330, y: 1010}; out.arrow = {x: 880, y: 800}; break;
    case 'nodes': row(countOf(d.nodes, 3), 805, 'node'); out.rings = {x: 540, y: 880}; break;
    case 'morph': row(countOf(d.items, 3), 845, 'item'); out.label = {x: 540, y: 1034}; break;
    case 'monitor': out.screen = {x: 540, y: 834}; break;
    case 'timer': break;
  }
  return out;
}

// ---- the narrator safe box ----
export type ExtentsLike = {headRight: number; headLeft: number; headTop: number; chinBottom: number};
export type PlaceT = {startFrame: number; x: number; scale: number};
/** The x range a place may use at a scale so the head stays out of the rail and inside the side margins (the extents already hold the worst tilt and lean). */
export const placeLimits = (scale: number, e: ExtentsLike): {min: number; max: number} => ({min: Math.ceil(SAFE.left + e.headLeft * scale), max: Math.floor(SAFE.railX - 1 - e.headRight * scale)});
/** The narrator safe box: the head never enters the action rail or the side margin, the chin stays above the bottom limit and the head below the top one. */
export function narratorSafeIssues(places: readonly PlaceT[], e: ExtentsLike): string[] {
  const issues: string[] = [];
  places.forEach((p, i) => {
    const lim = placeLimits(p.scale, e);
    if (p.x > lim.max) issues.push(`place ${i + 1}: x ${p.x} puts the head inside the action rail; the limit at scale ${p.scale} is ${lim.max}`);
    if (p.x < lim.min) issues.push(`place ${i + 1}: x ${p.x} puts the head past the left margin; the limit at scale ${p.scale} is ${lim.min}`);
    if (1450 + e.chinBottom * p.scale > SAFE.bottom - 1) issues.push(`place ${i + 1}: the chin crosses the bottom limit`);
    if (1450 - e.headTop * p.scale < SAFE.top) issues.push(`place ${i + 1}: the head crosses the top limit`);
  });
  return issues;
}

// ---- derived staging (used when the data gives none) ----
export const SCALE = {hook: 0.94, body: 0.86, tail: 1} as const;
const SIDE = {right: [160, 220], left: [365, 470]} as const;
const firstPointed = (card: Pick<CardT, 'kind' | 'data'>): Pt => {
  const a = cardAnchors(card);
  const names = Object.keys(a).filter((k) => k !== 'centre');
  return names.length ? a[names[0]] : a.centre;
};
/** Cards whose anchors sit on both sides keep the narrator in the centre. */
const symmetric = (card: Pick<CardT, 'kind'>): boolean => ['windows', 'fan', 'morph', 'nodes'].includes(card.kind);
/** Places when the data has none: centre for the hook, opposite the first pointed anchor for each card (at least 1.4 s apart), centre at full size for the tail. */
export function derivePlaces(tl: Timeline, e: ExtentsLike, fps: number): PlaceT[] {
  const places: PlaceT[] = [{startFrame: 0, x: 540, scale: SCALE.hook}];
  const lead = Math.round(0.1 * fps), minGap = Math.round(1.4 * fps);
  const tailSlide = tl.tailFrame === null ? null : tl.tailFrame - Math.round(TAIL.slideSeconds * fps);
  for (const card of tl.cards) {
    const target = firstPointed(card);
    let x = 540;
    if (!symmetric(card)) x = target.x < 540 ? target.x + (SIDE.right[0] + SIDE.right[1]) / 2 : target.x - (SIDE.left[0] + SIDE.left[1]) / 2;
    const lim = placeLimits(SCALE.body, e);
    x = Math.round(Math.max(lim.min, Math.min(lim.max, x)));
    const startFrame = Math.max(0, card.startFrame - lead);
    const last = places[places.length - 1];
    if (startFrame - last.startFrame < minGap || (last.x === x && last.scale === SCALE.body)) continue;
    if (tailSlide !== null && startFrame >= tailSlide) continue;
    places.push({startFrame, x, scale: SCALE.body});
  }
  if (tailSlide !== null) places.push({startFrame: Math.max(places[places.length - 1].startFrame + 1, tailSlide), x: TAIL.place.x, scale: TAIL.place.scale});
  return places;
}
export type GestureKind = 'point' | 'open' | 'thumb' | 'fist' | 'wave' | 'rest';
export type GestureT = {frame: number; arm: 'l' | 'r' | 'auto'; kind: GestureKind; anchor?: Pt | 'camera'; brow?: number; tilt?: number; look?: 'camera' | Pt};
/** Gestures when the data has none: point at a card's main anchor, open hands toward arriving items, chin on a fist for code, a thumb on a stop, a wave in the tail. */
export function deriveGestures(tl: Timeline, places: readonly PlaceT[], fps: number): GestureT[] {
  const out: GestureT[] = [];
  tl.cards.forEach((card, i) => {
    const a = cardAnchors(card);
    if (card.kind === 'code') out.push({frame: card.startFrame, arm: 'l', kind: 'fist', brow: -0.6, tilt: -3});
    else if (symmetric(card)) {
      // Items arrive on both sides: both hands open toward the two halves of the card.
      const box = CARD_LAYOUT[card.kind];
      out.push({frame: card.startFrame, arm: 'r', kind: 'open', anchor: {x: a.centre.x + box.w / 4, y: a.centre.y}, brow: 0.5});
      out.push({frame: card.startFrame, arm: 'l', kind: 'open', anchor: {x: a.centre.x - box.w / 4, y: a.centre.y}, brow: 0.5});
    }
    else out.push({frame: card.startFrame, arm: 'auto', kind: 'point', anchor: firstPointed(card), brow: 0.6});
    if (card.kind === 'morph' || card.kind === 'timer') out.push({frame: Math.max(card.startFrame + 1, card.endFrame - Math.round(0.6 * fps)), arm: 'r', kind: 'thumb', brow: 0.8});
    // Hands come down 0.3 s after a card leaves, unless the next card has already taken them.
    const rest = card.endFrame + Math.round(0.3 * fps), next = tl.cards[i + 1];
    if ((tl.tailFrame === null || rest < tl.tailFrame) && (!next || next.startFrame > rest)) out.push({frame: rest, arm: 'auto', kind: 'rest'});
  });
  if (tl.counter?.kind === 'seconds') out.push({frame: tl.counter.stopFrame, arm: 'r', kind: 'thumb', brow: 0.6, look: 'camera'});
  if (tl.tailFrame !== null) out.push({frame: tl.tailFrame, arm: 'r', kind: 'wave', brow: 0.5, look: 'camera'});
  void places;
  return out.sort((x, y) => x.frame - y.frame);
}

// ---- sound cues ----
export type CueKind = 'transition' | 'stamp' | 'swap' | 'click' | 'count' | 'reveal' | 'type';
type SceneLike = {family: string; fromFrame: number; durationInFrames: number; data?: unknown};
type EndingIn = {theme: Theme; tag: string; sentences: SentenceIn[]; accents?: number[]; tail?: {at: WordAnchor};
  comment?: {at: WordAnchor}; follow?: {at: WordAnchor; tapAt: WordAnchor}};

/** The timeline of a body or an ending scene without the zod schema (scripts call it on validated manifests). */
export function cartoonTimelineOf(scene: SceneLike, words: readonly WordLike[], fps: number): Timeline {
  if (scene.family === 'cartoon') return resolveCartoonTimeline(scene.data as BodyIn, scene, words, fps);
  const d = scene.data as EndingIn;
  return resolveCartoonTimeline({acts: [{theme: d.theme, sentence: 0, tag: d.tag}], sentences: d.sentences, accents: d.accents ?? [], counter: {kind: 'sections'}, brackets: false, cards: [], tail: d.tail}, scene, words, fps);
}

/** Scene-relative frame of a word anchor on the scene's words, or null when the word is not in the scene. */
export const frameOfAnchor = (tl: Timeline, index: WordIndex, anchor: WordAnchor | undefined, fps: number): number | null => {
  if (!anchor) return null;
  const frame = anchorFrame(anchor, index, fps);
  return frame === null ? null : frame - tl.sceneFrom;
};

/**
 * The sound cues of a cartoon scene, scene-relative and sorted. The body's act 1 has no reveal, so no transition on frame 0;
 * the ending's frame 0 is its flip. Words, entrances and the narrator stay silent; nothing sounds at or after the tail.
 */
export function cartoonCues(scene: SceneLike, words: readonly WordLike[], fps: number): {frame: number; kind: CueKind}[] {
  const tl = cartoonTimelineOf(scene, words, fps);
  const index = wordIndex(words.filter((w) => w.fromFrame >= scene.fromFrame && w.fromFrame < scene.fromFrame + scene.durationInFrames));
  const at = (anchor: WordAnchor | undefined) => frameOfAnchor(tl, index, anchor, fps);
  const s = (seconds: number) => Math.round(seconds * fps);
  const cues: {frame: number; kind: CueKind}[] = [];
  const add = (frame: number | null | undefined, kind: CueKind) => {
    if (typeof frame !== 'number' || frame < 0 || frame >= scene.durationInFrames || (tl.tailFrame !== null && frame >= tl.tailFrame)) return;
    cues.push({frame: Math.round(frame), kind});
  };
  tl.acts.forEach((a, i) => { if (i > 0 || scene.family === 'cartoon-ending') add(a.flipFrame, 'transition'); });
  for (const card of tl.cards) {
    const d = card.data as Record<string, WordAnchor | undefined> & {lines?: {at: WordAnchor}[]; stamp?: string};
    if (card.kind !== 'timer') add(card.startFrame + s(0.05), 'reveal');
    switch (card.kind) {
      case 'code': for (const line of d.lines ?? []) add(at(line.at), 'type'); break;
      case 'grid': add(at(d.pickAt), 'reveal'); add(at(d.runAt), 'type'); break;
      case 'link': add(at(d.stampAt) ?? (d.stamp ? card.startFrame + s(0.55) : null), d.stamp ? 'stamp' : 'reveal'); add(at(d.cableAt), 'swap'); break;
      case 'crossed': add(at(d.crossAt) ?? card.startFrame + s(0.6), 'stamp'); break;
      case 'stack': add(at(d.dropAt), 'stamp'); if (d.stamp) add(at(d.stampAt), 'stamp'); add(at(d.arrowAt), 'swap'); break;
      case 'windows': add(at(d.linkAt), 'swap'); break;
      case 'morph': add(at(d.morphAt), 'swap'); add(at(d.oneAt), 'reveal'); break;
      case 'nodes': add(at(d.ringsAt), 'swap'); break;
      default: break;
    }
  }
  if (tl.counter?.kind === 'seconds') add(tl.counter.stopFrame, 'count');
  if (scene.family === 'cartoon-ending') {
    const d = scene.data as EndingIn;
    for (const part of [d.comment, d.follow]) { const f = at(part?.at); if (f !== null) add(f + s(0.1), 'reveal'); }
    const tap = at(d.follow?.tapAt);
    if (tap !== null) { add(tap, 'click'); add(tap, 'count'); }
  }
  return cues.sort((a, b) => a.frame - b.frame);
}

// ---- idle life ----
/** Frames the mouth table is read ahead of the picture. Real 30 and 50 fps renders opened the mouth on the sound's own frame (mean offset about 5 ms), so no lead. */
export const MOUTH_LEAD_FRAMES = 0;
/** A stable 32-bit seed from a text (FNV-1a), so every scene id blinks on its own schedule. */
export const seedOf = (text: string): number => { let h = 2166136261; for (const ch of text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const frac = (n: number): number => n - Math.floor(n);
/** 0..1 blink amount at a frame: 0.14 s bells at deterministic gaps of 2.3..3.7 s from the seed, the first at 1.6 s. */
export function blinkAt(frame: number, fps: number, seed: number): number {
  let t = 1.6, i = 0;
  const now = frame / fps;
  while (t <= now && i < 10000) {
    if (now < t + 0.14) return EASE.bell((now - t) / 0.14);
    t += 2.3 + 1.4 * frac(Math.sin((seed % 100003) * 0.001 + i * 12.9898) * 43758.5453);
    i += 1;
  }
  return 0;
}
/** The nod on every word onset: a 0.22 s bell, overlaps added and capped at 1. */
export function nodAt(frame: number, onsets: readonly number[], fps: number): number {
  let sum = 0;
  for (const onset of onsets) { const p = (frame - onset) / (0.22 * fps); if (p >= 0 && p < 1) sum += EASE.bell(p); }
  return Math.min(1, sum);
}
