import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {collectLibraryInventory} from '../scripts/lib/library-inventory.mjs';

const moduleUrl=new URL('../scripts/lib/library-selection.mjs',import.meta.url);
const api=async()=>{assert.ok(existsSync(moduleUrl),'The library needs a meaning-aware selection route.');return import(moduleUrl);};
let current;
async function catalog(){return current??=api().then(async({collectLibraryEditorial})=>collectLibraryEditorial({inventory:await collectLibraryInventory()}));}
const context=(extra={})=>({intent:'process',mode:'recording',style:'paper-collage',mood:'calm',energy:'low',layout:'split',durationSec:4,sourceKind:'presenter',assets:[],...extra});

test('every registered visual item has source-current, specific selection guidance; internal helpers stay separate',async()=>{
  const data=await catalog();
  assert.equal(data.unclassified.length,0);
  assert.equal(data.orphaned.length,0);
  assert.equal(data.coverage.visual,data.items.length);
  assert.ok(data.items.length>=90);
  assert.ok(data.items.every(item=>item.editorial.assessment==='current'));
  assert.ok(data.items.every(item=>!['primitive','sound'].includes(item.kind)));
  assert.equal(new Set(data.items.map(item=>item.editorial.explains)).size,data.items.length);
  for(const item of data.items){
    assert.ok(item.editorial.useWhen.length&&item.editorial.avoidWhen.length,item.key);
    assert.ok(item.editorial.display.explains&&item.editorial.display.useWhen&&item.editorial.display.avoidWhen,item.key);
  }
});

test('a calm split explanation keeps the selected identity and chooses an actual process',async()=>{
  const {recommendLibrary}=await api(),data=await catalog(),input=context(),before=JSON.stringify(input);
  const result=recommendLibrary(data,input);
  assert.ok(result.candidates.some(item=>item.key==='scene:process'));
  assert.ok(!result.candidates.some(item=>item.layer==='style'||item.key==='concept:automation-flow'));
  assert.equal(result.context.style,'paper-collage');
  assert.equal(JSON.stringify(input),before);
  assert.ok(result.candidates.every(item=>item.reasons.length&&item.cautions.length));
});

test('unimplemented bottlenecks and feedback never masquerade as linear flow',async()=>{
  const {recommendLibrary}=await api(),data=await catalog();
  for(const intent of ['bottleneck','feedback']){
    const result=recommendLibrary(data,context({intent,layout:'takeover',durationSec:12}));
    assert.equal(result.candidates.length,0,intent);
    assert.equal(result.decision,'no-match');
    assert.ok(result.nextAction.includes('PROJECT-SCENES.md'));
  }
});

test('new condition and filtering actions are retrieved by meaning only when native layout, time and data fit',async()=>{
  const {recommendLibrary}=await api(),data=await catalog();
  for(const [intent,key] of [['branching','concept:conditional-branching'],['filtering','concept:identity-filtering']]){
    const input=context({intent,mode:'graphics',sourceKind:'none',layout:'takeover',durationSec:12,assets:['data']});
    const result=recommendLibrary(data,input);
    assert.ok(result.candidates.some(item=>item.key===key),key);
    assert.ok(!recommendLibrary(data,{...input,layout:'split'}).candidates.some(item=>item.key===key));
    assert.ok(!recommendLibrary(data,{...input,durationSec:2}).candidates.some(item=>item.key===key));
    assert.ok(!recommendLibrary(data,{...input,assets:[]}).candidates.some(item=>item.key===key));
    assert.equal(result.context.style,'paper-collage');
  }
});

test('concept duration floors are enforced in seconds and split layouts cannot be relabelled',async()=>{
  const {recommendLibrary}=await api(),data=await catalog();
  const short=recommendLibrary(data,context({mode:'graphics',sourceKind:'none',layout:'takeover',durationSec:1}));
  assert.ok(short.excluded.find(item=>item.key==='concept:automation-flow')?.reasons.includes('duration-below-minimum'));
  const long=recommendLibrary(data,context({mode:'graphics',sourceKind:'none',layout:'takeover',durationSec:15,limit:100}));
  assert.ok(long.candidates.some(item=>item.key==='concept:automation-flow'));
  const split=recommendLibrary(data,context({durationSec:15}));
  assert.ok(split.excluded.find(item=>item.key==='concept:automation-flow')?.reasons.includes('layout-not-supported'));
});

test('owned scenes cannot switch style through recommendation',async()=>{
  const {recommendLibrary}=await api(),data=await catalog();
  const owned=data.items.find(item=>item.key==='scene:glide-lines');
  const result=recommendLibrary(data,context({intent:owned.editorial.intents[0],layout:'takeover',durationSec:15}));
  assert.ok(!result.candidates.some(item=>item.key===owned.key));
  assert.ok(result.excluded.find(item=>item.key===owned.key)?.reasons.includes('owned-by-another-style'));
});

test('graphics cannot fabricate recording words or presenter camera tracks',async()=>{
  const {recommendLibrary}=await api(),data=await catalog();
  for(const [intent,role] of [['text','explanation'],['word-emphasis','emphasis'],['focus','camera']]){
    const result=recommendLibrary(data,context({intent,role,mode:'graphics',sourceKind:'none',layout:'takeover',assets:['reviewed-words']}));
    assert.ok(!result.candidates.some(item=>item.key==='scene:kinetic-text'||item.layer==='caption-emphasis'||item.layer==='camera'));
  }
});

test('explicitly missing sources block evidence scenes; unknown availability stays visible',async()=>{
  const {recommendLibrary}=await api(),data=await catalog();
  const missing=recommendLibrary(data,context({intent:'comparison',layout:'takeover',durationSec:8}));
  assert.ok(missing.excluded.find(item=>item.key==='scene:image-compare')?.reasons.includes('assets-not-available'));
  const unknown=context({intent:'comparison',layout:'takeover',durationSec:8,limit:100});delete unknown.assets;
  const result=recommendLibrary(data,unknown);
  const example=result.candidates.find(item=>item.key==='scene:image-compare');
  assert.ok(example?.cautions.includes('asset-availability-unconfirmed'));
});

test('a separate screen capture role accepts a declared capture without substituting the main source',async()=>{
  const {recommendLibrary}=await api(),data=await catalog();
  const capture=recommendLibrary(data,context({intent:'focus',layout:'takeover',durationSec:10,assets:['screen-capture'],limit:100}));
  assert.ok(capture.candidates.some(item=>item.key==='scene:screen-focus'));
  const main=recommendLibrary(data,context({intent:'focus',layout:'takeover',durationSec:10,assets:['screen-recording'],limit:100}));
  assert.ok(main.excluded.find(item=>item.key==='scene:screen-focus')?.reasons.includes('assets-not-available'));
});

test('static caption identity refuses animated caption pop even for energetic wording',async()=>{
  const {recommendLibrary}=await api(),data=await catalog();
  const result=recommendLibrary(data,context({intent:'word-emphasis',role:'emphasis',style:'section-deck',mood:'energetic',energy:'high',assets:['reviewed-words']}));
  assert.ok(!result.candidates.some(item=>item.key==='caption-emphasis:pop'));
  assert.ok(result.excluded.find(item=>item.key==='caption-emphasis:pop')?.reasons.includes('static-caption-style'));
});

test('required profile colours produce an identity conflict instead of replacing a fixed style',async()=>{
  const {recommendLibrary}=await api(),data=await catalog();
  const style=data.styles.find(item=>item.brand===false);
  assert.ok(style);
  const result=recommendLibrary(data,context({style:style.nativeId,requireBrandColors:true}));
  assert.equal(result.candidates.length,0);
  assert.equal(result.decision,'identity-conflict');
  assert.equal(result.context.style,style.nativeId);
});

test('stale semantics and wrappers cannot enter the normal shortlist',async()=>{
  const {recommendLibrary}=await api(),data=structuredClone(await catalog());
  data.items.find(item=>item.key==='scene:process').editorial.assessment='stale';
  const result=recommendLibrary(data,context());
  assert.ok(!result.candidates.some(item=>item.key==='scene:process'||['wrapper','extension'].includes(item.editorial.role)));
  assert.ok(result.excluded.find(item=>item.key==='scene:process')?.reasons.includes('editorial-evidence-stale'));
});

test('unknown context cannot be silently coerced into a different creative decision',async()=>{
  const {recommendLibrary}=await api(),data=await catalog();
  for(const extra of [{intent:'anything'},{mood:'loud-ish'},{style:'not-a-style'},{layout:'half-half'},{durationSec:0},{force:true},{assets:['mystery']}]){
    assert.throws(()=>recommendLibrary(data,context(extra)),/context|style|intent|mood|layout|duration|asset|Unknown/i);
  }
});

test('source drift invalidates guidance and foreign-root code is only hashed, never executed',async()=>{
  const {collectLibraryEditorial}=await api();
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'reel-editorial-'));
  try{
    await fs.mkdir(path.join(root,'scripts/data/library-editorial'),{recursive:true});
    await fs.mkdir(path.join(root,'engine/src'),{recursive:true});
    const source="throw new Error('must not execute metadata evidence');\n";
    await fs.writeFile(path.join(root,'engine/src/example.ts'),source,'utf8');
    const base=(await catalog()).items.find(item=>item.key==='scene:process');
    const record={...base.editorial,evidence:[{path:'engine/src/example.ts',sha256:createHash('sha256').update(source).digest('hex')}]};
    delete record.assessment;delete record.changedEvidence;
    for(const name of ['concepts','scenes','effects-styles'])await fs.writeFile(path.join(root,`scripts/data/library-editorial/${name}.json`),JSON.stringify({version:1,items:name==='scenes'?[record]:[]}), 'utf8');
    const inventory={items:[{key:'scene:process',kind:'scene',layer:'scene',nativeId:'process',layouts:['split','takeover'],sourcePaths:['engine/src/example.ts']}],sources:[]};
    const good=await collectLibraryEditorial({root,inventory});
    assert.equal(good.items[0].editorial.assessment,'current');
    await fs.writeFile(path.join(root,'engine/src/example.ts'),source.replace(/\n/g,'\r\n'),'utf8');
    assert.equal((await collectLibraryEditorial({root,inventory})).items[0].editorial.assessment,'current','a checkout with CRLF endings is the same source');
    await fs.appendFile(path.join(root,'engine/src/example.ts'),'// changed\n','utf8');
    const stale=await collectLibraryEditorial({root,inventory});
    assert.equal(stale.items[0].editorial.assessment,'stale');
    record.evidence[0].path='../private.ts';
    await fs.writeFile(path.join(root,'scripts/data/library-editorial/scenes.json'),JSON.stringify({version:1,items:[record]}),'utf8');
    await assert.rejects(collectLibraryEditorial({root,inventory}),/evidence|path/i);
  }finally{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('reel-editorial-'));await fs.rm(root,{recursive:true,force:true});}
});

const contractItem=(key,details={})=>({key,nativeId:key.split(':')[1],kind:'scene',layer:'scene',layouts:['split','takeover'],
  editorial:{key,role:'explanation',labelAr:'مثال',explains:'A bounded test explanation.',action:'Show the supplied test item.',
    useWhen:['The supplied contract applies.'],avoidWhen:['The contract does not apply.'],intents:['comparison'],moods:['editorial'],energy:['low'],
    modes:['recording','graphics'],sourceKinds:['presenter','screen','none'],requires:[],requirements:['Validate the actual data.'],
    display:{explains:'مثال',useWhen:'للمثال',avoidWhen:'خارج المثال'},evidence:[],assessment:'current'},...details});
const contractContext=(extra={})=>({intent:'comparison',mode:'recording',layout:'split',sourceKind:'presenter',assets:[],limit:100,...extra});

test('contract: required profile colours exclude candidate styles that own their palette',async()=>{
  const {recommendLibrary}=await api();
  const fixed=contractItem('style:fixed',{kind:'style',layer:'style',brand:false});fixed.editorial.role='style';
  const flexible=contractItem('style:flexible',{kind:'style',layer:'style',brand:true});flexible.editorial.role='style';
  const result=recommendLibrary({items:[fixed,flexible],styles:[fixed,flexible]},contractContext({role:'style',requireBrandColors:true}));
  assert.deepEqual(result.candidates.map(item=>item.key),['style:flexible']);
  assert.ok(result.excluded.find(item=>item.key==='style:fixed')?.reasons.includes('profile-colours-not-supported'));
  assert.equal(result.context.style,undefined);
});

test('contract: required profile colours need an identity before explaining an unowned scene',async()=>{
  const {recommendLibrary}=await api(),item=contractItem('scene:example');
  const result=recommendLibrary({items:[item],styles:[]},contractContext({requireBrandColors:true}));
  assert.equal(result.decision,'needs-context');
  assert.equal(result.candidates.length,0);
  assert.equal(result.context.style,undefined);
});

test('contract: recipe-specific layouts prevent a takeover bar comparison entering split',async()=>{
  const {recommendLibrary}=await api(),inventory=await collectLibraryInventory();
  const bar=inventory.items.find(item=>item.key==='recipe-variant:data-bars');
  const parent=inventory.items.find(item=>item.key==='scene:data-story');
  const items=[{...contractItem(bar.key),...bar,editorial:contractItem(bar.key).editorial},
    {...contractItem(parent.key),...parent,editorial:contractItem(parent.key).editorial}];
  const split=recommendLibrary({items,styles:[]},contractContext());
  assert.ok(!split.candidates.some(item=>item.key==='recipe-variant:data-bars'));
  assert.ok(split.excluded.find(item=>item.key==='recipe-variant:data-bars')?.reasons.includes('layout-not-supported'));
  const takeover=recommendLibrary({items,styles:[]},contractContext({layout:'takeover'}));
  assert.deepEqual(takeover.candidates.find(item=>item.key==='recipe-variant:data-bars')?.contract.layouts,['takeover']);
});

test('contract: intent-specific layouts narrow comparison without restricting metric results or widening the source',async()=>{
  const {recommendLibrary}=await api(),item=contractItem('scene:data-story');
  item.editorial.intents=['comparison','result'];item.editorial.intentLayouts={comparison:['takeover']};
  const split=recommendLibrary({items:[item],styles:[]},contractContext());
  assert.equal(split.candidates.length,0);
  const metric=recommendLibrary({items:[item],styles:[]},contractContext({intent:'result'}));
  assert.equal(metric.candidates.length,1);
  const takeoverOnly=structuredClone(item);takeoverOnly.layouts=['takeover'];takeoverOnly.editorial.intentLayouts={comparison:['split','takeover']};
  const result=recommendLibrary({items:[takeoverOnly],styles:[]},contractContext({layout:'takeover'}));
  assert.deepEqual(result.candidates[0]?.contract.layouts,['takeover']);
});

test('contract: editorial intent-layout mappings reject unsupported or unrelated declarations',async()=>{
  const {collectLibraryEditorial}=await api(),root=await fs.mkdtemp(path.join(os.tmpdir(),'reel-editorial-layout-'));
  try{
    await fs.mkdir(path.join(root,'scripts/data/library-editorial'),{recursive:true});
    await fs.mkdir(path.join(root,'engine/src'),{recursive:true});
    const source='// Inert source evidence.\n';await fs.writeFile(path.join(root,'engine/src/example.ts'),source,'utf8');
    const record=structuredClone(contractItem('scene:example').editorial);
    record.evidence=[{path:'engine/src/example.ts',sha256:createHash('sha256').update(source).digest('hex')}];delete record.assessment;
    const inventory={items:[contractItem('scene:example')],sources:[]};
    for(const name of ['concepts','effects-styles'])await fs.writeFile(path.join(root,`scripts/data/library-editorial/${name}.json`),JSON.stringify({version:1,items:[]}), 'utf8');
    for(const intentLayouts of [null,[],{}, {unknown:['takeover']},{result:['takeover']},{comparison:[]},{comparison:['sideways']},{comparison:['takeover','takeover']}]){
      await fs.writeFile(path.join(root,'scripts/data/library-editorial/scenes.json'),JSON.stringify({version:1,items:[{...record,intentLayouts}]}),'utf8');
      await assert.rejects(collectLibraryEditorial({root,inventory}),/intent.?layout/i,JSON.stringify(intentLayouts));
    }
    await fs.writeFile(path.join(root,'scripts/data/library-editorial/scenes.json'),JSON.stringify({version:1,items:[{...record,intentLayouts:{comparison:['takeover']}}]}),'utf8');
    const valid=await collectLibraryEditorial({root,inventory});assert.equal(valid.items[0].editorial.assessment,'current');
  }finally{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('reel-editorial-layout-'));await fs.rm(root,{recursive:true,force:true});}
});

test('contract: main screen recordings cannot supply separately assigned media',async()=>{
  const {recommendLibrary}=await api();
  const items=[['scene:separate-media','media'],['scene:main-screen','screen-recording']].map(([key,asset])=>{
    const item=contractItem(key);item.editorial.requires=[asset];return item;
  });
  const result=recommendLibrary({items,styles:[]},contractContext({sourceKind:'screen',assets:['screen-recording']}));
  assert.deepEqual(result.candidates.map(item=>item.key),['scene:main-screen']);
});

test('contract: a separate screen capture can be media without being a still image',async()=>{
  const {recommendLibrary}=await api();
  const items=[['scene:separate-media','media'],['scene:still-image','image'],['scene:separate-capture','screen-capture']].map(([key,asset])=>{
    const item=contractItem(key);item.editorial.requires=[asset];return item;
  });
  const result=recommendLibrary({items,styles:[]},contractContext({assets:['screen-capture']}));
  assert.deepEqual(result.candidates.map(item=>item.key),['scene:separate-capture','scene:separate-media']);
  const pair=recommendLibrary({items,styles:[]},contractContext({assets:['image-pair']}));
  assert.deepEqual(pair.candidates.map(item=>item.key),['scene:separate-media','scene:still-image']);
});
