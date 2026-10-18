// One hand at the wrist. Every segment is drawn once with the outline stroke and once with the skin fill, so each digit has one clean outline.
import React from 'react';
import type {Tokens} from '../../character.ts';
import {RIG, type ArmState} from '../../rig.ts';
import {HAND_POSES, type Digit} from './presets.ts';

const OUTLINE = 1.7;
const capsule = (d: Digit, stroke: string, extra: number, key: string): React.ReactElement =>
  <line key={key} x1={d.from[0]} y1={d.from[1]} x2={d.to[0]} y2={d.to[1]} stroke={stroke} strokeWidth={2 * (d.r + extra)} strokeLinecap="round" />;

export const Hand: React.FC<{state: ArmState; mirror: boolean; tokens: Tokens; waveDeg?: number}> = ({state, mirror, tokens, waveDeg = 0}) => {
  const pose = HAND_POSES[state.kind];
  const forearm = (Math.atan2(state.wrist.y - state.elbow.y, state.wrist.x - state.elbow.x) * 180) / Math.PI + 90;
  // Pointing, thumbs and waves turn toward their aim in canvas space; the others follow the forearm.
  const aimed = (state.kind === 'point' || state.kind === 'thumb' || state.kind === 'wave') && state.aim !== null;
  const rot = (aimed ? state.rot : forearm) + waveDeg;
  const s = RIG.handScale, p = pose.palm;
  const palm = (fill: string, extra: number) => <rect x={-p.w / 2 - extra} y={-p.h + 10 - extra} width={p.w + 2 * extra} height={p.h + 2 * extra} rx={p.r + extra} fill={fill} />;
  return <g transform={`translate(${state.wrist.x.toFixed(2)} ${state.wrist.y.toFixed(2)}) rotate(${rot.toFixed(2)}) scale(${mirror ? -s : s} ${s})`}>
    {palm(tokens.skin.line, OUTLINE)}{pose.digits.map((d, i) => capsule(d, tokens.skin.line, OUTLINE, `o${i}`))}
    {palm(tokens.skin.base, 0)}{pose.digits.map((d, i) => capsule(d, tokens.skin.base, 0, `f${i}`))}
    {pose.digits.slice(0, 4).map((d, i) => <circle key={`k${i}`} cx={d.from[0]} cy={d.from[1] - 4} r={2.2} fill={tokens.skin.shade} />)}
  </g>;
};
