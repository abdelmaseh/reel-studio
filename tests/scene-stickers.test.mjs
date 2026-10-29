import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {editSceneSchema, editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {figuresDataSchema} from '../engine/src/creative-kit/figures/schema.ts';
import {chatThreadDataSchema} from '../engine/src/creative-kit/chat-thread/schema.ts';
import {arabicTypeDataSchema} from '../engine/src/arabic-type/schema.ts';
import {MONOCHROME_STICKER_SOURCES, SCENE_STICKER_SPOTS, STICKERS, isLightInk, sceneStickerSchema, stickerSchema} from '../engine/src/creative-kit/stickers.ts';
import {bundleEngine, setSsrFps, setSsrFrame} from './helpers/engine-bundle.mjs';

// Scene stickers: the optional `sticker` of the figures, chat-thread and arabic-type data. `at` is a scene-local FRAME (like every other cue in
// these scenes), not seconds; the sticker table and its seconds-based `stickerSchema` stay for other hosts.

const LOTTIE = {kind: 'lottie', id: 'checkmark'};
const ANIMATED_EMOJI = {kind: 'emoji', id: 'fire'};
const STILL_EMOJI = {kind: 'emoji', id: 'money-bag'};
const MARKER = {
  lottie: /data-lottie-icon="stickers\/icons\/checkmark\.json"/,
  'animated emoji': /data-lottie-icon="stickers\/emoji\/animated\/fire\.json"/,
  'emoji still': /<img[^>]+src="\/?stickers\/emoji\/still\/money-bag\.svg"/,
};
const KINDS = [['lottie', LOTTIE], ['animated emoji', ANIMATED_EMOJI], ['emoji still', STILL_EMOJI]];

const scene = (family, data, durationInFrames = 180) => ({id: `sticker-${family}`, family, layout: 'takeover', motion: 'land', fromFrame: 0, durationInFrames, data});
const DATA = {
  figures: (sticker) => ({variant: 'counter', value: 42, label: 'عدد الطلبات', ...(sticker ? {sticker} : {})}),
  'chat-thread': (sticker) => ({variant: 'bubbles', title: 'محادثة', messages: [{from: 'them', text: 'سؤال', at: 20}, {from: 'me', text: 'رد', at: 60}], ...(sticker ? {sticker} : {})}),
  'arabic-type': (sticker) => ({text: 'فكرة واضحة', move: 'decrypt', ...(sticker ? {sticker} : {})}),
};
const FAMILIES = Object.keys(DATA);
const make = (family, sticker, durationInFrames) => scene(family, DATA[family](sticker), durationInFrames);
const manifest = (s) => ({version: 1, id: 'sticker-test', purpose: 'test', style: 'section-deck', source: {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: s.durationInFrames}, segments: [{fromFrame: 0, toFrame: s.durationInFrames}], captions: {status: 'draft', words: []}, scenes: [s], sounds: [], camera: []});
const messages = (result) => result.error.issues.map((issue) => issue.message).join(' | ');

test('the scene sticker takes a kind, a known id and an optional start FRAME, and nothing else', () => {
  assert.deepEqual(sceneStickerSchema.parse(LOTTIE), LOTTIE);
  assert.deepEqual(sceneStickerSchema.parse({...ANIMATED_EMOJI, at: 45}), {...ANIMATED_EMOJI, at: 45});
  assert.deepEqual(sceneStickerSchema.parse({...STILL_EMOJI, at: 0}), {...STILL_EMOJI, at: 0});
  for (const at of [1.5, -1, 4320001, '10']) assert.throws(() => sceneStickerSchema.parse({...LOTTIE, at}), undefined, `at ${at}`);
  const refusal = (value) => { const result = sceneStickerSchema.safeParse(value); assert.equal(result.success, false); return messages(result); };
  assert.match(refusal({kind: 'lottie', id: 'fire'}), /^Unknown lottie sticker "fire"\. Choose one of: checkmark, /);
  assert.match(refusal({kind: 'emoji', id: 'nope'}), /^Unknown emoji sticker "nope"\. Choose one of: fire, /);
  assert.throws(() => sceneStickerSchema.parse({kind: 'gif', id: 'fire'}));
  assert.throws(() => sceneStickerSchema.parse({...LOTTIE, src: 'https://example.com/x.json'}), 'no free-form sources');
  // The seconds-based schema other hosts use is untouched.
  assert.deepEqual(stickerSchema.parse({...ANIMATED_EMOJI, at: 1.5}), {...ANIMATED_EMOJI, at: 1.5});
});

for (const family of FAMILIES) {
  test(`${family} accepts a lottie icon, an animated emoji and an emoji still, and keeps them in the parsed data`, () => {
    for (const [, sticker] of KINDS) {
      const result = editSceneSchema.safeParse(make(family, sticker));
      assert.equal(result.success, true, `${family} ${JSON.stringify(sticker)}: ${result.success ? '' : messages(result)}`);
      assert.deepEqual(result.data.data.sticker, sticker);
    }
    const timed = editSceneSchema.safeParse(make(family, {...LOTTIE, at: 30}));
    assert.equal(timed.success, true);
    assert.equal(timed.data.data.sticker.at, 30);
    assert.equal(editSceneSchema.safeParse(make(family)).success, true, 'the sticker stays optional');
  });

  test(`${family} refuses an unknown sticker id and lists the valid ones`, () => {
    const result = editSceneSchema.safeParse(make(family, {kind: 'lottie', id: 'nope'}));
    assert.equal(result.success, false);
    assert.match(messages(result), /Unknown lottie sticker "nope"\. Choose one of: checkmark, check-circle, /);
    const wrongKind = editSceneSchema.safeParse(make(family, {kind: 'lottie', id: 'fire'}));
    assert.equal(wrongKind.success, false, 'an emoji id is not a lottie icon');
  });

  test(`${family} keeps strict data: unknown keys are refused inside the sticker and beside it`, () => {
    assert.equal(editSceneSchema.safeParse(make(family, {...LOTTIE, src: 'x.json'})).success, false, 'sticker key');
    assert.equal(editSceneSchema.safeParse(make(family, {...LOTTIE, size: 400})).success, false, 'sticker size key');
    const beside = make(family, LOTTIE);
    beside.data.bogus = 1;
    assert.equal(editSceneSchema.safeParse(beside).success, false, 'data key beside the sticker');
  });

  test(`${family} counts the sticker start in scene frames, not seconds`, () => {
    for (const at of [1.5, -1]) assert.equal(editSceneSchema.safeParse(make(family, {...LOTTIE, at})).success, false, `at ${at}`);
    assert.equal(editSceneSchema.safeParse(make(family, {...LOTTIE, at: 0})).success, true);
    assert.equal(editSceneSchema.safeParse(make(family, {...LOTTIE, at: 179})).success, true, 'the last frame of a 180 frame scene');
  });

  test(`${family} refuses a sticker that starts at or after the end of its scene`, () => {
    for (const at of [180, 181, 500]) {
      const result = editSceneSchema.safeParse(make(family, {...LOTTIE, at}));
      assert.equal(result.success, false, `at ${at}`);
      assert.match(messages(result), new RegExp(`sticker.*frame ${at}.*180 frames`), messages(result));
    }
    const short = editSceneSchema.safeParse(make(family, {...LOTTIE, at: 60}, 60));
    assert.equal(short.success, false);
    assert.match(messages(short), /60 frames/);
    assert.equal(editSceneSchema.safeParse(make(family, {...LOTTIE, at: 59}, 90)).success, true);
    const edit = manifest(make(family, {...LOTTIE, at: 180}));
    assert.equal(editManifestSchema.safeParse(edit).success, false, 'the whole edit is refused too');
    assert.equal(editManifestSchema.safeParse(manifest(make(family, {...LOTTIE, at: 120}))).success, true);
  });
}

test('every figures variant, the chat-thread variants and an arabic-type move take a sticker in their data schema', () => {
  for (const data of [{variant: 'counter', value: 42}, {variant: 'slot', value: 123}, {variant: 'bars', bars: [{label: 'أ', value: 4}]}, {variant: 'ring', value: 42, max: 100}]) {
    assert.equal(figuresDataSchema.safeParse({...data, sticker: STILL_EMOJI}).success, true, data.variant);
    assert.equal(figuresDataSchema.safeParse({...data, sticker: {kind: 'lottie', id: 'nope'}}).success, false, data.variant);
  }
  for (const variant of ['bubbles', 'typing', 'notifications']) {
    const data = {variant, messages: [{from: 'them', text: 'رسالة'}]};
    assert.equal(chatThreadDataSchema.safeParse({...data, sticker: ANIMATED_EMOJI}).success, true, variant);
    assert.equal(chatThreadDataSchema.safeParse({...data, sticker: {...ANIMATED_EMOJI, at: 2.5}}).success, false, variant);
  }
  assert.equal(arabicTypeDataSchema.safeParse({text: 'فكرة', move: 'decrypt', sticker: LOTTIE}).success, true);
  assert.equal(arabicTypeDataSchema.safeParse({text: 'فكرة', move: 'word-melt', to: 'خطوة', sticker: LOTTIE}).success, true);
  assert.equal(arabicTypeDataSchema.safeParse({text: 'فكرة', move: 'word-melt', sticker: LOTTIE}).success, false, 'the other arabic-type rules still apply');
});

test('each family has one fixed sticker spot: 140 to 180 px, inside every safe-zone profile and clear of the rail', () => {
  const spec = JSON.parse(readFileSync(fileURLToPath(new URL('../engine/src/core/platform/instagram-reels.json', import.meta.url)), 'utf8'));
  assert.deepEqual(Object.keys(SCENE_STICKER_SPOTS).sort(), [...FAMILIES].sort());
  for (const [family, spot] of Object.entries(SCENE_STICKER_SPOTS)) {
    assert.ok(spot.size >= 140 && spot.size <= 180, `${family} size ${spot.size}`);
    for (const [id, zone] of Object.entries(spec.profiles)) {
      assert.ok(spot.left >= zone.left && spot.left + spot.size <= zone.right, `${family} fits ${id} horizontally`);
      assert.ok(spot.top >= zone.top && spot.top + spot.size <= zone.bottom, `${family} fits ${id} vertically`);
      if (zone.rail) assert.ok(spot.left + spot.size <= zone.rail.x || spot.top + spot.size <= zone.rail.y, `${family} stays out of the ${id} rail`);
    }
  }
});

// Render level: the real scene views, bundled for plain Node with the deterministic text metric and a stand-in for lottie-web.
const view = await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {SafeRoot} from './engine/src/core/safe';
  import {StickerView, SceneStickerSlot} from './engine/src/creative-kit/sticker-view';
  import {FiguresSceneView} from './engine/src/creative-kit/figures/scene';
  import {ChatThreadSceneView} from './engine/src/creative-kit/chat-thread/scene';
  import {ArabicTypeSceneView} from './engine/src/arabic-type/scene';
  export const sticker = (props) => renderToStaticMarkup(React.createElement(StickerView, props));
  export const slot = (props) => renderToStaticMarkup(React.createElement(SceneStickerSlot, props));
  export const slotProbe = (props) => renderToStaticMarkup(React.createElement(SafeRoot, {probe: '#00FF00'}, React.createElement(SceneStickerSlot, props)));
  export const figures = (scene, style = 'section-deck') => renderToStaticMarkup(React.createElement(FiguresSceneView, {scene, style}));
  export const chat = (scene, style = 'section-deck') => renderToStaticMarkup(React.createElement(ChatThreadSceneView, {scene, style}));
  export const arabic = (scene, style = 'section-deck') => renderToStaticMarkup(React.createElement(ArabicTypeSceneView, {scene, style}));
  export const arabicProbe = (scene) => renderToStaticMarkup(React.createElement(SafeRoot, {probe: '#00FF00'}, React.createElement(ArabicTypeSceneView, {scene})));
`, {ssr: true, media: true, plateStub: true});
const VIEW = {figures: view.figures, 'chat-thread': view.chat, 'arabic-type': view.arabic};
const render = (family, input, frame, style) => {
  setSsrFps(30);
  setSsrFrame(frame);
  try { return VIEW[family](input, style); } finally { setSsrFrame(0); }
};
// A still renders as <img>, which React hoists with a preload link; the slot itself is the div around the sticker.
const SLOT = /<div data-scene-sticker="[^"]*"[^>]*>(?:<div[^>]*><\/div>|<img[^>]*\/?>)<\/div>/;
const withoutSlot = (html) => html.replace(SLOT, '').replace(/<link rel="preload"[^>]*\/>/g, '');
const slotStyle = (html) => {
  const match = /<div data-scene-sticker="([^"]*)" style="([^"]*)"/.exec(html);
  assert.ok(match, 'the sticker slot is drawn');
  const px = (name) => Number(new RegExp(`${name}:(-?[\\d.]+)px`).exec(match[2])?.[1]);
  return {host: match[1], left: px('left'), top: px('top'), width: px('width'), height: px('height'), position: /position:absolute/.test(match[2])};
};

for (const family of FAMILIES) {
  test(`${family} draws its sticker in the fixed spot from its start frame, and not before`, () => {
    const spot = SCENE_STICKER_SPOTS[family];
    for (const [name, sticker] of KINDS) {
      const input = editSceneSchema.parse(make(family, {...sticker, at: 20}));
      assert.doesNotMatch(render(family, input, 19), MARKER[name], `${name} hidden at frame 19`);
      assert.match(render(family, input, 20), MARKER[name], `${name} drawn at frame 20 (its start frame)`);
      assert.match(render(family, input, 179), MARKER[name], `${name} still drawn at the last frame`);
      assert.equal(render(family, input, 60), render(family, input, 60), 'deterministic');
      assert.deepEqual(slotStyle(render(family, input, 60)), {host: family, left: spot.left, top: spot.top, width: spot.size, height: spot.size, position: true});
    }
    assert.match(render(family, editSceneSchema.parse(make(family, LOTTIE)), 0), MARKER.lottie, 'no `at` means from the scene start');
  });

  test(`${family} without a sticker renders exactly what it did before, and the sticker adds only its own slot`, () => {
    for (const frame of [0, 45, 100, 179]) {
      const plain = render(family, editSceneSchema.parse(make(family)), frame);
      assert.doesNotMatch(plain, /data-scene-sticker|data-lottie-icon|stickers\//);
      for (const [name, sticker] of KINDS) {
        const withSticker = render(family, editSceneSchema.parse(make(family, sticker)), frame);
        assert.match(withSticker, SLOT, `${name} slot at frame ${frame}`);
        assert.equal(withoutSlot(withSticker), plain, `${family} ${name} frame ${frame}: only the slot is added`);
      }
    }
  });
}

// figures and chat-thread are plain positioned boxes, so the geometry can be read back from the markup. arabic-type draws on a canvas;
// its placement is checked on real stills instead.
for (const family of ['figures', 'chat-thread']) {
  test(`${family} keeps its sticker clear of every authored text box in all its variants`, () => {
    const spot = SCENE_STICKER_SPOTS[family];
    const variants = family === 'figures'
      ? [{variant: 'counter', value: 42, label: 'عدد الطلبات', unit: 'طلب'}, {variant: 'slot', value: 123456789, label: 'عدد', unit: 'طلب'}, {variant: 'bars', bars: Array.from({length: 6}, (_, i) => ({label: `أ${i}`, value: i + 1})), label: 'مقارنة', unit: 'وحدة'}, {variant: 'ring', value: 42, max: 100, label: 'نسبة', unit: 'بالمئة'}]
      : ['bubbles', 'typing', 'notifications'].map((variant) => ({variant, app: 'تطبيق', title: 'محادثة طويلة العنوان قليلا', messages: Array.from({length: 6}, (_, i) => ({from: i % 2 ? 'me' : 'them', text: `رسالة رقم ${i} فيها كلام`, at: 10 + i * 20}))}));
    for (const data of variants) {
      const input = editSceneSchema.parse({...make(family), data: {...data, sticker: LOTTIE}});
      for (const frame of [30, 179]) {
        const html = render(family, input, frame);
        const boxes = [...html.matchAll(/position:absolute;left:(-?[\d.]+)px;top:(-?[\d.]+)px;width:([\d.]+)px(?:;height:([\d.]+)px)?/g)];
        assert.ok(boxes.length > 1, `${data.variant}: found the authored boxes`);
        for (const [, left, top, width, height] of boxes) {
          if (Number(left) === spot.left && Number(top) === spot.top && Number(width) === spot.size) continue;
          const overlapsX = Number(left) < spot.left + spot.size && Number(left) + Number(width) > spot.left;
          const overlapsY = Number(top) < spot.top + spot.size && Number(top) + (height === undefined ? 0 : Number(height)) > spot.top;
          assert.ok(!(overlapsX && overlapsY), `${family}/${data.variant} frame ${frame}: box ${left},${top} ${width}x${height ?? '?'} overlaps the sticker spot`);
        }
      }
    }
  });
}

test('StickerView takes a start FRAME that wins over the seconds in `at`, so a scene sticker first shows exactly on its frame', () => {
  const still = {kind: 'emoji', id: 'money-bag'};
  const at = (frame, props) => { setSsrFps(30); setSsrFrame(frame); try { return view.sticker({size: 90, ...props}); } finally { setSsrFrame(0); } };
  assert.doesNotMatch(at(19, {sticker: still, startFrame: 20}), /<img/);
  assert.match(at(20, {sticker: still, startFrame: 20}), /<img/);
  assert.match(at(10, {sticker: {...still, at: 5}, startFrame: 10}), /<img/, 'startFrame beats the seconds in `at`');
  assert.match(at(0, {sticker: {...still, at: 5}, startFrame: 0}), /<img/, 'an explicit frame 0 is not replaced by the seconds');
  assert.doesNotMatch(at(0, {sticker: {...still, at: 5}}), /<img/, 'without startFrame the seconds still apply');
  assert.match(at(150, {sticker: {...still, at: 5}}), /<img/);
});

test('the scene sticker slot draws nothing without a sticker and stays visible to the safe-zone probe with one', () => {
  setSsrFps(30);
  setSsrFrame(0);
  assert.equal(view.slot({host: 'figures'}), '');
  assert.doesNotMatch(view.slotProbe({host: 'figures'}), /data-scene-sticker/);
  assert.match(view.slotProbe({host: 'figures', sticker: LOTTIE}), /data-lottie-icon="stickers\/icons\/checkmark\.json"/, 'content, not decoration: the probe measures it');
  assert.match(view.slotProbe({host: 'chat-thread', sticker: STILL_EMOJI}), /<img/);
  setSsrFrame(19);
  assert.doesNotMatch(view.slotProbe({host: 'figures', sticker: {...LOTTIE, at: 20}}), /data-lottie-icon/);
  setSsrFrame(20);
  assert.match(view.slotProbe({host: 'figures', sticker: {...LOTTIE, at: 20}}), /data-lottie-icon/);
  setSsrFrame(0);
});

test('arabic-type puts the sticker in its spot over every move and the probe sees it', () => {
  // kashida-stretch takes exactly one word (arabic-type/schema.ts).
  const extras = {'word-melt': {to: 'ثقة'}, 'redacted-stamp': {stamp: 'مثال'}, 'video-in-letters': {media: 'projects/test/clip.mp4'}, 'kashida-stretch': {text: 'فكرة'}};
  for (const move of ['decrypt', 'echo-stack', 'redacted-stamp', 'unblur', 'word-melt', 'pen-write', 'video-in-letters', 'dots-drop', 'letters-snap', 'kufi-tiles', 'kashida-stretch']) {
    const data = (sticker) => ({text: 'فكرة واضحة', move, ...extras[move], ...(sticker ? {sticker} : {})});
    const plain = render('arabic-type', scene('arabic-type', data(), 240), 120);
    assert.doesNotMatch(plain, /data-scene-sticker|data-lottie-icon/, move);
    for (const [name, sticker] of KINDS) {
      const input = scene('arabic-type', data({...sticker, at: 20}), 240);
      assert.doesNotMatch(render('arabic-type', input, 19), MARKER[name], `${move} ${name} hidden at 19`);
      assert.match(render('arabic-type', input, 20), MARKER[name], `${move} ${name} drawn at 20`);
      assert.equal(withoutSlot(render('arabic-type', input, 120)), plain, `${move} ${name}: only the slot is added`);
      setSsrFrame(120);
      assert.match(view.arabicProbe(input), MARKER[name], `${move} ${name} is measured by the safe-zone probe`);
      setSsrFrame(0);
    }
  }
});

test('the editor form lists the sticker as an optional object with Arabic labels and a frame field, and validates it', async () => {
  const {fieldsForFamily, validateData} = await import('../engine/src/review-editor/panels/form-schema.ts');
  const find = (fields, key) => {
    for (const field of fields) {
      if (field.key === key) return field;
      const inner = field.kind === 'object' ? find(field.fields, key) : field.kind === 'union' ? field.variants.map((variant) => find(variant.field.fields, key)).find(Boolean) : undefined;
      if (inner) return inner;
    }
    return undefined;
  };
  for (const family of FAMILIES) {
    const sticker = find(fieldsForFamily(family), 'sticker');
    assert.ok(sticker, `${family} has a sticker field`);
    assert.equal(sticker.kind, 'object');
    assert.equal(sticker.required, false, 'optional');
    assert.deepEqual(sticker.fields.map((field) => [field.key, field.label]), [['kind', 'نوع الملصق'], ['id', 'الملصق'], ['at', 'يظهر عند فريم']]);
    const at = sticker.fields.find((field) => field.key === 'at');
    assert.equal(at.isFrame, true, 'the start is a frame field like the other cues');
    assert.equal(at.integer, true);
    assert.equal(sticker.label, 'ملصق');
  }
  assert.equal(validateData('figures', {variant: 'counter', value: 1, sticker: {kind: 'lottie', id: 'checkmark', at: 12}}).ok, true);
  assert.equal(validateData('chat-thread', {variant: 'bubbles', messages: [{from: 'me', text: 'رسالة'}], sticker: {kind: 'emoji', id: 'nope'}}).ok, false);
  assert.equal(validateData('arabic-type', {text: 'فكرة', move: 'decrypt', sticker: {kind: 'emoji', id: 'fire', at: 1.5}}).ok, false);
});

test('isLightInk tells light text (a dark scene) from dark text, and treats anything that is not #rrggbb as dark', () => {
  for (const light of ['#FFFFFF', '#F5F3EC', '#fff4e5', '#F8F2E8']) assert.equal(isLightInk(light), true, light);
  for (const dark of ['#000000', '#15231F', '#2E2019', '#0E1117', 'white', 'rgb(255,255,255)', '#FFF', undefined]) assert.equal(isLightInk(dark), false, String(dark));
  assert.deepEqual([...MONOCHROME_STICKER_SOURCES], ['useanimations']);
  assert.ok(STICKERS.filter((sticker) => sticker.kind === 'lottie' && MONOCHROME_STICKER_SOURCES.includes(sticker.source)).length >= 15);
});

test('black useAnimations icons are shown in white on a dark scene and untouched on a light one; colour stickers never change', () => {
  setSsrFps(30);
  setSsrFrame(0);
  const props = (sticker, extra) => ({sticker, size: 90, ...extra});
  assert.match(view.sticker(props({kind: 'lottie', id: 'checkmark'}, {onDark: true})), /filter:invert\(1\)/);
  assert.doesNotMatch(view.sticker(props({kind: 'lottie', id: 'checkmark'})), /filter/);
  assert.doesNotMatch(view.sticker(props({kind: 'lottie', id: 'weather-clear-day'}, {onDark: true})), /filter/, 'Meteocons are colour icons');
  assert.doesNotMatch(view.sticker(props(ANIMATED_EMOJI, {onDark: true})), /filter/);
  assert.doesNotMatch(view.sticker(props(STILL_EMOJI, {onDark: true})), /filter/);
  assert.match(view.slot({host: 'figures', sticker: LOTTIE, ink: '#FFFFFF'}), /filter:invert\(1\)/);
  assert.doesNotMatch(view.slot({host: 'figures', sticker: LOTTIE, ink: '#15231F'}), /filter/);
  assert.doesNotMatch(view.slot({host: 'figures', sticker: LOTTIE}), /filter/, 'no ink means no tone');
  // Through the real scene views: section-deck is a dark style, kinetic-paper a light one.
  for (const family of FAMILIES) {
    const input = editSceneSchema.parse(make(family, LOTTIE));
    assert.match(render(family, input, 60, 'section-deck'), /data-lottie-icon="stickers\/icons\/checkmark\.json"[^>]*filter:invert\(1\)/, `${family} on a dark style`);
    const light = render(family, editSceneSchema.parse(make(family, LOTTIE)), 60, 'kinetic-paper');
    assert.match(light, /data-lottie-icon/, `${family} on a light style`);
    assert.doesNotMatch(light, /filter:invert/, `${family} on a light style`);
    assert.doesNotMatch(render(family, editSceneSchema.parse(make(family, ANIMATED_EMOJI)), 60, 'section-deck'), /filter:invert/, `${family} emoji`);
  }
});
