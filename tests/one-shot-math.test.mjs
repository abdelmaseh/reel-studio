import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  BAND, CHIP, CLOSING_LIMIT, DESK, FIELD, HEAD, LEAD, MAX_STEPS, ONE_SHOT_FAMILIES, SAFE, STAT, STEP_KINDS, TILE, TOGGLE, WORK, blurWindows, chainIssues, closingColumn,
  closingColumnBottom, digitOf, fieldFont, fitLine, headlineSize, introLayout, oneShotCues, oneShotMinFrames, oneShotSeconds, oneShotTimeline, reelCaptionSize, REEL, statSizes, stepTone,
} from '../engine/src/styles/one-shot/scenes/math.ts';
import {oneShotSceneSchema, validateOneShotTiming} from '../engine/src/styles/one-shot/scenes/schema.ts';
import {oneShotTemplate} from '../engine/src/styles/one-shot/scenes/templates.ts';
import {normalizeGraphicsSpec} from '../scripts/lib/graphics-project.mjs';
import {sceneCues} from '../scripts/lib/scene-cues.mjs';

const sound = JSON.parse(readFileSync(new URL('../engine/src/styles/one-shot/sound.json', import.meta.url), 'utf8'));
const chain = (...kinds) => ({
  steps: kinds.map((kind) => ({
    kind, text: kind === 'field' ? 'اعمل لي ريل من' : undefined, jobs: kind === 'work' ? ['أ', 'ب', 'ج'] : undefined,
    options: kind === 'toggle' ? [{on: true}, {on: true}] : undefined,
  })),
  result: {words: ['أ', 'ب', 'ج', 'د', 'هـ', 'و']},
});
const COMMON = chain('drop', 'field', 'work');

test('the family list and the step kinds are the ones the schema and the guide name', () => {
  assert.deepEqual([...ONE_SHOT_FAMILIES], ['one-shot']);
  assert.deepEqual([...STEP_KINDS], ['drop', 'field', 'toggle', 'stat', 'work']);
  assert.equal(MAX_STEPS, 4);
  assert.deepEqual(STEP_KINDS.map(stepTone), ['dark', 'dark', 'accent', 'dark', 'accent']);
  assert.deepEqual([1, 2, 3, 4, 5].map(digitOf), ['١', '٢', '٣', '٤', '٥']);
});

test('the colour grammar accepts the chains the guide allows and names the reason for the rest', () => {
  for (const kinds of [['field'], ['stat'], ['drop', 'field'], ['drop', 'field', 'work'], ['field', 'work'], ['field', 'toggle', 'field', 'work'],
    ['stat', 'toggle', 'drop', 'field'], ['field', 'toggle', 'stat']]) {
    assert.deepEqual(chainIssues(chain(...kinds).steps), [], kinds.join(' > '));
  }
  const bad = (kinds, pattern) => assert.match(chainIssues(chain(...kinds).steps).join('|'), pattern, kinds.join(' > '));
  bad(['toggle', 'field'], /step 1 \(toggle\) must be a dark step/);
  bad(['field', 'stat'], /same colour: put an accent step/);
  bad(['field', 'toggle', 'work'], /same colour: put a dark step/);
  bad(['drop', 'toggle'], /\(drop\) must be followed by a field step/);
  bad(['field', 'work', 'field'], /\(work\) must be the last step/);
  bad(['field', 'toggle'], /last step cannot be a toggle/);
  bad(['field', 'toggle', 'field', 'toggle', 'field'], /1 to 4 steps/);
  assert.match(chainIssues([{kind: 'field'}, {kind: 'toggle', options: [{on: false}]}, {kind: 'work'}]).join('|'), /needs at least one option that is switched on/);
  assert.match(chainIssues([]).join('|'), /1 to 4 steps/);
});

test('the common chain keeps the numbers of the approved take: 20 seconds on the half-second beat', () => {
  const tl = oneShotTimeline(COMMON);
  assert.equal(tl.total, 20);
  assert.equal(oneShotMinFrames(COMMON, 30), 600);
  assert.equal(oneShotMinFrames(COMMON, 60), 1200);
  assert.equal(oneShotMinFrames(COMMON, 50), 1000);
  assert.deepEqual(tl.intro, {clickAt: 1.5, swallow: [1.62, 2.5], end: 2.5});
  const [ask, finale] = tl.blocks;
  assert.equal(ask.kind, 'ask');
  assert.equal(finale.kind, 'finale');
  const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-9, `${label}: ${a} is not ${b}`);
  near(ask.start, 2.5, 'ask start'); near(ask.grab, 3.8, 'grab'); near(ask.drop, 4.95, 'drop');
  near(ask.morph[0], 5.5, 'morph start'); near(ask.morph[1], 6.4, 'morph end'); near(ask.typeStart, 6.8, 'typing starts');
  near(ask.iris[0], 9.55, 'iris start'); near(ask.iris[1], 10.4, 'iris end');
  near(finale.start, 9.55, 'the finale opens inside the circle');
  near(finale.dive[0], 14.4, 'dive start'); near(finale.dive[1], 15.2, 'dive end'); near(finale.hero, 15.2, 'hero');
  near(tl.closing.pull[0], 15.9, 'pull start'); near(tl.closing.pull[1], 17.3, 'pull end');
  near(tl.closing.swipe[0], 17.5, 'swipe start'); near(tl.closing.loop[0], 18.15, 'loop start'); near(tl.closing.loop[1], 19.4, 'loop end');
});

test('every block starts inside the one before it and the whole chain stays inside the total', () => {
  for (const kinds of [['field'], ['stat'], ['drop', 'field', 'work'], ['field', 'toggle', 'stat'], ['field', 'toggle', 'field', 'work'], ['stat', 'toggle', 'drop', 'field']]) {
    const tl = oneShotTimeline(chain(...kinds));
    let previous = tl.intro.end;
    for (const block of tl.blocks) {
      assert.ok(block.start >= previous - 1e-9, `${kinds.join(',')}: ${block.kind} starts before the previous circle opens`);
      assert.ok(block.start < block.end && block.end <= tl.total, `${kinds.join(',')}: ${block.kind} stays inside the scene`);
      previous = block.kind === 'finale' ? block.end : block.nextStart;
    }
    const last = tl.blocks[tl.blocks.length - 1];
    assert.equal(last.kind, 'finale', kinds.join(','));
    assert.equal(last.hasWork, kinds.at(-1) === 'work', kinds.join(','));
    assert.ok(tl.closing.pull[0] >= last.hero && tl.closing.loop[1] < tl.total && tl.closing.holdFrom <= tl.total, kinds.join(','));
    assert.equal(oneShotSeconds(chain(...kinds)), tl.total);
  }
});

test('typed words arrive three to a second and the chain grows with them', () => {
  const short = oneShotTimeline({steps: [{kind: 'field', text: 'كلمة'}, {kind: 'work', jobs: ['أ', 'ب']}], result: {words: ['أ', 'ب', 'ج', 'د']}});
  const long = oneShotTimeline({steps: [{kind: 'field', text: 'اكتب هنا طلب فيه ست كلمات'}, {kind: 'work', jobs: ['أ', 'ب']}], result: {words: ['أ', 'ب', 'ج', 'د']}});
  const ask = long.blocks[0];
  assert.equal(ask.words.length, 6);
  ask.words.slice(1).forEach((at, i) => assert.ok(Math.abs(at - ask.words[i] - 0.35) < 1e-9));
  assert.ok(Math.abs(long.total - short.total - 0.35 * 5) < 1e-9);
});

test('fieldFont shrinks long sentences and the home card moves with the number of rows', () => {
  assert.equal(fieldFont(10, true), 50);
  assert.ok(fieldFont(22, true) < 50 && fieldFont(22, true) >= 36);
  assert.ok(fieldFont(34, false) >= 36);
  assert.deepEqual([1, 3, 4].map((rows) => introLayout(rows).cardH), [156, 360, 404]);
  assert.equal(introLayout(3).pillY, 1244);
  assert.equal(introLayout(4).pillY, 1244, 'the button stays where it is when the card gets a fourth row: the card grows upward');
});

// The delivery gate refuses anything in the platform's own interface: above 250, below 1470, within 65 of a side and, from y = 1150, in the right-hand rail.
const fits = (label, x, y, w, h) => {
  assert.ok(x >= SAFE.left && x + w <= SAFE.right && y >= SAFE.top && y + h <= SAFE.bottom, `${label} leaves the safe area: ${x},${y} ${w}x${h}`);
  assert.ok(!(x + w > SAFE.railX && y + h > SAFE.railY), `${label} reaches the action rail: ${x},${y} ${w}x${h}`);
};

test('every resting box of every world stays inside the Instagram safe area and clear of the action rail', () => {
  fits('badge', 540 - HEAD.badgeR, HEAD.badgeY - HEAD.badgeR, 2 * HEAD.badgeR, 2 * HEAD.badgeR);
  fits('badge at its pop overshoot', 540 - HEAD.badgeR * 1.1, HEAD.badgeY - HEAD.badgeR * 1.1, 2 * HEAD.badgeR * 1.1, 2 * HEAD.badgeR * 1.1);
  fits('title', HEAD.titleSide, HEAD.title1Top, 1080 - 2 * HEAD.titleSide, HEAD.title2Top + HEAD.titleSize * 1.15 - HEAD.title1Top);
  assert.ok(HEAD.title2Top + HEAD.titleSize * 1.15 < BAND.top - 30, 'the cards start below the title');
  fits('folder tile', 540 - TILE.size / 2, TILE.cy - TILE.size / 2, TILE.size, TILE.size);
  fits('chat field', 540 - FIELD.w / 2, FIELD.cy - FIELD.h / 2, FIELD.w, FIELD.h);
  fits('dropped file at its start', CHIP.x - CHIP.w / 2, CHIP.y - CHIP.h / 2 + 60, CHIP.w, CHIP.h);
  for (const n of [1, 2, 3]) fits(`toggle card with ${n} options`, BAND.left, TOGGLE.cardTop, BAND.width, 40 + n * TOGGLE.pitch);
  fits('number card', BAND.left, STAT.cardTop, BAND.width, STAT.cardH);
  fits('number dot', 540 - STAT.dotR, STAT.dotY - STAT.dotR, 2 * STAT.dotR, 2 * STAT.dotR);
  fits('work card', BAND.left, WORK.cardTop, BAND.width, WORK.cardH);
  fits('reel card', 270, 480, 540, 960);
  for (const rows of [1, 2, 3, 4]) {
    const L = introLayout(rows);
    fits(`home card with ${rows} rows`, BAND.left, L.cardTop, BAND.width, L.cardH);
    fits(`home button with ${rows} rows`, 540 - L.pillW / 2, L.pillY - L.pillH / 2, L.pillW, L.pillH);
    const size = headlineSize('أ'.repeat(10), 'ب'.repeat(10));
    assert.ok(330 + Math.round(2.36 * size) + 24 + 50 < L.cardTop, `${rows} rows: the card starts below the headline and the line under it`);
  }
  const {laptop: l, phone: p} = DESK;
  fits('laptop with its bezel', l.x - l.bezel, l.y - l.bezel, l.w + 2 * l.bezel, l.h + 2 * l.bezel);
  fits('laptop base', l.x - l.baseOverhang, l.y + l.h + l.bezel, l.w + 2 * l.baseOverhang, l.baseH);
  fits('phone with its bezel', p.x - p.bezel, p.y - p.bezel, p.w + 2 * p.bezel, p.h + 2 * p.bezel);
  fits('closing words of the starter chain', DESK.textLeft, DESK.textTop, DESK.textWidth, closingColumnBottom(oneShotTemplate.closing) - DESK.textTop);
  assert.ok(DESK.textTop > l.y + l.h + l.bezel + l.baseH, 'the closing words start below the laptop base');
  assert.ok(DESK.textLeft + DESK.textWidth < p.x - p.bezel, 'the closing words sit left of the phone');
  assert.ok(l.y + l.h + l.bezel + l.baseH < p.y - p.bezel, 'the phone sits below the laptop');
  assert.ok(Math.abs(p.w * 16 / 9 - p.h) < 1, 'the phone screen is 9:16, so the camera can fill the frame with it');
});

// Six closings measured with the real delivery gate while the closing words still started at y = 910. `chips` is the top of the first
// row of platform chips, `last` the bottom of the last row, `lines` the headline lines, sub lines and chip rows seen in the stills.
const PLATFORMS = ['Instagram', 'TikTok', 'Shorts'];
const MEASURED_FROM = 910;
const MEASURED = {
  A: {top: 'من الفكرة إلى الريل', sub: 'من فيديو خام لريل جاهز للنشر', platforms: PLATFORMS, lines: [4, 2, 2], chips: 1448, last: 1572},
  B: {top: 'من فكرة لريل في ٣ خطوات', sub: 'من فيديو خام لريل جاهز للنشر', platforms: PLATFORMS, lines: [3, 2, 2], chips: 1356, last: 1480},
  C: {top: '٣ خطوات بس', sub: 'اكتب هنا جملة الختام', platforms: PLATFORMS, lines: [2, 1, 2], chips: 1204, last: 1328},
  D: {top: 'من الفكرة إلى الريل', sub: 'من فيديو خام لريل جاهز', platforms: PLATFORMS, lines: [4, 1, 2], chips: 1388, last: 1512},
  E: {top: 'من الفكرة إلى الريل', sub: 'من فيديو خام لريل جاهز', platforms: PLATFORMS.slice(0, 2), lines: [4, 1, 1], chips: 1388, last: 1444},
  F: {top: 'ثلاث خطوات فقط', sub: 'من فيديو خام لريل جاهز', platforms: PLATFORMS, lines: [3, 1, 2], chips: 1296, last: 1420},
};
// Four more, measured on full-size stills of the real render with the words starting at y = 832 (`bottom` is the last painted row). They pin the side the six
// above leave open, the one that keeps the estimate from being short: two words with seven letters between them wrap (they did here), and so does a 23-character sub.
const RENDERED_FROM = 832;
const RENDERED = {
  seven: {top: 'ريلز جاهزة في دقايق', sub: 'جرّبه بنفسك واحكم', platforms: PLATFORMS.slice(0, 2), bottom: 1367},
  names: {top: 'حوّل الفكرة لريل', sub: 'في ٣ خطوات بس', platforms: ['Instagram', 'YouTube Shorts'], bottom: 1342},
  four: {top: 'وفّر وقتك وانشر أسرع', sub: 'شغل احترافي', platforms: PLATFORMS, bottom: 1434},
  wide: {top: 'مسموع ومفهوم للجميع', sub: 'عمل مسموع ومفهوم للعموم', platforms: PLATFORMS, bottom: 1402},
};
const demo = JSON.parse(readFileSync(new URL('../instructions/examples/one-shot-demo.json', import.meta.url), 'utf8'));
const withClosing = (closing) => ({...demo, scenes: [{...demo.scenes[0], data: {...demo.scenes[0].data, closing: {top: closing.top, sub: closing.sub, platforms: [...closing.platforms]}}}]});
const closingIssues = (closing) => validateOneShotTiming(oneShotSceneSchema.parse(withClosing(closing).scenes[0]), 30);

test('the closing column is stacked from its copy: the estimate follows ten closings measured on the real render', () => {
  const moved = DESK.textTop - MEASURED_FROM;
  for (const [name, c] of Object.entries(MEASURED)) {
    const column = closingColumn(c);
    assert.deepEqual([column.headlineLines, column.subLines, column.chipRows], c.lines, `${name}: lines of headline, sub and platform rows`);
    assert.ok(Math.abs(column.chipsTop - (c.chips + moved)) <= 4, `${name}: the chips start at ${column.chipsTop}, measured ${c.chips + moved}`);
    assert.ok(Math.abs(column.bottom - (c.last + moved)) <= 4, `${name}: the column ends at ${column.bottom}, measured ${c.last + moved}`);
    assert.equal(closingColumnBottom(c), column.bottom, name);
  }
  for (const [name, c] of Object.entries(RENDERED)) {
    const expected = c.bottom + DESK.textTop - RENDERED_FROM;
    assert.ok(Math.abs(closingColumnBottom(c) - expected) <= 4, `${name}: the column ends at ${closingColumnBottom(c)}, rendered ${expected}`);
  }
  assert.deepEqual(closingColumn({top: 'أ', sub: 'ب', platforms: ['X']}), {headlineLines: 1, subLines: 1, chipRows: 1, chipsTop: DESK.textTop + 92 + 20 + 60 + 30, bottom: DESK.textTop + 92 + 20 + 60 + 30 + 56});
});

test('a closing that would end below the limit is refused with what to shorten, and the measured ones that fit are accepted', () => {
  assert.equal(CLOSING_LIMIT, SAFE.bottom - 12);
  assert.equal(closingColumnBottom(MEASURED.A), 1494);
  const refused = closingIssues(MEASURED.A);
  assert.deepEqual(refused, ['chain: closing text would end at y=1494, limit 1458: shorten the headline, shorten the sub to one line or drop a platform']);
  assert.throws(() => normalizeGraphicsSpec(withClosing(MEASURED.A)), /closing text would end at y=1494, limit 1458/, 'the graphics route refuses it before anything is created');
  assert.ok(normalizeGraphicsSpec(withClosing(MEASURED.D)), 'a four-word headline with a one-line sub is accepted');
  const moved = DESK.textTop - MEASURED_FROM;
  for (const name of ['B', 'C', 'D', 'E', 'F']) {
    assert.deepEqual(closingIssues(MEASURED[name]), [], `${name} is accepted`);
    assert.ok(closingColumnBottom(MEASURED[name]) <= CLOSING_LIMIT, name);
    assert.ok(MEASURED[name].last + moved <= SAFE.bottom, `${name}: the last chip, measured at ${MEASURED[name].last + moved}, is inside the safe area`);
  }
  // The advice names only what can still shrink: one row of platforms cannot get shorter.
  const tall = {top: 'فكرة ريلز نشرة قصتك خطتك', sub: MEASURED.A.sub, platforms: ['Instagram']};
  assert.deepEqual([closingColumn(tall).headlineLines, closingColumn(tall).subLines, closingColumn(tall).chipRows], [5, 2, 1]);
  assert.deepEqual(closingIssues(tall), [`chain: closing text would end at y=${closingColumnBottom(tall)}, limit 1458: shorten the headline or shorten the sub to one line`]);
});

test('headlines and titles shrink instead of wrapping', () => {
  assert.equal(headlineSize('ريل جاهز', 'في ٣ خطوات'), 121);
  assert.equal(headlineSize('أ', 'ب'), 125, 'never larger than the cap');
  assert.ok(headlineSize('ا'.repeat(24), 'ب'.repeat(24)) >= 50);
  assert.equal(fitLine('اكتب الفكرة', 900, HEAD.titleSize), HEAD.titleSize);
  assert.ok(fitLine('ا'.repeat(26), 900, HEAD.titleSize) < 60);
  assert.deepEqual(statSizes('٣', 'دقايق'), {num: 250, unit: 70}, 'a short number keeps its full size');
  const worst = statSizes('٩٩٬٩٩٩٫٩٩', 'ا'.repeat(12));
  assert.equal(reelCaptionSize(['أ', 'ب', 'ج', 'د']), 92, 'short words keep the full size');
  const long = reelCaptionSize(['ا'.repeat(14), 'ا'.repeat(14), 'ا'.repeat(14), 'ا'.repeat(14), 'ا'.repeat(14), 'ا'.repeat(14)]);
  assert.ok(long >= 20 && long * 0.64 * 28 + 52 * 2 + 14 <= 930 + 1, 'the longest possible lines still fit between the margins');
  assert.ok(REEL.captionTop + 2 * 1.3 * 92 + 12 <= SAFE.railY, 'two lines of caption end above the action rail');
  assert.ok(worst.num >= 60 && worst.unit >= 36 && worst.num * 0.62 * 9 + 0.52 * worst.unit * 12 + 24 <= 780, 'the longest number and unit still fit on one line');
});

test('cues are whole frames inside the scene, ordered, and the first frame is silent', () => {
  for (const fps of [30, 50, 60]) {
    const frames = oneShotMinFrames(COMMON, fps);
    const cues = oneShotCues(COMMON, fps);
    assert.ok(cues.length > 25);
    assert.deepEqual(cues.map((cue) => cue.frame), cues.map((cue) => cue.frame).sort((a, b) => a - b));
    for (const cue of cues) {
      assert.ok(Number.isInteger(cue.frame) && cue.frame > 0 && cue.frame < frames, `${cue.kind}@${cue.frame}`);
      assert.ok(Object.keys(sound.kinds).includes(cue.kind));
    }
  }
  const scene = {id: 'chain', family: 'one-shot', fromFrame: 90, durationInFrames: 600, data: COMMON};
  const seen = sceneCues(scene, 30);
  assert.ok(seen.every((cue) => cue.frame >= 90 + 30), 'the take opens on a silent home page and every cue is offset by the scene start');
  assert.ok(seen.some((cue) => cue.kind === 'transition') && seen.some((cue) => cue.kind === 'click') && seen.some((cue) => cue.kind === 'type'));
});

test('the sound lead-ins in the palette are the ones the cues assume', () => {
  assert.equal(sound.kinds.transition.leadSec, LEAD.transition);
  assert.equal(sound.kinds.swap.leadSec, LEAD.swap);
  assert.equal(sound.kinds.transition.recipe, 'air-rise');
  assert.equal(sound.kinds.swap.recipe, 'air-pass');
});

test('motion blur is asked for only while the camera moves, and always inside the scene', () => {
  const tl = oneShotTimeline(COMMON);
  const windows = blurWindows(tl);
  assert.equal(windows.length, tl.blocks.length + 3);
  for (const [a, b] of windows) assert.ok(a >= 0 && a < b && b <= tl.total);
  assert.deepEqual(windows[0], [1.78, 2.5]);
});
