import React from 'react';
import {useCurrentFrame} from 'remotion';
import world from '../../../maps/data/world.json';
import {fitBounds,ease,type MapData} from '../../../maps/project';
import {MapDrawing,MAP_BOX} from '../../../maps/draw';
import type {MapRouteScene} from './schema';
import {DocumentaryPaper} from './paper';

export const resolvePlace=(place:{name:string;lon?:number;lat?:number})=>{
  if(place.lon!==undefined&&place.lat!==undefined)return {name:place.name,lon:place.lon,lat:place.lat};
  const city=(world as unknown as MapData).places.find(c=>c.name_ar===place.name);if(!city)throw new Error(`No installed city named ${place.name}`);
  return {name:place.name,lon:city.lon,lat:city.lat};
};
export const MapRouteSceneView:React.FC<{scene:MapRouteScene}>=({scene})=>{
  const frame=useCurrentFrame(),d=scene.data,places=d.places.map(resolvePlace);
  const bounds=d.bounds??fitBounds(places.map(p=>[p.lon,p.lat]),MAP_BOX.width/MAP_BOX.height,.55);
  return <DocumentaryPaper title={d.title} caption={d.caption}><MapDrawing data={world as unknown as MapData} bounds={bounds} borders={d.borders} places={places} route progress={ease((frame-d.drawAt)/d.drawDuration)}/></DocumentaryPaper>;
};
