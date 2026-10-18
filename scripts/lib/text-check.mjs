import {captionWords} from './caption-check.mjs';
import {SAMPLE_NUMBER} from '../../engine/src/prepared-edit/sample-numbers.ts';

const ARABIC=/[؀-ۿ]/;
// A figure may carry a unit after it (100K, 3.5x, 1080p) or an Arabic proclitic before it (و٥, ب٣); a run glued to a Latin letter, digit, # or dot before it is an identifier (GPT4, MP4, H.264, v2.0, #FFF).
const DIGIT_RUN=/(?<![A-Za-z\p{N}#.,])[0-9٠-٩۰-۹]+(?:[.,][0-9٠-٩۰-۹]+)*/gu;
// Keys and values that carry code, assets or styling, never words or numbers the viewer reads.
const TECHNICAL_KEY=/^(?:id|.*Id|src|path|file|url|href|icon|component|recipe|font|.*Font|color|.*Color|accent)$/;
const TECHNICAL_VALUE=/^(?:#[\da-f]{3,8}|(?:https?:\/\/|(?:Projects|Raw|Reference|Outputs|state)\/)\S*|[\w.-]+\.(?:png|jpe?g|webp|gif|svg|mp4|mov|webm|wav|mp3|m4a|json|ttf|otf|woff2?))$/i;
// Numeric scene values that are drawn on screen (count and data-story figures).
const NUMERIC_COPY_KEY=/^(?:values?|count|number|amount|total|score|percent(?:age)?|max(?:imum)?|min(?:imum)?|target|goal|price|cost)$/;

/** Every on-screen string inside scene.data (technical keys and asset/colour values skipped) and every numeric figure, with its scene id and a dotted path. */
export function collectLiterals(scenes=[]){
  const out=[];
  const walk=(value,sceneId,trail,key)=>{
    if(key!==undefined&&TECHNICAL_KEY.test(key))return;
    if(typeof value==='string'){if(value.trim()&&!TECHNICAL_VALUE.test(value.trim()))out.push({sceneId,path:trail,text:value});return;}
    if(typeof value==='number'){if(Number.isFinite(value)&&key!==undefined&&NUMERIC_COPY_KEY.test(key))out.push({sceneId,path:trail,text:String(value)});return;}
    if(Array.isArray(value)){value.forEach((item,index)=>walk(item,sceneId,`${trail}[${index}]`,key));return;}
    if(value&&typeof value==='object')for(const [name,item]of Object.entries(value))walk(item,sceneId,`${trail}.${name}`,name);
  };
  for(const scene of scenes)walk(scene?.data,scene?.id,'data');
  return out;
}

/** needle appears in hay in order, gaps allowed (the private assertSubsequence rule). */
export function isSubsequence(needle,hay){
  let index=0;
  for(const word of hay){if(index<needle.length&&word===needle[index])index++;if(index===needle.length)return true;}
  return needle.length===0;
}

const sameWords=(a,b)=>captionWords(a).join(' ')===captionWords(b).join(' ');
const filled=value=>typeof value==='string'&&value.trim().length>0;

export function checkText(manifest,{transcriptWords,explanatoryText=[],evidence=[]}={}){
  const words=transcriptWords??manifest?.captions?.words??[];
  const hay=captionWords(words.map(word=>String(word?.text??'')).join(' '));
  const literals=[],digits=[],placeholders=[];
  for(const {sceneId,path,text}of collectLiterals(manifest?.scenes)){
    if(text.includes(String(SAMPLE_NUMBER)))placeholders.push({sceneId,path,text});
    else for(const run of text.match(DIGIT_RUN)??[]){
      const tokens=captionWords(run);if(!tokens.length)continue;
      const status=isSubsequence(tokens,hay)?'spoken'
        :evidence.some(item=>item?.sceneId===sceneId&&sameWords(String(item.digits??''),run)&&filled(item.source))?'evidenced':'missing';
      digits.push({sceneId,path,text:run,status});
    }
    if(!ARABIC.test(text))continue;
    const tokens=captionWords(text);if(!tokens.length)continue;
    let status='unlisted';
    if(isSubsequence(tokens,hay))status='spoken';
    else if(explanatoryText.some(item=>item?.sceneId===sceneId&&typeof item.text==='string'&&filled(item.reason)&&sameWords(item.text,text)))status='explanatory';
    literals.push({sceneId,path,text,status});
  }
  const problems=[
    ...placeholders.map(item=>`placeholder ${item.sceneId}.${item.path}: ${item.text}`),
    ...literals.filter(item=>item.status==='unlisted').map(item=>`unlisted Arabic text ${item.sceneId}.${item.path}: «${item.text}»`),
    ...digits.filter(item=>item.status==='missing').map(item=>`digits not spoken or evidenced ${item.sceneId}.${item.path}: ${item.text}`),
  ];
  return {ok:problems.length===0,literals,digits,placeholders,problems};
}
