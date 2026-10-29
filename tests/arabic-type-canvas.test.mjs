import test from 'node:test';
import assert from 'node:assert/strict';
import {segmentBlobs,kashidaBar} from '../engine/src/arabic/segment.ts';
import {kashidaSlots,stretchWord} from '../engine/src/arabic/kashida.ts';
import {rubaaFix} from '../engine/src/arabic/shaping-fixes.ts';
const image=(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)});
const rect=(im,x,y,w,h)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)im.data[(yy*im.width+xx)*4+3]=255;};
test('bitmap connected components preserve joined bodies and detached dots with exact pixel coverage',()=>{
 const im=image(150,80);rect(im,10,40,100,20);rect(im,25,20,6,6);rect(im,65,20,6,6);
 const blobs=segmentBlobs(im,100);assert.equal(blobs.filter(b=>b.kind==='body').length,1);assert.equal(blobs.filter(b=>b.kind==='dot').length,2);
 assert.equal(blobs.reduce((n,b)=>n+b.area,0),2072);
 for(const b of blobs)assert.equal(b.mask.data.filter((v,i)=>i%4===3&&v===255).length,b.area);
});
test('kashida bar stops when the bottom drops even when the top stays level',()=>{
 const im=image(150,80);rect(im,10,30,80,5);rect(im,90,30,30,25);
 const bar=kashidaBar(im,100);assert.ok(bar);assert.equal(bar.x0,10);assert.equal(bar.x1,90);assert.equal(bar.bottom,35);
});
test('Arabic core uses legal joined slots, skips harakat, lam-alef and nonjoining words',()=>{
 for(const value of ['ورد','دار','في','AI','2026','لا'])assert.equal(stretchWord(value,4),value);
 const value=stretchWord('جميل',14);assert.equal([...value].filter(c=>c==='ـ').length,14);assert.ok(kashidaSlots('جميل').length);
 assert.equal(stretchWord('كَتَبَ',1),'كَتَـبَ');assert.equal(rubaaFix('قاعدة'),'قاعد\u200Dة');
});
