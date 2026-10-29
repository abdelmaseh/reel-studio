import type {ProofScreenData,ProofScreenSceneSpec} from './schema.ts';

// One second for the camera, then at least one second to read the settled page.
export const proofFocusFrame=(fps:number)=>Math.ceil(fps);
export function validateProofScreenTiming(scene:ProofScreenSceneSpec,fps=30):string[]{
  return scene.durationInFrames<Math.ceil(fps*2)?[`${scene.id}: Proof Screen needs two seconds for the camera and readable hold`]:[];
}
export function proofCameraAt(frame:number,fps:number,path:ProofScreenData['path']='tilt-in',probe=false){
  if(probe)return {x:0,y:0,scale:1,rotateX:0,rotateY:0};
  const t=Math.max(0,Math.min(1,frame/proofFocusFrame(fps))),ease=1-(1-t)**3;
  if(path==='glide')return {x:24*(1-ease),y:0,scale:1,rotateX:2*(1-ease),rotateY:-8+10*ease};
  if(path==='focus')return {x:0,y:0,scale:.96+.08*ease,rotateX:5*(1-ease),rotateY:-6*(1-ease)};
  return {x:0,y:16*(1-ease),scale:.94+.06*ease,rotateX:10*(1-ease),rotateY:-8*(1-ease)};
}
