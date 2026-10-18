import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
test('library CLI exposes ranked source-backed gaps as JSON and readable Markdown',()=>{
  const run=(...args)=>spawnSync(process.execPath,['scripts/library.mjs','gaps',...args],{cwd:root,encoding:'utf8',windowsHide:true});
  const json=run();assert.equal(json.status,0,json.stderr);const report=JSON.parse(json.stdout);
  assert.ok(report.coverage.find(item=>item.id==='branching').existingCandidates.some(item=>item.key==='concept:conditional-branching'));
  assert.ok(report.gaps.some(item=>item.id==='queue-bottleneck'));
  assert.ok(report.gaps.every(item=>item.sourceEvidence.length));
  const md=run('--format','markdown');assert.equal(md.status,0,md.stderr);assert.match(md.stdout,/branch|تفرع|قرار/i);
});
