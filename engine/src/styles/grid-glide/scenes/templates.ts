// Starter scenes for the live editor's "new scene" action. Plain data with no imports, so it loads anywhere Node runs.
// Every frame below is scene-relative at 30 fps; gridGlideTemplate() scales the positions to the edit's frame rate.

export type GlideTemplateFamily = 'glide-chapter' | 'glide-card' | 'glide-lines' | 'glide-comment' | 'glide-follow';

/** The bundled placeholder screen. tests/helpers/make-glide-template-screen.mjs regenerates the file. */
export const GLIDE_TEMPLATE_SCREEN = {
  src: 'examples/glide-template-screen.png',
  sha256: '6f22003da77ee753285193cd45e29da6b749ff31c7c8938394560e8c78b7d2dd',
  width: 640,
  height: 360,
} as const;

const cut = {kind: 'cut'} as const;

export const gridGlideTemplateData = {
  'glide-chapter': {
    ordinal: 'Step one', heroAt: 0, pill: {label: 'Your tool'}, enter: cut, exit: cut,
  },
  'glide-card': {
    lines: [
      {words: ['What', 'it', 'does'], role: 'lead', at: 6, cadence: 7},
      {words: ['Your', 'result'], role: 'hero', at: 34, cadence: 7},
    ],
    media: {clips: [{at: 0, ...GLIDE_TEMPLATE_SCREEN, kind: 'image'}]},
    bullets: [{text: 'does the first thing', at: 60}, {text: 'then the next thing', at: 90}],
    enter: cut, exit: cut,
  },
  'glide-lines': {
    lines: [
      {words: ['Say', 'it', 'plainly'], role: 'lead', at: 6, cadence: 7},
      {words: ['Your', 'point'], role: 'hero', at: 36, cadence: 7},
    ],
    grid: false, enter: cut, exit: cut,
  },
  // The ending scenes. The keyword is replaced by the profile's CTA word and the handle by the profile handle when the
  // editor adds the scene; '@your.handle' is only the placeholder for a profile that has none.
  'glide-comment': {
    lines: [{words: ['Say', 'the', 'word'], role: 'lead', at: 6, cadence: 7}],
    keyword: 'Your word', heroAt: 30, box: {text: 'what you will get', at: 55}, enter: cut, exit: cut,
  },
  'glide-follow': {
    lines: [{words: ['Want', 'more'], role: 'lead', at: 6, cadence: 7}],
    handle: '@your.handle', heroAt: 24, pill: {label: 'FOLLOW'}, enter: cut, exit: cut,
  },
} as const;

/** Default scene length in frames at 30 fps. */
export const GLIDE_TEMPLATE_FRAMES: Record<GlideTemplateFamily, number> = {
  'glide-chapter': 90,
  'glide-card': 180,
  'glide-lines': 150,
  'glide-comment': 120,
  'glide-follow': 90,
};

// Positions in the scene scale with the frame rate. cadence is a rhythm in 30 fps frames that the engine
// scales with the edit's frame rate, so it is left alone.
const POSITION_KEYS: ReadonlySet<string> = new Set(['heroAt', 'pillAt', 'at']);

/** A fresh copy of the template for `family`, with positions scaled from 30 fps to `fps`. */
export function gridGlideTemplate(family: string, fps: number): unknown {
  const source = (gridGlideTemplateData as Record<string, unknown>)[family];
  if (source === undefined) throw new Error(`No Grid Glide template for ${JSON.stringify(family)}.`);
  const scale = fps / 30;
  const walk = (value: unknown, key: string): unknown => {
    if (Array.isArray(value)) return value.map((item) => walk(item, key));
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([name, item]) => [name, walk(item, name)]));
    }
    return typeof value === 'number' && POSITION_KEYS.has(key) ? Math.round(value * scale) : value;
  };
  return walk(source, '');
}

/** The default scene length for `family` at `fps`. */
export function gridGlideTemplateFrames(family: string, fps: number): number {
  const frames = (GLIDE_TEMPLATE_FRAMES as Record<string, number | undefined>)[family];
  if (frames === undefined) throw new Error(`No Grid Glide template for ${JSON.stringify(family)}.`);
  return Math.round((frames * fps) / 30);
}
