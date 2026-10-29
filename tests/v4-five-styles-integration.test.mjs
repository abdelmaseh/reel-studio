import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bundleEngine,setSsrFrame} from './helpers/engine-bundle.mjs';
import {transitionSample} from './helpers/ssr-frames.mjs';
import {TRANSITION_RULES,graphicsTransitionIssues} from '../engine/src/prepared-edit/graphics-transitions.ts';
import {sceneDrawingWindows,drawingClock,compileEdit} from '../engine/src/prepared-edit/timeline.ts';
import {editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {STYLE_IDS,getStyleMeta,semanticEligibility} from '../engine/src/styles/registry.ts';
import {getPreviewDefinition,previewFixtureIssues} from '../engine/src/library-preview/fixtures.ts';
import {templateFamiliesFor,addSceneFromTemplate,setSceneData,deleteScene} from '../engine/src/review-editor/ops/scenes.ts';
import {sceneDemoFields} from '../engine/src/review-editor/ops/demo.ts';
import {sceneCues} from '../scripts/lib/scene-cues.mjs';
import {addTransition} from '../engine/src/review-editor/ops/events.ts';
import {isSceneAnchoredKind} from '../engine/src/review-editor/ops/anchors.ts';
import {deleteSelection} from '../engine/src/review-editor/shell/delete-fallback.ts';
import {sceneMinDuration,buildTimelineModel} from '../engine/src/review-editor/shell/timeline-math.ts';
import {footageFrameState} from '../engine/src/prepared-edit/footage.ts';

const signatures={'section-deck':'blinds','kinetic-paper':'ink-slab','magazine-interview':'magazine-flip','liquid-glass':'lens-zoom','calligraphic-receipts':'paper-pull','paper-collage':'paper-swap'};
const owned={'verdict':'magazine-interview','claim-proof':'calligraphic-receipts'};
const kinds=Object.values(signatures).filter(k=>k!=='blinds');
const api=await bundleEngine(`
 import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {useCurrentFrame} from 'remotion';
 import {PreparedEdit,CaptionTrack} from './engine/src/prepared-edit/PreparedEdit';
 import {FAMILY_DESIGNS} from './engine/src/styles/family-designs';
 import {SceneDemo} from './engine/src/library-preview/Preview';
 import {SafeRoot} from './engine/src/core/safe';
 import {sceneCameraPose} from './engine/src/core/scene-camera';
 import {sceneCameraTransform} from './engine/src/core/camera';
 export {sceneCameraPose,sceneCameraTransform};
 const Stub=({scene})=><aside data-scene={scene.id} data-frame={useCurrentFrame()}/>;
 export const render=(edit,stub=false)=>{
  const original=FAMILY_DESIGNS[edit.style];
  if(stub)FAMILY_DESIGNS[edit.style]={intro:Stub,statement:Stub};
  try{return renderToStaticMarkup(<PreparedEdit edit={edit} plate={{src:'sample.mp4',width:1080,height:1920}}/>);}
  finally{FAMILY_DESIGNS[edit.style]=original;}
 };
 export const caption=(edit,compiled,center)=>renderToStaticMarkup(<SafeRoot><CaptionTrack edit={edit} compiled={compiled} center={center}/></SafeRoot>);
 export const preview=(definition)=>renderToStaticMarkup(<SceneDemo definition={definition}/>);
`,{ssr:true,media:true,timeline:true});

for(const [style,kind] of Object.entries(signatures))test(`${style} declares its signature without changing purpose/tone scores`,()=>{
 assert.equal(getStyleMeta(style).signatureTransition,kind);
});

for(const [family,style] of Object.entries(owned))test(`${family} is owned, editable, illustrative and validated end to end`,()=>{
 const definition=getPreviewDefinition('scene:'+family);
 assert.equal(definition.style,style);assert.deepEqual(previewFixtureIssues(definition),[]);
 assert.match(JSON.stringify(definition.fixture.scene.data),/مثال/);
 for(const id of STYLE_IDS){
  const edit={...transitionSample('whiteout'),style:id,transitions:[],scenes:[definition.fixture.scene]};
  const parsed=editManifestSchema.safeParse(edit);
  assert.equal(parsed.success,id===style,id);
  if(!parsed.success && id!==style)assert.match(parsed.error.message,new RegExp(style));
  assert.equal(templateFamiliesFor(id).includes(family),id===style);
 }
 const edit={...transitionSample('whiteout'),style,transitions:[],scenes:[]};
 const added=addSceneFromTemplate(edit,family,{atFrame:0});assert.equal(added.ok,true,JSON.stringify(added));
 assert.ok(sceneDemoFields(added.manifest.scenes[0]).length);
 assert.ok(sceneCues(added.manifest.scenes[0]).length);
 setSsrFrame(100);assert.doesNotMatch(api.preview(definition),/NaN|Infinity/);
 const invalid=structuredClone(added.manifest.scenes[0].data);
 if(family==='verdict')invalid.rows[0].value=invalid.rows[0].outOf+1;else invalid.diff.value++;
 const rejected=setSceneData(added.manifest,added.manifest.scenes[0].id,invalid);assert.equal(rejected.ok,false);
 if(family==='claim-proof'){
  const valid=structuredClone(invalid);valid.rows[0].value++;
  assert.equal(setSceneData(added.manifest,added.manifest.scenes[0].id,valid).ok,true,'complete consistent numeric patch');
  const removed=structuredClone(added.manifest.scenes[0].data);removed.claim.pop();
  assert.equal(setSceneData(added.manifest,added.manifest.scenes[0].id,removed).ok,false,'keyIndex cannot silently point outside claim');
 }
});

test('new semantic beats retain existing eligibility',()=>{
 const beats=semanticEligibility();
 assert.ok(beats['magazine-interview'].includes('chapter-quote'));assert.ok(beats['magazine-interview'].includes('verdict'));
 for(const beat of ['meter-receipt','claim-proof'])assert.ok(beats['calligraphic-receipts'].includes(beat));
});

for(const kind of kinds)for(const layout of ['takeover','presenter','split'])test(`${kind}: ${layout} to takeover keeps nominal timing and camera`,()=>{
 const edit=transitionSample(kind);edit.transitions[0].durationInFrames=kind==='ink-slab'?12:14;
 edit.scenes[0].layout=layout;
 if(layout==='presenter'){edit.scenes[0].family='statement';edit.scenes[0].data={title:'مثال',kicker:'مثال'};}
 edit.scenes.forEach(scene=>{if(scene.layout!=='presenter')scene.camera={move:'dolly',strength:'normal'};});
 const issues=graphicsTransitionIssues(edit.transitions,edit.scenes);
 const refused=kind==='paper-pull' && layout!=='takeover' || kind==='magazine-flip' && layout==='presenter';
 assert.equal(issues.length>0,refused,issues.join('; '));
 if(refused)return;
 const original=structuredClone(edit),compiled=compileEdit(edit),rule=TRANSITION_RULES[kind];
 const windows=sceneDrawingWindows(edit.scenes,edit.transitions);
 assert.equal(windows[1].renderFromFrame,60-rule.lead);
 assert.equal(windows[0].renderEndFrame,rule.needsOutgoing?60-rule.lead:60+(rule.tail??0));
 for(const frame of [60-rule.lead,59,60,61,66,74,90]){
  const clock=drawingClock(edit.scenes[1],rule.lead,frame);
  assert.equal(clock.camera,Math.max(0,Math.min(119,frame-60)));
  setSsrFrame(frame);
  const html=api.render(edit,true);assert.doesNotMatch(html,/NaN|Infinity/);
  assert.doesNotMatch(html,/z-index:-/,'pre-roll and delegated outgoing stay above the opaque CanvasFill');
  if(frame<60)assert.match(html,/z-index:1/,'incoming is above the canvas but below retained outgoing');
  if(frame<60 && !['ink-slab','lens-zoom','magazine-flip'].includes(kind) && layout==='presenter')assert.match(html,/clip-path:inset\(0 0 100% 0\)/,'ordinary pre-roll cannot cover the continuous presenter plate');
  if(frame<60 && !['ink-slab','lens-zoom','magazine-flip'].includes(kind) && layout==='split')assert.match(html,/z-index:1;clip-path:inset\(0px 0px 864px 0px\)/,'ordinary pre-roll stays in the outgoing graphics panel until the cut');
  if(kind==='paper-swap' && frame<60)assert.match(html,/z-index:2/,'ordinary outgoing remains above incoming during pre-roll');
  if(kind==='lens-zoom' && frame<60)assert.doesNotMatch(html,/data-scene="new"/,'lens lead retains only the outgoing picture');
  else assert.match(html,new RegExp('data-scene="new" data-frame="'+(frame-60+rule.lead)+'"'));
  if(kind==='magazine-flip' && frame<67)assert.equal((html.match(/data-scene="old"/g)??[]).length,1,'outgoing page drawn once');
  if(rule.freezeOutgoing && frame>=60 && frame<73)assert.match(html,/data-scene="old" data-frame="59"/,'last outgoing frame held');
  const pose=api.sceneCameraTransform(api.sceneCameraPose(edit.scenes[1].camera,{sceneId:'new',frame:clock.camera,fps:30,durationInFrames:120}));
  if(kind!=='lens-zoom' || frame>=60)assert.ok(html.includes(pose),'incoming scene camera keeps nominal clock');
 }
 assert.deepEqual(edit,original);assert.deepEqual(compileEdit(edit),compiled,'audio, captions and nominal timeline unchanged');
 assert.deepEqual(buildTimelineModel(edit,[]).lanes.scenes.items.map(({from,to})=>({from,to})),[{from:0,to:60},{from:60,to:180}]);
 for(const frame of [59,60,61,74])assert.deepEqual(footageFrameState(edit,frame,{aspect:1920/1080,canvasHeight:1056,probe:false}),footageFrameState({...edit,transitions:[]},frame,{aspect:1920/1080,canvasHeight:1056,probe:false}),'continuous footage camera ignores drawing overlap');
});

for(const kind of kinds)test(`${kind} anchors in the editor and refuses missing or nonadjacent scenes`,()=>{
 assert.equal(isSceneAnchoredKind(kind),true);
 const edit=transitionSample(kind);edit.transitions=[];
 const result=addTransition(edit,{kind,atFrame:65});assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.manifest.transitions[0].atFrame,60);
 const t={kind,atFrame:60,durationInFrames:14};
 assert.ok(graphicsTransitionIssues([t],[edit.scenes[1]]).length);
 assert.ok(graphicsTransitionIssues([t],[{...edit.scenes[0],durationInFrames:59},edit.scenes[1]]).length);
 assert.ok(graphicsTransitionIssues([{...t,dir:'rtl'}],edit.scenes).length);
 const key=(TRANSITION_RULES[kind].phase==='overlay'?'overlay:':'graphics-transition:')+kind;
 assert.deepEqual(previewFixtureIssues(getPreviewDefinition(key)),[]);
 for(const id of ['old','new']){
  const paired={...edit,transitions:[t]};
  const deleted=deleteScene(paired,id);assert.equal(deleted.ok,true,JSON.stringify(deleted));
  assert.equal(deleted.manifest.transitions.length,0,'panel removes the dependent transition');
  assert.equal(deleteSelection(paired,{kind:'scene',id}).manifest.transitions.length,0,'timeline removes the dependent transition');
 }
 const paired={...edit,transitions:[t]};
 assert.ok(sceneMinDuration(paired,0)>=TRANSITION_RULES[kind].lead);
 assert.ok(sceneMinDuration(paired,1)>=t.durationInFrames);
});

test('caption designs use reviewed words, page ink and footage slips through theme contracts',()=>{
 for(const [style,family,layout] of [['magazine-interview','comparison','takeover'],['magazine-interview','intro','takeover'],['magazine-interview','statement','presenter'],['magazine-interview','count','split'],['calligraphic-receipts','statement','presenter'],['calligraphic-receipts','count','split']]){
  const edit={...transitionSample('whiteout'),style,transitions:[]};
  edit.scenes=[{...edit.scenes[0],family,layout}];
  edit.captions={status:'reviewed',words:[{text:'مثال واضح',startMs:0,endMs:1000,confidence:1}]};
  setSsrFrame(12);const html=api.caption(edit,compileEdit(edit),1260);
  assert.match(html,/مثال واضح/);
  if(style==='magazine-interview'){
   assert.ok(html.includes(family==='comparison'?'#0B1A2C':'#F5F3EC'));
   assert.ok(html.includes('top:'+(layout==='split'?1096:1300)+'px'),'pilot caption top');
   assert.equal(html.includes('height:1.5px'),layout!=='split','pilot rule visibility');
  }else{
   assert.match(html,/polygon\(/);
   assert.ok(html.includes('top:'+(layout==='split'?960:1220)+'px'),'pilot ink caption centre minus its 40px half-height');
  }
 }
 const source=readFileSync(new URL('../engine/src/prepared-edit/PreparedEdit.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/edit\.style===['"](?:section-deck|magazine-interview|calligraphic-receipts|kinetic-paper|paper-collage|liquid-glass)/);
});

test('longer authored durations retain the outgoing drawing until the effect finishes',()=>{
 const edit=transitionSample('ink-slab');edit.transitions[0].durationInFrames=24;
 assert.deepEqual(graphicsTransitionIssues(edit.transitions,edit.scenes),[]);
 assert.equal(sceneDrawingWindows(edit.scenes,edit.transitions)[0].renderEndFrame,84);
 const magazine=transitionSample('magazine-flip');magazine.transitions[0].durationInFrames=40;
 assert.match(graphicsTransitionIssues(magazine.transitions,magazine.scenes).join(' '),/starts before its drawing lead/);
});

test('a short middle scene cannot overlap two drawing handovers',()=>{
 const scenes=[{id:'a',fromFrame:0,durationInFrames:60,layout:'takeover',family:'intro'},
  {id:'b',fromFrame:60,durationInFrames:20,layout:'takeover',family:'intro'},
  {id:'c',fromFrame:80,durationInFrames:100,layout:'takeover',family:'intro'}];
 const transitions=[60,80].map(atFrame=>({kind:'paper-pull',atFrame,durationInFrames:14}));
 assert.match(graphicsTransitionIssues(transitions,scenes).join(' '),/drawing windows overlap/);
});
