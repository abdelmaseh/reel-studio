import React from 'react';
import type {TransitionProps} from '../../prepared-edit/transition-registry';
import {useOverlay} from './shared';
import {C, clamp01, INOUT3, cut, pstr, lighten, PaperDefs, Tape, type Pt} from '../../styles/paper-collage/designs/kit';

// The sheet is opaque at the scene boundary, halfway through this centered overlay.
export const PaperSwap: React.FC<TransitionProps> = p => {
  const {progress, live} = useOverlay(p);
  if (!live) return null;
  return <div data-transition="paper-swap" style={{position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none'}}><PaperDefs/><PaperSwapDrawing frame={progress * p.durationInFrames} len={p.durationInFrames}/></div>;
};
const PaperSwapDrawing: React.FC<{frame: number; len?: number}> = ({frame, len = 14}) => {
  const p = clamp01(frame / len);
  const q = INOUT3(p);
  const PW = 1560, PH = 2500;
  const cx = 540 + (1 - 2 * q) * 1500;
  const rot = 5.5 * (1 - 2 * q);
  const shape = React.useMemo(() => {
    const verts: Pt[] = [[0, 0], [PW, 0], [PW, PH], [0, PH]];
    return cut(verts, 'swap', 5.5, 130);
  }, []);
  return <div style={{position: 'absolute', left: cx - PW / 2, top: 960 - PH / 2, width: PW, height: PH, zIndex: 100, transform: `rotate(${rot}deg)`,
    filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.22)) drop-shadow(0 0 70px rgba(0,0,0,0.42))'}}>
    <svg width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <polygon points={pstr(shape)} fill={C.teal}/>
      <polygon points={pstr(shape)} fill="#fff" filter="url(#rs-tooth)" style={{mixBlendMode: 'overlay'}} opacity={0.3}/>
      <polygon points={pstr(shape)} fill="none" stroke={lighten(C.teal, 0.5)} strokeWidth={2} opacity={0.9}/>
    </svg>
    <Tape cx={430} cy={1010} len={230} h={64} rot={-24} at={-100} id="swap-1"/>
    <Tape cx={1150} cy={1500} len={230} h={64} rot={-18} at={-100} id="swap-2"/>
  </div>;
};
