import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameRenderer} from '../scripts/lib/ssr-frames.mjs';
import {editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {STYLE_IDS} from '../engine/src/styles/registry.ts';
import {CAPTION_PRESENTATION} from '../engine/src/core/preference-options.ts';
import {contrastRatio} from '../engine/src/core/chapters.ts';
import {BLUEPRINT, CAPTION_MIN_CONTRAST, DEFAULT_RISO_INKS, RISO_PAPER, lookCaptionGuard, risoCaptionInk} from '../engine/src/looks/index.ts';
import {reviewManifest} from './helpers/review-manifest.mjs';

const renderer = await createFrameRenderer();
const WORDS = ['فكرتك', 'تستاهل', 'تتشاف', 'بوضوح', 'وبسهولة', 'وبدون', 'تعقيد', 'رتب'];

function edit(style, presentation, look) {
  const m = reviewManifest('look-captions');
  m.style = style;
  m.captions.presentation = presentation;
  m.captions.words = WORDS.map((text, i) => ({text, startMs: i * 400, endMs: i * 400 + 350, confidence: 1}));
  if (look) m.look = look;
  return editManifestSchema.parse(m);
}
const markup = (manifest) => renderer.renderCaptions({edit: manifest, frame: 20});
const styleOf = (html) => /style="([^"]*)"/.exec(html)?.[1] ?? '';
const prop = (style, name) => new RegExp(`(?:^|;)${name}:([^;]+)`).exec(style)?.[1];

test('the caption guard only backs a caption that has no backing, and always with a readable pair', () => {
  assert.equal(lookCaptionGuard(undefined, 'transparent'), null, 'no look, no guard');
  assert.equal(lookCaptionGuard({kind: 'riso'}, '#ffffff'), null, 'an opaque backing is left alone');
  assert.equal(lookCaptionGuard({kind: 'blueprint'}, '#102027'), null);
  const blueprint = lookCaptionGuard({kind: 'blueprint'}, 'transparent');
  assert.deepEqual(blueprint, {background: BLUEPRINT.paper, wordColor: BLUEPRINT.line});
  assert.ok(contrastRatio(blueprint.background, blueprint.wordColor) >= 9);
  const riso = lookCaptionGuard({kind: 'riso'}, 'transparent');
  assert.equal(riso.background, RISO_PAPER);
  assert.ok(contrastRatio(riso.background, riso.wordColor) >= 7);
  for (const inks of [DEFAULT_RISO_INKS, ['#111111', '#d02020'], ['#ffe800', '#0078bf'], ['#00838a', '#ff6c2f'], ['#4a2c82', '#ffb511']]) {
    const ink = risoCaptionInk(inks);
    assert.ok(contrastRatio(ink, RISO_PAPER) >= 7, `${inks}: ${ink}`);
  }
});

test('under every look, every style and every caption shape, a caption sits on a readable backing and untouched captions are byte-identical', () => {
  const looks = [{kind: 'riso'}, {kind: 'riso', inks: ['#1b2a6b', '#e8452c']}, {kind: 'blueprint'}];
  let guarded = 0, untouched = 0;
  const genericStyles = new Set();
  for (const style of STYLE_IDS) {
    for (const presentation of CAPTION_PRESENTATION) {
      const plain = markup(edit(style, presentation));
      const plainStyle = styleOf(plain);
      if (prop(plainStyle, 'background') !== undefined) genericStyles.add(style);
      assert.ok(plain.length > 200, `${style} ${presentation} draws a caption`);
      for (const look of looks) {
        const withLook = markup(edit(style, presentation, look));
        if (prop(plainStyle, 'background') === 'transparent') {
          const s = styleOf(withLook);
          const background = prop(s, 'background'), color = prop(s, 'color');
          assert.match(background, /^#[0-9a-f]{6}$/i, `${style} ${presentation} ${look.kind}: the caption gets a backing`);
          assert.ok(contrastRatio(background, color) >= CAPTION_MIN_CONTRAST, `${style} ${presentation} ${look.kind}: ${color} on ${background}`);
          assert.equal(prop(s, 'text-shadow'), undefined, 'the backing replaces the outline');
          assert.match(prop(s, 'box-shadow'), /00000020/, 'and carries the chip shadow');
          guarded++;
        } else {
          assert.equal(withLook, plain, `${style} ${presentation} ${look.kind}: a caption with its own backing is not changed by the look`);
          untouched++;
        }
      }
    }
  }
  assert.ok(guarded >= looks.length * genericStyles.size, `${guarded} guarded combinations (minimal for every generic caption track; style-owned page designs keep their own contract)`);
  assert.ok(untouched > 0);
});

test('the words, their order and their digits are the same with and without a look', () => {
  const text = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  for (const look of [undefined, {kind: 'riso'}, {kind: 'blueprint'}]) {
    assert.equal(text(markup(edit('section-deck', 'minimal', look))), text(markup(edit('section-deck', 'minimal'))));
  }
});
