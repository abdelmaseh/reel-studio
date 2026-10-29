import type {FiguresData,FiguresScene} from './schema.ts';

/** Scene-local frames. All durations are authored in seconds, then rounded at the edit fps. */
export function slotDigitStrings(value:number,from=0):{to:string;from:string} {
  const length=Math.max(String(value).length,String(from).length);
  return {to:String(value).padStart(length,'0'),from:String(from).padStart(length,'0')};
}
export function figuresAnimationFrames(data:FiguresData,fps=30):number {
  const sec=data.variant==='slot'?1.05+(slotDigitStrings(data.value,data.from).to.length-1)*.07:data.variant==='bars'?.7+(data.bars.length-1)*.12:1.2;
  return Math.ceil(sec*fps);
}
export const figuresEndFrame=(data:FiguresData,fps=30):number=>figuresAnimationFrames(data,fps)+Math.ceil(.3*fps);
export function validateFiguresTiming(scene:FiguresScene,fps=30):string[] {
  return scene.durationInFrames<=figuresEndFrame(scene.data,fps)?[`${scene.id}: figures animation and readable hold must finish inside the scene`]:[];
}

/** A deterministic digit reel, stopping from right to left with a damped sub-cell overshoot. */
export function slotPosition(frame:number,index:number,length:number,digit:number,fromDigit:number,fps=30):number {
  const duration=Math.round((1.05+(length-1-index)*.07)*fps);
  const p=Math.max(0,Math.min(1,frame/Math.max(1,duration)));
  const target=30+digit;
  const ease=1-(1-p)**3;
  return fromDigit+(target-fromDigit)*ease+(p>.75?Math.sin((p-.75)/.25*Math.PI)*.3:0);
}
