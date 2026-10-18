import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {planEditorBrief} from '../scripts/lib/editor-director.mjs';
import {editHash, promoteEdit, untouchedSincePlan} from '../scripts/lib/edit-safety.mjs';
import {profileToBrief} from '../scripts/lib/branding.mjs';
import {ROOT, run} from '../scripts/lib/media.mjs';
import {digest} from '../scripts/lib/job-paths.mjs';

const profile = JSON.parse(await fs.readFile(new URL('../PROFILE.example.json', import.meta.url), 'utf8'));
const words = [{text: 'كلام', startMs: 0, endMs: 400, confidence: 1}, {text: 'المصدر', startMs: 450, endMs: 900, confidence: 0.4}];

test('manual presenter framing is protected like every other edit', () => {
  const planned = {id: 'x', scenes: [{id: 'a'}], footage: {defaultLayout: 'presenter'}};
  const record = {editHashVersion: 2, editHash: editHash(planned), manifestHash: digest(planned)};
  assert.equal(untouchedSincePlan({...planned, footage: {defaultLayout: 'split'}}, record), false);
  assert.equal(untouchedSincePlan({...planned, scenes: [{id: 'b'}]}, record), false);
  assert.equal(untouchedSincePlan(planned, null), null);
});

test('legacy hashes that excluded footage never authorize discarding an unknown framing change', () => {
  const planned = {id: 'x', scenes: [], footage: {defaultLayout: 'presenter'}};
  const record = {editHash: digest({id: 'x', scenes: []}), manifestHash: digest(planned)};
  assert.equal(untouchedSincePlan(planned, record), true);
  assert.equal(untouchedSincePlan({...planned, footage: {defaultLayout: 'split'}}, record), null);
});

test('rebuilding refuses to drop editor changes, keeps corrected words on request, and promote delivers the reviewed edit', async () => {
  const id = `edit-safety-${randomUUID()}`, relative = `Projects/${id}`, directory = path.resolve(ROOT, relative);
  await fs.mkdir(directory, {recursive: true});
  try {
    const sourceFile = `${relative}/source.mp4`, transcript = `${relative}/words.json`, briefFile = `${relative}/brief.json`, editFile = `${relative}/edit.json`;
    await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=gray:s=64x96:r=30:d=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', path.resolve(ROOT, sourceFile)]);
    await fs.writeFile(path.resolve(ROOT, transcript), JSON.stringify(words));
    const brief = {version: 1, id, source: sourceFile, transcript, ...profileToBrief(profile), purpose: 'explainer', tone: 'calm',
      beats: [{id: 'opening', fromSec: 0, toSec: 2, intent: 'intro', data: {kicker: 'مثال', title: 'فكرة للمراجعة', subtitle: 'شرح قصير', caption: 'مثال'}}]};
    await fs.writeFile(path.resolve(ROOT, briefFile), JSON.stringify(brief));
    await planEditorBrief(briefFile);
    const readEdit = async () => JSON.parse(await fs.readFile(path.resolve(ROOT, editFile), 'utf8'));

    // Untouched since the plan: rebuilding is allowed and makes no backup.
    assert.equal((await planEditorBrief(briefFile, {replace: true})).backup, null);

    // The creator corrects a word and retitles the opening in the editor.
    const edited = await readEdit();
    edited.captions.words[1].text = 'الأصلي';
    edited.scenes[0].data.title = 'عنوان من المحرر';
    await fs.writeFile(path.resolve(ROOT, editFile), JSON.stringify(edited, null, 2));
    await assert.rejects(planEditorBrief(briefFile, {replace: true}), /has changes the last plan did not write/);
    assert.equal((await readEdit()).captions.words[1].text, 'الأصلي', 'a refused rebuild changes nothing');

    const editedBytes = await fs.readFile(path.resolve(ROOT, editFile), 'utf8');
    await assert.rejects(planEditorBrief(briefFile, {replace: true, keepCaptions: true}), /has changes the last plan did not write/);
    assert.equal(await fs.readFile(path.resolve(ROOT, editFile), 'utf8'), editedBytes, 'caption-only permission must not discard a scene edit');

    // Explicit discard authorizes the scene reset; keep-captions still preserves the corrected words.
    const kept = await planEditorBrief(briefFile, {replace: true, keepCaptions: true, discardEdits: true});
    assert.match(kept.backup, /edit-history\/.+~قبل إعادة التخطيط\.json$/);
    const backedUp = JSON.parse(await fs.readFile(path.resolve(ROOT, kept.backup), 'utf8'));
    assert.equal(backedUp.scenes[0].data.title, 'عنوان من المحرر', 'the History copy holds the editor version');
    assert.equal((await readEdit()).captions.words[1].text, 'الأصلي');
    assert.equal((await readEdit()).scenes[0].data.title, 'فكرة للمراجعة');
    await assert.rejects(planEditorBrief(briefFile, {keepCaptions: true}), /only work together with --replace/);

    // Draft captions need a reviewer name before delivery; promote keeps the edit and marks it for delivery.
    await assert.rejects(promoteEdit(editFile), /still a draft/);
    const promoted = await promoteEdit(editFile, {reviewedBy: 'Example reviewer'});
    assert.equal(promoted.purpose, 'delivery');
    const delivered = await readEdit();
    assert.equal(delivered.purpose, 'delivery');
    assert.equal(delivered.captions.status, 'reviewed');
    assert.equal(delivered.captions.reviewer, 'Example reviewer');
    assert.equal(delivered.captions.words[1].text, 'الأصلي');
    assert.ok(promoted.backup);
  } finally {
    await fs.rm(directory, {recursive: true, force: true});
  }
});

test('caption-only rebuilding preserves review and presentation and refuses other manual changes', async () => {
  const id = `edit-safety-${randomUUID()}`, relative = `Projects/${id}`, directory = path.resolve(ROOT, relative);
  await fs.mkdir(directory, {recursive: true});
  try {
    const source = `${relative}/source.mp4`, transcript = `${relative}/words.json`, briefFile = `${relative}/brief.json`, editFile = `${relative}/edit.json`;
    await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=gray:s=64x96:r=30:d=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', path.resolve(ROOT, source)]);
    await fs.writeFile(path.resolve(ROOT, transcript), JSON.stringify(words));
    const brief = {version: 1, id, source, transcript, ...profileToBrief(profile), purpose: 'explainer', tone: 'calm',
      beats: [{id: 'opening', fromSec: 0, toSec: 2, intent: 'intro', data: {kicker: 'Example', title: 'A useful idea', subtitle: 'Short explanation', caption: 'Example'}}]};
    await fs.writeFile(path.resolve(ROOT, briefFile), JSON.stringify(brief));
    await planEditorBrief(briefFile);
    const readEdit = async () => JSON.parse(await fs.readFile(path.resolve(ROOT, editFile), 'utf8'));
    const edited = await readEdit();
    edited.captions.words[1].text = 'الأصلي';
    edited.captions.status = 'reviewed';
    edited.captions.reviewer = 'Example reviewer';
    edited.captions.visible = false;
    await fs.writeFile(path.resolve(ROOT, editFile), JSON.stringify(edited, null, 2));
    brief.beats[0].data.title = 'An explicitly revised plan';
    await fs.writeFile(path.resolve(ROOT, briefFile), JSON.stringify(brief));
    const kept = await planEditorBrief(briefFile, {replace: true, keepCaptions: true});
    assert.deepEqual((await readEdit()).captions, edited.captions);
    assert.ok(kept.backup, 'a changed replaced version is always recoverable');

    for (const change of [
      m => { m.footage = {defaultLayout: 'presenter', full: {windowTop: 0, windowHeight: 1920, videoWidth: 1080, videoLeft: 0, videoTop: 0}, split: {windowTop: 900, windowHeight: 1020, videoWidth: 1080, videoLeft: 0, videoTop: 0}}; },
      m => { m.sounds = []; },
      m => { m.segments = [{fromFrame: 0, toFrame: 75}]; },
    ]) {
      const previous = await readEdit(), changed = structuredClone(previous);
      change(changed);
      assert.notDeepEqual(changed, previous);
      await fs.writeFile(path.resolve(ROOT, editFile), JSON.stringify(changed, null, 2));
      const before = await fs.readFile(path.resolve(ROOT, editFile), 'utf8');
      await assert.rejects(planEditorBrief(briefFile, {replace: true, keepCaptions: true}), /has changes the last plan did not write/);
      assert.equal(await fs.readFile(path.resolve(ROOT, editFile), 'utf8'), before);
      await fs.writeFile(path.resolve(ROOT, editFile), JSON.stringify(previous, null, 2));
    }
    const delivered = await planEditorBrief(briefFile, {replace: true, keepCaptions: true, delivery: true});
    assert.equal(delivered.purpose, 'delivery');
    assert.deepEqual((await readEdit()).captions, edited.captions, 'delivery uses the reviewed captions kept from the editor');
  } finally {
    await fs.rm(directory, {recursive: true, force: true});
  }
});

test('a changed brief keeps the previous plan in History even without manual edits', async () => {
  const id = `edit-safety-${randomUUID()}`, relative = `Projects/${id}`, directory = path.resolve(ROOT, relative);
  await fs.mkdir(directory, {recursive: true});
  try {
    const source = `${relative}/source.mp4`, transcript = `${relative}/words.json`, briefFile = `${relative}/brief.json`, editFile = `${relative}/edit.json`;
    await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=gray:s=64x96:r=30:d=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', path.resolve(ROOT, source)]);
    await fs.writeFile(path.resolve(ROOT, transcript), JSON.stringify(words));
    const brief = {version: 1, id, source, transcript, ...profileToBrief(profile), purpose: 'explainer', tone: 'calm',
      beats: [{id: 'opening', fromSec: 0, toSec: 2, intent: 'intro', data: {kicker: 'Example', title: 'Original title', subtitle: 'Short explanation', caption: 'Example'}}]};
    await fs.writeFile(path.resolve(ROOT, briefFile), JSON.stringify(brief));
    await planEditorBrief(briefFile);
    const original = JSON.parse(await fs.readFile(path.resolve(ROOT, editFile), 'utf8'));
    brief.beats[0].data.title = 'Revised title';
    await fs.writeFile(path.resolve(ROOT, briefFile), JSON.stringify(brief));
    const result = await planEditorBrief(briefFile, {replace: true});
    assert.ok(result.backup);
    assert.deepEqual(JSON.parse(await fs.readFile(path.resolve(ROOT, result.backup), 'utf8')), original);
  } finally {
    await fs.rm(directory, {recursive: true, force: true});
  }
});

test('a save made during planning wins even when explicit discard was requested', async () => {
  const id = `edit-safety-${randomUUID()}`, relative = `Projects/${id}`, directory = path.resolve(ROOT, relative);
  assert.equal(path.dirname(directory), path.resolve(ROOT, 'Projects'));
  await fs.mkdir(directory, {recursive: true});
  try {
    const source = `${relative}/source.mp4`, transcript = `${relative}/words.json`, briefFile = `${relative}/brief.json`, editFile = `${relative}/edit.json`;
    const editAbsolute = path.resolve(ROOT, editFile);
    await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=gray:s=64x96:r=30:d=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', path.resolve(ROOT, source)]);
    await fs.writeFile(path.resolve(ROOT, transcript), JSON.stringify(words));
    const brief = {version: 1, id, source, transcript, ...profileToBrief(profile), purpose: 'explainer', tone: 'calm',
      beats: [{id: 'opening', fromSec: 0, toSec: 2, intent: 'intro', data: {kicker: 'Example', title: 'Original title', subtitle: 'Short explanation', caption: 'Example'}}]};
    await fs.writeFile(path.resolve(ROOT, briefFile), JSON.stringify(brief));
    await planEditorBrief(briefFile);
    const baseline = await fs.readFile(editAbsolute, 'utf8');
    for (const discardEdits of [false, true]) {
      await fs.writeFile(editAbsolute, baseline);
      const latest = JSON.parse(baseline);
      latest.scenes[0].data.title = 'Saved while planning';
      const savedText = JSON.stringify(latest, null, 2);
      const readFile = fs.readFile;
      let interleaved = false;
      fs.readFile = async (file, ...args) => {
        const value = await readFile(file, ...args);
        if (!interleaved && path.basename(String(file)) === 'import-edit.json' && String(file).includes(id)) {
          interleaved = true;
          await fs.writeFile(editAbsolute, savedText);
        }
        return value;
      };
      try {
        await assert.rejects(planEditorBrief(briefFile, {replace: true, discardEdits}), /changed while planning/);
      } finally { fs.readFile = readFile; }
      assert.equal(interleaved, true, 'the fixture saves after the initial snapshot and before replacement');
      assert.equal(await fs.readFile(editAbsolute, 'utf8'), savedText);
    }
  } finally {
    await fs.rm(directory, {recursive: true, force: true});
  }
});
