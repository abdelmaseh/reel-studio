import React from 'react';
import {ClipReveal} from '../mask';
import {useProbe} from '../safe';
import type {TransitionProps} from '../../prepared-edit/transition-registry';
export const Keyhole:React.FC<TransitionProps>=p=>{
  const probe=useProbe();
  if(probe!==null)return <>{p.children}</>;
  return <ClipReveal shape="keyhole" origin={p.origin??{x:.5,y:.5}} dir={p.dir??'rtl'} at={p.atFrame} durF={p.durationInFrames} box={p.box}>{p.children}</ClipReveal>;
};
