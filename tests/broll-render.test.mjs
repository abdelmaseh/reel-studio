import test from 'node:test';
import assert from 'node:assert/strict';
import {bundleEngine, setSsrFps, setSsrFrame} from './helpers/engine-bundle.mjs';

const mod = await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {KineticSceneRenderer} from './engine/src/creative-kit/kinetic/scenes';
  import {brollChipInk} from './engine/src/creative-kit/kinetic/broll';
  import {getSceneTheme} from './engine/src/creative-kit/primitives';
  import {STYLE_IDS} from './engine/src/styles/registry.ts';
  import {BROLL_REFUSED_STYLES} from './engine/src/prepared-edit/broll.ts';
  import {contrastRatio} from './engine/src/core/chapters.ts';
  const geometry = {windowTop: 0, windowHeight: 1920, videoWidth: 1080, videoLeft: 0, videoTop: 0};
  export const render = (scene, seam = 1920, style = 'section-deck') => renderToStaticMarkup(React.createElement(KineticSceneRenderer, {scene, style, geometry, aspect: 16 / 9, seam}));
  export const chipInk = brollChipInk;
  export const chipStyles = () => STYLE_IDS.filter((id) => !BROLL_REFUSED_STYLES.includes(id)).map((id) => {
    const theme = getSceneTheme(id);
    const ink = brollChipInk(theme);
    return {id, accent: theme.accent, ink, ratio: contrastRatio(ink, theme.accent), textRatio: contrastRatio(theme.text, theme.accent)};
  });
`, {ssr: true, media: true, plateStub: true});

const clip = (extra = {}) => ({src: 'projects/example/a.mp4', sha256: 'a'.repeat(64), width: 1080, height: 1920, trimBeforeFrame: 0, fit: 'cover', ...extra});
const scene = (steps, extra = {}) => ({id: 'broll-1', family: 'screens', fromFrame: 0, durationInFrames: 120, layout: 'takeover', motion: 'quiet', data: {look: 'broll', steps}, ...extra});
const at = (frame, target, seam, style) => {
  setSsrFps(30);
  setSsrFrame(frame);
  return mod.render(target, seam, style);
};

test('a broll scene fills the screen with its first clip, silent and trimmed', () => {
  const html = at(0, scene([{atFrame: 0, ...clip({trimBeforeFrame: 30})}]));
  assert.match(html, /data-footage="projects\/example\/a\.mp4"/);
  assert.match(html, /data-muted="true"/);
  assert.match(html, /data-start-from-sec="1"/);
  assert.match(html, /width:1080px;height:1920px/);
});

test('the clips cut at their frames and only the active clip is mounted', () => {
  const two = scene([{atFrame: 0, ...clip()}, {atFrame: 45, ...clip({src: 'projects/example/b.mp4'})}]);
  assert.match(at(44, two), /a\.mp4/);
  assert.doesNotMatch(at(44, two), /b\.mp4/);
  assert.match(at(45, two), /b\.mp4/);
  assert.doesNotMatch(at(45, two), /a\.mp4/);
});

test('a label sits on a solid chip, and without a label there is no chip', () => {
  assert.match(at(0, scene([{atFrame: 0, ...clip(), label: 'Office desk'}])), />Office desk</);
  assert.doesNotMatch(at(0, scene([{atFrame: 0, ...clip()}])), /border:3px solid/);
});

test('the label chip ink reads on the accent in every style that can host B-roll', () => {
  const rows = mod.chipStyles();
  for (const id of ['paper-collage', 'section-deck', 'section-deck']) assert.ok(rows.some((r) => r.id === id), `${id} can host B-roll`);
  for (const row of rows) assert.ok(row.ratio >= 4.5, `${row.id}: ${row.ink} on ${row.accent} is ${row.ratio.toFixed(2)}:1, below 4.5:1`);
  assert.ok(!rows.some((r) => ['cartoon', 'one-shot', 'grid-glide'].includes(r.id)), 'styles that refuse B-roll are not checked');
});

test('the chip ink is the style onAccent, else the best of text, background, white and near-black on the accent', () => {
  assert.equal(mod.chipInk({accent: '#1E6470', text: '#28322E', background: '#EAE7DC', onAccent: '#FFFFFF'}), '#FFFFFF', 'onAccent wins even when text would also read');
  assert.equal(mod.chipInk({accent: '#FF6B35', text: '#FFFFFF', background: '#0F1B33'}), '#111111', 'no onAccent: near-black beats white and the navy background on orange');
  assert.equal(mod.chipInk({accent: '#64E4FF', text: '#F5FAFF', background: '#050916'}), '#050916', 'no onAccent: a background darker than near-black wins on a light accent');
  assert.equal(mod.chipInk({accent: '#102030', text: '#F5FAFF', background: '#050916'}), '#FFFFFF', 'no onAccent: white wins on a dark accent');
});

test('the rendered label chip uses that ink for its text and its border', () => {
  const labelled = scene([{atFrame: 0, ...clip(), label: 'Office desk'}]);
  const collage = at(0, labelled, 1920, 'paper-collage');
  assert.match(collage, /background:#1E6470;border:3px solid #FFFEF7/, 'paper-collage: V4 light ink on its teal accent');
  assert.match(collage, /width:\d+px;color:#FFFEF7/);
  assert.doesNotMatch(collage, /#28322E/, 'the style text colour is no longer used on the chip');
  const deck = at(0, labelled, 1920, 'section-deck');
  assert.match(deck, /background:#FF6B35;border:3px solid #1A0A03/, 'section-deck: V4 explicitly supplies its onAccent ink');
  assert.match(deck, /width:\d+px;color:#1A0A03/);
});

test('a broll clip that would be enlarged too much fails the render instead of going soft', () => {
  const wide = {width: 1920, height: 1080};
  assert.throws(() => at(0, scene([{atFrame: 0, ...clip(wide)}])), /SceneClip projects\/example\/a\.mp4: the clip would be enlarged 1\.78x in its 1080x1920 box/);
  assert.doesNotThrow(() => at(0, scene([{atFrame: 0, ...clip({...wide, fit: 'contain'})}])));
});

test('the window look of screens still renders its framed viewport and progress markers', () => {
  const windowScene = {id: 'screens-1', family: 'screens', fromFrame: 0, durationInFrames: 120, layout: 'takeover', motion: 'quiet',
    data: {kicker: 'شاشات', steps: [{atFrame: 0, title: 'الأولى', src: 'projects/example/a.png', kind: 'image', fit: 'contain', trimBeforeFrame: 0}]}};
  const html = at(0, windowScene);
  assert.match(html, /شاشات \/ 01/);
  assert.match(html, /<img src="\/(?:static\/)?projects\/example\/a\.png"/, 'the image step draws the staged file');
});

test('the window look hands its video step fill mode to Footage as the objectFit prop, which both video engines honour', () => {
  const windowVideo = (fit) => ({id: 'screens-1', family: 'screens', fromFrame: 0, durationInFrames: 120, layout: 'takeover', motion: 'quiet',
    data: {kicker: 'شاشات', steps: [{atFrame: 0, title: 'الأولى', src: 'projects/example/b.mp4', kind: 'video', fit, trimBeforeFrame: 0}]}});
  for (const fit of ['cover', 'contain']) {
    const html = at(0, windowVideo(fit));
    assert.match(html, /data-footage="projects\/example\/b\.mp4"/);
    assert.match(html, new RegExp(`data-object-fit="${fit}"`), `${fit} reaches Footage as its objectFit prop`);
    assert.doesNotMatch(html, /<video[^>]*style="[^"]*object-fit/, 'and not as a style, which the WebCodecs engine overwrites with its own prop');
  }
});
