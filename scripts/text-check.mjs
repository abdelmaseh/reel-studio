import './lib/project-tmp.mjs';
import {cliArgs,readJson} from './lib/job-paths.mjs';
import {checkText} from './lib/text-check.mjs';

const usage='Usage: node scripts/text-check.mjs <edit.json> [--transcript captions.json] [--checks checks.json]';
try{
  const args=cliArgs(process.argv.slice(2),['transcript','checks']);
  if(args._.length!==1)throw new Error(usage);
  const manifest=await readJson(args._[0]);
  let transcriptWords;
  if(args.transcript){const transcript=await readJson(args.transcript);transcriptWords=Array.isArray(transcript)?transcript:Array.isArray(transcript?.captions)?transcript.captions:Array.isArray(transcript?.captions?.words)?transcript.captions.words:transcript?.words;
    if(!Array.isArray(transcriptWords))throw new Error('Expected word captions with text/startMs/endMs.');}
  const checks=args.checks?await readJson(args.checks):{};
  const result=checkText(manifest,{transcriptWords,explanatoryText:checks.explanatoryText??[],evidence:checks.evidence??[]});
  console.log(JSON.stringify(result,null,2));
  if(!result.ok)process.exitCode=1;
}catch(error){console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;}
