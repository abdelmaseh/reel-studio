import type {ArabicTypeMove} from './schema.ts';
export interface TypeFontGate {studioReady:()=>boolean;nextFrame:()=>Promise<void>;load:(css:string,text:string)=>Promise<unknown>;check:(css:string,text:string)=>boolean}
/** Registration is separate from FontFaceSet.load: an unregistered face can otherwise resolve as an empty list. */
export async function awaitTypeFont(css:string,text:string,gate:TypeFontGate):Promise<void>{
  while(!gate.studioReady())await gate.nextFrame();
  await gate.load(css,text);
  if(!gate.check(css,text))throw new Error('Arabic type selected font is not loaded');
}
export function resolveArabicFont(sceneFont:string|undefined,preferred:string|null,move:ArabicTypeMove,available:readonly string[]):string{
  const desired=sceneFont??preferred??(move==='kufi-tiles'?'Noto Kufi Arabic':move==='pen-write'?'Noto Naskh Arabic':'Cairo');
  return available.includes(desired)?desired:'Cairo';
}
