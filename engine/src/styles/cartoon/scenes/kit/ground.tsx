// Grounds of the three acts: a flat fill, a faint 54 px grid, and dot fields (a bottom halftone on light acts, accent blobs on dark and pink acts).
// The reveal stacks the previous ground under the new one and clips the new one with a circle that opens from the narrator's head.
// Under the safe-zone probe only the flat fill remains (in the probe colour); textures are decoration.
import React from 'react';
import {CanvasFill, SafeExempt} from '../../../../core/safe';
import {H, PALETTES, REVEAL, W, groundOf, revealRadius, type Theme} from '../math.ts';

const dots = (color: string, pitch: number, radius: number): string => `radial-gradient(circle, ${color} ${radius}px, transparent ${radius + 0.6}px) 0 0 / ${pitch}px ${pitch}px`;
const grid = (color: string): string => `repeating-linear-gradient(0deg, ${color} 0 1.5px, transparent 1.5px 54px), repeating-linear-gradient(90deg, ${color} 0 1.5px, transparent 1.5px 54px)`;
const BLOB_MASK = 'radial-gradient(circle, #000 0%, rgba(0,0,0,0.85) 30%, transparent 70%)';
const FADE_UP = 'linear-gradient(180deg, transparent 0%, #000 40%)';

const Blob: React.FC<{x: number; y: number; r: number; color: string; pitch?: number; dot?: number}> = ({x, y, r, color, pitch = 16, dot = 4}) => (
  <div style={{position: 'absolute', left: x - r, top: y - r, width: 2 * r, height: 2 * r, background: dots(color, pitch, dot), WebkitMaskImage: BLOB_MASK, maskImage: BLOB_MASK}} />
);

/** One act's ground. Static inside an act; only the reveal animates. The grid is anchored at the bottom-left corner. */
export const Ground: React.FC<{theme: Theme}> = ({theme}) => {
  const p = PALETTES[theme], night = groundOf(theme) === 'night';
  return <CanvasFill background={p.ground}>
    <SafeExempt>
      <div style={{position: 'absolute', inset: 0, backgroundImage: grid(night ? 'rgba(255,255,255,0.045)' : 'rgba(20,20,20,0.05)'), backgroundPosition: '0 100%'}} />
      {theme === 'light' ? <div style={{position: 'absolute', left: 0, right: 0, top: 980, bottom: 0, background: dots('rgba(20,20,20,0.16)', 18, 2.3), WebkitMaskImage: FADE_UP, maskImage: FADE_UP}} /> : null}
      {theme === 'dark' ? <><Blob x={60} y={300} r={420} color="rgba(213,245,59,0.55)" /><Blob x={1040} y={1500} r={460} color="rgba(213,245,59,0.42)" /></> : null}
      {theme === 'pink' ? <><Blob x={120} y={1330} r={520} color="rgba(255,61,139,0.75)" pitch={18} dot={5} /><Blob x={1000} y={360} r={360} color="rgba(213,245,59,0.85)" pitch={16} dot={4.5} /></> : null}
    </SafeExempt>
  </CanvasFill>;
};

/** The previous ground, then the new one inside a hard-edged circle of radius revealRadius(seconds) at the head. */
export const GroundStack: React.FC<{theme: Theme; prevTheme: Theme | null; seconds: number; origin: {x: number; y: number}}> = ({theme, prevTheme, seconds, origin}) => {
  if (prevTheme === null || seconds >= REVEAL.seconds || seconds < 0) return <Ground theme={theme} />;
  const r = revealRadius(seconds).toFixed(1);
  return <>
    <Ground theme={prevTheme} />
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, clipPath: `circle(${r}px at ${origin.x.toFixed(1)}px ${origin.y.toFixed(1)}px)`}}><Ground theme={theme} /></div>
  </>;
};
