import {staticCaptionsFor} from '../styles/style-compat.ts';
import {EASE,clamp01,mix} from '../core/motion.ts';
import {CHAPTER_MIN_CONTRAST,contrastRatio,readableShift,relativeLuminance} from '../core/chapters.ts';
import {normalizeStyleId,staticCaptionStyles} from '../styles/registry.ts';
import {stretchWord} from '../arabic/kashida.ts';



export const CAPTION_EMPHASIS_KINDS=['accent','underline','pop','stretch'] as const;
export type CaptionEmphasisKind=(typeof CAPTION_EMPHASIS_KINDS)[number];
export type CaptionEmphasis={sourceIndex:number;kind:CaptionEmphasisKind};

export const STATIC_CAPTION_STYLES:readonly string[]=staticCaptionStyles();
export const POP_FRAMES=4;
export const POP_FROM=1.12;
const HEX=/^#[0-9a-fA-F]{6}$/;

export function emphasisBySource(list:readonly CaptionEmphasis[]|undefined):Map<number,CaptionEmphasisKind>{
  return new Map((list??[]).map(e=>[e.sourceIndex,e.kind] as const));
}

export function captionEmphasisIssues(style:string,wordCount:number,list:readonly {sourceIndex:number;kind:string}[]|undefined,styleAlias?:string):string[]{
  style=normalizeStyleId(style);
  const issues:string[]=[];let last=-1;
  for(const e of list??[]){
    if(e.sourceIndex>=wordCount)issues.push(`Caption emphasis names word ${e.sourceIndex}, outside the ${wordCount} caption words.`);
    if(e.sourceIndex<=last)issues.push('Caption emphasis must be strictly ordered by sourceIndex, one kind per word.');
    if((e.kind==='pop' || e.kind==='stretch') && staticCaptionsFor(style,styleAlias))issues.push(`Caption emphasis '${e.kind}' animates a word; the ${style} DNA keeps caption pills static.`);
    last=e.sourceIndex;
  }
  return issues;
}



export function captionEmphasisInk(t:{accent:string;accentInk?:string;pill:string}):string{
  if(!HEX.test(t.pill) || !HEX.test(t.accent))return t.accentInk??t.accent;
  if(contrastRatio(t.accent,t.pill)>=CHAPTER_MIN_CONTRAST)return t.accent;
  const toward=relativeLuminance(t.pill)>0.5?'#000000':'#FFFFFF';
  return readableShift(t.accent,[t.pill],toward,CHAPTER_MIN_CONTRAST);
}


export function popScale(frame:number,fromFrame:number,probe:boolean):number{
  if(probe || frame<fromFrame)return 1;
  return mix(POP_FROM,1,EASE.land(clamp01((frame-fromFrame+1)/POP_FRAMES)));
}

export const underlineMetrics=(fontSize:number)=>({thickness:Math.max(3,Math.round(fontSize*0.08)),offset:Math.round(fontSize*0.18)});

export const CAPTION_STRETCH_TATWEELS=6;
/**
 * How far the word has stretched, as a continuous number of tatweels (0 to CAPTION_STRETCH_TATWEELS): grow along legal joins, then relax
 * before the word ends. Short words use a proportional pulse. `stretchCaptionWord` draws the whole number of tatweels nearest to it, and
 * the caption's room for the word follows this amount between whole counts, so the words around it never step.
 */
export function stretchCaptionAmount(frame:number,fromFrame:number,toFrame:number,fps:number,probe:boolean):number{
  if(probe || frame<=fromFrame || frame>=toFrame || fps<=0)return 0;
  const duration=toFrame-fromFrame;
  const grow=Math.min(fps*0.35,duration*0.55),relax=Math.min(fps*0.25,duration*0.4);
  const amount=Math.min(clamp01((frame-fromFrame)/grow),clamp01((toFrame-frame)/relax));
  return CAPTION_STRETCH_TATWEELS*EASE.land(amount);
}
/** The word as it is drawn: the stretch amount rounded to a whole number of tatweels. */
export function stretchCaptionWord(text:string,frame:number,fromFrame:number,toFrame:number,fps:number,probe:boolean):string{
  if(probe || frame<=fromFrame || frame>=toFrame || fps<=0)return text;
  return stretchWord(text,Math.round(stretchCaptionAmount(frame,fromFrame,toFrame,fps,probe)));
}
