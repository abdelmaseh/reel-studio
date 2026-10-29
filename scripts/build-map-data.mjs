// Offline, clean-room Natural Earth adapter. Input: unpacked SHP+DBF or GeoJSON, never a network URL.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

export function readDbf(bytes) {
  const count=bytes.readUInt32LE(4), header=bytes.readUInt16LE(8), width=bytes.readUInt16LE(10);
  if(header<33 || !width || header+count*width>bytes.length)throw new Error('Invalid DBF header or truncated records');
  const fields=[];let offset=1;
  for(let at=32;at<header && bytes[at]!==13;at+=32){
    const name=bytes.subarray(at,at+11).toString('ascii').replace(/\0.*$/,'');const length=bytes[at+16];
    fields.push({name,length,offset});offset+=length;
  }
  if(offset>width)throw new Error('DBF fields exceed record size');
  return Array.from({length:count},(_,i)=>{
    const start=header+i*width;if(bytes[start]===42)return null;
    return Object.fromEntries(fields.map(f=>[f.name,bytes.subarray(start+f.offset,start+f.offset+f.length).toString('utf8').replace(/\0/g,'').trim()]));
  });
}
const inside=(point,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1]) && point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const area=ring=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0));
function polygonsOf(rings){
  // Containment, rather than winding, handles holes and disjoint islands in both SHP and GeoJSON.
  const sorted=rings.map(r=>({r,a:area(r),depth:0,parent:null})).sort((a,b)=>b.a-a.a);const polygons=[];
  for(let i=0;i<sorted.length;i++){
    const item=sorted[i];item.parent=sorted.slice(0,i).filter(p=>inside(item.r[0],p.r)).at(-1)??null;item.depth=item.parent?item.parent.depth+1:0;
    if(item.depth%2===0){item.polygon=[item.r];polygons.push(item.polygon);}else{let parent=item.parent;while(parent.depth%2)parent=parent.parent;parent.polygon.push(item.r);}
  }
  return polygons;
}
export function readShape(bytes){
  if(bytes.length<100 || bytes.readInt32BE(0)!==9994 || bytes.readInt32LE(28)!==1000)throw new Error('Invalid SHP header');
  const records=[];
  for(let at=100;at<bytes.length;){
    if(at+12>bytes.length)throw new Error('Truncated SHP record');
    const size=bytes.readInt32BE(at+4)*2,start=at+8,end=start+size;
    if(size<4 || end>bytes.length)throw new Error('Truncated SHP content');
    const kind=bytes.readInt32LE(start);let geometry=null;
    if(kind===1){if(size<20)throw new Error('Truncated SHP point');geometry={type:'Point',coordinates:[bytes.readDoubleLE(start+4),bytes.readDoubleLE(start+12)]};}
    else if(kind===5 || kind===15 || kind===25){
      if(size<44)throw new Error('Truncated SHP polygon');
      const parts=bytes.readInt32LE(start+36),points=bytes.readInt32LE(start+40),base=start+44+parts*4;
      if(parts<1 || points<4 || base+points*16>end)throw new Error('Invalid SHP polygon parts');
      const all=Array.from({length:points},(_,i)=>[bytes.readDoubleLE(base+i*16),bytes.readDoubleLE(base+i*16+8)]);
      const starts=Array.from({length:parts},(_,i)=>bytes.readInt32LE(start+44+i*4));
      if(starts[0]!==0 || starts.some((p,i)=>p<0 || p>=points || i>0 && p<=starts[i-1]))throw new Error('Invalid SHP ring offsets');
      const polygons=polygonsOf(starts.map((p,i)=>all.slice(p,starts[i+1]??points)));
      geometry=polygons.length===1?{type:'Polygon',coordinates:polygons[0]}:{type:'MultiPolygon',coordinates:polygons};
    }else if(kind!==0)throw new Error(`Unsupported SHP type ${kind}; supply polygon land/countries or point places`);
    records.push(geometry);at=end;
  }
  return records;
}
function coordinate(p){if(!Array.isArray(p) || p.length<2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0])>180 || Math.abs(p[1])>90)throw new Error('Invalid geographic coordinate');return [p[0],p[1]];}
const distance=(p,a,b)=>{const x=b[0]-a[0],y=b[1]-a[1];const t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y||1)));return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);};
function simplifyLine(points,tolerance){
  const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]];
  while(stack.length){const [a,b]=stack.pop();let far=tolerance,idx=-1;for(let i=a+1;i<b;i++){const d=distance(points[i],points[a],points[b]);if(d>far){far=d;idx=i;}}if(idx>=0){keep.add(idx);stack.push([a,idx],[idx,b]);}}
  return [...keep].sort((a,b)=>a-b).map(i=>points[i]);
}
function ring(input,tolerance){
  const points=input.map(coordinate);
  if(points.length<4 || points[0].join()!==points.at(-1).join())throw new Error('A polygon ring must be closed with at least four points');
  // Split at the farthest vertex: a closed ring must not simplify to a single segment.
  const open=points.slice(0,-1);let far=1;for(let i=2;i<open.length;i++)if(Math.hypot(open[i][0]-open[0][0],open[i][1]-open[0][1])>Math.hypot(open[far][0]-open[0][0],open[far][1]-open[0][1]))far=i;
  const result=[...simplifyLine(open.slice(0,far+1),tolerance),...simplifyLine([...open.slice(far),open[0]],tolerance).slice(1)];
  return (result.length>=4?result:points).map(p=>p.map(v=>Number(v.toFixed(4))));
}
function features(input){if(!input)return [];if(input.type!=='FeatureCollection' || !Array.isArray(input.features))throw new Error('Expected a GeoJSON FeatureCollection');return input.features.filter(f=>f.geometry);}
function polygons(geometry,tolerance){const raw=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:null;if(!raw)throw new Error('Expected Polygon or MultiPolygon');return raw.map(p=>p.map(r=>ring(r,tolerance)));}
export function buildMapData({land,countries,places,tolerance=.06,pov,verifiedPov=false,provenance='Local offline input; verify dataset provenance before release'}={}){
  if(!Number.isFinite(tolerance) || tolerance<0 || tolerance>1)throw new Error('tolerance must be 0..1 degrees');
  const borders=features(countries);
  if(borders.length && (pov!=='arab-palestine' || !verifiedPov))throw new Error('Country borders need the verified arab-palestine POV declaration');
  if(borders.length && !borders.some(f=>f.properties?.name_ar==='فلسطين' || /^(Palestine|State of Palestine)$/i.test(f.properties?.ADMIN??'')))throw new Error('The POV must contain Palestine as a separate state feature');
  const names=new Set();
  const countryData=borders.map((f,i)=>{const name=f.properties?.name_ar??f.properties?.NAME_AR;if(typeof name!=='string' || !name.trim())throw new Error('Country is missing name_ar; supply a verified Arabic name, never invent one');const id=String(f.properties?.ADM0_A3??f.id??i);if(names.has(id))throw new Error('Duplicate country id');names.add(id);return {id,name_ar:name,polygons:polygons(f.geometry,tolerance)};});
  return {version:1,mode:borders.length?'countries':'no-borders',land:features(land).flatMap(f=>polygons(f.geometry,tolerance)),countries:countryData,
    places:features(places).map(f=>{if(f.geometry.type!=='Point')throw new Error('Places need point geometry');const [lon,lat]=coordinate(f.geometry.coordinates);const name=f.properties?.name_ar??f.properties?.NAME_AR;if(typeof name!=='string' || !name.trim())throw new Error('Place is missing name_ar');return {name_ar:name,lon,lat};}),provenance};
}
async function readGeo(file){
  if(!file)return undefined;if(/^\w+:\/\//.test(file))throw new Error('Offline files only');
  const bytes=await readFile(file);if(path.extname(file).toLowerCase()!=='.shp')return JSON.parse(bytes.toString('utf8'));
  const dbf=readDbf(await readFile(file.replace(/\.shp$/i,'.dbf'))),shapes=readShape(bytes);
  if(dbf.length!==shapes.length)throw new Error('SHP/DBF record counts differ');
  return {type:'FeatureCollection',features:shapes.flatMap((geometry,i)=>geometry && dbf[i]?[{type:'Feature',properties:dbf[i],geometry}]:[])};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const {values:v}=parseArgs({options:{land:{type:'string'},countries:{type:'string'},places:{type:'string'},out:{type:'string'},tolerance:{type:'string'},pov:{type:'string'},'verified-pov':{type:'boolean'},provenance:{type:'string'}}});
    if(!v.out || !v.land && !v.countries)throw new Error('Usage: node scripts/build-map-data.mjs --land local/land.shp [--countries local/pov.shp --pov arab-palestine --verified-pov] [--places local/places.shp] --out engine/src/maps/data/world.json');
    const data=buildMapData({land:await readGeo(v.land),countries:await readGeo(v.countries),places:await readGeo(v.places),tolerance:v.tolerance===undefined?.06:Number(v.tolerance),pov:v.pov,verifiedPov:v['verified-pov'],provenance:v.provenance});
    const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),out=path.resolve(v.out);const relative=path.relative(root,out);if(relative.startsWith('..') || path.isAbsolute(relative))throw new Error('Output must stay in this workspace');
    await mkdir(path.dirname(out),{recursive:true});await writeFile(out,JSON.stringify(data)+'\n','utf8');console.log(JSON.stringify({ok:true,out,countries:data.countries.length,places:data.places.length,mode:data.mode}));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
