import React from 'react';
import type {ProofLayoutProps} from './web.tsx';
import {proofLayoutGeometry} from './geometry.ts';

export const DashboardLayout:React.FC<ProofLayoutProps>=({blocks,renderBlock})=>{
  const {width,height}=proofLayoutGeometry('dashboard',blocks.length);
  return <div data-proof-layout="dashboard" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
    {blocks.map((_,index)=><React.Fragment key={index}>{renderBlock(index,width,height)}</React.Fragment>)}
  </div>;
};
