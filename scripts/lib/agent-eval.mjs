import {normalizeStyleId} from '../../engine/src/styles/registry.ts';
import {readFileSync} from 'node:fs';
import {editedMinutes,SWEEP_RECIPE as SWEEP} from './production-accept.mjs';

const BANDS=JSON.parse(readFileSync(new URL('../data/sound-bands.json',import.meta.url),'utf8'));
const DENSITY_FLOOR_SEC=20;
const row=(id,ok,expected,observed)=>({id,status:ok===null?'unknown':ok?'match':'miss',expected,observed:String(observed)});

/** Deterministic part of the behavioural eval. Null inputs mean "artifact absent" and score unknown, never miss. */
const objects=list=>Array.isArray(list)&&list.every(item=>item&&typeof item==='object');
/** A candidate manifest the scorer can read: an object whose scenes, sounds and segments are lists of objects. */
export const usableCandidate=candidate=>!!candidate&&typeof candidate==='object'&&!Array.isArray(candidate)&&['scenes','sounds','segments'].every(key=>objects(candidate[key]??[]));

export function scoreRun({expected,plan,candidate,cues,cutRows,textCheck}){
  plan=plan&&objects(plan.beats)&&plan.beats.length?plan:null;
  cues=cues&&objects(cues.sounds)?cues:null;
  candidate=usableCandidate(candidate)?candidate:null;
  const hard=[],soft=[];
  hard.push(row('no-invented-text',textCheck?textCheck.ok:null,'every on-screen Arabic literal spoken, listed or evidenced',textCheck?(textCheck.problems?.join('; ')||'ok'):'no text-check'));
  const signoff=candidate?.signoffFromFrame;
  hard.push(row('signoff-uncovered',candidate?(typeof signoff==='number'&&(candidate.sounds??[]).every(sound=>sound.atFrame<signoff)&&(candidate.scenes??[]).every(scene=>scene.fromFrame+scene.durationInFrames<=signoff)):null,'nothing at or after the sign-off',candidate?`signoffFromFrame ${signoff}`:'no candidate'));
  const comment=(candidate?.scenes??[]).find(scene=>/comment$/.test(String(scene.family)));
  hard.push(row('keyword-on-screen',candidate?(!expected.ending?.comment||(!!comment&&typeof comment.data?.keyword==='string'&&comment.data.keyword.trim().length>0)):null,'the comment scene shows the keyword',comment?comment.data?.keyword??'':'no comment scene'));

  soft.push(row('style',plan?normalizeStyleId(plan.style)===normalizeStyleId(expected.style.id):null,expected.style.id,plan?.style??'no plan'));
  soft.push(row('style-reason',plan?(expected.style.reasonContains??[]).every(word=>String(plan.reason).includes(word)):null,`reason mentions ${(expected.style.reasonContains??[]).join(', ')||'anything'}`,plan?.reason??'no plan'));
  soft.push(row('hook-start',plan?plan.beats[0]?.fromSec<=expected.hook.maxStartSec:null,`first beat ≤ ${expected.hook.maxStartSec} s`,plan?.beats?.[0]?.fromSec));
  soft.push(row('beat-count',plan?(plan.beats.length>=expected.beats.min&&plan.beats.length<=expected.beats.max):null,`${expected.beats.min}–${expected.beats.max} beats`,plan?.beats?.length));
  const want=[...(expected.ending?.comment?['comment']:[]),...(expected.ending?.follow?['follow']:[])];
  const tail=plan?plan.beats.slice(-want.length).map(beat=>String(beat.family).replace(/^glide-/,'')):[];
  soft.push(row('ending-order',plan?want.every((family,index)=>tail[index]===family):null,want.join(' → ')||'no ending',tail.join(' → ')));
  soft.push(row('no-whoosh',cues?(!expected.sound?.noWhoosh||cues.sounds.every(sound=>!SWEEP.test(sound.recipe))):null,'no air sweep (-sweep twins or bare sweep ids)',cues?cues.sounds.filter(sound=>SWEEP.test(sound.recipe)).map(sound=>sound.recipe).join(', ')||'none':'no cues'));
  if(expected.cuts?.retakeIds?.length)soft.push(row('retakes-flagged',cutRows?expected.cuts.retakeIds.every(id=>cutRows.some(cut=>Number(cut[0])===id&&['retake','filler'].includes(cut[1]))):null,`rows ${expected.cuts.retakeIds.join(', ')} flagged as retake/filler`,cutRows?cutRows.map(cut=>`${cut[0]}:${cut[1]}`).join(' '):'no cut table'));

  const fps=cues?.fps||candidate?.source?.fps||30,frames=(cues?.sounds??[]).map(sound=>sound.atFrame).sort((a,b)=>a-b);
  let gap=Infinity;for(let index=1;index<frames.length;index++)gap=Math.min(gap,(frames[index]-frames[index-1])/fps);
  soft.push(row('min-gap',cues?gap>=BANDS.minGapSec:null,`cues at least ${BANDS.minGapSec} s apart`,cues?(frames.length<2?'n/a':`${gap.toFixed(2)} s`):'no cues'));
  const band=BANDS.bands[expected.sound?.band],minutes=candidate?editedMinutes(candidate):0;
  if(band&&cues&&minutes*60>=DENSITY_FLOOR_SEC){const perMinute=cues.sounds.length/minutes;soft.push(row('cue-band',perMinute>=band[0]&&perMinute<=band[1],`${expected.sound.band} band ${band.join('–')} cues/min`,`${perMinute.toFixed(1)} cues/min`));}

  const hardBreaks=hard.filter(item=>item.status==='miss').length;
  const judged=soft.filter(item=>item.status!=='unknown'),matches=judged.filter(item=>item.status==='match').length;
  const softMatchRatio=judged.length?matches/judged.length:0;
  const judge=(expected.clauses??[]).map(clause=>({id:`clause:${clause.phrase}`,expected:`${clause.visualKind}${clause.note?` — ${clause.note}`:''}`,artifact:'tasks/editorial/EDITORIAL_PLAN.md'}));
  const unknown=[...hard,...soft].some(item=>item.status==='unknown');
  return {version:1,hard,soft,hardBreaks,softMatchRatio,ok:!unknown&&hardBreaks===0&&softMatchRatio>=(expected.passBar?.softRatio??0.8),judge,
    minutes:candidate?editedMinutes(candidate):null};
}

export function judgeBrief(score,expected,runFolder){
  const lines=['# Judge brief','',`Run: ${runFolder}`,`Reference: ${expected.recording} (reviewed by ${expected.reviewedBy})`,'',
    '## Hard rules (deterministic, copy unchanged)','','| id | status | expected | observed |','| --- | --- | --- | --- |',
    ...score.hard.map(item=>`| ${item.id} | ${item.status} | ${item.expected} | ${item.observed} |`),'',
    '## Soft rules (deterministic, copy unchanged)','','| id | status | expected | observed |','| --- | --- | --- | --- |',
    ...score.soft.map(item=>`| ${item.id} | ${item.status} | ${item.expected} | ${item.observed} |`),'',
    '## For the judge: clause → visual','','Read the artifact and decide match / partial / miss with the evidence row.','','| id | expected | artifact |','| --- | --- | --- |',
    ...score.judge.map(item=>`| ${item.id} | ${item.expected} | ${runFolder}/${item.artifact} |`),''];
  return lines.join('\n');
}
