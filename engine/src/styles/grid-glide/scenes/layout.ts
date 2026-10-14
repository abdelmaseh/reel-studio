// Node-safe: only type-only imports from ./schema.ts, no packages, no JSX, explicit .ts imports.
import {CADENCE, CARD, LINE_HEIGHT, PILL, SIZE, STAR} from './math.ts';
import {glideWords, textDirection, type Direction} from './text.ts';
import type {GlideCardData, GlideChapterData, GlideCommentData, GlideFollowData, GlideLine, GlideLinesData, GridGlideScene} from './schema.ts';

// Instagram organic band (engine/src/core/platform/instagram-reels.json, profile ig-reels-organic).
export const BAND = {top: 250, bottom: 1470, left: 65, right: 1015, rail: {x: 853, y: 1150}} as const;
export const GAP = {captionToCard: 38, cardToBelow: 65, boxToBullets: 30, lineToBox: 38, handleToPill: 65} as const;
export const WEIGHT = {lead: 500, hero: 700, chapter: 680, bullet: 500} as const;
export const CARD_ASPECT = {min: 0.5, max: 1.4} as const;
export const BOX_HEIGHT_FACTOR = 1.45;
export const BULLET_STAR_X = {rtl: 790, ltr: 200} as const;
export const LINE_WIDTH = {open: 862} as const;
// Chapter group shifted up for the band: ordinal baseline about 867, pill 937-1113 (ends above the rail).
export const CHAPTER_LAYOUT = {heroTop: 723, pillTop: 937} as const;

export const lineBox = (size: number): number => Math.round(size * LINE_HEIGHT);
export const boxHeight = (size: number): number => Math.round(size * BOX_HEIGHT_FACTOR);
export const cardHeight = (width: number, aspect: number): number => Math.round((width - 2 * CARD.inset) * aspect) + 2 * CARD.inset;

/**
 * The safe column a line is centred in: the whole band, or the band left of the action rail once the row reaches
 * the rail zone (same test as the kit: the row's top plus its line height is below the rail's top).
 * A row near the rail is therefore never centred on x 540 and never crosses x 853.
 */
export const lineColumn = (y: number, size: number): {x: number; width: number} => {
  const right = y + size * LINE_HEIGHT > BAND.rail.y ? BAND.rail.x : BAND.right;
  return {x: BAND.left, width: right - BAND.left};
};

export type PlacedLine = {
  y: number; size: number; weight: number; dir: Direction;
  /** The safe column the row is centred in (passed to the kit as `x` and `width`). */
  x: number; width: number;
  /** The widest the text may be: the open-line limit, never more than the column. */
  maxWidth: number;
  words: readonly string[]; at: number; cadence: number;
};
export type PlacedBox = {y: number; h: number; dir: Direction; words: number};
export type PlacedBullet = {y: number; at: number; words: string[]; dir: Direction; starX: number; maxWidth: number};

const placeLines = (lines: readonly GlideLine[], top: number, maxWidth: number): {placed: PlacedLine[]; bottom: number} => {
  let y = top;
  const placed = lines.map((line) => {
    const size = line.role === 'hero' ? SIZE.hero : SIZE.lead;
    const column = lineColumn(y, size);
    const item: PlacedLine = {
      y, size, weight: line.role === 'hero' ? WEIGHT.hero : WEIGHT.lead, dir: textDirection(line.words.join(' ')),
      ...column, maxWidth: Math.min(maxWidth, column.width), words: line.words, at: line.at, cadence: line.cadence,
    };
    y += lineBox(size);
    return item;
  });
  return {placed, bottom: y};
};

export type ChapterLayout = {
  hero: {y: number; size: number; weight: number; bottom: number; dir: Direction; x: number; width: number; maxWidth: number};
  pill: {y: number; bottom: number} | null;
  issues: string[];
};

export function layoutGlideChapter(data: GlideChapterData): ChapterLayout {
  const size = SIZE.chapter, column = lineColumn(CHAPTER_LAYOUT.heroTop, size);
  const hero = {
    y: CHAPTER_LAYOUT.heroTop, size, weight: WEIGHT.chapter, bottom: CHAPTER_LAYOUT.heroTop + lineBox(size), dir: textDirection(data.ordinal),
    ...column, maxWidth: Math.min(LINE_WIDTH.open, column.width),
  };
  const pill = data.pill ? {y: CHAPTER_LAYOUT.pillTop, bottom: CHAPTER_LAYOUT.pillTop + PILL.h} : null;
  const issues: string[] = [];
  if (pill && pill.bottom > BAND.rail.y) issues.push(`the pill ends at ${pill.bottom}px, inside the Instagram action rail that starts at ${BAND.rail.y}px`);
  return {hero, pill, issues};
}

export type CardLayout = {
  lines: PlacedLine[];
  card: {x: number; y: number; w: number; h: number; innerW: number; innerH: number; narrow: boolean};
  box: PlacedBox | null;
  bullets: PlacedBullet[];
  bottom: number;
  issues: string[];
};

export function layoutGlideCard(data: GlideCardData): CardLayout {
  const issues: string[] = [];
  const {placed: lines, bottom: linesBottom} = placeLines(data.lines, BAND.top, LINE_WIDTH.open);
  let y = data.lines.length ? linesBottom + GAP.captionToCard : BAND.top;
  const first = data.media.clips[0];
  const aspect = Math.min(CARD_ASPECT.max, Math.max(CARD_ASPECT.min, first.height / first.width));
  let w: number = CARD.w, h = cardHeight(w, aspect), narrow = false;
  if (y + h > BAND.rail.y) { narrow = true; w = BAND.rail.x - CARD.x; h = cardHeight(w, aspect); }
  const card = {x: CARD.x, y, w, h, innerW: w - 2 * CARD.inset, innerH: h - 2 * CARD.inset, narrow};
  y += h;
  let bottom = y;
  if (data.box || data.bullets.length) y += GAP.cardToBelow;
  let box: PlacedBox | null = null;
  if (data.box) {
    const boxH = boxHeight(SIZE.box);
    box = {y, h: boxH, dir: textDirection(data.box.text), words: glideWords(data.box.text).length};
    if (y + boxH > BAND.rail.y) issues.push(`the box ends at ${y + boxH}px, inside the Instagram action rail that starts at ${BAND.rail.y}px; drop a line or use a shorter capture crop`);
    y += boxH;
    bottom = y;
    if (data.bullets.length) y += GAP.boxToBullets;
  }
  const rowHeight = lineBox(SIZE.bullet);
  const bullets = data.bullets.map((bullet, index): PlacedBullet => {
    const rowY = y + index * STAR.pitch, dir = textDirection(bullet.text), starX = BULLET_STAR_X[dir];
    const touchesRail = rowY + SIZE.bullet * LINE_HEIGHT > BAND.rail.y;
    const edge = dir === 'rtl' ? starX - STAR.size / 2 - STAR.gapToText : starX + STAR.size / 2 + STAR.gapToText;
    const maxWidth = dir === 'rtl' ? edge - BAND.left : (touchesRail ? BAND.rail.x : BAND.right) - edge;
    bottom = rowY + rowHeight;
    return {y: rowY, at: bullet.at, words: glideWords(bullet.text), dir, starX, maxWidth};
  });
  if (bottom > BAND.bottom) issues.push(`the stack needs ${bottom}px but the Instagram band ends at ${BAND.bottom}px; drop or merge a line or bullet, or use a wider capture crop for a shorter card`);
  return {lines, card, box, bullets, bottom, issues};
}

export type LinesLayout = {lines: PlacedLine[]; box: PlacedBox | null; bottom: number; issues: string[]};

export function layoutGlideLines(data: GlideLinesData): LinesLayout {
  const boxH = data.box ? boxHeight(SIZE.box) : 0;
  const block = data.lines.reduce((sum, line) => sum + lineBox(line.role === 'hero' ? SIZE.hero : SIZE.lead), 0) + (data.box ? GAP.lineToBox + boxH : 0);
  const room = BAND.rail.y - BAND.top, issues: string[] = [];
  if (block > room) issues.push(`the stack is ${block}px tall but the space above the Instagram action rail is ${room}px; drop or merge a line`);
  const top = BAND.top + Math.max(0, Math.round((room - block) / 2));
  const {placed, bottom} = placeLines(data.lines, top, LINE_WIDTH.open);
  const box: PlacedBox | null = data.box ? {y: bottom + GAP.lineToBox, h: boxH, dir: textDirection(data.box.text), words: glideWords(data.box.text).length} : null;
  return {lines: placed, box, bottom: box ? box.y + box.h : bottom, issues};
}

/**
 * The big row of an ending: the keyword or the handle. The renderer fits it between `min` and `max` px (it fails loudly
 * below `min`), and the layout reserves the slot of the largest size so nothing around it moves when the row shrinks.
 */
export type EndingRow = {
  /** Top of the reserved slot. */
  y: number;
  /** Height reserved at the largest size. */
  slot: number;
  min: number; max: number; weight: number; dir: Direction;
  /** The safe column the row is centred in. */
  x: number; width: number;
  words: readonly string[]; at: number; cadence: number;
};

/** Where a row of `size` px starts so it sits in the middle of the slot reserved for its largest size. */
export const centredRowY = (row: Pick<EndingRow, 'y' | 'slot'>, size: number): number => row.y + Math.round((row.slot - lineBox(size)) / 2);

// The keyword is fitted from the call-to-action size down to the hero size; the handle from the hero size down to 40 px.
const ENDING_SIZE = {keyword: {min: SIZE.hero, max: SIZE.cta}, handle: {min: 40, max: SIZE.hero}} as const;

const endingRow = (y: number, words: readonly string[], range: {min: number; max: number}, at: number): EndingRow => {
  const column = lineColumn(y, range.max);
  return {y, slot: lineBox(range.max), ...range, weight: WEIGHT.hero, dir: textDirection(words.join(' ')), ...column, words, at, cadence: CADENCE.stack};
};

/** Centres a block in the space above the rail; returns its top and an issue when it does not fit. */
const centreAboveRail = (block: number): {top: number; issues: string[]} => {
  const room = BAND.rail.y - BAND.top, issues: string[] = [];
  if (block > room) issues.push(`the stack is ${block}px tall but the space above the Instagram action rail is ${room}px; drop or merge a line`);
  return {top: BAND.top + Math.max(0, Math.round((room - block) / 2)), issues};
};

const leadBlock = (lines: readonly GlideLine[]): number => lines.reduce((sum, line) => sum + lineBox(line.role === 'hero' ? SIZE.hero : SIZE.lead), 0);

export type CommentLayout = {lines: PlacedLine[]; keyword: EndingRow; box: PlacedBox | null; bottom: number; issues: string[]};

/** Lead-in lines, the keyword slot and the promise box, centred in the space above the rail. */
export function layoutGlideComment(data: GlideCommentData): CommentLayout {
  const keywordSlot = lineBox(ENDING_SIZE.keyword.max), boxH = data.box ? boxHeight(SIZE.box) : 0;
  const {top, issues} = centreAboveRail(leadBlock(data.lines) + keywordSlot + (data.box ? GAP.lineToBox + boxH : 0));
  const {placed, bottom} = placeLines(data.lines, top, LINE_WIDTH.open);
  const keyword = endingRow(bottom, glideWords(data.keyword), ENDING_SIZE.keyword, data.heroAt);
  const boxTop = bottom + keywordSlot + GAP.lineToBox;
  const box: PlacedBox | null = data.box ? {y: boxTop, h: boxH, dir: textDirection(data.box.text), words: glideWords(data.box.text).length} : null;
  return {lines: placed, keyword, box, bottom: box ? boxTop + boxH : bottom + keywordSlot, issues};
}

export type FollowLayout = {lines: PlacedLine[]; handle: EndingRow; pill: {y: number; bottom: number}; bottom: number; issues: string[]};

/** Lead-in lines, the handle slot and the FOLLOW pill, centred in the space above the rail. */
export function layoutGlideFollow(data: GlideFollowData): FollowLayout {
  const handleSlot = lineBox(ENDING_SIZE.handle.max);
  const {top, issues} = centreAboveRail(leadBlock(data.lines) + handleSlot + GAP.handleToPill + PILL.h);
  const {placed, bottom} = placeLines(data.lines, top, LINE_WIDTH.open);
  const handle = endingRow(bottom, [data.handle], ENDING_SIZE.handle, data.heroAt);
  const pillTop = bottom + handleSlot + GAP.handleToPill, pill = {y: pillTop, bottom: pillTop + PILL.h};
  if (pill.bottom > BAND.rail.y) issues.push(`the pill ends at ${pill.bottom}px, inside the Instagram action rail that starts at ${BAND.rail.y}px`);
  return {lines: placed, handle, pill, bottom: pill.bottom, issues};
}

/** Vertical-budget problems that can be known before any font is measured, prefixed with the scene id. */
export function gridGlideLayoutIssues(scene: GridGlideScene): string[] {
  const issues = scene.family === 'glide-chapter' ? layoutGlideChapter(scene.data).issues
    : scene.family === 'glide-card' ? layoutGlideCard(scene.data).issues
    : scene.family === 'glide-comment' ? layoutGlideComment(scene.data).issues
    : scene.family === 'glide-follow' ? layoutGlideFollow(scene.data).issues
    : layoutGlideLines(scene.data).issues;
  return issues.map((message) => `${scene.id}: ${message}`);
}
