import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('preview output is a dedicated project folder and selection uses exact keys', async () => {
  const {previewOutputPath, selectPreviewItems} = await import('../scripts/lib/library-preview-runner.mjs');
  assert.match(previewOutputPath('Projects/library-demo'), /Projects[\\/]library-demo$/);
  for (const path of ['Raw/demo', 'Projects', 'Projects/../Raw', 'Projects/library-demo/../other', 'C:/outside']) assert.throws(() => previewOutputPath(path));
  const items = [{key:'concept:a',slug:'concept--a'},{key:'scene:b',slug:'scene--b'}];
  assert.deepEqual(selectPreviewItems(items,['scene:b']).map(x=>x.key),['scene:b']);
  assert.throws(()=>selectPreviewItems(items,['missing:key']),/Unknown/);
  assert.throws(()=>selectPreviewItems([...items,items[0]],[]),/Duplicate/);
});

test('unknown or damaged preview ownership never authorizes overwriting existing generated names',async t=>{
  const {readPreviousPreviewReport}=await import('../scripts/lib/library-preview-runner.mjs');
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'preview-owner-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  assert.equal(await readPreviousPreviewReport(root),null);
  await fs.writeFile(path.join(root,'index.html'),'keep this');
  await assert.rejects(readPreviousPreviewReport(root),/Unowned/);
  assert.equal(await fs.readFile(path.join(root,'index.html'),'utf8'),'keep this');
  await fs.writeFile(path.join(root,'previews.json'),'{broken');
  await assert.rejects(readPreviousPreviewReport(root),/Invalid/);
  await fs.writeFile(path.join(root,'previews.json'),JSON.stringify({owner:'another-tool',items:[]}));
  await assert.rejects(readPreviousPreviewReport(root),/owner/);
});

test('nested preview junctions are rejected before writes',async t=>{
  const {checkedPreviewPath}=await import('../scripts/lib/library-preview-runner.mjs');
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'preview-path-'));
  const outside=await fs.mkdtemp(path.join(os.tmpdir(),'preview-outside-'));
  t.after(async()=>{await fs.rm(root,{recursive:true,force:true});await fs.rm(outside,{recursive:true,force:true});});
  await fs.symlink(outside,path.join(root,'videos'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>checkedPreviewPath(root,path.join(root,'videos','example.mp4')),/symbolic|junction|outside/i);
});

test('resume identity includes source, real definition and preview quality', async () => {
  const {previewIdentity} = await import('../scripts/lib/library-preview-runner.mjs');
  const input={sourceHash:'abc',definition:{key:'scene:a',durationInFrames:120,fps:30,props:{previewKey:'scene:a'}},scale:0.5};
  assert.equal(previewIdentity(input),previewIdentity(structuredClone(input)));
  for(const change of [{sourceHash:'def'},{scale:0.4},{quality:'high'},{definition:{...input.definition,durationInFrames:180}}]) assert.notEqual(previewIdentity(input),previewIdentity({...input,...change}));
});

test('high-quality review captures native pixels without JPEG frame loss and pins its encoding profile',async()=>{
  const api=await import('../scripts/lib/library-preview-runner.mjs');
  assert.equal(typeof api.previewQualityProfile,'function','High-quality rendering needs an explicit reproducible profile.');
  const high=api.previewQualityProfile('high'),draft=api.previewQualityProfile('draft');
  assert.equal(high.defaultScale,1);assert.equal(high.imageFormat,'png');assert.equal(high.posterFormat,'png');
  assert.equal(high.colorSpace,'bt709');assert.equal(high.crf,18);assert.equal(high.x264Preset,'fast');
  assert.equal(draft.defaultScale,.5);assert.ok(draft.crf>high.crf);
  assert.throws(()=>api.previewQualityProfile('super'),/quality/i);
});

test('coverage accounts for nonvisual/internal entries without pretending a rendered preview', async()=>{
  const {previewCoverage}=await import('../scripts/lib/library-preview-runner.mjs');
  const report=previewCoverage({items:[{key:'concept:a',kind:'concept'},{key:'primitive:a',kind:'primitive'},{key:'sound:a',kind:'sound'}]},[{key:'concept:a',status:'rendered',video:'videos/a.mp4'}]);
  assert.equal(report.find(x=>x.key==='concept:a').status,'rendered');
  assert.equal(report.find(x=>x.key==='primitive:a').status,'internal');
  assert.equal(report.find(x=>x.key==='sound:a').status,'nonvisual');
});
