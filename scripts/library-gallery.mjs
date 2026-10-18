import http from 'node:http';
import path from 'node:path';
import {promises as fs,createReadStream} from 'node:fs';
import {checkedPreviewPath} from './lib/library-preview-runner.mjs';
import {collectLibraryInventory} from './lib/library-inventory.mjs';
import {collectLibraryEditorial} from './lib/library-selection.mjs';
import {renderLibraryGallery} from './lib/library-gallery.mjs';
import {galleryViewData} from './lib/library-gallery-copy.mjs';
import {loadGalleryBatches,mergeGalleryBatches,resolveGalleryFile} from './lib/library-gallery-batches.mjs';

try{
  const outputs=process.argv.slice(2);
  if(!outputs.length)throw new Error('Usage: node scripts/library-gallery.mjs Projects/<slug> [Projects/<additional-slug> ...]');
  const port=Number(process.env.REEL_STUDIO_LIBRARY_PORT??0);
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('REEL_STUDIO_LIBRARY_PORT must be a local port from 0 to 65535.');
  const registered=await loadGalleryBatches(outputs);
  const server=http.createServer(async(req,res)=>{
    try{
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
      let name=decodeURIComponent((req.url??'/').split('?')[0]);if(name==='/')name='/index.html';
      if(name==='/index.html'){
        const batches=await loadGalleryBatches(outputs),gaps=JSON.parse(await fs.readFile(checkedPreviewPath(batches.at(-1).root,path.join(batches.at(-1).root,'gaps.json')),'utf8'));
        const inventory=await collectLibraryInventory(),editorial=await collectLibraryEditorial({inventory});
        const html=renderLibraryGallery({...galleryViewData(mergeGalleryBatches(batches),gaps,inventory,editorial),title:'مكتبة الموشن — المعاينات وأولويات التوسّع'});
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Length':String(Buffer.byteLength(html,'utf8'))});
        res.end(req.method==='HEAD'?undefined:html);return;
      }
      const route=resolveGalleryFile(registered,name);if(!route){res.writeHead(404);res.end();return;}
      const file=route.file,stat=await fs.stat(file);
      if(!stat.isFile()){res.writeHead(404);res.end();return;}
      const types={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.mp4':'video/mp4','.jpg':'image/jpeg','.png':'image/png'};
      const headers={'Content-Type':types[path.extname(file)],'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Accept-Ranges':'bytes'};
      let start=0,end=stat.size-1,status=200;
      if(req.headers.range){const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!match){res.writeHead(416);res.end();return;}
        start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;
        if(start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}
        status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
      }
      headers['Content-Length']=String(end-start+1);res.writeHead(status,headers);
      if(req.method==='HEAD')res.end();else createReadStream(file,{start,end}).on('error',()=>res.destroy()).pipe(res);
    }catch(error){res.writeHead(error.code==='ENOENT'?404:400);res.end('File is unavailable.');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  console.log(JSON.stringify({url:`http://127.0.0.1:${server.address().port}/`,gallery:outputs[0],batches:outputs,mode:'read-only'}));
  process.on('SIGINT',()=>server.close(()=>process.exit(0)));
}catch(error){console.error(`library-gallery: ${error.message}`);process.exitCode=1;}
