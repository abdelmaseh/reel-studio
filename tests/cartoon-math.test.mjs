import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACT_MIN_SECONDS, CARD_BAND, CARD_KINDS, CARTOON_FAMILIES, FLIP, HEADLINE, PALETTES, REVEAL, SAFE, THEMES,
  anchorFrame, estimateHeadlineLines, flipFrameFor, groundOf, inkFlipOffset, resolveCartoonTimeline, revealRadius, wordIndex,
} from '../engine/src/styles/cartoon/scenes/math.ts';
import {contrastRatio} from '../engine/src/core/chapters.ts';
import {body, words} from './helpers/cartoon-fixtures.mjs';

const scene = {fromFrame: 0, durationInFrames: 260};

test('constants: families, themes, grounds, safe area and the card band', () => {
  assert.deepEqual([...CARTOON_FAMILIES], ['cartoon', 'cartoon-ending']);
  assert.deepEqual([...THEMES], ['light', 'dark', 'pink']);
  assert.deepEqual(THEMES.map(groundOf), ['paper', 'night', 'paper']);
  assert.deepEqual(SAFE, {top: 250, bottom: 1470, left: 65, right: 1015, railX: 853, railY: 1150});
  assert.deepEqual(CARD_BAND, {top: 680, bottom: 1110, left: 65, right: 1015});
  assert.equal(HEADLINE.maxLines, 3);
  assert.equal(REVEAL.seconds, 0.36);
  assert.equal(REVEAL.radius, 2400);
  assert.deepEqual(FLIP, {lead: 0.36, after: 0.06, min: 0.2, max: 0.5});
  assert.equal(ACT_MIN_SECONDS, 3);
  assert.deepEqual([...CARD_KINDS], ['term', 'windows', 'fan', 'code', 'link', 'grid', 'crossed', 'stack', 'nodes', 'morph', 'monitor', 'timer']);
});

test('every text token of every act palette reaches 4.5:1 on its ground, card and pill', () => {
  for (const theme of THEMES) {
    const p = PALETTES[theme];
    for (const [name, colour] of [['ink', p.ink], ['dim', p.dim], ['accentInk', p.accentInk]]) {
      assert.ok(contrastRatio(colour, p.ground) >= 4.5, `${theme} ${name} on ground: ${contrastRatio(colour, p.ground)}`);
      assert.ok(contrastRatio(colour, p.card) >= 4.5, `${theme} ${name} on card: ${contrastRatio(colour, p.card)}`);
    }
    assert.ok(contrastRatio(p.onAccent, p.accent) >= 4.5, `${theme} onAccent`);
    assert.ok(contrastRatio(p.pillText, p.pill) >= 4.5, `${theme} pill`);
  }
});

test('word anchors resolve to scene-relative frames and refuse unknown words', () => {
  const index = wordIndex(words());
  assert.equal(anchorFrame({word: 4}, index, 30), 60);
  assert.equal(anchorFrame({word: 4, dt: -0.1}, index, 30), 57);
  assert.equal(anchorFrame({word: 99}, index, 30), null);
});

test('the reveal radius covers the canvas within 0.2 s and the ink flips when the band row is covered', () => {
  assert.equal(revealRadius(0), 0);
  assert.ok(revealRadius(0.18) >= 1100 && revealRadius(0.18) <= 1300);
  assert.ok(revealRadius(0.2) > 1390, 'the farthest canvas corner from a head near the bottom is about 1400..1470 px away and is covered by 0.2 s');
  assert.equal(revealRadius(0.36), 2400);
  const origin = {x: 560, y: 1282};
  const need = Math.max(Math.hypot(origin.x - 65, origin.y - 262), Math.hypot(1015 - origin.x, origin.y - 262));
  for (const fps of [30, 50, 60]) {
    const k = inkFlipOffset(origin, fps);
    assert.ok(revealRadius(k / fps) >= need, `${fps} fps: the band row is covered at the ink frame`);
    assert.ok(revealRadius((k - 1) / fps) < need, `${fps} fps: not covered one frame earlier`);
  }
});

test('a flip lands 0.36 s before the next sentence, never earlier than 0.06 s after the last onset', () => {
  assert.equal(flipFrameFor(300, 280, 50), 283);   // the clamp binds: 280 + 3 > 300 - 18
  assert.equal(flipFrameFor(300, 200, 50), 282);   // 300 - 18
  assert.equal(flipFrameFor(90, 85, 30), 87);      // round(max(79.2, 86.8))
});

test('resolveCartoonTimeline derives sentences, flips, cards and the counter from the words', () => {
  const tl = resolveCartoonTimeline(body(), scene, words(), 30);
  assert.deepEqual(tl.issues, []);
  assert.equal(tl.sentences.length, 4);
  assert.equal(tl.sentences[0].startFrame, 0);
  assert.equal(tl.sentences[1].startFrame, 60);
  assert.equal(tl.acts.length, 2);
  assert.equal(tl.acts[0].flipFrame, 0);
  assert.equal(tl.acts[1].flipFrame, flipFrameFor(120, 105, 30));
  assert.equal(tl.cards[1].endFrame, tl.acts[1].flipFrame + Math.round(0.2 * 30));
  assert.equal(tl.cards[0].startFrame, 0);
  assert.equal(tl.cards[2].startFrame, 120);
  assert.deepEqual(tl.counter, {kind: 'sections', total: 2});
  assert.equal(tl.sceneFrom, 0);
});

test('resolveCartoonTimeline names every structural fault', () => {
  const issues = (over) => resolveCartoonTimeline(body(over), scene, words(), 30).issues.join('|');
  assert.match(issues({sentences: [{from: 0, to: 3}, {from: 5, to: 7}, {from: 8, to: 11}, {from: 12, to: 15}]}), /tile/);
  assert.match(issues({acts: [{theme: 'light', sentence: 0, tag: 'a'}, {theme: 'pink', sentence: 2, tag: 'b'}]}), /ground/);
  assert.match(issues({acts: [{theme: 'light', sentence: 0, tag: 'a'}, {theme: 'dark', sentence: 1, tag: 'b'}, {theme: 'light', sentence: 2, tag: 'c'}]}), new RegExp(`${ACT_MIN_SECONDS} s`));
  assert.match(issues({cards: [{id: 'a', kind: 'term', from: {word: 0}, to: {word: 6}, data: {term: 'X'}}, {id: 'b', kind: 'term', from: {word: 4}, to: {word: 8}, data: {term: 'Y'}}]}), /overlap/);
  assert.match(issues({cards: [{id: 'a', kind: 'term', from: {word: 0}, to: 'flip', data: {term: 'X'}}, {id: 'b', kind: 'term', from: {word: 4}, to: {word: 7}, data: {term: 'Y'}}]}), /last card of an act/);
  assert.match(issues({counter: {kind: 'seconds', total: 30, saidAt: {word: 1}, stop: {word: 10}}}), /digits of 30/);
  assert.match(issues({cards: [{id: 't', kind: 'timer', from: {word: 0}, to: {word: 3}, data: {label: 'x'}}]}), /seconds counter/);
});

test('words at and after the tail are the sign-off: the sentences tile only the words before it', () => {
  const tl = resolveCartoonTimeline(body({sentences: [{from: 0, to: 3}, {from: 4, to: 7}, {from: 8, to: 11}, {from: 12, to: 13}], tail: {at: {word: 14}}}), scene, words(), 30);
  assert.deepEqual(tl.issues, []);
  assert.equal(tl.tailFrame, 210);
  assert.equal(tl.sentences.at(-1).endFrame, 210);
});

test('the headline estimator counts lines from character classes and the column width', () => {
  assert.equal(estimateHeadlineLines(['كلمة', 'تانية']), 1);
  assert.equal(estimateHeadlineLines(Array.from({length: 6}, (_, i) => `كلمةطويلة${i}`)), 3);
  assert.ok(estimateHeadlineLines(Array.from({length: 20}, () => 'كلمةطويلةجدا')) > 3);
  assert.equal(estimateHeadlineLines(['الـAPI', 'بسيط']), 1);
});

import {DEFAULT_CHARACTER, headOutline, characterExtents, characterIssues, characterTokens, normalizeCharacter} from '../engine/src/styles/cartoon/scenes/character.ts';

test('the default character is generic, every preset axis validates and the derived tokens follow the fixed lightness deltas', () => {
  assert.deepEqual(characterIssues(DEFAULT_CHARACTER), []);
  assert.equal(DEFAULT_CHARACTER.beard.kind, 'none');
  assert.equal(DEFAULT_CHARACTER.glasses.kind, 'none');
  assert.equal(DEFAULT_CHARACTER.hair.style, 'short');
  assert.match(characterIssues({...DEFAULT_CHARACTER, hair: {style: 'mohawk', color: '#000000'}}).join('|'), /hair\.style/);
  assert.match(characterIssues({...DEFAULT_CHARACTER, skin: 'tan'}).join('|'), /skin/);
  assert.match(characterIssues({...DEFAULT_CHARACTER, extra: 1}).join('|'), /extra/);
  assert.match(characterIssues({...DEFAULT_CHARACTER, outfit: {kind: 'tee', top: '#4B6B8A'}}).join('|'), /outfit\.base/);
  const tokens = characterTokens(DEFAULT_CHARACTER);
  assert.equal(tokens.skin.base, '#D9A882');
  assert.ok(tokens.skin.shade !== tokens.skin.base && tokens.skin.deep !== tokens.skin.shade);
  assert.match(tokens.lips.base, /^#[0-9A-F]{6}$/);
  assert.equal(characterTokens({...DEFAULT_CHARACTER, beard: {kind: 'full', color: '#2B211D'}}).beard.base, '#2B211D');
  assert.deepEqual(normalizeCharacter({...DEFAULT_CHARACTER, skin: '#d9a882'}).skin, '#D9A882');
  assert.throws(() => normalizeCharacter({...DEFAULT_CHARACTER, skin: 'tan'}), /skin/);
});

test('head extents are the real outline at the worst tilt and lean, so the safe box follows the preset', () => {
  const base = characterExtents(DEFAULT_CHARACTER);
  // The upright outline: ears reach 170 units right and left of the head centre, the hair top 428 above the chin.
  assert.equal(Math.max(...headOutline(DEFAULT_CHARACTER).map((p) => p.x)) - 300, 170);
  assert.equal(590 - Math.min(...headOutline(DEFAULT_CHARACTER).map((p) => p.y)), 428);
  assert.ok(base.headRight > 170 && base.headRight < 270, `tilted and leaning right extent ${base.headRight}`);
  assert.equal(base.headLeft, base.headRight, 'tilt and lean are symmetric');
  assert.ok(base.headTop >= 428, `top ${base.headTop}`);
  assert.ok(base.chinBottom > 0 && base.chinBottom < 20, `chin travel ${base.chinBottom}`);
  const hijab = characterExtents({...DEFAULT_CHARACTER, headwear: {kind: 'hijab', color: '#4B6B8A'}});
  assert.ok(hijab.headRight > base.headRight && hijab.headTop > base.headTop, 'a hijab is wider and taller than short hair');
  const cap = characterExtents({...DEFAULT_CHARACTER, headwear: {kind: 'cap', color: '#4B6B8A'}});
  assert.ok(cap.headRight >= base.headRight, 'the cap visor reaches past the ear');
  const bald = characterExtents({...DEFAULT_CHARACTER, hair: {style: 'none', color: '#2A2320'}});
  assert.ok(bald.headTop < base.headTop);
  // At the body scale the default head keeps its centre between about x 245 and x 662 (spec section 6), give or take the measured outline.
  const right = 852 - base.headRight * 0.86, left = 65 + base.headLeft * 0.86;
  assert.ok(right > 610 && right < 700 && left > 210 && left < 300, `limits ${left}..${right}`);
});

import {RIG, armGateIssues, armKeys, armStateAt, gazeAt, headCanvas, placeAt, solveArm, toCanvas} from '../engine/src/styles/cartoon/scenes/rig.ts';
import {cardAnchors, derivePlaces, deriveGestures, narratorSafeIssues, placeLimits} from '../engine/src/styles/cartoon/scenes/math.ts';

test('places slide over 0.5 s and the head lands where the figure maths says', () => {
  const places = [{startFrame: 0, x: 540, scale: 0.94}, {startFrame: 54, x: 640, scale: 0.88}];
  assert.deepEqual(placeAt(0, places, 30), {x: 540, scale: 0.94});
  assert.deepEqual(placeAt(53, places, 30), {x: 540, scale: 0.94});
  const mid = placeAt(58, places, 30);
  assert.ok(mid.x > 540 && mid.x < 640);
  assert.deepEqual(placeAt(120, places, 30), {x: 640, scale: 0.88});
  assert.deepEqual(toCanvas({x: 540, scale: 1}, {x: 300, y: 590}), {x: 540, y: 1450});
  assert.deepEqual(headCanvas({x: 540, scale: 0.86}), {x: 540, y: 1450 + 0.86 * (395 - 590)});
});

test('the two-bone arm reaches a near target exactly and clamps a far one at full length', () => {
  const near = solveArm(RIG.shoulder.r, {x: 468 + 200, y: 738 - 100}, 1);
  assert.ok(Math.abs(near.wrist.x - 668) < 1e-6 && Math.abs(near.wrist.y - 638) < 1e-6);
  const far = solveArm(RIG.shoulder.r, {x: 468 + 900, y: 738 - 900}, 1);
  assert.ok(Math.abs(Math.hypot(far.wrist.x - 468, far.wrist.y - 738) - (RIG.L1 + RIG.L2 - 0.5)) < 1e-6);
});

test('a raised point swings out to the fixed diagonal, the finger turns toward the anchor, and transitions morph in angle space', () => {
  const place = {x: 540, scale: 0.86};
  const keys = armKeys([{frame: 0, arm: 'r', kind: 'point', anchor: {x: 765, y: 870}}, {frame: 60, arm: 'r', kind: 'rest'}], 30);
  const held = armStateAt(45, keys, 30, place);
  assert.equal(held.r.kind, 'point');
  const wrist = toCanvas(place, held.r.wrist);
  assert.ok(Math.abs(wrist.x - (540 + 0.86 * (168 + 0.96 * 338 * Math.sin(0.5)))) < 2, `wrist on the diagonal: ${wrist.x}`);
  assert.ok(held.r.rot > -45 && held.r.rot < 25, `finger angle ${held.r.rot}`);
  const moving = armStateAt(5, keys, 30, place);
  assert.ok(Math.hypot(moving.r.wrist.x - held.r.wrist.x, moving.r.wrist.y - held.r.wrist.y) > 5, 'still morphing at 0.17 s');
  assert.equal(armStateAt(90, keys, 30, place).r.kind, 'rest');
  const gaze = gazeAt(45, [], held, place);
  assert.ok(gaze.gx > 0.2 && gaze.gy < 0, 'the eyes follow the pointing hand up and to the right');
  assert.deepEqual(gazeAt(45, [{frame: 40, arm: 'r', kind: 'point', look: 'camera'}], held, place), {gx: 0, gy: 0}, 'an explicit look wins');
});

test('a resting arm hangs beside the body: elbow and wrist outside the shoulders, the hand low by the hip', () => {
  const place = {x: 540, scale: 0.86};
  const check = (arms, label) => {
    assert.ok(arms.l.elbow.x < RIG.shoulder.l.x && arms.l.wrist.x < RIG.shoulder.l.x, `${label}: left arm hangs outside (${arms.l.elbow.x}, ${arms.l.wrist.x})`);
    assert.ok(arms.r.elbow.x > RIG.shoulder.r.x && arms.r.wrist.x > RIG.shoulder.r.x, `${label}: right arm hangs outside (${arms.r.elbow.x}, ${arms.r.wrist.x})`);
    assert.ok(arms.l.wrist.y > 1000 && arms.r.wrist.y > 1000, `${label}: hands low`);
    assert.ok(toCanvas(place, arms.l.wrist).y < 1920 && toCanvas(place, arms.r.wrist).y < 1920, `${label}: wrists on canvas`);
  };
  check(armStateAt(0, armKeys([], 30), 30, place), 'start');
  const keys = armKeys([{frame: 0, arm: 'r', kind: 'point', anchor: {x: 765, y: 870}}, {frame: 0, arm: 'l', kind: 'open', anchor: {x: 300, y: 980}},
    {frame: 60, arm: 'r', kind: 'rest'}, {frame: 60, arm: 'l', kind: 'rest'}], 30);
  check(armStateAt(110, keys, 30, place), 'after gestures');
});

test('the arm gate refuses pops and hands over the face', () => {
  const place = {x: 540, scale: 0.86};
  const keys = armKeys([{frame: 0, arm: 'r', kind: 'point', anchor: {x: 765, y: 870}}, {frame: 30, arm: 'l', kind: 'open', anchor: {x: 300, y: 980}}, {frame: 75, arm: 'r', kind: 'rest'}], 30);
  const sample = Array.from({length: 120}, (_, f) => ({frame: f, arms: armStateAt(f, keys, 30, place), place}));
  assert.deepEqual(armGateIssues(sample, 30), []);
  const popped = sample.map((s, i) => (i === 40 ? {...s, arms: {...s.arms, r: {...s.arms.r, wrist: {x: s.arms.r.wrist.x + 300, y: s.arms.r.wrist.y}}}} : s));
  assert.match(armGateIssues(popped, 30).join('|'), /pop/);
  const inFace = sample.map((s, i) => (i === 50 ? {...s, arms: {...s.arms, l: {...s.arms.l, kind: 'open', wrist: {x: 300, y: 420}}}} : s));
  assert.match(armGateIssues(inFace, 30).join('|'), /face/);
});

test('card anchors come from the layout, places stand opposite the first pointed anchor inside the narrator safe box', () => {
  const tl = resolveCartoonTimeline(body(), scene, words(), 30);
  const anchors = cardAnchors(tl.cards[0]);
  assert.ok(anchors.centre.x > 65 && anchors.centre.x < 1015 && anchors.centre.y >= 680 && anchors.centre.y <= 1110);
  const extents = {headRight: 221, headLeft: 206, headTop: 428, chinBottom: 0};
  assert.deepEqual(placeLimits(0.86, extents), {min: Math.ceil(65 + 206 * 0.86), max: Math.floor(852 - 221 * 0.86)});
  const places = derivePlaces(tl, extents, 30);
  assert.equal(places[0].x, 540);
  for (const p of places) assert.ok(p.x >= placeLimits(p.scale, extents).min && p.x <= placeLimits(p.scale, extents).max, `place ${p.x} inside the box`);
  assert.deepEqual(narratorSafeIssues(places, extents), []);
  assert.match(narratorSafeIssues([{startFrame: 0, x: 760, scale: 0.86}], extents).join('|'), /rail/);
  assert.match(narratorSafeIssues([{startFrame: 0, x: 120, scale: 0.86}], extents).join('|'), /left/);
  const gestures = deriveGestures(tl, places, 30);
  assert.ok(gestures.length >= tl.cards.length, 'at least one gesture per card');
  assert.ok(gestures.every((g) => g.frame >= 0));
  for (const card of tl.cards) for (const [name, pt] of Object.entries(cardAnchors(card))) assert.ok(pt.x >= 65 && pt.x <= 1015 && pt.y >= 250 && pt.y <= 1470, `${card.kind}.${name} on canvas inside the safe area`);
});

test('every card kind publishes its anchors inside the safe area and out of the action rail', () => {
  const datas = {
    term: {glyphs: ['circle', 'triangle', 'square']}, windows: {}, fan: {items: [1, 2, 3, 4]}, code: {lines: [1, 2, 3, 4]}, link: {}, grid: {items: [1, 2, 3, 4, 5, 6], picked: 4}, crossed: {},
    stack: {}, nodes: {nodes: [1, 2, 3]}, morph: {items: [1, 2, 3]}, monitor: {}, timer: {},
  };
  for (const [kind, data] of Object.entries(datas)) {
    const anchors = cardAnchors({id: 'c', kind, startFrame: 0, endFrame: 30, endsAtFlip: false, act: 0, data});
    assert.ok(anchors.centre, `${kind} has a centre`);
    for (const [name, pt] of Object.entries(anchors)) {
      assert.ok(pt.x >= 65 && pt.x <= 1015 && pt.y >= 250 && pt.y <= 1470, `${kind}.${name} (${pt.x}, ${pt.y}) inside the safe area`);
      assert.ok(!(pt.x >= 853 && pt.y >= 1150), `${kind}.${name} stays out of the action rail`);
    }
  }
});

import {MOUTH_LEAD_FRAMES, blinkAt, nodAt, seedOf} from '../engine/src/styles/cartoon/scenes/math.ts';

test('blinks are deterministic per scene id with 2.3..3.7 s gaps, nods follow word onsets', () => {
  assert.equal(MOUTH_LEAD_FRAMES, 0);
  const a = Array.from({length: 600}, (_, f) => blinkAt(f, 30, seedOf('body'))), b = Array.from({length: 600}, (_, f) => blinkAt(f, 30, seedOf('body')));
  assert.deepEqual(a, b);
  const starts = a.map((v, i) => (v > 0 && (a[i - 1] ?? 0) === 0 ? i : -1)).filter((i) => i >= 0);
  assert.ok(starts.length >= 4 && starts.length <= 9, `${starts.length} blinks in 20 s`);
  for (let i = 1; i < starts.length; i += 1) assert.ok(starts[i] - starts[i - 1] >= 2.3 * 30 - 1 && starts[i] - starts[i - 1] <= 3.7 * 30 + 1);
  assert.notDeepEqual(a, Array.from({length: 600}, (_, f) => blinkAt(f, 30, seedOf('end'))));
  const at50 = Array.from({length: 1000}, (_, f) => blinkAt(f, 50, seedOf('body')));
  const starts50 = at50.map((v, i) => (v > 0 && (at50[i - 1] ?? 0) === 0 ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(starts50.map((f) => Math.round(f / 50 * 10)), starts.map((f) => Math.round(f / 30 * 10)), 'the same blinks in seconds at 50 fps');
  assert.equal(nodAt(0, [0, 30], 30), 0);
  assert.ok(nodAt(3, [0, 30], 30) > 0.9, 'peak near the middle of the 0.22 s window');
  assert.equal(nodAt(20, [0, 30], 30), 0);
});

import {CARD_LAYOUT as TERM_LAYOUT, termFontSize, tokenWidth as estimatedWidth} from '../engine/src/styles/cartoon/scenes/math.ts';

test('a term shrinks to fit its card: short terms keep 96 / 80 px, long Latin and Arabic terms fit the inner width', () => {
  const inner = TERM_LAYOUT.term.w - 48;
  assert.equal(termFontSize('API', true), 96);
  assert.equal(termFontSize('فكرة', false), 80);
  for (const [term, latin] of [['Claude Code', true], ['MCP Builder', true], ['Code Review', true], ['ABCDEFGHIJKLMNOP', true], ['الطبقة الواحدة', false], ['مساعد ذكي متكامل', false]]) {
    const size = termFontSize(term, latin);
    assert.ok(estimatedWidth(term) * size / (latin ? 96 : 84) <= inner + 0.5, `${term} at ${size} px fits ${inner} px`);
    assert.ok(size >= 32, `${term} stays readable (${size} px)`);
  }
});
