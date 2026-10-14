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
export const useVideoConfig = () => ({width: 1080, height: 1920, fps: 30, durationInFrames: 600, id: 'ssr', defaultProps: {}, props: {},
  defaultCodec: null, defaultOutName: null, defaultVideoImageFormat: null, defaultPixelFormat: null, defaultProResProfile: null});
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

const ssrAdapters = () => ({
  name: 'ssr-adapters',
  setup(b) {
    b.onResolve({filter: /^remotion$/}, () => ({path: 'remotion-shim', namespace: 'engine-test'}));
    b.onResolve({filter: /^@remotion\/layout-utils$/}, () => ({path: 'layout-utils', namespace: 'engine-test'}));
    b.onLoad({filter: /^remotion-shim$/, namespace: 'engine-test'}, () => ({contents: REMOTION_SHIM, loader: 'js', resolveDir: ROOT}));
    b.onLoad({filter: /^layout-utils$/, namespace: 'engine-test'}, () => ({contents: LAYOUT_UTILS, loader: 'js'}));
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
export async function bundleEngine(entry, {ssr = false} = {}) {
  const lock = JSON.parse(await readFile(path.join(ROOT, 'versions.lock.json'), 'utf8'));
  const result = await build({
    stdin: {contents: entry, resolveDir: ROOT, loader: 'tsx'},
    nodePaths: [path.join(ROOT, 'engine', 'node_modules')],
    bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    plugins: ssr ? [lockManifest(lock), ssrAdapters()] : [lockManifest(lock)],
  });
  if (ssr) globalThis.document ??= {};
  const module = {exports: {}};
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(engineRequire, module, module.exports);
  return module.exports;
}

/** The frame every Remotion clock hook reports in an `ssr: true` bundle. */
export const setSsrFrame = (frame) => { globalThis.__SSR_FRAME__ = frame; };
