import {compileEdit} from '../engine/src/prepared-edit/timeline.ts';
import {aliasPolicy, aliasFontOverride, clauseCaptionsFor, defaultFontFor, defaultCaptionsFor} from '../engine/src/styles/style-compat.ts';
import {effectiveGrouping, lookView, lookResetPatch} from '../engine/src/review-editor/ops/look.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {STYLE_ALIASES, STYLE_IDS, getStyleMeta, normalizeStyleId, styleAliasNotice} from '../engine/src/styles/registry.ts';
import {editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {normalizeProfile} from '../scripts/lib/branding.mjs';
import {loadReviewProject} from '../scripts/lib/review-editor-project.mjs';
import {normalizeGraphicsSpec} from '../scripts/lib/graphics-project.mjs';
import {recommendEditorStyle} from '../scripts/lib/editor-director.mjs';
import {normalizeMixOptions} from '../scripts/lib/mix-contract.mjs';
import {defaultPreferences} from '../engine/src/core/preference-options.ts';
import {createFrameRenderer} from '../scripts/lib/ssr-frames.mjs';
import {ROOT} from '../scripts/lib/project-paths.mjs';
import {pipAllowed} from '../engine/src/core/pip.ts';

const profile = JSON.parse(await fs.readFile(new URL('../PROFILE.example.json', import.meta.url), 'utf8'));
const scene = {id:'proof', family:'proof', layout:'takeover', motion:'land', fromFrame:0, durationInFrames:180,
  data:{label:'Sample', value:42, suffix:'', source:'Authored test', caption:'Sample'}};
const manifest = (style, id='v4-alias-test') => ({version:1,id,purpose:'test',style,
  source:{path:`Projects/${id}/source.mp4`,sha256:'0'.repeat(64),fps:30,width:1080,height:1920,totalFrames:180},
  segments:[{fromFrame:0,toFrame:180}],captions:{status:'draft',words:[]},scenes:[scene],sounds:[],camera:[]});
const frames = await createFrameRenderer();

for (const [old, replacement] of Object.entries(STYLE_ALIASES)) {
  test(`${old} rewrites once to ${replacement} and stays out of product choices`, () => {
    const notices=[];
    assert.equal(normalizeStyleId(old, text=>notices.push(text)),replacement);
    assert.deepEqual(notices,[`Style "${old}" was merged into "${replacement}".`]);
    normalizeStyleId(replacement, text=>notices.push(text));
    assert.equal(notices.length,1);
    assert.ok(!STYLE_IDS.includes(old));
    assert.equal(getStyleMeta(old).id,replacement);
    assert.equal(styleAliasNotice(old,'ar'),`الستايل ده اتدمج في ${replacement}.`);
  });

  test(`edit.json with ${old} opens in the editor and renders ${replacement}'s theme`, async (t) => {
    const id=`v4-alias-${randomUUID()}`, relative=`Projects/${id}/edit.json`, directory=path.join(ROOT,'Projects',id);
    assert.equal(path.dirname(directory),path.join(ROOT,'Projects'));
    await fs.mkdir(directory,{recursive:true});
    t.after(()=>fs.rm(directory,{recursive:true,force:true}));
    const raw=manifest(old,id), bytes=JSON.stringify(raw);
    await fs.writeFile(path.join(ROOT,relative),bytes);
    const project=await loadReviewProject(relative);
    assert.equal(project.manifest.style,replacement);
    assert.equal(project.warnings.filter(message=>message===styleAliasNotice(old,'ar')).length,1);
    assert.equal(await fs.readFile(path.join(ROOT,relative),'utf8'),bytes,'opening never rewrites the project');
    assert.deepEqual(frames.theme(project.manifest.style),frames.theme(replacement));
    assert.equal(frames.renderScene({scene:project.manifest.scenes[0],style:project.manifest.style,frame:90}),
      frames.renderScene({scene:editManifestSchema.parse(manifest(replacement)).scenes[0],style:replacement,frame:90}));
  });

  test(`fixed profile, graphics spec, CLI and director accept ${old}`, () => {
    const saved={...profile,schemaVersion:3,preferences:{...defaultPreferences(),style:{mode:'fixed',value:old}}};
    assert.equal(normalizeProfile(saved).preferences.style.value,replacement);
    assert.equal(saved.preferences.style.value,old,'loading preserves saved data');
    assert.equal(normalizeGraphicsSpec({version:1,id:'v4-alias-test',style:old,reviewedBy:'Test',scenes:[scene]}).style,replacement);
    assert.equal(normalizeMixOptions({video:'Projects/v4-alias-test/in.mp4',out:'Projects/v4-alias-test/out.mp4',style:old}).style,replacement);
    const brief={version:1,id:'v4-alias-test',source:'Raw/test.mp4',transcript:'Projects/v4-alias-test/words.json',
      creator:{displayName:'Test',handle:null,ending:{cta:null,followCard:false,signOff:null}},purpose:'explainer',tone:'calm',style:old,
      beats:[{id:'proof',fromSec:0,toSec:6,intent:'proof',data:scene.data}]};
    assert.equal(recommendEditorStyle(brief).style,replacement);
    delete brief.style;
    brief.preferences=saved.preferences;
    assert.equal(recommendEditorStyle(brief).style,replacement);
  });
}

test('unknown and prototype ids still fail rather than aliasing', () => {
  assert.equal(STYLE_IDS.length,11);
  for(const id of ['not-a-style','constructor','__proto__','toString']) {
    assert.equal(normalizeStyleId(id),id);
    assert.equal(editManifestSchema.safeParse(manifest(id)).success,false);
    assert.throws(()=>getStyleMeta(id),/Unknown style/);
    assert.throws(()=>normalizeProfile({...profile,schemaVersion:3,preferences:{...defaultPreferences(),style:{mode:'fixed',value:id}}}),/Invalid style preference/);
  }
});

test('migrated PiP keeps its recorded permission across saves without changing the replacement policy',()=>{
  const geo={windowTop:0,windowHeight:1920,videoWidth:1080,videoLeft:0,videoTop:0};
  const pip={x:50,y:100,width:260,height:260,radius:30,plate:{left:-50,top:-20,width:360,height:640},sceneIds:['proof']};
  for(const old of ['split-canvas','stepped-editorial','judgment-board']) {
    const migrated=editManifestSchema.parse({...manifest(old),footage:{full:geo,split:geo,pip}});
    assert.equal(migrated.styleAlias,old);
    assert.deepEqual(migrated.footage.pip,pip);
    const saved=editManifestSchema.parse(JSON.parse(JSON.stringify(migrated)));
    assert.equal(pipAllowed(saved.style,saved.styleAlias).allowed,true);
    assert.equal(pipAllowed(saved.style).allowed,false,'new projects retain the host policy');
    const native={...saved};delete native.styleAlias;
    assert.equal(editManifestSchema.safeParse(native).success,false);
  }
});

test('migrated pop and stretch remain valid and animated after a save; native documentary stays static',()=>{
  for(const kind of ['pop','stretch']) {
    const raw={...manifest('scrapbook-route'),captions:{status:'draft',words:[{text:'جميل',startMs:0,endMs:3000,confidence:null}],emphasis:[{sourceIndex:0,kind}]}};
    const saved=editManifestSchema.parse(JSON.parse(JSON.stringify(editManifestSchema.parse(raw))));
    assert.equal(saved.styleAlias,'scrapbook-route');
    assert.equal(saved.captions.emphasis[0].kind,kind);
    const native={...saved};delete native.styleAlias;
    assert.equal(editManifestSchema.safeParse(native).success,false);
    const plain={...saved,captions:{...saved.captions,emphasis:[]}};
    const frame=kind==='pop'?1:15;
    const animated=frames.renderCaptions({edit:saved,frame});
    assert.notEqual(animated,frames.renderCaptions({edit:plain,frame}));
    if(kind==='stretch')assert.ok(animated.includes('ـ'),'legal joined stretch is actually drawn');
  }
});

test('migration provenance must name a real alias of the selected replacement',()=>{
  assert.equal(editManifestSchema.safeParse({...manifest('kinetic-paper'),styleAlias:'split-canvas'}).success,false);
  assert.equal(editManifestSchema.safeParse({...manifest('section-deck'),styleAlias:'constructor'}).success,false);
});

test('every migrated manifest preserves origin grouping, font and caption defaults across a save',()=>{
  const defaults={
    'split-canvas':['Cairo','pill'], 'scrapbook-route':['Tajawal','pill'],
    'stepped-editorial':['Plex Display','ink-strip'], 'judgment-board':['Plex Display','ink-strip'],
    'campaign-tickets':['Cairo','ink-strip'],
  };
  const words=Array.from({length:12},(_,i)=>({text:'word',startMs:i*250,endMs:i*250+200,confidence:1}));
  for(const [old,replacement] of Object.entries(STYLE_ALIASES)) {
    const raw={...manifest(old),scenes:[],captions:{status:'draft',words}};
    const saved=editManifestSchema.parse(JSON.parse(JSON.stringify(editManifestSchema.parse(raw))));
    assert.equal(saved.styleAlias,old);
    assert.equal(saved.captions.grouping,undefined);
    const compiled=compileEdit(saved);
    assert.deepEqual(compiled.captionGroups.map(group=>group.words.length),[4,4,4],old);
    assert.deepEqual(compiled.captionGroups,compileEdit({...saved,captions:{...saved.captions,grouping:'compact'}}).captionGroups);
    assert.equal(compileEdit({...saved,captions:{...saved.captions,grouping:'clauses'}}).captionGroups[0].words.length,9);
    assert.equal(effectiveGrouping(saved),'compact');
    assert.equal(clauseCaptionsFor(replacement,old),false);
    const [font,presentation]=defaults[old];
    assert.equal(defaultFontFor(replacement,old),font);
    assert.equal(defaultCaptionsFor(replacement,old),presentation);
    assert.equal(lookView(saved).font.styleDefault,font);
    assert.equal(lookView(saved).presentation.effective,presentation);
    assert.deepEqual(lookResetPatch(saved,'fontFamily'),{fontFamily:font});
    assert.deepEqual(lookResetPatch(saved,'captionsPresentation'),{captionsPresentation:presentation});
    const fontOverride=font===getStyleMeta(replacement).defaults.font?undefined:font;
    assert.equal(aliasFontOverride(replacement,old),fontOverride);
    assert.equal(frames.renderCaptions({edit:saved,frame:1}),frames.renderCaptions({edit:{...saved,...(fontOverride?{fontFamily:fontOverride}:{}),captions:{...saved.captions,presentation}},frame:1}),old);
    const chosen={...saved,fontFamily:'Cairo',captions:{...saved.captions,grouping:'single',presentation:'minimal'}};
    const nativeChosen={...chosen};delete nativeChosen.styleAlias;
    assert.equal(frames.renderCaptions({edit:chosen,frame:1}),frames.renderCaptions({edit:nativeChosen,frame:1}),'explicit choices win over the migration defaults');
  }
  for(const style of ['section-deck','documentary']) {
    const native=editManifestSchema.parse({...manifest(style),scenes:[],captions:{status:'draft',words}});
    assert.equal(compileEdit(native).captionGroups[0].words.length,9,style);
  }
  assert.equal(aliasPolicy('kinetic-paper','split-canvas'),null,'mismatched provenance cannot change defaults');
});
