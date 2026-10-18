import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

// The prepared plate is keyed by a hash of these five files (scripts/lib/edit-project.mjs, prepareEditProject). In 2.6
// only engine/src/prepared-edit/schema.ts may change among them (the new optional `digits` key), which re-encodes each
// project's plate once. The other three are pinned here by the sha-256 of their text with LF line endings; ffmpeg is
// pinned through its entry in versions.lock.json.
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sha = (text) => createHash('sha256').update(text).digest('hex');

const PINNED = {
  'scripts/lib/edit-project.mjs': '2628d0cf57e678c52c9adfa43f11f4bc4dfce2ad34d961c3a81b10b273001221',
  'scripts/lib/prepared-media.mjs': 'd098a94324822741a7dfaf082d39eea7faffc019518a1cdf0dfbdc9e3b0df02c',
  'engine/src/prepared-edit/timeline.ts': '9c045391cb0c256b4e35f79943dab8f797ed2cfd9ccb419740c7e3734bdada8c',
};

test('three plate-key files and ffmpeg are unchanged from 2.5', () => {
  for (const [file, hash] of Object.entries(PINNED)) assert.equal(sha(read(file)), hash, `${file} is a plate-key input: do not change it in 2.6`);
  const lock = JSON.parse(read('versions.lock.json'));
  assert.equal(lock.ffmpeg.sha256, '0fff188997a499b5382e0f66e845d4556c48c54f0113ebed4853d556dbdd7059');
});

test('the plate key still reads exactly these five files', () => {
  assert.ok(read('scripts/lib/edit-project.mjs').includes(
    "['scripts/lib/edit-project.mjs','scripts/lib/prepared-media.mjs','engine/src/prepared-edit/schema.ts','engine/src/prepared-edit/timeline.ts','Tools/bin/ffmpeg.exe']"));
});
