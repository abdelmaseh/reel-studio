import test from 'node:test';
import assert from 'node:assert/strict';
import {checkText,isSubsequence,collectLiterals} from '../scripts/lib/text-check.mjs';

const words=text=>text.split(' ').map((word,index)=>({text:word,startMs:index*300,endMs:index*300+250,confidence:1}));
const manifest=(scenes,spoken)=>({captions:{words:words(spoken)},scenes});

test('isSubsequence allows gaps but not reordering',()=>{
  assert.equal(isSubsequence(['a','c'],['a','b','c']),true);
  assert.equal(isSubsequence(['c','a'],['a','b','c']),false);
  assert.equal(isSubsequence([],['a']),true);
});

test('collectLiterals walks nested scene data with paths',()=>{
  const literals=collectLiterals([{id:'s1',data:{title:'x',items:[{label:'y'}],empty:'  '}}]);
  assert.deepEqual(literals,[{sceneId:'s1',path:'data.title',text:'x'},{sceneId:'s1',path:'data.items[0].label',text:'y'}]);
});

test('spoken words in order pass, gapped runs pass, reordered words fail',()=>{
  const spoken='قبل ما تبدأ خطة جديدة اكتب الفكرة في سطر';
  const ok=checkText(manifest([{id:'a',data:{title:'اكتب الفكرة في سطر'}},{id:'b',data:{title:'قبل تبدأ جديدة'}}],spoken));
  assert.equal(ok.ok,true);assert.deepEqual(ok.literals.map(item=>item.status),['spoken','spoken']);
  const bad=checkText(manifest([{id:'c',data:{title:'جديدة خطة'}}],spoken));
  assert.equal(bad.ok,false);assert.equal(bad.literals[0].status,'unlisted');assert.match(bad.problems[0],/unlisted Arabic text c\.data\.title/);
});

test('tashkeel and letter variants do not break the match',()=>{
  const result=checkText(manifest([{id:'a',data:{t:'أكتر من تسعمية سطر'}}],'اكتر من تسعميه سطر'));
  assert.equal(result.ok,true);
});

test('explanatory labels need a listed reason, digits need the transcript or evidence, placeholders fail',()=>{
  const spoken='كلام تاني خالص';
  const r1=checkText(manifest([{id:'a',data:{label:'ملخص الفكرة',count:'19',sample:'987654'}}],spoken));
  assert.equal(r1.ok,false);assert.equal(r1.problems.length,3);
  const r2=checkText(manifest([{id:'a',data:{label:'ملخص الفكرة',count:'19'}}],spoken),
    {explanatoryText:[{sceneId:'a',text:'ملخص الفكرة',reason:'summary label, not a subtitle'}],evidence:[{sceneId:'a',digits:'19',source:'count on the official page'}]});
  assert.equal(r2.ok,true);assert.equal(r2.literals[0].status,'explanatory');assert.equal(r2.digits[0].status,'evidenced');
  const r3=checkText(manifest([{id:'a',data:{label:'ملخص الفكرة'}}],spoken),{explanatoryText:[{sceneId:'a',text:'ملخص الفكرة',reason:''}]});
  assert.equal(r3.ok,false);
});

test('latin-only strings are not spoken-text literals but their digits are still checked',()=>{
  const clean=checkText(manifest([{id:'a',data:{tag:'NEW'}}],'كلام'));
  assert.deepEqual(clean.literals,[]);assert.equal(clean.ok,true);
  const digits=checkText(manifest([{id:'b',data:{tag:'19 agents'}}],'كلام'));
  assert.equal(digits.ok,false);assert.equal(digits.digits[0].status,'missing');
  const spokenDigits=checkText(manifest([{id:'c',data:{tag:'19 agents'}}],'فيه 19 وكيل'));
  assert.equal(spokenDigits.ok,true);
  const technical=checkText(manifest([{id:'d',data:{accent:'#BDF76B',file:'a1.png'}}],'كلام'));
  assert.equal(technical.ok,true);assert.deepEqual(technical.digits,[]);
  const indic=checkText(manifest([{id:'e',data:{t:'١٩ وكيل'}}],'فيه 19 وكيل'));
  assert.equal(indic.ok,true);assert.equal(indic.digits.length,1);assert.equal(indic.digits[0].status,'spoken');
});

test('numeric figures, number-with-unit tokens and technical strings',()=>{
  const sample=checkText(manifest([{id:'n',family:'count',data:{value:987654,label:'كلام'}}],'كلام'));
  assert.equal(sample.ok,false);assert.equal(sample.placeholders[0].path,'data.value');
  const unspoken=checkText(manifest([{id:'n',data:{items:[{value:19}]}}],'كلام'));
  assert.equal(unspoken.ok,false);assert.equal(unspoken.digits[0].path,'data.items[0].value');assert.equal(unspoken.digits[0].status,'missing');
  assert.equal(checkText(manifest([{id:'n',data:{value:19}}],'فيه 19 وكيل')).ok,true);
  const figures=checkText(manifest([{id:'m',data:{score:7,percent:50,maximum:100,values:[19,20],fromFrame:12,width:640}}],'كلام'));
  assert.deepEqual(figures.digits.map(item=>item.path),['data.score','data.percent','data.maximum','data.values[0]','data.values[1]']);
  const proclitic=checkText(manifest([{id:'p',data:{t:'و٥ خطوات'}}],'كلام'));
  assert.equal(proclitic.digits[0].text,'٥');assert.equal(proclitic.digits[0].status,'missing');
  const unit=checkText(manifest([{id:'u',data:{tag:'100K'}}],'كلام'));
  assert.equal(unit.ok,false);assert.equal(unit.digits[0].text,'100');
  assert.equal(checkText(manifest([{id:'u',data:{tag:'100K'}}],'وصلنا 100 ألف')).ok,true);
  assert.deepEqual(checkText(manifest([{id:'w',data:{tag:'GPT4, MP4, H.264, v2.0'}}],'كلام')).digits,[]);
  const resolution=checkText(manifest([{id:'w',data:{tag:'Full HD 1080p'}}],'كلام'));
  assert.equal(resolution.digits[0].text,'1080');assert.equal(resolution.digits[0].status,'missing');
  const decimal=checkText(manifest([{id:'v',data:{tag:'3.5x'}}],'أسرع 3.5 مرة'));
  assert.equal(decimal.ok,true);assert.equal(decimal.digits[0].text,'3.5');
  const assets=checkText(manifest([{id:'t',data:{src:'Projects/x/clip-02.mp4',poster:'clip-02.png',link:'https://example.com/a/2',frameStyle:{textColor:'#112233'},stepId:'step-2',delay:12}}],'كلام'));
  assert.equal(assets.ok,true,JSON.stringify(assets.problems));assert.deepEqual(assets.digits,[]);
});
