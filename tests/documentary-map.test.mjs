import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {project, polygonPath, routeAt, fitBounds, countryFocus} from '../engine/src/maps/project.ts';
import {buildMapData, readShape, readDbf} from '../scripts/build-map-data.mjs';
import installed from '../engine/src/maps/data/world.json' with {type:'json'};

const fixture = JSON.parse(readFileSync(new URL('./fixtures/documentary-map.json', import.meta.url)));
test('projection fits places, respects north and wraps a dateline route locally', () => {
  assert.deepEqual(project([0,0], [-10,-10,10,10], 200,200), {x:100,y:100});
  assert.deepEqual(project([10,10], [-10,-10,10,10], 200,200), {x:200,y:0});
  const bounds = fitBounds([[179,0],[-179,2]]);
  assert.ok(bounds[2]-bounds[0] < 10);
  const points = [[0,0],[10,0],[10,10]];
  assert.deepEqual(routeAt(points,0), [0,0]);
  assert.deepEqual(routeAt(points,.5), [10,0]);
  assert.deepEqual(routeAt(points,1), [10,10]);
  assert.equal(routeAt(points,.4).join(), routeAt(points,.4).join());
  assert.match(polygonPath(fixture.features[0].geometry.coordinates, [-2,-2,24,12], 800,600), /^M.*Z$/);
  assert.deepEqual(project([-180,0],[-180,-90,180,90],360,180),{x:0,y:90});
});
test('offline builder preserves Arabic, ring closure and holes; land-only mode drops all borders', () => {
  const data = buildMapData({land:fixture, tolerance:.1});
  assert.equal(data.mode,'no-borders');
  assert.equal(data.land.length,2);
  assert.deepEqual(data.countries,[]);
  assert.deepEqual(data.land[0][0][0], data.land[0][0].at(-1));
  const countries = structuredClone(fixture);
  countries.features[0].properties = {ADMIN:'Palestine', name_ar:'فلسطين'};
  assert.throws(()=>buildMapData({countries:fixture,pov:'unverified'}), /Palestine|verified/i);
  const borders = buildMapData({land:fixture,countries,pov:'arab-palestine',verifiedPov:true});
  assert.equal(borders.countries[0].name_ar,'فلسطين');
  assert.equal(borders.mode,'countries');
  assert.throws(()=>buildMapData({countries, pov:'arab-palestine'}), /verified/i);
  assert.throws(()=>buildMapData({land:{type:'FeatureCollection',features:[{geometry:{type:'Polygon',coordinates:[[[999,0],[0,0],[0,1],[999,0]]]}}]}}), /coordinate/i);
  const hole=structuredClone(fixture);hole.features[0].geometry.coordinates.push([[2,2],[2,4],[4,4],[4,2],[2,2]]);
  assert.equal(buildMapData({land:hole,tolerance:0}).land[0].length,2);
});
test('clean-room shapefile/DBF readers consume polygon and Arabic UTF-8 attributes offline', () => {
  const coords=[[0,0],[10,0],[10,10],[0,10],[0,0]];
  const shp=Buffer.alloc(108+44+4+coords.length*16);
  shp.writeInt32BE(9994,0); shp.writeInt32LE(1000,28); shp.writeInt32LE(5,32);
  shp.writeInt32BE(1,100); shp.writeInt32BE((shp.length-108)/2,104); shp.writeInt32LE(5,108);
  shp.writeInt32LE(1,144); shp.writeInt32LE(coords.length,148); shp.writeInt32LE(0,152);
  coords.forEach(([x,y],i)=>{shp.writeDoubleLE(x,156+i*16);shp.writeDoubleLE(y,164+i*16);});
  assert.deepEqual(readShape(shp)[0].coordinates,[coords]);
  const dbf=Buffer.alloc(65+41+1,32); dbf[0]=3;dbf.writeUInt32LE(1,4);dbf.writeUInt16LE(65,8);dbf.writeUInt16LE(41,10);
  dbf.fill(0,32,64);dbf.write('name_ar',32);dbf[43]=67;dbf[48]=40;dbf[64]=13;dbf.write('فلسطين',66,'utf8');dbf[106]=26;
  assert.equal(readDbf(dbf)[0].name_ar,'فلسطين');
});
test('installed real POV contains a separate Palestine state and Arabic names', {skip:installed.mode!=='countries'?'Natural Earth download pending; no verified POV installed':false}, () => {
  assert.ok(installed.countries.some(c=>c.name_ar==='فلسطين'));
  assert.ok(installed.countries.every(c=>c.name_ar.trim()&&c.polygons.length));
});
test('a country focus labels its largest part and zooms to its nearby parts only', () => {
  const square=(x,y,s)=>[[[x,y],[x+s,y],[x+s,y+s],[x,y+s],[x,y]]];
  const focus=countryFocus([square(0,0,1),square(4,0,4),square(100,50,1)]);
  assert.deepEqual(focus.anchor,[6,2],'the centroid of the largest part, not the gap between parts');
  assert.ok(focus.points.some(p=>p[0]===0)&&!focus.points.some(p=>p[0]>=100),'a nearby part is kept, a far territory is left out');
  assert.throws(()=>countryFocus([]),/polygon/);
});
test('installed real POV labels Palestine on the West Bank, not between Gaza and the West Bank', {skip:installed.mode!=='countries'?'no verified POV installed':false}, () => {
  const palestine=installed.countries.find(c=>c.name_ar==='فلسطين');
  const [lon,lat]=countryFocus(palestine.polygons).anchor;
  assert.ok(lon>34.9&&lon<35.6&&lat>31.3&&lat<32.6,`${lon},${lat}`);
  assert.ok(palestine.polygons.length>=2,'Gaza and the West Bank are both part of it');
});
