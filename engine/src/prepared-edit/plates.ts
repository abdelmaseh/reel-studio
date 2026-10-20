import {sceneMovingSources} from '../core/scene-media.ts';
import type {ProjectScenes} from '../core/scene-media.ts';

export function preparedPlateList(edit:{scenes:readonly {family:string;data?:unknown}[];projectScenes?:ProjectScenes},plateSrc:string):string[]{
  const foregrounds:string[]=[],captures:string[]=[];
  for(const scene of edit.scenes){
    const moving=sceneMovingSources(scene,edit.projectScenes);
    foregrounds.push(...moving.foreground);
    captures.push(...moving.captures);
  }
  return [plateSrc,...new Set([...foregrounds,...captures])];
}
