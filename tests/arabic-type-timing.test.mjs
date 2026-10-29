import test from 'node:test';
import assert from 'node:assert/strict';
import {ARABIC_TYPE_MOVES} from '../engine/src/arabic-type/schema.ts';
import {arabicTypeIntroSeconds,arabicTypeMinimumSeconds, validateArabicTypeTiming} from '../engine/src/arabic-type/timing.ts';

test('each intro finishes inside the scene at 30, 50 and 60 fps', () => {
  for (const move of ARABIC_TYPE_MOVES) for (const fps of [30,50,60]) {
    const data={move,text:'فكرة واضحة',to:'خطوة عملية'};
    const n=Math.ceil(arabicTypeMinimumSeconds(data)*fps);
    const scene={id:move,data,durationInFrames:n};
    assert.deepEqual(validateArabicTypeTiming(scene,fps),[],move);
    assert.equal(validateArabicTypeTiming({...scene,durationInFrames:n-1},fps).length,1,move);
  }
});
test('staggered text duration grows with authored text instead of clipping the last reveal', () => {
  assert.ok(arabicTypeIntroSeconds({move:'decrypt',text:'فكرة واضحة'}) > arabicTypeIntroSeconds({move:'decrypt',text:'فكرة'}));
  assert.ok(arabicTypeIntroSeconds({move:'unblur',text:'كل كلمة ليها معنى'}) > arabicTypeIntroSeconds({move:'unblur',text:'فكرة'}));
});

test('long snap and tile phrases cannot finish before their last staggered raster element',()=>{
 const text='ك'.repeat(40);
 assert.ok(arabicTypeIntroSeconds({move:'letters-snap',text}) >= .06*39+.35+.25);
 assert.ok(arabicTypeIntroSeconds({move:'kufi-tiles',text}) >= 4);
});

test('short scenes reserve a readable hold and finish their exit after the intro',()=>{
 const data={move:'unblur',text:'فكرة'};
 assert.equal(validateArabicTypeTiming({id:'short',data,durationInFrames:23},30).length,1);
});
