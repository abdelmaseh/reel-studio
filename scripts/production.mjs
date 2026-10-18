import {parseArgs} from 'node:util';
import {createProductionPlan,claimProductionTask,submitProductionTask,productionStatus} from './lib/production-manager.mjs';
try{
  const {positionals,values}=parseArgs({args:process.argv.slice(2),allowPositionals:true,options:{task:{type:'string'},agent:{type:'string'},result:{type:'string'}}});
  const [action,file]=positionals;
  const allowed={create:[],status:[],claim:['task','agent'],submit:['task','agent','result']};
  if(positionals.length!==2||!Object.hasOwn(allowed,action)||Object.keys(values).some(key=>!allowed[action].includes(key))||allowed[action].some(key=>!values[key]))throw new Error('Usage: production.mjs create <request.json> | status <plan.json> | claim <plan.json> --task id --agent alias | submit <plan.json> --task id --agent alias --result <task/result.json>');
  const result=action==='create'?await createProductionPlan(file):action==='status'?await productionStatus(file):action==='claim'?await claimProductionTask(file,values):await submitProductionTask(file,values);
  console.log(JSON.stringify(result,null,2));
}catch(error){console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;}
