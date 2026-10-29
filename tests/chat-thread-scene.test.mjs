import test from 'node:test';
import assert from 'node:assert/strict';
import {editSceneSchema,editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {assertNoSampleText} from '../scripts/lib/editor-director.mjs';
import {kitTemplate} from '../engine/src/review-editor/ops/templates.ts';
import {sceneCues} from '../scripts/lib/scene-cues.mjs';
import {createFrameRenderer} from '../scripts/lib/ssr-frames.mjs';
import {textNodes} from './helpers/markup.mjs';

let frameRenderer;
const frames=async()=>frameRenderer??=await createFrameRenderer();
const scene=(data, durationInFrames=180)=>({id:'chat-test',family:'chat-thread',layout:'takeover',motion:'land',fromFrame:0,durationInFrames,data});
test('chat variants require one to eight nonblank authored messages',()=>{
  for(const variant of ['bubbles','typing','notifications']) assert.equal(editSceneSchema.safeParse(scene({variant,messages:[{from:'them',text:'رسالة واحدة'}]})).success,true);
  for(const messages of [[],Array(9).fill({from:'me',text:'رسالة'}),[{from:'me',text:' '}]]) assert.equal(editSceneSchema.safeParse(scene({variant:'bubbles',messages})).success,false);
});
test('chat local frame cues are ordered, in range and leave time to read',async()=>{
  const {chatMessageFrames,validateChatThreadTiming}=await import('../engine/src/creative-kit/chat-thread/timing.ts');
  for(const fps of [24,30,60]) {
    const s=scene({variant:'typing',messages:[{from:'them',text:'سؤال'},{from:'me',text:'رد'}]},fps*5);
    const times=chatMessageFrames(s.data,fps);
    assert.ok(times[0]>=fps*.6 && times[0]<=fps*1.2);
    assert.deepEqual(validateChatThreadTiming(s,fps),[]);
  }
  for(const times of [[20,20],[30,10],[0,179],[0,180]]) {
    const s=scene({variant:'bubbles',messages:times.map(at=>({from:'them',text:'رسالة',at}))});
    assert.ok(validateChatThreadTiming(s,30).length);
    const m={version:1,id:'chat-test',purpose:'test',style:'section-deck',source:{path:'Raw/example.mp4',sha256:'a'.repeat(64),fps:30,width:1080,height:1920,totalFrames:180},segments:[{fromFrame:0,toFrame:180}],captions:{status:'draft',words:[]},scenes:[s],sounds:[],camera:[]};
    assert.equal(editManifestSchema.safeParse(m).success,false);
  }
});
test('chat template copy is blocked but role and variant are structural choices',()=>{
  assert.throws(()=>assertNoSampleText({scenes:[scene(kitTemplate('chat-thread',30).data)]}),/sample text/);
  assert.doesNotThrow(()=>assertNoSampleText({scenes:[scene({variant:'bubbles',messages:[{from:'them',text:'سؤال من المصدر'}]})]}));
});
test('chat cue sounds follow authored message frames',()=>{
  const s=scene({variant:'bubbles',messages:[{from:'them',text:'سؤال',at:15},{from:'me',text:'رد',at:60}]});
  assert.deepEqual(sceneCues(s).filter(c=>c.kind==='reveal').map(c=>c.frame),[15,60]);
});
test('chat keeps complete Arabic text nodes and notifications show at most five',async()=>{
  const renderer=await frames();
  for(const variant of ['bubbles','typing','notifications']) {
    const s=editSceneSchema.parse(scene({variant,title:'محادثة توضيحية',messages:[{from:'them',text:'رسالة كاملة 42',at:30},{from:'me',text:'الإجابة واضحة',at:90}]}));
    for(const frame of [0,20,60,179]) assert.ok(renderer.renderScene({scene:s,style:'section-deck',frame}));
    const nodes=textNodes(renderer.renderScene({scene:s,style:'section-deck',frame:100,digits:'arabic-indic'}));
    assert.ok(nodes.includes('رسالة كاملة ٤٢'),nodes.join(' | '));
    assert.ok(nodes.includes('الإجابة واضحة'));
  }
  const s=editSceneSchema.parse(scene({variant:'notifications',messages:Array.from({length:8},(_,i)=>({from:'them',text:`رسالة ${i}`,at:i*15}))}));
  const nodes=textNodes(renderer.renderScene({scene:s,style:'section-deck',frame:179}));
  assert.equal(nodes.filter(t=>/^رسالة \d$/.test(t)).length,5);
  assert.equal(nodes.includes('رسالة 0'),false);
});

test('chat-thread exposes a valid editable library preview and template',async()=>{
  const {validateData}=await import('../engine/src/review-editor/panels/form-schema.ts');
  const {getPreviewDefinition,previewFixtureIssues}=await import('../engine/src/library-preview/fixtures.ts');
  assert.equal(validateData('chat-thread',kitTemplate('chat-thread',30).data).ok,true);
  assert.deepEqual(previewFixtureIssues(getPreviewDefinition('scene:chat-thread')),[]);
});

test('chat variants have proposed Arabic choices in the editor form',async()=>{const {fieldsForFamily}=await import('../engine/src/review-editor/panels/form-schema.ts');const fields=fieldsForFamily('chat-thread');assert.equal(fields[0].kind,'union');assert.deepEqual(fields[0].variants.map(v=>v.label),['فقاعات شات','بيكتب...','إشعارات']);});

test('notification stacks shift continuously when a new card arrives',async()=>{
  const {notificationCards}=await import('../engine/src/creative-kit/chat-thread/timing.ts');
  const data={variant:'notifications',messages:[{from:'them',text:'first',at:0},{from:'them',text:'second',at:30}]};
  assert.equal(notificationCards(data,29,30)[0].depth,0);
  const arriving=notificationCards(data,30,30).find(c=>c.index===0);
  const midway=notificationCards(data,34,30).find(c=>c.index===0);
  const settled=notificationCards(data,45,30).find(c=>c.index===0);
  assert.equal(arriving.depth,0);
  assert.ok(midway.depth>0&&midway.depth<1);
  assert.equal(settled.depth,1);
});

test('typing dots stay on the side of the upcoming sender',async()=>{
  const renderer=await frames();
  const s=scene({variant:'typing',messages:[{from:'them',text:'first',at:30},{from:'me',text:'second',at:90}]});
  assert.match(renderer.renderScene({scene:s,style:'section-deck',frame:15}),/data-chat-typing=.left./);
  assert.match(renderer.renderScene({scene:s,style:'section-deck',frame:75}),/data-chat-typing=.right./);
});

test('delivery catches moved and duplicated chat template text in all eight slots',()=>{
  const messages=[{from:'them',text:'رسالة من المصدر'},{from:'me',text:'رد من المصدر'},{from:'me',text:'اكتب الرد'}];
  assert.throws(()=>assertNoSampleText({scenes:[scene({variant:'notifications',title:'عنوان من المصدر',messages})]}),/sample text/);
  assert.throws(()=>assertNoSampleText({scenes:[scene({variant:'typing',messages:[{from:'me',text:'اكتب الرسالة الأولى'}]})]}),/sample text/);
});

test('whole message whitespace uses the same collapsing layout as the text measurer',async()=>{
  const renderer=await frames(),s=scene({variant:'bubbles',messages:[{from:'them',text:'one\ntwo\nthree\nfour',at:0}]});
  const html=renderer.renderScene({scene:s,style:'section-deck',frame:100});
  assert.doesNotMatch(html,/white-space:pre-wrap/);
  const drawn=html.replace(/<style[\s\S]*?<\/style>/g,'').split(/<[^>]*>/).filter(text=>text.trim()!=='');
  assert.ok(drawn.every(text=>!text.includes('\n')),'authored line breaks collapse like the measurer');
  for(const word of ['one','two','three','four'])assert.ok(textNodes(html).some(node=>node.split(/\s+/).includes(word)),word);
});
