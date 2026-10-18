import './lib/project-tmp.mjs';
import {cliArgs} from './lib/job-paths.mjs';
import {acceptTask,ACCEPT_ROLES} from './lib/production-accept.mjs';

const usage=`Usage: node scripts/production-accept.mjs --role <${ACCEPT_ROLES.join('|')}> --task Projects/<id>/production/<run>/tasks/<task> [--transcript captions.json] [--edit edit.json] [--deliver]`;
try{
  const args=cliArgs(process.argv.slice(2),['role','task','transcript','edit','deliver'],['deliver']);
  if(args._.length||!args.role||!args.task)throw new Error(usage);
  const report=await acceptTask({role:args.role,task:args.task,transcript:args.transcript,edit:args.edit,deliver:!!args.deliver});
  for(const item of report.checks)process.stderr.write(`${item.status.toUpperCase().padEnd(4)} ${item.id}: ${item.detail}\n`);
  console.log(JSON.stringify(report,null,2));
  if(!report.ok)process.exitCode=1;
}catch(error){console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;}
