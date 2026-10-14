import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const engineRequire = createRequire(new URL('../../engine/package.json', import.meta.url));
const {build} = engineRequire('esbuild');
const remotionModule = path.join(root, 'engine/node_modules/remotion/dist/esm/index.mjs').replaceAll('\\', '/');

// Server-side rendering has no Remotion composition and no browser. This bundle swaps in only what
// needs one: the frame clock and frame rate, the sequence, the media elements, and text measurement.
// Every component, theme, probe and safe-zone helper under test stays the real code.
const REMOTION_SHIM = `
import React from 'react';
export * from ${JSON.stringify(remotionModule)};
export const useCurrentFrame = () => globalThis.__glideFrame ?? 0;
export const useVideoConfig = () => ({fps: globalThis.__glideFps ?? 30, width: 1080, height: 1920, durationInFrames: 900, id: 'ssr', props: {}, defaultProps: {}});
export const Sequence = ({children}) => React.createElement(React.Fragment, null, children);
export const Img = ({src, style, ...rest}) => React.createElement('img', {src, style, 'data-kit': 'Img', ...rest});
export const OffthreadVideo = ({src, style, muted, trimBefore}) =>
  React.createElement('video', {src, style, 'data-kit': 'OffthreadVideo', 'data-muted': String(Boolean(muted)), 'data-trim-before': trimBefore});
`;

// A text is half a font size wide per character, whatever the font.
const FIT_STAND_IN = `export const textWidth = (text, spec) => text.length * spec.size * 0.5;`;

/**
 * Bundle `source` (an ES module that may import engine files) and return its exports.
 * Render with `withFrame(n, () => renderToStaticMarkup(...))` inside the module, or use the
 * `globalThis.__glideFrame` and `globalThis.__glideFps` (default 30) the shim reads.
 */
export async function loadGlide(source) {
  const output = await build({
    stdin: {contents: source, resolveDir: root, loader: 'tsx', sourcefile: 'glide-entry.tsx'},
    nodePaths: [path.join(root, 'engine/node_modules')],
    bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    plugins: [{
      name: 'glide-ssr',
      setup(builder) {
        builder.onResolve({filter: /^remotion$/}, () => ({path: 'remotion', namespace: 'glide-shim'}));
        builder.onLoad({filter: /.*/, namespace: 'glide-shim'}, () => ({contents: REMOTION_SHIM, resolveDir: root, loader: 'js'}));
        builder.onLoad({filter: /styles[\\/]grid-glide[\\/]scenes[\\/]fit\.ts$/}, () => ({contents: FIT_STAND_IN, loader: 'ts'}));
      },
    }],
  });
  const module = {exports: {}};
  new Function('require', 'module', 'exports', output.outputFiles[0].text)(engineRequire, module, module.exports);
  return module.exports;
}

/** Entry source shared by the Grid Glide component tests: render a kit export at a frame (and a frame rate, default 30). */
export const KIT_ENTRY = `
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import * as kit from './engine/src/styles/grid-glide/scenes/kit';
  import {SafeRoot} from './engine/src/core/safe';
  export {kit};
  export const h = React.createElement;
  export const html = (name, props, frame = 0, options = {}) => {
    globalThis.__glideFrame = frame;
    globalThis.__glideFps = options.fps ?? 30;
    try {
      const element = React.createElement(kit[name], props);
      return renderToStaticMarkup(options.probe ? React.createElement(SafeRoot, {probe: options.probe}, element) : element);
    } finally {
      delete globalThis.__glideFrame;
      delete globalThis.__glideFps;
    }
  };
`;
