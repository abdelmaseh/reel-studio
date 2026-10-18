// The torso (tee or open overshirt) and the sleeves that follow the arm rig.
import React from 'react';
import type {Character, Tokens} from '../../character.ts';
import {RIG, type ArmState} from '../../rig.ts';
import {NECK_D, OVERSHIRT, SLEEVE, TORSO_D} from './presets.ts';

export const Torso: React.FC<{character: Character; tokens: Tokens; breathe: number; id: string}> = ({character, tokens, breathe, id}) => (
  <g id={`${id}-torso`} transform={`translate(0 700) scale(1 ${breathe.toFixed(4)}) translate(0 -700)`}>
    <linearGradient id={`${id}-neck`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={tokens.neck.shade} stopOpacity="0.7" /><stop offset="0.28" stopColor={tokens.neck.shade} stopOpacity="0" /></linearGradient>
    <path d={NECK_D} fill={tokens.skin.base} /><path d={NECK_D} fill={`url(#${id}-neck)`} />
    <path d={TORSO_D} fill={character.outfit.kind === 'tee' ? tokens.top.base : tokens.under.base} />
    {character.outfit.kind === 'tee' ? <path d="M 258 652 C 270 694 330 694 342 652" fill="none" stroke={tokens.top.shade} strokeWidth={7} strokeLinecap="round" /> : <>
      <path d={OVERSHIRT.left} fill={tokens.top.base} /><path d={OVERSHIRT.right} fill={tokens.top.base} />
      <path d={OVERSHIRT.collarL} fill={tokens.top.deep} /><path d={OVERSHIRT.collarR} fill={tokens.top.deep} />
      <rect x={OVERSHIRT.pocket.x} y={OVERSHIRT.pocket.y} width={OVERSHIRT.pocket.w} height={OVERSHIRT.pocket.h} rx={8} fill={tokens.top.shade} />
      {OVERSHIRT.buttons.map((y) => <circle key={y} cx={238} cy={y} r={7} fill={tokens.top.deep} />)}
    </>}
  </g>
);

/** One sleeve: shoulder to elbow to wrist capsules. A tee stops the sleeve at 60 % of the upper arm and shows the forearm in skin. */
export const Sleeve: React.FC<{character: Character; tokens: Tokens; state: ArmState; arm: 'l' | 'r'}> = ({character, tokens, state, arm}) => {
  const s = RIG.shoulder[arm], e = state.elbow, w = state.wrist, tee = character.outfit.kind === 'tee';
  const stop = tee ? {x: s.x + (e.x - s.x) * 0.6, y: s.y + (e.y - s.y) * 0.6} : e;
  const f = (n: number) => n.toFixed(2);
  return <g>
    <line x1={f(e.x)} y1={f(e.y)} x2={f(w.x)} y2={f(w.y)} stroke={tee ? tokens.skin.base : tokens.top.base} strokeWidth={2 * (tee ? SLEEVE.wrist - 6 : SLEEVE.wrist)} strokeLinecap="round" />
    {!tee ? <circle cx={f(w.x)} cy={f(w.y)} r={SLEEVE.cuff + 4} fill={tokens.under.base} /> : null}
    {tee ? <line x1={f(stop.x)} y1={f(stop.y)} x2={f(e.x)} y2={f(e.y)} stroke={tokens.skin.base} strokeWidth={2 * (SLEEVE.elbow - 6)} strokeLinecap="round" /> : null}
    <line x1={s.x} y1={s.y} x2={f(stop.x)} y2={f(stop.y)} stroke={tokens.top.base} strokeWidth={2 * SLEEVE.shoulder} strokeLinecap="round" />
    {!tee ? <line x1={f(stop.x)} y1={f(stop.y)} x2={f(e.x)} y2={f(e.y)} stroke={tokens.top.base} strokeWidth={2 * SLEEVE.elbow} strokeLinecap="round" /> : null}
  </g>;
};
