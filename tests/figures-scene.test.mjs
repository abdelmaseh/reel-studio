import test from 'node:test';
import assert from 'node:assert/strict';
import {editSceneSchema, editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {assertNoSampleNumbers, assertNoSampleText} from '../scripts/lib/editor-director.mjs';
import {kitTemplate} from '../engine/src/review-editor/ops/templates.ts';
import {createFrameRenderer} from '../scripts/lib/ssr-frames.mjs';
import {textNodes} from './helpers/markup.mjs';

const ariaLabels=html=>[...html.matchAll(/aria-label="([^"]*)"/g)].map(m=>m[1]);
const showsNumber=(html,text)=>textNodes(html).includes(text)||ariaLabels(html).includes(text);

let frameRenderer;
const frames=async()=>frameRenderer??=await createFrameRenderer();
const scene = data => ({id:'figures-test',family:'figures',layout:'takeover',motion:'land',fromFrame:0,durationInFrames:180,data});
export const figuresManifest = s => ({version:1,id:'figures-test',purpose:'test',style:'section-deck',source:{path:'Raw/example.mp4',sha256:'a'.repeat(64),fps:30,width:1080,height:1920,totalFrames:180},segments:[{fromFrame:0,toFrame:180}],captions:{status:'draft',words:[]},scenes:[s],sounds:[],camera:[]});

test('figures accepts four authored variants and rejects missing or misleading scales', () => {
  for(const data of [{variant:'counter',value:42,from:5,unit:'طلب'}, {variant:'slot',value:123456789}, {variant:'bars',bars:[{label:'أ',value:4},{label:'ب',value:8}],max:10}, {variant:'ring',value:42,max:100}]) assert.equal(editSceneSchema.safeParse(scene(data)).success,true);
  for(const data of [{variant:'counter'}, {variant:'slot',value:1234567890}, {variant:'slot',value:1.5}, {variant:'bars',bars:[]}, {variant:'bars',bars:Array(7).fill({label:'أ',value:1})}, {variant:'bars',bars:[{label:'أ',value:8}],max:5}, {variant:'ring',value:5,max:0}, {variant:'ring',value:12,max:10}]) assert.equal(editSceneSchema.safeParse(scene(data)).success,false,JSON.stringify(data));
});
test('figures choreography must resolve before the scene ends at each fps', async () => {
  const {validateFiguresTiming,figuresEndFrame} = await import('../engine/src/creative-kit/figures/timing.ts');
  for(const fps of [24,30,60]) for(const data of [{variant:'counter',value:42},{variant:'slot',value:123456789},{variant:'bars',bars:Array(6).fill({label:'أ',value:10})},{variant:'ring',value:42,max:100}]) {
    const s=scene(data), end=figuresEndFrame(data,fps);
    assert.deepEqual(validateFiguresTiming({...s,durationInFrames:end+1},fps),[]);
    assert.ok(validateFiguresTiming({...s,durationInFrames:end},fps).length);
  }
  assert.equal(editManifestSchema.safeParse(figuresManifest({...scene({variant:'counter',value:42}),durationInFrames:5})).success,false);
});
test('figures delivery guard catches every visible numeric field and template copy', () => {
  for(const data of [{variant:'counter',value:987654},{variant:'counter',value:12,from:987654},{variant:'ring',value:5,max:987654},{variant:'bars',bars:[{label:'أ',value:987654}]}]) assert.throws(()=>assertNoSampleNumbers({scenes:[scene(data)]}),/sample number/);
  const demo=kitTemplate('figures',30);
  assert.throws(()=>assertNoSampleText({scenes:[scene(demo.data)]}),/sample text/);
  assert.doesNotThrow(()=>assertNoSampleText({scenes:[scene({variant:'counter',value:42,label:'عدد الطلبات'})]}));
});
test('figures renders all variants deterministically with the chosen digits', async () => {
  const renderer=await frames();
  for(const data of [{variant:'counter',value:42,label:'مثال 2'},{variant:'slot',value:42},{variant:'bars',bars:[{label:'أ',value:42}]},{variant:'ring',value:42,max:100}]) {
    const s=editSceneSchema.parse(scene(data));
    for(const frame of [0,30,179]) assert.ok(renderer.renderScene({scene:s,style:'section-deck',frame}));
    const options={scene:s,style:'section-deck',frame:179,digits:'arabic-indic'};
    const html=renderer.renderScene(options);
    assert.equal(html,renderer.renderScene(options));
    if(data.variant==='slot')assert.match(html,/aria-label="٤٢"/);
    else assert.ok(showsNumber(html,'٤٢')||textNodes(html).join(' ').includes('٤٢'),textNodes(html).join(' | '));
  }
});

test('figures is reachable through editable templates, director and library preview',async()=>{
  const {fieldsForFamily,validateData}=await import('../engine/src/review-editor/panels/form-schema.ts');
  const {addSceneFromTemplate}=await import('../engine/src/review-editor/ops/scenes.ts');
  const {getPreviewDefinition,previewFixtureIssues}=await import('../engine/src/library-preview/fixtures.ts');
  const {BEAT_FAMILIES,soundCandidateFor}=await import('../scripts/lib/editor-director.mjs');
  assert.equal(BEAT_FAMILIES.figures,'figures');
  assert.equal(soundCandidateFor(scene({variant:'counter',value:42})),'counter-accent');
  assert.ok(fieldsForFamily('figures').length);
  assert.equal(validateData('figures',{variant:'counter',value:42}).ok,true);
  const m=figuresManifest(scene({variant:'counter',value:42}));m.scenes=[];
  assert.equal(addSceneFromTemplate(m,'figures',{atFrame:0}).ok,true);
  assert.deepEqual(previewFixtureIssues(getPreviewDefinition('scene:figures')),[]);
});

test('figures preserves authored decimals instead of rounding claims',async()=>{const renderer=await frames();for(const data of [{variant:'counter',value:1.2345},{variant:'bars',bars:[{label:'A',value:1.2345}]},{variant:'ring',value:1.2345,max:2}]){const html=renderer.renderScene({scene:editSceneSchema.parse(scene(data)),style:'section-deck',frame:179});assert.ok(showsNumber(html,'1.2345'),textNodes(html).join(' | '));}});

test('tiny supplied quantities stay exact and slot from keeps every initial digit',async()=>{
  const renderer=await frames();
  const html=renderer.renderScene({scene:editSceneSchema.parse(scene({variant:'counter',value:.000001})),style:'section-deck',frame:179});
  assert.ok(showsNumber(html,'0.000001'));
  assert.equal(editSceneSchema.safeParse(scene({variant:'counter',value:.0000001})).success,false,'Unsupported precision must be refused, not silently rounded');
  const {slotDigitStrings}=await import('../engine/src/creative-kit/figures/timing.ts');
  assert.deepEqual(slotDigitStrings(42,12500),{to:'00042',from:'12500'});
});

test('slot reels overshoot slightly and settle right to left at each fps',async()=>{
  const {slotPosition}=await import('../engine/src/creative-kit/figures/timing.ts');
  for(const fps of [30,60]){
    const duration=Math.round(1.05*fps);
    assert.ok(slotPosition(Math.round(duration*.9),1,2,2,0,fps)>32);
    assert.equal(slotPosition(duration,1,2,2,0,fps),32);
    assert.ok(slotPosition(duration,0,2,4,0,fps)!==34);
  }
});
