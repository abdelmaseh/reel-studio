import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const engineRequire = createRequire(new URL('../../engine/package.json', import.meta.url));
const {build} = engineRequire('esbuild');

const SHIM = [
  "export * from 'remotion-real';",
  "import React from 'react';",
  'export const useCurrentFrame=()=>globalThis.__glideFrame??0;',
  "export const useVideoConfig=()=>({width:1080,height:1920,fps:globalThis.__glideFps??30,durationInFrames:globalThis.__glideDuration??600,id:'glide-ssr',defaultProps:{},props:{}});",
  "export const staticFile=file=>'/static/'+file;",
  'export const Sequence=({children})=>React.createElement(React.Fragment,null,children);',
  "export const Img=({src,style})=>React.createElement('img',{src,style});",
  "export const OffthreadVideo=({src,style})=>React.createElement('video',{src,style});",
].join('\n');

const shim = {
  name: 'glide-remotion-shim',
  setup(b) {
    b.onResolve({filter: /^remotion$/}, () => ({path: 'remotion-shim', namespace: 'glide-shim'}));
    b.onResolve({filter: /^remotion-real$/}, () => ({path: engineRequire.resolve('remotion')}));
    b.onLoad({filter: /.*/, namespace: 'glide-shim'}, () => ({contents: SHIM, loader: 'js', resolveDir: path.join(root, 'engine')}));
    // The kit measures text only through scenes/fit.ts; SSR has no browser, so replace that one module.
    b.onLoad({filter: /styles[\\/]grid-glide[\\/]scenes[\\/]fit\.ts$/}, () => ({contents: 'export const textWidth = (text, spec) => text.length * spec.size * 0.5;', loader: 'ts'}));
  },
};

/** Bundle `source` (TSX, imports relative to the repo root) for Node and return its exports. */
export async function ssrBundle(source) {
  const result = await build({
    stdin: {contents: source, loader: 'tsx', resolveDir: root},
    nodePaths: [path.join(root, 'engine/node_modules')],
    bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent', plugins: [shim],
  });
  const module = {exports: {}};
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(engineRequire, module, module.exports);
  return module.exports;
}

/** The frame every `useCurrentFrame()` returns until the next call, and the frame rate and scene length `useVideoConfig()` reports. */
export function setFrame(frame, {fps = 30, duration = 600} = {}) {
  globalThis.__glideFrame = frame;
  globalThis.__glideFps = fps;
  globalThis.__glideDuration = duration;
}

/** Elements whose only content is text: [{tag, style, text}]. */
export function leaves(html) {
  return [...html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>([^<>]+)<\/\1>/gi)]
    .map((match) => ({tag: match[1], style: /style="([^"]*)"/.exec(match[2])?.[1] ?? '', text: match[3]}));
}

/** One CSS property of an inline style string. */
export const css = (style, property) => new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+)`).exec(style)?.[1].trim();

/** Opacity and translate3d offsets of the element that holds exactly `text` (opacity 0 when it is not drawn). */
export function wordMotion(html, text) {
  const hit = leaves(html).find((leaf) => leaf.text === text);
  if (!hit) return {found: false, opacity: 0, x: 0, y: 0};
  const move = /translate3d\(\s*(-?[\d.e+-]+)px,\s*(-?[\d.e+-]+)px/.exec(css(hit.style, 'transform') ?? '');
  return {found: true, opacity: Number(css(hit.style, 'opacity') ?? 1), x: move ? Number(move[1]) : 0, y: move ? Number(move[2]) : 0};
}

/** left/top/width/height of the first element whose inline style contains `marker`. */
export function rectOf(html, marker) {
  const style = new RegExp(`style="([^"]*${marker}[^"]*)"`).exec(html)?.[1];
  if (!style) return null;
  const px = (name) => Number.parseFloat(css(style, name) ?? 'NaN');
  return {left: px('left'), top: px('top'), width: px('width'), height: px('height')};
}

/** Every number inside every translate(...) / translate3d(...) of the markup. */
export function translateNumbers(html) {
  return [...html.matchAll(/translate\w*\(([^)]*)\)/g)]
    .flatMap((match) => [...match[1].matchAll(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)].map((n) => Number(n[0])));
}
