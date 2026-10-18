import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectLibraryInventory,textSha256} from './library-inventory.mjs';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const EDITORIAL_INTENTS=Object.freeze(['question','process','comparison','evidence','scale','reveal','grouping','focus','chronology','cta','claim','result','code','keys','tooling','text','transform','brand','chapter','layout-change','cut','word-emphasis','branching','filtering','bottleneck','feedback']);
export const EDITORIAL_MOODS=Object.freeze(['calm','energetic','editorial','serious','playful','reflective','technical','warm']);
export const EDITORIAL_ENERGY=Object.freeze(['low','medium','high']);
export const EDITORIAL_ROLES=Object.freeze(['explanation','emphasis','transition','entrance','camera','style','wrapper','extension']);
export const EDITORIAL_ASSETS=Object.freeze(['image','image-pair','screen-capture','screen-recording','data','reviewed-words','project-pack','media']);
const MODES=['recording','graphics'],SOURCES=['presenter','screen','none','cartoon'],LAYOUTS=['presenter','split','takeover'];
const FILES=['concepts','scenes','effects-styles'].map(name=>`scripts/data/library-editorial/${name}.json`);
const compare=(a,b)=>a<b?-1:a>b?1:0;
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
function stringList(value,name,{choices,empty=false}={}){
  if(!Array.isArray(value)||(!empty&&!value.length)||value.some(item=>!nonempty(item)||choices&&!choices.includes(item))||new Set(value).size!==value.length)throw new Error(`Invalid editorial ${name}.`);
}
function validateRecord(item){
  if(!item||!nonempty(item.key)||!EDITORIAL_ROLES.includes(item.role)||!nonempty(item.labelAr)||!nonempty(item.explains)||!nonempty(item.action))throw new Error('Invalid editorial identity or explanation.');
  for(const name of ['useWhen','avoidWhen','requirements'])stringList(item[name],name);
  for(const [name,choices] of [['intents',EDITORIAL_INTENTS],['moods',EDITORIAL_MOODS],['energy',EDITORIAL_ENERGY],['modes',MODES],['sourceKinds',SOURCES],['requires',EDITORIAL_ASSETS]])stringList(item[name],name,{choices,empty:name==='requires'});
  if(item.intentLayouts!==undefined){
    if(!item.intentLayouts||typeof item.intentLayouts!=='object'||Array.isArray(item.intentLayouts)||!Object.keys(item.intentLayouts).length)throw new Error(`Invalid editorial intentLayouts: ${item.key}`);
    for(const [intent,layouts] of Object.entries(item.intentLayouts)){
      if(!item.intents.includes(intent))throw new Error(`Invalid editorial intentLayouts intent: ${item.key}`);
      stringList(layouts,'intentLayouts',{choices:LAYOUTS});
    }
  }
  if(!['explains','useWhen','avoidWhen'].every(name=>nonempty(item.display?.[name])))throw new Error(`Missing creator-facing editorial guidance: ${item.key}`);
  if(!Array.isArray(item.evidence)||!item.evidence.length)throw new Error(`Missing source evidence: ${item.key}`);
  for(const evidence of item.evidence)if(!/^(?:engine\/src\/[a-zA-Z0-9_./-]+\.tsx?|instructions\/(?:[A-Z0-9-]+|styles\/[a-z0-9-]+)\.md)$/.test(evidence.path??'')||evidence.path.split('/').some(part=>!part||part==='.'||part==='..')||!/^[a-f0-9]{64}$/.test(evidence.sha256??''))throw new Error(`Invalid editorial evidence path/hash: ${item.key}`);
}
async function scopedRead(root,relative){
  const absolute=path.join(root,...relative.split('/'));
  const actual=await fs.realpath(absolute),inside=path.relative(root,actual);
  if(inside==='..'||inside.startsWith(`..${path.sep}`)||path.isAbsolute(inside))throw new Error('Editorial evidence path is outside the studio root.');
  if((await fs.stat(actual)).size>2*1024*1024)throw new Error('Editorial source is unexpectedly large.');
  return fs.readFile(actual);
}

/** Read curated guidance and hash its bounded evidence; never import evidence code. */
export async function collectLibraryEditorial({root=ROOT,inventory}={}){
  root=await fs.realpath(root);
  inventory??=await collectLibraryInventory({root});
  const records=new Map(),checks=new Map();
  for(const file of FILES){
    const data=JSON.parse((await scopedRead(root,file)).toString('utf8'));
    if(data?.version!==1||!Array.isArray(data.items))throw new Error(`Invalid editorial catalog: ${file}`);
    for(const record of data.items){
      validateRecord(record);
      if(records.has(record.key))throw new Error(`Duplicate editorial key: ${record.key}`);
      records.set(record.key,record);
    }
  }
  const items=[];
  for(const item of inventory.items.filter(item=>['scene','concept','effect','style'].includes(item.kind))){
    const record=records.get(item.key);
    if(!record){items.push({...item,editorial:null});continue;}
    const changedEvidence=[];
    for(const evidence of record.evidence){
      if(!checks.has(evidence.path)){
        let sha256=null;
        try{sha256=textSha256((await scopedRead(root,evidence.path)).toString('utf8'));}
        catch(error){if(!['ENOENT','ENOTDIR'].includes(error.code))throw error;}
        checks.set(evidence.path,sha256);
      }
      if(checks.get(evidence.path)!==evidence.sha256)changedEvidence.push({...evidence,currentSha256:checks.get(evidence.path)});
    }
    items.push({...item,editorial:{...record,assessment:changedEvidence.length?'stale':'current',changedEvidence}});
  }
  const keys=new Set(items.map(item=>item.key));
  return {version:1,evidence:'Source-anchored editorial guidance. Mood/energy fit is authored judgement, not measured emotion or creator approval.',
    vocabulary:{intents:EDITORIAL_INTENTS,moods:EDITORIAL_MOODS,energy:EDITORIAL_ENERGY,roles:EDITORIAL_ROLES,assets:EDITORIAL_ASSETS},
    coverage:{visual:items.length,annotated:items.filter(item=>item.editorial).length,current:items.filter(item=>item.editorial?.assessment==='current').length},
    unclassified:items.filter(item=>!item.editorial).map(item=>item.key),
    orphaned:[...records.keys()].filter(key=>!keys.has(key)).sort(compare),
    styles:inventory.items.filter(item=>item.kind==='style'),items};
}

function validateContext(data,input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Selection context must be an object.');
  const allowed=['intent','mode','role','mood','energy','style','layout','durationSec','sourceKind','assets','requireBrandColors','limit'];
  if(Object.keys(input).some(key=>!allowed.includes(key)))throw new Error('Unknown selection context field.');
  for(const [field,choices,required] of [['intent',EDITORIAL_INTENTS,true],['mode',MODES,true],['role',EDITORIAL_ROLES],['mood',EDITORIAL_MOODS],['energy',EDITORIAL_ENERGY],['layout',LAYOUTS],['sourceKind',SOURCES]]){
    if(required||input[field]!==undefined)if(!choices.includes(input[field]))throw new Error(`Invalid selection context ${field}.`);
  }
  if(input.style!==undefined&&!data.styles.some(style=>style.nativeId===input.style))throw new Error('Unknown selection style.');
  if(input.durationSec!==undefined&&(!Number.isFinite(input.durationSec)||input.durationSec<=0||input.durationSec>600))throw new Error('Invalid selection duration.');
  if(input.assets!==undefined)stringList(input.assets,'context assets',{choices:EDITORIAL_ASSETS,empty:true});
  if(input.requireBrandColors!==undefined&&typeof input.requireBrandColors!=='boolean')throw new Error('Invalid selection context requireBrandColors.');
  if(input.limit!==undefined&&(!Number.isInteger(input.limit)||input.limit<1||input.limit>100))throw new Error('Invalid selection context limit.');
  if(input.mode==='graphics'&&input.sourceKind!==undefined&&input.sourceKind!=='none')throw new Error('Graphics context uses sourceKind none.');
  if(input.mode==='recording'&&input.sourceKind==='none')throw new Error('Recording context needs a real source kind.');
  return {...input,role:input.role??'explanation'};
}
function parentContract(item,byKey){
  let current=item;
  const seen=new Set();
  while(current&&(current.parentKey||current.variantOf)){
    if(seen.has(current.key))break;seen.add(current.key);
    const parent=byKey.get(current.parentKey??current.variantOf);if(!parent)break;
    current=parent;
  }
  return current??item;
}
const assetSet=assets=>{
  const result=new Set(assets??[]);
  if(['image','image-pair','screen-capture'].some(value=>result.has(value)))result.add('media');
  if(result.has('image-pair'))result.add('image');
  return result;
};

/** A read-only shortlist. It never chooses new copy/assets, changes style or applies an edit. */
export function recommendLibrary(data,input){
  const context=validateContext(data,input),byKey=new Map(data.items.map(item=>[item.key,item]));
  const style=data.styles.find(item=>item.nativeId===context.style);
  const candidates=[],excluded=[],assets=assetSet(context.assets);
  const output={version:1,context,decision:'shortlist',candidates,excluded,
    rankingBasis:'Meaning is required; compatible mood/energy adds editorial tie-break points. Scores are not measured demand, quality or probability.',
    identityBoundary:'Style ownership and requested profile colours are checked here; retain saved fonts, caption presentation, writing style and ending policy in the normal editor workflow.',
    nextAction:'Inspect the shortlisted schemas, preserve the selected style and actual sources, record the chosen visual action in EDITORIAL_PLAN.md, then review the real output.'};
  if(context.requireBrandColors&&style?.brand===false){
    output.decision='identity-conflict';output.nextAction='Keep the fixed style. Resolve its palette ownership against the requested profile colours with the creator; do not silently replace identity.';return output;
  }
  if(context.requireBrandColors&&!style&&context.role!=='style'){
    output.decision='needs-context';output.nextAction='Identify the saved or intended style before checking required profile colours; do not choose or replace the creator identity implicitly.';return output;
  }
  for(const item of data.items){
    const editorial=item.editorial,reasons=[];
    if(!editorial){excluded.push({key:item.key,reasons:['editorial-guidance-unclassified']});continue;}
    if(editorial.assessment!=='current')reasons.push('editorial-evidence-stale');
    if(['wrapper','extension'].includes(editorial.role))reasons.push('not-a-packaged-action');
    if(editorial.role!==context.role)reasons.push('different-role');
    if(!editorial.intents.includes(context.intent))reasons.push('different-meaning');
    if(!editorial.modes.includes(context.mode))reasons.push('mode-not-supported');
    const sourceKind=context.mode==='graphics'?'none':context.sourceKind;
    if(sourceKind&&!editorial.sourceKinds.includes(sourceKind))reasons.push('source-kind-not-supported');
    const parent=parentContract(item,byKey),sourceLayouts=parent.layouts??[],ownLayouts=item.layouts??sourceLayouts;
    const variantLayouts=sourceLayouts.length?ownLayouts.filter(layout=>sourceLayouts.includes(layout)):ownLayouts;
    const intentLayouts=editorial.intentLayouts?.[context.intent];
    const layouts=intentLayouts?variantLayouts.filter(layout=>intentLayouts.includes(layout)):variantLayouts;
    const layoutConstrained=item.layouts!==undefined||sourceLayouts.length>0||intentLayouts!==undefined;
    if(context.layout&&layoutConstrained&&!layouts.includes(context.layout))reasons.push('layout-not-supported');
    if(context.mode==='graphics'&&layoutConstrained&&!layouts.includes('takeover'))reasons.push('graphics-needs-takeover');
    if(context.mode==='graphics'&&context.layout&&context.layout!=='takeover')reasons.push('graphics-needs-takeover');
    const owner=item.ownerStyle??parent.ownerStyle;
    const candidateStyle=item.layer==='style'?item:owner?data.styles.find(entry=>entry.nativeId===owner):style;
    if(context.requireBrandColors&&candidateStyle?.brand===false)reasons.push('profile-colours-not-supported');
    if(owner&&context.style&&owner!==context.style)reasons.push('owned-by-another-style');
    if(item.layer==='style'&&context.style&&item.nativeId!==context.style)reasons.push('fixed-style-preserved');
    if(item.key==='caption-emphasis:pop'&&style?.defaults?.staticCaptions)reasons.push('static-caption-style');
    if(context.durationSec!==undefined&&item.minDurationSec!==undefined&&context.durationSec+1e-9<item.minDurationSec)reasons.push('duration-below-minimum');
    if(context.assets!==undefined&&editorial.requires.some(asset=>!assets.has(asset)))reasons.push('assets-not-available');
    if(reasons.length){excluded.push({key:item.key,reasons:[...new Set(reasons)]});continue;}
    const cautions=['validate-actual-data-and-readable-hold','review-motion-in-video-context'];
    if(!context.style)cautions.push('identity-not-specified');
    if(owner&&!context.style)cautions.push(`requires-style:${owner}`);
    if(context.assets===undefined&&editorial.requires.length)cautions.push('asset-availability-unconfirmed');
    if(context.mode==='recording'&&!sourceKind)cautions.push('source-kind-unconfirmed');
    if(!context.layout&&layouts.length)cautions.push('layout-not-specified');
    if(context.durationSec===undefined)cautions.push('duration-not-specified');
    if(item.minDurationSec===undefined)cautions.push('duration-depends-on-authored-data');
    let score=100;
    const matched=[`meaning:${context.intent}`];
    if(context.mood){const fits=editorial.moods.includes(context.mood);if(fits){score+=12;matched.push(`mood:${context.mood}`);}else cautions.push('mood-needs-adaptation');}
    if(context.energy){const fits=editorial.energy.includes(context.energy);if(fits){score+=6;matched.push(`energy:${context.energy}`);}else cautions.push('energy-needs-adaptation');}
    candidates.push({...item,score,reasons:matched,cautions,contract:{layouts,ownerStyle:owner??null,minimumDurationSec:item.minDurationSec??null,assetNeeds:editorial.requires},
      suggestedPlan:{initialActionResolved:editorial.action,requirements:editorial.requirements,approval:'No per-video creative acceptance is inferred.'}});
  }
  candidates.sort((a,b)=>b.score-a.score||compare(a.key,b.key));
  const total=candidates.length;candidates.splice(context.limit??5);
  output.matchedCount=total;
  if(!total){output.decision='no-match';output.nextAction='No compatible packaged action matched. Inspect the exclusions; adapt the plan or use instructions/PROJECT-SCENES.md for authorised project-local behaviour. Never invent a supported family.';}
  return output;
}

export function editorialCatalogMarkdown(data){
  const cell=value=>String(value??'').replace(/\|/g,'\\|').replace(/[\r\n]+/g,' ');
  const lines=['# Motion selection guide','','Meaning, mood and identity are separate decisions. Mood and energy below are editorial suggestions; check source contracts and actual video output.','',
    '| Key | Role | Explains | Use when | Avoid when | Mood / energy | Source |','| --- | --- | --- | --- | --- | --- | --- |'];
  for(const item of data.items){const e=item.editorial;lines.push(`| ${cell(item.key)} | ${cell(e?.role)} | ${cell(e?.explains)} | ${cell(e?.useWhen.join(' / '))} | ${cell(e?.avoidWhen.join(' / '))} | ${cell(e?[...e.moods,...e.energy].join(', '):'unclassified')} | ${cell(e?.assessment??'unclassified')} |`);}
  return lines.join('\n')+'\n';
}
