// The numbers behind the layers built on @remotion/effects: looks film and paper, backdrops sunburst and paper. Node-safe on purpose (no JSX, no
// React, no effect imports): the library, the editor and the tests read these values without bundling a component. The components that use them
// are film.tsx, paper.tsx, sunburst.tsx and, for the overlay, core/transitions-v4/pixel-curtain.tsx.
//
// The rule of the whole family: an effect is a layer of its own. Each one is drawn on a <Solid> that sits over or behind the picture and is
// blended into it with a CSS blend mode. None is applied to the scene's own pixels, so the presenter, the baked captions and the screen
// details are exactly what they were, and none needs more than WebGL 2, which every browser has: the live preview and the render agree.
import { mixToHex, parseColor } from "../core/chapters.ts";

/** The most noise a layer may add and still leave a caption without a backing readable. Film stays under it; a test holds it there. */
export const FILM_GRAIN_MAX = 0.12;

/**
 * Film: one mid-grey layer with a vignette and a grain, blended with `overlay`. Mid-grey is neutral in an overlay, so only the darkened
 * corners and the grain change the picture; the grain is strongest in the mid-tones, as on film. A new grain every frame.
 */
export const FILM = {
  base: "#808080",
  blend: "overlay",
  grain: 0.1,
  vignette: { amount: 0.4, radius: 0.7, feather: 0.45 },
} as const;

/** The grain seed of a frame: a new one every frame, from a small range so the shader's float stays exact however long the video is. */
export const filmSeed = (frame: number): number => Math.abs(Math.round(Number.isFinite(frame) ? frame : 0)) % 997;

/**
 * Paper: the picture printed on a sheet. The sheet is paper texture with no folds (a fold line across a face reads as damage), multiplied over
 * the picture at half strength: skin and type stay natural (about 10 % darker and a little warmer, measured on six skin tones). A multiply can
 * only darken, so a caption that sat on the picture never loses contrast. Nothing in it depends on the frame, so the sheet does not flicker,
 * and the effect chain is drawn once and kept.
 */
export const PAPER_LOOK = {
  blend: "multiply",
  opacity: 0.5,
  sheet: "#f3ead8",
  texture: { amount: 0.6, colorFront: "#e8dcc3", colorBack: "#fffaf0", contrast: 0.2, roughness: 0.3, fiber: 0.4, crumples: 0.1, folds: 0, foldCount: 0, drops: 0.15 },
} as const;

/** Sunburst: sixteen rays of two tones turning slowly. `spin` is degrees per second at speed 1. The rotation is never 0: at 0 the ray phase differs between GL backends. */
export const SUNBURST = { rays: 16, rotation: 7.5, spin: 3, smoothness: 0, tones: { strong: 0.2, soft: 0.08 } } as const;

/** The rotation of the rays at `seconds`: from 7.5 degrees, turning `spin * speed` degrees a second, always inside (0, 360). */
export const sunburstRotation = (seconds: number, speed = 1): number =>
  SUNBURST.rotation + ((Math.max(0, seconds) * SUNBURST.spin * Math.max(0, speed)) % (360 - SUNBURST.rotation));

/**
 * The paper backdrop: a white sheet of paper grain (neutral greys, between 83 % and 100 % white, 90 % on average, measured) multiplied over the
 * style's own ground. The ground keeps its hue and is at most `shade` darker anywhere, so text that reads on the ground reads on the paper. (The
 * paper effect on a dark colour darkens it much more than a multiply would, which is why the sheet is white and the ground is blended in.)
 */
export const PAPER_BACKDROP = { amount: 0.5, front: "#d9d9d9", back: "#ffffff", sheet: "#ffffff", blend: "multiply", shade: 0.17 } as const;

/** The pixel curtain: the cells are about 45 px squares on the 1080 x 1920 frame; `seed` fixes which cell goes first. */
export const PIXEL_CURTAIN = { columns: 24, rows: 43, seed: 7, feather: 0.1, fallback: "#102027" } as const;

/** A hex colour the tone maths can use, or `fallback` for anything else (a gradient, `transparent`, a named colour). */
const usable = (colour: string | undefined, fallback: string): string => {
  if (colour === undefined) return fallback;
  try { parseColor(colour); return colour; } catch { return fallback; }
};

/**
 * The two ray tones of a sunburst: the style's ground tinted toward its accent, a strong tone and a soft one. Both stay close to the ground,
 * so text that reads on the ground still reads on every ray (tests/effects-looks.test.mjs checks this on every registered style).
 */
export function sunburstTones(accent: string | undefined, ground: string | undefined): [string, string] {
  const base = usable(ground, PIXEL_CURTAIN.fallback), tint = usable(accent, "#e2b85f");
  return [mixToHex(base, tint, SUNBURST.tones.strong), mixToHex(base, tint, SUNBURST.tones.soft)];
}

/**
 * The darkest the paper backdrop makes a ground (a cream ground when none is given), so a test can hold text to it.
 */
export function paperBackdropDarkest(ground: string | undefined): string {
  return mixToHex(usable(ground, PAPER_LOOK.sheet), "#000000", PAPER_BACKDROP.shade);
}
