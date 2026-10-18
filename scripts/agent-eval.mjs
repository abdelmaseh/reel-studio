import './lib/project-tmp.mjs';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {ROOT,cliArgs,readJson,relativePath} from './lib/job-paths.mjs';
import {checkText} from './lib/text-check.mjs';
import {tableRows} from './lib/production-accept.mjs';
import {scoreRun,judgeBrief,usableCandidate} from './lib/agent-eval.mjs';

const usage='Usage: node scripts/agent-eval.mjs score --run Projects/<id>/production/<run> --expected <expected.json> --out <state/evals/<name>/runs/<date>> [--transcript captions.json]';
const optional=async rel=>{try{return await readJson(rel);}catch{return null;}};
const abs=rel=>path.join(ROOT,...rel.split('/'));
try{
  const [action,...tokens]=process.argv.slice(2);
  if(action!=='score')throw new Error(usage);
  const args=cliArgs(tokens,['run','expected','out','transcript']);
  if(args._.length||!args.run||!args.expected||!args.out)throw new Error(usage);
  const run=args.run.replace(/\/+$/,'');relativePath(run);
  const out=args.out.replace(/\/+$/,'');relativePath(out);
  if(!/^(?:state\/evals\/|Projects\/[a-z0-9][a-z0-9-]{0,63}\/production\/)[^/]/.test(out))throw new Error('--out must be under state/evals/ or a project production folder (Projects/<id>/production/).');
  const expected=await readJson(args.expected);
  const plan=await optional(`${run}/tasks/editorial/plan.json`);
  const candidate=await optional(`${run}/tasks/edit/edit.json`);
  const checks=await optional(`${run}/tasks/edit/checks.json`);
  const cues=await optional(`${run}/tasks/sound/cues.json`);
  const cutMarkdown=await fs.readFile(abs(`${run}/tasks/analysis/cut-table.md`),'utf8').catch(()=>null);
  const cutRows=cutMarkdown===null?null:tableRows(cutMarkdown,['ID','Kind','From','To','Decision']);
  let transcriptWords;
  if(args.transcript){const words=await readJson(args.transcript);transcriptWords=Array.isArray(words)?words:Array.isArray(words?.captions)?words.captions:words?.captions?.words??words?.words;
    if(!Array.isArray(transcriptWords))throw new Error('Expected word captions with text/startMs/endMs in --transcript.');}
  // Without checks.json the explanatory labels are unknown, so the text rule is unknown rather than a hard miss.
  // With no spoken words to compare against (no --transcript and no captions in the candidate) the text rule is unknown too.
  const spoken=transcriptWords??candidate?.captions?.words;
  const hasWords=Array.isArray(spoken)&&spoken.some(word=>typeof word?.text==='string'&&word.text.trim());
  const textCheck=usableCandidate(candidate)&&checks&&hasWords?checkText(candidate,{transcriptWords,explanatoryText:checks.explanatoryText??[],evidence:checks.evidence??[]}):null;
  const score=scoreRun({expected,plan,candidate,cues,cutRows,textCheck});
  await fs.mkdir(abs(out),{recursive:true});
  await fs.writeFile(abs(`${out}/score.json`),JSON.stringify(score,null,2)+'\n','utf8');
  await fs.writeFile(abs(`${out}/judge-brief.md`),judgeBrief(score,expected,run),'utf8');
  console.log(JSON.stringify({ok:score.ok,hardBreaks:score.hardBreaks,softMatchRatio:score.softMatchRatio,score:`${out}/score.json`,brief:`${out}/judge-brief.md`},null,2));
  if(!score.ok)process.exitCode=1;
}catch(error){console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;}
