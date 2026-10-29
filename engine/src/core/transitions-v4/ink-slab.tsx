import React from 'react';
import {Easing, useCurrentFrame} from 'remotion';
import {LayerBox} from '../mask';
import {useProbe} from '../safe';
import type {TransitionProps} from '../../prepared-edit/transition-registry';
import {INK, LIME, PaperFx} from '../../styles/kinetic-paper/designs/kit';
import {edgePictureMasks} from './picture-mask';

export const SLAB_W = 560, SLAB_FRAMES = 12;
/** Pilot coordinates, including the 40 px overscan. Not a centred hard-cut overlay. */
export const slabEdges = (frame: number) => {
  const p = Easing.bezier(0.7, 0, 0.25, 1)(Math.max(0, Math.min(1, frame / SLAB_FRAMES)));
  const lead = 1120 - 1680 * p;
  return {lead, trail: lead + SLAB_W, p};
};
export const inkSlabPictureMasks = (local:number,duration:number,width=1080) => {
  const {lead,trail}=slabEdges(local/Math.max(1,duration)*SLAB_FRAMES);
  return edgePictureMasks(trail*width/1080,lead*width/1080,width);
};

export const InkSlab: React.FC<TransitionProps> = props => {
  const frame = useCurrentFrame();
  const probe = useProbe();
  if (probe !== null) return <>{props.children}</>;
  const local = (frame - props.atFrame) / Math.max(1, props.durationInFrames) * SLAB_FRAMES;
  const {lead} = slabEdges(local);
  const box = props.box ?? {x: 0, y: 0, width: 1080, height: 1920};
  const sx = box.width / 1080;
  return <LayerBox box={box} clip>
    <div data-ink-slab-incoming="" style={{position: 'absolute', inset: 0, clipPath: local < SLAB_FRAMES ? inkSlabPictureMasks(frame-props.atFrame,props.durationInFrames,box.width).incoming : undefined}}>{props.children}</div>
    {local >= 0 && local <= SLAB_FRAMES ? <>
      <div style={{position: 'absolute', top: 0, height: box.height, left: (lead + 34) * sx, width: (SLAB_W - 34) * sx, background: INK, overflow: 'hidden'}}><PaperFx/></div>
      <div style={{position: 'absolute', top: 0, height: box.height, left: lead * sx, width: 34 * sx, background: LIME}}/>
    </> : null}
  </LayerBox>;
};
