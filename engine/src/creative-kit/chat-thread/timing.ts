import type {ChatThreadData,ChatThreadScene} from './schema.ts';

export const chatTypingFrames=(fps=30):number=>Math.round(.8*fps);
export function chatMessageFrames(data:ChatThreadData,fps=30):number[] {
  const times:number[]=[];
  data.messages.forEach((message,i)=>times.push(message.at??(i===0?(data.variant==='typing'?chatTypingFrames(fps):0):times[i-1]+Math.round(1.35*fps))));
  return times;
}
export function validateChatThreadTiming(scene:ChatThreadScene,fps=30):string[] {
  const times=chatMessageFrames(scene.data,fps),issues:string[]=[];
  times.forEach((at,i)=>{
    if(at>=scene.durationInFrames || at+Math.ceil(.5*fps)>=scene.durationInFrames)issues.push(`${scene.id}: message ${i+1} must land and hold inside its scene`);
    if(i>0&&at<=times[i-1])issues.push(`${scene.id}: message at times must be strictly increasing`);
    if(scene.data.variant==='typing'&&at-(i?times[i-1]:0)<chatTypingFrames(fps))issues.push(`${scene.id}: message ${i+1} needs 0.8 seconds for typing`);
  });
  return issues;
}

/** New arrivals move older cards continuously; the newest five are the visible stack. */
export function notificationCards(data:ChatThreadData,frame:number,fps=30):{index:number;depth:number;enter:number}[] {
  const times=chatMessageFrames(data,fps);
  const ease=(at:number)=>{const p=Math.max(0,Math.min(1,(frame-at)/Math.max(1,.3*fps)));return 1-(1-p)**3;};
  const visible=times.map((at,index)=>({at,index})).filter(c=>frame>=c.at);
  return visible.slice(-5).reverse().map(({at,index})=>({index,enter:ease(at),depth:visible.filter(c=>c.index>index).reduce((sum,c)=>sum+ease(c.at),0)}));
}
