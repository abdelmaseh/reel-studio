import test from 'node:test';
import assert from 'node:assert/strict';
import {awaitTypeFont,resolveArabicFont} from '../engine/src/arabic-type/font-ready.ts';
test('cold fonts are neither loaded nor measured before studio face registration',async()=>{
 let registered=false,advance;const events=[];
 const done=awaitTypeFont('900 64px "Cairo"','فكرة',{studioReady:()=>registered,
  nextFrame:()=>new Promise(resolve=>{advance=resolve;}),load:async()=>{events.push('load');},check:()=>{events.push('check');return true;}});
 await Promise.resolve();assert.deepEqual(events,[]);registered=true;advance();await done;assert.deepEqual(events,['load','check']);
});
test('a selected face that does not load fails instead of allowing fallback measurements',async()=>{
 await assert.rejects(awaitTypeFont('900 64px "Cairo"','فكرة',{studioReady:()=>true,nextFrame:async()=>{},load:async()=>{},check:()=>false}),/not loaded/);
});
test('explicit scene font, saved font and move defaults have a stable precedence',()=>{
 const available=['Cairo','Tajawal','Noto Naskh Arabic','Noto Kufi Arabic'];
 assert.equal(resolveArabicFont(undefined,'Tajawal','pen-write',available),'Tajawal');
 assert.equal(resolveArabicFont(undefined,'Cairo','pen-write',available),'Cairo');
 assert.equal(resolveArabicFont('Noto Kufi Arabic','Tajawal','pen-write',available),'Noto Kufi Arabic');
 assert.equal(resolveArabicFont(undefined,null,'pen-write',available),'Noto Naskh Arabic');
 assert.equal(resolveArabicFont('Lalezar',null,'decrypt',available),'Cairo');
});
