import test from 'node:test';
import assert from 'node:assert/strict';
import {deliveredStyle} from '../lib/delivered-style.mjs';

test('a delivered reel reports a known style id, an alias as its canonical id, and anything else as other', () => {
  assert.equal(deliveredStyle('PreparedEdit', {style: 'cartoon'}), 'cartoon');
  assert.equal(deliveredStyle('PreparedEdit', {style: 'split-canvas'}), 'section-deck');
  for (const [comp, edit] of [['PreparedEdit', {style: 'my-client'}], ['PreparedEdit', {style: 'toString'}], ['PreparedEdit', {}],
    ['PreparedEdit', undefined], ['CreativeKitGallery', {style: 'cartoon'}], ['PreparedEdit', {style: 42}]]) {
    assert.equal(deliveredStyle(comp, edit), 'other');
  }
});
