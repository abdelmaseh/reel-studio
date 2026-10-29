import test from 'node:test';
import assert from 'node:assert/strict';
import {bundleEngine, setSsrFrame} from './helpers/engine-bundle.mjs';
import {ARABIC_SCENES} from './fixtures/arabic-scenes.mjs';

const api = await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {SceneLayer, PreparedEdit} from './engine/src/prepared-edit/PreparedEdit';
  import {FAMILY_DESIGNS} from './engine/src/styles/family-designs';
  import {ChapterThemeProvider} from './engine/src/creative-kit/chapter-theme';
  import {getSceneGeometry, getSceneTheme} from './engine/src/creative-kit/primitives';
  import {fit, usePalette, sceneCopy} from './engine/src/styles/section-deck/designs/kit';
  import {editSceneSchema} from './engine/src/prepared-edit/schema.ts';
  import {fitsSafeZone, safeWidthFor} from './engine/src/core/type';
  import {SceneDemo} from './engine/src/library-preview/Preview';
  import {previewDefinitions} from './engine/src/library-preview/fixtures';
  export {FAMILY_DESIGNS, editSceneSchema, getSceneGeometry, fitsSafeZone, safeWidthFor, fit, previewDefinitions, sceneCopy, getSceneTheme};
  const geometry = {windowTop:1056, windowHeight:864, videoWidth:1080, videoLeft:0, videoTop:-340};
  export const render = (scene, sectionIndex, chapter = null) => renderToStaticMarkup(
    <ChapterThemeProvider chapter={chapter}><SceneLayer scene={scene} sectionIndex={sectionIndex} style="section-deck" geometry={geometry} aspect={16/9} seam={1056}/></ChapterThemeProvider>);
  const Palette = ({ar = true}) => <output>{JSON.stringify(usePalette(ar))}</output>;
  export const palette = (chapter, ar = true) => renderToStaticMarkup(<ChapterThemeProvider chapter={chapter}><Palette ar={ar}/></ChapterThemeProvider>);
  export const preview = definition => renderToStaticMarkup(<SceneDemo definition={definition}/>);
  export const prepared = edit => renderToStaticMarkup(<PreparedEdit edit={edit} plate={{src:'_prepared/test/abc.mp4',width:1080,height:1920}}/>);
  export const stub = ({scene, sectionIndex}) => <aside data-scene={scene.id} data-section={sectionIndex}/>;
`, {ssr:true, media:true});

const families = ['intro','proof','process','checklist','comparison','statement','count','comment','follow'];
const scenes = ARABIC_SCENES.filter(scene => families.includes(scene.family));
setSsrFrame(100);

for (const sample of scenes) test(`${sample.family}: parsed sample SSR frame`, () => {
  const scene = api.editSceneSchema.parse(sample);
  const html = api.render(scene, 1);
  assert.ok(html.length > 1000);
  assert.doesNotMatch(html, /NaN|undefined|Infinity/);
  assert.ok((scene.data.title ?? scene.data.label ?? scene.data.keyword ?? scene.data.handle).split(' ').every(word => html.includes(word)), 'real scene copy reaches the drawing');
});

test('library fixtures render every deck family through the registered design', () => {
  for (const family of families) {
    const definition = api.previewDefinitions().find(item => item.key === `scene:${family}`);
    assert.ok(definition, family);
    assert.ok(api.preview(definition).length > 1000, family);
  }
});

test('long titles, a four-item checklist and equal/one-item cues never throw', () => {
  for (const sample of scenes.filter(scene => 'title' in scene.data)) {
    const scene = structuredClone(sample);
    const max = scene.family === 'intro' ? 64 : ['process','comparison'].includes(scene.family) ? 52 : 140;
    scene.data.title = 'عنوان طويل لاختبار حدود مساحة النص '.repeat(8).slice(0, max);
    const html = api.render(api.editSceneSchema.parse(scene), 2);
    assert.doesNotMatch(html, /NaN|Infinity/);
  }
  for (const variant of ['missing','blueprint']) for (const count of [1,4,5]) for (const equal of [true,false]) {
    const scene = structuredClone(scenes.find(scene => scene.family === 'checklist'));
    scene.data.variant = variant;
    scene.data.items = Array.from({length:count}, (_,i) => ({label:`العنصر ${i+1}`,detail:'تفصيل',atFrame:equal ? 20 : 20+i*20}));
    assert.doesNotMatch(api.render(api.editSceneSchema.parse(scene), 3), /NaN|Infinity/);
  }
});

test('unfittable copy keeps the smallest size, line budget and all words, with an advisory', () => {
  const warnings = [], warn = console.warn;
  console.warn = message => warnings.push(message);
  try {
    const text = 'Unfittable content '.repeat(80);
    const result = api.fit(text, {width:100,size:150,min:72,lines:4,weight:900}, 'Cairo');
    assert.equal(result.size,72);
    assert.equal(result.fits,false);
    assert.ok(result.lines.length <= 4);
    assert.equal(result.lines.join(' ').replace(/\s+/g,' ').trim(), text.trim());
    assert.ok(warnings.some(warning => warning.includes('section-deck fit-warning:')));
    assert.doesNotThrow(() => api.render({...scenes[0],data:{...scenes[0].data,title:text}}, 4));
  } finally {console.warn = warn;}
});

test('brand changes accent and its ink while the approved grounds and text stay fixed', () => {
  const brand = {ground:'#FFFFFF',ink:'#000000',accent:'#00FFCC',onAccent:'#000000'};
  const palette = api.palette(brand);
  for (const token of ['#0A1428','#1E3A6E','#110D2C','#3A2C86','#1C0B05','#5A2410','#00FFCC','#000000']) assert.ok(palette.includes(token),token);
  assert.ok(palette.includes('&quot;ink&quot;:&quot;#FFFFFF&quot;'));
  const html = api.render(scenes.find(scene => scene.family==='intro'),1,brand);
  assert.ok(html.includes('#00FFCC'));
  assert.ok(html.includes('#0A1428'));
});

test('numerals are padded and absent when the caller has no takeover index', () => {
  const scene = scenes.find(scene => scene.family==='intro');
  assert.match(api.render(scene,7), />07<\/div>/);
  assert.doesNotMatch(api.render(scene), /-webkit-text-stroke/);
});

test('PreparedEdit numbers only takeover scenes once; the library supplies index 1', () => {
  const original = api.FAMILY_DESIGNS['section-deck'];
  api.FAMILY_DESIGNS['section-deck'] = Object.fromEntries(families.map(family => [family,api.stub]));
  try {
    const sceneList = ['intro','statement','proof','count','comment'].map((family,i) => ({...structuredClone(scenes.find(s => s.family===family)),id:`scene-${i}`,fromFrame:i*240}));
    const edit = {version:1,id:'section-indices',purpose:'test',style:'section-deck',source:{path:'Projects/test/source.mp4',sha256:'0'.repeat(64),fps:30,width:1080,height:1920,totalFrames:1200},segments:[{fromFrame:0,toFrame:1200}],captions:{status:'draft',words:[]},scenes:sceneList,sounds:[],camera:[]};
    const html = api.prepared(edit);
    assert.match(html,/data-scene="scene-0" data-section="1"/);
    assert.match(html,/data-scene="scene-1">/);
    assert.match(html,/data-scene="scene-2" data-section="2"/);
    assert.match(html,/data-scene="scene-3">/);
    assert.match(html,/data-scene="scene-4" data-section="3"/);
    assert.match(api.preview(api.previewDefinitions().find(item => item.key==='scene:proof')),/data-section="1"/);
  } finally {api.FAMILY_DESIGNS['section-deck'] = original;}
});

test('takeover caption band at 1330 and split seam at 1056 fit ig-reels-organic', () => {
  for (const [layout,center] of [['takeover',1330],['split',1056]]) {
    assert.equal(api.getSceneGeometry('section-deck',layout).captionCenter,center);
    const band = api.safeWidthFor(center-64,128,'ig-reels-organic',{inset:32});
    assert.equal(api.fitsSafeZone({left:band.left,top:center-64,width:band.width,height:128},'ig-reels-organic').ok,true);
  }
});

const englishData = {
  intro:{kicker:'Example',title:'One clear idea',subtitle:'Explain the idea',caption:'Example'},
  proof:{label:'Supplied value',value:42,suffix:'%',source:'Illustrative source',caption:'Example'},
  process:{title:'Three clear steps',steps:[{title:'Plan',detail:'Choose the idea'},{title:'Build',detail:'Put it together'},{title:'Review',detail:'Check the result'}],caption:'Example'},
  comparison:{title:'A clear difference',beforeTitle:'Before',beforeDetail:'Separate ideas',afterTitle:'After',afterDetail:'One clear idea',caption:'Example'},
  comment:{keyword:'guide',promise:'An illustrative example',caption:'Example'},
  follow:{handle:'@example',message:'Practical ideas',caption:'Example'},
  checklist:{kicker:'Example',title:'Check the plan',variant:'blueprint',items:[{label:'Plan',detail:'Choose the idea',atFrame:15},{label:'Build',detail:'Put it together',atFrame:45},{label:'Review',detail:'Check the result',atFrame:75}]},
  count:{kicker:'Example',title:'Supplied value',value:42,suffix:'%',unit:'of the sample',rollFrame:24,rollDuration:40,unitFrame:70,badge:'Example',badgeFrame:90},
  statement:{kicker:'Example',title:'One clear idea'},
};

for (const sample of scenes) test(sample.family + ': English scene uses ltr copy and mirrored anchors', () => {
  setSsrFrame(50);
  const scene = api.editSceneSchema.parse({...sample,data:englishData[sample.family]});
  const html = api.render(scene, 1);
  assert.doesNotMatch(html, /[\u0600-\u06FF]/);
  assert.doesNotMatch(html, /direction:rtl/);
  const titleTop = {intro:380,proof:320,process:300,checklist:370,comparison:300,statement:350,count:350,comment:330};
  if(sample.family==='follow')assert.match(html,/font-size:52px;line-height:1.35;color:[^;]+;direction:ltr/);
  else assert.ok(html.includes('top:'+titleTop[sample.family]+'px;left:65px;'),sample.family);
  if(sample.family==='process')assert.match(html,/top:640px;left:65px;width:92px/);
  if(sample.family==='checklist')assert.match(html,/top:372px;right:65px;width:200px/);
});

test('scene copy uses visible text and explicit language, ignoring Arabic asset names', () => {
  const en = api.sceneCopy({title:'A clear idea',image:'captures/\u0623\u0635\u0644.png'});
  assert.equal(en.ar,false);assert.equal(en.dir,'ltr');assert.equal(en.align,'left');
  const ar = api.sceneCopy({title:'\u0641\u0643\u0631\u0629',src:'sample.png'});
  assert.equal(ar.ar,true);assert.equal(ar.dir,'rtl');assert.equal(ar.align,'right');
  assert.equal(api.sceneCopy({lang:'en',title:'\u0641\u0643\u0631\u0629'}).dir,'ltr');
});

test('English deck text uses the theme display face while Arabic keeps the approved face', () => {
  const read = ar => JSON.parse(api.palette(null,ar).replace(/^<output>|<\/output>$/g,'').replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&amp;','&'));
  assert.equal(read(false).font,api.getSceneTheme('section-deck').display);
  assert.equal(read(true).font,'Cairo');
});
