import React from 'react';
import {useProbe} from '../core/safe';
import {FAMILY} from '../core/fonts';
import {fitToWidth} from '../core/type';
import {displayDigits} from '../core/digits';
import {useDigits} from '../creative-kit/digits';
import {polygonPath,project,routeAt,clamp01,type Bounds,type Position,type MapData} from './project.ts';

export const MAP_BOX={left:110,top:500,width:740,height:610} as const;
export const MapDrawing:React.FC<{data:MapData;bounds:Bounds;borders?:boolean;places?:{name:string;lon:number;lat:number}[];progress?:number;route?:boolean;focusCountry?:string}>=({data,bounds,borders=false,places=[],progress=1,route=false,focusCountry})=>{
  const probe=useProbe(),digits=useDigits();const {width,height}=MAP_BOX;
  const points:Position[]=places.map(p=>{const q=project([p.lon,p.lat],bounds,width,height);return [q.x,q.y];});
  const p=clamp01(progress),marker=points.length?routeAt(points,p):null;
  const mode=borders&&data.mode==='countries'?'countries':'no-borders';
  return <svg data-map-mode={mode} style={{position:'absolute',...MAP_BOX,overflow:'hidden',background:probe?'transparent':'#CCD8D5'}} viewBox={`0 0 ${width} ${height}`}>
    {!probe?<>
      {/* With borders the country outlines draw the coast; a second, coarser land outline would double it. */}
      {data.land.map((rings,i)=><path key={i} d={polygonPath(rings,bounds,width,height)} fill="#DBD2B8" fillRule="evenodd" stroke={mode==='countries'?'none':'#8C8B75'} strokeWidth={1.3}/>)}
      {mode==='countries'?data.countries.map(c=><path data-country-border key={c.id} d={c.polygons.map(r=>polygonPath(r,bounds,width,height)).join(' ')} fill={c.name_ar===focusCountry?'#D4AD82':data.land.length?'none':'#DBD2B8'} fillRule="evenodd" stroke="#86765F" strokeWidth={1.4}/>):null}
    </>:null}
    {route&&points.length>1?<>
      <polyline data-route points={points.map(q=>q.join(',')).join(' ')} fill="none" stroke="#A52B25" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1-p}/>
      {marker?<circle cx={marker[0]} cy={marker[1]} r={8} fill="#A52B25" stroke="#FFFCF3" strokeWidth={3}/>:null}
    </>:null}
    {points.map(([x,y],i)=>{
      // Keep labels inside the map, even at its edges. Each label is one shaped Arabic run.
      const labelX=Math.max(118,Math.min(width-118,x));const labelY=Math.max(60,Math.min(height-22,y-24));
      const name=displayDigits(places[i].name,digits),fit=fitToWidth(name,{fontFamily:FAMILY.tajawal,fontSize:24,fontWeight:700},206,{min:14,max:24});
      if(!fit.fits)throw new Error('Documentary city label is too long; shorten the authored name');
      return <g key={i}><circle cx={x} cy={y} r={7} fill="#28251F" stroke="#FFFCF3" strokeWidth={3}/>
        <rect x={labelX-111} y={labelY-31} width={222} height={46} fill="#FFFCF3"/>
        <text x={labelX} y={labelY} textAnchor="middle" direction="rtl" unicodeBidi="plaintext" fontFamily={FAMILY.tajawal} fontSize={fit.fontSize} fontWeight={700} fill="#28251F">{name}</text></g>;
    })}
  </svg>;
};
