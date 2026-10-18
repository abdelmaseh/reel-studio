// The whole narrator at one frame: glow, halftone shadow, torso, head (bob and tilt), arms and hands; placed on the canvas by the place transform.
import React from 'react';
import {characterTokens, type Character} from '../../character.ts';
import {RIG, type Arm, type ArmState, type Place} from '../../rig.ts';
import {Face, type FacePose} from './face';
import {Hand} from './hands';
import {Sleeve, Torso} from './outfit';
import {TORSO_D, headSilhouettePaths} from './presets.ts';

export type Pose = FacePose & {tilt: number; bob: number; lean: number; breathe: number};
const f = (n: number, d = 2) => n.toFixed(d);

export const Figure: React.FC<{character: Character; place: Place; pose: Pose; arms: Record<Arm, ArmState>; accent: string; dark: boolean; idPrefix: string; waveDeg?: number}> =
  ({character, place, pose, arms, accent, dark, idPrefix: id, waveDeg = 0}) => {
  const tokens = characterTokens(character);
  const transform = `translate(${f(place.x - place.scale * RIG.chin.x)} ${f(RIG.baseY - place.scale * RIG.chin.y)}) scale(${f(place.scale, 4)}) rotate(${f(pose.lean, 3)} 300 1150)`;
  const headXf = `translate(0 ${f(pose.bob)}) rotate(${f(pose.tilt, 3)} 300 610)`;
  // The arm drawn second sits in front: the pointing (newer) arm is drawn last.
  const order: Arm[] = arms.r.since >= arms.l.since ? ['l', 'r'] : ['r', 'l'];
  return <svg data-cartoon-narrator="true" width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
    <defs>
      <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor={accent} stopOpacity={dark ? 0.55 : 0.42} /><stop offset="1" stopColor={accent} stopOpacity="0" /></radialGradient>
      <pattern id={`${id}-dots`} width="11" height="11" patternUnits="userSpaceOnUse"><circle cx="5.5" cy="5.5" r="2.6" fill={accent} /></pattern>
    </defs>
    <g transform={transform}>
      <circle cx={300} cy={440} r={340} fill={`url(#${id}-glow)`} />
      <g transform="translate(26 18)" opacity={0.9} fill={`url(#${id}-dots)`}><path d={TORSO_D} /><g transform={headXf}>{headSilhouettePaths(character).map((d, i) => <path key={i} d={d} />)}</g></g>
      <Torso character={character} tokens={tokens} breathe={pose.breathe} id={id} />
      <g transform={headXf}><Face character={character} tokens={tokens} pose={pose} id={id} /></g>
      {order.map((arm) => <g key={arm}>
        <Hand state={arms[arm]} mirror={arm === 'l'} tokens={tokens} waveDeg={arms[arm].kind === 'wave' ? waveDeg : 0} />
        <Sleeve character={character} tokens={tokens} state={arms[arm]} arm={arm} />
      </g>)}
    </g>
  </svg>;
};

/** The character's head alone, clipped to a circle: the follow card's avatar. Never a photo. */
export const CharacterHead: React.FC<{character: Character; size: number; idPrefix: string}> = ({character, size, idPrefix: id}) => {
  const tokens = characterTokens(character);
  const pose: FacePose = {open: 0, blink: 0, gaze: {gx: 0, gy: 0}, brow: 0.3, turn: 0};
  return <svg width={size} height={size} viewBox="110 150 380 380" style={{display: 'block'}}>
    <defs><clipPath id={`${id}-circle`}><circle cx={300} cy={340} r={190} /></clipPath></defs>
    <g clipPath={`url(#${id}-circle)`}><circle cx={300} cy={340} r={190} fill={tokens.top.base} /><Face character={character} tokens={tokens} pose={pose} id={id} /></g>
  </svg>;
};
