// The head: face, ears, nose, eyes, brows, mouth, optional glasses, beard, hair and headwear. The order keeps the mouth above the beard and the
// hair above the face. Every SVG id carries the scene prefix so two cartoon scenes in one document never collide.
import React from 'react';
import type {Character, Tokens} from '../../character.ts';
import {BEARD_D, BROW_L, BROW_R, EAR, EYE, FACE_D, HAIR, HEADWEAR, LENS, MOUSTACHE_D, MOUTH, NOSE_D} from './presets.ts';

export type FacePose = {open: number; blink: number; gaze: {gx: number; gy: number}; brow: number; turn: number};
const shift = (turn: number, weight: number): string => `translate(${(turn * weight).toFixed(2)} 0)`;

const Eye: React.FC<{c: {x: number; y: number}; pose: FacePose; tokens: Tokens; id: string}> = ({c, pose, tokens, id}) => {
  const sy = Number(Math.max(0.08, 1 - pose.blink).toFixed(3));
  const ix = c.x + pose.gaze.gx * 5, iy = c.y + pose.gaze.gy * 3.2 - 1;
  return <g transform={`translate(${c.x} ${c.y}) scale(1, ${sy}) translate(${-c.x} ${-c.y})`}>
    <clipPath id={`${id}-clip`}><ellipse cx={c.x} cy={c.y} rx={EYE.rx} ry={EYE.ry} /></clipPath>
    <ellipse cx={c.x} cy={c.y} rx={EYE.rx} ry={EYE.ry} fill="#FBF8F3" />
    <g clipPath={`url(#${id}-clip)`}>
      <circle cx={ix.toFixed(2)} cy={iy.toFixed(2)} r={EYE.iris} fill={tokens.iris.outer} /><circle cx={ix.toFixed(2)} cy={iy.toFixed(2)} r={EYE.inner} fill={tokens.iris.mid} />
      <circle cx={ix.toFixed(2)} cy={iy.toFixed(2)} r={EYE.pupil} fill={tokens.iris.pupil} /><circle cx={(ix - 4).toFixed(2)} cy={(iy - 4).toFixed(2)} r={2.5} fill="#FFFFFF" />
    </g>
    <path d={`M ${c.x - EYE.rx} ${c.y} Q ${c.x} ${c.y - EYE.ry - 4} ${c.x + EYE.rx} ${c.y}`} fill="none" stroke={tokens.hair.base} strokeWidth={2.2} opacity={0.6} />
  </g>;
};

const Mouth: React.FC<{open: number; tokens: Tokens}> = ({open, tokens}) => {
  const d = MOUTH.depth * Math.max(0, Math.min(1, open));
  if (d < 1.2) return <g>
    <path d={`M ${MOUTH.closedL} ${MOUTH.y} Q 300 ${MOUTH.y + 13} ${MOUTH.closedR} ${MOUTH.y}`} fill="none" stroke={tokens.lips.deep} strokeWidth="5.5" strokeLinecap="round" />
    <path d={`M ${MOUTH.closedL} ${MOUTH.y + 7} Q 300 ${MOUTH.y + 16} ${MOUTH.closedR} ${MOUTH.y + 7}`} fill="none" stroke={tokens.lips.base} strokeWidth={2} opacity={0.6} />
  </g>;
  const bottom = MOUTH.y + 8 + 1.15 * d, top = MOUTH.y - 2, mid = (top + bottom) / 2;
  const shape = `M ${MOUTH.openL} ${top} Q 300 ${top - 4} ${MOUTH.openR} ${top} Q ${MOUTH.openR + 4} ${mid.toFixed(2)} 300 ${bottom.toFixed(2)} Q ${MOUTH.openL - 4} ${mid.toFixed(2)} ${MOUTH.openL} ${top} Z`;
  return <g>
    <path d={shape} fill="#4A1B18" stroke={tokens.lips.base} strokeWidth={4} />
    <path d={`M ${MOUTH.openL + 6} ${top + 2} H ${MOUTH.openR - 6} V ${(MOUTH.y + 8 + 0.28 * d).toFixed(2)} H ${MOUTH.openL + 6} Z`} fill="#FBF8F3" />
    <ellipse cx={300} cy={(bottom - 7).toFixed(2)} rx={16} ry={Math.min(7, d / 3).toFixed(2)} fill="#C85A5C" />
  </g>;
};

export const Face: React.FC<{character: Character; tokens: Tokens; pose: FacePose; id: string}> = ({character, tokens, pose, id}) => {
  const hair = HAIR[character.hair.style], hijab = character.headwear.kind === 'hijab', cap = character.headwear.kind === 'cap';
  return <g id={`${id}-head`}>
    {hair.back && !hijab ? <path d={hair.back} fill={tokens.hair.base} /> : null}
    {hijab ? <path d={HEADWEAR.hijab.outer} fill={tokens.head.base} /> : null}
    {!hijab ? <><ellipse cx={EAR.l.cx} cy={EAR.l.cy} rx={EAR.rx} ry={EAR.ry} fill={tokens.skin.base} /><ellipse cx={EAR.r.cx} cy={EAR.r.cy} rx={EAR.rx} ry={EAR.ry} fill={tokens.skin.base} />
      <ellipse cx={EAR.l.cx + 2} cy={EAR.l.cy} rx={EAR.rx * 0.45} ry={EAR.ry * 0.5} fill={tokens.skin.shade} /><ellipse cx={EAR.r.cx - 2} cy={EAR.r.cy} rx={EAR.rx * 0.45} ry={EAR.ry * 0.5} fill={tokens.skin.shade} /></> : null}
    <path id={`${id}-face`} d={FACE_D} fill={tokens.skin.base} />
    <circle cx={222} cy={452} r={24} fill={tokens.skin.blush} opacity={0.32} /><circle cx={378} cy={452} r={24} fill={tokens.skin.blush} opacity={0.32} />
    <g transform={shift(pose.turn, 8)}><path d={NOSE_D} fill={tokens.skin.shade} /></g>
    {character.beard.kind === 'full' ? <g transform={shift(pose.turn, 4)}><path d={BEARD_D} fill={tokens.beard.base} /></g> : null}
    <g transform={shift(pose.turn, 3)}><Mouth open={pose.open} tokens={tokens} />{character.beard.kind === 'full' ? <path d={MOUSTACHE_D} fill={tokens.beard.deep} /> : null}</g>
    <g transform={shift(pose.turn, 9)}>
      <Eye c={EYE.l} pose={pose} tokens={tokens} id={`${id}-eye-l`} /><Eye c={EYE.r} pose={pose} tokens={tokens} id={`${id}-eye-r`} />
      <g transform={`translate(0 ${(-pose.brow * 7).toFixed(2)})`}><path d={BROW_L} fill="none" stroke={tokens.hair.base} strokeWidth={9} strokeLinecap="round" /><path d={BROW_R} fill="none" stroke={tokens.hair.base} strokeWidth={9} strokeLinecap="round" /></g>
      {character.glasses.kind === 'rect' ? <g fill="none" stroke={tokens.frame.base} strokeWidth={7} strokeLinejoin="round">
        {[LENS.left, LENS.right].map((x) => <React.Fragment key={x}>
          <rect x={x} y={LENS.y} width={LENS.w} height={LENS.h} rx={LENS.r} fill="rgba(200,226,222,0.13)" />
          <path d={`M ${x + LENS.r} ${LENS.y} H ${x + LENS.w - LENS.r}`} strokeWidth={LENS.top} />
          <path d={`M ${x + 16} ${LENS.y + 18} h 28`} stroke={tokens.frame.hi} strokeWidth={3} />
        </React.Fragment>)}
        <path d={`M ${LENS.left + LENS.w} 360 Q 300 350 ${LENS.right} 360`} /><path d={`M ${LENS.left} 374 L 150 374 M ${LENS.right + LENS.w} 374 L 450 374`} />
      </g> : null}
    </g>
    {hair.front && !hijab ? <g><path d={hair.front} fill={tokens.hair.base} />{hair.highlights.map((d, i) => <path key={i} d={d} fill="none" stroke={tokens.hair.hi} strokeWidth={8} strokeLinecap="round" opacity={0.8} />)}</g> : null}
    {cap && !hijab ? <g><path d={HEADWEAR.cap.crown} fill={tokens.head.base} /><path d={HEADWEAR.cap.visor} fill={tokens.head.shade} /></g> : null}
    {hijab ? <path d={HEADWEAR.hijab.fold} fill="none" stroke={tokens.head.shade} strokeWidth={6} strokeLinecap="round" opacity={0.6} /> : null}
  </g>;
};
