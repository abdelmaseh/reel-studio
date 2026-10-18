import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {planEditorBrief} from '../scripts/lib/editor-director.mjs';
import {profileToBrief} from '../scripts/lib/branding.mjs';
import {ROOT,run} from '../scripts/lib/media.mjs';
import {applyEditPatch,applyPatchToManifest,editRevision} from '../scripts/lib/edit-apply.mjs';

const profile=JSON.parse(await fs.readFile(new URL('../PROFILE.example.json',import.meta.url),'utf8'));
const words=[{text:'كلام',startMs:0,endMs:400,confidence:1},{text:'المصدر',startMs:450,endMs:900,confidence:0.4}];

async function project(t){
  const id=`edit-apply-${randomUUID().slice(0,8)}`,relative=`Projects/${id}`;
  await fs.mkdir(path.resolve(ROOT,relative),{recursive:true});
  t.after(()=>fs.rm(path.resolve(ROOT,relative),{recursive:true,force:true}));
  const sourceFile=`${relative}/source.mp4`,transcript=`${relative}/words.json`,briefFile=`${relative}/brief.json`,editFile=`${relative}/edit.json`;
  await run('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=c=gray:s=64x96:r=30:d=3','-c:v','libx264','-pix_fmt','yuv420p','-colorspace','bt709',path.resolve(ROOT,sourceFile)]);
  await fs.writeFile(path.resolve(ROOT,transcript),JSON.stringify(words));
  await fs.writeFile(path.resolve(ROOT,briefFile),JSON.stringify({version:1,id,source:sourceFile,transcript,...profileToBrief(profile),purpose:'explainer',tone:'calm',
    beats:[{id:'opening',fromSec:0,toSec:2,intent:'intro',data:{kicker:'مثال',title:'فكرة للمراجعة',subtitle:'شرح قصير',caption:'مثال'}}]}));
  await planEditorBrief(briefFile);
  const write=async file=>{await fs.writeFile(path.resolve(ROOT,`${relative}/${file.name}`),JSON.stringify(file.body,null,2));return `${relative}/${file.name}`;};
  const readEdit=async()=>JSON.parse(await fs.readFile(path.resolve(ROOT,editFile),'utf8'));
  return {id,relative,editFile,write,readEdit};
}

test('applyPatchToManifest upserts scenes by id, sorts them, replaces lists and leaves captions alone',()=>{
  const manifest={captions:{words},scenes:[{id:'b',fromFrame:60,durationInFrames:10},{id:'a',fromFrame:0,durationInFrames:10}],sounds:[{atFrame:1,recipe:'pop',gain:0.4}]};
  const {next,applied}=applyPatchToManifest(manifest,{version:1,baseRevision:'x',scenes:{upsert:[{id:'a',fromFrame:0,durationInFrames:20},{id:'c',fromFrame:30,durationInFrames:5}],remove:['b']},sounds:{replace:[]}});
  assert.deepEqual(next.scenes.map(scene=>scene.id),['a','c']);
  assert.equal(next.scenes[0].durationInFrames,20);
  assert.deepEqual(next.sounds,[]);
  assert.deepEqual(next.captions,manifest.captions);
  assert.deepEqual(applied,{scenesUpserted:2,scenesRemoved:1,sounds:0,transitions:null,camera:null});
  assert.throws(()=>applyPatchToManifest(manifest,{version:1,baseRevision:'x',captions:{}}),/Unknown patch field/);
  assert.throws(()=>applyPatchToManifest(manifest,{version:1,baseRevision:'x',scenes:{remove:'b'}}),/remove must be a list/);
  assert.throws(()=>applyPatchToManifest(manifest,{version:1,baseRevision:'x',scenes:{upsert:{}}}),/upsert must be a list/);
  assert.throws(()=>applyPatchToManifest(manifest,{version:1,baseRevision:'x',scenes:{upsert:[{id:'a'},{id:'a'}]}}),/twice/);
});

test('apply saves through the manifest store with a History backup, refuses a stale revision and an invalid result',async t=>{
  const p=await project(t);
  const {revision}=await editRevision(p.editFile);
  const patch=await p.write({name:'patch.json',body:{version:1,baseRevision:revision,sounds:{replace:[{atFrame:12,recipe:'soft-pop',gain:0.4}]}}});
  const original=await fs.readFile(path.resolve(ROOT,p.editFile),'utf8');
  const result=await applyEditPatch(p.editFile,patch,{label:'اقتراح الصوت'});
  assert.equal(result.ok,true);assert.match(result.backup,/edit-history\/.+~اقتراح الصوت\.json$/);
  assert.equal(await fs.readFile(path.resolve(ROOT,result.backup),'utf8'),original,'History keeps the previous version');
  assert.deepEqual((await p.readEdit()).sounds,[{atFrame:12,recipe:'soft-pop',gain:0.4}]);
  const before=await fs.readFile(path.resolve(ROOT,p.editFile),'utf8');
  await assert.rejects(applyEditPatch(p.editFile,patch),/stale|changed since/);
  assert.equal(await fs.readFile(path.resolve(ROOT,p.editFile),'utf8'),before,'a stale patch changes nothing');
  const fresh=(await editRevision(p.editFile)).revision;
  const opening=(await p.readEdit()).scenes.find(scene=>scene.id==='opening');
  assert.ok(opening,'the planned edit has the opening scene');
  const broken=await p.write({name:'broken.json',body:{version:1,baseRevision:fresh,scenes:{upsert:[{...opening,fromFrame:-5}]}}});
  await assert.rejects(applyEditPatch(p.editFile,broken),/fails validation/);
  assert.equal(await fs.readFile(path.resolve(ROOT,p.editFile),'utf8'),before,'an invalid patch changes nothing');
});
