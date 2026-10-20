import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Footage hands the fill mode to the video engine in the way each engine honours:
//   - the default engine (OffthreadVideo) takes it as a style, where an explicit style.objectFit still wins over the prop;
//   - the WebCodecs engine (@remotion/media <Video>) overwrites style.objectFit with its own objectFit prop, so there it only travels as the prop.
// This bundles the REAL engine/src/core/plate.tsx and core/clip.tsx, with remotion, @remotion/media, @remotion/studio and the proxy registry replaced by
// small recorders, and checks the props each engine receives. No browser, no ffmpeg.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engineRequire = createRequire(path.join(ROOT, 'engine', 'package.json'));
const {build} = engineRequire('esbuild');
const REMOTION = path.join(ROOT, 'engine', 'node_modules', 'remotion', 'dist', 'esm', 'index.mjs').replaceAll('\\', '/');

const REMOTION_STUB = `
import React from 'react';
export * from ${JSON.stringify(REMOTION)};
export const useCurrentFrame = () => 0;
export const useVideoConfig = () => ({width: 1080, height: 1920, fps: 30, durationInFrames: 600, id: 'plate-test', defaultProps: {}, props: globalThis.__PLATE_PROPS__ ?? {}});
export const useRemotionEnvironment = () => ({isRendering: true, isStudio: false, isPlayer: false, isReadOnlyStudio: false});
export const staticFile = (file) => '/' + file;
export const OffthreadVideo = (props) => {
  globalThis.__PLATE_CALLS__.push({name: 'OffthreadVideo', props});
  return React.createElement('video', {'data-component': 'OffthreadVideo', style: props.style});
};
export const Audio = (props) => {
  globalThis.__PLATE_CALLS__.push({name: 'Audio', props});
  return React.createElement('audio', {'data-component': 'Audio'});
};
`;
const MEDIA_STUB = `
import React from 'react';
export const Video = (props) => {
  globalThis.__PLATE_CALLS__.push({name: 'Video', props});
  return React.createElement('video', {'data-component': 'Video', style: props.style});
};
`;

const stubs = {
  name: 'plate-stubs',
  setup(b) {
    b.onResolve({filter: /^remotion$/}, () => ({path: 'remotion-stub', namespace: 'plate-test'}));
    b.onResolve({filter: /^@remotion\/media$/}, () => ({path: 'media-stub', namespace: 'plate-test'}));
    b.onResolve({filter: /^@remotion\/studio$/}, () => ({path: 'studio-stub', namespace: 'plate-test'}));
    b.onResolve({filter: /proxies\.json$/}, () => ({path: 'proxies-stub', namespace: 'plate-test'}));
    b.onLoad({filter: /^remotion-stub$/, namespace: 'plate-test'}, () => ({contents: REMOTION_STUB, loader: 'js', resolveDir: ROOT}));
    b.onLoad({filter: /^media-stub$/, namespace: 'plate-test'}, () => ({contents: MEDIA_STUB, loader: 'js', resolveDir: ROOT}));
    b.onLoad({filter: /^studio-stub$/, namespace: 'plate-test'}, () => ({contents: 'export const getStaticFiles = () => [];', loader: 'js'}));
    b.onLoad({filter: /^proxies-stub$/, namespace: 'plate-test'}, () => ({contents: '{}', loader: 'json'}));
  },
};

const entry = `
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Footage} from './engine/src/core/plate';
import {SafeRoot} from './engine/src/core/safe';
import {SceneClip} from './engine/src/core/clip';
export const footage = (props, probe) => renderToStaticMarkup(probe ? React.createElement(SafeRoot, {probe}, React.createElement(Footage, props)) : React.createElement(Footage, props));
export const sceneClip = (props) => renderToStaticMarkup(React.createElement(SceneClip, props));
`;

const result = await build({
  stdin: {contents: entry, resolveDir: ROOT, loader: 'tsx'},
  nodePaths: [path.join(ROOT, 'engine', 'node_modules')],
  bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
  plugins: [stubs],
});
const mod = {exports: {}};
new Function('require', 'module', 'exports', result.outputFiles[0].text)(engineRequire, mod, mod.exports);
const plate = mod.exports;

/** Renders one use and returns what the engines received. `engine` becomes props.__editorMediaEngine of the composition. */
function run(how, engine, props, probe) {
  globalThis.__PLATE_CALLS__ = [];
  globalThis.__PLATE_PROPS__ = engine === undefined ? {} : {__editorMediaEngine: engine};
  const html = how === 'clip' ? plate.sceneClip(props) : plate.footage(props, probe);
  const calls = globalThis.__PLATE_CALLS__;
  return {html, calls, video: calls.find((call) => call.name === 'Video'), offthread: calls.find((call) => call.name === 'OffthreadVideo')};
}
const base = {src: 'a.mp4', muted: true, style: {objectPosition: '25% 75%'}};

test('the WebCodecs engine gets the fill mode as the objectFit prop of its <Video>, never in the style it overwrites', () => {
  for (const fit of ['cover', 'contain']) {
    const r = run('footage', 'webcodecs', {...base, objectFit: fit});
    assert.equal(r.offthread, undefined, 'the WebCodecs engine does not mount OffthreadVideo');
    assert.equal(r.video.props.objectFit, fit);
    assert.equal('objectFit' in r.video.props.style, false, 'a style objectFit would be overwritten and the library warns about it');
    assert.equal(r.video.props.style.objectPosition, '25% 75%', 'the focus point still travels in the style');
    assert.equal(r.video.props.muted, true);
  }
});

test('the default engine gets the fill mode in the style of its OffthreadVideo, and an explicit style still wins there', () => {
  for (const engine of [undefined, 'offthread']) {
    for (const fit of ['cover', 'contain']) {
      const r = run('footage', engine, {...base, objectFit: fit});
      assert.equal(r.video, undefined);
      assert.equal(r.offthread.props.style.objectFit, fit);
      assert.equal(r.offthread.props.style.objectPosition, '25% 75%');
      assert.equal(r.offthread.props.objectFit, undefined, 'the prop is not passed on to OffthreadVideo');
    }
  }
  const explicit = run('footage', undefined, {...base, objectFit: 'cover', style: {objectFit: 'contain'}});
  assert.equal(explicit.offthread.props.style.objectFit, 'contain', 'on this branch an explicit style.objectFit wins over the prop');
});

test('without an objectFit prop nothing changes: each engine keeps its own default', () => {
  const webcodecs = run('footage', 'webcodecs', {src: 'a.mp4', muted: true});
  assert.equal(webcodecs.video.props.objectFit, undefined, 'the library default (contain) stays');
  assert.equal('objectFit' in webcodecs.video.props.style, false);
  const offthread = run('footage', undefined, {src: 'a.mp4', muted: true});
  assert.equal('objectFit' in offthread.offthread.props.style, false);
  const own = run('footage', 'webcodecs', {src: 'a.mp4', muted: true, style: {objectFit: 'cover'}});
  assert.equal(own.video.props.style.objectFit, 'cover', 'a caller that sets its own style is left alone');
});

test('a transparent plate stays on OffthreadVideo even when WebCodecs is selected, and the probe placeholder ignores the fill mode', () => {
  const transparent = run('footage', 'webcodecs', {...base, src: 'a.mov', transparent: true, objectFit: 'cover'});
  assert.equal(transparent.video, undefined);
  assert.equal(transparent.offthread.props.style.objectFit, 'cover');
  const probe = run('footage', 'webcodecs', {...base, objectFit: 'cover'}, '#ff00ff');
  assert.equal(probe.calls.length, 0, 'the safe-zone probe draws a flat colour and mounts no video');
  assert.doesNotMatch(probe.html, /object-fit/);
});

test('SceneClip carries its clip fit to the WebCodecs video as a prop, and to the default engine as a style', () => {
  const clipUse = (fit) => ({clip: {src: 'projects/x/a.mp4', sha256: 'a'.repeat(64), width: 1080, height: 1920, trimBeforeFrame: 30, fit, focus: {x: 0.25, y: 0.75}}, width: 1080, height: 1920});
  for (const fit of ['cover', 'contain']) {
    const webcodecs = run('clip', 'webcodecs', clipUse(fit));
    assert.equal(webcodecs.video.props.objectFit, fit);
    assert.equal('objectFit' in webcodecs.video.props.style, false);
    assert.equal(webcodecs.video.props.style.objectPosition, '25% 75%');
    assert.equal(webcodecs.video.props.trimBefore, 30);
    const offthread = run('clip', undefined, clipUse(fit));
    assert.equal(offthread.offthread.props.style.objectFit, fit);
  }
});

test('the @remotion/media behaviour Footage relies on is still there', async () => {
  const source = await readFile(path.join(ROOT, 'engine', 'node_modules', '@remotion', 'media', 'dist', 'esm', 'index.mjs'), 'utf8');
  assert.match(source, /\.\.\.style,\s*objectFit: objectFitProp/, 'a style objectFit is overwritten by the objectFit prop; re-check Footage after a Remotion upgrade');
  assert.match(source, /objectFit: objectFit \?\? "contain"/, 'the default fill mode of <Video> is contain; re-check Footage after a Remotion upgrade');
});
