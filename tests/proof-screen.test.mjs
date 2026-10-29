import test from 'node:test';
import assert from 'node:assert/strict';
import {bundleEngine, setSsrFrame} from './helpers/engine-bundle.mjs';

const data={page:'web',title:'صفحة توضيحية 2024',url:'موقعك.com',blocks:[
  {kind:'heading',text:'الفكرة في مكان واحد'}, {kind:'text',text:'شرح مكتوب من صاحب المشروع'},
  {kind:'stat',text:'قيمة توضيحية',value:42}, {kind:'button',text:'راجع التفاصيل'},
],focus:2,path:'focus'};
const scene=(extra={})=>({id:'proof-demo',family:'proof-screen',fromFrame:0,durationInFrames:120,layout:'takeover',motion:'land',data:structuredClone(data),...extra});
const api=await bundleEngine(`export * from './engine/src/creative-kit/proof-screen/schema.ts';
export * from './engine/src/creative-kit/proof-screen/timing.ts';
export {editSceneSchema,editManifestSchema} from './engine/src/prepared-edit/schema.ts';`);

test('proof screen accepts three authored page layouts and registered editor scenes',()=>{
  for(const page of ['web','chat','dashboard']){
    const input=scene();input.data.page=page;
    assert.equal(api.proofScreenSceneSchema.safeParse(input).success,true);
    assert.equal(api.editSceneSchema.safeParse(input).success,true);
  }
});
test('proof screen rejects missing content, invalid focus and ambiguous block payloads',()=>{
  for(const change of [{blocks:[]},{blocks:Array(11).fill({kind:'text',text:'نص'})},{focus:4},{focus:-1},
    {blocks:[{kind:'heading'}]},{blocks:[{kind:'stat',text:'قيمة'}]},
    {blocks:[{kind:'text',text:'نص',value:5}]},{blocks:[{kind:'image',text:'وصف'}]}, {page:'brand-site'}]){
    assert.equal(api.proofScreenSceneSchema.safeParse(scene({data:{...data,...change}})).success,false,JSON.stringify(change));
  }
  assert.equal(api.proofScreenSceneSchema.safeParse(scene({layout:'presenter'})).success,false);
});
test('proof screen image sources are named local project assets and collected for preflight',()=>{
  const src='projects/proof-demo/assets/diagram.png';
  const input=scene({data:{page:'web',blocks:[{kind:'image',src}]}});
  assert.equal(api.proofScreenSceneSchema.safeParse(input).success,true);
  assert.deepEqual(api.proofScreenAssets(input),[src]);
  for(const unsafe of ['https://example.com/image.png','../private.png','examples/image.png','projects/other/../image.png','projects/demo/a.mp4','projects/demo/a.svg?x=1']){
    input.data.blocks[0].src=unsafe;
    assert.equal(api.proofScreenSceneSchema.safeParse(input).success,false,unsafe);
  }
});
test('proof camera resolves before a one-second readable hold and scales with fps',()=>{
  for(const fps of [24,30,60]){
    assert.deepEqual(api.validateProofScreenTiming(scene({durationInFrames:Math.ceil(fps*2)}),fps),[]);
    assert.match(api.validateProofScreenTiming(scene({durationInFrames:Math.ceil(fps*2)-1}),fps).join(' '),/hold|seconds/);
  }
  for(const path of ['tilt-in','glide','focus']){
    const start=api.proofCameraAt(0,30,path),end=api.proofCameraAt(30,30,path);
    assert.notDeepEqual(start,end,path);
    assert.deepEqual(end,api.proofCameraAt(119,30,path));
    assert.deepEqual(api.proofCameraAt(10,30,path,true),{x:0,y:0,scale:1,rotateX:0,rotateY:0});
  }
});

test('proof layouts keep Arabic words joined, map digits, highlight one authored block and stay deterministic',async()=>{
  const {render}=await bundleEngine(`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
    import {ProofScreenScene} from './engine/src/creative-kit/proof-screen/scene.tsx';
    import {DigitsProvider} from './engine/src/creative-kit/digits.tsx';
    export const render=(scene,digits)=>renderToStaticMarkup(<DigitsProvider digits={digits}><ProofScreenScene scene={scene}/></DigitsProvider>);`,{ssr:true,media:true});
  for(const page of ['web','chat','dashboard'])for(const frame of [0,15,119]){
    setSsrFrame(frame);const input=scene({data:{...data,page}}),html=render(input,'arabic-indic');
    assert.match(html,/الفكرة/);assert.match(html,/واحد/);assert.match(html,/٤٢/);assert.match(html,/٢٠٢٤/);
    assert.equal((html.match(/data-proof-focus="true"/g)??[]).length,1);
    assert.doesNotMatch(html,/href=|iframe|NaN|undefined|Infinity/);
    assert.equal(html,render(input,'arabic-indic'));
  }
  const dense=scene({data:{page:'web',blocks:Array.from({length:10},()=>({kind:'text',text:'شرح واضح من البريف '.repeat(6).trim()})),focus:9,path:'focus'}});
  for(const page of ['web','chat','dashboard']){
    dense.data.page=page;assert.doesNotThrow(()=>render(dense,'latin'),page);
  }
  const first=scene(),last=scene();first.data.focus=0;last.data.focus=3;
  const origin=html=>/transform-origin:([^;" ]+ [^;"<]+)/.exec(html)?.[1];
  assert.notEqual(origin(render(first,'latin')),origin(render(last,'latin')),'The camera zoom origin follows the authored focus');
  setSsrFrame(0);
  assert.match(render(scene({motion:'quiet',data:{...data,path:'glide'}}),'latin'),/rotateX\(2deg\)/,'The authored camera path is preserved for quiet scenes');
});
