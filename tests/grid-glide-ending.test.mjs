import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {profileToBrief} from '../scripts/lib/branding.mjs';
import {normalizeGraphicsSpec} from '../scripts/lib/graphics-project.mjs';
import {endingIssues} from '../scripts/lib/endings.mjs';
import {BEAT_FAMILIES, assertDeliveryReady, buildEditorPlan, validateEditorBrief} from '../scripts/lib/editor-director.mjs';
import {GLIDE_CUE_FAMILIES, sceneCues} from '../scripts/lib/scene-cues.mjs';
import {editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {styleSceneSchema, validateStyleSceneTiming} from '../engine/src/styles/scenes.ts';
import {ownSceneStyle} from '../engine/src/styles/registry.ts';
import {
  ENDING_HOLD_FRAMES, GRID_GLIDE_FAMILIES, gridGlideSceneSchema, gridGlideSceneVariants, validateGridGlideTiming,
} from '../engine/src/styles/grid-glide/scenes/schema.ts';
import {BAND, centredRowY, gridGlideLayoutIssues, layoutGlideComment, layoutGlideFollow, lineBox} from '../engine/src/styles/grid-glide/scenes/layout.ts';
import {OUT, PILL, pillStart, wipeFrames} from '../engine/src/styles/grid-glide/scenes/math.ts';
import {gridGlideTemplate, gridGlideTemplateFrames} from '../engine/src/styles/grid-glide/scenes/templates.ts';
import {ssrBundle, setFrame, css, leaves, wordMotion} from './helpers/glide-scene-ssr.mjs';

const cut = {kind: 'cut'}, push = {kind: 'push', dir: 'right'}, dip = {kind: 'dip'};
const lead = (words = ['Say', 'it', 'below'], at = 6) => ({words, role: 'lead', at, cadence: 7});
const scene = (family, data, extra = {}) => ({id: 'glide-1', family, fromFrame: 0, durationInFrames: 120, layout: 'takeover', motion: 'quiet', data, ...extra});
const comment = (data = {}, extra = {}) => scene('glide-comment', {
  lines: [lead()], keyword: 'Plan', heroAt: 30, box: {text: 'one clear idea now', at: 55}, enter: cut, exit: cut, ...data,
}, extra);
const follow = (data = {}, extra = {}) => scene('glide-follow', {
  lines: [lead(['Want', 'more'])], handle: '@example.creator', heroAt: 24, pill: {label: 'Follow'}, enter: cut, exit: cut, ...data,
}, {durationInFrames: 90, ...extra});
const parse = (input) => gridGlideSceneSchema.parse(input);
const timing = (input, fps = 30) => validateGridGlideTiming(parse(input), fps);
const has = (messages, pattern) => messages.some((message) => pattern.test(message));
const refused = (input) => gridGlideSceneSchema.safeParse(input).success === false;

const HANDLE = '@example.creator';
const FIVE = ['glide-chapter', 'glide-card', 'glide-lines', 'glide-comment', 'glide-follow'];

/* ---------------------------------------------------------------------------------------------- schema */

test('the two ending families are appended after the three earlier ones, owned by Grid Glide and takeover-only', () => {
  assert.deepEqual([...GRID_GLIDE_FAMILIES], FIVE);
  assert.deepEqual(gridGlideSceneVariants.map((variant) => variant.shape.family.value), FIVE);
  for (const family of ['glide-comment', 'glide-follow']) assert.equal(ownSceneStyle(family), 'grid-glide', family);
  assert.deepEqual([...GLIDE_CUE_FAMILIES], FIVE);
  const parsedComment = parse(comment()), parsedFollow = parse(follow());
  assert.equal(parsedComment.data.lines[0].cadence, 7, 'cadence defaults to 7');
  assert.deepEqual(parse(follow({lines: undefined})).data.lines, [], 'a follow scene may have no lead-in line');
  assert.equal(parsedFollow.data.pill.label, 'Follow');
  assert.equal(parse(comment({box: undefined})).data.box, undefined, 'the promise box is optional');
  assert.equal(styleSceneSchema.safeParse(comment()).success, true);
  assert.equal(styleSceneSchema.safeParse(follow()).success, true);
});

test('the comment and follow data refuse a bad keyword, a bad handle, missing parts and unknown fields', () => {
  const refusals = [
    ['a keyword over 20 characters', comment({keyword: 'x'.repeat(21)})],
    ['a keyword of four words', comment({keyword: 'one two three four'})],
    ['a blank keyword', comment({keyword: '   '})],
    ['a comment with no lines', comment({lines: []})],
    ['a comment with four lines', comment({lines: [lead(), lead(), lead(), lead()]})],
    ['a comment with no heroAt', comment({heroAt: undefined})],
    ['a comment with a pill', comment({pill: {label: 'Follow'}})],
    ['a comment with an unknown field', comment({extra: true})],
    ['a comment in a split layout', comment({}, {layout: 'split'})],
    ['a handle with no @', follow({handle: 'example.creator'})],
    ['a handle with a space', follow({handle: '@example creator'})],
    ['a handle over 30 characters', follow({handle: `@${'a'.repeat(31)}`})],
    ['an empty handle', follow({handle: '@'})],
    ['a follow with no pill', follow({pill: undefined})],
    ['a follow with an empty pill label', follow({pill: {label: ''}})],
    ['a follow pill with a logo', follow({pill: {label: 'Follow', logo: {src: 'projects/example/logo.png', sha256: 'a'.repeat(64), width: 32, height: 32}}})],
    ['a follow with three lines', follow({lines: [lead(), lead(), lead()]})],
    ['a follow with an unknown field', follow({extra: true})],
    ['a follow in a split layout', follow({}, {layout: 'split'})],
  ];
  for (const [label, input] of refusals) assert.ok(refused(input), label);
  assert.equal(gridGlideSceneSchema.safeParse(follow({handle: `@${'a'.repeat(30)}`})).success, true, '@ plus 30 characters is the longest handle');
  assert.equal(gridGlideSceneSchema.safeParse(comment({keyword: 'one two three'})).success, true, 'three words are allowed');
  assert.equal(gridGlideSceneSchema.safeParse(comment({keyword: 'x'.repeat(20)})).success, true, 'twenty characters are allowed');
});

test('both templates validate at 30, 50 and 60 fps and use only placeholder text', () => {
  for (const family of ['glide-comment', 'glide-follow']) {
    for (const fps of [30, 50, 60]) {
      const input = scene(family, gridGlideTemplate(family, fps), {durationInFrames: gridGlideTemplateFrames(family, fps)});
      const parsed = gridGlideSceneSchema.safeParse(input);
      assert.equal(parsed.success, true, `${family} at ${fps} fps: ${parsed.error?.message}`);
      assert.deepEqual(validateGridGlideTiming(parsed.data, fps), [], `${family} at ${fps} fps`);
      assert.deepEqual(gridGlideLayoutIssues(parsed.data), [], `${family} at ${fps} fps`);
    }
  }
  assert.equal(gridGlideTemplate('glide-follow', 30).handle, '@your.handle', 'the template never carries a real handle');
  assert.equal(gridGlideTemplateFrames('glide-comment', 30), 120);
  assert.equal(gridGlideTemplateFrames('glide-follow', 30), 90);
});

/* ---------------------------------------------------------------------------------------------- timing */

test('an ending holds its last element for 24 frames (scaled) before a cut', () => {
  assert.equal(ENDING_HOLD_FRAMES, 24);
  // Comment: the box wipe of four words lasts 30.5 frames from frame 55, so it finishes at 85.5; plus 24 is 109.5.
  assert.equal(55 + wipeFrames(4), 85.5);
  assert.deepEqual(timing(comment({}, {durationInFrames: 110})), []);
  const short = timing(comment({}, {durationInFrames: 109}));
  assert.equal(has(short, /glide-1: the ending must hold its last element for at least 24 frames before the exit; it finishes at frame 85.5 but the cut exit starts at frame 109/), true, short.join('|'));
  // The keyword alone (heroAt 30, one word) settles at frame 60: no box, so 84 is the shortest scene.
  assert.deepEqual(timing(comment({box: undefined}, {durationInFrames: 84})), []);
  assert.equal(has(timing(comment({box: undefined}, {durationInFrames: 83})), /it finishes at frame 60 but the cut exit starts at frame 83/), true);
  // A three-word keyword settles two cadence steps (14 frames) later: heroAt 30 + 14 + 30 = 74.
  assert.equal(has(timing(comment({box: undefined, keyword: 'one two three'}, {durationInFrames: 97})), /it finishes at frame 74 but the cut exit starts at frame 97/), true);
  assert.deepEqual(timing(comment({box: undefined, keyword: 'one two three'}, {durationInFrames: 98})), []);
  // Follow: the default pill starts at 24 + 14.75 and settles 21.75 frames later, at 60.5; plus 24 is 84.5.
  assert.deepEqual(timing(follow({}, {durationInFrames: 85})), []);
  const brief = timing(follow({}, {durationInFrames: 84}));
  assert.equal(has(brief, /glide-1: the ending must hold its last element for at least 24 frames before the exit; it finishes at frame 60.5 but the cut exit starts at frame 84/), true, brief.join('|'));
  // A slow lead-in line is part of the last element too: six words from frame 6 settle at 6 + 5 x 7 + 30 = 71, after the pill.
  const slow = follow({lines: [lead(['a', 'b', 'c', 'd', 'e', 'f'], 6)]}, {durationInFrames: 90});
  assert.equal(has(timing(slow), /it finishes at frame 71 but the cut exit starts at frame 90/), true);
  assert.deepEqual(timing({...slow, durationInFrames: 95}), []);
});

test('the hold counts from the exit that starts the leave: a push or a dip starts it earlier', () => {
  // 110 frames with a push: the push starts at frame 95, before 109.5.
  assert.equal(has(timing(comment({exit: push}, {durationInFrames: 110})), /hold its last element .* but the push exit starts at frame 95/), true);
  assert.deepEqual(timing(comment({exit: push}, {durationInFrames: 125})), [], 'the push starts at 110, after 109.5');
  assert.equal(has(timing(comment({exit: dip}, {durationInFrames: 114})), /but the dip exit starts at frame 109/), true);
  assert.deepEqual(timing(comment({exit: dip}, {durationInFrames: 115})), [], 'a dip starts 5 frames before the end');
});

test('the hold and the cue rules scale with the frame rate; positions are frames of the edit', () => {
  // 60 fps: lines at 12, heroAt 60, box at 110; the box (four words) wipes for 61 frames to 171; the hold is 48 frames.
  const at60 = (extra = {}, data = {}) => timing(comment({lines: [lead(['Say', 'it', 'below'], 12)], heroAt: 60, box: {text: 'one clear idea now', at: 110}, ...data}, extra), 60);
  assert.deepEqual(at60({durationInFrames: 219}), []);
  assert.equal(has(at60({durationInFrames: 218}), /for at least 48 frames before the exit; it finishes at frame 171 but the cut exit starts at frame 218/), true);
  // 50 fps: positions are not scaled by the validator; the pill settles 36.25 frames after its start.
  const at50 = (extra = {}, data = {}) => timing(follow({heroAt: 40, ...data}, extra), 50);
  // pill start 40 + 24.58333 = 64.58333, settled at 100.83333, plus 40 frames of hold is 140.83333.
  assert.deepEqual(at50({durationInFrames: 141}), []);
  assert.equal(has(at50({durationInFrames: 140}), /for at least 40 frames before the exit; it finishes at frame 100.83 but the cut exit starts at frame 140/), true);
});

test('the keyword, the handle, the box and the pill respect their order and the cue lead', () => {
  assert.equal(has(timing(comment({heroAt: 2})), /glide-1: the keyword cannot start before its lead-in lines/), true);
  assert.equal(has(timing(follow({heroAt: 2})), /glide-1: the handle cannot start before its lead-in lines/), true);
  assert.equal(has(timing(comment({heroAt: 40, box: {text: 'one clear idea now', at: 30}})), /glide-1: the box cannot start before the keyword/), true);
  assert.equal(has(timing(follow({heroAt: 30, pillAt: 10})), /glide-1: the pill cannot start before the handle/), true);
  // A 120-frame scene with a push exit begins its exit at frame 105; the latest cue start is frame 101.
  const late = (heroAt, extra) => timing(comment({heroAt, box: undefined, ...extra}, {durationInFrames: 120}));
  assert.equal(has(late(102, {exit: push}), /the last keyword word starts at frame 102 but the push exit starts at frame 105; every cue must begin at least 4 frames before the exit/), true);
  assert.equal(has(late(101, {exit: push}), /the last keyword word starts at/), false);
  // The last word of a three-word keyword starts two steps of 7 frames after the first.
  assert.equal(has(late(88, {exit: push, keyword: 'one two three'}), /the last keyword word starts at frame 102/), true);
  assert.equal(has(timing(follow({heroAt: 87})), /glide-1: the handle starts at frame 87 but the cut exit starts at frame 90/), true);
  assert.equal(has(timing(follow({pillAt: 87})), /glide-1: the pill starts at frame 87 but the cut exit starts at frame 90/), true);
  assert.equal(has(timing(comment({box: {text: 'one two', at: 117}})), /the box starts at frame 117 but the cut exit starts at frame 120/), true);
  assert.equal(has(timing(comment({lines: [lead(['a', 'b', 'c'], 104)], heroAt: 104, box: undefined})), /the last word of line 1 starts at frame 118 but the cut exit starts at frame 120/), true);
  assert.equal(has(timing(comment({heroAt: 130, box: undefined})), /must land inside its scene/), true);
});

test('a dip around an ending scene is checked like the earlier families', () => {
  const dipped = (input, extra) => ({...input, id: 'a', ...extra});
  const issues = (scenes) => {
    const manifest = editManifestSchema.safeParse({
      version: 1, id: 'example', purpose: 'test', style: 'grid-glide',
      source: {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 600},
      segments: [{fromFrame: 0, toFrame: 600}], captions: {status: 'draft', words: []}, scenes, sounds: [], camera: [],
    });
    return manifest.success ? [] : manifest.error.issues.map((issue) => issue.message);
  };
  const dipComment = dipped(comment({exit: dip}), {durationInFrames: 140});
  assert.equal(has(issues([dipComment]), /a: a dip exit must be followed immediately by the next scene/), true);
  const joined = issues([dipComment, follow({enter: dip}, {id: 'b', fromFrame: 140})]);
  assert.deepEqual(joined, []);
  assert.equal(has(issues([follow({enter: dip}, {id: 'b', fromFrame: 140})]), /b: a dip enter must follow/), true);
});

/* ---------------------------------------------------------------------------------------------- layout */

test('the comment stack is centred above the rail: lead line, keyword slot and promise box', () => {
  const data = parse(comment()).data;
  const layout = layoutGlideComment(data);
  assert.deepEqual(layout.issues, []);
  // 91 (lead) + 195 (keyword at 150 px) + 38 + 128 (box) = 452; (900 - 452) / 2 = 224; top = 250 + 224.
  assert.deepEqual(layout.lines.map((entry) => entry.y), [474]);
  assert.deepEqual([layout.keyword.y, layout.keyword.slot, layout.keyword.min, layout.keyword.max], [565, 195, 100, 150]);
  assert.deepEqual(layout.box, {y: 798, h: 128, dir: 'ltr', words: 4});
  assert.equal(layout.bottom, 926);
  assert.deepEqual([layout.keyword.x, layout.keyword.width], [BAND.left, BAND.right - BAND.left]);
  assert.deepEqual(layout.keyword.words, ['Plan']);
  assert.equal(layout.keyword.dir, 'ltr');
  assert.equal(layout.keyword.at, 30);
  assert.equal(layout.keyword.cadence, 7);
  assert.equal(layout.keyword.weight, 700);
  const bare = layoutGlideComment(parse(comment({box: undefined})).data);
  assert.equal(bare.box, null);
  assert.equal(bare.bottom, bare.keyword.y + 195);
  assert.equal(layoutGlideComment(parse(comment({keyword: 'خطة'})).data).keyword.dir, 'rtl');
  assert.deepEqual(layoutGlideComment(parse(comment({keyword: 'one two three'})).data).keyword.words, ['one', 'two', 'three']);
});

test('the follow stack is centred above the rail: lead line, handle slot and pill', () => {
  const layout = layoutGlideFollow(parse(follow()).data);
  assert.deepEqual(layout.issues, []);
  // 91 (lead) + 130 (handle at 100 px) + 65 + 176 (pill) = 462; (900 - 462) / 2 = 219; top = 250 + 219.
  assert.deepEqual(layout.lines.map((entry) => entry.y), [469]);
  assert.deepEqual([layout.handle.y, layout.handle.slot, layout.handle.min, layout.handle.max], [560, 130, 40, 100]);
  assert.deepEqual(layout.pill, {y: 755, bottom: 931});
  assert.equal(layout.bottom, 931);
  assert.deepEqual(layout.handle.words, [HANDLE]);
  assert.equal(layout.handle.dir, 'ltr');
  assert.equal(layout.handle.weight, 700);
  assert.equal(layout.pill.y + PILL.h, layout.pill.bottom);
  assert.equal(PILL.x + PILL.w / 2, 540, 'the pill is centred on the canvas');
  const alone = layoutGlideFollow(parse(follow({lines: []})).data);
  assert.deepEqual(alone.lines, []);
  // Without a lead-in line the block is 130 + 65 + 176 = 371 px: top = 250 + round(264.5) = 515.
  assert.deepEqual([alone.handle.y, alone.pill.y, alone.bottom], [515, 710, 886]);
});

test('a row is centred in its reserved slot at any fitted size', () => {
  assert.equal(centredRowY({y: 565, slot: 195}, 150), 565);
  assert.equal(centredRowY({y: 565, slot: 195}, 100), 565 + Math.round((195 - lineBox(100)) / 2));
  assert.equal(centredRowY({y: 560, slot: 130}, 40), 560 + Math.round((130 - lineBox(40)) / 2));
  for (const size of [100, 120, 150]) {
    const y = centredRowY({y: 565, slot: 195}, size);
    assert.ok(y >= 565 && y + lineBox(size) <= 565 + 195, `the keyword row stays in its slot at ${size}px`);
  }
});

test('the largest legal ending stacks end above the action rail, and an overfull stack is reported', () => {
  const heroes = (count) => Array.from({length: count}, () => ({words: ['one', 'two'], role: 'hero', at: 6, cadence: 7}));
  const biggestComment = layoutGlideComment(parse(comment({lines: heroes(3)}, {durationInFrames: 300})).data);
  assert.deepEqual(biggestComment.issues, []);
  assert.ok(biggestComment.bottom <= BAND.rail.y, `comment ends at ${biggestComment.bottom}`);
  assert.ok(biggestComment.lines[0].y >= BAND.top);
  const biggestFollow = layoutGlideFollow(parse(follow({lines: heroes(2)}, {durationInFrames: 300})).data);
  assert.deepEqual(biggestFollow.issues, []);
  assert.ok(biggestFollow.pill.bottom <= BAND.rail.y, `follow ends at ${biggestFollow.pill.bottom}`);
  // The schema keeps the stacks legal; the layout still reports data it was never given by the schema.
  const tooTall = layoutGlideComment({...parse(comment()).data, lines: heroes(7)});
  assert.match(tooTall.issues.join('|'), /the stack is \d+px tall but the space above the Instagram action rail is 900px; drop or merge a line/);
  const tooTallFollow = layoutGlideFollow({...parse(follow()).data, lines: heroes(7)});
  assert.match(tooTallFollow.issues.join('|'), /the stack is \d+px tall but the space above the Instagram action rail is 900px; drop or merge a line/);
  assert.match(gridGlideLayoutIssues({id: 'glide-1', family: 'glide-comment', data: {...parse(comment()).data, lines: heroes(7)}}).join('|'), /^glide-1: the stack is/);
  assert.deepEqual(gridGlideLayoutIssues(parse(comment())), []);
  assert.deepEqual(gridGlideLayoutIssues(parse(follow())), []);
  assert.deepEqual(validateStyleSceneTiming(styleSceneSchema.parse(comment())), []);
  assert.deepEqual(validateStyleSceneTiming(styleSceneSchema.parse(follow())), []);
});

/* ------------------------------------------------------------------------------------ ending checks */

const CREATOR = {handle: HANDLE, ending: {cta: 'خطة', followCard: true, signOff: null}};
const part = (family, data = {}, extra = {}) => ({id: family, family, fromFrame: 0, durationInFrames: 90, data, ...extra});
const KEYWORD = {keyword: 'خطة'}, OWN_HANDLE = {handle: HANDLE};
const check = (scenes, creator = CREATOR, extra = {}) => endingIssues({creator, scenes, ...extra});
const lonely = (cta, followCard) => ({handle: HANDLE, ending: {cta, followCard, signOff: null}});

test('the ending checks accept the shared scenes, the Grid Glide scenes and the creator CTA, in any pairing', () => {
  const click = part('creator-cta', {...KEYWORD, ...OWN_HANDLE, followFrame: 30, clickedFrame: 60});
  assert.deepEqual(check([part('comment', KEYWORD), part('follow', OWN_HANDLE)]), []);
  assert.deepEqual(check([part('glide-comment', KEYWORD), part('glide-follow', OWN_HANDLE)]), []);
  assert.deepEqual(check([part('comment', KEYWORD), part('glide-follow', OWN_HANDLE)]), [], 'a shared CTA before a Grid Glide follow');
  assert.deepEqual(check([part('glide-comment', KEYWORD), part('follow', OWN_HANDLE)]), [], 'a Grid Glide CTA before a shared follow');
  assert.deepEqual(check([part('glide-lines'), part('glide-comment', KEYWORD), part('glide-follow', OWN_HANDLE)]), [], 'earlier scenes are free');
  assert.deepEqual(check([click]), []);
  assert.deepEqual(check([part('glide-comment', KEYWORD)], lonely('خطة', false)), []);
  assert.deepEqual(check([part('glide-follow', OWN_HANDLE)], lonely(null, true)), []);
  assert.deepEqual(check([part('glide-lines')], lonely(null, false)), []);
});

test('the ending checks refuse a wrong keyword, an incomplete handle, a wrong order and a missing scene', () => {
  assert.deepEqual(check([part('glide-comment', {keyword: 'غيرها'}), part('glide-follow', OWN_HANDLE)]), ['The comment CTA keyword must be «خطة».']);
  assert.deepEqual(check([part('glide-comment', KEYWORD), part('glide-follow', {handle: '@example'})]), [`The follow card must show the complete profile handle ${HANDLE}.`]);
  assert.deepEqual(check([part('glide-follow', OWN_HANDLE), part('glide-comment', KEYWORD)]), ['The ending needs the comment CTA scene and then the follow card as the last two scenes.']);
  assert.deepEqual(check([part('glide-comment', KEYWORD)]), ['The ending needs the comment CTA scene and then the follow card as the last two scenes.']);
  assert.deepEqual(check([part('glide-comment', KEYWORD), part('glide-follow', OWN_HANDLE), part('glide-lines')]), ['The ending needs the comment CTA scene and then the follow card as the last two scenes.']);
  assert.deepEqual(check([part('glide-lines'), part('glide-follow', OWN_HANDLE)]), ['The ending needs the comment CTA scene and then the follow card as the last two scenes.']);
  assert.deepEqual(check([part('glide-comment', KEYWORD), part('glide-lines')], lonely('خطة', false)), ['The ending needs the comment CTA scene as the last scene.'],
    'glide-lines is not a comment CTA, whatever its text says');
  assert.deepEqual(check([part('glide-lines')], lonely(null, true)), ['The ending needs the follow card as the last scene.']);
  assert.deepEqual(check([part('glide-comment', {keyword: 'غيرها'})], lonely('خطة', false)), ['The comment CTA keyword must be «خطة».']);
  assert.deepEqual(check([part('glide-follow', {handle: '@example'})], lonely(null, true)), [`The follow card must show the complete profile handle ${HANDLE}.`]);
});

test('the ending checks refuse ending scenes the profile has switched off', () => {
  assert.deepEqual(check([part('glide-follow', OWN_HANDLE), part('glide-comment', KEYWORD)], lonely('خطة', false)), ['The follow card is off in the profile; remove the follow scene.']);
  assert.deepEqual(check([part('follow', OWN_HANDLE), part('glide-comment', KEYWORD)], lonely('خطة', false)), ['The follow card is off in the profile; remove the follow scene.']);
  assert.deepEqual(check([part('glide-comment', KEYWORD), part('glide-follow', OWN_HANDLE)], lonely('خطة', false)),
    ['The ending needs the comment CTA scene as the last scene.', 'The follow card is off in the profile; remove the follow scene.'], 'the follow scene comes last, so the CTA is not the last scene');
  assert.deepEqual(check([part('glide-comment', KEYWORD), part('glide-follow', OWN_HANDLE)], lonely(null, true)), ['No CTA keyword was chosen for this video; remove the comment CTA scene.']);
  assert.deepEqual(check([part('comment', KEYWORD), part('glide-follow', OWN_HANDLE)], lonely(null, true)), ['No CTA keyword was chosen for this video; remove the comment CTA scene.']);
  assert.deepEqual(check([part('glide-comment', KEYWORD)], lonely(null, false)), ['The CTA and the follow card are both off for this video; remove the ending scenes.']);
  assert.deepEqual(check([part('glide-follow', OWN_HANDLE)], lonely(null, false)), ['The CTA and the follow card are both off for this video; remove the ending scenes.']);
  assert.deepEqual(check([part('creator-cta', {...KEYWORD, ...OWN_HANDLE, followFrame: 30, clickedFrame: 60})], lonely(null, false)), ['The CTA and the follow card are both off for this video; remove the ending scenes.']);
});

test('the ending checks keep the creator CTA click order and the sign-off rules', () => {
  const click = (extra) => part('creator-cta', {...KEYWORD, ...OWN_HANDLE, followFrame: 30, clickedFrame: 60, ...extra});
  assert.deepEqual(check([click({clickedFrame: 20})]), ['Creator CTA needs comment, follow and click in order.']);
  assert.deepEqual(check([click({clickedFrame: 90})]), ['Creator CTA needs comment, follow and click in order.']);
  const signed = {handle: HANDLE, ending: {cta: 'خطة', followCard: true, signOff: 'Thank you'}};
  const ending = [part('glide-comment', KEYWORD, {fromFrame: 0}), part('glide-follow', OWN_HANDLE, {fromFrame: 90})];
  assert.deepEqual(check(ending, signed), ['The recorded sign-off is on, so the manifest needs signoffFromFrame.']);
  assert.deepEqual(check(ending, signed, {signoffFromFrame: 180}), []);
  assert.deepEqual(check(ending, signed, {signoffFromFrame: 170}), ['Every scene must finish before the recorded sign-off.']);
  assert.deepEqual(check(ending, CREATOR, {signoffFromFrame: 180}), ['The sign-off is off for this video, so the manifest must not keep signoffFromFrame.']);
  assert.deepEqual(endingIssues({scenes: ending}), ['Delivery needs the creator profile.']);
});

test('assertDeliveryReady accepts a Grid Glide edit that ends with the two ending scenes and names what is wrong otherwise', () => {
  const creator = {displayName: 'Example Studio', handle: HANDLE, ending: {cta: 'خطة', followCard: true, signOff: null}};
  const arabicLead = [{words: ['اكتب', 'الكلمة'], role: 'lead', at: 6, cadence: 7}];
  const hook = {id: 'hook', family: 'glide-lines', fromFrame: 0, durationInFrames: 90, layout: 'takeover', motion: 'quiet',
    data: {lines: [{words: ['فكرة', 'واحدة'], role: 'hero', at: 6, cadence: 7}], enter: cut, exit: cut}};
  const closing = (overrides = {}, followOverrides = {}) => [hook,
    {id: 'comment', family: 'glide-comment', fromFrame: 90, durationInFrames: 120, layout: 'takeover', motion: 'quiet',
      data: {lines: arabicLead, keyword: 'خطة', heroAt: 24, box: {text: 'قائمة الأسئلة', at: 50}, enter: cut, exit: cut, ...overrides}},
    {id: 'follow', family: 'glide-follow', fromFrame: 210, durationInFrames: 90, layout: 'takeover', motion: 'quiet',
      data: {lines: [{words: ['تابعنا'], role: 'lead', at: 4, cadence: 7}], handle: HANDLE, heroAt: 20, pill: {label: 'تابع'}, enter: cut, exit: cut, ...followOverrides}}];
  const edit = (scenes, withCreator = creator) => normalizeGraphicsSpec({version: 1, id: 'ending-check', style: 'grid-glide', fps: 30,
    durationInFrames: scenes.at(-1).fromFrame + scenes.at(-1).durationInFrames, reviewedBy: 'Example review', creator: withCreator, scenes, sounds: []}, {delivery: true});
  assert.equal(assertDeliveryReady(edit(closing())).ok, true);
  assert.throws(() => assertDeliveryReady(edit(closing({keyword: 'غيرها'}))), /Delivery ending: The comment CTA keyword must be «خطة»\./);
  assert.throws(() => assertDeliveryReady(edit(closing({}, {handle: '@example'}))), new RegExp(`Delivery ending: The follow card must show the complete profile handle ${HANDLE.replace('.', '\\.')}`));
  assert.throws(() => assertDeliveryReady(edit(closing().slice(0, 2))), /Delivery ending: The ending needs the comment CTA scene and then the follow card/);
  assert.throws(() => assertDeliveryReady(edit(closing(), {...creator, ending: {...creator.ending, followCard: false}})), /Delivery ending: The ending needs the comment CTA scene as the last scene\. The follow card is off in the profile/);
});

/* ---------------------------------------------------------------------------------------------- director */

const profile = JSON.parse(await readFile(new URL('../PROFILE.example.json', import.meta.url), 'utf8'));
const source = {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 600};
const endingProfile = () => profileToBrief({...profile, handle: HANDLE, ending: {followCard: true, ctaDefault: 'Plan', signOff: null}});
const hookBeat = {id: 'hook', fromSec: 0, toSec: 3, intent: 'glide-lines', data: {lines: [{words: ['One', 'idea'], role: 'hero', at: 6}], enter: cut, exit: cut}};
const commentBeat = (extra = {}) => ({id: 'ask', fromSec: 3, toSec: 7, intent: 'glide-comment', data: {
  lines: [lead()], keyword: 'Plan', heroAt: 30, box: {text: 'one clear idea now', at: 55}, enter: cut, exit: cut}, ...extra});
const followBeat = (extra = {}) => ({id: 'more', fromSec: 7, toSec: 10, intent: 'glide-follow', data: {
  lines: [lead(['Want', 'more'])], handle: HANDLE, heroAt: 24, pill: {label: 'Follow'}, enter: cut, exit: cut}, ...extra});
const brief = (beats = [hookBeat, commentBeat(), followBeat()], extra = {}) => ({
  version: 1, id: 'glide-ending', source: source.path, transcript: 'Projects/glide-ending/words.json', ...endingProfile(),
  purpose: 'explainer', tone: 'calm', style: 'grid-glide', beats, ...extra,
});

test('glide-comment and glide-follow are director intents with a takeover layout and strict data', () => {
  for (const family of ['glide-comment', 'glide-follow']) assert.equal(BEAT_FAMILIES[family], family);
  const plan = buildEditorPlan(brief(), source, []);
  assert.deepEqual(plan.manifest.scenes.map((entry) => [entry.family, entry.layout]), [['glide-lines', 'takeover'], ['glide-comment', 'takeover'], ['glide-follow', 'takeover']]);
  assert.equal(editManifestSchema.safeParse(plan.manifest).success, true);
  const unknown = commentBeat();
  unknown.data.unexpected = true;
  assert.throws(() => validateEditorBrief(brief([hookBeat, unknown, followBeat()])), /unrecognized/i);
  assert.throws(() => validateEditorBrief(brief([hookBeat, commentBeat({layout: 'split'}), followBeat()])), /"layout"[\s\S]*expected \\?"takeover/);
  assert.throws(() => validateEditorBrief(brief([hookBeat, commentBeat(), followBeat({data: {...followBeat().data, handle: 'example'}})])), /Use a complete @handle/);
});

test('the ending beats are refused in another style and carry the thump sound candidate', () => {
  assert.throws(() => buildEditorPlan(brief(undefined, {style: 'paper-collage'}), source, []), /glide-.*grid-glide.*paper-collage/s);
  const plan = buildEditorPlan(brief(), source, []);
  assert.deepEqual(plan.decision.beatDecisions.map((entry) => [entry.family, entry.soundCandidate]),
    [['glide-lines', 'sub-thump'], ['glide-comment', 'sub-thump'], ['glide-follow', 'sub-thump']]);
});

test('the profile handle becomes the faint watermark of the lines and comment scenes that omit one, never of the follow card', () => {
  const plan = buildEditorPlan(brief(), source, []);
  assert.deepEqual(plan.manifest.scenes.map((entry) => entry.data.watermark), [HANDLE, HANDLE, undefined]);
});

test('a plan in Grid Glide that uses the shared comment or follow gets a notice that names the own ending scenes', () => {
  const sharedComment = {id: 'ask', fromSec: 3, toSec: 6, intent: 'comment', data: {keyword: 'Plan', promise: 'We send the question list', caption: 'Comment below'}};
  const sharedFollow = {id: 'more', fromSec: 6, toSec: 9, intent: 'follow', data: {handle: HANDLE, message: 'Follow for more', caption: 'Follow us'}};
  const notice = (plan) => plan.decision.notices.filter((entry) => /glide-comment and glide-follow/.test(entry));
  const shared = buildEditorPlan(brief([hookBeat, sharedComment, sharedFollow]), source, []);
  assert.equal(notice(shared).length, 1, shared.decision.notices.join('|'));
  assert.match(notice(shared)[0], /Grid Glide has its own ending scenes: use glide-comment and glide-follow/);
  assert.match(notice(shared)[0], /fixed English header lines/);
  assert.equal(editManifestSchema.safeParse(shared.manifest).success, true, 'the notice does not block the plan');
  assert.equal(notice(buildEditorPlan(brief([hookBeat, sharedComment]), source, [])).length, 1, 'one is enough to notice');
  assert.equal(notice(buildEditorPlan(brief([hookBeat, sharedFollow]), source, [])).length, 1);
  assert.equal(notice(buildEditorPlan(brief(), source, [])).length, 0, 'the own ending scenes need no notice');
  const elsewhere = buildEditorPlan(brief([{id: 'ask', fromSec: 0, toSec: 3, intent: 'comment', data: sharedComment.data}, {id: 'more', fromSec: 3, toSec: 6, intent: 'follow', data: sharedFollow.data}],
    {style: 'section-deck'}), source, []);
  assert.equal(notice(elsewhere).length, 0, 'other styles keep the shared scenes without a notice');
});

test('a presenter edit ends with the Grid Glide ending scenes and passes the delivery gate', () => {
  const words = [{text: 'شرح', startMs: 0, endMs: 400, confidence: 1}];
  const plan = buildEditorPlan(brief(undefined, {captionsReviewedBy: 'Example review'}), source, words, {delivery: true});
  assert.equal(plan.manifest.purpose, 'delivery');
  assert.deepEqual(endingIssues(plan.manifest), []);
  assert.throws(() => buildEditorPlan(brief([hookBeat, commentBeat(), followBeat({data: {...followBeat().data, handle: '@example'}})], {captionsReviewedBy: 'Example review'}), source, words, {delivery: true}),
    /Delivery ending: The follow card must show the complete profile handle/);
});

/* ------------------------------------------------------------------------------------- cues and sound */

const cueScene = (family, data) => ({id: 'g', family, fromFrame: 100, durationInFrames: 120, layout: 'takeover', motion: 'quiet', data});
const cuesOf = (input, fps) => sceneCues(input, fps).map(({frame, kind}) => [frame, kind]);

test('the follow pill clicks like a chapter pill; the comment scene has no click', () => {
  const data = {handle: HANDLE, heroAt: 24, pill: {label: 'Follow'}, enter: cut, exit: cut};
  assert.deepEqual(cuesOf(cueScene('glide-follow', data)), [[100, 'transition'], [144, 'click']], '24 + 14.75 + 5 = 43.75 rounds to 44');
  assert.deepEqual(cuesOf(cueScene('glide-follow', {...data, pillAt: 30})), [[100, 'transition'], [135, 'click']]);
  assert.deepEqual(cuesOf(cueScene('glide-follow', {...data, pillAt: 30}), 60), [[100, 'transition'], [140, 'click']], 'an explicit pillAt is in edit frames; only the 5 frame offset scales');
  const bare = {...data};
  delete bare.pill;
  assert.deepEqual(cuesOf(cueScene('glide-follow', bare)), [[100, 'transition']], 'no pill, no click');
  assert.deepEqual(cuesOf(cueScene('glide-follow', {...data, pillAt: 118})), [[100, 'transition']], 'a click past the end of the scene is dropped');
  assert.deepEqual(cuesOf(cueScene('glide-comment', {keyword: 'Plan', heroAt: 30, box: {text: 'one two', at: 50}, lines: [lead()], enter: cut, exit: cut})), [[100, 'transition']],
    'the keyword and the promise box are silent');
});

test('the default follow pill start and its click scale with the frame rate, like the chapter pill', () => {
  const heroAt = (fps) => Math.round((24 * fps) / 30);
  for (const fps of [30, 50, 60]) {
    const data = {handle: HANDLE, heroAt: heroAt(fps), pill: {label: 'Follow'}, enter: cut, exit: cut};
    const click = cuesOf(cueScene('glide-follow', data), fps).find(([, kind]) => kind === 'click')[0];
    assert.equal(click, Math.round(100 + pillStart(heroAt(fps), undefined, fps) + (5 * fps) / 30), `${fps} fps mirrors pillStart`);
  }
  assert.deepEqual([30, 50, 60].map((fps) => cuesOf(cueScene('glide-follow', {handle: HANDLE, heroAt: heroAt(fps), pill: {label: 'Follow'}, enter: cut, exit: cut}), fps).at(-1)[0]), [144, 173, 188]);
});

test('a dip entrance stamps the boundary of an ending scene instead of adding a thump', () => {
  assert.deepEqual(cuesOf(cueScene('glide-comment', {enter: dip, exit: cut})), [[100, 'stamp']]);
  assert.deepEqual(cuesOf(cueScene('glide-follow', {enter: dip, exit: cut})), [[100, 'stamp']], 'a follow scene without a pill has no click');
  assert.deepEqual(cuesOf(cueScene('glide-follow', {handle: HANDLE, heroAt: 24, pill: {label: 'Follow'}, enter: dip, exit: cut})), [[100, 'stamp'], [144, 'click']]);
});

/* ----------------------------------------------------------------------------------------------- render */

const renderer = await ssrBundle(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {SafeRoot} from './engine/src/core/safe';
  import {StyleSceneRenderer} from './engine/src/styles/scene-renderers';
  export const render = (scene, style) => renderToStaticMarkup(
    React.createElement(SafeRoot, {}, React.createElement(StyleSceneRenderer, {scene, style})));
`);
const draw = (input, frame, fps = 30, style = 'grid-glide') => { setFrame(frame, {duration: input.durationInFrames, fps}); return renderer.render(input, style); };
const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`);
const ARABIC = /[؀-ۿ]/;
const noArabicTracking = (html) => {
  for (const leaf of leaves(html).filter((item) => ARABIC.test(item.text))) assert.ok(!/letter-spacing/.test(leaf.style), `Arabic text must not be letter-spaced: ${leaf.text}`);
};
const rowStyles = (html) => [...html.matchAll(/data-glide="line" style="([^"]*)"/g)].map((match) => match[1]);
const px = (style, property) => Number.parseFloat(css(style, property));
const fontSize = (html, text) => css(leaves(html).find((leaf) => leaf.text === text)?.style ?? '', 'font-size');

test('the comment scene draws the lead line, the keyword at 150 px with the stack rise, and the promise box', () => {
  const input = comment({watermark: 'example-mark'});
  const html = draw(input, 120);
  assert.ok(html.includes('data-glide-scene="glide-comment"'));
  assert.ok(html.includes('example-mark'), 'the watermark is drawn');
  assert.equal(fontSize(html, 'Plan'), '150px', 'a short keyword takes the full 150 px');
  assert.deepEqual(['Say', 'it', 'below'].map((word) => fontSize(html, word)), ['70px', '70px', '70px']);
  assert.ok(html.includes('data-glide="box"'), 'the promise is a box');
  assert.ok(leaves(html).some((leaf) => leaf.text === 'one clear idea now'));
  // The keyword rises like a chapter ordinal: invisible on its start frame, first visible a frame later, 130 px stack rise.
  assert.equal(wordMotion(draw(input, 30), 'Plan').opacity, 0, 'the start frame shows nothing');
  const first = wordMotion(draw(input, 31), 'Plan');
  near(first.opacity, OUT(1 / 30), 1e-3, 'first visible opacity');
  near(first.y, 98.3, 0.3, 'first visible rise of a 130 px stack');
  near(wordMotion(draw(input, 60), 'Plan').y, 0, 1e-6, 'settled after 30 frames');
  // Rows sit where the layout puts them.
  assert.deepEqual(rowStyles(html).map((style) => px(style, 'top')), [474, 565]);
  assert.ok(!draw(comment({box: undefined}), 120).includes('data-glide="box"'));
});

test('the keyword shrinks to fit and fails loudly below 100 px', () => {
  // The stand-in measures half a font size per character: 14 characters are 7 x size, so 135 px is the largest that fits 950 px.
  assert.equal(fontSize(draw(comment({keyword: 'abcdefghijklmn'}), 120), 'abcdefghijklmn'), '135px');
  // 19 characters need 9.5 x size: 100 px is the floor and 950 px fit exactly.
  assert.equal(fontSize(draw(comment({keyword: 'abcdefghijklmnopqrs'}), 120), 'abcdefghijklmnopqrs'), '100px');
  assert.throws(() => draw(comment({keyword: 'abcdefghijklmnopqrst'}), 120), /glide-1: the keyword "abcdefghijklmnopqrst" needs 1000px at 100px but only 950px are free\. Shorten the keyword\./);
  // A shrunk keyword stays centred in the slot it reserved at 150 px.
  const html = draw(comment({keyword: 'abcdefghijklmn'}), 120);
  const keywordRow = rowStyles(html)[1];
  near(px(keywordRow, 'top') + px(keywordRow, 'height') / 2, 565 + 195 / 2, 1, 'the row is centred in its slot');
});

test('an Arabic keyword is one right-to-left word with no letter spacing', () => {
  const html = draw(comment({keyword: 'خطة', lines: [lead(['اكتب', 'الكلمة'])], box: {text: 'قائمة الأسئلة', at: 55}}), 120);
  assert.ok(leaves(html).some((leaf) => leaf.text === 'خطة'), 'the keyword is not split into characters');
  assert.ok(html.includes('direction:rtl'));
  assert.equal(css(rowStyles(html)[1], 'direction'), 'rtl');
  noArabicTracking(html);
  const mid = draw(comment({keyword: 'خطة', lines: [lead(['اكتب', 'الكلمة'])], box: {text: 'قائمة الأسئلة', at: 55}}), 65);
  assert.match(mid, /clip-path:\s*inset\(0(?:px)? 0(?:px)? 0(?:px)? [\d.]+%\)/, 'the box wipes from the right');
  noArabicTracking(mid);
  const latin = draw(comment(), 120);
  assert.equal(css(rowStyles(latin)[1], 'direction'), 'ltr');
});

test('the follow scene draws the complete handle left to right and a pill with no tile', () => {
  const html = draw(follow({watermark: 'example-mark'}), 85);
  assert.ok(html.includes('data-glide-scene="glide-follow"'));
  const handle = leaves(html).find((leaf) => leaf.text === HANDLE);
  assert.ok(handle, 'the complete handle is one element');
  assert.equal(css(handle.style, 'font-size'), '100px', 'a short handle takes the full 100 px');
  assert.equal(css(rowStyles(html)[1], 'direction'), 'ltr', 'a handle always reads left to right');
  assert.equal(css(rowStyles(html)[1], 'top'), '560px');
  assert.ok(html.includes('data-glide="pill"'));
  assert.ok(leaves(html).some((leaf) => leaf.text === 'Follow'), 'the pill label is drawn');
  assert.equal(html.includes('data-glide="pill-tile"'), false, 'a pill without a logo has no empty tile');
  assert.equal(html.includes('<img'), false);
  const label = /<div data-glide="pill-label" style="([^"]*)">/.exec(html)?.[1] ?? '';
  assert.equal(css(label, 'text-align'), 'center', 'the label is centred on the pill');
  assert.ok(html.includes('example-mark'));
  assert.deepEqual(rowStyles(html).map((style) => px(style, 'top')), [469, 560]);
  // The pill sits where the layout puts it, 755 to 931.
  const pillStyle = /data-glide="pill" style="([^"]*)"/.exec(html)?.[1] ?? '';
  assert.equal(px(pillStyle, 'top'), 755);
  assert.equal(px(pillStyle, 'height'), 176);
});

test('a handle of @ plus 30 characters shrinks to fit and is shown whole', () => {
  const widest = `@${'a'.repeat(30)}`;
  // With the half-size test measurer, 31 characters take 15.5 x size: that fits 950 px up to 61 px. Real fonts measure
  // wider (a 31 character mixed handle fits at about 46 px); only a handle of the widest letters fails, loudly, below 40 px.
  const html = draw(follow({handle: widest}), 85);
  assert.equal(fontSize(html, widest), '61px');
  const row = rowStyles(html)[1];
  near(px(row, 'top') + px(row, 'height') / 2, 560 + 130 / 2, 1, 'the handle row is centred in its slot');
  assert.ok(px(row, 'left') >= BAND.left && px(row, 'left') + px(row, 'width') <= BAND.right, 'the row stays inside the band');
  assert.equal(css(row, 'justify-content'), 'center');
  // With the test measurer the longest handle needs 620 px at 40 px, far inside the 950 px column.
  assert.ok(31 * 0.5 * 40 < 950);
  assert.equal(fontSize(draw(follow({handle: `@${'a'.repeat(14)}`}), 85), `@${'a'.repeat(14)}`), '100px');
});

test('nothing in an ending scene reaches below the rail line or past the rail column', () => {
  for (const input of [comment({watermark: 'example-mark'}), follow({watermark: 'example-mark'}), comment({lines: Array.from({length: 3}, () => ({words: ['one', 'two'], role: 'hero', at: 6, cadence: 7}))}, {durationInFrames: 300})]) {
    const html = draw(input, input.durationInFrames - 1);
    for (const match of html.matchAll(/style="([^"]*)"/g)) {
      const style = match[1];
      if (!/\btop:-?[\d.]+px/.test(style) || !/\bheight:-?[\d.]+px/.test(style) || !/\bleft:-?[\d.]+px/.test(style) || !/\bwidth:-?[\d.]+px/.test(style)) continue;
      const bottom = px(style, 'top') + px(style, 'height'), right = px(style, 'left') + px(style, 'width');
      assert.ok(bottom <= BAND.rail.y || right <= BAND.rail.x, `${input.family}: ${style} reaches below y ${BAND.rail.y} and past x ${BAND.rail.x}`);
      assert.ok(bottom <= BAND.rail.y, `${input.family}: ${style} ends at ${bottom}, inside the rail zone`);
    }
  }
});

test('the ending scenes follow the edit frame rate: the pill and the keyword last twice as many frames at 60 fps', () => {
  const input = follow({heroAt: 48, lines: [lead(['Want', 'more'], 12)]}, {durationInFrames: 180});
  const pillStyle = (frame) => /data-glide="pill" style="([^"]*)"/.exec(draw(input, frame, 60))?.[1];
  // The default pill starts 29.5 frames after the handle (frame 77.5) and fades in 5 frames later.
  assert.equal(css(pillStyle(82), 'opacity'), '0');
  assert.ok(Number(css(pillStyle(83), 'opacity')) > 0);
  const handle = (frame) => wordMotion(draw(input, frame, 60), HANDLE);
  assert.equal(handle(48).opacity, 0, 'the start frame shows nothing');
  near(handle(50).opacity, OUT(1 / 30), 1e-3, 'frame 2 after the start at 60 fps looks like frame 1 at 30 fps');
  assert.ok(handle(107).opacity < 1 && handle(108).opacity === 1, 'a word settles 60 frames after its start');
  const keyword = (frame) => wordMotion(draw(comment({heroAt: 60, lines: [lead(['Say', 'it', 'below'], 12)], box: {text: 'one clear idea now', at: 110}}, {durationInFrames: 240}), frame, 60), 'Plan');
  assert.equal(keyword(60).opacity, 0);
  near(keyword(62).opacity, OUT(1 / 30), 1e-3, 'the keyword uses the same clock');
});

test('an ending scene refuses to render under another style, and the prepared edit dispatches it', async () => {
  assert.throws(() => draw(comment(), 5, 30, 'section-deck'), /belongs to grid-glide, not section-deck/);
  assert.throws(() => draw(follow(), 5, 30, 'section-deck'), /belongs to grid-glide, not section-deck/);
  const layer = await ssrBundle(`
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {SafeRoot} from './engine/src/core/safe';
    import {SceneLayer} from './engine/src/prepared-edit/PreparedEdit';
    export const render = (scene, style) => renderToStaticMarkup(
      React.createElement(SafeRoot, {}, React.createElement(SceneLayer, {scene, style, geometry: {}, aspect: 1.78, seam: 1000})));
  `);
  for (const [input, family] of [[comment(), 'glide-comment'], [follow(), 'glide-follow']]) {
    setFrame(20, {duration: input.durationInFrames});
    assert.ok(layer.render(input, 'grid-glide').includes(`data-glide-scene="${family}"`), family);
  }
});

test('a lead-in line wider than its column fails the render when text can be measured', () => {
  const wide = comment({lines: [{words: ['abcdefgh', 'ijklmnopq'], role: 'hero', at: 0, cadence: 7}]});
  assert.ok(draw(wide, 60), 'Node-only runs skip the measurement');
  globalThis.document = {};
  try {
    assert.throws(() => draw(wide, 60), /glide-1 line 1: "abcdefgh ijklmnopq" is 900px wide at 100px but its safe column is 862px/);
    assert.ok(draw(comment(), 120), 'a line that fits renders');
  } finally {
    delete globalThis.document;
  }
});

test('the templates carry no real handle', () => {
  for (const fps of [30, 60]) {
    const text = JSON.stringify([gridGlideTemplate('glide-comment', fps), gridGlideTemplate('glide-follow', fps)]);
    assert.deepEqual([...text.matchAll(/@[A-Za-z0-9_.]+/g)].map((match) => match[0]), ['@your.handle']);
  }
});
