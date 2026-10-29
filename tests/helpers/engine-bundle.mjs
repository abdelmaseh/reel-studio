// Bundles engine TypeScript for tests that need the real modules (React, Remotion, core/fonts) in plain Node.
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const engineRequire = createRequire(new URL('../../engine/package.json', import.meta.url));
const {build} = engineRequire('esbuild');
const REMOTION = path.join(ROOT, 'engine', 'node_modules', 'remotion', 'dist', 'esm', 'index.mjs').replaceAll('\\', '/');

// Same module, with the two hooks that need a registered composition answering a fixed one.
const REMOTION_SHIM = `
export * from ${JSON.stringify(REMOTION)};
export const useCurrentFrame = () => globalThis.__SSR_FRAME__ ?? 0;
export const useVideoConfig = () => ({width: 1080, height: 1920, fps: globalThis.__SSR_FPS__ ?? 30, durationInFrames: 600, id: 'ssr', defaultProps: {}, props: {},
  defaultCodec: null, defaultOutName: null, defaultVideoImageFormat: null, defaultPixelFormat: null, defaultProResProfile: null});
// <Solid> draws a canvas through its effect chain in a browser and mounts a <Sequence>, which needs a registered composition. The stand-in is the
// canvas the real one renders, carrying the colour and the effect list (type and parameters) so a test can read what a layer would draw.
import * as SolidReact from 'react';
export const Solid = ({width, height, color, effects = [], style}) => SolidReact.createElement('canvas', {width, height, 'data-solid': color ?? '',
  'data-effects': JSON.stringify(effects.map((effect) => ({type: effect.definition.type, params: effect.params}))), style: {width, height, ...style}});
`;

// Opt-in (`media: true`): plain stand-ins for the media components, which need a registered composition to render.
const MEDIA_SHIM = `
import React from 'react';
export const staticFile = (file) => '/' + file;
export const Sequence = ({children}) => React.createElement(React.Fragment, null, children);
export const Img = ({src, style}) => React.createElement('img', {src, style});
export const OffthreadVideo = ({src, style, trimBefore}) => React.createElement('video', {src, style, 'data-trim-before': trimBefore});
export const Audio = ({src}) => React.createElement('audio', {src});
`;

// Opt-in (`plateStub: true`): a plain <video> in place of core/plate, whose Footage needs a registered composition.
const PLATE_STUB = `
import React from 'react';
export const CamPlate=({children})=>React.createElement(React.Fragment,null,children);
export const WindowPlate=CamPlate;export const ContinuousWindowPlate=CamPlate;
export const Footage = ({src, startFromSec = 0, muted = false, objectFit, style}) =>
  React.createElement('video', {'data-footage': src, 'data-start-from-sec': String(startFromSec), 'data-muted': String(muted), 'data-object-fit': objectFit, style});
`;

// On by default for `ssr: true` bundles (`lottieStub: false` turns it off): a plain element in place of @remotion/lottie, whose lottie-web needs a
// real browser document. Scenes mount stickers (creative-kit/sticker-view), so any bundle of a scene view or PreparedEdit reaches lottie-web, and
// the fake `document = {}` of an SSR bundle makes it fail when it loads.
const LOTTIE_STUB = `
import React from 'react';
export const Lottie = ({animationData, loop, playbackRate}) =>
  React.createElement('svg', {'data-lottie-player': String(animationData?.fr ?? ''), 'data-loop': String(Boolean(loop)), 'data-rate': String(playbackRate ?? 1)});
`;

// Deterministic stand-in for the browser text measurement of @remotion/layout-utils.
const LAYOUT_UTILS = `
const width = (text, o) => {
  let total = 0;
  for (const ch of Array.from(String(text))) total += (ch === ' ' ? 0.3 : 0.56) * o.fontSize + (Number(o.letterSpacing) || 0);
  return total;
};
export const measureText = (o) => ({width: width(o.text, o), height: Math.ceil(o.fontSize * 1.3)});
export const fitText = (o) => ({fontSize: Math.max(1, Math.floor(o.withinWidth / Math.max(1, width(o.text, {fontSize: 1, letterSpacing: o.letterSpacing})))), width: o.withinWidth, height: 0});
export const fitTextOnNLines = (o) => ({fontSize: Math.max(1, Math.min(o.maxFontSize ?? 200, Math.floor(o.maxBoxWidth * o.maxLines / Math.max(1, width(o.text, {fontSize: 1, letterSpacing: o.letterSpacing})))))});
export const fillTextBox = ({maxBoxWidth, maxLines}) => {
  let used = 0, lines = 1;
  return {add(o) {
    const w = width(o.text, o);
    if (used + w > maxBoxWidth && used > 0) { lines += 1; used = w; return {exceedsBox: lines > maxLines, newLine: true}; }
    used += w;
    return {exceedsBox: false, newLine: false};
  }};
};
`;

function patch(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`tests/helpers/engine-bundle.mjs: ${label} was not found in core/fonts.ts; update the adapter.`);
  return next;
}

const lockManifest = (lock) => ({
  name: 'lock-font-manifest',
  setup(b) {
    const manifest = lock.fonts.map(({url, ...font}) => ({...font, sourceUrl: url})).sort((a, c) => a.file.localeCompare(c.file, 'en'));
    b.onResolve({filter: /public[\\/]fonts[\\/]manifest\.json$/}, () => ({path: 'font-manifest', namespace: 'engine-test'}));
    b.onLoad({filter: /^font-manifest$/, namespace: 'engine-test'}, () => ({contents: JSON.stringify(manifest), loader: 'json'}));
  },
});

const ssrAdapters = ({media = false, plateStub = false, lottieStub = true, timeline = false} = {}) => ({
  name: 'ssr-adapters',
  setup(b) {
    b.onResolve({filter: /^remotion$/}, () => ({path: 'remotion-shim', namespace: 'engine-test'}));
    b.onResolve({filter: /^@remotion\/layout-utils$/}, () => ({path: 'layout-utils', namespace: 'engine-test'}));
    b.onLoad({filter: /^remotion-shim$/, namespace: 'engine-test'}, () => ({contents: timeline ? (REMOTION_SHIM + MEDIA_SHIM).replace('export const useCurrentFrame = () => globalThis.__SSR_FRAME__ ?? 0;', 'const FrameClock=SolidReact.createContext(null); export const useCurrentFrame=()=>SolidReact.useContext(FrameClock) ?? globalThis.__SSR_FRAME__ ?? 0;').replace('export const Sequence = ({children}) => React.createElement(React.Fragment, null, children);', 'export const Sequence=({children,from=0,durationInFrames=Infinity,style,layout})=>{const local=useCurrentFrame()-from;if(local<0||local>=durationInFrames)return null;return React.createElement(FrameClock.Provider,{value:local},layout===\"none\"?children:React.createElement(\"div\",{style},children));};') : media ? REMOTION_SHIM + MEDIA_SHIM : REMOTION_SHIM, loader: 'js', resolveDir: ROOT}));
    b.onLoad({filter: /^layout-utils$/, namespace: 'engine-test'}, () => ({contents: LAYOUT_UTILS, loader: 'js'}));
    if (lottieStub) {
      b.onResolve({filter: /^@remotion\/lottie$/}, () => ({path: 'lottie-stub', namespace: 'engine-test'}));
      b.onLoad({filter: /^lottie-stub$/, namespace: 'engine-test'}, () => ({contents: LOTTIE_STUB, loader: 'js', resolveDir: ROOT}));
    }
    if (plateStub) b.onLoad({filter: /core[\\/]plate\.tsx$/}, () => ({contents: PLATE_STUB, loader: 'tsx', resolveDir: path.join(ROOT, 'engine', 'src', 'core')}));
    b.onLoad({filter: /core[\\/]fonts\.ts$/}, async ({path: file}) => {
      let source = await readFile(file, 'utf8');
      source = patch(source, /if \(typeof document !== "undefined"\) \{(\s*)const handle/, 'if (false) {$1const handle', 'the module-load font loader');
      source = patch(source, 'export const assertFontsReady = (): void => {', 'export const assertFontsReady = (): void => {\n  return;', 'assertFontsReady');
      source = patch(source, 'export const fontsReady = (): boolean => ready && missingFamilies().length === 0;', 'export const fontsReady = (): boolean => true;', 'fontsReady');
      return {contents: source, loader: 'ts', resolveDir: path.dirname(file)};
    });
  },
});

/** Bundles `entry` (TSX source resolved from the repository root) and returns its exports. */
export async function bundleEngine(entry, {ssr = false, media = false, plateStub = false, lottieStub = true, timeline = false, sourceOverrides = {}} = {}) {
  const lock = JSON.parse(await readFile(path.join(ROOT, 'versions.lock.json'), 'utf8'));
  const result = await build({
    stdin: {contents: entry, resolveDir: ROOT, loader: 'tsx'},
    nodePaths: [path.join(ROOT, 'engine', 'node_modules')],
    bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    plugins: [
      {name:'source-overrides',setup(b){b.onLoad({filter:/./},({path:file})=>{const key=path.relative(ROOT,file).replaceAll('\\','/');return sourceOverrides[key]===undefined?undefined:{contents:sourceOverrides[key],loader:file.endsWith('tsx')?'tsx':'ts',resolveDir:path.dirname(file)};});}},
      ...(ssr ? [lockManifest(lock), ssrAdapters({media, plateStub, lottieStub, timeline})] : [lockManifest(lock)])],
  });
  if (ssr) globalThis.document ??= {};
  const module = {exports: {}};
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(engineRequire, module, module.exports);
  return module.exports;
}

/** The frame every Remotion clock hook reports in an `ssr: true` bundle. */
export const setSsrFrame = (frame) => { globalThis.__SSR_FRAME__ = frame; };

/** The fps every Remotion clock hook reports in an `ssr: true` bundle (30 unless a test sets it). */
export const setSsrFps = (fps) => { globalThis.__SSR_FPS__ = fps; };
