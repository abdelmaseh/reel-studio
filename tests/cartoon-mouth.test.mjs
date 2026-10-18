import test from 'node:test';
import assert from 'node:assert/strict';
import {MOUTH_RECIPE_VERSION, buildMouthTable, dbPerOutputFrame, needsMouth, smoothOpen, verifyPreparedMouth} from '../scripts/lib/mouth-table.mjs';

// Four seconds of 16 kHz audio: silence, a 2 Hz-modulated 200 Hz tone for two seconds, silence.
const tone = (gain = 0.3, sampleRate = 16000, seconds = 4) => {
  const samples = new Float32Array(sampleRate * seconds);
  for (let i = 0; i < samples.length; i += 1) {
    const t = i / sampleRate;
    if (t >= 1 && t < 3) samples[i] = gain * (0.55 + 0.45 * Math.sin(2 * Math.PI * 2 * (t - 1))) * Math.sin(2 * Math.PI * 200 * t);
  }
  return {samples, sampleRate};
};
const input = (gain) => ({...tone(gain), segments: [{fromFrame: 0, toFrame: 120}], sourceFps: 30, fps: 30});

test('one dB value per output frame, mapped through the kept segments', () => {
  const db = dbPerOutputFrame(input(0.3));
  assert.equal(db.length, 120);
  assert.equal(db[15], -120, 'digital silence');
  assert.ok(db[60] > -30 && db[60] < -5, `tone frame ${db[60]}`);
  const cut = dbPerOutputFrame({...input(0.3), segments: [{fromFrame: 30, toFrame: 90}]});
  assert.equal(cut.length, 60);
  assert.ok(cut[0] > -40, 'the first output frame is the first kept source frame');
  const twoParts = dbPerOutputFrame({...input(0.3), segments: [{fromFrame: 0, toFrame: 10}, {fromFrame: 40, toFrame: 50}]});
  assert.equal(twoParts.length, 20);
  assert.equal(twoParts[5], -120);
  assert.ok(twoParts[15] > -40, 'the second segment starts inside the tone');
});

test('calibration anchors on the recording itself, so a gain change leaves the table unchanged', () => {
  const a = buildMouthTable(input(0.3)), b = buildMouthTable(input(0.05));
  assert.equal(a.values.length, 120);
  assert.ok(a.values.slice(0, 30).every((v) => v === 0), 'closed in silence');
  assert.ok(a.values.slice(35, 85).filter((v) => v > 0.3).length > 20, 'open during the tone');
  assert.ok(a.values.every((v, i) => Math.abs(v - b.values[i]) <= 0.02), 'gain-invariant');
  assert.ok(a.calibration.hiDb > a.calibration.loDb + 11.9);
  assert.equal(typeof a.calibration.openShare, 'number');
  assert.equal(buildMouthTable({...input(0.3), samples: new Float32Array(64000)}).values.every((v) => v === 0), true, 'a silent recording keeps the mouth closed');
});

test('smoothing uses time constants, so 50 fps and 30 fps tables agree in seconds', () => {
  const step30 = Array.from({length: 30}, (_, i) => (i >= 10 ? 1 : 0)), step50 = Array.from({length: 50}, (_, i) => (i >= 17 ? 1 : 0));
  const s30 = smoothOpen(step30, 30), s50 = smoothOpen(step50, 50);
  assert.ok(Math.abs(s30[13] - s50[22]) < 0.08, `0.1 s after the step: ${s30[13]} vs ${s50[22]}`);
  assert.ok(s30[10] > 0.85, 'fast attack');
  const fall30 = smoothOpen(Array.from({length: 30}, (_, i) => (i < 10 ? 1 : 0)), 30);
  assert.ok(fall30[10] > 0.4, `slower release: one frame after the drop the mouth is still half open (${fall30[10]}), where the attack would be within 0.1 of closed`);
  assert.ok(fall30[12] < 0.3 && fall30[16] < 0.02, 'and it closes within a few frames');
});

test('the verifier refuses a stale or missing table only when a cartoon scene is in the edit', async () => {
  const edit = {source: {sha256: 'a'.repeat(64), fps: 30}, segments: [{fromFrame: 0, toFrame: 120}], scenes: [{family: 'cartoon'}]};
  assert.equal(needsMouth(edit), true);
  assert.equal(needsMouth({...edit, scenes: [{family: 'intro'}]}), false);
  await assert.doesNotReject(verifyPreparedMouth({edit: {...edit, scenes: [{family: 'intro'}]}}));
  await assert.rejects(verifyPreparedMouth({edit}), /mouth/);
  const table = {...buildMouthTable(input(0.3)), version: MOUTH_RECIPE_VERSION, source: edit.source.sha256, segments: edit.segments, fps: 30};
  await assert.doesNotReject(verifyPreparedMouth({edit, mouth: table}));
  await assert.rejects(verifyPreparedMouth({edit: {...edit, segments: [{fromFrame: 10, toFrame: 120}]}, mouth: table}), /stale|again/);
  await assert.rejects(verifyPreparedMouth({edit, mouth: {...table, values: table.values.slice(1)}}), /stale|again/);
});

import {promises as fs, existsSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {SAMPLE_RATE, encodeWav} from '../scripts/sfx.mjs';
import {attachPreparedMouth, buildPreparedMouth} from '../scripts/lib/mouth-table.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

test('prepare measures a real source file into prepared/mouth.json and removes its scratch audio', async () => {
  const id = `cartoon-mouth-${randomUUID().slice(0, 8)}`, dir = path.join(ROOT, 'Projects', id);
  await fs.mkdir(dir, {recursive: true});
  try {
    const n = SAMPLE_RATE * 4, L = new Float32Array(n);
    for (let i = 0; i < n; i += 1) { const t = i / SAMPLE_RATE; if (t >= 1 && t < 3) L[i] = 0.3 * (0.55 + 0.45 * Math.sin(2 * Math.PI * 2 * (t - 1))) * Math.sin(2 * Math.PI * 200 * t); }
    await fs.writeFile(path.join(dir, 'source.wav'), encodeWav(L, L));
    const edit = {id, source: {path: `Projects/${id}/source.wav`, sha256: 'c'.repeat(64), fps: 30}, segments: [{fromFrame: 0, toFrame: 120}], scenes: [{family: 'cartoon'}]};
    const lines = [];
    const built = await buildPreparedMouth(edit, {base: `Projects/${id}/prepared`, log: (line) => lines.push(line)});
    assert.equal(built.table.values.length, 120);
    assert.ok(built.table.values.slice(0, 25).every((v) => v === 0) && built.table.values.slice(35, 85).some((v) => v > 0.5));
    assert.equal(built.summary.warning, null);
    assert.ok(existsSync(path.join(dir, 'prepared', 'mouth.json')));
    assert.equal(existsSync(path.join(dir, 'prepared', 'mouth-16k.wav')), false, 'the scratch audio is removed');
    await assert.doesNotReject(verifyPreparedMouth({edit, mouth: JSON.parse(await fs.readFile(path.join(dir, 'prepared', 'mouth.json'), 'utf8'))}));
    assert.equal(await buildPreparedMouth({...edit, scenes: [{family: 'intro'}]}, {base: `Projects/${id}/prepared`}), null, 'no cartoon scene, no table');
    // The step after prepareEditProject: the table joins props.json and the receipt; an unchanged edit reuses it.
    const propsFile = `Projects/${id}/prepared/props.json`;
    await fs.writeFile(path.join(ROOT, propsFile), JSON.stringify({edit, plate: null}));
    await fs.writeFile(path.join(dir, 'prepared', 'preparation.json'), JSON.stringify({ok: true, outputs: []}));
    const attached = await attachPreparedMouth({ok: true, propsFile, outputs: []});
    assert.equal(attached.mouth.frames, 120);
    const props = JSON.parse(await fs.readFile(path.join(ROOT, propsFile), 'utf8'));
    assert.equal(props.mouth.values.length, 120);
    await assert.doesNotReject(verifyPreparedMouth(props));
    const receipt = JSON.parse(await fs.readFile(path.join(dir, 'prepared', 'preparation.json'), 'utf8'));
    assert.equal(receipt.mouth.frames, 120);
    assert.ok(receipt.outputs.some((o) => o.path.endsWith('mouth.json')) && receipt.outputs.some((o) => o.path === propsFile));
    const before = (await fs.stat(path.join(dir, 'prepared', 'mouth.json'))).mtimeMs;
    await attachPreparedMouth({ok: true, propsFile, outputs: []});
    assert.equal((await fs.stat(path.join(dir, 'prepared', 'mouth.json'))).mtimeMs, before, 'an unchanged edit reuses its table');
    await fs.writeFile(path.join(ROOT, propsFile), JSON.stringify({edit: {...edit, scenes: [{family: 'intro'}]}}));
    const passthrough = {ok: true, propsFile};
    assert.equal(await attachPreparedMouth(passthrough), passthrough, 'an edit without a cartoon scene passes through untouched');
  } finally {
    await fs.rm(dir, {recursive: true, force: true});
  }
});
