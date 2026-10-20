import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {ROOT} from '../scripts/lib/media.mjs';
import {verifyKineticAssets} from '../scripts/lib/prepared-props.mjs';
import {loadProjectScenePack, projectSceneBuild} from '../scripts/lib/project-scenes.mjs';
import {projectScenePackSchema, projectSceneClips, valuesSchema} from '../engine/src/project-scenes/schema.ts';
import {sceneClipClaims, sceneVideoSources} from '../engine/src/core/scene-media.ts';
import {publicAssetSchema as corePublicAssetSchema} from '../engine/src/core/public-asset.ts';
import {clipSrcSchema} from '../engine/src/core/clip-schema.ts';
import {publicAssetSchema} from '../engine/src/creative-kit/kinetic/schema.ts';
import {toJsonSchema} from '../engine/src/review-editor/panels/form-schema.ts';
import {bundleEngine} from './helpers/engine-bundle.mjs';
import {realClip} from './helpers/clip-fixtures.mjs';

const clipValue = (extra = {}) => ({src: 'projects/x/a.mp4', sha256: 'a'.repeat(64), width: 1080, height: 1920, ...extra});
const contract = {id: 'bg-clip', label: 'Clip background', entry: 'scenes/BgClip.tsx', fields: [
  {key: 'title', type: 'string', required: true, max: 40},
  {key: 'background', type: 'clip', required: true},
  {key: 'extras', type: 'array', max: 3, items: {key: 'extra', type: 'object', fields: [{key: 'clip', type: 'clip', required: true}]}},
]};
const projectScenes = {pack: 'Projects/example/scene-pack.json', scenes: [contract]};
const projectScene = (values, extra = {}) => ({id: 'bg-1', family: 'project-scene', fromFrame: 0, durationInFrames: 90, layout: 'takeover', motion: 'quiet', data: {component: 'bg-clip', values}, ...extra});
const source = {path: 'Raw/example.mp4', sha256: 'a'.repeat(64), fps: 30, width: 1080, height: 1920, totalFrames: 600};
const asClipValue = (clip, extra = {}) => ({src: clip.src, sha256: clip.sha256, width: clip.width, height: clip.height, ...extra});
const HLG_TAGS = 'format=yuv420p,setparams=color_primaries=bt2020:color_trc=arib-std-b67:colorspace=bt2020nc:range=tv';

test('a clip field takes a verified clip value and rejects anything else', () => {
  const schema = valuesSchema(contract.fields);
  const parsed = schema.parse({title: 'x', background: clipValue(), extras: [{clip: clipValue({src: 'projects/x/b.mp4', trimBeforeFrame: 12, fit: 'contain'})}]});
  assert.deepEqual([parsed.background.trimBeforeFrame, parsed.background.fit], [0, 'cover'], 'defaults are filled');
  for (const bad of [clipValue({sha256: 'nope'}), clipValue({src: 'projects/x/a.mov'}), clipValue({width: 1}), {...clipValue(), extra: true}, clipValue({src: '../a.mp4'}), 'projects/x/a.mp4']) {
    assert.equal(schema.safeParse({title: 'x', background: bad}).success, false, JSON.stringify(bad));
  }
  assert.equal(schema.safeParse({title: 'x'}).success, false, 'a required clip must be supplied');
});

test('the clip schema and the scene schemas share one definition of a local public asset path', () => {
  assert.equal(publicAssetSchema, corePublicAssetSchema, 'kinetic/schema.ts re-exports the core definition under its old name');
  for (const bad of ['/abs/a.mp4', 'a/../b.mp4', './a.mp4', 'a//b.mp4', 'a\\b.mp4', 'c:/a.mp4', 'a%20b.mp4', 'a?x.mp4', 'a#b.mp4', '']) {
    assert.equal(publicAssetSchema.safeParse(bad).success, false, bad);
    assert.equal(clipSrcSchema.safeParse(bad).success, false, `clip ${bad}`);
  }
  assert.equal(publicAssetSchema.safeParse('projects/x/a.mov').success, true, 'a scene asset may be any local file');
  assert.equal(clipSrcSchema.safeParse('projects/x/a.mp4').success, true);
  assert.equal(clipSrcSchema.safeParse('projects/x/a.mov').success, false, 'a clip is still a local .mp4');
  // The editor reads these JSON schemas; sharing the definition must not add or drop a keyword.
  assert.deepEqual(toJsonSchema(publicAssetSchema), {$schema: 'https://json-schema.org/draft/2020-12/schema', type: 'string', minLength: 1, maxLength: 1000});
  assert.deepEqual(toJsonSchema(clipSrcSchema), toJsonSchema(publicAssetSchema));
});

test('a clip field cannot carry a default, because a default would be an unregistered file', () => {
  const withDefault = {...contract, fields: [{key: 'bg', type: 'clip', default: clipValue()}]};
  assert.equal(projectScenePackSchema.safeParse({version: 1, scenes: [withDefault]}).success, false);
  assert.equal(projectScenePackSchema.safeParse({version: 1, scenes: [contract]}).success, true);
});

test('clip sources are collected from nested fields, deduplicated, and reach the moving-source registry', () => {
  const scene = projectScene({title: 'x', background: clipValue(), extras: [{clip: clipValue()}, {clip: clipValue({src: 'projects/x/b.mp4'})}]});
  assert.deepEqual(projectSceneClips({projectScenes, scenes: [scene]}), ['projects/x/a.mp4', 'projects/x/b.mp4']);
  assert.deepEqual(sceneVideoSources(scene, projectScenes), ['projects/x/a.mp4', 'projects/x/b.mp4']);
  assert.deepEqual(sceneVideoSources(scene), [], 'without the contracts a project scene mounts nothing the registry can see');
  assert.deepEqual(projectSceneClips({projectScenes, scenes: [projectScene({title: 'x', background: {src: 'bad'}})]}), [], 'invalid values are skipped, not thrown');
  const claims = sceneClipClaims(scene, projectScenes);
  assert.equal(claims.length, 3);
  assert.deepEqual(claims[0], {sceneId: 'bg-1', src: 'projects/x/a.mp4', sha256: 'a'.repeat(64), width: 1080, height: 1920, trimBeforeFrame: 0, frames: 90});
});

test('prepare verifies a clip field against the real file', async (t) => {
  const {clip} = await realClip(t, {name: 'clip-field'});
  const edit = (values, durationInFrames = 90) => ({source, projectScenes, scenes: [projectScene(values, {durationInFrames})]});
  const assets = await verifyKineticAssets(edit({title: 'x', background: asClipValue(clip)}));
  assert.deepEqual(assets.map((asset) => asset.sha256), [clip.sha256], 'the clip takes part in preparation identity');
  await assert.rejects(verifyKineticAssets(edit({title: 'x', background: asClipValue(clip, {sha256: 'b'.repeat(64)})})), /hash|bytes/i);
  await assert.rejects(verifyKineticAssets(edit({title: 'x', background: asClipValue(clip, {width: 1000})})), /dimension/i);
  await assert.rejects(verifyKineticAssets(edit({title: 'x', background: asClipValue(clip, {trimBeforeFrame: 40})})), /too short/i, '40 + 90 frames are needed and the file has 90');
  await assert.rejects(verifyKineticAssets(edit({title: 'x', background: asClipValue(clip)}, 200)), /too short/i);
});

test('prepare refuses a clip with sound, another rate or HDR even when its hash and size are right', async (t) => {
  const {raw} = await realClip(t, {name: 'clip-media'});
  const verify = (file) => verifyKineticAssets({source, projectScenes, scenes: [projectScene({title: 'x', background: {...file, width: 1080, height: 1920}})]});
  const loud = await raw('loud.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3'], ['-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p', '-shortest']);
  await assert.rejects(verify(loud), /audio track/i);
  const slow = await raw('slow.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=24:duration=4'], ['-c:v', 'libx264', '-pix_fmt', 'yuv420p']);
  await assert.rejects(verify(slow), /runs at 24 fps but the edit runs at 30 fps/);
  const hdr = await raw('hdr.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=3'],
    ['-vf', HLG_TAGS, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt2020', '-color_trc', 'arib-std-b67', '-colorspace', 'bt2020nc']);
  await assert.rejects(verify(hdr), /is HDR/);
});

async function sceneProject(t, sceneSource) {
  const id = `clip-scene-${randomUUID().slice(0, 8)}`;
  const dir = path.join(ROOT, 'Projects', id);
  await fs.mkdir(path.join(dir, 'scenes'), {recursive: true});
  t.after(async () => {
    assert.equal(path.dirname(dir), path.join(ROOT, 'Projects'));
    await fs.rm(dir, {recursive: true, force: true});
  });
  await fs.writeFile(path.join(dir, 'scene-pack.json'), JSON.stringify({version: 1, scenes: [{id: 'bg-clip', label: 'Clip background', entry: 'scenes/BgClip.tsx', fields: [{key: 'title', type: 'string', required: true, max: 40}]}]}));
  await fs.writeFile(path.join(dir, 'scenes', 'BgClip.tsx'), sceneSource);
  return {id, edit: {id, projectScenes: await loadProjectScenePack(`Projects/${id}/scene-pack.json`, {id})}};
}

test('a project scene cannot mount video directly: named, aliased, namespace, module and require forms are all refused', async (t) => {
  const refused = [
    ['named', 'import React from "react"; import {OffthreadVideo} from "remotion"; export default function S(){return <OffthreadVideo src="x"/>}', /OffthreadVideo/],
    ['aliased', 'import React from "react"; import {Video as V} from "remotion"; export default function S(){return <V src="x"/>}', /Video from 'remotion'/],
    ['namespace jsx', 'import React from "react"; import * as R from "remotion"; export default function S(){return <R.Html5Video src="x"/>}', /R\.Html5Video/],
    ['namespace member', 'import React from "react"; import * as R from "remotion"; const C = R["OffthreadVideo"]; export default function S(){return <C src="x"/>}', /R\.OffthreadVideo/],
    ['media module', 'import React from "react"; import {Video} from "@remotion/media"; export default function S(){return <Video src="x"/>}', /@remotion\/media/],
    ['require', 'const {Html5Video} = require("remotion"); export default function S(){return null}', /Html5Video from 'remotion'/],
    ['re-export', 'export {OffthreadVideo} from "remotion"; export default function S(){return null}', /OffthreadVideo/],
  ];
  for (const [name, code, mention] of refused) {
    const project = await sceneProject(t, code);
    await assert.rejects(projectSceneBuild(project.edit), (error) => /Project scenes cannot mount video directly/.test(error.message) && /SceneClip/.test(error.message) && mention.test(error.message), name);
  }
});

test('a project scene may import everything else from remotion, and type-only video imports', async (t) => {
  const project = await sceneProject(t, 'import React from "react"; import type {Video} from "remotion"; import {AbsoluteFill, useCurrentFrame} from "remotion"; export default function S(){useCurrentFrame(); return <AbsoluteFill/>}');
  assert.ok((await projectSceneBuild(project.edit)).hash);
});

test('a project scene that imports SceneClip builds and fingerprints the engine files it draws with', async (t) => {
  const project = await sceneProject(t, 'import React from "react"; import {SceneClip} from "@reel-studio/core/clip"; export default function S({values}){return <SceneClip clip={values.background} width={1080} height={1920}/>}');
  const build = await projectSceneBuild(project.edit);
  const files = build.files.map((file) => file.path);
  assert.ok(files.includes('engine/src/core/clip.tsx'), files.join('\n'));
  assert.ok(files.includes('engine/src/core/plate.tsx'));
});

test('a project scene identity leaves out the mutable proxy and plate registries, so preparing another project cannot invalidate it', async (t) => {
  const project = await sceneProject(t, 'import React from "react"; import {SceneClip} from "@reel-studio/core/clip"; import {FAMILY} from "@reel-studio/core/fonts"; export default function S({values}){return <SceneClip clip={values.background} width={1080} height={1920} data-family={FAMILY.cairo}/>}');
  const build = await projectSceneBuild(project.edit);
  const files = build.files.map((file) => file.path);
  assert.ok(files.includes(`Projects/${project.id}/scenes/BgClip.tsx`), files.join('\n'));
  assert.ok(files.includes('engine/src/core/clip.tsx'), files.join('\n'));
  assert.ok(files.includes('engine/public/fonts/manifest.json'), 'the font manifest is not rewritten by a prepare, so it stays part of the identity');
  for (const registry of ['engine/proxies.json', 'engine/plates.json']) {
    assert.ok(!files.includes(registry), `${registry} is rewritten by every prepare or render of any project and must not be hashed`);
  }
  assert.equal(build.hash, (await projectSceneBuild(project.edit)).hash, 'the identity is stable between builds');
});

const sceneClip = await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {SceneClip} from './engine/src/core/clip';
  export const render = (props) => renderToStaticMarkup(React.createElement(SceneClip, props));
`, {ssr: true, media: true, plateStub: true});

test('SceneClip plays the silent file inside its box, from the trimmed frame, centred on its focus point', () => {
  const html = sceneClip.render({clip: {...clipValue(), trimBeforeFrame: 30, fit: 'cover', focus: {x: 0.25, y: 0.75}}, width: 1080, height: 1920});
  assert.match(html, /data-footage="projects\/x\/a\.mp4"/);
  assert.match(html, /data-muted="true"/);
  assert.match(html, /data-start-from-sec="1"/, '30 frames at 30 fps');
  assert.match(html, /data-object-fit="cover"/, 'the fill mode reaches Footage as its objectFit prop, which both video engines honour');
  assert.doesNotMatch(html, /object-fit:/, 'and not as a style, which the WebCodecs engine overwrites with its own prop');
  assert.match(html, /object-position:25% 75%/);
  assert.match(html, /width:1080px;height:1920px/);
  const contained = sceneClip.render({clip: {...clipValue({width: 1920, height: 1080}), trimBeforeFrame: 0, fit: 'contain'}, width: 1080, height: 1920});
  assert.match(contained, /data-object-fit="contain"/);
  assert.doesNotMatch(contained, /object-fit:/);
});

test('SceneClip refuses a clip that would be enlarged beyond the limit, contained or not, and says which remedies remain', () => {
  const wide = {...clipValue({width: 1920, height: 1080}), trimBeforeFrame: 0, fit: 'cover'};
  assert.throws(() => sceneClip.render({clip: wide, width: 1080, height: 1920}),
    (error) => error.message === 'SceneClip projects/x/a.mp4: the clip would be enlarged 1.78x in its 1080x1920 box (limit 1.25x); use the split layout, fit "contain" or a larger clip.',
    'SceneClip reports through the same function as the manifest rule, so the wording is shared');
  assert.throws(() => sceneClip.render({clip: {...clipValue({width: 540, height: 960}), trimBeforeFrame: 0, fit: 'contain'}, width: 1080, height: 1920}),
    (error) => /enlarged 2\.00x in its 1080x1920 box \(limit 1\.25x\); use the split layout or a larger clip\.$/.test(error.message),
    'a clip that is already contained is not told to use contain');
  assert.doesNotThrow(() => sceneClip.render({clip: {...wide, fit: 'contain'}, width: 1080, height: 1920}));
  assert.doesNotThrow(() => sceneClip.render({clip: wide, width: 1080, height: 800}));
});
