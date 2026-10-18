import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import path from 'node:path';

const url=new URL('../scripts/lib/library-gallery-batches.mjs',import.meta.url);
const api=async()=>{assert.ok(existsSync(url),'The gallery needs explicit owned-batch aggregation.');return import(url);};
const root=path.resolve('Projects/batch-test');
const batch=(slug,items,sourceHash=slug)=>({slug,root:path.join(root,slug),report:{sourceHash,quality:slug==='high'?'high':'draft',items}});
const ready=(extra={})=>({key:'concept:branch',slug:'concept--branch',layer:'concept',status:'rendered',video:'videos/concept--branch.mp4',poster:'posters/concept--branch.jpg',...extra});

test('new pending definitions never hide an existing playable example; new rendered batch keeps its own identity',async()=>{
  const {mergeGalleryBatches}=await api();
  const old=batch('old',[ready()]),newer=batch('high',[ready({status:'pending',video:undefined,poster:undefined})]);
  const kept=mergeGalleryBatches([old,newer]);
  assert.equal(kept[0].video,'batches/old/videos/concept--branch.mp4');
  const damaged=mergeGalleryBatches([old,batch('high',[ready({video:undefined,poster:undefined})])]);
  assert.equal(damaged[0].video,'batches/old/videos/concept--branch.mp4','a damaged rendered entry cannot hide a playable clip');
  const fresh=ready({poster:'posters/concept--branch.png',renderInfo:{width:1080,height:1920}});
  const merged=mergeGalleryBatches([old,batch('high',[fresh,ready({key:'preview:branch-false',canonicalKey:'concept:branch',slug:'preview--branch-false',video:'videos/preview--branch-false.mp4',poster:'posters/preview--branch-false.png'})])]);
  assert.equal(merged.length,2);assert.equal(merged[0].batchSourceHash,'high');
  assert.equal(merged[0].poster,'batches/high/posters/concept--branch.png');
  assert.equal(merged[0].renderInfo.width,1080);
  assert.equal(merged[1].canonicalKey,'concept:branch');
  assert.equal(old.report.items[0].video,'videos/concept--branch.mp4','original batch metadata is never rewritten');
});

test('batch media paths cannot turn an owned report into external or neighbouring file access',async()=>{
  const {mergeGalleryBatches}=await api();
  for(const video of ['../source.mov','videos/../source.mp4','https://private.test/x.mp4','C:/source.mp4','videos/a.mp4?token=x']){
    assert.throws(()=>mergeGalleryBatches([batch('old',[ready({video})])]),/media|path/i);
  }
  assert.throws(()=>mergeGalleryBatches([batch('../outside',[ready()])]),/batch/i);
});

test('newest playable examples appear first while earlier usable clips remain available',async()=>{
  const {mergeGalleryBatches}=await api();
  const old=batch('old',[ready({key:'concept:older',video:'videos/older.mp4'})]);
  const newer=batch('high',[ready({key:'concept:new'}),ready({key:'scene:pending',status:'pending',video:undefined,poster:undefined})]);
  const items=mergeGalleryBatches([old,newer]);
  assert.deepEqual(items.map(item=>item.key),['concept:new','concept:older','scene:pending']);
});

test('only registered batch roots and exact safe media routes resolve, including high-quality PNG posters',async()=>{
  const {resolveGalleryFile}=await api();
  const batches=[batch('old',[]),batch('high',[])];
  assert.equal(resolveGalleryFile(batches,'/batches/high/posters/a.png').root,batches[1].root);
  assert.equal(resolveGalleryFile(batches,'/videos/a.mp4').root,batches[0].root);
  for(const name of ['/batches/unknown/videos/a.mp4','/batches/high/../PROFILE.json','/batches/high/Raw/a.mov','/batches/high/posters/a.svg','/PROFILE.json','/batches/high/videos/%2e%2e/a.mp4'])assert.equal(resolveGalleryFile(batches,name),null,name);
});
