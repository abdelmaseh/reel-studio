import path from 'node:path';
import {previewOutputPath,checkedPreviewPath,readPreviousPreviewReport} from './library-preview-runner.mjs';

const SLUG=/^[a-z0-9][a-z0-9-]{0,63}$/;
const MEDIA=/^(?:videos\/[a-z0-9-]+\.mp4|posters\/[a-z0-9-]+\.(?:jpg|png))$/;

export async function loadGalleryBatches(outputs){
  if(!Array.isArray(outputs)||!outputs.length||outputs.length>8||new Set(outputs).size!==outputs.length)throw new Error('Choose one to eight distinct owned preview batches.');
  const batches=[];
  for(const out of outputs){
    const root=previewOutputPath(out),report=await readPreviousPreviewReport(root);
    if(!report)throw new Error(`Preview batch has not been prepared: ${out}`);
    batches.push({out,slug:path.basename(root),root,report});
  }
  return batches;
}

/** Aggregate references only; every media file stays in its original owned batch. */
export function mergeGalleryBatches(batches){
  const merged=new Map(),seen=new Set();
  for(const batch of batches){
    if(!SLUG.test(batch.slug)||seen.has(batch.slug))throw new Error('Invalid or repeated gallery batch.');
    seen.add(batch.slug);
    for(const item of batch.report.items){
      for(const field of ['video','poster'])if(item[field]!==undefined&&!MEDIA.test(item[field]))throw new Error('Unsafe batch media path.');
      const candidate={...item,status:item.status==='rendered'&&!item.video?'pending':item.status,batchId:batch.slug,batchSourceHash:batch.report.sourceHash,batchQuality:batch.report.quality??'draft',
        ...(item.video?{video:`batches/${batch.slug}/${item.video}`} :{}),
        ...(item.poster?{poster:`batches/${batch.slug}/${item.poster}`} :{})};
      const prior=merged.get(item.key);
      if(!prior||candidate.status==='rendered'||prior.status!=='rendered')merged.set(item.key,candidate);
    }
  }
  const priority=new Map(batches.map((batch,index)=>[batch.slug,index]));
  return [...merged.values()].sort((a,b)=>Number(b.status==='rendered')-Number(a.status==='rendered')||priority.get(b.batchId)-priority.get(a.batchId));
}

/** Only routes to the explicitly registered roots; never accept a filesystem path from a URL. */
export function resolveGalleryFile(batches,name){
  let batch=batches[0],relative=name.startsWith('/')?name.slice(1):'';
  const prefixed=/^\/batches\/([a-z0-9-]+)\/(.+)$/.exec(name);
  if(prefixed){batch=batches.find(item=>item.slug===prefixed[1]);relative=prefixed[2];}
  if(!batch||!(MEDIA.test(relative)||/^(?:previews|coverage|gaps)\.(?:json|md)$/.test(relative)))return null;
  return {root:batch.root,relative,file:checkedPreviewPath(batch.root,path.join(batch.root,...relative.split('/')))};
}
