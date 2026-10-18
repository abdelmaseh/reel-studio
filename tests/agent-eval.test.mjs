import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import {scoreRun} from '../scripts/lib/agent-eval.mjs';

const expected=JSON.parse(await fs.readFile(new URL('./fixtures/agent-eval/expected-sample.json',import.meta.url),'utf8'));
const plan={version:1,style:'split-canvas',reason:'demo beside the speaker',beats:[{id:'b1',kind:'visual',fromSec:0,toSec:3,family:'intro'},{id:'b2',kind:'visual',fromSec:3,toSec:6,family:'proof'},{id:'b3',kind:'visual',fromSec:6,toSec:8,family:'comment'},{id:'b4',kind:'presenter',fromSec:8,toSec:10,family:'follow'}]};
const candidate={signoffFromFrame:300,source:{fps:30,totalFrames:330},segments:[{fromFrame:0,toFrame:330}],scenes:[{id:'b3',family:'comment',fromFrame:180,durationInFrames:60,data:{keyword:'جديدة'}},{id:'b4',family:'follow',fromFrame:240,durationInFrames:60,data:{}}],sounds:[{atFrame:10,recipe:'soft-pop',gain:0.4}]};
const cues={version:1,fps:30,sounds:[{atFrame:10,recipe:'soft-pop',gain:0.4}]};
const cutRows=[['1','silence','2.1','3.0','0.9','none','auto'],['3','retake','8.0','9.5','1.5','«…»','question']];
const textCheck={ok:true,problems:[]};

test('a run that matches the reference passes with no hard breaks and lists the clauses for the judge',()=>{
  const score=scoreRun({expected,plan,candidate,cues,cutRows,textCheck});
  assert.equal(score.hardBreaks,0);assert.equal(score.ok,true);
  assert.ok(score.softMatchRatio>=0.8,String(score.softMatchRatio));
  assert.deepEqual(score.judge.map(item=>item.id),['clause:قبل ما تبدأ خطة جديدة']);
  assert.equal(scoreRun({expected,plan,candidate,cues:{...cues,sounds:[{atFrame:10,recipe:'directional-whoosh',gain:0.4}]},cutRows,textCheck}).soft.find(item=>item.id==='no-whoosh').status,'match');
});

test('invented text, a sound after the sign-off or a missing keyword are hard breaks',()=>{
  const broken=scoreRun({expected,plan,candidate:{...candidate,sounds:[{atFrame:305,recipe:'soft-pop',gain:0.4}],scenes:[candidate.scenes[1]]},cues,cutRows,textCheck:{ok:false,problems:['unlisted Arabic text b1.data.title']}});
  assert.equal(broken.hardBreaks,3);assert.equal(broken.ok,false);
  assert.deepEqual(broken.hard.filter(item=>item.status==='miss').map(item=>item.id).sort(),['keyword-on-screen','no-invented-text','signoff-uncovered']);
});

test('soft misses lower the ratio: wrong style, late hook, sweeps, unflagged retake',()=>{
  const score=scoreRun({expected,plan:{...plan,style:'one-shot',beats:[{...plan.beats[0],fromSec:6},...plan.beats.slice(1)]},candidate,cues:{...cues,sounds:[{atFrame:10,recipe:'whoosh',gain:0.4}]},cutRows:[cutRows[0]],textCheck});
  assert.equal(score.hardBreaks,0);assert.equal(score.ok,false);
  assert.deepEqual(score.soft.filter(item=>item.status==='miss').map(item=>item.id).sort(),['hook-start','no-whoosh','retakes-flagged','style']);
});

test('missing artifacts are unknown, not misses',()=>{
  const score=scoreRun({expected,plan:null,candidate:null,cues:null,cutRows:null,textCheck:null});
  assert.ok(score.hard.every(item=>item.status==='unknown'));
  assert.ok(score.soft.every(item=>item.status==='unknown'));
  assert.equal(score.ok,false);
});

test('every row must be judged before a run passes; odd shapes score unknown instead of crashing',()=>{
  const noPlan=scoreRun({expected,plan:null,candidate,cues,cutRows,textCheck});
  assert.equal(noPlan.hardBreaks,0);assert.equal(noPlan.ok,false,'unknown soft rows block a pass');
  const odd=scoreRun({expected,plan:{version:1,style:'split-canvas',reason:'demo'},candidate,cues:{version:1},cutRows,textCheck});
  assert.equal(odd.soft.find(item=>item.id==='hook-start').status,'unknown');
  assert.equal(odd.soft.find(item=>item.id==='no-whoosh').status,'unknown');
  const oddCandidate=scoreRun({expected,plan:{...plan,beats:[null,...plan.beats]},candidate:{...candidate,sounds:'x'},cues:{version:1,sounds:[null]},cutRows,textCheck});
  assert.equal(oddCandidate.hard.find(item=>item.id==='signoff-uncovered').status,'unknown');
  assert.equal(oddCandidate.soft.find(item=>item.id==='hook-start').status,'unknown');
  assert.equal(oddCandidate.soft.find(item=>item.id==='min-gap').status,'unknown');
  assert.equal(scoreRun({expected,plan,candidate:{...candidate,segments:'x'},cues,cutRows,textCheck}).hard.find(item=>item.id==='signoff-uncovered').status,'unknown');
});

test('cue band and minimum gap are scored once the edit is long enough to judge',()=>{
  const long={...candidate,source:{fps:30,totalFrames:1800},segments:[{fromFrame:0,toFrame:1800}],signoffFromFrame:1790};
  const dense=Array.from({length:40},(_,i)=>({atFrame:i*36,recipe:'soft-pop',gain:0.4}));
  const ok=scoreRun({expected,plan,candidate:long,cues:{version:1,fps:30,sounds:dense},cutRows,textCheck});
  assert.equal(ok.soft.find(item=>item.id==='cue-band').status,'match');assert.equal(ok.soft.find(item=>item.id==='min-gap').status,'match');
  const sparse=scoreRun({expected,plan,candidate:long,cues:{version:1,fps:30,sounds:[...dense.slice(0,5),{atFrame:150,recipe:'soft-pop',gain:0.4}]},cutRows,textCheck});
  assert.equal(sparse.soft.find(item=>item.id==='cue-band').status,'miss');assert.equal(sparse.soft.find(item=>item.id==='min-gap').status,'miss');
  assert.equal(scoreRun({expected,plan,candidate,cues,cutRows,textCheck}).soft.some(item=>item.id==='cue-band'),false,'an 11 s edit is too short to judge density');
});
