import {parseArgs} from 'node:util';
import {renderLibraryPreviews} from './lib/library-preview-runner.mjs';

try{
  const {values}=parseArgs({strict:true,options:{out:{type:'string'},only:{type:'string'},scale:{type:'string'},quality:{type:'string'},concurrency:{type:'string'}}});
  if(!values.out)throw new Error('Usage: node scripts/library-previews.mjs --out Projects/<slug> [--only key,key] [--quality draft|high] [--scale 0.5] [--concurrency 4]');
  const report=await renderLibraryPreviews({out:values.out,keys:values.only?values.only.split(','):[],quality:values.quality??'draft',...(values.scale===undefined?{}:{scale:Number(values.scale)}),concurrency:Number(values.concurrency??4),onProgress:line=>process.stderr.write(`${line}\n`)});
  console.log(JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1;
}catch(error){console.error(error instanceof Error?error.stack:JSON.stringify(error));process.exitCode=1;}
