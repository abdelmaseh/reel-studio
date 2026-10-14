import test from 'node:test';
import assert from 'node:assert/strict';
import {editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {compileEdit} from '../engine/src/prepared-edit/timeline.ts';
import * as visibility from '../engine/src/prepared-edit/visibility.ts';
import {semanticSceneSchema} from '../engine/src/creative-kit/semantic/schema.ts';
import {kineticSceneSchema} from '../engine/src/creative-kit/kinetic/schema.ts';
import {STYLE_METAS, ownSceneStyle} from '../engine/src/styles/registry.ts';
import {styleSceneFamilies, styleSceneSchema} from '../engine/src/styles/scenes.ts';
import {
  GRID_GLIDE_FAMILIES, gridGlideDipIssues, gridGlideSceneSchema, gridGlideSceneVariants, validateGridGlideTiming,
} from '../engine/src/styles/grid-glide/scenes/schema.ts';
import {ssrBundle, setFrame} from './helpers/glide-scene-ssr.mjs';

const cut = {kind: 'cut'}, push = {kind: 'push', dir: 'right'}, dip = {kind: 'dip'};
const asset = (name) => ({src: `projects/example/${name}`, sha256: 'a'.repeat(64), width: 1600, height: 900});
const scene = (family, data, extra = {}) => ({id: 'glide-1', family, fromFrame: 0, durationInFrames: 210, layout: 'takeover', motion: 'quiet', data, ...extra});
const chapter = (data = {}, extra = {}) => scene('glide-chapter', {ordinal: 'First', heroAt: 1, pill: {label: 'Example tool'}, enter: cut, exit: push, ...data}, {durationInFrames: 60, ...extra});
const card = (data = {}, extra = {}) => scene('glide-card', {
  lines: [{words: ['one', 'two', 'three'], role: 'lead', at: 2, cadence: 6.5}, {words: ['hero', 'words'], role: 'hero', at: 22, cadence: 7}],
  media: {clips: [{at: 0, ...asset('a.png'), kind: 'image'}]},
  bullets: [{text: 'open the project', at: 90}, {text: 'then the second', at: 125}],
  enter: {kind: 'slide', from: 'left'}, exit: {kind: 'push', dir: 'down'}, ...data,
}, extra);
const lines = (data = {}, extra = {}) => scene('glide-lines', {
  lines: [{words: ['one', 'clear', 'idea'], role: 'lead', at: 0}, {words: ['simple'], role: 'hero', at: 21}],
  enter: cut, exit: cut, ...data,
}, extra);
const parse = (input) => gridGlideSceneSchema.parse(input);
const timing = (input, fps = 30) => validateGridGlideTiming(parse(input), fps);
const has = (messages, pattern) => messages.some((message) => pattern.test(message));

const source = {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 600};
const manifest = (scenes, style = 'grid-glide') => ({
  version: 1, id: 'example', purpose: 'test', style, source, segments: [{fromFrame: 0, toFrame: 600}],
  captions: {status: 'draft', words: []}, scenes, sounds: [], camera: [],
});
const problems = (result) => result.error.issues.map((issue) => issue.message).join('|');

test('the three families accept generic demos, fill defaults and stay takeover-only', () => {
  const chapterScene = parse(chapter()), cardScene = parse(card()), linesScene = parse(lines());
  assert.equal(chapterScene.data.pill.label, 'Example tool');
  assert.equal(cardScene.data.enter.distance, 400);
  assert.equal(cardScene.data.media.clips[0].kind, 'image');
  assert.equal(linesScene.data.grid, false);
  assert.equal(linesScene.data.lines[0].cadence, 7);
  assert.deepEqual(parse(card({bullets: undefined})).data.bullets, []);
  assert.equal(parse(card({enter: {kind: 'slide', from: 'right', distance: 500}})).data.enter.distance, 500);
  assert.equal(gridGlideSceneSchema.safeParse(lines({}, {layout: 'split'})).success, false);
  assert.deepEqual(gridGlideSceneVariants.map((variant) => variant.shape.family.value), [...GRID_GLIDE_FAMILIES]);
});

test('strict data refuses invalid words, boxes, bullets, clips and unknown fields', () => {
  const oneLine = (extra) => ({lines: [{words: ['one'], role: 'lead', at: 0, ...extra}]});
  const refused = [
    ['seven words', lines(oneLine({words: ['a', 'b', 'c', 'd', 'e', 'f', 'g']}))],
    ['empty words', lines(oneLine({words: []}))],
    ['a word with a space', lines(oneLine({words: ['two words']}))],
    ['a word over 40 characters', lines(oneLine({words: ['x'.repeat(41)]}))],
    ['an unknown role', lines(oneLine({role: 'accent'}))],
    ['a negative cue', lines(oneLine({at: -1}))],
    ['cadence below 4', lines(oneLine({cadence: 3}))],
    ['cadence above 9', lines(oneLine({cadence: 10}))],
    ['no lines', lines({lines: []})],
    ['six lines', lines({lines: Array.from({length: 6}, (_, i) => ({words: ['a'], role: 'lead', at: i}))})],
    ['two boxes', lines({box: [{text: 'one', at: 0}, {text: 'two', at: 5}]})],
    ['a box of seven words', lines({box: {text: 'a b c d e f g', at: 0}})],
    ['a blank box', lines({box: {text: '   ', at: 0}})],
    ['five bullets', card({bullets: Array.from({length: 5}, (_, i) => ({text: 'go', at: i * 30}))})],
    ['a bullet of six words', card({bullets: [{text: 'a b c d e f', at: 0}]})],
    ['five card lines', card({lines: Array.from({length: 5}, (_, i) => ({words: ['a'], role: 'lead', at: i}))})],
    ['no media', card({media: {clips: []}})],
    ['seven clips', card({media: {clips: Array.from({length: 7}, (_, i) => ({at: i * 10, ...asset('a.png'), kind: 'image'}))}})],
    ['a fractional clip frame', card({media: {clips: [{at: 1.5, ...asset('a.png'), kind: 'image'}]}})],
    ['an absolute asset path', card({media: {clips: [{at: 0, ...asset('a.png'), src: '/a.png', kind: 'image'}]}})],
    ['an upper-case hash', card({media: {clips: [{at: 0, ...asset('a.png'), sha256: 'A'.repeat(64), kind: 'image'}]}})],
    ['a zero width', card({media: {clips: [{at: 0, ...asset('a.png'), width: 0, kind: 'image'}]}})],
    ['a scrolling video', card({media: {clips: [{at: 0, ...asset('a.mp4'), kind: 'video', scroll: {from: 0, to: 1}}]}})],
    ['a scroll beyond 1', card({media: {clips: [{at: 0, ...asset('a.png'), kind: 'image', scroll: {from: 0, to: 1.2}}]}})],
    ['slide distance 450', card({enter: {kind: 'slide', from: 'left', distance: 450}})],
    ['a slide without a side', card({enter: {kind: 'slide'}})],
    ['a push without a direction', card({exit: {kind: 'push'}})],
    ['an unknown exit', card({exit: {kind: 'fade'}})],
    ['an unknown data field', lines({extra: true})],
    ['a three-word ordinal', chapter({ordinal: 'one two three'})],
    ['an over-long pill label', chapter({pill: {label: 'x'.repeat(25)}})],
    ['a logo without a hash', chapter({pill: {label: 'Tool', logo: {src: 'projects/example/logo.png', width: 32, height: 32}}})],
    ['a blank watermark', lines({watermark: ' '})],
  ];
  for (const [label, input] of refused) assert.equal(gridGlideSceneSchema.safeParse(input).success, false, label);
  assert.equal(gridGlideSceneSchema.safeParse(lines(oneLine({at: 6.5}))).success, true, 'fractional word starts are legal');
});

test('a chapter needs 60 frames at 30 fps, scaled to the edit frame rate', () => {
  for (const [fps, frames] of [[30, 60], [25, 50], [24, 48], [50, 100], [60, 120]]) {
    assert.equal(has(timing(chapter({}, {durationInFrames: frames}), fps), /chapter needs at least/), false, `${fps} fps accepts ${frames} frames`);
    assert.equal(has(timing(chapter({}, {durationInFrames: frames - 1}), fps), new RegExp(`needs at least ${frames} frames at ${fps} fps`)), true, `${fps} fps refuses ${frames - 1} frames`);
  }
  assert.deepEqual(timing(chapter()), [], 'the default 60-frame chapter is valid');
  assert.deepEqual(timing(chapter({ordinal: 'First Tool'})), [], 'a two-word ordinal starts well before the push');
});

test('enter and exit motions, cue order and cue placement are validated', () => {
  assert.equal(has(timing(lines({exit: push}, {durationInFrames: 14})), /push exit needs at least 15 frames/), true);
  assert.equal(has(timing(lines({enter: {kind: 'slide', from: 'left'}}, {durationInFrames: 29})), /slide enter needs at least 30 frames/), true);
  assert.equal(has(timing(lines({lines: [{words: ['a'], role: 'lead', at: 250}]})), /must land inside its scene/), true);
  assert.equal(has(timing(lines({lines: [{words: ['a'], role: 'lead', at: 40}, {words: ['b'], role: 'hero', at: 10}]})), /line cues must be ordered/), true);
  assert.equal(has(timing(card({media: {clips: [{at: 5, ...asset('a.png'), kind: 'image'}]}})), /first media clip must start at frame 0/), true);
  const twice = {clips: [{at: 0, ...asset('a.png'), kind: 'image'}, {at: 0, ...asset('b.png'), kind: 'image'}]};
  assert.equal(has(timing(card({media: twice})), /media clips must be strictly ordered/), true);
  assert.equal(has(timing(card({bullets: [{text: 'x y', at: 100}, {text: 'z', at: 60}]})), /bullet cues must be strictly ordered/), true);
  assert.equal(has(timing(chapter({pill: undefined, pillAt: 20})), /pillAt needs a pill/), true);
  assert.equal(has(timing(chapter({heroAt: 20, pillAt: 5, exit: cut}, {durationInFrames: 90})), /pill cannot start before the ordinal/), true);
  assert.deepEqual(timing(card()), [], 'the default card scene is valid');
  assert.deepEqual(timing(lines({box: {text: 'one clear idea', at: 50}, exit: push})), []);
});

test('every cue begins at least 4 frames before the exit begins', () => {
  // A 210-frame scene with a push exit: the push begins at frame 195, so the latest cue start is frame 191.
  const lastWord = (at) => lines({lines: [{words: ['a', 'b', 'c'], role: 'hero', at, cadence: 7}], exit: push});
  assert.deepEqual(timing(lastWord(177)), [], 'the last word starts at frame 191, 4 frames before the push');
  assert.equal(has(timing(lastWord(178)), /the last word of line 1 starts at frame 192 but the push exit starts at frame 195; every cue must begin at least 4 frames before the exit/), true);
  assert.deepEqual(timing(lines({box: {text: 'one two three four', at: 191}, exit: push})), [], 'a box wipe may still be running when the push begins');
  assert.equal(has(timing(lines({box: {text: 'one two three four', at: 192}, exit: push})), /the box starts at frame 192 but the push exit starts at frame 195/), true);
  assert.deepEqual(timing(card({bullets: [{text: 'a b c', at: 181}]})), []);
  assert.equal(has(timing(card({bullets: [{text: 'a b c', at: 182}]})), /the last word of bullet 1 starts at frame 192 but the push exit starts at frame 195/), true);
  // A chapter lasts 60 frames: the push begins at frame 45 and the latest cue start is frame 41.
  assert.deepEqual(timing(chapter({pillAt: 41})), []);
  assert.equal(has(timing(chapter({pillAt: 42})), /the pill starts at frame 42 but the push exit starts at frame 45/), true);
  assert.equal(has(timing(chapter({ordinal: 'First Tool', heroAt: 35})), /the last ordinal word starts at frame 42 but the push exit starts at frame 45/), true);
  // A dip exit begins 5 frames before the end and a cut exit at the end.
  const single = (at, exit) => lines({lines: [{words: ['a'], role: 'lead', at}], exit});
  assert.deepEqual(timing(single(201, dip)), []);
  assert.equal(has(timing(single(202, dip)), /the last word of line 1 starts at frame 202 but the dip exit starts at frame 205/), true);
  assert.deepEqual(timing(single(206, cut)), []);
  assert.equal(has(timing(single(207, cut)), /the last word of line 1 starts at frame 207 but the cut exit starts at frame 210/), true);
  // The old settle rule is gone: a word may still be settling when the exit begins.
  assert.deepEqual(timing(single(190, push)), [], 'a word that starts at frame 190 is still rising when the push begins at 195');
});

test('the cue rule, the minimum lengths and the pill delay scale with the frame rate', () => {
  // 60 fps: a 420-frame scene with a push exit begins its exit at frame 390; a cue needs 8 frames of lead (latest 382).
  const at60 = (data) => timing(lines({exit: push, ...data}, {durationInFrames: 420}), 60);
  const row = (at) => ({lines: [{words: ['a', 'b', 'c'], role: 'hero', at, cadence: 7}]});
  assert.deepEqual(at60(row(354)), [], 'cadence 7 is 14 frames at 60 fps: the last word starts at frame 382');
  assert.equal(has(at60(row(355)), /the last word of line 1 starts at frame 383 but the push exit starts at frame 390; every cue must begin at least 8 frames before the exit/), true);
  assert.deepEqual(at60({box: {text: 'one clear idea', at: 382}}), []);
  assert.equal(has(at60({box: {text: 'one clear idea', at: 383}}), /the box starts at frame 383 but the push exit starts at frame 390/), true);
  // The default pill start follows the hero word by 14.75 x fps / 30 frames; pillAt is a frame of the edit.
  const chapter60 = (data) => timing(chapter(data, {durationInFrames: 120}), 60);
  assert.deepEqual(chapter60({heroAt: 2}), [], 'the default pill starts at frame 31.5');
  assert.equal(has(chapter60({heroAt: 60}), /the pill starts at frame 89.5 but the push exit starts at frame 90; every cue must begin at least 8 frames before the exit \(latest start: frame 82\)/), true);
  assert.deepEqual(chapter60({heroAt: 2, pillAt: 82}), []);
  assert.equal(has(chapter60({heroAt: 2, pillAt: 83}), /the pill starts at frame 83 but/), true);
  // Minimum lengths: the push, the slide-in and the dip double at 60 fps.
  assert.equal(has(timing(lines({exit: push}, {durationInFrames: 29}), 60), /push exit needs at least 30 frames at 60 fps/), true);
  assert.equal(has(timing(lines({enter: {kind: 'slide', from: 'left'}}, {durationInFrames: 59}), 60), /slide enter needs at least 60 frames at 60 fps/), true);
  assert.equal(has(timing(lines({exit: dip}, {durationInFrames: 9}), 60), /dip needs at least 10 frames at 60 fps/), true);
  // 24 fps: the push begins 12 frames before the end and the lead is 3.2 frames, so the latest cue start is frame 152.8.
  const at24 = (at) => timing(lines({lines: [{words: ['a'], role: 'lead', at}], exit: push}, {durationInFrames: 168}), 24);
  assert.deepEqual(at24(152), []);
  assert.equal(has(at24(153), /the last word of line 1 starts at frame 153 but the push exit starts at frame 156; every cue must begin at least 3.2 frames before the exit \(latest start: frame 152.8\)/), true);
  // The default frame rate is 30 fps.
  assert.deepEqual(validateGridGlideTiming(parse(chapter())), validateGridGlideTiming(parse(chapter()), 30));
});

test('an entering and a leaving motion never overlap', () => {
  // The scene is long enough for the enter motion and then the exit motion: slide 30, dip 5, push 15 (dip 5) at 30 fps.
  const slide = {kind: 'slide', from: 'left'};
  const single = {lines: [{words: ['a'], role: 'lead', at: 0}]};
  const both = (enter, exit, frames, fps = 30) => timing(lines({...single, enter, exit}, {durationInFrames: frames}), fps);
  const overlap = /enter and a \w+ exit need at least (\d+) frames at \d+ fps so the two motions never overlap/;
  const needed = (messages) => Number(messages.find((message) => overlap.test(message))?.match(overlap)[1]);
  for (const [enter, exit, frames] of [[slide, push, 45], [slide, dip, 35], [dip, push, 20], [dip, dip, 10]]) {
    assert.deepEqual(both(enter, exit, frames), [], `${enter.kind} + ${exit.kind} fits in ${frames} frames`);
    assert.equal(needed(both(enter, exit, frames - 1)), frames, `${enter.kind} + ${exit.kind} asks for ${frames} frames at 30 fps`);
  }
  assert.match(both(slide, push, 44).join('|'), /glide-1: a slide enter and a push exit need at least 45 frames at 30 fps/);
  // Both lengths scale with the frame rate: 90 frames at 60 fps, 36 at 24 fps (slide 24 + push 12).
  assert.deepEqual(both(slide, push, 90, 60), []);
  assert.equal(needed(both(slide, push, 89, 60)), 90);
  assert.deepEqual(both(slide, push, 36, 24), []);
  assert.equal(needed(both(slide, push, 35, 24)), 36);
  // A cut on either side has no motion to collide with, and a scene shorter than one motion reports that motion only.
  assert.equal(has(both(slide, cut, 30), overlap), false);
  assert.equal(has(both(cut, push, 20), overlap), false);
  const short = both(slide, push, 29);
  assert.equal(has(short, /slide enter needs at least 30 frames/), true);
  assert.equal(has(short, overlap), false, 'one message per cause: the single-motion minimum already explains it');
});

test('a dip exit is followed contiguously by a dip enter', () => {
  const at = (id, from, enter, exit) => lines({enter, exit}, {id, fromFrame: from, durationInFrames: 100});
  assert.deepEqual(gridGlideDipIssues([at('a', 0, cut, dip), at('b', 100, dip, cut)]), []);
  assert.match(gridGlideDipIssues([at('a', 0, cut, dip), at('b', 100, cut, cut)]).join('|'), /a: a dip exit needs the next scene/);
  assert.match(gridGlideDipIssues([at('a', 0, cut, dip)]).join('|'), /followed immediately/);
  assert.match(gridGlideDipIssues([at('a', 0, cut, dip), at('b', 110, dip, cut)]).join('|'), /followed immediately/);
  assert.match(gridGlideDipIssues([at('a', 0, cut, cut), at('b', 100, dip, cut)]).join('|'), /b: a dip enter must follow/);
  assert.deepEqual(gridGlideDipIssues([at('a', 0, dip, cut)]), [], 'an opening dip enter has no scene before it');
  const foreign = {id: 'b', family: 'intro', fromFrame: 100, durationInFrames: 60};
  assert.match(gridGlideDipIssues([at('a', 0, cut, dip), foreign]).join('|'), /Grid Glide scene that enters with a dip/);
});

test('the aggregate matches the style registry and stays disjoint from other families', () => {
  assert.deepEqual([...styleSceneFamilies], [...GRID_GLIDE_FAMILIES]);
  for (const family of styleSceneFamilies) assert.equal(ownSceneStyle(family), 'grid-glide', family);
  assert.deepEqual(STYLE_METAS.flatMap((meta) => [...meta.ownScenes]).sort(), [...styleSceneFamilies].sort(),
    'every owned family has exactly one schema variant and the reverse');
  for (const input of [chapter(), card(), lines()]) {
    assert.equal(styleSceneSchema.safeParse(input).success, true);
    assert.equal(semanticSceneSchema.safeParse(input).success, false);
    assert.equal(kineticSceneSchema.safeParse(input).success, false);
  }
  assert.equal(styleSceneSchema.safeParse({...lines(), family: 'message-board'}).success, false);
});

test('a manifest accepts the families only in the style that owns them', () => {
  const scenes = [chapter(), card({}, {id: 'glide-2', fromFrame: 60}), lines({}, {id: 'glide-3', fromFrame: 270, durationInFrames: 100})];
  const accepted = editManifestSchema.safeParse(manifest(scenes));
  assert.equal(accepted.success, true, accepted.success ? '' : accepted.error.message);
  for (const style of ['section-deck', 'liquid-glass']) {
    const refused = editManifestSchema.safeParse(manifest([chapter()], style));
    assert.equal(refused.success, false, style);
    assert.match(problems(refused), /glide-1: glide-chapter scenes are available only in grid-glide/);
  }
});

test('a manifest reports timing and dip problems', () => {
  const lateBullet = editManifestSchema.safeParse(manifest([card({bullets: [{text: 'a b c', at: 182}]})]));
  assert.equal(lateBullet.success, false);
  assert.match(problems(lateBullet), /the last word of bullet 1 starts at frame 192 but the push exit starts at frame 195/);
  const dipOnly = editManifestSchema.safeParse(manifest([lines({exit: dip}, {id: 'a', durationInFrames: 100}), lines({}, {id: 'b', fromFrame: 100, durationInFrames: 100})]));
  assert.equal(dipOnly.success, false);
  assert.match(problems(dipOnly), /a: a dip exit needs the next scene/);
  const paired = editManifestSchema.safeParse(manifest([lines({exit: dip}, {id: 'a', durationInFrames: 100}), lines({enter: dip}, {id: 'b', fromFrame: 100, durationInFrames: 100})]));
  assert.equal(paired.success, true, paired.success ? '' : paired.error.message);
});

test('a manifest applies the timing rules at its own frame rate', () => {
  const at60 = (scenes) => editManifestSchema.safeParse({...manifest(scenes), source: {...source, fps: 60}});
  const short = at60([chapter({heroAt: 2}, {durationInFrames: 100})]);
  assert.equal(short.success, false);
  assert.match(problems(short), /glide-1: a chapter needs at least 120 frames at 60 fps/);
  const fine = at60([chapter({heroAt: 2}, {durationInFrames: 120})]);
  assert.equal(fine.success, true, fine.success ? '' : fine.error.message);
  assert.equal(editManifestSchema.safeParse(manifest([chapter({heroAt: 1})])).success, true, 'the 60-frame chapter is valid at 30 fps');
});

test('captions are hidden while a style-owned scene is on screen', () => {
  assert.equal(typeof visibility.captionHiddenByScene, 'function');
  for (const family of GRID_GLIDE_FAMILIES) assert.equal(visibility.captionHiddenByScene({family}), true, family);
  for (const family of ['intro', 'proof', 'message-board', 'kinetic-hook', 'screens', 'project-scene']) assert.equal(visibility.captionHiddenByScene({family}), false, family);
  assert.equal(visibility.captionHiddenByScene(undefined), false);
});

test('the real CaptionTrack paints nothing over a glide scene', async () => {
  const bundle = await ssrBundle(`
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {CaptionTrack} from './engine/src/prepared-edit/PreparedEdit';
    export const render = (edit, compiled) => renderToStaticMarkup(React.createElement(CaptionTrack, {edit, compiled, center: 1320}));
  `);
  const words = [{text: 'one', startMs: 0, endMs: 300, confidence: 1}];
  const over = (scenes) => {
    const edit = editManifestSchema.parse({...manifest(scenes), captions: {status: 'draft', words}});
    return {edit, compiled: compileEdit(edit)};
  };
  setFrame(5);
  const glide = over([lines({}, {durationInFrames: 120})]);
  assert.equal(bundle.render(glide.edit, glide.compiled), '', 'a glide scene draws its own words');
  const bare = over([]);
  assert.throws(() => bundle.render(bare.edit, bare.compiled), /measureText\(\) can only be called in a browser/, 'without a glide scene the caption is built, and measuring it needs a browser');
});
