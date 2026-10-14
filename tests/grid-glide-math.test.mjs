import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import * as math from '../engine/src/styles/grid-glide/scenes/math.ts';
import {SLAB} from '../engine/src/creative-kit/card-shape.ts';

const {
  OUT, IN, WIPE, wipeFrames, wordProgress, enterOffset, exitOffset, dipBlur, VIGNETTE_BUMP, vignetteOpacity,
  pillOffset, pillOpacity, sparkleScale, sparkleRotation, cadence, bulletSlide, RISE, CADENCE, SLIDE, PILL, CARD,
  STAR, SIZE, COLOR, WEIGHT, BOX, GRID, BULLET, DIP, ENTER_FRAMES, EXIT_FRAMES, boxHidePercent, pushVector,
  sceneMotionState, gridGeometry, clipIndexAt, clipWindow, coverFit, scrollOffset, cardInner, largestFit,
  REFERENCE_FPS, scale, unscale, framesAtFps, VIGNETTE_STEPS, pillStart,
} = math;

const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label ?? 'value'}: ${actual} is not within ${tolerance} of ${expected}`);
const sha = (text) => createHash('sha256').update(text).digest('hex');

// Tables of the motion law (frames at 30 fps; every function defaults to `fps = 30`).
const OUT_TABLE = [0, 0.2441, 0.3599, 0.4463, 0.5163, 0.5752, 0.6260, 0.6704, 0.7096, 0.7444, 0.7756, 0.8035, 0.8287, 0.8513, 0.8716, 0.8899, 0.9063, 0.9210, 0.9341, 0.9458, 0.9561, 0.9651, 0.9730, 0.9797, 0.9853, 0.9900, 0.9937, 0.9965, 0.9985, 0.9996, 1];
const IN_TABLE = [0, 0.0015, 0.0063, 0.0147, 0.0270, 0.0439, 0.0659, 0.0937, 0.1284, 0.1713, 0.2244, 0.2904, 0.3740, 0.4837, 0.6401, 1];
const EXIT_PX_D400 = [0, 0.6, 2.5, 5.9, 10.8, 17.6, 26.3, 37.5, 51.4, 68.5, 89.8, 116.2, 149.6, 193.5, 256.0];
const EXIT_PX_D200 = [0, 0.3, 1.3, 2.9, 5.4, 8.8, 13.2, 18.7, 25.7, 34.3, 44.9, 58.1, 74.8, 96.7, 128.0];
// Corner luma measured during an in-place dip on a luma-242 canvas, frames B-6 .. B+4.
const CORNER_LUMA = [242, 234, 220, 202, 188, 182, 187, 201, 219, 235, 242];

// Independent evaluation of cubic-bezier(x1,y1,x2,y2) by dense sampling, used to check WIPE.
const denseBezier = (x1, y1, x2, y2, x) => {
  let px = 0, py = 0;
  for (let i = 1; i <= 200000; i++) {
    const u = i / 200000;
    const bx = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u ** 3;
    const by = 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u ** 3;
    if (bx >= x) return py + (by - py) * ((x - px) / (bx - px));
    px = bx; py = by;
  }
  return 1;
};

test('the math module is Node-safe: no imports, no JSX, no packages', async () => {
  const source = await readFile(new URL('../engine/src/styles/grid-glide/scenes/math.ts', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false, 'math.ts must not import anything');
  assert.equal(/<\/?[A-Za-z][^>]*>\s*[;)]/.test(source.replace(/`[^`]*`/g, '')), false, 'math.ts must contain no JSX');
  assert.equal(/\benum\b|\bnamespace\b/.test(source), false, 'only erasable TypeScript syntax is allowed');
});

test('OUT and IN match the measured easing tables', () => {
  OUT_TABLE.forEach((expected, k) => near(OUT(k / 30), expected, 1e-4, `OUT(${k}/30)`));
  IN_TABLE.forEach((expected, k) => near(IN(k / 15), expected, 1e-4, `IN(${k}/15)`));
  assert.equal(OUT(-3), 0);
  assert.equal(OUT(7), 1);
  assert.equal(IN(-3), 0);
  assert.equal(IN(7), 1);
});

test('WIPE follows cubic-bezier(0.05, 0.15, 0.2, 1) and is monotonic', () => {
  for (const x of [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99]) near(WIPE(x), denseBezier(0.05, 0.15, 0.2, 1, x), 1e-4, `WIPE(${x})`);
  assert.equal(WIPE(0), 0);
  assert.equal(WIPE(1), 1);
  assert.equal(WIPE(-1), 0);
  assert.equal(WIPE(2), 1);
  let previous = 0;
  for (let i = 1; i <= 100; i++) {
    const value = WIPE(i / 100);
    assert.ok(value >= previous, 'WIPE must never go backwards');
    previous = value;
  }
});

test('a box wipe lasts 7.5 frames per word plus half a frame', () => {
  assert.equal(wipeFrames(4), 30.5);
  assert.equal(wipeFrames(5), 38);
  assert.equal(wipeFrames(1), 8);
  // Two timed examples lasted 29.75 and 39 frames; the formula stays within a frame of both.
  near(wipeFrames(4), 29.75, 1);
  near(wipeFrames(5), 39, 1);
  assert.equal(boxHidePercent(10, 10, 4), 100, 'nothing is visible on the start frame');
  assert.equal(boxHidePercent(0, 10, 4), 100);
  near(boxHidePercent(10 + wipeFrames(4), 10, 4), 0, 1e-9);
  near(boxHidePercent(10 + wipeFrames(4) / 2, 10, 4), (1 - WIPE(0.5)) * 100, 1e-9);
});

test('word entrances: invisible on the start frame, first visible a frame later, settled after 30', () => {
  assert.equal(wordProgress(40, 40), 0);
  near(wordProgress(41, 40), 0.2441, 1e-4);
  assert.equal(wordProgress(70, 40), 1);
  assert.equal(wordProgress(500, 40), 1);
  // Fractional starts are legal: the first drawn frame is floor(start) + 1.
  assert.equal(wordProgress(10, 10.5), 0);
  assert.ok(wordProgress(11, 10.5) > 0.15);
  // Offsets at A = 130 on the first four visible frames.
  const offsets = [1, 2, 3, 4].map((k) => RISE.stack * (1 - wordProgress(k, 0)));
  [98.3, 83.2, 72.0, 62.9].forEach((expected, i) => near(offsets[i], expected, 0.3, `word offset frame ${i + 1}`));
  near(RISE.caption * (1 - wordProgress(1, 0)), 60.5, 0.3, 'A = 80 first visible frame');
  near(RISE.stack * (1 - wordProgress(10, 0)), 29.2, 0.3);
  near(RISE.stack * (1 - wordProgress(30, 0)), 0, 1e-9);
});

test('scene entrances start at the full offset on frame 0 and settle at frame 30', () => {
  const offsets = [1, 2, 3, 4].map((k) => enterOffset(k, 130));
  [98.3, 83.2, 72.0, 62.9].forEach((expected, i) => near(offsets[i], expected, 0.3, `enter offset frame ${i + 1}`));
  assert.equal(enterOffset(0, 400), 400);
  assert.equal(enterOffset(0, 500), 500);
  near(enterOffset(1, 400), 302.4, 0.1);
  assert.equal(enterOffset(ENTER_FRAMES, 400), 0);
  assert.equal(enterOffset(90, 400), 0);
});

test('scene exits follow the measured offsets and the 15th frame is the cut', () => {
  EXIT_PX_D400.forEach((expected, k) => near(exitOffset(k, 0, 400), expected, 0.2, `D400 k=${k}`));
  EXIT_PX_D200.forEach((expected, k) => near(exitOffset(k, 0, 200), expected, 0.1, `D200 k=${k}`));
  assert.equal(exitOffset(0, 0, 400), 0);
  assert.equal(exitOffset(EXIT_FRAMES, 0, 400), 400, 'the end value belongs to the next scene and is never shown');
  assert.equal(exitOffset(40 + 7, 40, 400), exitOffset(7, 0, 400), 'only the distance from t0 matters');
});

test('dip blur: ten frames around the boundary, 14.8 px at the peak, silent outside', () => {
  const B = 100;
  const expected = [2.35, 6.81, 10.61, 13.37, 14.82, 14.82, 13.37, 10.61, 6.81, 2.35];
  expected.forEach((value, i) => near(dipBlur(B - 5 + i, B), value, 0.01, `blur at B${i - 5 >= 0 ? '+' : ''}${i - 5}`));
  assert.equal(dipBlur(B - 6, B), 0);
  assert.equal(dipBlur(B + 5, B), 0);
  assert.equal(DIP.peak, 15);
  near(dipBlur(B - 1, B), 14.8, 0.05);
  near(dipBlur(B, B), 14.8, 0.05);
  for (let k = 0; k < 5; k++) near(dipBlur(B - 1 - k, B), dipBlur(B + k, B), 1e-9, 'blur is symmetric around the boundary');
  // Scene-relative use: the incoming scene sees B = 0 and the outgoing scene sees B = its duration.
  near(dipBlur(0, 0), 14.8, 0.05);
  near(dipBlur(119, 120), 14.8, 0.05);
  assert.equal(dipBlur(5, 0), 0);
  assert.equal(dipBlur(114, 120), 0);
});

test('vignette: nine frames from B-5, peak on B-1, matches the measured corner darkening', () => {
  assert.deepEqual([...VIGNETTE_BUMP], [0.12, 0.4, 0.69, 0.93, 1, 0.93, 0.7, 0.38, 0.14]);
  const B = 200;
  VIGNETTE_BUMP.forEach((value, i) => assert.equal(vignetteOpacity(B - 5 + i, B), value));
  assert.equal(vignetteOpacity(B - 6, B), 0);
  assert.equal(vignetteOpacity(B + 4, B), 0);
  assert.equal(vignetteOpacity(B - 1, B), 1);
  // A corner pixel is background x (1 - 0.24 x opacity); compare with the measured luma within 2 levels.
  CORNER_LUMA.forEach((luma, i) => {
    const frame = B - 6 + i;
    near(Math.round(242 * (1 - 0.24 * vignetteOpacity(frame, B))), luma, 2, `corner luma at B${frame - B >= 0 ? '+' : ''}${frame - B}`);
  });
});

test('the pill slides 660.6 px over 21.75 frames and fades in linearly', () => {
  assert.equal(PILL.slide.from, -660.6);
  near(pillOffset(100, 100), -660.6, 1e-9);
  near(pillOffset(101, 100), -467.0, 0.1);
  near(pillOffset(105, 100), -220.6, 0.1);
  near(pillOffset(110, 100), -87.5, 0.1);
  near(pillOffset(100 + PILL.slide.frames, 100), 0, 1e-9);
  assert.equal(pillOffset(300, 100), 0);
  assert.equal(pillOpacity(100, 100), 0);
  assert.equal(pillOpacity(102.5, 100), 0);
  near(pillOpacity(107.9, 100), 0.5, 1e-9);
  near(pillOpacity(113.3, 100), 1, 1e-9);
  assert.equal(pillOpacity(113.4, 100), 1);
  assert.equal(pillOpacity(400, 100), 1);
  assert.equal(PILL.labelSlot, PILL.w - PILL.tileInset - PILL.tile - PILL.labelGap - 30);
  assert.equal(PILL.labelMin, 50);
  assert.equal(PILL.label, 72);
  assert.equal(PILL.afterHero, 14.75);
});

test('the sparkle grows linearly over 8.5 frames while unwinding 16 degrees', () => {
  assert.equal(sparkleScale(-1), 0);
  near(sparkleScale(0), 0.5 / 8.5, 1e-12);
  near(sparkleScale(4), 4.5 / 8.5, 1e-12);
  assert.equal(sparkleScale(8), 1);
  assert.equal(sparkleScale(40), 1);
  assert.equal(sparkleRotation(0), 16);
  assert.equal(sparkleRotation(4), 8);
  assert.equal(sparkleRotation(8), 0);
  assert.equal(sparkleRotation(30), 0);
  // The measured rotation per frame stays within two degrees of the linear model.
  [16, 15, 12.4, 10.2, 7.1, 4.4, 2.2, 0.6, 0].forEach((measured, t) => near(sparkleRotation(t), measured, 2, `rotation t=${t}`));
  assert.equal(STAR.size, 72);
  assert.equal(STAR.lead, 2);
});

test('cadence, bullet slide, and the named constants', () => {
  assert.deepEqual(cadence(4, 10, 6.5), [10, 16.5, 23, 29.5]);
  assert.deepEqual(cadence(0, 10, 7), []);
  assert.deepEqual(cadence(3, 0, CADENCE.stack), [0, 7, 14]);
  assert.equal(bulletSlide(64), 96);
  assert.equal(bulletSlide(70), 105);
  assert.deepEqual({...RISE}, {stack: 130, caption: 80});
  assert.deepEqual({...CADENCE}, {opening: 6, stack: 7, caption: 6.5, recap: 7.5, bullet: 5});
  assert.deepEqual({...SLIDE}, {enter: 400, enterWide: 500, exitH: 400, exitV: 200});
  assert.deepEqual({...SIZE}, {lead: 70, leadSmall: 64, hero: 100, heroBig: 124, chapter: 142, cta: 150, box: 88, bullet: 64});
  assert.deepEqual({...BULLET}, {starRtl: 790, starLtr: 200, min: 48});
  assert.equal(BOX.width, 830);
  assert.equal(WEIGHT.lead, 500);
  assert.equal(Object.keys(COLOR).some((key) => /coral|accent/i.test(key)), false, 'the palette is monochrome');
  assert.equal(JSON.stringify(COLOR).toLowerCase().includes('cf6e58'), false);
});

test('card and pill material keep the measured bevel layers and two-layer shadow', () => {
  assert.equal(CARD.x, 127);
  assert.equal(CARD.w, 827);
  assert.equal(CARD.radius, 24);
  assert.equal(CARD.inset, 9);
  assert.equal(CARD.innerRadius, 15);
  assert.equal(CARD.shadow, '15px 15px 27px -3px rgba(0,0,0,.255), 48px 48px 45px 7px rgba(0,0,0,.163)');
  assert.equal(sha(CARD.bevel), 'b36d7a4b2a94e565fa20206e0fc43aa88fdf52fdb538c03ddfccfd572615d22e');
  assert.equal(CARD.bevel.split(', ').length, 34);
  assert.equal(PILL.shadow, '32.2px 26.6px 44.6px 1px rgba(0,0,0,.245), 93.3px 104.3px 91.2px 23.1px rgba(0,0,0,.169)');
  assert.equal(sha(PILL.bevel), '1da55c339a293e32a9fc34cb4e77045a349f99395325136a9792a5409a45ba96');
  assert.equal(PILL.bevel.split(', ').length, 50);
  assert.deepEqual(cardInner(827, 465), {w: 809, h: 447});
});

test('push exits and slide-ins translate the whole scene scene-relatively', () => {
  assert.deepEqual(pushVector('left'), {x: -1, y: 0, D: 400});
  assert.deepEqual(pushVector('right'), {x: 1, y: 0, D: 400});
  assert.deepEqual(pushVector('up'), {x: 0, y: -1, D: 200});
  assert.deepEqual(pushVector('down'), {x: 0, y: 1, D: 200});
  const push = (dir, f, duration = 120) => sceneMotionState(f, duration, {kind: 'cut'}, {kind: 'push', dir});
  assert.deepEqual(push('right', 105), {dx: 0, dy: 0, blur: 0}, 'the push has not started on frame duration-15');
  near(push('right', 106).dx, 0.6, 0.05);
  near(push('right', 119).dx, 256.0, 0.1);
  near(push('left', 119).dx, -256.0, 0.1);
  near(push('down', 119).dy, 128.0, 0.1);
  near(push('up', 119).dy, -128.0, 0.1);
  assert.equal(push('up', 119).dx, 0);
  assert.equal(push('right', 50).dx, 0);
  const slide = (from, f, distance) => sceneMotionState(f, 120, {kind: 'slide', from, distance}, {kind: 'cut'});
  assert.equal(slide('left', 0).dx, -400);
  assert.equal(slide('right', 0).dx, 400);
  assert.equal(slide('right', 0, 500).dx, 500);
  near(slide('left', 1).dx, -302.4, 0.1);
  assert.equal(slide('left', 30).dx, 0);
  assert.equal(slide('left', 30).dy, 0);
  // A cut changes nothing on either side.
  assert.deepEqual(sceneMotionState(0, 120, {kind: 'cut'}, {kind: 'cut'}), {dx: 0, dy: 0, blur: 0});
  assert.deepEqual(sceneMotionState(119, 120, {kind: 'cut'}, {kind: 'cut'}), {dx: 0, dy: 0, blur: 0});
});

test('dips blur the incoming scene on frames 0-4 and the outgoing scene on its last five frames', () => {
  const state = (f) => sceneMotionState(f, 120, {kind: 'dip'}, {kind: 'dip'});
  near(state(0).blur, 14.8, 0.05);
  near(state(4).blur, 2.35, 0.01);
  assert.equal(state(5).blur, 0);
  assert.equal(state(60).blur, 0);
  assert.equal(state(114).blur, 0);
  near(state(115).blur, 2.35, 0.01);
  near(state(119).blur, 14.8, 0.05);
  assert.equal(state(119).dx, 0, 'a dip never translates');
});

test('scenes too short for their exit fail loudly', () => {
  assert.throws(() => sceneMotionState(0, 10, {kind: 'cut'}, {kind: 'push', dir: 'left'}), /at least 15 frames/);
  assert.throws(() => sceneMotionState(0, 3, {kind: 'cut'}, {kind: 'dip'}), /at least 5 frames/);
  assert.throws(() => sceneMotionState(0, 0, {kind: 'cut'}, {kind: 'cut'}), /positive whole number/);
  assert.throws(() => sceneMotionState(0, 12.5, {kind: 'cut'}, {kind: 'cut'}), /positive whole number/);
});

test('the grid is generated from a spacing, centred on the canvas', () => {
  const g = gridGeometry();
  assert.equal(g.xs.length, GRID.columns);
  assert.equal(g.ys.length, GRID.rows);
  assert.equal(g.xs[3], 540);
  assert.equal(g.ys[4], 960);
  assert.deepEqual(g.xs.map((x, i) => (i ? x - g.xs[i - 1] : 128)), Array(7).fill(128));
  assert.deepEqual(g.ys.map((y, i) => (i ? y - g.ys[i - 1] : 128)), Array(9).fill(128));
  assert.equal(g.xs[0] + g.xs[6], 1080);
  assert.equal(g.ys[0] + g.ys[8], 1920);
  assert.equal(g.x0, g.xs[0] - 64);
  assert.equal(g.y1, g.ys[8] + 64);
  const wide = gridGeometry(100);
  assert.equal(wide.xs[6] - wide.xs[0], 600);
});

test('card media: hard cuts, first clip from frame 0, windows and scrolling', () => {
  const ats = [0, 40, 90];
  assert.equal(clipIndexAt(ats, 0), 0);
  assert.equal(clipIndexAt(ats, 39), 0);
  assert.equal(clipIndexAt(ats, 40), 1);
  assert.equal(clipIndexAt(ats, 89), 1);
  assert.equal(clipIndexAt(ats, 500), 2);
  assert.equal(clipIndexAt([12, 50], 3), 0, 'the card is never empty: clip 0 shows before its own cut');
  assert.deepEqual(clipWindow(ats, 0, 150), {start: 0, end: 40});
  assert.deepEqual(clipWindow(ats, 2, 150), {start: 90, end: 150});
  assert.deepEqual(clipWindow([12, 50], 0, 150), {start: 0, end: 50});
  const fit = coverFit(1000, 3000, 809, 447);
  near(fit.width, 809, 1e-9);
  near(fit.height, 2427, 1e-9);
  assert.equal(fit.left, 0);
  near(fit.rangeY, 1980, 1e-9);
  const wide = coverFit(1600, 900, 809, 447);
  assert.ok(wide.width >= 809 && wide.height >= 447);
  near(wide.rangeY, 8.06, 0.01);
  assert.throws(() => coverFit(0, 10, 10, 10), /cannot fit/);
  const window = {start: 40, end: 100};
  assert.equal(scrollOffset(1980, undefined, 70, window), 0);
  assert.equal(scrollOffset(0, {from: 0, to: 1}, 70, window), 0);
  assert.equal(scrollOffset(1980, {from: 0, to: 1}, 40, window), 0);
  near(scrollOffset(1980, {from: 0, to: 1}, 70, window), 990, 1e-9);
  near(scrollOffset(1980, {from: 0, to: 1}, 100, window), 1980, 1e-9);
  near(scrollOffset(1980, {from: 0.25, to: 0.75}, 70, window), 990, 1e-9);
  assert.equal(scrollOffset(1980, {from: 0, to: 1}, 500, window), 1980);
});

test('largestFit finds the biggest whole size that fits and reports when none does', () => {
  const width = (size) => size * 10;
  assert.deepEqual(largestFit(width, 500, 20, 88), {size: 50, width: 500, fits: true});
  assert.deepEqual(largestFit(width, 5000, 20, 88), {size: 88, width: 880, fits: true});
  assert.deepEqual(largestFit(width, 100, 20, 88), {size: 20, width: 200, fits: false});
  assert.equal(largestFit(width, 205, 20, 88).size, 20);
  assert.throws(() => largestFit(width, 100, 50, 40), /empty/);
});

test('the Grid Glide card material equals the shared slab material', () => {
  assert.equal(CARD.bevel, SLAB.bevel);
  assert.equal(CARD.shadow, SLAB.shadow);
  assert.deepEqual([CARD.radius, CARD.inset, CARD.innerRadius], [SLAB.radius, SLAB.inset, SLAB.innerRadius]);
});

test('frame counts authored at 30 fps scale with the edit frame rate: entrances, exits, wipes and cadence', () => {
  assert.equal(REFERENCE_FPS, 30);
  assert.equal(scale(15), 15, 'the default is the 30 fps law, returned unchanged');
  assert.equal(scale(10.8), 10.8);
  assert.equal(scale(15, 30), 15);
  assert.equal(scale(15, 60), 30);
  assert.equal(scale(21.75, 60), 43.5);
  assert.equal(scale(15, 24), 12);
  assert.equal(unscale(30, 60), 15);
  assert.equal(unscale(7), 7);
  assert.equal(framesAtFps(15), 15);
  assert.equal(framesAtFps(15, 25), 13, 'a length is rounded up to whole frames: 12.5 becomes 13');
  assert.equal(framesAtFps(5, 60), 10);
  assert.equal(framesAtFps(60, 24), 48);
  assert.throws(() => scale(15, 0), /frame rate must be a positive number/);
  assert.throws(() => unscale(15, Number.NaN), /frame rate must be a positive number/);
  // Entrance: frame 2 at 60 fps is frame 1 at 30 fps, and a word settles after 60 frames instead of 30.
  near(wordProgress(2, 0, 60), wordProgress(1, 0), 1e-12, 'word progress');
  near(wordProgress(2, 0, 60), 0.2441, 1e-4);
  assert.equal(wordProgress(40, 40, 60), 0, 'still invisible on the start frame');
  assert.ok(wordProgress(59, 0, 60) < 1);
  assert.equal(wordProgress(60, 0, 60), 1);
  near(enterOffset(2, 400, 60), enterOffset(1, 400), 1e-9, 'scene entrance');
  near(enterOffset(2, 400, 60), 302.4, 0.1);
  assert.equal(enterOffset(0, 400, 60), 400);
  assert.equal(enterOffset(60, 400, 60), 0);
  // Exit: the 15 frames become 30; frame 2k at 60 fps is frame k at 30 fps and frame 30 is the cut.
  EXIT_PX_D400.forEach((expected, k) => near(exitOffset(2 * k, 0, 400, 60), expected, 0.2, `D400 k=${k} at 60 fps`));
  assert.equal(exitOffset(30, 0, 400, 60), 400, 'the 30th frame is the next scene');
  assert.ok(exitOffset(29, 0, 400, 60) > exitOffset(28, 0, 400, 60) && exitOffset(29, 0, 400, 60) < 400);
  near(exitOffset(11, 0, 400, 24), exitOffset(13.75, 0, 400), 1e-9, 'at 24 fps the exit takes 12 frames');
  assert.equal(exitOffset(12, 0, 400, 24), 400);
  // Box wipe and cadence.
  assert.equal(wipeFrames(4, 60), 61);
  assert.equal(wipeFrames(5, 60), 76);
  assert.equal(wipeFrames(4, 30), 30.5);
  assert.equal(boxHidePercent(10, 10, 4, 60), 100);
  near(boxHidePercent(10 + wipeFrames(4, 60), 10, 4, 60), 0, 1e-9);
  near(boxHidePercent(10 + wipeFrames(4, 60) / 2, 10, 4, 60), (1 - WIPE(0.5)) * 100, 1e-9);
  assert.deepEqual(cadence(3, 0, CADENCE.stack, 60), [0, 14, 28]);
  assert.deepEqual(cadence(4, 10, 6.5, 60), [10, 23, 36, 49]);
  assert.deepEqual(cadence(4, 10, 6.5, 30), [10, 16.5, 23, 29.5]);
  assert.deepEqual(cadence(4, 10, 6.5), [10, 16.5, 23, 29.5], 'the default stays the 30 fps rhythm');
  // The default pill start follows the hero word; an authored pillAt is already in frames of the edit.
  assert.equal(pillStart(10, undefined), 24.75);
  assert.equal(pillStart(10, undefined, 60), 39.5);
  assert.equal(pillStart(10, 12, 60), 12);
});

test('dip, vignette, pill and sparkle scale with the edit frame rate', () => {
  const B = 100;
  // Dip and vignette keep one clock with the 30 fps law: frame 2k at 60 fps is frame k at 30 fps, so a 60 fps edit
  // shows the same picture at the same second. The window is the same time span: ten frames out and nine in at 60 fps.
  for (let k = -8; k <= 8; k++) {
    near(dipBlur(2 * (B + k), 2 * B, 60), dipBlur(B + k, B), 1e-9, `blur: frame ${2 * k} at 60 fps is frame ${k} at 30 fps`);
    near(vignetteOpacity(2 * (B + k), 2 * B, 60), vignetteOpacity(B + k, B), 1e-12, `vignette: frame ${2 * k} at 60 fps is frame ${k} at 30 fps`);
  }
  assert.equal(dipBlur(B - 11, B, 60), 0);
  assert.ok(dipBlur(B - 10, B, 60) > 0, 'first blurred frame');
  assert.ok(dipBlur(B + 8, B, 60) > 0, 'last blurred frame');
  assert.equal(dipBlur(B + 9, B, 60), 0);
  assert.equal(dipBlur(B - 1, B), dipBlur(B - 1, B, 30), 'the default is the 30 fps law, to the digit');
  const peak = (frames) => Math.max(...frames.map((f) => dipBlur(f, B, 60)));
  near(peak([B - 1, B]), 15, 1e-9, 'the odd frame between two 30 fps frames reaches the full 15 px');
  // Vignette: the 11-step table sampled by time with linear interpolation.
  assert.equal(VIGNETTE_STEPS.length, 11);
  assert.deepEqual([...VIGNETTE_STEPS], [0, ...VIGNETTE_BUMP, 0]);
  VIGNETTE_BUMP.forEach((value, i) => assert.equal(vignetteOpacity(B - 5 + i, B, 30), value));
  assert.equal(vignetteOpacity(B - 2, B, 60), 1, 'the peak lands on the frame that is B - 1 at 30 fps');
  near(vignetteOpacity(B - 1, B, 60), (1 + 0.93) / 2, 1e-12, 'between the peak and the first incoming step');
  near(vignetteOpacity(B - 11, B, 60), 0.12 / 2, 1e-12);
  near(vignetteOpacity(B + 7, B, 60), 0.14 / 2, 1e-12);
  assert.equal(vignetteOpacity(B - 12, B, 60), 0);
  assert.equal(vignetteOpacity(B + 8, B, 60), 0);
  for (let f = B - 14; f <= B + 14; f++) {
    const value = vignetteOpacity(f, B, 60);
    assert.ok(value >= 0 && value <= 1, `opacity ${value} at ${f}`);
  }
  // Pill: the slide takes 43.5 frames, the fade starts after 5 and takes 21.6.
  near(pillOffset(100, 100, 60), -660.6, 1e-9);
  near(pillOffset(102, 100, 60), pillOffset(101, 100), 1e-9, 'frame 2 at 60 fps is frame 1 at 30 fps');
  near(pillOffset(110, 100, 60), pillOffset(105, 100), 1e-9);
  near(pillOffset(100 + 43.5, 100, 60), 0, 1e-9);
  assert.equal(pillOffset(300, 100, 60), 0);
  assert.equal(pillOpacity(105, 100, 60), 0);
  near(pillOpacity(115.8, 100, 60), 0.5, 1e-9);
  near(pillOpacity(126.6, 100, 60), 1, 1e-9);
  assert.equal(pillOpacity(127, 100, 60), 1);
  // Sparkle: 8.5 frames of growth become 17, 8 frames of unwinding become 16.
  assert.equal(sparkleScale(-1, 60), 0);
  near(sparkleScale(0, 60), 0.5 / 8.5, 1e-12);
  near(sparkleScale(8, 60), sparkleScale(4), 1e-12, 'frame 8 at 60 fps is frame 4 at 30 fps');
  assert.ok(sparkleScale(15, 60) < 1);
  assert.equal(sparkleScale(16, 60), 1);
  assert.equal(sparkleRotation(0, 60), 16);
  near(sparkleRotation(8, 60), sparkleRotation(4), 1e-12);
  assert.equal(sparkleRotation(16, 60), 0);
  // Scene motion: a push moves over the last 30 frames at 60 fps and needs a scene of at least that length.
  const push60 = (dir, f, duration = 240) => sceneMotionState(f, duration, {kind: 'cut'}, {kind: 'push', dir}, 60);
  assert.deepEqual(push60('right', 210), {dx: 0, dy: 0, blur: 0}, 'the push has not started on frame duration-30');
  near(push60('right', 212).dx, 0.6, 0.05);
  near(push60('right', 238).dx, 256.0, 0.1);
  near(push60('down', 238).dy, 128.0, 0.1);
  assert.throws(() => sceneMotionState(0, 29, {kind: 'cut'}, {kind: 'push', dir: 'left'}, 60), /at least 30 frames/);
  assert.doesNotThrow(() => sceneMotionState(0, 30, {kind: 'cut'}, {kind: 'push', dir: 'left'}, 60));
  assert.throws(() => sceneMotionState(0, 9, {kind: 'cut'}, {kind: 'dip'}, 60), /at least 10 frames/);
  assert.throws(() => sceneMotionState(0, 12, {kind: 'cut'}, {kind: 'push', dir: 'left'}, 25), /at least 13 frames/);
  const slide60 = (f) => sceneMotionState(f, 240, {kind: 'slide', from: 'left', distance: 400}, {kind: 'cut'}, 60);
  assert.equal(slide60(0).dx, -400);
  near(slide60(2).dx, -302.4, 0.1);
  assert.equal(slide60(60).dx, 0);
  const dip60 = (f) => sceneMotionState(f, 240, {kind: 'dip'}, {kind: 'dip'}, 60).blur;
  near(dip60(0), dipBlur(0, 0), 1e-9, 'an incoming dip starts where it starts at 30 fps');
  assert.ok(dip60(8) > 0);
  assert.equal(dip60(9), 0);
  assert.equal(dip60(229), 0);
  assert.ok(dip60(230) > 0);
  near(dip60(239), 15, 1e-9, 'the last outgoing frame reaches the full 15 px');
});
