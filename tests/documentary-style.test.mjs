import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bundleEngine, setSsrFrame} from './helpers/engine-bundle.mjs';
import {getStyleMeta, ownSceneStyle} from '../engine/src/styles/registry.ts';
import {documentarySceneSchema, validateDocumentaryTiming, documentaryAssets, documentaryAssetClaims} from '../engine/src/styles/documentary/scenes/schema.ts';
import {styleSceneSchema} from '../engine/src/styles/scenes.ts';
import {documentaryTemplateData} from '../engine/src/styles/documentary/scenes/templates.ts';
import {reviewManifest} from './helpers/review-manifest.mjs';
import {addSceneFromTemplate,templateFamiliesFor} from '../engine/src/review-editor/ops/scenes.ts';
import {sceneDemoFields} from '../engine/src/review-editor/ops/demo.ts';
import {assertNoSampleText} from '../scripts/lib/editor-director.mjs';
import {sceneCues} from '../scripts/lib/scene-cues.mjs';
import {previewDefinitions,previewFixtureIssues} from '../engine/src/library-preview/fixtures.ts';

const scene=(family='map-route',data=documentaryTemplateData[family])=>({id:'doc',family,layout:'takeover',motion:'quiet',fromFrame:0,durationInFrames:180,data});
test('documentary is registered and its three strict takeover families have valid templates', () => {
  assert.equal(getStyleMeta('documentary').label.ar,'وثائقي');
  for(const family of ['map-route','map-focus','cutout-card']){
    assert.equal(ownSceneStyle(family),'documentary');
    const parsed=styleSceneSchema.parse(scene(family));
    assert.deepEqual(validateDocumentaryTiming(parsed,30),[]);
    assert.equal(documentarySceneSchema.safeParse({...scene(family),layout:'split'}).success,false);
    assert.equal(documentarySceneSchema.safeParse({...scene(family),data:{...parsed.data,invented:true}}).success,false);
  }
});
test('coordinates, route cues, zoom, duration and creator image provenance are enforced', () => {
  const base=scene();
  assert.equal(documentarySceneSchema.safeParse({...base,data:{...base.data,places:[{name:'أ',lon:999,lat:0},{name:'ب',lon:2,lat:2}]}}).success,false);
  assert.ok(validateDocumentaryTiming({...base,durationInFrames:20},30).length);
  assert.ok(validateDocumentaryTiming({...base,data:{...base.data,drawAt:90,drawDuration:150}},30).length);
  const card=scene('cutout-card');
  assert.deepEqual(documentaryAssets(documentarySceneSchema.parse(card)),[card.data.image.src]);
  assert.equal(documentaryAssetClaims(documentarySceneSchema.parse(card))[0].sha256,card.data.image.sha256);
  assert.equal(documentarySceneSchema.safeParse({...card,data:{...card.data,image:{...card.data.image,src:'https://example.com/photo.jpg'}}}).success,false);
  assert.equal(documentarySceneSchema.safeParse({...card,data:{...card.data,image:{src:'project/photo.jpg'}}}).success,false);
});
test('renderer draws joined Arabic, route progress, border-free land and probe-safe decoration', async () => {
  const api=await bundleEngine(`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
    import {StyleSceneRenderer} from './engine/src/styles/scene-renderers';import {SafeRoot} from './engine/src/core/safe';import {DigitsProvider} from './engine/src/creative-kit/digits';
    export const render=(scene,probe,digits)=>renderToStaticMarkup(<SafeRoot probe={probe}><DigitsProvider digits={digits}><StyleSceneRenderer scene={scene} style="documentary"/></DigitsProvider></SafeRoot>);`,{ssr:true,media:true});
  setSsrFrame(12); const early=api.render(scene());
  setSsrFrame(110);const late=api.render(scene());
  assert.notEqual(early,late);
  assert.match(late,/مثال توضيحي/);
  assert.match(late,/data-map-mode="no-borders"/);
  assert.doesNotMatch(late,/data-country-border/);
  assert.match(late,/data-route/);
  const probe=api.render(scene(),'#00FF00');
  assert.doesNotMatch(probe,/data-paper-grain/);
  assert.match(probe,/مثال توضيحي/);
  assert.match(api.render(scene('map-route',{...scene().data,title:'مثال 12'}),undefined,'arabic-indic'),/مثال ١٢/);
});
test('border-free rendering paints only supplied coastline polygons, dots and route', async () => {
  const api=await bundleEngine(`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
    import {MapDrawing} from './engine/src/maps/draw';import {SafeRoot} from './engine/src/core/safe';
    export const render=(data)=>renderToStaticMarkup(<SafeRoot><MapDrawing data={data} bounds={[-2,-2,24,12]} places={[{name:'مثال أ',lon:5,lat:5},{name:'مثال ب',lon:17,lat:5}]} route progress={.6}/></SafeRoot>);`,{ssr:true});
  const fixture=JSON.parse(await readFile(new URL('./fixtures/documentary-map.json',import.meta.url),'utf8'));
  const {buildMapData}=await import('../scripts/build-map-data.mjs');
  const markup=api.render(buildMapData({land:fixture}));
  assert.equal((markup.match(/fill="#DBD2B8"/g)??[]).length,2);
  assert.match(markup,/data-route/);assert.match(markup,/مثال أ/);assert.doesNotMatch(markup,/data-country-border/);
});
test('editor creates all three takeover templates with fps-scaled cues; delivery blocks sample copy', () => {
  const m=reviewManifest();m.style='documentary';m.scenes=[];m.source.totalFrames=600;m.segments=[{fromFrame:0,toFrame:600}];
  for(const family of ['map-route','map-focus','cutout-card']){
    assert.ok(templateFamiliesFor('documentary',m).includes(family));
    assert.ok(!templateFamiliesFor('section-deck',m).includes(family));
    const result=addSceneFromTemplate(m,family,{atFrame:0});
    assert.equal(result.ok,true,JSON.stringify(result));
    assert.equal(result.manifest.scenes[0].layout,'takeover');
    assert.ok(sceneDemoFields(result.manifest.scenes[0]).length);
    assert.throws(()=>assertNoSampleText(result.manifest),/sample text/i);
  }
  assert.deepEqual(sceneCues(scene(),30).filter(c=>c.kind!=='transition'),[]);
  assert.ok(sceneCues(scene('cutout-card'),30).some(c=>c.kind==='reveal'));
  const high=structuredClone(m);high.source.fps=60;
  const result=addSceneFromTemplate(high,'map-route');
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(result.manifest.scenes[0].data.drawDuration,150);
  assert.ok(result.manifest.scenes[0].durationInFrames>=216);
});
test('library previews bind each owned scene and style to a valid fixture', () => {
  for(const key of ['style:documentary','scene:map-route','scene:map-focus','scene:cutout-card']){
    const definition=previewDefinitions().find(d=>d.key===key);assert.ok(definition,key);
    assert.deepEqual(previewFixtureIssues(definition),[],key);
  }
});
