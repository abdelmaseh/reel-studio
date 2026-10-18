// CartoonLab: a development contact sheet of the narrator (never part of a delivery). Three rows (light, dark, pink grounds) of the
// extreme poses, then a row of face states and hand poses. Render it with scripts/stills.mjs --comps CartoonLab and look at it.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {FAMILY} from '../../core/fonts';
import {PALETTES, groundOf, type Theme} from './scenes/math.ts';
import {DEFAULT_CHARACTER, characterTokens, type Character} from './scenes/character.ts';
import {armKeys, armStateAt, type GestureSpec, type Place} from './scenes/rig.ts';
import {Figure, type Pose} from './scenes/kit/narrator/figure';
import {Face, type FacePose} from './scenes/kit/narrator/face';
import {Hand} from './scenes/kit/narrator/hands';
import {HAND_POSES} from './scenes/kit/narrator/presets.ts';

export type CartoonLabProps = {character: Character};
export const cartoonLabDefaults: CartoonLabProps = {character: DEFAULT_CHARACTER};

const PLACE: Place = {x: 540, scale: 0.86};
const POSES: {name: string; gestures: GestureSpec[]; pose?: Partial<Pose>}[] = [
  {name: 'wide open', gestures: [{frame: 0, arm: 'r', kind: 'open', anchor: {x: 960, y: 980}, reach: 0.95}, {frame: 0, arm: 'l', kind: 'open', anchor: {x: 120, y: 980}, reach: 0.95}], pose: {open: 0.6, brow: 0.6}},
  {name: 'chin fist', gestures: [{frame: 0, arm: 'l', kind: 'fist'}], pose: {open: 0, brow: -0.6, tilt: -3}},
  {name: 'palms out', gestures: [{frame: 0, arm: 'r', kind: 'open', anchor: 'camera'}, {frame: 0, arm: 'l', kind: 'open', anchor: 'camera'}], pose: {open: 0.3}},
  {name: 'thumb', gestures: [{frame: 0, arm: 'r', kind: 'thumb'}], pose: {open: 0.2, brow: 0.8}},
  {name: 'wave', gestures: [{frame: 0, arm: 'r', kind: 'wave', anchor: 'camera'}], pose: {open: 0.4, brow: 0.5}},
  {name: 'point', gestures: [{frame: 0, arm: 'r', kind: 'point', anchor: {x: 765, y: 870}}], pose: {open: 0.8, brow: 0.6, gaze: {gx: 0.6, gy: -0.5}, turn: 0.5}},
];
const THEMES: Theme[] = ['light', 'dark', 'pink'];
const CELL = {w: 366, h: 380, scale: 0.36, top: 900};
const REST_POSE: Pose = {open: 0.4, blink: 0, gaze: {gx: 0, gy: 0}, brow: 0.3, turn: 0, tilt: 0, bob: 0, lean: 0, breathe: 1};

const Cell: React.FC<{character: Character; theme: Theme; entry: (typeof POSES)[number]; index: number}> = ({character, theme, entry, index}) => {
  const p = PALETTES[theme];
  const arms = armStateAt(60, armKeys(entry.gestures, 30, PLACE), 30, PLACE);
  return <div style={{position: 'absolute', left: index * CELL.w, top: 0, width: CELL.w, height: CELL.h, overflow: 'hidden', background: p.ground}}>
    <div style={{position: 'absolute', left: (CELL.w - 1080 * CELL.scale) / 2, top: -CELL.top * CELL.scale, width: 1080, height: 1920, transform: `scale(${CELL.scale})`, transformOrigin: '0 0'}}>
      <Figure character={character} place={PLACE} pose={{...REST_POSE, ...entry.pose}} arms={arms} accent={p.accent} dark={groundOf(theme) === 'night'} idPrefix={`lab-${theme}-${index}`} waveDeg={entry.name === 'wave' ? 12 : 0} />
    </div>
    <div style={{position: 'absolute', left: 10, top: 8, fontFamily: FAMILY.plexMono, fontSize: 16, color: p.dim}}>{`${theme} / ${entry.name}`}</div>
  </div>;
};

export const CartoonLab: React.FC<CartoonLabProps> = ({character}) => {
  const tokens = characterTokens(character);
  const faces: [string, FacePose][] = [['open', {open: 1, blink: 0, gaze: {gx: 0, gy: 0}, brow: 0.4, turn: 0}], ['closed', {open: 0, blink: 0, gaze: {gx: 0, gy: 0}, brow: 0, turn: 0}],
    ['blink', {open: 0, blink: 1, gaze: {gx: 0, gy: 0}, brow: 0, turn: 0}], ['turn', {open: 0.3, blink: 0, gaze: {gx: 0.9, gy: -0.3}, brow: 0.5, turn: 0.9}]];
  const hands = Object.keys(HAND_POSES) as (keyof typeof HAND_POSES)[];
  return <AbsoluteFill style={{background: '#D8D4CC'}}>
    {THEMES.map((theme, row) => <div key={theme} style={{position: 'absolute', left: 4, top: row * (CELL.h + 4), width: CELL.w * POSES.length, height: CELL.h}}>
      {POSES.map((entry, i) => <Cell key={entry.name} character={character} theme={theme} entry={entry} index={i} />)}
    </div>)}
    <div style={{position: 'absolute', left: 4, top: 3 * (CELL.h + 4), width: 2192, height: 236, background: '#FFFFFF'}}>
      {faces.map(([name, pose], i) => <svg key={name} width={230} height={230} viewBox="110 150 380 440" style={{position: 'absolute', left: i * 240, top: 2}}>
        <Face character={character} tokens={tokens} pose={pose} id={`lab-face-${name}`} />
      </svg>)}
      {hands.flatMap((kind, i) => [false, true].map((mirror) => <svg key={`${kind}-${mirror}`} width={110} height={180} viewBox="-90 -190 180 260" style={{position: 'absolute', left: 980 + (i * 2 + (mirror ? 1 : 0)) * 100, top: 30}}>
        <Hand state={{kind, a1: 0, a2: 0, elbow: {x: 0, y: 140}, wrist: {x: 0, y: 0}, rot: 0, aim: null, since: 0}} mirror={mirror} tokens={tokens} />
      </svg>))}
    </div>
  </AbsoluteFill>;
};
