import React from 'react';
import {useCurrentFrame} from 'remotion';
import world from '../../../maps/data/world.json';
import {countryFocus,ease,fitBounds,type Bounds,type MapData} from '../../../maps/project';
import {MapDrawing,MAP_BOX} from '../../../maps/draw';
import type {MapFocusScene} from './schema';
import {resolvePlace} from './map-route';
import {DocumentaryPaper} from './paper';

export const MapFocusSceneView:React.FC<{scene:MapFocusScene}>=({scene})=>{
  const frame=useCurrentFrame(),d=scene.data,map=world as unknown as MapData;
  const target=d.target;
  const country='country' in target?map.countries.find(c=>c.name_ar===target.country):undefined;
  const place='name' in d.target?resolvePlace(d.target):null;
  const focus=country?countryFocus(country.polygons):null;
  const extent=focus?fitBounds(focus.points,MAP_BOX.width/MAP_BOX.height,.4):fitBounds(place?[[place.lon-4,place.lat-4],[place.lon+4,place.lat+4]]:[],MAP_BOX.width/MAP_BOX.height);
  const start=d.bounds??extent,cx=(extent[0]+extent[2])/2,cy=(extent[1]+extent[3])/2;
  const width=(extent[2]-extent[0])/d.zoom,height=(extent[3]-extent[1])/d.zoom;
  const end:Bounds=[cx-width/2,cy-height/2,cx+width/2,cy+height/2];
  const t=ease((frame-d.focusAt)/d.focusDuration);const bounds=start.map((n,i)=>n+(end[i]-n)*t) as Bounds;
  return <DocumentaryPaper title={d.title} caption={d.caption}><MapDrawing data={map} bounds={bounds} borders={d.borders} focusCountry={country?.name_ar} places={place?[place]:[{name:country?.name_ar??'',lon:focus?.anchor[0]??cx,lat:focus?.anchor[1]??cy}]}/></DocumentaryPaper>;
};
