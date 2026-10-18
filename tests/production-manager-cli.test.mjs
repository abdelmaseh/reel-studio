import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {ROOT} from '../scripts/lib/job-paths.mjs';
import {catalogDemo} from '../engine/src/motion-concepts/catalog.ts';
import {normalizeGraphicsSpec} from '../scripts/lib/graphics-project.mjs';
import {bundleEngine} from './helpers/engine-bundle.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function cli(...args){const result=spawnSync(process.execPath,['scripts/production.mjs',...args],{cwd:ROOT,encoding:'utf8'});assert.equal(result.error,undefined);return {...result,data:JSON.parse((result.status===0?result.stdout:result.stderr).trim())};}
async function fixture(t){
  const id=`production-cli-${randomUUID().slice(0,8)}`,project=`Projects/${id}`,dir=path.join(ROOT,project);
  await fs.mkdir(dir,{recursive:true});
  t.after(async()=>{assert.ok(path.resolve(dir).startsWith(path.resolve(ROOT,'Projects')+path.sep));assert.match(id,/^production-cli-/);await fs.rm(dir,{recursive:true,force:true});});
  const put=async(file,data)=>{const text=typeof data==='string'?data:JSON.stringify(data,null,2)+'\n';await fs.mkdir(path.dirname(path.join(ROOT,file)),{recursive:true});await fs.writeFile(path.join(ROOT,file),text,'utf8');return text;};
  return {id,project,put};
}

test('delegated and directed requests carry compatible library choices into normally editable proposals through the CLI',async t=>{
  const {setSceneData}=await bundleEngine("export {setSceneData} from './engine/src/review-editor/ops/scenes.ts';");
  for(const interaction of ['delegated','directed']){
    const f=await fixture(t),input=`${f.project}/copy.md`,requestFile=`${f.project}/production-request.json`;
    await f.put(input,'Illustrative candidates pass two criteria, retaining the same IDs.');
    const original={title:'Current manual draft must stay untouched'};const originalText=await f.put(`${f.project}/edit.json`,original);
    await f.put(requestFile,{version:1,id:f.id,runId:'choose-and-author',supervisor:'claude',mode:'graphics',interaction,
      objective:'Explain filtering from supplied illustrative values.',inputs:[{role:'copy',path:input}],constraints:{style:'paper-collage',fontFamily:'Tajawal',layout:'takeover'},
      tasks:[{id:'choose',role:'editorial',objective:'Choose and author an editable example.',dependsOn:[]}]});
    const created=cli('create',requestFile);assert.equal(created.status,0,created.stderr);
    const claimed=cli('claim',created.data.plan,'--task','choose','--agent',`${interaction}-worker`);assert.equal(claimed.status,0,claimed.stderr);
    const key='concept:identity-filtering',candidate=normalizeGraphicsSpec({version:1,id:f.id,style:'paper-collage',fontFamily:'Tajawal',fps:30,reviewedBy:'Synthetic test copy reviewer',
      scenes:[{id:'filter',family:'motion-concept',layout:'takeover',fromFrame:0,durationInFrames:330,motion:'quiet',data:{concept:'identity-filtering',config:catalogDemo('identity-filtering')}}]});
    const candidatePath=`${f.project}/production/choose-and-author/tasks/choose/candidate-edit.json`,body=await f.put(candidatePath,candidate);
    const resultPath=`${f.project}/production/choose-and-author/tasks/choose/result.json`;
    await f.put(resultPath,{version:1,task:'choose',agent:`${interaction}-worker`,basisHash:claimed.data.basisHash,outcome:'proposal',summary:'Editable illustrative proposal, no creator acceptance.',
      artifacts:[{path:candidatePath,sha256:digest(body)}],choices:[{key,reason:'The same supplied cards are reduced by criteria.',context:{intent:'filtering',mode:'graphics',sourceKind:'none',style:'paper-collage',layout:'takeover',durationSec:11,assets:['data'],role:'explanation'}}]});
    const submitted=cli('submit',created.data.plan,'--task','choose','--agent',`${interaction}-worker`,'--result',resultPath);assert.equal(submitted.status,0,submitted.stderr);
    const status=cli('status',created.data.plan);assert.equal(status.data.tasks[0].state,'completed');assert.equal(status.data.creatorAcceptance,'not-recorded');
    assert.equal(candidate.style,'paper-collage');assert.equal(candidate.fontFamily,'Tajawal');
    const edited=setSceneData(candidate,'filter',{...candidate.scenes[0].data,config:{...candidate.scenes[0].data.config,title:'Revised ordinary field'}});
    assert.equal(edited.ok,true,edited.error);assert.equal(edited.manifest.scenes[0].data.config.title,'Revised ordinary field');
    assert.equal(await fs.readFile(path.join(ROOT,`${f.project}/edit.json`),'utf8'),originalText,'Handoffs never replace the live manual draft');
  }
});

test('CLI exposes unsupported arguments as errors without creating a production run',()=>{
  const result=cli('create','Projects/unused/request.json','--run-anything','yes');assert.notEqual(result.status,0);assert.equal(result.data.ok,false);
});
