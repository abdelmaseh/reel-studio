import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
  SCENE_CAMERA_MOVES, SCENE_CAMERA_STRENGTHS, SCENE_CAMERA_PERSPECTIVE, SCENE_CAMERA_REFUSED_FAMILIES,
  orbitAt, dollyAt, snapZoomAt, coverScale3d, sceneCameraTransform, sceneCameraIssues, defaultSnapAt,
} from '../engine/src/core/camera.ts';
import {editManifestSchema, editSceneSchema} from '../engine/src/prepared-edit/schema.ts';
import {kitTemplate} from '../engine/src/review-editor/ops/templates.ts';
import {setSceneCamera, sceneCameraRefusal, CAMERA_MOVE_LABEL, CAMERA_STRENGTH_LABEL, CAMERA_TEXT} from '../engine/src/review-editor/ops/scene-camera.ts';
import {validateManifest} from '../engine/src/review-editor/validate.ts';
import {explainEnglish} from '../engine/src/review-editor/ops/explain.ts';
import {bundleEngine, setSsrFrame} from './helpers/engine-bundle.mjs';
import {reviewManifest} from './helpers/review-manifest.mjs';

const near = (actual, expected, message, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) <= epsilon, `${message ?? ''} expected ${expected}, got ${actual}`);
const POSE_KEYS = ['scale', 'x', 'y', 'rotateX', 'rotateY'];

// An independent model of the CSS transform `perspective(P) rotateX(a) rotateY(b) scale(s)` about the frame centre:
// does the turned plane still cover the whole 1080x1920 frame?
function covers(pose, perspective = SCENE_CAMERA_PERSPECTIVE, width = 1080, height = 1920) {
  const a = pose.rotateX * Math.PI / 180, b = pose.rotateY * Math.PI / 180;
  const project = ([x, y]) => {
    let X = x * pose.scale, Y = y * pose.scale, Z = 0;
    [X, Z] = [X * Math.cos(b) + Z * Math.sin(b), -X * Math.sin(b) + Z * Math.cos(b)];
    [Y, Z] = [Y * Math.cos(a) - Z * Math.sin(a), Y * Math.sin(a) + Z * Math.cos(a)];
    const k = perspective / (perspective - Z);
    return [X * k, Y * k];
  };
  const quad = [[-width / 2, -height / 2], [width / 2, -height / 2], [width / 2, height / 2], [-width / 2, height / 2]].map(project);
  const side = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return [[-width / 2, -height / 2], [width / 2, -height / 2], [width / 2, height / 2], [-width / 2, height / 2]]
    .every((corner) => quad.every((p, i) => side(p, quad[(i + 1) % 4], corner) >= -1e-6));
}

test('the four moves and three strengths are the whole vocabulary', () => {
  assert.deepEqual([...SCENE_CAMERA_MOVES], ['snap-zoom', 'orbit', 'dolly', 'handheld']);
  assert.deepEqual([...SCENE_CAMERA_STRENGTHS], ['soft', 'normal', 'strong']);
});

test('orbit sweeps the yaw from one side to the other, resting upright in the middle', () => {
  for (const [strength, degrees] of [['soft', 3], ['normal', 5], ['strong', 8]]) {
    const first = orbitAt(0, strength), middle = orbitAt(0.5, strength), last = orbitAt(1, strength);
    assert.deepEqual(Object.keys(first).sort(), [...POSE_KEYS].sort(), 'exactly the five channels');
    near(first.rotateY, -degrees, `${strength} start`);
    near(last.rotateY, degrees, `${strength} end`);
    assert.deepEqual(middle, {scale: 1, x: 0, y: 0, rotateX: 0, rotateY: 0}, `${strength} middle is the resting frame`);
    for (const t of [0.1, 0.25, 0.4]) {
      near(orbitAt(t, strength).rotateY, -orbitAt(1 - t, strength).rotateY, `${strength} yaw mirrors at ${t}`);
      near(orbitAt(t, strength).rotateX, -orbitAt(1 - t, strength).rotateX, `${strength} pitch mirrors at ${t}`);
    }
  }
  assert.ok(Math.abs(orbitAt(0, 'soft').rotateY) < Math.abs(orbitAt(0, 'normal').rotateY));
  assert.ok(Math.abs(orbitAt(0, 'normal').rotateY) < Math.abs(orbitAt(0, 'strong').rotateY));
});

test('orbit always covers the frame, so no edge of the scene is exposed', () => {
  for (const strength of SCENE_CAMERA_STRENGTHS) {
    for (let step = 0; step <= 40; step++) {
      const pose = orbitAt(step / 40, strength);
      assert.ok(pose.scale >= 1, `${strength} ${step}`);
      assert.ok(covers(pose), `${strength} at ${step}/40 leaves an edge exposed`);
    }
  }
  assert.equal(coverScale3d(0, 0), 1, 'a flat plane needs no extra scale');
  assert.ok(coverScale3d(0, 8) > 1.03 && coverScale3d(0, 8) < 1.1);
  near(coverScale3d(0, 8), coverScale3d(0, -8), 'yaw side does not matter', 1e-6);
});

test('dolly pushes in smoothly from rest to a closer view', () => {
  for (const [strength, extra] of [['soft', 0.04], ['normal', 0.08], ['strong', 0.14]]) {
    assert.deepEqual(dollyAt(0, strength), {scale: 1, x: 0, y: 0, rotateX: 0, rotateY: 0}, `${strength} starts at rest`);
    near(dollyAt(1, strength).scale, 1 + extra, `${strength} end`);
    near(dollyAt(0.5, strength).scale, 1 + extra / 2, `${strength} middle`);
    let last = 1;
    for (let step = 1; step <= 20; step++) {
      const {scale} = dollyAt(step / 20, strength);
      assert.ok(scale >= last, `${strength} never pulls back`);
      last = scale;
    }
  }
  assert.ok(dollyAt(1, 'soft').scale < dollyAt(1, 'normal').scale && dollyAt(1, 'normal').scale < dollyAt(1, 'strong').scale);
  assert.deepEqual(dollyAt(-1, 'normal'), dollyAt(0, 'normal'), 'progress clamps below 0');
  assert.deepEqual(dollyAt(2, 'normal'), dollyAt(1, 'normal'), 'progress clamps above 1');
});

test('snap-zoom is still before its cue, hits within a few frames, holds a beat and relaxes back to rest', () => {
  const at = 2;
  for (const [strength, extra] of [['soft', 0.05], ['normal', 0.1], ['strong', 0.18]]) {
    assert.deepEqual(snapZoomAt(0, at, strength), {scale: 1, x: 0, y: 0, rotateX: 0, rotateY: 0}, `${strength} before the cue`);
    assert.deepEqual(snapZoomAt(at, at, strength), {scale: 1, x: 0, y: 0, rotateX: 0, rotateY: 0}, `${strength} on the cue frame`);
    const quick = snapZoomAt(at + 0.07, at, strength).scale;
    assert.ok(quick > 1 + extra * 0.5 && quick < 1 + extra, `${strength} is most of the way in after about two frames (${quick})`);
    near(snapZoomAt(at + 0.14, at, strength).scale, 1 + extra, `${strength} peak`);
    near(snapZoomAt(at + 0.3, at, strength).scale, 1 + extra, `${strength} hold`);
    const halfway = snapZoomAt(at + 0.14 + 0.3 + 0.45, at, strength).scale;
    assert.ok(halfway > 1 && halfway < 1 + extra, `${strength} is relaxing`);
    near(snapZoomAt(at + 0.14 + 0.3 + 0.9, at, strength).scale, 1, `${strength} back at rest`);
    near(snapZoomAt(at + 10, at, strength).scale, 1, `${strength} long after`);
    let peak = 0;
    for (let step = 0; step <= 400; step++) peak = Math.max(peak, snapZoomAt(step / 100, at, strength).scale);
    near(peak, 1 + extra, `${strength} never overshoots its peak`, 1e-9);
  }
  assert.throws(() => snapZoomAt(Number.NaN, 1), RangeError);
  assert.throws(() => snapZoomAt(1, Number.POSITIVE_INFINITY), RangeError);
});

test('the transform string is identity-free for rest, flat for 2D moves and perspective for turns', () => {
  assert.equal(sceneCameraTransform({scale: 1, x: 0, y: 0, rotateX: 0, rotateY: 0}), 'none');
  assert.equal(sceneCameraTransform({scale: 1.1, x: 0, y: 0, rotateX: 0, rotateY: 0}), 'scale(1.1)');
  assert.equal(sceneCameraTransform({scale: 1.02, x: 3.5, y: -4, rotateX: 0, rotateY: 0, rotate: 0.25}), 'translate(3.5px, -4px) rotate(0.25deg) scale(1.02)');
  const turned = sceneCameraTransform({scale: 1.05, x: 0, y: 0, rotateX: 1, rotateY: -5});
  assert.equal(turned, `perspective(${SCENE_CAMERA_PERSPECTIVE}px) rotateX(1deg) rotateY(-5deg) scale(1.05)`);
  assert.doesNotMatch(sceneCameraTransform(orbitAt(0.2, 'strong')), /NaN|undefined|Infinity/);
});

test('the default snap cue sits inside the scene and leaves room for the relaxing', () => {
  for (const duration of [30, 60, 90, 150, 300]) {
    const at = defaultSnapAt(duration);
    assert.ok(Number.isInteger(at) && at >= 0 && at < duration, `${duration}: ${at}`);
  }
  assert.equal(defaultSnapAt(150), 60);
});

test('camera rules name every reason a scene may not carry a move', () => {
  const ok = {id: 'a', family: 'process', layout: 'takeover', durationInFrames: 120, camera: {move: 'orbit'}};
  assert.deepEqual(sceneCameraIssues(ok), []);
  assert.deepEqual(sceneCameraIssues({...ok, camera: undefined}), []);
  assert.deepEqual(sceneCameraIssues({...ok, layout: 'split'}), [], 'a split scene may move its graphics panel');
  assert.match(sceneCameraIssues({...ok, layout: 'presenter'})[0], /^a: camera moves apply only to takeover \(full-frame\) and split scenes; a presenter scene keeps/);
  for (const family of SCENE_CAMERA_REFUSED_FAMILIES) {
    for (const layout of ['takeover', 'split']) assert.match(sceneCameraIssues({...ok, family, layout})[0], new RegExp(`^a: ${family} already moves its own camera`), `${family} ${layout}`);
  }
  assert.deepEqual(sceneCameraIssues({...ok, family: 'screens', layout: 'split'}), [], 'a B-roll clip has no camera of its own, so a split screens scene may move');
  assert.deepEqual([...SCENE_CAMERA_REFUSED_FAMILIES], ['one-shot', 'screen-recording', 'screen-focus']);
  assert.match(sceneCameraIssues({...ok, camera: {move: 'orbit', at: 10}})[0], /^a: the camera cue "at" applies only to snap-zoom/);
  assert.deepEqual(sceneCameraIssues({...ok, camera: {move: 'snap-zoom', at: 119}}), []);
  assert.match(sceneCameraIssues({...ok, camera: {move: 'snap-zoom', at: 120}})[0], /^a: the snap-zoom cue must land inside its scene/);
});

const takeover = (m, camera, extra = {}) => {
  const next = structuredClone(m);
  next.scenes[0] = {...next.scenes[0], layout: 'takeover', ...(camera === undefined ? {} : {camera}), ...extra};
  return next;
};

test('a takeover scene carries a camera through the manifest and the scene schema keeps it', () => {
  const base = reviewManifest('camera-schema');
  for (const move of SCENE_CAMERA_MOVES) {
    for (const strength of [undefined, ...SCENE_CAMERA_STRENGTHS]) {
      const camera = {move, ...(strength ? {strength} : {}), ...(move === 'snap-zoom' ? {at: 20} : {})};
      const parsed = editManifestSchema.safeParse(takeover(base, camera));
      assert.equal(parsed.success, true, `${move} ${strength}: ${parsed.error?.issues.map((i) => i.message).join('; ')}`);
      assert.deepEqual(parsed.data.scenes[0].camera, camera);
    }
  }
  const scene = takeover(base, {move: 'dolly'}).scenes[0];
  assert.deepEqual(editSceneSchema.parse(scene).camera, {move: 'dolly'});
  assert.equal(editManifestSchema.parse(takeover(base, undefined)).scenes[0].camera, undefined, 'a scene without a camera stays without one');
});

test('a split scene carries every move through the manifest and keeps it', () => {
  const base = reviewManifest('camera-split-schema');
  for (const move of SCENE_CAMERA_MOVES) {
    for (const strength of [undefined, ...SCENE_CAMERA_STRENGTHS]) {
      const camera = {move, ...(strength ? {strength} : {}), ...(move === 'snap-zoom' ? {at: 20} : {})};
      const parsed = editManifestSchema.safeParse(takeover(base, camera, {layout: 'split'}));
      assert.equal(parsed.success, true, `${move} ${strength}: ${parsed.error?.issues.map((i) => i.message).join('; ')}`);
      assert.equal(parsed.data.scenes[0].layout, 'split');
      assert.deepEqual(parsed.data.scenes[0].camera, camera);
    }
  }
  for (const family of ['outcome', 'count']) {
    const template = kitTemplate(family, 30);
    assert.equal(template.layout, 'split', family);
    const split = structuredClone(base);
    split.scenes = [{id: 'panel', family, fromFrame: 0, durationInFrames: template.frames, layout: template.layout, motion: 'quiet', data: template.data, camera: {move: 'dolly', strength: 'strong'}}];
    const parsed = editManifestSchema.safeParse(split);
    assert.equal(parsed.success, true, `${family}: ${parsed.error?.issues.map((i) => i.message).join('; ')}`);
    assert.deepEqual(parsed.data.scenes[0].camera, {move: 'dolly', strength: 'strong'});
  }
});

test('the manifest refuses a camera on a presenter scene and any malformed camera', () => {
  const base = reviewManifest('camera-refuse');
  const statement = kitTemplate('statement', 30);
  const presenter = structuredClone(base);
  presenter.scenes = [{id: 'say', family: 'statement', fromFrame: 0, durationInFrames: statement.frames, layout: statement.layout, motion: 'quiet', data: statement.data, camera: {move: 'handheld'}}];
  assert.equal(statement.layout, 'presenter');
  const refused = editManifestSchema.safeParse(presenter);
  assert.equal(refused.success, false);
  assert.match(refused.error.issues.map((i) => i.message).join(' '), /say: camera moves apply only to takeover \(full-frame\) and split scenes/);
  delete presenter.scenes[0].camera;
  assert.equal(editManifestSchema.safeParse(presenter).success, true, 'the same presenter scene without a camera is fine');
  for (const camera of [{move: 'whip'}, {move: 'orbit', strength: 'extreme'}, {move: 'orbit', extra: 1}, {}, {move: 'snap-zoom', at: -1}, {move: 'snap-zoom', at: 1.5},
    {move: 'orbit', at: 5}, {move: 'snap-zoom', at: 60}, 'orbit', null]) {
    assert.equal(editManifestSchema.safeParse(takeover(base, camera)).success, false, JSON.stringify(camera));
  }
});

test('the editor reads a refused camera in plain Arabic and keeps the scene id', () => {
  const base = reviewManifest('camera-explain');
  const statement = kitTemplate('statement', 30);
  const presenterScene = {id: 'hook', family: 'statement', fromFrame: 0, durationInFrames: statement.frames, layout: statement.layout, motion: 'quiet', data: statement.data, camera: {move: 'orbit'}};
  const result = validateManifest({...base, scenes: [presenterScene]});
  assert.equal(result.ok, false);
  const issue = result.issues.find((item) => /camera/.test(item.detail ?? ''));
  assert.ok(issue, JSON.stringify(result.issues));
  assert.match(issue.message, /hook/);
  assert.match(issue.message, /الكاميرا/);
  assert.match(issue.message, /split/, 'the refusal names the layouts that do take a camera');
  assert.match(issue.message, /takeover/);
  assert.equal(validateManifest({...base, scenes: [{...base.scenes[0], layout: 'split', camera: {move: 'orbit'}}]}).ok, true, 'a split scene with a camera is a valid manifest');
  assert.match(explainEnglish('hook: one-shot already moves its own camera; a scene camera would double it.'), /one-shot/);
  assert.match(explainEnglish('hook: the snap-zoom cue must land inside its scene.'), /hook/);
  assert.match(explainEnglish('hook: the camera cue "at" applies only to snap-zoom.'), /hook/);
});

test('setSceneCamera sets, changes and clears a move, and only on a scene that may carry one', () => {
  const base = takeover(reviewManifest('camera-op'), undefined);
  const set = setSceneCamera(base, 'hook', {move: 'snap-zoom', strength: 'strong', at: 24});
  assert.equal(set.ok, true);
  assert.deepEqual(set.manifest.scenes[0].camera, {move: 'snap-zoom', strength: 'strong', at: 24});
  assert.equal(setSceneCamera(set.manifest, 'hook', {move: 'snap-zoom', strength: 'strong', at: 24}).changed, false, 'the same camera is no change');
  const orbit = setSceneCamera(set.manifest, 'hook', {move: 'orbit', strength: 'soft', at: 24});
  assert.equal(orbit.ok, true);
  assert.deepEqual(orbit.manifest.scenes[0].camera, {move: 'orbit', strength: 'soft'}, 'the cue is dropped when the move has none');
  const cleared = setSceneCamera(orbit.manifest, 'hook', null);
  assert.equal(cleared.ok, true);
  assert.equal('camera' in cleared.manifest.scenes[0], false);
  assert.equal(setSceneCamera(cleared.manifest, 'hook', null).changed, false);
  assert.equal(setSceneCamera(base, 'nope', {move: 'dolly'}).ok, false);
  const split = reviewManifest('camera-op-split');
  assert.equal(split.scenes[0].layout, 'split');
  const onSplit = setSceneCamera(split, 'hook', {move: 'dolly', strength: 'soft'});
  assert.equal(onSplit.ok, true, onSplit.reason);
  assert.deepEqual(onSplit.manifest.scenes[0].camera, {move: 'dolly', strength: 'soft'});
  assert.equal(sceneCameraRefusal(split.scenes[0]), null, 'a split scene may carry a camera');
  const presenterScene = {...split.scenes[0], layout: 'presenter'};
  const refused = setSceneCamera({...split, scenes: [presenterScene]}, 'hook', {move: 'dolly'});
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /presenter/);
  assert.match(refused.reason, /split/);
  assert.match(sceneCameraRefusal(presenterScene), /takeover|الشاشة الكاملة/);
  assert.equal(sceneCameraRefusal(base.scenes[0]), null);
  assert.equal(sceneCameraRefusal({...base.scenes[0], family: 'one-shot'}) !== null, true);
});

test('every move and strength has a creator-facing label', () => {
  for (const move of SCENE_CAMERA_MOVES) assert.match(CAMERA_MOVE_LABEL[move], /\p{Script=Arabic}/u, move);
  for (const strength of SCENE_CAMERA_STRENGTHS) assert.match(CAMERA_STRENGTH_LABEL[strength], /\p{Script=Arabic}/u, strength);
});

const mod = await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {SceneCamera, sceneCameraPose} from './engine/src/core/scene-camera';
  import {SafeRoot} from './engine/src/core/safe';
  const child = React.createElement('div', {id: 'child'}, 'x');
  const props = (camera, sceneId, durationInFrames, area) => ({camera, sceneId, durationInFrames, ...(area ? {area} : {})});
  export const render = (camera, sceneId = 'scene-a', duration = 150, area) => renderToStaticMarkup(React.createElement(SceneCamera, props(camera, sceneId, duration, area), child));
  export const renderProbe = (camera, sceneId = 'scene-a', duration = 150, area) => renderToStaticMarkup(React.createElement(SafeRoot, {probe: '#00FF00'}, React.createElement(SceneCamera, props(camera, sceneId, duration, area), child)));
  export const renderPlain = () => renderToStaticMarkup(React.createElement(SafeRoot, {probe: '#00FF00'}, child));
  export const pose = sceneCameraPose;
`, {ssr: true});
const at = (frame, camera, sceneId, duration) => { setSsrFrame(frame); return mod.render(camera, sceneId, duration); };
const atArea = (frame, camera, area, sceneId = 'scene-a', duration = 150) => { setSsrFrame(frame); return mod.render(camera, sceneId, duration, area); };
const transformOf = (html) => /transform:([^;"]+)/.exec(html)?.[1] ?? null;
// The opening <div> tags of a markup string, each with its inline style as a map.
const boxes = (html) => [...html.matchAll(/<div([^>]*)>/g)].map(([, attrs]) => ({
  attrs,
  style: Object.fromEntries((/style="([^"]*)"/.exec(attrs)?.[1] ?? '').split(';').filter(Boolean).map((rule) => { const cut = rule.indexOf(':'); return [rule.slice(0, cut).trim(), rule.slice(cut + 1).trim()]; })),
}));
const px = (value) => Number.parseFloat(value);

// The graphics panel of a split scene: the whole width and everything above the seam.
const PANEL = {x: 0, y: 0, width: 1080, height: 1040};

test('under the safe-zone probe the camera is the identity: the scene is drawn exactly where it rests', () => {
  for (const move of SCENE_CAMERA_MOVES) {
    for (const frame of [0, 37, 75, 149]) {
      setSsrFrame(frame);
      assert.equal(mod.renderProbe({move, strength: 'strong', at: 30}), mod.renderPlain(), `${move} at ${frame}`);
    }
  }
});

test('outside the probe the wrapper fills the frame and moves with the frame number', () => {
  const html = at(75, {move: 'orbit', strength: 'strong'});
  assert.match(html, /id="child"/);
  assert.match(html, /position:absolute/);
  assert.equal(transformOf(at(75, {move: 'orbit', strength: 'strong'}, 'scene-a', 151)), 'none', 'orbit rests in the middle of the scene (frame 75 of 151 is progress 0.5)');
  assert.notEqual(transformOf(at(0, {move: 'orbit', strength: 'strong'})), 'none');
  assert.match(transformOf(at(0, {move: 'orbit', strength: 'strong'})), /^perspective\(1800px\) rotateX/);
  assert.equal(transformOf(at(0, {move: 'dolly'})), 'none', 'dolly starts at rest');
  assert.match(transformOf(at(149, {move: 'dolly'})), /^scale\(1\.0\d+\)$/);
  assert.equal(transformOf(at(10, {move: 'snap-zoom', at: 30})), 'none', 'still before the cue');
  assert.match(transformOf(at(36, {move: 'snap-zoom', strength: 'strong', at: 30})), /^scale\(1\.18\)$/);
  assert.equal(transformOf(at(149, {move: 'snap-zoom', at: 30})), 'none', 'relaxed back by the end');
});

test('a takeover scene is drawn exactly as before: byte-identical markup for every recorded move and frame', () => {
  const rows = JSON.parse(readFileSync(new URL('./fixtures/scene-camera-takeover-ssr.json', import.meta.url), 'utf8'));
  assert.ok(rows.length >= 20);
  for (const row of rows) {
    const markup = at(row.frame, row.camera, row.sceneId, row.durationInFrames);
    assert.equal(markup, row.markup, `${row.camera.move} ${row.camera.strength ?? ''} ${row.sceneId} frame ${row.frame}`);
    assert.equal(createHash('sha256').update(markup).digest('hex'), row.sha256);
  }
});

test('orbit on a split panel covers the panel, not the whole frame', () => {
  for (const height of [1000, 1040, 1056, 1080]) {
    const area = {width: 1080, height};
    for (const strength of SCENE_CAMERA_STRENGTHS) {
      for (let step = 0; step <= 40; step++) {
        const pose = orbitAt(step / 40, strength, area);
        assert.ok(covers(pose, SCENE_CAMERA_PERSPECTIVE, area.width, area.height), `${height} ${strength} at ${step}/40 leaves an edge of the panel exposed`);
        near(pose.scale, coverScale3d(pose.rotateX, pose.rotateY, SCENE_CAMERA_PERSPECTIVE, area.width, area.height), `${height} ${strength} ${step} scale`, 1e-12);
      }
      assert.deepEqual(orbitAt(0.5, strength, area), {scale: 1, x: 0, y: 0, rotateX: 0, rotateY: 0}, 'still the resting frame in the middle');
    }
  }
  const full = {width: 1080, height: 1920};
  assert.deepEqual(orbitAt(0.2, 'strong'), orbitAt(0.2, 'strong', full), 'no area means the whole frame, as before');
  assert.notEqual(orbitAt(0, 'strong', {width: 1080, height: 1000}).scale, orbitAt(0, 'strong').scale, 'the cover scale follows the area');
  assert.throws(() => orbitAt(0, 'strong', {width: 0, height: 1000}), RangeError);
  assert.throws(() => orbitAt(0, 'strong', {width: 1080, height: Number.NaN}), RangeError);
  assert.deepEqual(dollyAt(0.5, 'strong'), {scale: 1.07, x: 0, y: 0, rotateX: 0, rotateY: 0}, 'a dolly is a pure scale about the panel centre');
});

test('handheld on a split panel scales up for the panel height and shakes exactly as on the frame', () => {
  const area = {width: 1080, height: 1000};
  for (const strength of SCENE_CAMERA_STRENGTHS) {
    for (let frame = 0; frame < 300; frame += 3) {
      const base = {sceneId: 'shaky', frame, fps: 30, durationInFrames: 300};
      const panel = mod.pose({move: 'handheld', strength}, {...base, area});
      const frameWide = mod.pose({move: 'handheld', strength}, base);
      const need = 1 + 2 * Math.max(Math.abs(panel.x) / area.width, Math.abs(panel.y) / area.height);
      assert.ok(panel.scale >= need, `${strength} frame ${frame}: scale ${panel.scale} < ${need}`);
      assert.ok(panel.scale > frameWide.scale, `${strength} frame ${frame}: the panel is shorter, so it needs more scale`);
      assert.deepEqual([panel.x, panel.y, panel.rotate], [frameWide.x, frameWide.y, frameWide.rotate], 'the same shake');
    }
  }
});

test('on a split scene the move works on the graphics panel only: a box clipped at the seam, turning about the panel centre', () => {
  for (const [camera, frame] of [[{move: 'orbit', strength: 'strong'}, 0], [{move: 'snap-zoom', strength: 'strong', at: 30}, 36], [{move: 'dolly', strength: 'strong'}, 149], [{move: 'handheld', strength: 'strong'}, 41]]) {
    const html = atArea(frame, camera, PANEL);
    const [clip, moved, child] = boxes(html);
    assert.equal(clip.style.overflow, 'hidden', `${camera.move}: the panel is clipped`);
    assert.equal(clip.style.position, 'absolute');
    assert.deepEqual([px(clip.style.left), px(clip.style.top), px(clip.style.width), px(clip.style.height)], [0, 0, 1080, 1040], `${camera.move}: the clip is the panel, ending at the seam`);
    assert.equal(clip.style.transform, undefined, `${camera.move}: the clip itself does not move`);
    assert.ok(moved.style.transform && moved.style.transform !== 'none', `${camera.move}: the scene moves inside the clip`);
    assert.equal(moved.style['transform-origin'], '540px 520px', `${camera.move}: about the centre of the panel`);
    assert.deepEqual([px(moved.style.left), px(moved.style.top), px(moved.style.width), px(moved.style.height)], [0, 0, 1080, 1920], `${camera.move}: the scene keeps its own frame-sized layout`);
    assert.equal(child.attrs, ' id="child"');
    assert.equal(html.match(/transform:/g).length, 1, `${camera.move}: exactly one transform, none outside the clip`);
    assert.ok(html.indexOf('id="child"') > html.indexOf(moved.style.transform), `${camera.move}: the scene is inside the moved box`);
  }
  const strongOrbit = atArea(0, {move: 'orbit', strength: 'strong'}, PANEL);
  const pose = orbitAt(0, 'strong', {width: 1080, height: 1040});
  assert.equal(transformOf(strongOrbit), sceneCameraTransform(pose), 'the orbit is covered for the panel');
  assert.equal(transformOf(atArea(36, {move: 'snap-zoom', strength: 'strong', at: 30}, PANEL)), 'scale(1.18)');
  assert.equal(transformOf(atArea(10, {move: 'snap-zoom', at: 30}, PANEL)), 'none', 'a resting panel has no transform, but is still clipped at the seam');
  assert.equal(boxes(atArea(10, {move: 'snap-zoom', at: 30}, PANEL))[0].style.overflow, 'hidden');
  const handheld = mod.pose({move: 'handheld', strength: 'strong'}, {sceneId: 'scene-a', frame: 41, fps: 30, durationInFrames: 150, area: PANEL});
  assert.equal(transformOf(atArea(41, {move: 'handheld', strength: 'strong'}, PANEL)), sceneCameraTransform(handheld));
  const offset = boxes(atArea(0, {move: 'dolly', strength: 'strong'}, {x: 100, y: 200, width: 800, height: 600}));
  assert.deepEqual([px(offset[0].style.left), px(offset[0].style.top), px(offset[0].style.width), px(offset[0].style.height)], [100, 200, 800, 600]);
  assert.equal(offset[1].style['transform-origin'], '500px 500px', 'the centre of the area, in frame coordinates');
  assert.deepEqual([px(offset[1].style.left), px(offset[1].style.top)], [-100, -200], 'the scene stays where the frame puts it');
});

test('under the safe-zone probe a split scene is drawn untouched, with no clip and no transform', () => {
  for (const move of SCENE_CAMERA_MOVES) {
    for (const frame of [0, 37, 75, 149]) {
      setSsrFrame(frame);
      assert.equal(mod.renderProbe({move, strength: 'strong', at: 30}, 'scene-a', 150, PANEL), mod.renderPlain(), `${move} at ${frame}`);
    }
  }
});

test('a snap-zoom without a cue lands at the default moment', () => {
  const html = at(defaultSnapAt(150) + 5, {move: 'snap-zoom', strength: 'normal'});
  assert.match(transformOf(html), /^scale\(1\.\d+\)$/);
  assert.equal(transformOf(at(defaultSnapAt(150) - 1, {move: 'snap-zoom'})), 'none');
});

test('handheld is a pure function of the scene id, the frame and the strength', () => {
  const camera = {move: 'handheld', strength: 'normal'};
  assert.equal(at(40, camera, 'scene-a'), at(40, camera, 'scene-a'), 'same inputs, same markup');
  assert.notEqual(at(40, camera, 'scene-a'), at(40, camera, 'scene-b'), 'another scene shakes differently');
  assert.notEqual(at(40, camera, 'scene-a'), at(41, camera, 'scene-a'), 'the next frame differs');
  assert.notEqual(at(40, camera, 'scene-a'), at(40, {move: 'handheld', strength: 'strong'}, 'scene-a'));
  const a = mod.pose(camera, {sceneId: 'scene-a', frame: 40, fps: 30, durationInFrames: 150});
  const b = mod.pose(camera, {sceneId: 'scene-a', frame: 40, fps: 30, durationInFrames: 150});
  assert.deepEqual(a, b);
  assert.ok(a.scale > 1, 'handheld always covers the edges its shake would show');
  assert.equal(a.rotateX, 0);
  assert.equal(a.rotateY, 0);
});

test('handheld strengths shake more and always stay inside their own cover scale', () => {
  const peaks = {};
  for (const strength of SCENE_CAMERA_STRENGTHS) {
    let travel = 0;
    for (let frame = 0; frame < 300; frame += 3) {
      const pose = mod.pose({move: 'handheld', strength}, {sceneId: 'shaky', frame, fps: 30, durationInFrames: 300});
      travel = Math.max(travel, Math.abs(pose.x), Math.abs(pose.y));
      const need = 1 + 2 * Math.max(Math.abs(pose.x) / 1080, Math.abs(pose.y) / 1920);
      assert.ok(pose.scale >= need, `${strength} frame ${frame}: scale ${pose.scale} < ${need}`);
    }
    peaks[strength] = travel;
  }
  assert.ok(peaks.soft < peaks.normal && peaks.normal < peaks.strong, JSON.stringify(peaks));
});

test('every move renders every few frames at 30 and 60 fps without a bad number', () => {
  for (const move of SCENE_CAMERA_MOVES) {
    for (const strength of SCENE_CAMERA_STRENGTHS) {
      for (let frame = 0; frame < 150; frame += 7) {
        const html = at(frame, {move, strength, ...(move === 'snap-zoom' ? {at: 40} : {})});
        assert.doesNotMatch(html, /NaN|undefined|Infinity/, `${move} ${strength} ${frame}`);
      }
    }
  }
  const sixty = mod.pose({move: 'snap-zoom', at: 120}, {sceneId: 'x', frame: 126, fps: 60, durationInFrames: 300});
  const thirty = mod.pose({move: 'snap-zoom', at: 60}, {sceneId: 'x', frame: 63, fps: 30, durationInFrames: 150});
  near(sixty.scale, thirty.scale, 'the same moment in seconds gives the same pose at any frame rate', 1e-9);
});

const panel = await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {SceneCameraRow} from './engine/src/review-editor/panels/scene-camera';
  export const render = (scene) => renderToStaticMarkup(React.createElement(SceneCameraRow, {scene, run: () => ({ok: true})}));
`);
const sceneOf = (extra) => ({...reviewManifest('camera-panel').scenes[0], ...extra});

test('the scene card offers the camera only where a scene may carry one', () => {
  const free = panel.render(sceneOf({layout: 'takeover'}));
  for (const move of SCENE_CAMERA_MOVES) assert.ok(free.includes(`value="${move}"`) && free.includes(CAMERA_MOVE_LABEL[move]), move);
  assert.doesNotMatch(free, /القوة/, 'no strength before a move is chosen');
  const set = panel.render(sceneOf({layout: 'takeover', camera: {move: 'snap-zoom', strength: 'strong', at: 30}}));
  assert.match(set, /<option value="strong" selected="">قوية<\/option>|<option selected="" value="strong">قوية<\/option>/);
  assert.match(set, /value="30"/, 'the cue frame is shown');
  const orbit = panel.render(sceneOf({layout: 'takeover', camera: {move: 'orbit'}}));
  assert.match(orbit, /القوة/);
  assert.doesNotMatch(orbit, /لحظة الضربة/, 'only a snap-zoom has a cue');
  const split = panel.render(sceneOf({layout: 'split'}));
  for (const move of SCENE_CAMERA_MOVES) assert.ok(split.includes(`value="${move}"`) && split.includes(CAMERA_MOVE_LABEL[move]), `split offers ${move}`);
  assert.ok(split.includes(`title="${CAMERA_TEXT.splitHint}"`), 'a split scene says the move acts on the graphics only');
  assert.ok(!free.includes(CAMERA_TEXT.splitHint), 'a takeover scene carries no such note');
  const splitSet = panel.render(sceneOf({layout: 'split', camera: {move: 'snap-zoom', strength: 'soft', at: 12}}));
  assert.match(splitSet, /القوة/);
  assert.match(splitSet, /value="12"/, 'the cue frame is shown on a split scene too');
  const presenter = panel.render(sceneOf({layout: 'presenter'}));
  assert.doesNotMatch(presenter, /<select/);
  assert.match(presenter, /presenter/);
  assert.match(presenter, /split/, 'the refusal says which layouts do take a camera');
  assert.match(presenter, /takeover/);
  const stuck = panel.render(sceneOf({layout: 'presenter', camera: {move: 'dolly'}}));
  assert.match(stuck, /<select/, 'a camera that is already there can always be removed');
  const family = panel.render(sceneOf({layout: 'split', family: 'one-shot'}));
  assert.doesNotMatch(family, /<select/, 'a family with its own camera is still refused in split');
  assert.match(family, /one-shot/);
});

test('the gallery names the four moves exactly as the editor does', async () => {
  const {previewDefinitions} = await import('../engine/src/library-preview/fixtures.ts');
  const camera = previewDefinitions().filter((item) => item.layer === 'camera');
  for (const move of SCENE_CAMERA_MOVES) {
    const preview = camera.find((item) => item.key === `camera:${move}`);
    assert.ok(preview, move);
    assert.ok(preview.labelAr.endsWith(CAMERA_MOVE_LABEL[move]), `${preview.labelAr} vs ${CAMERA_MOVE_LABEL[move]}`);
    assert.equal(preview.fixture.preset, move);
  }
});

// The whole PreparedEdit tree in markup: the presenter window, the graphics panel, the captions and the canvas, as the renderer draws them.
const prepared = await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {PreparedEdit} from './engine/src/prepared-edit/PreparedEdit';
  export const render = (edit, probe) => renderToStaticMarkup(<PreparedEdit edit={edit} plate={{src:'sample.mp4',width:1080,height:1920}} {...(probe ? {probe} : {})}/>);
`, {ssr: true, media: true});
const preparedAt = (edit, frame, probe) => { setSsrFrame(frame); return prepared.render(edit, probe); };
const sceneWith = (layout, camera) => {
  const m = reviewManifest('camera-prepared');
  m.scenes[0] = {...m.scenes[0], layout, ...(camera ? {camera} : {})};
  return m;
};
const CLOSERS = '</div></div>';

test('in a split scene the move acts on the graphics panel only: presenter window, captions and canvas stay byte-identical', () => {
  const cases = [
    [{move: 'orbit', strength: 'strong'}, 0], [{move: 'orbit', strength: 'strong'}, 59],
    [{move: 'snap-zoom', strength: 'strong', at: 10}, 14], [{move: 'dolly', strength: 'strong'}, 59],
    [{move: 'handheld', strength: 'strong'}, 20], [{move: 'handheld', strength: 'strong'}, 21],
  ];
  for (const [camera, frame] of cases) {
    const still = preparedAt(sceneWith('split'), frame);
    const moved = preparedAt(sceneWith('split', camera), frame);
    const label = `${camera.move} at ${frame}`;
    // The presenter window: its top edge is the seam.
    const [, windowTop, windowHeight] = /left:0;width:100%;top:(\d+)px;height:(\d+)px;overflow:hidden/.exec(still);
    const seam = Number(windowTop);
    assert.equal(seam + Number(windowHeight), 1920, 'the presenter window runs from the seam to the bottom');
    const clipOpen = `<div style="position:absolute;left:0;top:0;width:1080px;height:${seam}px;overflow:hidden"><div style="`;
    const start = moved.indexOf(clipOpen);
    assert.notEqual(start, -1, `${label}: the moved scene is inside a box clipped at the seam (${seam})`);
    assert.equal(moved.indexOf(clipOpen, start + 1), -1, `${label}: one clip only`);
    const innerTagEnd = moved.indexOf('>', start + clipOpen.length) + 1;
    const innerTag = moved.slice(start + clipOpen.length - '<div style="'.length, innerTagEnd);
    assert.match(innerTag, new RegExp(`transform-origin:540px ${seam / 2}px`), `${label}: the move turns about the centre of the panel`);
    assert.match(innerTag, /top:0;left:0;right:auto;bottom:auto;width:1080px;height:1920px;/, `${label}: the scene keeps its own frame-sized layout`);
    // Take the clip away and the markup is the unmoved split scene again, so nothing else (plate, captions, canvas, scene content) was touched.
    const head = moved.slice(0, start);
    assert.equal(head, still.slice(0, start), `${label}: everything before the graphics (canvas and presenter window) is identical`);
    const body = moved.slice(innerTagEnd);
    const rest = still.slice(start);
    let diverge = 0;
    while (diverge < rest.length && body[diverge] === rest[diverge]) diverge++;
    // The scene is followed by the two closers of the camera box; they sit within a closer's length of the first difference.
    const closeAt = [...Array(CLOSERS.length).keys()].map((back) => diverge - back).find((index) => index >= 0 && body.slice(index, index + CLOSERS.length) === CLOSERS && body.slice(0, index) + body.slice(index + CLOSERS.length) === rest);
    assert.notEqual(closeAt, undefined, `${label}: removing the camera box leaves the unmoved scene, the captions and everything after it byte-identical`);
    assert.doesNotMatch(still, /perspective\(|scale\(1\.\d/, 'the unmoved scene carries no camera transform');
  }
});

test('a split scene at rest is clipped but untransformed, and the move shows at the strongest frame', () => {
  const rest = preparedAt(sceneWith('split', {move: 'snap-zoom', strength: 'strong', at: 40}), 5);
  assert.match(rest, /width:1080px;height:1056px;overflow:hidden"><div style="position:absolute;top:0;left:0;right:auto;bottom:auto;width:1080px;height:1920px;display:flex;flex-direction:column;transform:none;transform-origin:540px 528px"/);
  const peak = preparedAt(sceneWith('split', {move: 'snap-zoom', strength: 'strong', at: 40}), 46);
  assert.match(peak, /flex-direction:column;transform:scale\(1\.18\);transform-origin:540px 528px"/);
});

test('a takeover scene keeps its full-frame camera box in the whole tree: no clip', () => {
  const moved = preparedAt(sceneWith('takeover', {move: 'orbit', strength: 'strong'}), 0);
  assert.match(moved, /<div style="position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;display:flex;flex-direction:column;transform:perspective\(1800px\) rotateX\(1\.6deg\) rotateY\(-8deg\) scale\(1\.073\);transform-origin:50% 50%">/);
  const clipped = /width:1080px;height:\d+px;overflow:hidden"><div style="position:absolute;top:0;left:0;right:auto/;
  assert.doesNotMatch(moved, clipped);
  assert.match(preparedAt(sceneWith('split', {move: 'orbit', strength: 'strong'}), 0), clipped, 'the same pattern does find the clip of a split scene');
});

test('under the safe-zone probe a split scene with a camera measures exactly the resting layout', () => {
  for (const camera of [{move: 'orbit', strength: 'strong'}, {move: 'dolly', strength: 'strong'}, {move: 'handheld', strength: 'strong'}, {move: 'snap-zoom', strength: 'strong', at: 10}]) {
    for (const frame of [0, 14, 59]) {
      assert.equal(preparedAt(sceneWith('split', camera), frame, '#00FF00'), preparedAt(sceneWith('split'), frame, '#00FF00'), `${camera.move} at ${frame}`);
    }
  }
});
