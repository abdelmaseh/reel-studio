import test from 'node:test';
import assert from 'node:assert/strict';
import {isEditableElement, resolveKey} from '../engine/src/review-editor/shell/keymap.ts';

const undo = {code: 'KeyZ', ctrlKey: true}, redo = {code: 'KeyZ', ctrlKey: true, shiftKey: true};

test('undo and redo reach the editor from a focused select, which has no text undo of its own', () => {
  assert.equal(isEditableElement({tagName: 'SELECT'}), true, 'a select still keeps its own arrow keys and typing');
  assert.deepEqual(resolveKey(undo, {editable: true, modal: false, select: true}), {type: 'undo'});
  assert.deepEqual(resolveKey(redo, {editable: true, modal: false, select: true}), {type: 'redo'});
  assert.equal(resolveKey({code: 'ArrowDown'}, {editable: true, modal: false, select: true}), null, 'arrows still change the option');
});

test('text fields keep their own undo, and a dialog blocks the shortcuts', () => {
  assert.equal(resolveKey(undo, {editable: true, modal: false}), null);
  assert.equal(resolveKey(undo, {editable: false, modal: true}), null);
  assert.equal(resolveKey(undo, {editable: true, modal: true, select: true}), null);
  assert.deepEqual(resolveKey(undo, {editable: false, modal: false}), {type: 'undo'});
});
