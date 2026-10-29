export interface ArabicMoveProps {
  text:string; font:string; accent:string; frame:number; fps:number; durationInFrames:number;
  width:number; height:number; ink?:string; digits?:"latin"|"arabic-indic"; media?:string; stamp?:string; to?:string;
}
export interface CanvasEnvironment extends ArabicMoveProps {ink:string; probe:boolean; size:number}
export type DrawMove=(ctx:CanvasRenderingContext2D,t:number,p:CanvasEnvironment)=>void;
