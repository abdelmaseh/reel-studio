import test from 'node:test';
import assert from 'node:assert/strict';
import {editSceneSchema,editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {BEAT_FAMILIES,soundCandidateFor} from '../scripts/lib/editor-director.mjs';
import {sceneCues} from '../scripts/lib/scene-cues.mjs';
import {templateFamiliesFor,addSceneFromTemplate} from '../engine/src/review-editor/ops/scenes.ts';
import {sceneDemoFields} from '../engine/src/review-editor/ops/demo.ts';
import {fieldsForFamily,validateData} from '../engine/src/review-editor/panels/form-schema.ts';
import {validateManifest} from '../engine/src/review-editor/validate.ts';
const KASHIDA_AR='حركة الكشيدة تمدّ كلمة واحدة فقط، وهذا النص فيه أكثر من كلمة. اكتب كلمة واحدة، أو اختر حركة أخرى للجملة.';
const NO_SLOT_AR='حركة الكشيدة لا تجد مكانًا للمدّ في «ورد». تحتاج كلمة عربية من ثلاثة حروف أو أكثر فيها حرفان متصلان يمكن مدّ الوصلة بينهما، مثل «جميل». اختر كلمة أخرى، أو حركة أخرى.';
import {sceneVideoSources} from '../engine/src/core/scene-media.ts';
import {previewDefinitions,previewFixtureIssues} from '../engine/src/library-preview/fixtures.ts';
const scene={id:'type',family:'arabic-type',fromFrame:0,durationInFrames:240,layout:'takeover',motion:'land',data:{text:'فكرة واضحة',move:'decrypt'}};
const manifest={version:1,id:'type-test',purpose:'test',style:'section-deck',source:{path:'Projects/test/base.mp4',sha256:'a'.repeat(64),fps:30,width:1080,height:1920,totalFrames:480},segments:[{fromFrame:0,toFrame:480}],captions:{status:'draft',visible:false,words:[]},scenes:[scene],sounds:[],camera:[]};
test('family is registered in manifests, director, editor forms and scene picker',()=>{
 assert.equal(editSceneSchema.safeParse(scene).success,true);assert.equal(editManifestSchema.safeParse(manifest).success,true);
 assert.equal(BEAT_FAMILIES['arabic-type'],'arabic-type');assert.ok(soundCandidateFor(scene));
 assert.ok(templateFamiliesFor('section-deck',manifest).includes('arabic-type'));
 assert.equal(validateData('arabic-type',scene.data).ok,true);assert.ok(fieldsForFamily('arabic-type').length);
 assert.deepEqual(sceneDemoFields({...scene,data:{text:'اكتب فكرتك',move:'decrypt'}}),['text']);
 const tooShort=structuredClone(manifest);tooShort.scenes[0].durationInFrames=1;assert.equal(editManifestSchema.safeParse(tooShort).success,false);
});
test('the editor form and the edit check explain the one-word kashida rule in Arabic',()=>{
 const form=validateData('arabic-type',{text:'فكرة واضحة',move:'kashida-stretch'});
 assert.equal(form.ok,false);assert.deepEqual(form.issues.map(i=>i.message),[KASHIDA_AR]);
 const edit=structuredClone(manifest);edit.scenes[0].data={text:'فكرة واضحة',move:'kashida-stretch'};
 const found=validateManifest(edit).issues.filter(i=>i.path==='scenes.0.data.text');
 assert.equal(found.length,1,JSON.stringify(found));assert.equal(found[0].message,KASHIDA_AR);
 assert.match(found[0].detail,/^kashida-stretch stretches one word/);
 assert.equal(validateData('arabic-type',{text:'جميل',move:'kashida-stretch'}).ok,true);
});
test('the editor form and the edit check explain a word the kashida cannot stretch, in Arabic',()=>{
 const form=validateData('arabic-type',{text:'ورد',move:'kashida-stretch'});
 assert.equal(form.ok,false);assert.deepEqual(form.issues.map(i=>i.message),[NO_SLOT_AR]);
 const edit=structuredClone(manifest);edit.scenes[0].data={text:'ورد',move:'kashida-stretch'};
 const found=validateManifest(edit).issues.filter(i=>i.path==='scenes.0.data.text');
 assert.equal(found.length,1,JSON.stringify(found));assert.equal(found[0].message,NO_SLOT_AR);
 assert.match(found[0].detail,/^kashida-stretch finds no place to stretch "ورد"/);
});
test('named video assets enter the shared plate inventory; cues follow the move',()=>{
 assert.deepEqual(sceneVideoSources({...scene,data:{text:'شوف',move:'video-in-letters',media:'projects/test/clip.mp4'}}),['projects/test/clip.mp4']);
 assert.ok(sceneCues({...scene,data:{text:'فكرة',move:'letters-snap'}}).some(c=>c.kind==='stamp'&&c.frame===39));
 assert.ok(sceneCues(scene).some(c=>c.kind==='type'));
});
test('all moves have validated library examples with a single native family identity',()=>{
 const defs=previewDefinitions().filter(d=>d.key==='scene:arabic-type'||d.canonicalKey==='scene:arabic-type');
 assert.equal(defs.length,11);for(const d of defs)assert.deepEqual(previewFixtureIssues(d),[],d.key);
});
test('editor template adds a takeover long enough for its authored intro',()=>{
 const empty={...structuredClone(manifest),scenes:[]};const result=addSceneFromTemplate(empty,'arabic-type',{atFrame:0});
 assert.equal(result.ok,true,JSON.stringify(result));
});
