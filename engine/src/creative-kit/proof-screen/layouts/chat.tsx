import React from 'react';
import type {ProofLayoutProps} from './web.tsx';
import {proofLayoutGeometry} from './geometry.ts';

// Alternating visual alignment is a layout choice, never a fabricated sender name or timestamp.
export const ChatLayout:React.FC<ProofLayoutProps>=({blocks,renderBlock})=>{
  const {width,height}=proofLayoutGeometry('chat',blocks.length);
  return <div data-proof-layout="chat" style={{display:'flex',flexDirection:'column',gap:10}}>
    {blocks.map((_,index)=><div key={index} style={{alignSelf:index%2?'flex-end':'flex-start'}}>{renderBlock(index,width,height)}</div>)}
  </div>;
};
