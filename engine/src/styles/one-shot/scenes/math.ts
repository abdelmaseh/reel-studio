// One-shot: the grammar, the timeline and the sound cues of a chain of worlds. Node-safe (the scripts and the
// setup import it before `npm ci`): no packages, no JSX, no imports.
//
// A one-shot scene is a single take. Every world hands the screen to the next one through something that was
// already on screen: a button that grows until it is the screen, a tile that becomes a text field, a send button that
// opens a circle. All times here are seconds from the scene's first frame; the renderer reads t = frame / fps and the
// validators scale by fps, so the same chain plays at 30, 50 and 60 fps.

export const ONE_SHOT_FAMILIES = ['one-shot'] as const;

export const STEP_KINDS = ['drop', 'field', 'toggle', 'stat', 'work'] as const;
export type StepKind = (typeof STEP_KINDS)[number];
export const MAX_STEPS = 4;
export const MAX_TYPED_WORDS = 6;
export const MAX_OPTIONS = 3;
export const MAX_JOBS = 4;

/** Seconds a sound starts before the moment it is cued at. Equal to `leadSec` in styles/one-shot/sound.json (a test keeps them equal). A transition is cued at the moment its world arrives, a swap at the middle of the move. */
export const LEAD = {transition: 0.85, swap: 0.5} as const;

const DARK: readonly StepKind[] = ['drop', 'field', 'stat'];
/** The two colours the worlds alternate between: a dark world and an accent world. */
export const stepTone = (kind: StepKind): 'dark' | 'accent' => (DARK.includes(kind) ? 'dark' : 'accent');

export type StepIn = {kind: StepKind; text?: string; options?: readonly {on?: boolean}[]; jobs?: readonly string[]};
export type ChainIn = {steps: readonly StepIn[]; closing?: {platforms?: readonly string[]}};

/** Why a list of steps cannot be chained. Empty means it can. */
export function chainIssues(steps: readonly StepIn[]): string[] {
  const issues: string[] = [];
  if (steps.length < 1 || steps.length > MAX_STEPS) issues.push(`a chain has 1 to ${MAX_STEPS} steps`);
  steps.forEach((step, index) => {
    const n = index + 1, prev = steps[index - 1];
    if (step.kind === 'work' && index !== steps.length - 1) issues.push(`step ${n} (work) must be the last step: the finished reel opens from it`);
    if (step.kind === 'drop' && steps[index + 1]?.kind !== 'field') issues.push(`step ${n} (drop) must be followed by a field step: the file becomes part of the sentence`);
    if (step.kind === 'toggle' && !(step.options ?? []).some((option) => option.on !== false)) issues.push(`step ${n} (toggle) needs at least one option that is switched on`);
    if (prev === undefined) {
      if (stepTone(step.kind) !== 'dark') issues.push(`step 1 (${step.kind}) must be a dark step (drop, field or stat): the home button swallows the screen into the dark`);
    } else if (prev.kind !== 'drop' && stepTone(prev.kind) === stepTone(step.kind)) {
      const need = stepTone(step.kind) === 'dark' ? 'an accent step (toggle or work)' : 'a dark step (drop, field or stat)';
      issues.push(`step ${n} (${step.kind}) follows step ${n - 1} (${prev.kind}) in the same colour: put ${need} between them`);
    }
  });
  const last = steps[steps.length - 1];
  if (last?.kind === 'toggle') issues.push('the last step cannot be a toggle: the finished reel opens on an accent colour; end with work or with a dark step');
  return issues;
}

export const DIGITS = ['١', '٢', '٣', '٤', '٥'] as const;
/** The two ways the style writes a number. Without the creator's choice it uses Arabic-Indic, its own look. */
export type DigitSet = 'latin' | 'arabic-indic';
export const digitOf = (n: number, set: DigitSet = 'arabic-indic'): string => {
  const k = Math.min(DIGITS.length, Math.max(1, n));
  return set === 'latin' ? String(k) : DIGITS[k - 1];
};

/**
 * Where things sit on the 1080 x 1920 canvas. Everything stays inside the Instagram Reels safe area that the delivery
 * gate checks (profile ig-reels-organic): nothing above y = 250 or below y = 1470, nothing within 65 px of a side, and
 * nothing at x >= 853 once y >= 1150 (the like / comment / share rail). Cards therefore sit in the band 700 to 1140,
 * where the full width is free; narrower things (the home button, the folder tile, the phone) may go lower on the left.
 * A test keeps every box below inside that area.
 */
export const SAFE = {top: 250, bottom: 1470, left: 65, right: 1015, railX: 853, railY: 1150} as const;

/** The header every world shares: the numbered circle and a two-line title. */
export const HEAD = {badgeY: 335, badgeR: 70, title1Top: 425, title2Top: 540, titleSize: 96, titleSide: 75} as const;

/** The band for cards: the full width above the rail. */
export const BAND = {top: 700, bottom: 1140, left: 110, width: 860} as const;

/** The dashed folder tile and the chat field it becomes (centre y, sizes). */
export const TILE = {cy: 1060, size: 540} as const;
export const FIELD = {cy: 1035, w: 940, h: 190, sendX: 160, sendR: 70, textRight: 954, tokenX: 412} as const;
/** Where a dropped file starts: just below the tile, inside the safe area. */
export const CHIP = {x: 560, y: 1330, w: 520, h: 150} as const;

export const TOGGLE = {cardTop: BAND.top, pitch: 120, switchX: 264} as const;
export const STAT = {cardTop: BAND.top, cardH: 430, dotY: 1260, dotR: 30} as const;
export const WORK = {cardTop: BAND.top, cardH: 440} as const;

/**
 * The desk of the closing: a laptop above, a phone and the closing words below. Bezels and the keyboard base are included in the boxes below.
 * The words start level with the phone's top bezel (832), 47 px under the laptop base, and grow downward with the copy (see closingColumn).
 */
export const DESK = {
  laptop: {x: 120, y: 285, w: 840, h: 440, bezel: 22, baseOverhang: 45, baseH: 38},
  phone: {x: 494, y: 850, w: 333, h: 592, bezel: 18},
  textLeft: 80, textWidth: 370, textTop: 832,
} as const;

/** The lowest the closing words may end: 12 px above the safe area, which is the estimate's room for error. */
export const CLOSING_LIMIT = SAFE.bottom - 12;

export type ClosingCopy = {top: string; sub: string; platforms: readonly string[]};
export type ClosingColumn = {headlineLines: number; subLines: number; chipRows: number; chipsTop: number; bottom: number};

/** Lines that words of these widths take when they wrap inside `room` with `gap` between them. A word wider than the room still takes a line. */
function wrapLines(widths: readonly number[], gap: number, room: number): number {
  let lines = 1, used = 0;
  for (const width of widths) {
    if (used > 0 && used + gap + width > room) { lines += 1; used = width; } else used += (used > 0 ? gap : 0) + width;
  }
  return lines;
}

/**
 * Where the closing words end. They are a column that grows with the copy, so a fixed box cannot say whether it fits: this counts what ClosingWorld
 * (worlds.tsx) and Words (kit.tsx) draw, from character counts alone (no browser, no fonts). The headline is set at fitLine(longest word, textWidth - 30, 80, 0.62)
 * and wraps words 0.66 x size per character wide, 0.24 x size apart, 1.15 x size a line (0.66 is where the default face wraps in real renders: two words share a
 * line up to six letters together, seven never fit); the sub is 32 px type at 60 px a line and wraps at 22 characters; the chips are 56 px tall, 12 px apart and
 * about 48 + 16.24 px per character wide (padding and border, 28 px type). 20 px separate the headline from the sub and 30 px the sub from the chips.
 * It is an estimate: it can be a line off where words or letters sit near the edge of the column (a 22-character sub of wide letters such as م ع ه س ش can wrap,
 * and a 23 to 24 character sub of narrow ones can stay on one line), and it knows only the default fonts. The delivery gate has the last word.
 */
export function closingColumn(closing: ClosingCopy): ClosingColumn {
  const words = closing.top.split(/\s+/).filter(Boolean);
  const size = fitLine(words.reduce((longest, w) => (w.length > longest.length ? w : longest), ''), DESK.textWidth - 30, 80, 0.62);
  const headlineLines = wrapLines(words.map((w) => 0.66 * size * w.length), 0.24 * size, DESK.textWidth);
  const subLines = wrapLines(closing.sub.split(/\s+/).filter(Boolean).map((w) => w.length), 1, 22);
  const chipRows = wrapLines(closing.platforms.map((p) => 48 + 16.24 * p.length), 12, DESK.textWidth);
  const chipsTop = DESK.textTop + headlineLines * 1.15 * size + 20 + 60 * subLines + 30;
  return {headlineLines, subLines, chipRows, chipsTop: Math.round(chipsTop), bottom: Math.round(chipsTop + 56 * chipRows + 12 * (chipRows - 1))};
}
export const closingColumnBottom = (closing: ClosingCopy): number => closingColumn(closing).bottom;

/** The home card: one row per step, so the card and the button below it move with the count. */
export type IntroLayout = {pitch: number; rowH: number; cardTop: number; cardH: number; pillY: number; pillW: number; pillH: number};
export function introLayout(rows: number): IntroLayout {
  const pitch = rows <= 2 ? 120 : rows === 3 ? 108 : 92;
  const cardH = 36 + rows * pitch, cardTop = Math.min(780, BAND.bottom - cardH);
  const pillW = 600, pillH = 140;
  return {pitch, rowH: pitch - 20, cardTop, cardH, pillW, pillH, pillY: cardTop + cardH + 34 + pillH / 2};
}

/** A line of words shrinks instead of wrapping, so a title keeps to its two lines and to the side margins. */
export const fitLine = (text: string, width: number, max: number, perChar = 0.6): number =>
  Math.floor(Math.min(max, width / (perChar * Math.max(1, text.length))));

/** The captions of the finished reel: two lines above the action rail, at a size that keeps the longer line between the side margins. */
export const REEL = {captionTop: 880} as const;
export function reelCaptionSize(words: readonly string[]): number {
  const split = Math.ceil(words.length / 2);
  const fits = (line: readonly string[]): number => {
    const chars = line.reduce((n, w) => n + w.length, 0);
    return (930 - 52 * line.length - 14 * Math.max(0, line.length - 1)) / (0.64 * Math.max(1, chars));
  };
  return Math.floor(Math.min(92, fits(words.slice(0, split)), fits(words.slice(split))));
}

/** Font sizes for a number and its unit that keep both on one line inside the card, whatever the digits and the unit are. */
export function statSizes(text: string, unit: string): {num: number; unit: number} {
  const u = Math.max(36, Math.min(70, Math.floor(300 / (0.52 * Math.max(1, unit.length)))));
  const base = text.length <= 4 ? 250 : text.length <= 6 ? 200 : 150;
  const room = 780 - 0.52 * u * unit.length - 24;
  return {num: Math.max(60, Math.min(base, Math.floor(room / (0.62 * Math.max(1, text.length))))), unit: u};
}

/** The home headline shrinks so its highlighted second line stays between the side margins. */
export function headlineSize(top: string, bottom: string): number {
  const perChar = 0.66;
  return Math.floor(Math.min(125, 850 / (perChar * Math.max(1, top.length)), 800 / (perChar * Math.max(1, bottom.length))));
}

/** The typed sentence shrinks a little when it is long so it stays on one line beside the file token. */
export function fieldFont(chars: number, attached: boolean): number {
  const room = attached ? 15 : 24;
  return Math.max(36, Math.round(50 - Math.max(0, chars - room) * 1.4));
}

export type Interval = readonly [number, number];
const span = (a: number, b: number): Interval => [a, b];

export type IntroTimes = {clickAt: number; swallow: Interval; end: number};
type Common = {index: number; num: number; start: number; end: number; nextStart: number; lead: number; badgeIn: number; title1In: number; title2In: number};
export type AskTimes = Common & {
  kind: 'ask'; hasDrop: boolean; tileIn: Interval; chipIn: number; grab: number; drag: Interval; drop: number; iconFade: Interval;
  morph: Interval; roll: Interval; title1Out: number; title2Out: number; fieldTitle1In: number; fieldTitle2In: number; fieldOn: Interval;
  typeStart: number; words: number[]; sendOn: number; curEnter: number; curArrive: number; click: number; iris: Interval;
};
export type ToggleTimes = Common & {
  kind: 'toggle'; cardIn: Interval; roll: Interval; curEnter: number; presses: number[]; iris: Interval;
};
export type StatTimes = Common & {
  kind: 'stat'; cardIn: Interval; roll: Interval; count: Interval; labelIn: number; dotIn: Interval; iris: Interval;
};
export type FinaleTimes = Common & {
  kind: 'finale'; hasWork: boolean; cardIn: Interval; roll: Interval; spins: number[]; dones: number[]; reel: Interval; dive: Interval;
  title1Out: number; title2Out: number; karaoke: number; hero: number;
};
export type Block = AskTimes | ToggleTimes | StatTimes | FinaleTimes;
export type ClosingTimes = {pull: Interval; textIn: number; subIn: Interval; chipsIn: number; swipe: Interval; loop: Interval; holdFrom: number};
export type Timeline = {total: number; intro: IntroTimes; blocks: Block[]; closing: ClosingTimes; cues: Cue[]};
export type CueKind = 'transition' | 'stamp' | 'swap' | 'click' | 'count' | 'reveal' | 'type';
export type Cue = {at: number; kind: CueKind};

const KARAOKE_STEP = 0.36;
export const KARAOKE_WORDS = 6;
const karaokeCount = (data: Input): number => Math.max(1, Math.min(KARAOKE_WORDS, data.result?.words?.length ?? KARAOKE_WORDS));
export const karaokeStep = KARAOKE_STEP;

type Input = {steps: readonly (StepIn & {options?: readonly {on?: boolean}[]; jobs?: readonly string[]; text?: string})[]; result?: {words?: readonly string[]}};
const wordsOf = (text: string | undefined): number => Math.max(1, (text ?? '').split(/\s+/).filter(Boolean).length);

export function oneShotTimeline(data: Input): Timeline {
  const steps = data.steps;
  const cues: Cue[] = [];
  const cue = (at: number, kind: CueKind) => cues.push({at, kind});
  const intro: IntroTimes = {clickAt: 1.5, swallow: span(1.62, 2.5), end: 2.5};
  cue(intro.clickAt, 'click');
  cue(intro.swallow[1], 'transition');

  const blocks: Block[] = [];
  let cursor = intro.end;
  let entry: 'swallow' | 'iris' = 'swallow';
  let i = 0;
  while (i < steps.length) {
    const step = steps[i], num = i + 1, lead = entry === 'iris' ? 0.25 : 0, s = cursor;
    const base = {index: i, num, start: s, lead, badgeIn: s + 0.1 + lead, title1In: s + 0.25 + lead, title2In: s + 0.4 + lead};
    if (step.kind === 'drop' || step.kind === 'field') {
      const hasDrop = step.kind === 'drop', field = hasDrop ? steps[i + 1] : step;
      const words: number[] = [];
      const grab = s + 1.3 + lead, dropAt = s + 2.45 + lead;
      const morph = hasDrop ? span(s + 3.0 + lead, s + 3.9 + lead) : span(s + 0.6 + lead, s + 0.6 + lead);
      const afterIris = !hasDrop && lead > 0;
      const fieldOn = hasDrop ? span(morph[0] + 0.7, morph[0] + 1.0) : span(s + 0.6 + lead, s + 1.1 + lead);
      const typeStart = hasDrop ? morph[1] + 0.4 : s + (afterIris ? 2.1 : 1.7) + lead;
      for (let w = 0; w < wordsOf(field?.text); w += 1) words.push(typeStart + 0.35 * w);
      const sendOn = words[words.length - 1] + 0.45, curEnter = sendOn - 0.25, curArrive = curEnter + 1.33, click = curArrive + 0.12;
      const iris = span(click + 0.05, click + 0.9);
      const block: AskTimes = {
        ...base, kind: 'ask', hasDrop, end: iris[1], nextStart: iris[0],
        tileIn: span(s + 0.5 + lead, s + 1.1 + lead), chipIn: s + 0.7 + lead, grab, drag: span(s + 1.45 + lead, s + 2.4 + lead), drop: dropAt,
        iconFade: span(s + 2.0 + lead, s + 2.4 + lead), morph, roll: hasDrop ? span(morph[0] + 0.2, morph[0] + 0.7) : span(s + 0.95 + lead, s + 1.4 + lead),
        title1Out: morph[0] + 0.1, title2Out: morph[0] + 0.2,
        fieldTitle1In: hasDrop ? morph[0] + 0.5 : afterIris ? s + 1.1 + lead : base.title1In, fieldTitle2In: hasDrop ? morph[0] + 0.62 : afterIris ? s + 1.22 + lead : base.title2In, fieldOn,
        typeStart, words, sendOn, curEnter, curArrive, click, iris,
      };
      blocks.push(block);
      cue(base.badgeIn, 'reveal');
      if (hasDrop) {
        cue(grab, 'click'); cue(dropAt, 'stamp'); cue(dropAt + 0.25, 'reveal'); cue((morph[0] + morph[1]) / 2, 'swap');
      }
      words.forEach((at) => cue(at, 'type'));
      cue(sendOn, 'reveal'); cue(click, 'click'); cue(iris[1], 'transition');
      cursor = iris[0]; entry = 'iris'; i += hasDrop ? 2 : 1;
    } else if (step.kind === 'toggle') {
      const on = (step.options ?? []).filter((option) => option.on !== false).length;
      const presses = Array.from({length: Math.max(1, on)}, (_, k) => s + 1.0 + lead + 1.3 + 0.8 * k);
      const iris = span(presses[presses.length - 1] + 0.7, presses[presses.length - 1] + 1.55);
      blocks.push({
        ...base, kind: 'toggle', end: iris[1], nextStart: iris[0], cardIn: span(s + 0.35 + lead, s + 0.85 + lead), roll: span(s + 0.95 + lead, s + 1.4 + lead),
        title1In: s + 1.1 + lead, title2In: s + 1.22 + lead, curEnter: s + 1.35 + lead, presses, iris,
      });
      cue(base.badgeIn, 'reveal'); presses.forEach((at) => cue(at, 'click'));
      cue(iris[1], 'transition');
      cursor = iris[0]; entry = 'iris'; i += 1;
    } else if (step.kind === 'stat') {
      const iris = span(s + 3.35 + lead, s + 4.2 + lead);
      blocks.push({
        ...base, kind: 'stat', end: iris[1], nextStart: iris[0], cardIn: span(s + 0.35 + lead, s + 0.85 + lead), roll: span(s + 0.95 + lead, s + 1.4 + lead),
        title1In: s + 1.1 + lead, title2In: s + 1.22 + lead, count: span(s + 1.35 + lead, s + 2.55 + lead), labelIn: s + 1.65 + lead, dotIn: span(s + 2.75 + lead, s + 3.05 + lead), iris,
      });
      cue(base.badgeIn, 'reveal'); cue(s + 1.35 + lead, 'count'); cue(s + 2.75 + lead, 'reveal');
      cue(iris[1], 'transition');
      cursor = iris[0]; entry = 'iris'; i += 1;
    } else {
      // work: the progress card, then the card becomes the reel
      const jobs = Math.max(1, (step.jobs ?? []).length);
      blocks.push(finale(s, lead, i, num, true, jobs, karaokeCount(data), cue));
      i += 1; cursor = Infinity;
    }
  }
  if (cursor !== Infinity) {
    const lead = entry === 'iris' ? 0.25 : 0;
    blocks.push(finale(cursor, lead, -1, steps.length + 1, false, 0, karaokeCount(data), cue));
  }
  const fin = blocks[blocks.length - 1] as FinaleTimes;
  const heroA = fin.hero;
  const pull = span(heroA + 0.7, heroA + 2.1), swipe = span(pull[1] + 0.2, pull[1] + 0.7), loop = span(swipe[1] + 0.15, swipe[1] + 1.4);
  const closing: ClosingTimes = {pull, textIn: pull[0] + 0.6, subIn: span(pull[0] + 0.95, pull[0] + 1.35), chipsIn: pull[0] + 1.05, swipe, loop, holdFrom: loop[1] + 0.02};
  cue(pull[0] + LEAD.swap - 0.05, 'swap'); cue(closing.textIn, 'reveal'); cue(closing.chipsIn, 'reveal');
  // The dive home lands a hair before it ends, so its whole rise still fits inside a scene of the minimum length (0.6 s are held after it).
  cue(swipe[0] + 0.25, 'swap'); cue(loop[1] - 0.05, 'transition');
  return {total: loop[1] + 0.6, intro, blocks, closing, cues: cues.sort((a, b) => a.at - b.at)};
}

function finale(s: number, lead: number, index: number, num: number, hasWork: boolean, jobs: number, words: number, cue: (at: number, kind: CueKind) => void): FinaleTimes {
  const badgeIn = s + 0.1 + lead, title1In = s + 1.1 + lead;
  let spins: number[] = [], dones: number[] = [], reel: Interval, dive: Interval, cardIn: Interval;
  if (hasWork) {
    spins = Array.from({length: jobs}, (_, k) => title1In + 0.7 * k);
    dones = spins.map((at) => at + 0.7);
    reel = span(dones[jobs - 1] + 0.4, dones[jobs - 1] + 1.3);
    dive = span(reel[1] + 0.1, reel[1] + 0.9);
    cardIn = span(s + 0.35 + lead, s + 0.85 + lead);
  } else {
    cardIn = span(s + 0.35 + lead, s + 0.95 + lead);
    reel = span(cardIn[0], cardIn[1]);
    dive = span(s + 2.2 + lead, s + 3.0 + lead);
  }
  const karaoke = hasWork ? reel[1] + 0.2 : dive[0] + 0.1;
  const block: FinaleTimes = {
    kind: 'finale', hasWork, index, num, start: s, lead, end: dive[1], nextStart: dive[1], badgeIn, title1In, title2In: title1In + 0.12,
    cardIn, roll: span(s + 0.95 + lead, s + 1.4 + lead), spins, dones, reel, dive, title1Out: reel[0], title2Out: reel[0] + 0.1, karaoke, hero: dive[1],
  };
  if (hasWork) {
    cue(badgeIn, 'reveal'); dones.forEach((at) => cue(at, 'reveal')); cue((reel[0] + reel[1]) / 2, 'swap'); cue(reel[1], 'reveal');
  } else cue(cardIn[0] + 0.1, 'reveal');
  cue(dive[1], 'transition');
  for (let k = 0; k < words; k += 1) cue(karaoke + KARAOKE_STEP * k, 'count');
  return block;
}

export const oneShotSeconds = (data: Input): number => oneShotTimeline(data).total;
/** The shortest scene that plays the whole chain at this frame rate. A longer scene holds the first frame at the end. */
export const oneShotMinFrames = (data: Input, fps = 30): number => Math.ceil(oneShotSeconds(data) * fps - 1e-6);

/** Windows (seconds) where the camera moves fast enough to deserve motion blur. */
export function blurWindows(tl: Timeline): Interval[] {
  const out: Interval[] = [span(tl.intro.swallow[0] + 0.16, tl.intro.swallow[1])];
  tl.blocks.forEach((block) => {
    if (block.kind === 'finale') out.push(span(block.dive[0], block.dive[1]));
    else out.push(span(block.iris[0] + 0.15, block.iris[1]));
  });
  out.push(span(tl.closing.pull[0] + 0.05, tl.closing.pull[1] - 0.1), span(tl.closing.loop[0] + 0.05, tl.closing.loop[1]));
  return out;
}

/** Sound cues as frames of the scene at this frame rate. */
export function oneShotCues(data: Input, fps = 30): {frame: number; kind: CueKind}[] {
  return oneShotTimeline(data).cues.map((cue) => ({frame: Math.round(cue.at * fps), kind: cue.kind}));
}
