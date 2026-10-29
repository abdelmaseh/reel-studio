// Library previews have no footage, so the layered-speaker card draws an abstract speaker instead: a head and shoulders shape with no
// features, in the place a close-up speaker usually sits. The scene draws its big word behind this shape the same way it does behind a matte.
// Nothing here claims a person, a face or a recording.
import React from 'react';
import { DEFAULT_HEAD } from '../styles/layered-speaker/scenes/math.ts';

export const LAYERED_PREVIEW_HEAD = DEFAULT_HEAD;

const cx = DEFAULT_HEAD.x + DEFAULT_HEAD.width / 2;
const cy = DEFAULT_HEAD.y + DEFAULT_HEAD.height / 2;

/** The room behind the speaker: a flat cool backdrop with a faint diagonal texture. */
export const LayeredStandInRoom: React.FC = () => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, background: 'linear-gradient(160deg,#1B2832,#2A3C47)' }}>
    <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg,#ffffff08 0px,#ffffff08 2px,transparent 2px,transparent 38px)' }} />
    <div style={{ position: 'absolute', left: 120, right: 170, top: 1500, color: '#9EB4BC', fontFamily: 'IBM Plex Mono', fontSize: 22, textAlign: 'center' }}>ABSTRACT PLACEHOLDER · NO PERSON</div>
  </div>
);

/** The head and shoulders shape, drawn above the big word. */
export const LayeredStandInSpeaker: React.FC = () => (
  <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
    <ellipse cx={cx} cy={cy + 380} rx={430} ry={300} fill="#3A4B58" />
    <rect x={cx - 62} y={cy + 130} width={124} height={170} fill="#34444F" />
    <ellipse cx={cx} cy={cy} rx={DEFAULT_HEAD.width / 2 - 45} ry={DEFAULT_HEAD.height / 2 - 45} fill="#46596A" />
  </svg>
);
