import React from 'react';
import type {ProofScreenData} from '../schema.ts';
import {proofLayoutGeometry} from './geometry.ts';

export type ProofLayoutProps={blocks:ProofScreenData['blocks'];renderBlock:(index:number,width:number,height:number)=>React.ReactNode};
export const WebLayout:React.FC<ProofLayoutProps>=({blocks,renderBlock})=>{
  const {width,height}=proofLayoutGeometry('web',blocks.length);
  return <div data-proof-layout="web" style={{display:'flex',flexDirection:'column',gap:10}}>
    {blocks.map((_,index)=><React.Fragment key={index}>{renderBlock(index,width,height)}</React.Fragment>)}
  </div>;
};
