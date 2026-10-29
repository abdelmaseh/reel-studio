import {bundleEngine, setSsrFrame} from './engine-bundle.mjs';

// Keep the real PreparedEdit tree; only browser/Remotion host services use the existing SSR adapter.
export async function preparedFramesRenderer({historicalStage=false}={}) {
  const sourceOverrides=historicalStage?{'engine/src/styles/section-deck/theme.ts':    'import {FONT,PALETTE} from "./format";export default {theme:{background:"#0F1B33",card:PALETTE.cardBg,border:PALETTE.cardBorder,text:PALETTE.text,dim:"rgba(255,255,255,0.55)",accent:PALETTE.accent,good:PALETTE.chipGreen,bad:PALETTE.chipRed,pill:PALETTE.pillBg,pillText:PALETTE.pillText,ar:FONT.arNaskh,display:FONT.sans,mono:FONT.mono},layout:{kind:"legacy",seam:1056,caption:900},galleryCut:"flash-bloom"};'}:{};
  const api = await bundleEngine(    (historicalStage?'import {FAMILY_DESIGNS} from "./engine/src/styles/family-designs"; FAMILY_DESIGNS["section-deck"]={};':'')+    `
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {PreparedEdit} from './engine/src/prepared-edit/PreparedEdit';
    export const render = (edit) => renderToStaticMarkup(<PreparedEdit edit={edit} plate={{src:'sample.mp4',width:1080,height:1920}}/>);
  `, {ssr:true, media:true, sourceOverrides});
  return (edit, frame) => {setSsrFrame(frame); return api.render(edit);};
}

export function transitionSample(kind) {
  const chapter = {ground:'#F7F3E8',accent:'#E2B85F',ink:'#102027',onAccent:'#102027'};
  return {version:1,id:'transition-ssr',purpose:'test',style:'section-deck',presenter:false,
    source:{path:'Raw/sample.mp4',sha256:'a'.repeat(64),fps:30,width:1080,height:1920,totalFrames:180},
    segments:[{fromFrame:0,toFrame:180}],captions:{status:'reviewed',reviewer:'SSR fixture',words:[]},sounds:[],camera:[],
    scenes:[{id:'old',family:'intro',layout:'takeover',motion:'quiet',fromFrame:0,durationInFrames:60,chapter,
      data:{kicker:'مثال',title:'الفكرة الأولى',subtitle:'شرح توضيحي',caption:'مثال'}},
      {id:'new',family:'intro',layout:'takeover',motion:'quiet',fromFrame:60,durationInFrames:120,
        chapter:{ground:'#E2F3EA',accent:'#90C9AE',ink:'#102027',onAccent:'#102027'},
        data:{kicker:'مثال',title:'الفكرة التالية',subtitle:'شرح توضيحي',caption:'مثال'}}],
    transitions:[{kind,atFrame:60,durationInFrames:24}]};
}
