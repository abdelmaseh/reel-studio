import type {ArabicTypeData} from './schema.ts';

/** Conservative raster bounds keep dots/pen strokes inside the scene without browser measurement in validation. */
export function arabicTypeIntroSeconds(data: Pick<ArabicTypeData,'move'|'text'|'to'|'stamp'>): number {
  const n=Array.from(data.text.replace(/\s/g,'')).length;
  const words=data.text.trim().split(/\s+/).length;
  switch(data.move) {
    case 'decrypt':return .35 + .16*Math.max(0,Array.from(data.text).length-1) + .3;
    case 'echo-stack':return .6;
    case 'redacted-stamp':return .9 + .7*(words-1) + .3 + (data.stamp ? .65 : 0);
    case 'unblur':return .22*(words-1) + .75;
    case 'word-melt':return 1.8;
    case 'pen-write':return .5 + .36*n;
    case 'video-in-letters':return 3;
    case 'dots-drop':return .35 + .24*n + .42 + .3;
    case 'letters-snap':return Math.max(1.3,.06*(n-1)+.35)+.25;
    case 'kufi-tiles':return Math.max(2.8,.3+.018*(16*n-1)+.03+.22+.6+.4);
    case 'kashida-stretch':return 3.15;
  }
}
/** Minimum includes a readable resolved state and the longest move-specific exit window. */
export function arabicTypeMinimumSeconds(data:Pick<ArabicTypeData,'move'|'text'|'to'|'stamp'>):number{
  const outro:Record<ArabicTypeData['move'],number>={'dots-drop':.7,'pen-write':.8,'letters-snap':.7,'kufi-tiles':.5,'kashida-stretch':.3,
    decrypt:.4,'echo-stack':.7,'redacted-stamp':.3,'word-melt':1.3,'video-in-letters':0,unblur:.4};
  return Math.max(data.move==='word-melt'?4.2:0,arabicTypeIntroSeconds(data)+.6+outro[data.move]);
}
export function validateArabicTypeTiming(scene: {id:string;durationInFrames:number;data:Pick<ArabicTypeData,'move'|'text'|'to'|'stamp'>},fps=30):string[] {
  const min=Math.ceil(arabicTypeMinimumSeconds(scene.data)*fps);
  return scene.durationInFrames < min ? [`${scene.id}: ${scene.data.move} intro needs at least ${min} frames at ${fps} fps`] : [];
}

/** Existing sound kinds only; the sound planner still applies its normal density limits. */
export function arabicTypeCues(data:{move?:unknown;text?:unknown;stamp?:unknown},fps=30):{frame:number;kind:'type'|'reveal'|'stamp'|'swap'}[]{
  const text=String(data.text??''),words=text.trim().split(/\s+/),cue=(t:number,kind:'type'|'reveal'|'stamp'|'swap')=>({frame:Math.round(t*fps),kind});
  switch(data.move){
    case 'letters-snap':return [cue(Math.max(1.3,.06*(Array.from(text).length-1)+.35),'stamp')];
    case 'decrypt':return [cue(0,'type'),cue(.35+.16*(Array.from(text).length-1),'reveal')];
    case 'pen-write':return [cue(.25,'type')];
    case 'dots-drop':return [cue(.35,'reveal')];
    case 'kufi-tiles':return [cue(.3,'type')];
    case 'kashida-stretch':return [cue(.45,'reveal')];
    case 'word-melt':return [cue(1.4,'swap')];
    case 'video-in-letters':return [cue(2.75,'reveal')];
    case 'redacted-stamp':return [...words.map((_,i)=>cue(.9+.7*i,'reveal')),...(data.stamp?[cue(1.6+.7*(words.length-1),'stamp')]:[])];
    default:return [cue(0,'reveal')];
  }
}
