import {promises as fs, lstatSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ROOT, assertProjectOutput} from './project-paths.mjs';
import {renderChromiumOptions} from './render-gl.mjs';

const run=promisify(execFile);
const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const OWNER='reel-studio-library-previews-v1';
export function previewOutputPath(out){
  if(typeof out!=='string'||!/^Projects\/[a-z0-9][a-z0-9-]{0,63}$/.test(out)) throw new Error('Preview output must be a dedicated Projects/<slug> folder.');
  return checkedPreviewPath(ROOT,assertProjectOutput(path.resolve(ROOT,out)));
}
export function checkedPreviewPath(root,target){
  root=path.resolve(root);target=path.resolve(target);
  const relative=path.relative(root,target);
  if(relative==='..'||relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative))throw new Error('Preview path is outside its output folder.');
  let cursor=root;
  for(const part of ['',...relative.split(path.sep).filter(Boolean)]){
    if(part)cursor=path.join(cursor,part);
    let stat;try{stat=lstatSync(cursor);}catch(error){if(error.code==='ENOENT')continue;throw error;}
    if(stat.isSymbolicLink())throw new Error('Preview paths refuse symbolic links and junctions.');
    if(cursor===target&&stat.isFile()&&stat.nlink!==1)throw new Error('Preview paths refuse hardlinked output files.');
  }
  return target;
}
export async function readPreviousPreviewReport(root){
  const file=checkedPreviewPath(root,path.join(root,'previews.json'));
  let text;try{text=await fs.readFile(file,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  if(text!==undefined){let report;try{report=JSON.parse(text);}catch{throw new Error('Invalid preview ownership report; choose another output folder.');}
    if(report?.owner!==OWNER||!Array.isArray(report.items))throw new Error('This output folder has another preview owner.');return report;
  }
  for(const name of ['index.html','coverage.json','gaps.json','gaps.md','videos','posters','.public','.bundle']){
    if(await fs.lstat(path.join(root,name)).catch(error=>{if(error.code==='ENOENT')return null;throw error;}))throw new Error(`Unowned preview output exists: ${name}`);
  }
  return null;
}
export function selectPreviewItems(definitions,keys=[]){
  const map=new Map();
  for(const item of definitions){if(map.has(item.key))throw new Error(`Duplicate preview key: ${item.key}`);if(!/^[a-z0-9][a-z0-9-]*$/.test(item.slug))throw new Error('Unsafe preview slug.');map.set(item.key,item);}
  for(const key of keys)if(!map.has(key))throw new Error(`Unknown preview key: ${key}`);
  return keys.length?definitions.filter(item=>keys.includes(item.key)):definitions;
}
export function previewQualityProfile(quality='draft'){
  if(!['draft','high'].includes(quality))throw new Error('Preview quality must be draft or high.');
  return quality==='high'
    ?{quality,defaultScale:1,codec:'h264',crf:18,x264Preset:'fast',imageFormat:'png',posterFormat:'png',colorSpace:'bt709'}
    :{quality,defaultScale:.5,codec:'h264',crf:27,x264Preset:'ultrafast',imageFormat:'jpeg',posterFormat:'jpeg',colorSpace:'default'};
}
export const previewIdentity=({sourceHash,definition,scale,quality='draft'})=>hash({sourceHash,definition,scale,encoding:previewQualityProfile(quality)});
export function previewCoverage(inventory,previews){
  const byKey=new Map(previews.map(item=>[item.key,item]));
  return inventory.items.map(item=>({key:item.key,status:byKey.get(item.key)?.status??(item.kind==='primitive'?'internal':item.kind==='sound'?'nonvisual':'unrepresented'),
    preview:byKey.get(item.key)?.video??null,reason:byKey.has(item.key)?undefined:item.kind==='primitive'?'Authoring building block, not a separate shipped animation.':item.kind==='sound'?'Audio is outside this visual gallery.':'No preview binding was declared.'}));
}
async function fingerprint(){
  const digest=createHash('sha256');
  async function visit(folder){for(const entry of (await fs.readdir(folder,{withFileTypes:true})).sort((a,b)=>a.name<b.name?-1:1)){
    const file=path.join(folder,entry.name);if(entry.isSymbolicLink())throw new Error('Preview source fingerprint refuses symbolic links.');
    if(entry.isDirectory())await visit(file);else if(entry.isFile()){digest.update(path.relative(ROOT,file));digest.update(await fs.readFile(file));}
  }}
  await visit(path.join(ROOT,'engine','src'));
  for(const file of ['versions.lock.json','engine/package-lock.json'])digest.update(await fs.readFile(path.join(ROOT,file)));
  return digest.digest('hex');
}
async function atomic(root,file,value){checkedPreviewPath(root,file);const temp=checkedPreviewPath(root,`${file}.${process.pid}.tmp`);await fs.writeFile(temp,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{encoding:'utf8',flag:'wx'});await fs.rename(temp,checkedPreviewPath(root,file));}
const message=error=>error instanceof Error?error.message:String(error?.message??JSON.stringify(error));
async function fileHash(file){try{return createHash('sha256').update(await fs.readFile(file)).digest('hex');}catch{return null;}}

export async function renderLibraryPreviews({out,keys=[],quality='draft',scale,concurrency=4,onProgress=()=>{}}){
  const output=previewOutputPath(out);
  const encoding=previewQualityProfile(quality);scale??=encoding.defaultScale;
  if(!Number.isFinite(scale)||scale<0.25||scale>1)throw new Error('Preview scale must be from 0.25 to 1.');
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>8)throw new Error('Preview concurrency must be from 1 to 8.');
  const {previewDefinitions,previewSvgAssets}=await import('../../engine/src/library-preview/fixtures.ts');
  const definitions=previewDefinitions(),selected=selectPreviewItems(definitions,keys);
  const {collectLibraryInventory}=await import('./library-inventory.mjs');
  const {analyzeLibraryGaps,gapsMarkdown}=await import('./library-gaps.mjs');
  const {renderLibraryGallery}=await import('./library-gallery.mjs');
  const {galleryViewData}=await import('./library-gallery-copy.mjs');
  const {collectLibraryEditorial}=await import('./library-selection.mjs');
  const inventory=await collectLibraryInventory(),gapReport=analyzeLibraryGaps(inventory),sourceHash=await fingerprint();
  const editorial=await collectLibraryEditorial({inventory});
  await fs.mkdir(output,{recursive:true});
  const reportFile=path.join(output,'previews.json');
  const previous=await readPreviousPreviewReport(output);
  const target=relative=>checkedPreviewPath(output,path.join(output,...relative.split('/')));
  const old=new Map((previous?.items??[]).map(item=>[item.key,item]));
  const items=definitions.map(definition=>{
    const identity=previewIdentity({sourceHash,definition,scale,quality});
    const prior=old.get(definition.key);
    return {...definition,fixture:undefined,identity,status:definition.status==='supported'?(prior?.identity===identity?prior.status:'pending'):'unsupported',
      ...(prior?.identity===identity?{video:prior.video,poster:prior.poster,sha256:prior.sha256,posterSha256:prior.posterSha256,durationSec:prior.durationSec,ms:prior.ms,renderInfo:prior.renderInfo,visualReview:prior.visualReview}:{}),
      notes:[...definition.notes,...(definition.reason?[definition.reason]:[])]};
  });
  const report={version:1,owner:OWNER,sourceHash,scale,quality,encoding,items,verification:'Decoded output and sampled frames are separate from creator approval.'};
  async function save(){
    await atomic(output,reportFile,report);
    await atomic(output,target('coverage.json'),previewCoverage(inventory,items));
    await atomic(output,target('gaps.json'),gapReport);
    await atomic(output,target('gaps.md'),gapsMarkdown(gapReport));
    await atomic(output,target('index.html'),renderLibraryGallery({...galleryViewData(items,gapReport,inventory,editorial),title:'مكتبة الموشن — المعاينات وأولويات التوسّع'}));
  }
  await fs.mkdir(target('videos'),{recursive:true});await fs.mkdir(target('posters'),{recursive:true});
  await save();
  const {ENGINE,requireFromEngine}=await import('./bundle.mjs');
  const {neededFontFiles}=await import('../concept-stills.mjs');
  const publicDir=target('.public'),bundleDir=target(`.bundle/${sourceHash.slice(0,16)}`);
  await fs.mkdir(path.join(publicDir,'fonts'),{recursive:true});await fs.mkdir(path.join(publicDir,'library-preview'),{recursive:true});
  const lock=JSON.parse(await fs.readFile(path.join(ROOT,'versions.lock.json'),'utf8'));
  for(const name of neededFontFiles()){
    const source=path.join(ENGINE,'public','fonts',name),bytes=await fs.readFile(source),pin=lock.fonts.find(item=>item.file===name);
    if(!pin||hash(bytes)!==pin.sha256)throw new Error(`Preview font does not match its lock: ${name}`);
    await fs.copyFile(source,target(`.public/fonts/${name}`));
  }
  for(const [file,text] of Object.entries(previewSvgAssets??{})){
    if(!/^library-preview\/[a-z0-9-]+\.svg$/.test(file))throw new Error('Unsafe preview fixture asset path.');
    await fs.writeFile(target(`.public/${file}`),text,'utf8');
  }
  const ffmpeg=path.join(ROOT,'Tools','bin',process.platform==='win32'?'ffmpeg.exe':'ffmpeg');
  const synthetic=target('.public/library-preview/synthetic-screen.mp4');
  if(!(await fs.stat(synthetic).catch(()=>null)))await run(ffmpeg,['-v','error','-nostdin','-n','-f','lavfi','-i','testsrc2=size=1920x1080:rate=30:duration=12','-c:v','libx264','-preset','ultrafast','-crf','32','-pix_fmt','yuv420p',synthetic],{windowsHide:true});
  if(!(await fs.stat(path.join(bundleDir,'index.html')).catch(()=>null))){
    const {bundle}=requireFromEngine('@remotion/bundler'),{enableTailwind}=requireFromEngine('@remotion/tailwind-v4');
    const cwd=process.cwd();process.chdir(ENGINE);
    try{await bundle({entryPoint:path.join(ENGINE,'src','library-preview','entry.ts'),outDir:bundleDir,publicDir,rootDir:ENGINE,rspack:true,enableCaching:true,bundlerOverride:enableTailwind});}
    finally{process.chdir(cwd);}
    if(await fingerprint()!==sourceHash)throw new Error('Studio code changed during preview preparation; retry with the latest sources.');
  }
  const {openBrowser,selectComposition,renderMedia,renderStill}=requireFromEngine('@remotion/renderer');
  const browser=await openBrowser('chrome',{logLevel:'warn',chromiumOptions:renderChromiumOptions()});
  try{
    for(const definition of selected){
      const item=items.find(value=>value.key===definition.key);
      if(item.status==='unsupported')continue;
      const videoRel=`videos/${definition.slug}.mp4`,posterRel=`posters/${definition.slug}.${encoding.posterFormat==='png'?'png':'jpg'}`;
      const video=target(videoRel),poster=target(posterRel);
      if(item.status==='rendered'&&item.sha256&&item.posterSha256&&await fileHash(video)===item.sha256&&await fileHash(poster)===item.posterSha256){onProgress(`cached ${item.key}`);continue;}
      if(await fs.stat(video).catch(()=>null))if(!old.has(item.key))throw new Error(`Unowned preview exists: ${videoRel}`);
      const started=performance.now();onProgress(`rendering ${item.key}`);
      try{
        const composition=await selectComposition({serveUrl:bundleDir,id:'LibraryItemPreview',inputProps:definition.props,puppeteerInstance:browser,logLevel:'warn',timeoutInMilliseconds:60000});
        const temp=target(`videos/${definition.slug}.rendering.mp4`);
        await renderMedia({composition,serveUrl:bundleDir,inputProps:definition.props,puppeteerInstance:browser,codec:'h264',outputLocation:temp,scale,crf:encoding.crf,x264Preset:encoding.x264Preset,imageFormat:encoding.imageFormat,colorSpace:encoding.colorSpace,concurrency,muted:true,pixelFormat:'yuv420p',overwrite:true,logLevel:'warn',timeoutInMilliseconds:120000});
        await run(ffmpeg,['-v','error','-nostdin','-i',temp,'-f','null','-'],{windowsHide:true,maxBuffer:1024*1024});
        const ffprobe=path.join(ROOT,'Tools','bin',process.platform==='win32'?'ffprobe.exe':'ffprobe');
        const {stdout}=await run(ffprobe,['-v','error','-select_streams','v:0','-show_entries','stream=width,height,codec_name,pix_fmt,color_range,color_space,nb_frames,avg_frame_rate','-of','json',temp],{windowsHide:true,maxBuffer:1024*1024});
        const renderInfo=JSON.parse(stdout).streams?.[0];
        if(!renderInfo||Number(renderInfo.nb_frames)!==composition.durationInFrames)throw new Error('Rendered preview frame count differs from its composition.');
        await renderStill({composition,serveUrl:bundleDir,inputProps:definition.props,puppeteerInstance:browser,output:poster,frame:Math.min(composition.durationInFrames-1,Math.floor(composition.durationInFrames*0.8)),scale,imageFormat:encoding.posterFormat,overwrite:true,logLevel:'warn',timeoutInMilliseconds:60000});
        await fs.rename(temp,video);
        Object.assign(item,{status:'rendered',video:videoRel,poster:posterRel,sha256:await fileHash(video),posterSha256:await fileHash(poster),renderInfo,durationSec:composition.durationInFrames/composition.fps,ms:Math.round(performance.now()-started)});
        delete item.error;onProgress(`done ${item.key} ${(item.ms/1000).toFixed(1)}s`);
      }catch(error){item.status='failed';item.error=message(error);item.notes=[...definition.notes,item.error];delete item.video;delete item.poster;onProgress(`failed ${item.key}: ${item.error}`);}
      await save();
    }
  }finally{await browser.close({silent:true}).catch(()=>{});await save();}
  return {ok:!selected.some(def=>items.find(item=>item.key===def.key)?.status==='failed'),out,rendered:items.filter(item=>item.status==='rendered').length,failed:items.filter(item=>item.status==='failed').map(item=>({key:item.key,error:item.error})),unsupported:items.filter(item=>item.status==='unsupported').map(item=>item.key),report:`${out}/previews.json`,gallery:`${out}/index.html`};
}
