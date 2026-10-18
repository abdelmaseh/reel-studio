import test from 'node:test';
import assert from 'node:assert/strict';
import {bundleEngine, setSsrFps, setSsrFrame} from './helpers/engine-bundle.mjs';
import {resolveCartoonTimeline, revealRadius} from '../engine/src/styles/cartoon/scenes/math.ts';
import {body, bodyScene, wordText, words} from './helpers/cartoon-fixtures.mjs';

const mod = await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {CartoonSceneView} from './engine/src/styles/cartoon/scenes/scene';
  import {SafeRoot} from './engine/src/core/safe';
  import {DigitsProvider} from './engine/src/creative-kit/digits';
  export const render = (scene, words, mouth) => renderToStaticMarkup(React.createElement(CartoonSceneView, {scene, words, mouth}));
  export const renderProbe = (scene, words) => renderToStaticMarkup(React.createElement(SafeRoot, {probe: '#00FF00'}, React.createElement(CartoonSceneView, {scene, words})));
  export const renderDigits = (scene, words, digits) => renderToStaticMarkup(React.createElement(DigitsProvider, {digits}, React.createElement(CartoonSceneView, {scene, words})));
`, {ssr: true, media: true});
const at = (frame, scene = bodyScene(), w = words(), mouth) => { setSsrFps(30); setSsrFrame(frame); return mod.render(scene, w, mouth); };
const tl = resolveCartoonTimeline(body(), {fromFrame: 0, durationInFrames: 260}, words(), 30);

test('act 1 draws the paper ground with its grid and bottom halftone, and no reveal', () => {
  const html = at(10);
  assert.match(html, /#EEEBE4/);
  assert.match(html, /repeating-linear-gradient/);
  assert.match(html, /radial-gradient\(circle, rgba\(20,20,20,0\.16\)/);
  assert.doesNotMatch(html, /clip-path:circle/);
});

test('the flip draws the previous ground under the new one clipped by a circle that grows from the head', () => {
  const flip = tl.acts[1].flipFrame;
  const html = at(flip + 4);
  assert.match(html, /#0D0D0E/);
  const r = /clip-path:circle\(([\d.]+)px at ([\d.]+)px ([\d.]+)px\)/.exec(html);
  assert.ok(r, 'a circle clip is drawn during the reveal');
  assert.ok(Math.abs(Number(r[1]) - revealRadius(4 / 30)) < 1, `radius ${r[1]}`);
  assert.ok(Number(r[3]) > 1200 && Number(r[3]) < 1320, 'the origin is the head centre');
  assert.doesNotMatch(at(flip + 20), /clip-path:circle/, 'the reveal is over after 0.36 s');
});

test('the reveal lasts 0.36 s at 50 and 60 fps too', () => {
  for (const fps of [50, 60]) {
    const w = words(16, fps), timeline = resolveCartoonTimeline(body(), {fromFrame: 0, durationInFrames: Math.round(260 / 30 * fps)}, w, fps);
    const scene = {...bodyScene(), durationInFrames: Math.round(260 / 30 * fps)};
    const flip = timeline.acts[1].flipFrame;
    setSsrFps(fps); setSsrFrame(flip + Math.round(0.1 * fps));
    const html = mod.render(scene, w);
    const r = /clip-path:circle\(([\d.]+)px/.exec(html);
    assert.ok(r && Math.abs(Number(r[1]) - revealRadius(Math.round(0.1 * fps) / fps)) < 1, `${fps} fps radius`);
    setSsrFrame(flip + Math.ceil(0.37 * fps));
    assert.doesNotMatch(mod.render(scene, w), /clip-path:circle/, `${fps} fps: over after 0.36 s`);
  }
  setSsrFps(30);
});

test('the safe-zone probe paints the ground in the probe colour and draws no textures, shadows or narrator', () => {
  setSsrFps(30); setSsrFrame(40);
  const html = mod.renderProbe(bodyScene(), words());
  assert.doesNotMatch(html, /repeating-linear-gradient|radial-gradient|box-shadow|id="body-face"/);
  assert.match(html, /#00FF00/);
});

test('the headline builds word by word on the onsets, Latin runs are serif italic in the accent ink, and sentences hard-swap', () => {
  assert.ok(at(0).includes(wordText(0)));
  assert.ok(!at(0).includes(wordText(1)), 'the second word has not started');
  const html = at(50);                                     // sentence 1 (words 0..3, onsets 0, 15, 30, 45) fully built
  for (const w of [wordText(0), wordText(1), 'API', wordText(3)]) assert.ok(html.includes(w), w);
  assert.match(html, /font-style:italic/);
  assert.match(html, /Source Serif 4/);
  assert.match(html, /#BF3D27/, 'the Latin run uses the light accent ink');
  assert.doesNotMatch(html, /letter-spacing:[^;"]*;[^>]*>[^<]*[؀-ۿ]/, 'no letter-spacing on Arabic');
  assert.ok(at(61).includes(wordText(4)));
  assert.ok(!at(61).includes(wordText(0)), 'the previous sentence is gone on the next onset');
  assert.match(at(80), new RegExp(`color:#BF3D27[^>]*>${wordText(5)}<`), 'a listed Arabic accent takes the accent ink');
  assert.match(at(80), new RegExp(`color:#141414[^>]*>${wordText(4)}<`), 'an unlisted Arabic word stays in ink');
});

test('the headline fades across a flip and the dark act draws its Latin runs in lime', () => {
  const flip = tl.acts[1].flipFrame;
  const fading = /data-cartoon-headline[^>]*opacity:([\d.]+)/.exec(at(flip + 2));
  assert.ok(fading && Number(fading[1]) < 1 && Number(fading[1]) > 0, 'the outgoing sentence fades over 0.12 s');
  assert.match(at(185), /color:#D5F53B[^>]*>API/, 'lime Latin runs on the night ground');
});

test('the top band types the tag over 0.35 s, the counter shows the act and pops on the flip, and the brackets fade after sentence 1', () => {
  assert.match(at(0), /\/\/ 01 — hook/);
  assert.match(at(0), /PART 01\/02/);
  const flip = tl.acts[1].flipFrame;
  assert.doesNotMatch(at(flip + 3), /\/\/ 02 — the idea/, 'still typing');
  assert.match(at(flip + 15), /\/\/ 02 — the idea/);
  assert.match(at(flip + 15), /PART 02\/02/);
  assert.match(at(10), /data-cartoon-brackets/, 'viewfinder corners during the hook');
  assert.doesNotMatch(at(80), /data-cartoon-brackets/, 'gone after sentence 1 plus the fade');
  assert.doesNotMatch(at(10, bodyScene({brackets: false})), /data-cartoon-brackets/);
});

test('a seconds counter counts real seconds, stops with a check on its word, and an absent counter draws nothing', () => {
  const w = words().map((x) => (x.sourceIndex === 2 ? {...x, text: '30'} : x));
  const scene = bodyScene({counter: {kind: 'seconds', total: 30, saidAt: {word: 2}, stop: {word: 10}}});
  assert.match(at(45, scene, w), /SEC 01\/30/);
  assert.match(at(160, scene, w), /SEC 05\.0\/30/, 'frozen at the stop word (frame 150 = 5.0 s)');
  assert.match(at(160, scene, w), /lucide/, 'the check is the lucide icon');
  assert.doesNotMatch(at(20, bodyScene({counter: null})), /PART/);
});

test('the digits choice reaches the counter and a digit run in the headline', () => {
  setSsrFps(30); setSsrFrame(0);
  assert.match(mod.renderDigits(bodyScene(), words(), 'arabic-indic'), /PART ٠١\/٠٢/);
  const w = words().map((x) => (x.sourceIndex === 1 ? {...x, text: '30'} : x));
  setSsrFrame(20);
  const html = mod.renderDigits(bodyScene(), w, 'arabic-indic');
  assert.match(html, /٣٠/);
  assert.match(html, /Plex Display[^>]*>٣٠|>٣٠</, 'an Arabic-Indic run is drawn in the Arabic family');
});

test('cards land in the band with the shell envelope and draw the creator copy', () => {
  const html = at(15);
  assert.match(html, /\/\/ idea/);
  assert.match(html, /border-radius:28px/);
  assert.match(html, /box-shadow:0 22px 50px/);
  assert.match(html, /data-card="term1"/);
  assert.match(at(1), /data-card="term1"[^>]*scale\(0\.(8[6-9]|9)/, 'the card is still rising');
  const code = at(95);
  assert.match(code, /app\.js/);
  assert.match(code, /connect<\/span><span[^>]*>\(a, b\)/, 'the typed line with its accent prefix');
  assert.match(code, /#141518/, 'the code card is dark on every ground');
  assert.doesNotMatch(at(70), /connect\(/, 'the line types from its own word');
  const fan = at(130);
  assert.match(fan, /بريد/);
  assert.match(fan, /ملفات/);
  assert.match(fan, /lucide-mail/, 'items carry lucide icons');
  const windows = bodyScene({cards: [{id: 'w', kind: 'windows', from: {word: 0}, to: {word: 7}, data: {left: {name: 'برنامج'}, right: {name: 'تطبيق', tag: 'app'}, linkLabel: 'رابط', leftAt: {word: 2}, linkAt: {word: 4}}}]});
  assert.match(at(10, windows), /تطبيق/);
  assert.match(at(70, windows), /رابط/);
  assert.match(at(70, windows), /stroke-dasharray="14 12"/, 'the dashed link');
});

test('a card window ends: the card exits over 0.25 s and is gone', () => {
  const flip = tl.acts[1].flipFrame;
  assert.match(at(flip + 8), /app\.js/, 'the code card outlives the flip by 0.2 s');
  assert.doesNotMatch(at(flip + 20), /app\.js/);
});

test('under the safe-zone probe the cards stay drawn without their shadows', () => {
  setSsrFps(30); setSsrFrame(30);
  const html = mod.renderProbe(bodyScene(), words());
  assert.match(html, /data-card="term1"/);
  assert.match(html, /\/\/ idea/);
  assert.doesNotMatch(html, /box-shadow/);
});

const cardScene = (card) => bodyScene({cards: [{...card, id: 'c', from: {word: 0}, to: {word: 7}}]});
const atCard = (frame, card) => at(frame, cardScene(card));

test('link, grid, crossed and stack cards draw their parts on their beats', () => {
  const link = {kind: 'link', data: {left: {icon: 'cpu', label: 'المساعد'}, right: {tag: '// tool', label: 'Notes', shape: 'pill'}, stamp: 'خطوة واحدة', stampAt: {word: 2}, leftAt: {word: 3}, cableAt: {word: 4}}};
  assert.doesNotMatch(atCard(20, link), /خطوة واحدة/, 'the stamp waits for its word');
  assert.match(atCard(50, link), /data-cartoon-stamp[^>]*>خطوة واحدة/);
  assert.match(atCard(80, link), /stroke-dashoffset="0\.0"/, 'the cable is fully drawn after its beat');
  const grid = {kind: 'grid', data: {items: [{icon: 'calendar', name: 'تقويم'}, {icon: 'mail', name: 'بريد'}, {icon: 'folder', name: 'ملفات'}], picked: 0, command: 'notes.save()', pickAt: {word: 2}, runAt: {word: 4}}};
  assert.match(atCard(40, grid), /تقويم/);
  assert.match(atCard(40, grid), /background:#E8472B[^>]*>.*?تقويم/, 'the picked cell is lit');
  assert.match(atCard(80, grid), /notes\.save\(\)/);
  const crossed = {kind: 'crossed', data: {title: 'big_app.exe', tiles: 8, lit: 0, crossAt: {word: 3}}};
  assert.doesNotMatch(atCard(30, crossed), /#E5484D/);
  assert.match(atCard(60, crossed), /#E5484D/, 'the red disc');
  const stack = {kind: 'stack', data: {layers: [{text: 'Data', shapes: ['circle', 'triangle', 'square'], tone: 'light'}, {text: 'Sync', tone: 'ink'}], stamp: 'طبقة جديدة', arrowLabel: 'فوق', dropAt: {word: 2}, stampAt: {word: 3}, arrowAt: {word: 5}}};
  assert.match(atCard(60, stack), /طبقة جديدة/);
  assert.match(atCard(90, stack), /فوق/);
  assert.match(atCard(90, stack), /perspective\(900px\)/);
});

test('nodes, morph, timer and monitor cards render their parts', () => {
  const nodes = {kind: 'nodes', data: {nodes: [{text: 'App', label: 'التطبيق'}, {text: 'Hub', label: 'الوسيط'}, {icon: 'smartphone', label: 'الموبايل'}], rings: true, ringsAt: {word: 5}}};
  assert.doesNotMatch(atCard(60, nodes), /data-cartoon-rings/, 'rings wait for their word');
  assert.match(atCard(90, nodes), /data-cartoon-rings/, 'rings widen');
  assert.match(atCard(90, nodes), /الوسيط/);
  const morph = {kind: 'morph', data: {items: [{shape: 'circle'}, {shape: 'triangle'}, {shape: 'square'}], beforeLabel: 'تلت أدوات', afterLabel: 'أداة واحدة', equalsBefore: '= 3', equalsAfter: '= 1', morphAt: {word: 4}, oneAt: {word: 6}}};
  assert.match(atCard(40, morph), /تلت أدوات/);
  assert.match(atCard(100, morph), /أداة واحدة/);
  assert.match(atCard(100, morph), /= 1/);
  assert.doesNotMatch(atCard(100, morph), /تلت أدوات/, 'the label swaps at the morph');
  const timerScene = bodyScene({counter: {kind: 'seconds', total: 30, saidAt: {word: 2}, stop: {word: 14}}, cards: [{id: 't', kind: 'timer', from: {word: 0}, to: {word: 3}, data: {label: '// timer'}}]});
  const timerWords = words().map((w) => (w.sourceIndex === 2 ? {...w, text: '30'} : w));
  assert.match(at(20, timerScene, timerWords), /00:2[89]\.\d\d/);
  const screen = {kind: 'monitor', data: {clip: {src: 'cartoon/screen.png', sha256: 'b'.repeat(64), width: 1920, height: 1080, kind: 'image'}, crop: {x: 0, y: 0, w: 1920}, label: 'my screen'}};
  const html = atCard(30, screen);
  assert.match(html, /my screen/);
  assert.match(html, /#FF5F57/, 'traffic lights');
  assert.match(html, /cartoon\/screen\.png/, 'the capture is mounted');
  assert.match(html, /width:880px;height:360px/, 'through the fixed 22:9 window');
});

test('the monitor screen takes the probe colour under the safe-zone check, its frame and label stay', () => {
  const screen = {kind: 'monitor', data: {clip: {src: 'cartoon/screen.png', sha256: 'b'.repeat(64), width: 1920, height: 1080, kind: 'image'}, crop: {x: 0, y: 0, w: 1920}, label: 'my screen'}};
  setSsrFps(30); setSsrFrame(30);
  const html = mod.renderProbe(cardScene(screen), words());
  assert.match(html, /my screen/);
  assert.doesNotMatch(html, /cartoon\/screen\.png/);
});

test('a video capture mounts muted and time-locked from its trim', () => {
  const screen = {kind: 'monitor', data: {clip: {src: 'cartoon/screen.mp4', sha256: 'b'.repeat(64), width: 1920, height: 1080, kind: 'video'}, crop: {x: 0, y: 0, w: 1920}, label: 'my screen', trimBeforeFrame: 10}};
  assert.match(atCard(30, screen), /<video src="\/cartoon\/screen\.mp4"[^>]*data-trim-before="10"/);
});

import {DEFAULT_CHARACTER, headOutline} from '../engine/src/styles/cartoon/scenes/character.ts';

const figure = await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {Figure, CharacterHead} from './engine/src/styles/cartoon/scenes/kit/narrator/figure';
  import {armKeys, armStateAt} from './engine/src/styles/cartoon/scenes/rig.ts';
  const place = {x: 540, scale: 0.86};
  const arms = armStateAt(30, armKeys([{frame: 0, arm: 'r', kind: 'point', anchor: {x: 765, y: 870}}], 30, place), 30, place);
  export const render = (character, pose = {}) => renderToStaticMarkup(React.createElement(Figure, {character, place, arms, accent: '#E8472B', dark: false, idPrefix: 'body',
    pose: {open: 0.5, blink: 0, gaze: {gx: 0, gy: 0}, brow: 0, tilt: 0, bob: 0, lean: 0, breathe: 1, turn: 0, ...pose}}));
  export const head = (character) => renderToStaticMarkup(React.createElement(CharacterHead, {character, size: 138, idPrefix: 'avatar'}));
`, {ssr: true, media: true});

const PRESETS = [['hair', {style: 'quiff', color: '#2A2320'}], ['hair', {style: 'long', color: '#5A3A28'}], ['hair', {style: 'none', color: '#2A2320'}],
  ['headwear', {kind: 'hijab', color: '#4B6B8A'}], ['headwear', {kind: 'cap', color: '#4B6B8A'}], ['beard', {kind: 'full', color: '#2B211D'}],
  ['glasses', {kind: 'rect', frame: '#17120F'}], ['outfit', {kind: 'overshirt', top: '#8A8173', base: '#F8F6F1'}]];

test('the figure renders every preset axis with prefixed ids and its parts', () => {
  const base = figure.render(DEFAULT_CHARACTER);
  assert.match(base, /id="body-face"/);
  assert.match(base, /id="body-dots"/, 'the halftone shadow pattern');
  assert.match(base, /fill="#D9A882"/, 'skin base');
  assert.doesNotMatch(base, /id="(?!body-)/, 'every id is prefixed');
  for (const [part, value] of PRESETS) {
    const html = figure.render({...DEFAULT_CHARACTER, [part]: value});
    assert.ok(html.length > 2000, `${part} ${JSON.stringify(value)} renders`);
    assert.doesNotMatch(html, /NaN|undefined|Infinity/, `${part} ${JSON.stringify(value)}`);
  }
  assert.match(figure.render({...DEFAULT_CHARACTER, beard: {kind: 'full', color: '#2B211D'}}), /fill="#2B211D"/);
  assert.match(figure.render({...DEFAULT_CHARACTER, headwear: {kind: 'hijab', color: '#4B6B8A'}}), /fill="#4B6B8A"/);
  const open = figure.render(DEFAULT_CHARACTER, {open: 1}), closed = figure.render(DEFAULT_CHARACTER, {open: 0});
  assert.notEqual(open, closed, 'the mouth opens');
  assert.match(closed, /stroke-width="5.5"/, 'the closed smile line');
  assert.match(figure.render(DEFAULT_CHARACTER, {blink: 1}), /scale\(1, ?0\.08\)/, 'the blink floor');
});

test('the avatar head is the character head only, inside a circle, with its own id prefix', () => {
  const html = figure.head(DEFAULT_CHARACTER);
  assert.match(html, /id="avatar-face"/);
  assert.doesNotMatch(html, /avatar-torso/);
  assert.match(html, /clip-path|clipPath/);
});

test('the drawn head never leaves the outline the safe maths measured', () => {
  // headOutline samples the same paths the figure draws, so every preset's drawn head paths sit inside its measured extents.
  for (const [part, value] of [['hair', DEFAULT_CHARACTER.hair], ...PRESETS]) {
    const c = {...DEFAULT_CHARACTER, [part]: value};
    const xs = headOutline(c).map((p) => p.x), ys = headOutline(c).map((p) => p.y);
    assert.ok(Math.min(...xs) >= 120 && Math.max(...xs) <= 480 && Math.min(...ys) >= 100, `${part} ${JSON.stringify(value)} outline inside the head frame`);
  }
});

import {armGateIssues} from '../engine/src/styles/cartoon/scenes/rig.ts';
import {characterExtents} from '../engine/src/styles/cartoon/scenes/character.ts';
import {narratorSafeIssues, derivePlaces} from '../engine/src/styles/cartoon/scenes/math.ts';

const motion = await bundleEngine(`
  import {narratorAt} from './engine/src/styles/cartoon/scenes/scene';
  export {narratorAt};
`, {ssr: true, media: true});

test('the narrator stands inside the safe box, never pops, keeps its hands off its face and opens its mouth from the table', () => {
  for (const fps of [30, 50, 60]) {
    const frames = Math.round(260 / 30 * fps), scene = {...bodyScene(), durationInFrames: frames}, w = words(16, fps);
    const mouth = {version: 1, fps, values: Array.from({length: frames}, (_, f) => (f >= Math.round(40 / 30 * fps) && f < Math.round(60 / 30 * fps) ? 0.8 : 0)), calibration: {}};
    const samples = [];
    for (let f = 0; f < frames; f += 1) {
      const n = motion.narratorAt(scene, w, mouth, f, fps);
      samples.push({frame: f, arms: n.arms, place: n.place});
      if (f === Math.round(50 / 30 * fps)) assert.ok(n.pose.open > 0.7, 'mouth open from the table');
      if (f === Math.round(10 / 30 * fps)) assert.equal(n.pose.open, 0);
      assert.ok(Math.abs(n.pose.tilt) <= 9.5 + 1e-9 && Math.abs(n.pose.lean) <= 3.85 + 1e-9, `${fps} fps frame ${f}: tilt and lean inside the measured extents`);
    }
    assert.deepEqual(armGateIssues(samples, fps), [], `${fps} fps arm gate`);
    const timeline = resolveCartoonTimeline(body(), {fromFrame: 0, durationInFrames: frames}, w, fps);
    const extents = characterExtents(motion.narratorAt(scene, w, mouth, 0, fps).character);
    assert.deepEqual(narratorSafeIssues(derivePlaces(timeline, extents, fps), extents), []);
  }
  const html = at(50);
  assert.match(html, /id="body-face"/);
  assert.match(html, /url\(#body-glow\)/);
});

test('after a code card the chin fist comes down: both arms rest once the card has left', () => {
  const n = motion.narratorAt(bodyScene(), words(), undefined, 150, 30);
  assert.equal(n.arms.l.kind, 'open', 'the fan card opens the hands');
  const later = motion.narratorAt(bodyScene({cards: body().cards.slice(0, 2)}), words(), undefined, 200, 30);
  assert.equal(later.arms.l.kind, 'rest');
  assert.equal(later.arms.r.kind, 'rest');
});

const ending = await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {CartoonEndingView} from './engine/src/styles/cartoon/scenes/ending';
  import {SafeRoot} from './engine/src/core/safe';
  export const render = (scene, words, mouth) => renderToStaticMarkup(React.createElement(CartoonEndingView, {scene, words, mouth}));
  export const renderProbe = (scene, words) => renderToStaticMarkup(React.createElement(SafeRoot, {probe: '#00FF00'}, React.createElement(CartoonEndingView, {scene, words})));
`, {ssr: true, media: true});
const endScene = (over = {}) => ({id: 'end', family: 'cartoon-ending', fromFrame: 260, durationInFrames: 180, layout: 'takeover', motion: 'quiet', data: {
  character: DEFAULT_CHARACTER, fromTheme: 'dark', theme: 'light', tag: '// 03 — follow', entrance: {x: 540, scale: 0.86},
  sentences: [{from: 16, to: 19}, {from: 20, to: 23}], accents: [],
  comment: {keyword: 'PLAN', promise: 'the question list', at: {word: 16}},
  follow: {handle: '@example.creator', message: 'تابعني لمحتوى أكثر', at: {word: 20}, tapAt: {word: 22, dt: 0.04}, shareAt: {word: 23}},
  tail: {at: {word: 24}}, ...over}});
// Words 16..23 start at locals 9, 24, ..., 114; the tap is local 100; the tail (word 24) is local 129.
const endWords = words(26).map((w) => ({...w, fromFrame: w.fromFrame + 29, toFrame: w.toFrame + 29}));
const atEnd = (local, scene = endScene()) => { setSsrFps(30); setSsrFrame(local); return ending.render(scene, endWords); };

test('the ending opens with the reveal from the body theme, shows the keyword, then the follow card that is tapped', () => {
  assert.match(atEnd(3), /clip-path:circle/);
  assert.match(atEnd(3), /#0D0D0E/, 'the body theme is under the reveal');
  assert.match(atEnd(40), /PLAN/);
  assert.match(atEnd(40), /the question list/);
  const follow = atEnd(95);
  assert.match(follow, /@example\.creator/);
  assert.match(follow, />Follow</);
  assert.match(follow, /FOLLOW 0\/1/);
  assert.match(follow, /id="end-avatar-face"/, 'the avatar is the character head');
  assert.doesNotMatch(follow, /PLAN/, 'the comment card left when the follow card came');
  const tapped = atEnd(110);
  assert.match(tapped, /Following/);
  assert.match(tapped, /FOLLOW 1\/1/);
  assert.match(atEnd(5), /\/\/ 0/, 'the new act tag starts typing');
  assert.doesNotMatch(atEnd(5), /\/\/ 03 — follow/, 'and is not complete yet');
});

test('the quiet tail: no band, no headline, no card, the narrator centred at scale 1 and waving', () => {
  const html = atEnd(170);
  assert.doesNotMatch(html, /FOLLOW|\/\/ 03/);
  assert.doesNotMatch(html, /@example\.creator/);
  for (const i of [20, 21, 22, 23]) assert.ok(!html.includes(wordText(i)), `word ${i} is gone`);
  assert.match(html, /scale\(1\.0000\)/);
  assert.match(html, /id="end-face"/);
});

test('a comment-only ending shows no counter, and the probe keeps the cards without shadows', () => {
  const commentOnly = endScene({follow: undefined, sentences: [{from: 16, to: 19}, {from: 20, to: 23}]});
  assert.doesNotMatch(atEnd(40, commentOnly), /FOLLOW|PART/);
  setSsrFps(30); setSsrFrame(95);
  const probe = ending.renderProbe(endScene(), endWords);
  assert.match(probe, /@example\.creator/);
  assert.doesNotMatch(probe, /box-shadow|id="end-face"/);
});

const endingMotion = await bundleEngine(`
  import {endingNarratorAt} from './engine/src/styles/cartoon/scenes/ending';
  export {endingNarratorAt};
`, {ssr: true, media: true});

test('the ending narrator passes the arm gate and ends centred, waving, inside the safe box', () => {
  for (const fps of [30, 50, 60]) {
    const k = fps / 30, scene = {...endScene(), fromFrame: Math.round(260 * k), durationInFrames: Math.round(180 * k)};
    const w = words(26, fps).map((x) => ({...x, fromFrame: x.fromFrame + Math.round(29 * k), toFrame: x.toFrame + Math.round(29 * k)}));
    const samples = [];
    for (let f = 0; f < scene.durationInFrames; f += 1) { const n = endingMotion.endingNarratorAt(scene, w, undefined, f, fps); samples.push({frame: f, arms: n.arms, place: n.place}); }
    assert.deepEqual(armGateIssues(samples, fps), [], `${fps} fps ending arm gate`);
    const last = endingMotion.endingNarratorAt(scene, w, undefined, scene.durationInFrames - 1, fps);
    assert.equal(last.arms.r.kind, 'wave');
    assert.deepEqual(last.place, {x: 540, scale: 1});
    const extents = characterExtents(last.character);
    assert.deepEqual(narratorSafeIssues(last.places, extents), []);
  }
});

import {termFontSize as fittedTerm} from '../engine/src/styles/cartoon/scenes/math.ts';

test('a long Latin term is set at the fitted size, so the term card never clips it', () => {
  const cards = body().cards.map((card, i) => (i === 0 ? {...card, data: {...card.data, term: 'Claude Code'}} : card));
  const html = at(10, bodyScene({cards}));
  assert.ok(html.includes('Claude Code'), 'the term is drawn');
  assert.match(html, new RegExp(`font-size:${fittedTerm('Claude Code', true)}px[^>]*>Claude Code<`), 'drawn at the fitted size');
  assert.ok(fittedTerm('Claude Code', true) < 96);
});
