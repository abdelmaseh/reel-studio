import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(new URL('../../engine/package.json',import.meta.url));
export const lifecycleBrowser=path.join(root,'.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe');

// Real React commits/effects in the installed browser, with a fixed composition clock and simple host primitives.
export async function transitionMountCounts(){
  const {build}=require('esbuild');
  const result=await build({stdin:{resolveDir:root,loader:'tsx',contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
    import {Blinds} from './engine/src/core/transitions-v4/blinds';
    import {DotZoom} from './engine/src/core/transitions-v4/dot-zoom';
    import {ZoomThrough} from './engine/src/core/transitions-v4/zoom-through';
    import {SafeRoot} from './engine/src/core/safe';
    window.checkMounts=async(kind)=>{
      let mounts=0,unmounts=0;
      const Child=()=>{React.useEffect(()=>{mounts++;return()=>{unmounts++;};},[]);return <video data-named-video="sentinel"/>;};
      const host=document.createElement('div');document.body.appendChild(host);
      const root=createRoot(host),Component={blinds:Blinds,'dot-zoom':DotZoom,'zoom-through':ZoomThrough}[kind];
      for(const frame of [60,70,90,91,92,100]){
        window.transitionFrame=frame;
        flushSync(()=>root.render(<SafeRoot><Component atFrame={60} durationInFrames={32} fps={30} box={{x:0,y:0,width:1080,height:1040}}><Child/></Component></SafeRoot>));
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      const counts={mounts,unmounts};root.unmount();host.remove();return counts;
    };
  `},nodePaths:[path.join(root,'engine/node_modules')],bundle:true,write:false,platform:'browser',format:'iife',logLevel:'silent',
    plugins:[{name:'composition-clock',setup(b){
      b.onResolve({filter:/^remotion$/},()=>({path:'clock',namespace:'test-clock'}));
      b.onLoad({filter:/.*/,namespace:'test-clock'},()=>({loader:'js',resolveDir:root,contents:`
        export * from ${JSON.stringify(path.join(root,'engine/node_modules/remotion/dist/esm/index.mjs').replaceAll('\\','/'))};
        import React from 'react';
        export const useCurrentFrame=()=>window.transitionFrame??0;
        export const useVideoConfig=()=>({width:1080,height:1920,fps:30,durationInFrames:180});
        export const AbsoluteFill=({children,style,...props})=>React.createElement('div',{...props,style:{position:'absolute',inset:0,...style}},children);
        export const interpolate=(x,input,output)=>output[0]+(output[1]-output[0])*(x-input[0])/(input[1]-input[0]);
        export const spring=()=>1;export const random=()=>.5;
      `}));
    }}]});
  const temp=path.join(root,'state/tmp/v4-l3-lifecycle');fs.mkdirSync(temp,{recursive:true});
  const previous={TEMP:process.env.TEMP,TMP:process.env.TMP};process.env.TEMP=temp;process.env.TMP=temp;
  const {openBrowser}=require('@remotion/renderer');
  let browser;
  try{
    browser=await openBrowser('chrome',{browserExecutable:lifecycleBrowser,logLevel:'error'});
    const page=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:null,onLog:()=>{}});
    await page.evaluate(code=>{new Function(code)();},result.outputFiles[0].text);
    const counts={};
    for(const kind of ['blinds','dot-zoom','zoom-through'])counts[kind]=await page.evaluate(kind=>window.checkMounts(kind),kind);
    return counts;
  }finally{
    if(browser)await browser.close({silent:true});
    for(const key of ['TEMP','TMP'])if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];
  }
}
