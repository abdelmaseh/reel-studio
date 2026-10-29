import React from 'react';
import type {CaptionSkin} from '../core/preference-options.ts';
import {captionEmphasisInk} from './caption-emphasis.ts';
import {contrastRatio,relativeLuminance} from '../core/chapters.ts';

/** A silence has no spoken word. Overlapping alignments choose the latest start. */
export function spokenWordIndex(words:readonly {fromFrame:number;toFrame:number}[],frame:number):number{
  let active=-1;
  words.forEach((word,index)=>{
    if(frame>=word.fromFrame && frame<word.toFrame && (active<0 || word.fromFrame>=words[active].fromFrame))active=index;
  });
  return active;
}

export function captionSkinPaint(skin:CaptionSkin,accent:string,canvas?:string,opaqueCanvas=false):{background:string;color:string;ink:string;style:React.CSSProperties}{
  const paper=skin==='paper-tag';
  let background=paper?'#F6EEDD':'transparent';
  const color=paper?'#231E18':'#FFFFFF';
  // Footage keeps the saved skin. Graphics use the theme canvas; page designs with alternating
  // canvases request an opaque variant because one theme colour cannot describe all their pages.
  if(canvas && background==='transparent' && (opaqueCanvas || contrastRatio(color,canvas)<4.5))
    background=relativeLuminance(color)>.5?'#10232C':'#F6EEDD';
  const ink=captionEmphasisInk({accent,pill:background==='transparent'?(canvas??'#10232C'):background});
  const style:React.CSSProperties={background,color,borderRadius:paper?2:0,boxShadow:'none',textShadow:'none'};
  if(skin==='spoken-box' || skin==='karaoke')style.textShadow='0 2px 4px #000000';
  if(skin==='bold-outline')Object.assign(style,{WebkitTextStroke:'4px #101820',paintOrder:'stroke fill',textShadow:'0 3px 0 #101820'});
  if(skin==='soft-shadow')style.textShadow='0 3px 5px #000000, 0 0 14px #000000, 0 0 2px #000000';
  if(paper)Object.assign(style,{boxShadow:'0 4px 0 #00000038',borderBlock:'2px dashed #B9A78C',boxSizing:'border-box'});
  else if(background!=='transparent')style.borderRadius=18;
  return {background,color,ink,style};
}

/** The box shares its word's intrinsic geometry, so Arabic shaping and mixed-width words stay aligned. */
// `chip` is the look's caption chip (looks/captions.ts) when the caption sits on one: the highlight is then drawn in the chip's own two
// colours, a ring for spoken-box and an underline for karaoke, so it keeps the chip's contrast instead of a fixed dark box or yellow.
export const CaptionSkinWord:React.FC<{skin:CaptionSkin;active:boolean;sourceIndex:number;probe:boolean;chip?:{background:string;wordColor:string}|null;children:React.ReactNode}>=({skin,active,sourceIndex,probe,chip=null,children})=>{
  // Inline spans preserve adjacent Latin runs inside an RTL line; atomic boxes reverse those tokens.
  const style:React.CSSProperties={position:'relative',display:'inline'};
  const lit=active&&!probe;
  if(skin==='spoken-box')Object.assign(style,chip?{borderRadius:5,boxShadow:lit?`0 0 0 3px ${chip.wordColor}`:undefined}:{background:lit?'#10232C':'transparent',borderRadius:5,boxShadow:lit?'0 0 0 5px #10232C':undefined});
  if(skin==='karaoke')Object.assign(style,{color:chip?chip.wordColor:lit?'#FFE58A':'#FFFFFF',textDecorationLine:lit?'underline':undefined,textDecorationThickness:'0.07em',textUnderlineOffset:'0.16em'});
  return <span data-source-index={sourceIndex} data-spoken={active?'true':'false'} style={style}>{children}</span>;
};
