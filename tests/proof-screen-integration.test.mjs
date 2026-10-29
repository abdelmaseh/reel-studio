import test from 'node:test';
import assert from 'node:assert/strict';
import {kitTemplate} from '../engine/src/review-editor/ops/templates.ts';
import {sceneDemoFields} from '../engine/src/review-editor/ops/demo.ts';
import {fieldsForFamily,validateData} from '../engine/src/review-editor/panels/form-schema.ts';
import {sampleNumberPaths} from '../engine/src/prepared-edit/sample-numbers.ts';
import {assertNoSampleNumbers,assertNoSampleText,buildEditorPlan} from '../scripts/lib/editor-director.mjs';
import {sceneCues} from '../scripts/lib/scene-cues.mjs';
import {verifyKineticAssets} from '../scripts/lib/prepared-props.mjs';
import {getPreviewDefinition,previewFixtureIssues} from '../engine/src/library-preview/fixtures.ts';
import {profileToBrief} from '../scripts/lib/branding.mjs';
import {readFile} from 'node:fs/promises';
import {mkdir,writeFile,unlink,rmdir,access} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {sceneTimingIssues} from '../engine/src/review-editor/ops/anchors.ts';
import {reviewManifest} from './helpers/review-manifest.mjs';
import {addSceneFromTemplate} from '../engine/src/review-editor/ops/scenes.ts';

test('proof template has editable blocks and delivery blocks every placeholder while retaining structural choices',()=>{
  const template=kitTemplate('proof-screen',30);
  const scene={id:'page',family:'proof-screen',data:template.data};
  assert.equal(template.layout,'takeover');assert.equal(validateData('proof-screen',template.data).ok,true);
  assert.ok(fieldsForFamily('proof-screen').some(field=>field.key==='blocks'));
  assert.ok(sceneDemoFields(scene).includes('title'));
  assert.throws(()=>assertNoSampleText({scenes:[scene]}),/sample text/);
  const authored={...scene,data:{...scene.data,title:'شرح صاحب المشروع',blocks:[{kind:'text',text:'النص من البريف'}]}};
  assert.deepEqual(sceneDemoFields(authored),[]);
  assert.doesNotThrow(()=>assertNoSampleText({scenes:[authored]}));
  const moved={...scene,data:{title:'نص صاحب المشروع',page:'web',blocks:[{kind:'text',text:template.data.blocks[1].text}]}};
  assert.throws(()=>assertNoSampleText({scenes:[moved]}),/sample text/,'Reordering template blocks must not hide sample copy');
  authored.data.blocks=[{kind:'stat',value:987654}];
  assert.deepEqual(sampleNumberPaths(authored),['blocks.0.value']);
  assert.throws(()=>assertNoSampleNumbers({scenes:[authored]}),/sample number/);
});
test('proof family reaches director with takeover layout and focus sound on the resolved camera',async()=>{
  const profile=JSON.parse(await readFile(new URL('../PROFILE.example.json',import.meta.url),'utf8'));
  const source={path:'Raw/example.mp4',sha256:'a'.repeat(64),fps:30,width:1080,height:1920,totalFrames:180};
  const brief={version:1,id:'proof-demo',source:source.path,transcript:'Projects/proof-demo/words.json',...profileToBrief(profile),purpose:'explainer',tone:'calm',
    beats:[{id:'page',intent:'proof-screen',fromSec:0,toSec:4,data:{page:'web',blocks:[{kind:'heading',text:'نص البريف'}]}}]};
  const plan=buildEditorPlan(brief,source,[{text:'فكرة',startMs:100,endMs:600,confidence:1}]);
  const scene=plan.manifest.scenes[0];assert.equal(scene.family,'proof-screen');assert.equal(scene.layout,'takeover');
  assert.deepEqual(sceneCues(scene,30),[{frame:0,kind:'transition',sceneId:'page'},{frame:30,kind:'reveal',sceneId:'page'}]);
});
test('proof assets participate in file preflight instead of being skipped',async()=>{
  await assert.rejects(()=>verifyKineticAssets({style:'section-deck',source:{fps:30},scenes:[{
    id:'page',family:'proof-screen',layout:'takeover',motion:'land',fromFrame:0,durationInFrames:120,
    data:{page:'web',blocks:[{kind:'image',src:'projects/proof-demo/assets/missing.png'}]},
  }]}),/missing|ENOENT|exist/i);
});
test('proof library preview validates the real scene contract',()=>{
  const definition=getPreviewDefinition('scene:proof-screen');
  assert.equal(definition.status,'supported');assert.equal(definition.fixture.scene.family,'proof-screen');
  assert.deepEqual(previewFixtureIssues(definition),[]);
});
test('proof template inserts through the editor and a shortened camera scene is flagged',()=>{
  const manifest=reviewManifest('proof-edit');manifest.scenes=[];
  const result=addSceneFromTemplate(manifest,'proof-screen',{atFrame:0});
  assert.equal(result.ok,true,result.reason);
  const scene=result.manifest.scenes[result.index];
  assert.equal(scene.family,'proof-screen');
  assert.notDeepEqual(sceneTimingIssues({...scene,durationInFrames:59}),[]);
  assert.deepEqual(sceneTimingIssues({...scene,durationInFrames:48},24),[],'The editor uses the actual project fps');
  assert.notDeepEqual(sceneTimingIssues({...scene,durationInFrames:119},60),[]);
});
test('proof still preflight refuses browser-timed SVG and GIF bytes hidden behind an image extension',async(t)=>{
  const dir=new URL('../engine/public/projects/proof-screen-still-test/',import.meta.url);
  await mkdir(dir,{recursive:true});
  const svg=new URL('moving.svg',dir),gif=new URL('moving.png',dir);
  t.after(async()=>{await unlink(svg).catch(()=>{});await unlink(gif).catch(()=>{});await rmdir(dir).catch(()=>{});});
  const input=src=>({style:'section-deck',source:{fps:30},scenes:[{id:'still',family:'proof-screen',fromFrame:0,durationInFrames:120,layout:'takeover',motion:'land',data:{page:'web',blocks:[{kind:'image',src}]}}]});
  await writeFile(svg,'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="50" height="50"><animate attributeName="x" from="0" to="50" dur="1s" repeatCount="indefinite"/></rect></svg>');
  await assert.rejects(()=>verifyKineticAssets(input('projects/proof-screen-still-test/moving.svg')),/static|still|animat/i);
  const ffmpeg=new URL('../Tools/bin/ffmpeg.exe',import.meta.url);try{await access(ffmpeg);}catch{t.skip('Local FFmpeg missing');return;}
  await promisify(execFile)(fileURLToPath(ffmpeg),['-v','error','-y','-f','lavfi','-i','testsrc=size=32x32:rate=2:duration=1','-frames:v','2','-threads','1','-f','gif',fileURLToPath(gif)],{windowsHide:true});
  await assert.rejects(()=>verifyKineticAssets(input('projects/proof-screen-still-test/moving.png')),/single|still|animat/i);
});

import {referencedFiles} from '../scripts/lib/render-chunks.mjs';

test('the render input guard reads a proof-screen camera path as a move, not a file', () => {
  const props = {edit: {source: {path: 'Projects/demo/source.mp4'}, scenes: [
    {id: 'page', family: 'proof-screen', data: {page: 'web', path: 'tilt-in', blocks: [{kind: 'image', src: 'proof/shot.png'}]}},
    {id: 'clip', family: 'screens', data: {path: 'Projects/demo/clip.mp4'}},
  ]}};
  const files = referencedFiles(props, 'ENGINE').map((file) => file.split(String.fromCharCode(92)).join('/'));
  assert.ok(!files.some((file) => file.endsWith('/tilt-in')), files.join(', '));
  assert.ok(files.some((file) => file.endsWith('Projects/demo/source.mp4')), 'the source stays guarded');
  assert.ok(files.some((file) => file.endsWith('ENGINE/public/proof/shot.png')), 'a proof-screen image stays guarded');
  assert.ok(files.some((file) => file.endsWith('Projects/demo/clip.mp4')), 'another family keeps its path as a file');
});
