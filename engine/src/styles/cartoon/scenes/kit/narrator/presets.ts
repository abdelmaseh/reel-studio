// Original art of the cartoon narrator in figure units (600 x 1150; head centre 300,395; chin 300,590). Every value is data so the halftone
// shadow, the Lab and the safe maths read the same outlines. Every outline here is drawn for this style; none comes from a photo. Node-safe: no packages, no JSX.
import type {Character} from '../../character.ts';

export const FACE_D = 'M 154 330 C 154 250 230 232 300 232 C 370 232 446 250 446 330 L 446 470 C 446 540 380 568 300 568 C 220 568 154 540 154 470 Z';
export const EAR = {l: {cx: 148, cy: 398}, r: {cx: 452, cy: 398}, rx: 18, ry: 32} as const;
export const NECK_D = 'M 258 540 L 342 540 L 342 672 L 258 672 Z';
export const NOSE_D = 'M 300 402 C 288 430 280 446 300 454 C 320 446 312 430 300 402 Z';
export const BROW_L = 'M 190 352 Q 228 338 262 350';
export const BROW_R = 'M 338 350 Q 372 338 410 352';
export const EYE = {l: {x: 228, y: 382}, r: {x: 372, y: 382}, rx: 25, ry: 13.5, iris: 12.5, inner: 8.6, pupil: 5.2} as const;
export const LENS = {y: 338, h: 84, w: 112, r: 28, left: 172, right: 316, top: 11, side: 8, bot: 7} as const;
export const MOUTH = {y: 499, closedL: 268, closedR: 332, openL: 265, openR: 335, depth: 26} as const;
export const BEARD_D = 'M 154 372 C 150 480 170 560 300 587 C 430 560 450 480 446 372 C 420 420 380 440 300 445 C 220 440 180 420 154 372 Z';
export const MOUSTACHE_D = 'M 258 470 C 280 456 320 456 342 470 C 320 486 280 486 258 470 Z';

const SHORT_FRONT = 'M 150 392 C 150 262 200 162 300 162 C 400 162 450 262 450 392 C 436 322 396 298 300 296 C 204 298 164 322 150 392 Z';
export const HAIR: Record<Character['hair']['style'], {front: string | null; back: string | null; highlights: string[]}> = {
  short: {front: SHORT_FRONT, back: null, highlights: ['M 222 222 C 250 198 300 192 338 202']},
  quiff: {front: 'M 150 392 C 150 262 190 172 280 160 C 318 118 392 128 402 190 C 442 232 450 300 450 392 C 436 322 396 298 300 296 C 204 298 164 322 150 392 Z', back: null, highlights: ['M 232 208 C 270 168 334 160 382 184']},
  long: {front: SHORT_FRONT, back: 'M 150 392 L 140 724 C 192 762 408 762 460 724 L 450 392 Z', highlights: ['M 222 222 C 250 198 300 192 338 202', 'M 166 560 C 170 640 176 700 186 740']},
  none: {front: null, back: null, highlights: []},
};
export const HEADWEAR = {
  hijab: {outer: 'M 130 420 C 130 240 200 150 300 150 C 400 150 470 240 470 420 L 470 640 C 470 700 420 724 300 724 C 180 724 130 700 130 640 Z', fold: 'M 172 420 C 192 300 242 250 300 246 C 358 250 408 300 428 420'},
  cap: {crown: 'M 150 334 C 160 224 230 182 300 182 C 370 182 440 224 450 334 Z', visor: 'M 150 334 C 250 352 380 352 470 318 C 476 340 440 362 300 362 C 220 362 170 352 150 334 Z'},
} as const;

export const TORSO_D = 'M 62 1150 L 62 808 C 62 700 132 650 300 650 C 468 650 538 700 538 808 L 538 1150 Z';
export const OVERSHIRT = {left: 'M 62 1150 L 62 808 C 62 700 132 650 250 650 L 250 1150 Z', right: 'M 538 1150 L 538 808 C 538 700 468 650 350 650 L 350 1150 Z',
  collarL: 'M 250 650 L 250 720 L 214 690 Z', collarR: 'M 350 650 L 350 720 L 386 690 Z', pocket: {x: 404, y: 768, w: 60, h: 70}, buttons: [780, 900, 1020]} as const;
export const SLEEVE = {shoulder: 46, elbow: 37, wrist: 29, cuff: 24} as const;

export type Digit = {from: [number, number]; to: [number, number]; r: number};
export type HandPose = {palm: {w: number; h: number; r: number}; digits: Digit[]};
const curl = (x: number): Digit => ({from: [x, -56], to: [x + 4, -74], r: 9});
/** Hand space: the wrist at the origin, fingers toward -y, the thumb on the left; the left hand is mirrored. Scaled by RIG.handScale when drawn. */
export const HAND_POSES: Record<'open' | 'point' | 'thumb' | 'fist' | 'wave' | 'rest', HandPose> = {
  open: {palm: {w: 62, h: 72, r: 18}, digits: [{from: [-18, -60], to: [-22, -118], r: 9}, {from: [-6, -62], to: [-6, -126], r: 9}, {from: [6, -62], to: [8, -118], r: 9}, {from: [18, -58], to: [24, -106], r: 9}, {from: [-30, -40], to: [-54, -72], r: 10}]},
  wave: {palm: {w: 62, h: 72, r: 18}, digits: [{from: [-18, -60], to: [-37, -116], r: 9}, {from: [-6, -62], to: [-10, -126], r: 9}, {from: [6, -62], to: [14, -118], r: 9}, {from: [18, -58], to: [41, -104], r: 9}, {from: [-30, -40], to: [-54, -72], r: 10}]},
  point: {palm: {w: 62, h: 72, r: 18}, digits: [{from: [-8, -60], to: [-8, -122], r: 9}, curl(4), curl(14), curl(24), {from: [-30, -40], to: [-46, -62], r: 10}]},
  thumb: {palm: {w: 62, h: 72, r: 18}, digits: [curl(-18), curl(-6), curl(6), curl(18), {from: [-22, -50], to: [-24, -104], r: 10}]},
  fist: {palm: {w: 62, h: 72, r: 18}, digits: [curl(-18), curl(-6), curl(6), curl(18), {from: [-30, -30], to: [-4, -38], r: 10}]},
  rest: {palm: {w: 62, h: 72, r: 18}, digits: [curl(-18), curl(-6), curl(6), curl(18), {from: [-30, -30], to: [-4, -38], r: 10}]},
};

/** The outline paths of the head that change the silhouette for a character (the halftone shadow and the safe maths read them). */
export function headSilhouettePaths(character: Character): string[] {
  const hair = HAIR[character.hair.style];
  if (character.headwear.kind === 'hijab') return [HEADWEAR.hijab.outer, FACE_D];
  return [FACE_D, ...(hair.front ? [hair.front] : []), ...(hair.back ? [hair.back] : []), ...(character.beard.kind === 'full' ? [BEARD_D] : []),
    ...(character.headwear.kind === 'cap' ? [HEADWEAR.cap.crown, HEADWEAR.cap.visor] : [])];
}
/** The ears are drawn unless a hijab covers them. */
export const earsVisible = (character: Character): boolean => character.headwear.kind !== 'hijab';
