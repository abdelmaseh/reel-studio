import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {bundleEngine, setSsrFrame} from './helpers/engine-bundle.mjs';
import {preparedFramesRenderer, transitionSample} from './helpers/ssr-frames.mjs';
import {TRANSITION_KINDS, graphicsTransitionIssues, sceneEntrance} from '../engine/src/prepared-edit/graphics-transitions.ts';
import {transitionSchema, editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {TRANSITION_DEFAULTS,addTransition,updateTransition} from '../engine/src/review-editor/ops/events.ts';
import {isSceneAnchoredKind} from '../engine/src/review-editor/ops/anchors.ts';
import {deleteSelection} from '../engine/src/review-editor/shell/delete-fallback.ts';
import {sceneMaxStart, sceneMinDuration} from '../engine/src/review-editor/shell/timeline-math.ts';
import {getPreviewDefinition} from '../engine/src/library-preview/fixtures.ts';
import {collectLibraryInventory} from '../scripts/lib/library-inventory.mjs';
import {collectLibraryEditorial} from '../scripts/lib/library-selection.mjs';
import {lifecycleBrowser,transitionMountCounts} from './helpers/transition-lifecycle.mjs';

const entrances=['iris','keyhole','blinds','dot-zoom','zoom-through'];
const overlays=['paper-tear','page-turn','pen-dot-curtain','pixel-curtain'];
let registry;
async function api() {
  assert.ok(existsSync(new URL('../engine/src/prepared-edit/transition-registry.tsx',import.meta.url)), 'Transition registry is implemented');
  return registry??=bundleEngine(`
    import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
    import {SafeRoot} from './engine/src/core/safe';
    export {TRANSITIONS} from './engine/src/prepared-edit/transition-registry';
    export const render=(Component,props,probe)=>renderToStaticMarkup(<SafeRoot probe={probe}><Component {...props}><span>نص عربي متصل</span></Component></SafeRoot>);
  `,{ssr:true});
}

test('every kind has a registry component and all eight V4 kinds are declared',async()=>{
  const {TRANSITIONS}=await api();
  for(const kind of [...TRANSITION_KINDS,...entrances,...overlays]) assert.equal(typeof TRANSITIONS[kind]?.Component,'function',kind);
  assert.deepEqual(Object.keys(TRANSITIONS).sort(),[...TRANSITION_KINDS].sort());
});

test('unknown transition is rejected by schema and runtime validation',()=>{
  assert.equal(transitionSchema.safeParse({atFrame:60,durationInFrames:20,kind:'typo'}).success,false);
  assert.match(graphicsTransitionIssues([{atFrame:60,durationInFrames:20,kind:'typo'}],transitionSample('whiteout').scenes).join(' '),/unknown transition/i);
});

test('new entrances anchor exactly to incoming scene and refuse presenter layouts',()=>{
  for(const kind of entrances){
    const t={kind,atFrame:60,durationInFrames:20};
    assert.ok(sceneEntrance([t],{fromFrame:60}),kind);
    assert.equal(sceneEntrance([t],{fromFrame:61}),null);
    assert.match(graphicsTransitionIssues([{...t,atFrame:61}],transitionSample(kind).scenes).join(' '),/first frame/);
    assert.match(graphicsTransitionIssues([t],[{...transitionSample(kind).scenes[1],layout:'presenter'}]).join(' '),/cannot run on presenter/);
  }
  assert.deepEqual(graphicsTransitionIssues([{kind:'clip-wipe',atFrame:60,durationInFrames:20}],[{...transitionSample('clip-wipe').scenes[1],layout:'presenter'}]),[]);
});

test('centred overlays have a half-duration tail; existing forward overlays retain full tails',async()=>{
  const {TRANSITIONS}=await api();
  for(const kind of TRANSITION_KINDS){
    if(TRANSITIONS[kind].phase!=='overlay' || TRANSITIONS[kind].lead || TRANSITIONS[kind].needsOutgoing)continue;
    const edit=transitionSample(kind); edit.transitions[0].atFrame=165;
    assert.equal(editManifestSchema.safeParse(edit).success,TRANSITIONS[kind].centred,kind);
    edit.signoffFromFrame=176;
    assert.equal(editManifestSchema.safeParse(edit).success,false,kind+' signoff');
  }
});

test('existing picture markup stays byte-identical inside the caption isolation layers',async()=>{
  const baseline=JSON.parse(readFileSync(new URL('./fixtures/transitions-before-ssr.json',import.meta.url),'utf8'));
  const render=await preparedFramesRenderer({historicalStage:true});
  for(const row of baseline){
    const markup=render(transitionSample(row.kind),row.frame);
    // The historical fixture has no caption cues. Preserve every picture byte while
    // explicitly accounting for the new picture context and empty speech layer.
    const rootEnd=row.markup.indexOf('>')+1;
    const expected=row.markup.slice(0,rootEnd)+'<div data-drawing-picture="" style="position:absolute;inset:0;isolation:isolate">'+row.markup.slice(rootEnd,-6)+'</div><div data-caption-layer="" style="position:absolute;inset:0;isolation:isolate;pointer-events:none"></div></div>';
    assert.equal(markup,expected,`${row.kind} frame ${row.frame}`);
    assert.equal(createHash('sha256').update(row.markup).digest('hex'),row.sha256,'historical fixture remains intact');
  }
});

test('new transitions render deterministically, settle, and skip decoration in probe',async()=>{
  const {TRANSITIONS,render}=await api();
  for(const kind of [...entrances,...overlays]){
    const Component=TRANSITIONS[kind].Component;
    const props={atFrame:60,durationInFrames:32,fps:30,box:{x:0,y:0,width:1080,height:1040}};
    for(const frame of [44,52,60,68,76,92]){
      setSsrFrame(frame); const html=render(Component,props);
      assert.equal(render(Component,props),html,kind);
      assert.doesNotMatch(html,/NaN|Infinity/,kind);
    }
    setSsrFrame(68);
    assert.equal(render(Component,props,'#00FF00').includes('نص عربي متصل'),!overlays.includes(kind),kind);
    setSsrFrame(100);
    const settled=render(Component,props);
    assert.equal(settled.includes('نص عربي متصل'),!overlays.includes(kind),kind);
  }
});

test('shape and normalized origin survive schema validation and reach mask markup',async()=>{
  const {TRANSITIONS,render}=await api();
  for(const kind of ['clip-wipe','iris','keyhole','dot-zoom']){
    const props={atFrame:60,durationInFrames:24,fps:30,shape:kind==='keyhole'?'keyhole':'circle',origin:{x:.25,y:.4}};
    const {fps,...spec}=props;
    assert.equal(transitionSchema.safeParse({...spec,kind,shape:kind==='keyhole'?'keyhole':'circle'}).success,true,kind);
    setSsrFrame(64);
    assert.notEqual(render(TRANSITIONS[kind].Component,props),render(TRANSITIONS[kind].Component,{...props,origin:{x:.75,y:.6}}),kind);
  }
});

test('editing transition timing preserves the authored mask shape and origin',()=>{
  const edit=transitionSample('clip-wipe');
  edit.transitions[0]={...edit.transitions[0],shape:'circle',origin:{x:.2,y:.3}};
  const result=updateTransition(edit,0,{durationInFrames:30});
  assert.equal(result.ok,true);
  assert.equal(result.manifest.transitions[0].shape,'circle');
  assert.deepEqual(result.manifest.transitions[0].origin,{x:.2,y:.3});
});

test('ink curtain opens from its centre after covering the cut',async()=>{
  const {render,TRANSITIONS}=await api();
  const props={atFrame:60,durationInFrames:64,fps:30};
  setSsrFrame(60);assert.match(render(TRANSITIONS['pen-dot-curtain'].Component,props),/data-cut-cover="full"/);
  setSsrFrame(76);
  const html=render(TRANSITIONS['pen-dot-curtain'].Component,props);
  assert.doesNotMatch(html,/<path[^>]*d="M 540 [^\"]* L [^ ]+ 960 L 540 /,'the centre has opened by 75 percent');
  assert.match(html,/<path/,'outer dots are still opening');
});

test('editor defaults, anchors, and previews cover every new kind',()=>{
  for(const kind of [...entrances,...overlays]){
    assert.ok(TRANSITION_DEFAULTS[kind]?.durationInFrames>0,kind);
    assert.equal(isSceneAnchoredKind(kind),entrances.includes(kind));
    const edit=transitionSample('whiteout');edit.transitions=[];
    const result=addTransition(edit,{kind,atFrame:65});
    assert.equal(result.ok,true,kind);
    const key=`${overlays.includes(kind)?'overlay':'graphics-transition'}:${kind}`;
    assert.equal(getPreviewDefinition(key).fixture.preset,kind);
  }
});

test('the editor timeline treats every overlay as free of its scene and every centred kind as a half tail',()=>{
  const scenes=[{id:'a',fromFrame:0,durationInFrames:60},{id:'b',fromFrame:60,durationInFrames:6}];
  for(const kind of overlays){
    const m={scenes,transitions:[{atFrame:60,durationInFrames:24,kind}],segments:[{fromFrame:0,toFrame:120}],source:{fps:30}};
    assert.equal(sceneMinDuration(m,1),1,kind);
    const kept=deleteSelection({...m,captions:[],sounds:[],camera:[]},{kind:'scene',id:'b'});
    assert.equal(kept.manifest.transitions.length,1,kind+' survives the scene delete');
    assert.equal(sceneMaxStart({...m,signoffFromFrame:100},1),100-12,kind+' keeps half its length before the sign-off');
  }
  const entrance={scenes,transitions:[{atFrame:60,durationInFrames:12,kind:'iris'}],segments:[{fromFrame:0,toFrame:120}],source:{fps:30}};
  assert.equal(sceneMinDuration(entrance,1),12);
  assert.equal(deleteSelection({...entrance,captions:[],sounds:[],camera:[]},{kind:'scene',id:'b'}).manifest.transitions.length,0);
});

test('existing whip-pan media and vertical split restrictions are retained',()=>{
  const scene={id:'video',family:'screens',layout:'split',fromFrame:60,durationInFrames:120,data:{screens:[{src:'named.mp4'}]}};
  const issue=graphicsTransitionIssues([{kind:'whip-pan',atFrame:60,durationInFrames:20,dir:'up'}],[scene]).join(' ');
  assert.match(issue,/only travel rtl or ltr/);
});

test('each new library entry has specific current source evidence',async()=>{
  const data=await collectLibraryEditorial({inventory:await collectLibraryInventory()});
  for(const kind of [...entrances,...overlays]){
    const key=`${overlays.includes(kind)?'overlay':'graphics-transition'}:${kind}`;
    assert.equal(data.items.find(item=>item.key===key)?.editorial?.assessment,'current',key);
  }
});

test('registry allowance includes the existing whip-pan video guard',async()=>{
  const {TRANSITIONS}=await api();
  assert.match(TRANSITIONS['whip-pan'].allowed({scene:{id:'video',family:'screens',layout:'split',fromFrame:60,durationInFrames:100},hasVideo:true})??'',/would decode/);
});

test('incoming media stays mounted across the entrance final frame',{skip:!existsSync(lifecycleBrowser)},async()=>{
  const counts=await transitionMountCounts();
  for(const [kind,result]of Object.entries(counts))assert.deepEqual(result,{mounts:1,unmounts:0},kind);
});
