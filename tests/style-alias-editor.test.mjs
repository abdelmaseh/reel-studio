import test from 'node:test';
import assert from 'node:assert/strict';
import {bundleEngine} from './helpers/engine-bundle.mjs';

const api=await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {editManifestSchema} from './engine/src/prepared-edit/schema.ts';
  import {setEmphasis} from './engine/src/review-editor/ops/captions';
  import {CaptionsPanel} from './engine/src/review-editor/panels/captions';
  export {editManifestSchema,setEmphasis};
  export const panel=manifest=>renderToStaticMarkup(<CaptionsPanel manifest={manifest} apply={()=>{}} playhead={0} seek={()=>{}} selection={null} select={()=>{}} issues={[]} project={{}}/>);
`,{ssr:true,media:true});

const manifest=style=>api.editManifestSchema.parse({version:1,id:'alias-editor',purpose:'test',style,
  source:{path:'Projects/alias-editor/source.mp4',sha256:'0'.repeat(64),fps:30,width:1080,height:1920,totalFrames:120},
  segments:[{fromFrame:0,toFrame:120}],captions:{status:'draft',words:[{text:'جميل',startMs:0,endMs:3000,confidence:null}]},scenes:[],sounds:[],camera:[]});

for(const [style,blocked] of [['scrapbook-route',false],['documentary',true],['split-canvas',true],['section-deck',true]]) {
  test(`${style}: editor emphasis operations and panel agree with schema policy`,()=>{
    const m=manifest(style);
    for(const kind of ['pop','stretch']) {
      const result=api.setEmphasis(m,0,kind);
      assert.equal(result.ok,!blocked,kind);
      assert.equal(api.editManifestSchema.safeParse({...m,captions:{...m.captions,emphasis:[{sourceIndex:0,kind}]}}).success,!blocked,kind);
    }
    const html=api.panel(m);
    const chips=html.match(/<button[^>]*class="cp-chip[^"]*"[^>]*>(?:نبضة|كشيدة)<\/button>/g)??[];
    assert.equal(chips.length,2,'the real caption panel renders both animated emphasis buttons');
    for(const chip of chips)assert.equal(/\bdisabled=/.test(chip),blocked,chip);
  });
}
