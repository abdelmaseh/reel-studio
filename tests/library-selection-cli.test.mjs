import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../',import.meta.url));
const run=(...args)=>spawnSync(process.execPath,['scripts/library.mjs',...args],{cwd,encoding:'utf8',windowsHide:true});

test('main-skill CLI can inspect meanings and shortlist against an actual context file without mutating it',async()=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'reel-selection-cli-'));
  try{
    const file=path.join(folder,'context.json'),input=JSON.stringify({intent:'process',mode:'recording',style:'paper-collage',mood:'calm',energy:'low',layout:'split',durationSec:4,sourceKind:'presenter',assets:[]});
    await fs.writeFile(file,input,'utf8');
    const result=run('recommend','--context',file);
    assert.equal(result.status,0,result.stderr);
    const output=JSON.parse(result.stdout);
    assert.ok(output.candidates.some(item=>item.key==='scene:process'));
    assert.equal(output.context.style,'paper-collage');
    assert.equal(await fs.readFile(file,'utf8'),input);
    const show=run('show','scene:process');assert.equal(show.status,0,show.stderr);
    assert.ok(JSON.parse(show.stdout).item.editorial.display.explains);
    const catalog=run('catalog','--format','markdown');assert.equal(catalog.status,0,catalog.stderr);
    assert.match(catalog.stdout,/scene:process/);assert.match(catalog.stdout,/Use when/);
  }finally{
    assert.equal(path.dirname(folder),path.resolve(os.tmpdir()));assert.ok(path.basename(folder).startsWith('reel-selection-cli-'));
    await fs.rm(folder,{recursive:true,force:true});
  }
});

test('CLI refuses malformed selection context and unsupported command options',()=>{
  for(const args of [['recommend'],['recommend','--context','missing.json','--query','process'],['catalog','--context','anything.json']]){
    const result=run(...args);assert.notEqual(result.status,0);assert.equal(result.stdout,'');
  }
});
