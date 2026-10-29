import React from 'react';
import {Solid} from 'remotion';
import {pixelDissolve} from '@remotion/effects/pixel-dissolve';
import {PIXEL_CURTAIN} from '../../looks/effects.ts';
import {useOverlay} from './shared';
import type {TransitionProps} from '../../prepared-edit/transition-registry';

/** How much of the curtain has dissolved at an overlay progress (0 to 1, the cut at .5): 1 = gone, 0 = every cell there. It builds, is whole at the cut, and dissolves away. */
export const curtainDissolve=(progress:number):number=>progress<=.5?1-progress*2:(progress-.5)*2;

/**
 * Pixel curtain: a curtain in the style's background colour builds from nothing out of square cells, covers the whole frame at `atFrame`, and
 * dissolves away cell by cell to show the incoming scene. A single <Solid> with the pixel-dissolve effect (the cells are about 45 px on the
 * 1080 x 1920 frame; the seed fixes which cell goes first), so it needs no filter and nothing is applied to the scenes under it. Half the
 * duration lies before `atFrame` and half after, like every centred overlay. Nothing is drawn under the safe-zone probe.
 */
export const PixelCurtain:React.FC<TransitionProps>=p=>{
  const {progress,live}=useOverlay(p);
  if(!live)return null;
  return <div data-transition="pixel-curtain" data-cut-cover={progress===.5?'full':undefined} style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden'}}>
    <Solid width={1080} height={1920} color={p.paper??PIXEL_CURTAIN.fallback} style={{position:'absolute',left:0,top:0}}
      effects={[pixelDissolve({progress:curtainDissolve(progress),columns:PIXEL_CURTAIN.columns,rows:PIXEL_CURTAIN.rows,seed:PIXEL_CURTAIN.seed,feather:PIXEL_CURTAIN.feather})]}/>
  </div>;
};
