import {readJson,object} from './job-paths.mjs';
import {readEditSnapshot} from './edit-safety.mjs';
import {createManifestStore} from './review-editor-jobs.mjs';
import {validateManifest} from '../../engine/src/review-editor/validate.ts';

export async function editRevision(manifestPath){
  const snapshot=await readEditSnapshot(manifestPath);
  if(!snapshot)throw new Error(`Required input is missing: ${manifestPath}`);
  return {ok:true,manifest:manifestPath,revision:snapshot.revision};
}

/** Pure merge: scenes by id (re-sorted by fromFrame), whole-list replacement for sounds, transitions and camera. Captions, segments, footage and source are never touched. */
export function applyPatchToManifest(manifest,patch){
  object(patch,['version','baseRevision','scenes','sounds','transitions','camera'],'patch');
  if(patch.version!==1)throw new Error('Patch version must be 1.');
  const next=JSON.parse(JSON.stringify(manifest));
  const applied={scenesUpserted:0,scenesRemoved:0,sounds:null,transitions:null,camera:null};
  if(patch.scenes!==undefined){
    object(patch.scenes,['upsert','remove'],'patch scenes');
    const removeIds=patch.scenes.remove??[],upsert=patch.scenes.upsert??[];
    if(!Array.isArray(removeIds))throw new Error('patch scenes.remove must be a list of scene ids.');
    if(!Array.isArray(upsert))throw new Error('patch scenes.upsert must be a list of scenes.');
    const ids=upsert.map(scene=>scene?.id);
    if(ids.some(id=>typeof id!=='string'))throw new Error('Each upserted scene needs an id.');
    if(new Set(ids).size!==ids.length)throw new Error('A scene id appears twice in patch scenes.upsert.');
    const remove=new Set(removeIds);
    const current=next.scenes??[];
    let scenes=current.filter(scene=>!remove.has(scene.id));
    applied.scenesRemoved=current.length-scenes.length;
    for(const scene of upsert){
      scenes=scenes.filter(item=>item.id!==scene.id);scenes.push(scene);applied.scenesUpserted++;
    }
    next.scenes=scenes.sort((a,b)=>(a.fromFrame??0)-(b.fromFrame??0));
  }
  for(const key of ['sounds','transitions','camera']){
    if(patch[key]===undefined)continue;
    object(patch[key],['replace'],`patch ${key}`);
    if(!Array.isArray(patch[key].replace))throw new Error(`patch ${key}.replace must be a list.`);
    next[key]=patch[key].replace;applied[key]=patch[key].replace.length;
  }
  return {next,applied};
}

export async function applyEditPatch(manifestPath,patchPath,{label}={}){
  const snapshot=await readEditSnapshot(manifestPath);
  if(!snapshot)throw new Error(`Required input is missing: ${manifestPath}`);
  const patch=await readJson(patchPath);
  if(typeof patch?.baseRevision!=='string')throw new Error('The patch must carry baseRevision from `editor.mjs revision`.');
  if(patch.baseRevision!==snapshot.revision)throw new Error(`${manifestPath} changed since the patch was written (stale baseRevision). Read the latest edit, rewrite the patch and retry. Nothing was changed.`);
  const {next,applied}=applyPatchToManifest(snapshot.manifest,patch);
  const check=validateManifest(next);
  if(!check.ok)throw new Error(`Patched manifest fails validation: ${check.issues.map(issue=>issue.message).join('; ')}. Nothing was changed.`);
  const store=createManifestStore({manifestPath});
  const saved=await store.save({manifest:next,baseRevision:snapshot.revision,label:label??'اقتراح الفريق'});
  return {ok:true,manifest:manifestPath,backup:saved.backup,manifestRevision:saved.manifestRevision,applied};
}
