import React from 'react';
import type {FamilyDesignProps} from '../../family-designs';
import {NAVY,Page,Headline,Lines,Kicker,MagazineScope,useMagazine,useType} from './kit';
import {magazineCopy} from './copy';

const Drawing: React.FC<{d: {kicker: string; title: string; subtitle: string}; n?: string}> = ({d}) => {
  const {copy}=useMagazine();
  const {fit,planHeadline}=useType();
  const plan = planHeadline(d.title, {drop: true, max: 150, min: 64, lines: 4, maxHeight: 650});
  const top = 430;
  const subTop = top + plan.height + 70;
  const sub = fit(d.subtitle, {width: 800, size: 48, min: 34, lines: 2, weight: 400});
  return <Page th={NAVY} section={magazineCopy('opening',copy)} page="02">
    <Kicker th={NAVY} text={d.kicker} top={352} at={4}/>
    <Headline plan={plan} th={NAVY} top={top} at={10} marker markerAt={46}/>
    <Lines text={d.subtitle} top={subTop} width={800} size={sub.size} min={34} lines={2} weight={400} color={NAVY.dim} at={44}/>
  </Page>;
};

export const Intro:React.FC<FamilyDesignProps>=({scene})=>{
  if(scene.family!=='intro')return null;
  return <MagazineScope data={scene.data}><Drawing d={scene.data}/></MagazineScope>;
};
