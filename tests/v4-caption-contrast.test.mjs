import test from 'node:test';
import assert from 'node:assert/strict';
import {bundleEngine,setSsrFrame} from './helpers/engine-bundle.mjs';
import {STYLE_IDS} from '../engine/src/styles/registry.ts';
import {contrastRatio} from '../engine/src/core/chapters.ts';
import {compileEdit} from '../engine/src/prepared-edit/timeline.ts';

const api=await bundleEngine(`
 import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
 import {CaptionTrack} from './engine/src/prepared-edit/PreparedEdit';
 import {SafeRoot} from './engine/src/core/safe';
 export {getStyleTheme,getStyleCaption} from './engine/src/styles/themes';
 export {captionSkinPaint} from './engine/src/prepared-edit/caption-skins';
 export const render=(edit,compiled)=>renderToStaticMarkup(<SafeRoot><CaptionTrack edit={edit} compiled={compiled} center={1340}/></SafeRoot>);
`,{ssr:true,media:true,timeline:true});
const skins=['spoken-box','karaoke','bold-outline','soft-shadow','paper-tag'];
const words=['First','second','third'].map((text,i)=>({text,startMs:i*900,endMs:(i+1)*900,confidence:1}));
function editFor(style,skin,layout='takeover'){
 return {version:1,id:'skin-contrast',purpose:'test',style,
  source:{path:'Raw/sample.mp4',sha256:'a'.repeat(64),fps:30,width:1080,height:1920,totalFrames:180},
  segments:[{fromFrame:0,toFrame:180}],captions:{status:'reviewed',skin,words},camera:[],sounds:[],
  scenes:[{id:'canvas',family:'comparison',layout,motion:'quiet',fromFrame:0,durationInFrames:180,data:{}}]};
}
const styleOf=tag=>Object.fromEntries((tag.match(/style="([^"]*)"/)?.[1]??'').split(';').filter(Boolean).map(s=>{const i=s.indexOf(':');return [s.slice(0,i),s.slice(i+1)];}));
function captionPaint(html){const tag=html.match(/<div data-caption-skin="[^"]+"[^>]*>/)?.[0];assert.ok(tag,'explicit skin is drawn');return styleOf(tag);}

for(const style of STYLE_IDS)for(const layout of ['takeover','split'])test(`${style} ${layout}: every saved skin has at least 4.5:1 ink against immediate backing`,()=>{
 const theme=api.getStyleTheme(style);
 for(const skin of skins){
  const edit=editFor(style,skin,layout),original=structuredClone(edit);
  setSsrFrame(12);const html=api.render(edit,compileEdit(edit)),paint=captionPaint(html);
  const backing=paint.background==='transparent'?theme.background:paint.background;
  assert.ok(contrastRatio(paint.color,backing)>=4.5,`${skin}: ${paint.color} on ${backing}`);
  // Both active and inactive words are measured. The inactive three-word line may not depend on the highlight box.
  assert.match(html,/data-source-index="0" data-spoken="true"/);
  assert.match(html,/data-source-index="1" data-spoken="false"/);
  assert.ok(html.includes('second'));
  if(skin==='spoken-box')assert.ok(contrastRatio(paint.color,'#10232C')>=4.5);
  if(skin==='karaoke')assert.ok(contrastRatio('#FFE58A',backing)>=4.5,'active karaoke ink');
  assert.deepEqual(edit,original,'saved skin and recorded copy unchanged');
 }
});

test('light and dark graphics canvases, chapter overrides, and footage use their own contrast context',()=>{
 for(const skin of skins){
  const base=api.captionSkinPaint(skin,'#DDF25E');
  assert.equal(base.background,skin==='paper-tag'?'#F6EEDD':'transparent','footage keeps current skin');
  for(const ground of ['#FFFFFF','#050916']){
   const edit=editFor('kinetic-paper',skin);
   edit.scenes[0].chapter={ground,ink:ground==='#FFFFFF'?'#10232C':'#FFFFFF',accent:'#DDF25E',onAccent:'#10232C'};
   setSsrFrame(12);const paint=captionPaint(api.render(edit,compileEdit(edit)));
   assert.ok(contrastRatio(paint.color,paint.background==='transparent'?ground:paint.background)>=4.5);
   if(ground==='#FFFFFF' && skin!=='paper-tag')assert.equal(paint.background,'#10232C','dark solid pill behind the entire light line');
  }
  const presenter=editFor('kinetic-paper',skin,'presenter');
  const paint=captionPaint(api.render(presenter,compileEdit(presenter)));
  assert.equal(paint.background,base.background,'presenter is not classified as a light canvas');
 }
});

test('alternating page contracts remain readable on cream pages and preserve the explicit skin',()=>{
 for(const skin of skins){
  const edit=editFor('magazine-interview',skin);
  setSsrFrame(12);const paint=captionPaint(api.render(edit,compileEdit(edit)));
  assert.notEqual(paint.background,'transparent','theme-level navy cannot describe all cream pages');
  assert.ok(contrastRatio(paint.color,paint.background)>=4.5);
 }
});

test('skin backing and look chips do not override one another with transparent inline styles',()=>{
 for(const style of ['kinetic-paper','liquid-glass'])for(const skin of skins)for(const kind of ['riso','blueprint']){
  const edit={...editFor(style,skin),look:{kind}};
  setSsrFrame(12);const paint=captionPaint(api.render(edit,compileEdit(edit)));
  assert.notEqual(paint.background,'transparent');
  assert.ok(contrastRatio(paint.color,paint.background)>=4.5);
 }
});

test('without an explicit skin, style caption designs retain their current contract',()=>{
 for(const style of ['kinetic-paper','paper-collage','magazine-interview','calligraphic-receipts']){
  const edit=editFor(style,undefined);
  setSsrFrame(12);const html=api.render(edit,compileEdit(edit));
  assert.doesNotMatch(html,/data-caption-skin=/);
  assert.ok(html.replace(/<[^>]*>/g,'').includes('First second third'));
  if(['kinetic-paper','paper-collage'].includes(style))assert.ok(html.includes(`background:${api.getStyleTheme(style).pill}`));
  if(style==='magazine-interview')assert.ok(html.includes('#0B1A2C'),'existing cream-page ink');
  edit.scenes[0].chapter={ground:'#050916',ink:'#FFFFFF',accent:'#DDF25E',onAccent:'#10232C'};
  assert.equal(api.render(edit,compileEdit(edit)),html,'no-skin caption contract keeps its existing chapter behavior');
 }
});
