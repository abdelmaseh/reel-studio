import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {ROOT} from '../scripts/lib/job-paths.mjs';

let api={};
try{api=await import('../scripts/lib/production-manager.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const need=name=>{assert.equal(typeof api[name],'function',`${name} must be implemented`);return api[name];};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t,patch={}){
  const id=`production-test-${randomUUID().slice(0,8)}`,root=`Projects/${id}`;
  const absolute=path.join(ROOT,root);await fs.mkdir(absolute,{recursive:true});
  t.after(async()=>{assert.ok(path.resolve(absolute).startsWith(path.resolve(ROOT,'Projects')+path.sep));assert.match(id,/^production-test-/);await fs.rm(absolute,{recursive:true,force:true});});
  const put=async(file,data)=>{await fs.mkdir(path.dirname(path.join(ROOT,file)),{recursive:true});await fs.writeFile(path.join(ROOT,file),typeof data==='string'?data:JSON.stringify(data,null,2)+'\n','utf8');return file;};
  const copy=await put(`${root}/copy.md`,'Illustrative source copy. No recording or real outcome.');
  const request={version:1,id,runId:'first-draft',supervisor:'claude',mode:'graphics',interaction:'delegated',objective:'Explain the same supplied candidates being filtered.',inputs:[{role:'copy',path:copy}],tasks:[{id:'analyse',role:'analysis',objective:'Separate supplied facts from interpretation.',dependsOn:[]},{id:'edit',role:'edit',objective:'Return an editable proposal.',dependsOn:['analyse']}],...patch};
  const file=await put(`${root}/production-request.json`,request);
  return {id,root,put,request,file,copy};
}
async function claimed(t){const f=await fixture(t);const p=await need('createProductionPlan')(f.file);const c=await need('claimProductionTask')(p.plan,{task:'analyse',agent:'codex-analysis'});return {...f,p,c};}
async function receipt(f,task='analyse',agent='codex-analysis',extra={}){
  const artifact=`${f.root}/production/first-draft/tasks/${task}/analysis.md`;const content='Observed illustrative copy. Meaning is an editorial interpretation.';
  await f.put(artifact,content);
  const result={version:1,task,agent,basisHash:f.c.basisHash,outcome:'proposal',summary:'Source-grounded proposal, awaiting manager review.',artifacts:[{path:artifact,sha256:digest(content)}],...extra};
  const file=await f.put(`${f.root}/production/first-draft/tasks/${task}/result.json`,result);return {file,result,artifact};
}

test('creates owned cross-host task packets and resumes without replacing existing work',async t=>{
  const f=await fixture(t);const p=await need('createProductionPlan')(f.file);
  assert.equal(p.plan,`${f.root}/production/first-draft/plan.json`);
  const packet=JSON.parse(await fs.readFile(path.join(ROOT,p.packets[0]),'utf8'));
  assert.equal(packet.supervisor,'claude');assert.equal(packet.managerRole,'content-production-manager');
  assert.equal(packet.interaction,'delegated');assert.equal(packet.policy.liveEditWriter,'manager');
  const before=await fs.readFile(path.join(ROOT,p.plan),'utf8');assert.equal((await need('createProductionPlan')(f.file)).resumed,true);
  assert.equal(await fs.readFile(path.join(ROOT,p.plan),'utf8'),before);
  await f.put(f.file,{...f.request,objective:'Changed intent'});
  await assert.rejects(()=>need('createProductionPlan')(f.file),/changed|different|new run/i);
});

test('the manager leads when no other manager is named, and a sound worker is part of the team',async t=>{
  const tasks=[{id:'analyse',role:'analysis',objective:'Separate supplied facts from interpretation.',dependsOn:[]},
    {id:'sound',role:'sound',objective:'Propose palette cues on real state changes only.',dependsOn:['analyse']},
    {id:'edit',role:'edit',objective:'Return an editable proposal.',dependsOn:['analyse','sound']}];
  const f=await fixture(t,{supervisor:undefined,tasks});
  assert.equal('supervisor' in JSON.parse(await fs.readFile(path.join(ROOT,f.file),'utf8')),false);
  const p=await need('createProductionPlan')(f.file);
  const packets=await Promise.all(p.packets.map(async file=>JSON.parse(await fs.readFile(path.join(ROOT,file),'utf8'))));
  assert.deepEqual(packets.map(packet=>packet.supervisor),['manager','manager','manager']);
  assert.equal(packets.find(packet=>packet.task==='sound').role,'sound');
  const named=await fixture(t,{supervisor:'Bad Name!'});
  await assert.rejects(()=>need('createProductionPlan')(named.file),/manager name|slug|invalid/i);
});

test('rejects unsupported fields, dependency cycles, unknown tasks and multiple edit writers',async t=>{
  for(const tasks of [
    [{id:'a',role:'edit',objective:'A',dependsOn:['missing']}],
    [{id:'a',role:'analysis',objective:'A',dependsOn:['b']},{id:'b',role:'edit',objective:'B',dependsOn:['a']}],
    [{id:'a',role:'edit',objective:'A',dependsOn:[]},{id:'b',role:'edit',objective:'B',dependsOn:[]}],
  ]){const f=await fixture(t,{tasks});await assert.rejects(()=>need('createProductionPlan')(f.file),/depend|cycle|edit/i);}
  const f=await fixture(t,{command:'run anything'});await assert.rejects(()=>need('createProductionPlan')(f.file),/unsupported|unknown/i);
});

test('keeps all outputs in the named project and refuses foreign inputs and traversal',async t=>{
  const f=await fixture(t,{inputs:[{role:'copy',path:'Projects/another-private-project/copy.md'}]});
  await assert.rejects(()=>need('createProductionPlan')(f.file),/named project|input|scope/i);
  const g=await fixture(t,{runId:'../escape'});await assert.rejects(()=>need('createProductionPlan')(g.file),/slug|unsafe/i);
});

test('dependencies and competing workers cannot claim the same project task',async t=>{
  const f=await claimed(t);
  await assert.rejects(()=>need('claimProductionTask')(f.p.plan,{task:'edit',agent:'editor-a'}),/depend|ready/i);
  await assert.rejects(()=>need('claimProductionTask')(f.p.plan,{task:'analyse',agent:'other-agent'}),/claimed|owner/i);
  assert.equal((await need('claimProductionTask')(f.p.plan,{task:'analyse',agent:'codex-analysis'})).basisHash,f.c.basisHash);
});

test('verifies real output hashes, owner and receipt basis before downstream work becomes ready',async t=>{
  const f=await claimed(t),r=await receipt(f);
  await assert.rejects(()=>need('submitProductionTask')(f.p.plan,{task:'analyse',agent:'other',result:r.file}),/owner/i);
  await f.put(r.file,{...r.result,basisHash:'0'.repeat(64)});await assert.rejects(()=>need('submitProductionTask')(f.p.plan,{task:'analyse',agent:'codex-analysis',result:r.file}),/basis/i);
  await f.put(r.file,{...r.result,artifacts:[{path:r.artifact,sha256:'0'.repeat(64)}]});await assert.rejects(()=>need('submitProductionTask')(f.p.plan,{task:'analyse',agent:'codex-analysis',result:r.file}),/hash|changed/i);
  await f.put(r.file,r.result);await need('submitProductionTask')(f.p.plan,{task:'analyse',agent:'codex-analysis',result:r.file});
  const status=await need('productionStatus')(f.p.plan);assert.equal(status.tasks[0].state,'completed');assert.equal(status.tasks[1].state,'available');
  assert.equal(status.creatorAcceptance,'not-recorded');assert.match(status.scope,/handoff|proposal/i);
});

test('input and manual edit changes invalidate claims without writing the edit or profile',async t=>{
  const f=await fixture(t);const edit=await f.put(`${f.root}/edit.json`,{version:1,manualTitle:'Keep this crop and title'});
  const p=await need('createProductionPlan')(f.file),before=await fs.readFile(path.join(ROOT,edit),'utf8');
  const c=await need('claimProductionTask')(p.plan,{task:'analyse',agent:'codex-analysis'});const r=await receipt({...f,c});
  await f.put(edit,{version:1,manualTitle:'New manual work'});
  await assert.rejects(()=>need('submitProductionTask')(p.plan,{task:'analyse',agent:'codex-analysis',result:r.file}),/edit|revision|basis|changed/i);
  assert.notEqual(await fs.readFile(path.join(ROOT,edit),'utf8'),before);
  await f.put(f.copy,'Source changed too');assert.equal((await need('productionStatus')(p.plan)).tasks[0].state,'stale');
});

test('changed completed artifacts make dependencies stale and cannot be silently reused',async t=>{
  const f=await claimed(t),r=await receipt(f);await need('submitProductionTask')(f.p.plan,{task:'analyse',agent:'codex-analysis',result:r.file});
  await f.put(r.artifact,'Different proposal');const s=await need('productionStatus')(f.p.plan);
  assert.equal(s.tasks[0].state,'stale');assert.equal(s.tasks[1].state,'blocked');
  await assert.rejects(()=>need('claimProductionTask')(f.p.plan,{task:'edit',agent:'editor'}),/depend|ready/i);
});

test('rejects fabricated creator acceptance and cross-task artifact receipts',async t=>{
  const f=await claimed(t),r=await receipt(f,undefined,undefined,{creatorApproved:true});
  await assert.rejects(()=>need('submitProductionTask')(f.p.plan,{task:'analyse',agent:'codex-analysis',result:r.file}),/accept|unsupported|unknown/i);
  await f.put(r.file,{...r.result,creatorApproved:undefined,artifacts:[{path:f.copy,sha256:digest(await fs.readFile(path.join(ROOT,f.copy)))}]});
  await assert.rejects(()=>need('submitProductionTask')(f.p.plan,{task:'analyse',agent:'codex-analysis',result:r.file}),/task|output/i);
});

test('library handoffs obey meaning, data, duration, style and directed constraints',async t=>{
  const f=await fixture(t,{interaction:'directed',constraints:{style:'paper-collage',fontFamily:'Tajawal',layout:'takeover'},tasks:[{id:'analyse',role:'editorial',objective:'Choose an action for supplied values.',dependsOn:[]}]});
  const p=await need('createProductionPlan')(f.file),c=await need('claimProductionTask')(p.plan,{task:'analyse',agent:'codex-analysis'});
  const context={intent:'filtering',mode:'graphics',sourceKind:'none',style:'paper-collage',layout:'takeover',durationSec:11,assets:['data'],role:'explanation'};
  const choice={key:'concept:identity-filtering',context,reason:'Keep the same candidates visible through both criteria.'};
  const r=await receipt({...f,c},undefined,undefined,{choices:[choice]});
  for(const patch of [{durationSec:4},{assets:[]},{layout:'split'},{style:'section-deck'},{intent:'feedback'}]){
    await f.put(r.file,{...r.result,choices:[{...choice,context:{...context,...patch}}]});
    await assert.rejects(()=>need('submitProductionTask')(p.plan,{task:'analyse',agent:'codex-analysis',result:r.file}),/choice|library|constraint|context/i);
  }
  await f.put(r.file,r.result);await need('submitProductionTask')(p.plan,{task:'analyse',agent:'codex-analysis',result:r.file});
  const s=await need('productionStatus')(p.plan);assert.equal(s.tasks[0].state,'completed');assert.equal(s.constraints.fontFamily,'Tajawal');
});

test('needs-input is visible and never satisfies dependencies as completed work',async t=>{
  const f=await claimed(t),r=await receipt(f,undefined,undefined,{outcome:'needs-input',summary:'One supplied phrase is uncertain; no transcript review claimed.'});
  await need('submitProductionTask')(f.p.plan,{task:'analyse',agent:'codex-analysis',result:r.file});
  const s=await need('productionStatus')(f.p.plan);assert.equal(s.tasks[0].state,'needs-input');assert.equal(s.tasks[1].state,'blocked');
});

test('a receipt basis cannot be replayed into a different run with a new editorial objective',async t=>{
  const f=await claimed(t);
  const nextRequest=await f.put(`${f.root}/second-request.json`,{...f.request,runId:'second-draft',objective:'Compare a different message instead.'});
  const next=await need('createProductionPlan')(nextRequest);
  const claim=await need('claimProductionTask')(next.plan,{task:'analyse',agent:'codex-analysis'});
  assert.notEqual(claim.basisHash,f.c.basisHash,'Request/run/task identity must be bound to worker receipts');
});

test('task artifacts cannot alias originals through hardlinks',async t=>{
  const f=await claimed(t),r=await receipt(f);
  const link=`${f.root}/production/first-draft/tasks/analyse/source-alias.md`;
  await fs.link(path.join(ROOT,f.copy),path.join(ROOT,link));
  await f.put(r.file,{...r.result,artifacts:[{path:link,sha256:digest(await fs.readFile(path.join(ROOT,f.copy)))}]});
  await assert.rejects(()=>need('submitProductionTask')(f.p.plan,{task:'analyse',agent:'codex-analysis',result:r.file}),/hardlink/i);
  assert.match(await fs.readFile(path.join(ROOT,f.copy),'utf8'),/Illustrative source/);
});

test('task artifacts cannot escape their assigned folder through a junction',async t=>{
  const f=await claimed(t),r=await receipt(f),other=`${f.root}/other`,link=`${f.root}/production/first-draft/tasks/analyse/linked`;
  await f.put(`${other}/copy.md`,'Outside task folder');
  await fs.symlink(path.join(ROOT,other),path.join(ROOT,link),process.platform==='win32'?'junction':'dir');
  t.after(()=>fs.unlink(path.join(ROOT,link)).catch(error=>{if(error.code!=='ENOENT')throw error;}));
  await f.put(r.file,{...r.result,artifacts:[{path:`${link}/copy.md`,sha256:digest('Outside task folder')}]});
  await assert.rejects(()=>need('submitProductionTask')(f.p.plan,{task:'analyse',agent:'codex-analysis',result:r.file}),/junction|symlink/i);
});

test('reported playback or still review requires a real hashed evidence artifact',async t=>{
  const f=await claimed(t),r=await receipt(f,undefined,undefined,{review:{kind:'playback',evidence:[]}});
  await assert.rejects(()=>need('submitProductionTask')(f.p.plan,{task:'analyse',agent:'codex-analysis',result:r.file}),/review|evidence/i);
});

test('a directed digits choice is kept as a constraint and only the two real values are accepted',async t=>{
  const f=await fixture(t,{interaction:'directed',constraints:{digits:'arabic-indic'}});
  const p=await need('createProductionPlan')(f.file);
  assert.equal((await need('productionStatus')(p.plan)).constraints.digits,'arabic-indic');
  assert.throws(()=>need('validateProductionRequest')({...f.request,constraints:{digits:'roman'}}),/digits must be latin or arabic-indic/);
});

test('packets name the worker definition and the acceptance command, and status reports accept.json',async t=>{
  const f=await fixture(t);const p=await need('createProductionPlan')(f.file);
  const packet=JSON.parse(await fs.readFile(path.join(ROOT,p.packets[0]),'utf8'));
  assert.equal(packet.definition,'instructions/agents/analysis.md');
  assert.equal(packet.acceptance,`node scripts/production-accept.mjs --role analysis --task ${f.root}/production/first-draft/tasks/analyse`);
  const before=await need('productionStatus')(p.plan);
  assert.equal(before.tasks[0].acceptance,null);
  await f.put(`${f.root}/production/first-draft/tasks/analyse/accept.json`,{version:1,role:'analysis',task:`${f.root}/production/first-draft/tasks/analyse`,ok:false,checkedAt:'2026-10-18T00:00:00.000Z',checks:[{id:'intake',status:'fail',detail:'missing'}]});
  const after=await need('productionStatus')(p.plan);
  assert.deepEqual(after.tasks[0].acceptance,{ok:false,checkedAt:'2026-10-18T00:00:00.000Z',file:`${f.root}/production/first-draft/tasks/analyse/accept.json`});
  await f.put(`${f.root}/production/first-draft/tasks/analyse/accept.json`,'not json');
  assert.deepEqual((await need('productionStatus')(p.plan)).tasks[0].acceptance,{ok:false,checkedAt:null,file:`${f.root}/production/first-draft/tasks/analyse/accept.json`});
  const bound={version:1,role:'analysis',ok:true,checkedAt:'2026-10-18T00:00:00.000Z',basisHash:'f'.repeat(64),checks:[]};
  await f.put(`${f.root}/production/first-draft/tasks/analyse/accept.json`,bound);
  const mismatch=(await need('productionStatus')(p.plan)).tasks[0].acceptance;
  assert.equal(mismatch.ok,false);
  assert.equal(typeof mismatch.checkedAt,'string');
  const unbound={...bound};delete unbound.basisHash;
  await f.put(`${f.root}/production/first-draft/tasks/analyse/accept.json`,unbound);
  assert.equal((await need('productionStatus')(p.plan)).tasks[0].acceptance.ok,false);
});

test('acceptance is bound to the claim basis and dropped when the task goes stale',async t=>{
  const f=await claimed(t);
  await f.put(`${f.root}/production/first-draft/tasks/analyse/accept.json`,{version:1,role:'analysis',ok:true,checkedAt:'2026-10-18T00:00:00.000Z',basisHash:f.c.basisHash,checks:[]});
  const live=(await need('productionStatus')(f.p.plan)).tasks[0];
  assert.equal(live.state,'claimed');
  assert.equal(live.acceptance.ok,true);
  await f.put(`${f.root}/production/first-draft/tasks/analyse/accept.json`,{version:1,role:'analysis',ok:true,checkedAt:'2026-10-18T00:00:00.000Z',basisHash:'0'.repeat(64),checks:[]});
  const foreign=(await need('productionStatus')(f.p.plan)).tasks[0];
  assert.equal(foreign.state,'claimed');
  assert.equal(foreign.acceptance.ok,false,'a report for another claim basis is not a pass');
  await f.put(`${f.root}/production/first-draft/tasks/analyse/accept.json`,{version:1,role:'analysis',ok:true,checkedAt:'2026-10-18T00:00:00.000Z',basisHash:f.c.basisHash,checks:[]});
  await f.put(f.copy,'Source changed after the claim');
  const stale=(await need('productionStatus')(f.p.plan)).tasks[0];
  assert.equal(stale.state,'stale');
  assert.equal(stale.acceptance.ok,false);
});
