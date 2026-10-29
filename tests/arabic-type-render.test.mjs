import test from 'node:test';
import assert from 'node:assert/strict';
import {bundleEngine, setSsrFrame} from './helpers/engine-bundle.mjs';
const {renderMove,fit,penText,decryptLayout}=await bundleEngine(`
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
export {decryptLayout} from './engine/src/arabic-type/moves/decrypt.tsx';
export {fit} from './engine/src/arabic-type/canvas.ts';
export {penText} from './engine/src/arabic-type/moves/pen-write.tsx';
import {ArabicTypeSceneView} from './engine/src/arabic-type/scene.tsx';
export const renderMove=(move,text)=>renderToStaticMarkup(<ArabicTypeSceneView scene={{id:'test',family:'arabic-type',fromFrame:0,durationInFrames:240,layout:'takeover',motion:'land',data:{text,move,to:'فكرة واضحة',media:'projects/test/clip.mp4'}}}/>);
`,{ssr:true,media:true,plateStub:true});
for(const move of ['decrypt','echo-stack','redacted-stamp','unblur','word-melt','pen-write','video-in-letters','dots-drop','letters-snap','kufi-tiles','kashida-stretch']) test(move+' renders first, middle and last frames deterministically',()=>{
 // kashida-stretch takes exactly one word (arabic-type/schema.ts); every other move renders the two-word line.
 const text=move==='kashida-stretch'?'فكرة':'فكرة واضحة';
 for(const frame of [0,120,239]){setSsrFrame(frame);const a=renderMove(move,text);assert.equal(a,renderMove(move,text));assert.match(a,new RegExp(text));assert.match(a,new RegExp('data-arabic-move="'+move+'"'));assert.doesNotMatch(a,/<span[^>]*>ف<\/span>/);}
});

test('text fitting honors its measured width even for maximum-length wide copy',()=>{
 const ctx={font:'',measureText(text){return {width:text.length*Number(/([\d.]+)px/.exec(this.font)[1])*.9};}};
 const size=fit(ctx,'W'.repeat(160),'Cairo',64,226);assert.ok(160*size*.9<=226);
});
test('pen shaping correction is restricted to the Aref Ruqaa face',()=>{
 assert.equal(penText('قاعدة','Noto Naskh Arabic'),'قاعدة');
 assert.equal(penText('قاعدة','Aref Ruqaa'),'قاعد\u200Dة');
});

test('scrambled Arabic is fitted at every frame rather than only fitting the final narrow text',()=>{
 const ctx={font:'',measureText(text){const size=Number(/([\d.]+)px/.exec(this.font)[1]);return {width:Array.from(text).reduce((n,ch)=>n+(ch==='i'?.15:.9)*size,0)};}};
 for(const t of [.3,.7,1]){const state=decryptLayout(ctx,'iiiiiiiiii','Cairo',64,t);ctx.font='900 '+state.size+'px Cairo';assert.ok(ctx.measureText(state.output).width<=226);}
});
