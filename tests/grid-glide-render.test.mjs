import test from 'node:test';
import assert from 'node:assert/strict';
import {bundleEngine, setSsrFrame} from './helpers/engine-bundle.mjs';
import {STYLE_IDS} from '../engine/src/styles/registry.ts';
import {SLAB} from '../engine/src/creative-kit/card-shape.ts';

const engine = await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import * as scenes from './engine/src/creative-kit/scenes';
  import {SafeRoot} from './engine/src/core/safe';
  import {SceneCanvas, SceneCard, getSceneGeometry, getSceneTheme} from './engine/src/creative-kit/primitives';
  import {contrastRatio, themeContrastIssues} from './engine/src/core/chapters';
  import {iconCornerK, styleShape} from './engine/src/motion-concepts/shared';
  import {isRoundCard} from './engine/src/creative-kit/card-shape';
  import {getGalleryCut, getStyleLayout} from './engine/src/styles/themes';
  import {MessageBoard} from './engine/src/creative-kit/semantic/MessageBoard';
  export {contrastRatio, getGalleryCut, getSceneGeometry, getSceneTheme, getStyleLayout, iconCornerK, isRoundCard, styleShape, themeContrastIssues};
  const html = (node) => renderToStaticMarkup(node);
  export const family = (name, props) => html(React.createElement(scenes[name], props));
  export const card = (style, probe) => html(React.createElement(SafeRoot, {probe},
    React.createElement(SceneCard, {theme: getSceneTheme(style), motion: 'quiet', top: 10, width: 400, height: 200}, React.createElement('span', null, 'inside'))));
  export const canvas = (style, layout) => html(React.createElement(SafeRoot, {},
    React.createElement(SceneCanvas, {theme: getSceneTheme(style), geometry: getSceneGeometry(style, layout)}, React.createElement('span', null, 'inside'))));
  export const board = (style, data, probe) => html(React.createElement(SafeRoot, {probe},
    React.createElement(MessageBoard, {id: 'board', data, theme: getSceneTheme(style), geometry: getSceneGeometry(style, 'takeover')})));
`, {ssr: true});

const THEME = {background: '#F2F2F2', card: '#F9F9F7', border: '#8A8A8A', text: '#242424', dim: '#5A5A5A', accent: '#CCCCCC', accentInk: '#262626',
  onAccent: '#242424', good: '#333333', bad: '#8E8E8E', badInk: '#505050', pill: '#E5E5E5', pillText: '#191919',
  ar: 'Grid Sans', display: 'Grid Sans', mono: 'IBM Plex Mono'};

test('the theme is the flat grey palette in Grid Sans with the bevel-slab grammar', () => {
  const {grammar, ...theme} = engine.getSceneTheme('grid-glide');
  assert.deepEqual(theme, THEME);
  assert.deepEqual(grammar, {typography: 'product-sans', card: 'bevel-slab', annotation: 'inverted-box', composition: 'flat-canvas', caption: 'boxless', motion: 'quiet'});
});

test('every text pair the repository checks reaches 4.5:1, including ink on accent and on the inner screen', () => {
  const theme = engine.getSceneTheme('grid-glide');
  assert.deepEqual(engine.themeContrastIssues(theme, {inkOnAccent: true}), []);
  for (const [ink, ground] of [['text', SLAB.screen], ['dim', SLAB.screen], ['good', SLAB.screen], ['badInk', SLAB.screen], ['accentInk', SLAB.screen], ['text', 'bad']]) {
    const ratio = engine.contrastRatio(theme[ink], theme[ground] ?? ground);
    assert.ok(ratio >= 4.5, `${ink} on ${ground} is ${ratio.toFixed(2)}:1`);
  }
  for (const ground of ['background', 'card']) {
    assert.ok(engine.contrastRatio(theme.border, theme[ground]) >= 3, `border lines on ${ground} reach 3:1`);
  }
});

test('geometry, layout and gallery cut match the adapted layout', () => {
  assert.deepEqual(engine.getStyleLayout('grid-glide'), {kind: 'adapted', seam: 1080, caption: 1300, title: 142, body: 212, titleTop: 40});
  assert.equal(engine.getGalleryCut('grid-glide'), 'none');
  assert.deepEqual(engine.getSceneGeometry('grid-glide', 'takeover'), {left: 109, top: 293, width: 700, height: 889, titleHeight: 142, bodyTop: 212,
    bodyHeight: 677, captionCenter: 1300, canvasHeight: 1920, compact: false, titleTop: 40});
  assert.deepEqual(engine.getSceneGeometry('grid-glide', 'split'), {left: 109, top: 293, width: 862, height: 669, titleHeight: 142, bodyTop: 212,
    bodyHeight: 457, captionCenter: 1080, canvasHeight: 1080, compact: false, titleTop: 40});
});

test('every classic family renders in Grid Glide in both layouts without throwing', () => {
  setSsrFrame(0);
  for (const name of ['IntroScene', 'ProofScene', 'ProcessScene', 'ComparisonScene', 'CommentGateScene', 'FollowScene']) {
    for (const layout of ['takeover', 'split']) {
      let html;
      assert.doesNotThrow(() => { html = engine.family(name, {style: 'grid-glide', layout, showCaption: true}); }, `${name} ${layout}`);
      assert.match(html, /font-family:Grid Sans/, `${name} ${layout} uses the style's family`);
      assert.doesNotMatch(html, /font-family:(Cairo|Plex Display|Tajawal)/, `${name} ${layout} keeps no other family`);
      assert.match(html, /background:#F2F2F2/, `${name} ${layout} paints the flat canvas`);
    }
  }
});

test('the canvas is flat: no decorative layer and no gradient, while other compositions keep theirs', () => {
  for (const layout of ['takeover', 'split']) {
    const html = engine.canvas('grid-glide', layout);
    assert.match(html, /background:#F2F2F2/);
    assert.doesNotMatch(html, /gradient/);
  }
  assert.match(engine.canvas('liquid-glass', 'takeover'), /radial-gradient/);
});

test('the bevel slab draws its material and a probe render leaves out every shadow', () => {
  const lit = engine.card('grid-glide');
  assert.ok(lit.includes('inset 0 1px 0 0 #fefefe'), 'stacked bevel');
  assert.ok(lit.includes('rgba(0,0,0,.255)') && lit.includes('rgba(0,0,0,.163)'), 'two-layer drop shadow');
  assert.ok(lit.includes('border-radius:24px'), 'slab corners');
  assert.ok(lit.includes('border-radius:15px') && lit.includes('inset:9px') && lit.includes('background:#FFFFFF'), 'inset screen behind the content');
  assert.ok(lit.includes('inside'), 'children stay in the card');
  const probed = engine.card('grid-glide', '#00FF00');
  assert.ok(!probed.includes('box-shadow'), 'shadows would leak outside the safe band');
  assert.ok(probed.includes('border-radius:24px'));
  assert.ok(!engine.card('kinetic-paper').includes('border-radius:15px'), 'other card grammars are untouched');
});

test('the message board uses slab corners and a soft shadow, and leaves other styles alone', () => {
  const data = {initialTitle: 'Several supplied messages', boardTitle: 'One organised board', focusTitle: 'Focus on this result', closingTitle: 'Review the useful next step',
    items: [{id: 'brief', label: 'The brief', detail: 'A supplied question'}, {id: 'plan', label: 'The plan', detail: 'A supplied step'}, {id: 'result', label: 'The result', detail: 'A supplied conclusion'}],
    focusIndex: 2, gatherFrame: 90, gatherDurationFrames: 90, focusFrame: 300, focusDurationFrames: 90, closingFrame: 480};
  setSsrFrame(200);
  try {
    const slab = engine.board('grid-glide', data);
    assert.ok(slab.includes('border-radius:24px') && slab.includes('rgba(0,0,0,.22)'));
    assert.ok(!engine.board('grid-glide', data, '#00FF00').includes('box-shadow'));
    const glass = engine.board('liquid-glass', data);
    assert.ok(glass.includes('border-radius:18px') && glass.includes('5px 7px 0'));
  } finally {
    setSsrFrame(0);
  }
});

const oldRound = (theme) => !theme.grammar || theme.grammar.card === 'rounded-ui';
const oldCorner = (theme) => (theme.grammar?.card === 'rounded-ui' || theme.grammar === undefined ? 0.26 : 0.08);
const oldShape = (theme) => {
  switch (theme.grammar?.card) {
    case 'ink-frame': return {pillK: 0.16, windowRadius: 0, ring: 3, hardOffset: 7, soft: false};
    case 'offset-plate': return {pillK: 0, windowRadius: 0, ring: 2, hardOffset: 7, soft: false};
    case 'receipt-sheet': return {pillK: 0.1, windowRadius: 4, ring: 2, hardOffset: 0, soft: false};
    case 'taped-paper': return {pillK: 0.06, windowRadius: 2, ring: 2, hardOffset: 5, soft: false};
    case 'verdict-board': return {pillK: 0.08, windowRadius: 4, ring: 2, hardOffset: 0, soft: false};
    default: return {pillK: 1, windowRadius: 36, ring: 2, hardOffset: 0, soft: true};
  }
};

test('the shape helpers keep their answers for the eleven earlier styles and give Grid Glide the slab register', () => {
  for (const id of STYLE_IDS.filter((style) => style !== 'grid-glide')) {
    const theme = engine.getSceneTheme(id);
    assert.equal(engine.isRoundCard(theme), oldRound(theme), `${id} round`);
    assert.equal(engine.iconCornerK(theme), oldCorner(theme), `${id} icon corner`);
    assert.deepEqual(engine.styleShape(theme), oldShape(theme), `${id} concept shape`);
  }
  const slab = engine.getSceneTheme('grid-glide');
  assert.equal(engine.isRoundCard(slab), true);
  assert.equal(engine.iconCornerK(slab), 0.125);
  assert.deepEqual(engine.styleShape(slab), {pillK: 0.3, windowRadius: 24, ring: 2, hardOffset: 0, soft: true});
});
