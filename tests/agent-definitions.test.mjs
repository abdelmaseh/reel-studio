import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {AGENT_ROLES,AGENT_DIR,parseAgentDefinition} from '../scripts/sync-assistant-guides.mjs';
import {scanPublicationFile} from '../scripts/lib/publication-policy.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const EXPECTED_MODEL={analysis:'haiku',editorial:'sonnet',assets:'haiku',sound:'sonnet',edit:'sonnet',qa:'sonnet',delivery:'haiku','eval-judge':'sonnet'};
const FORBIDDEN=[/@[a-z0-9_.]{3,}/i,/eleven_v\d|voice[_ -]?id\s*[:=]/i,/editor pro max/i,/\bviews\b.*\d{3,}/i];

for(const role of AGENT_ROLES){
  test(`${role} definition parses, uses the agreed model and names no private data`,async()=>{
    const relativePath=`${AGENT_DIR}/${role}.md`;
    const bytes=await fs.readFile(path.join(ROOT,relativePath));
    const text=bytes.toString('utf8');
    const {front,body}=parseAgentDefinition(text,role);
    assert.equal(front.model,EXPECTED_MODEL[role]);
    for(const pattern of FORBIDDEN)assert.doesNotMatch(text,pattern,`${role}: ${pattern}`);
    assert.ok(body.includes('## Knowledge'));
    assert.deepEqual(scanPublicationFile(relativePath,bytes),[],`${role}: publication scan`);
  });
}

test('workers never claim the live edit or the creator conversation',async()=>{
  for(const role of AGENT_ROLES.filter(role=>!['eval-judge'].includes(role))){
    const text=await fs.readFile(path.join(ROOT,AGENT_DIR,`${role}.md`),'utf8');
    const {front}=parseAgentDefinition(text,role);
    assert.ok(!front.writes.some(folder=>/edit\.json|brief\.json|^Raw\/|PROFILE\.json|^Outputs\//.test(folder)),`${role} writes a protected path`);
    assert.match(text,/## Never/);
  }
});

test('sound bands are ordered positive ranges',async()=>{
  const bands=JSON.parse(await fs.readFile(path.join(ROOT,'scripts/data/sound-bands.json'),'utf8'));
  assert.equal(bands.version,1);
  for(const [key,[lo,hi]]of Object.entries(bands.bands))assert.ok(lo>=0&&hi>lo,`${key}`);
  for(const key of ['grid-glide','calm','editorial','energetic','podcast'])assert.ok(bands.bands[key],`${key} band`);
});
