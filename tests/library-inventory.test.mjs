import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const moduleUrl = new URL('../scripts/lib/library-inventory.mjs', import.meta.url);
const cli = (...args) => spawnSync(process.execPath, ['scripts/library.mjs', ...args], {
  cwd: ROOT, encoding: 'utf8', windowsHide: true,
});
const inventory = async (options) => (await import(moduleUrl)).collectLibraryInventory(options);
const sha = (text) => createHash('sha256').update(String(text).replace(/\r\n/g, '\n')).digest('hex');

test('inventory enumerates production contracts without conflating styles, concepts and scenes', async () => {
  const result = await inventory();
  const {STYLE_IDS}=await import('../engine/src/styles/registry.ts');
  const {editSceneSchema}=await import('../engine/src/prepared-edit/schema.ts');
  const families=editSceneSchema.def.left.options.map(schema=>schema.shape.family.value).sort();
  assert.deepEqual(result.items.filter(item=>item.layer==='style').map(item=>item.nativeId),[...STYLE_IDS].sort());
  assert.deepEqual(result.items.filter(item=>item.layer==='scene').map(item=>item.nativeId),families);
  assert.equal(result.countsByLayer.style, STYLE_IDS.length);
  const {CATALOG}=await import('../engine/src/motion-concepts/catalog.ts');
  assert.deepEqual(result.items.filter(item=>item.layer==='concept').map(item=>item.nativeId),CATALOG.map(item=>item.id).sort());
  assert.equal(result.countsByLayer.concept, CATALOG.length);
  assert.equal(result.countsByLayer.scene, families.length);
  assert.equal(result.countsByKind.scene, families.length);
  const keys = result.items.map((item) => item.key);
  assert.equal(new Set(keys).size, keys.length);
  const scene = result.items.find((item) => item.key === 'scene:kinetic-hook');
  assert.equal(scene.nativeId, 'kinetic-hook');
  assert.deepEqual(scene.layouts, ['presenter']);
  assert.equal(scene.reachability.manifest, 'declared');
  assert.equal(scene.reachability.renderer, 'unverified');
  assert.equal(scene.reachability.editor, 'unverified');
  assert.equal(result.items.find((item) => item.key === 'scene:project-scene').role, 'extension-point');
  for (const item of result.items) {
    assert.equal(item.lifecycle, 'unassessed', item.key);
    assert.equal(Object.hasOwn(item, 'ready'), false, item.key);
    assert.ok(item.sourcePaths.length > 0, item.key);
    assert.ok(['style', 'scene', 'concept', 'effect', 'sound', 'primitive'].includes(item.kind), item.key);
  }
});

test('recipe variants retain their scene identity while sound recipes and generators stay distinct', async () => {
  const result = await inventory();
  assert.equal(result.countsByLayer['recipe-variant'], 3);
  const sound=JSON.parse(await fs.readFile(path.join(ROOT,'Sound-Kits/catalog.json'),'utf8'));
  assert.deepEqual(result.items.filter(item=>item.layer==='sound-generator').map(item=>item.nativeId),sound.sounds.map(item=>item.id).sort());
  assert.deepEqual(result.items.filter(item=>item.layer==='sound-recipe').map(item=>item.nativeId),sound.recipes.map(item=>item.id).sort());
  assert.equal(result.countsByLayer['sound-generator'], sound.sounds.length);
  assert.equal(result.countsByLayer['sound-recipe'], sound.recipes.length);
  const variants = result.items.filter((item) => item.layer === 'recipe-variant');
  assert.deepEqual(Object.fromEntries(variants.map((item) => [item.nativeId, item.variantOf])), {
    'data-bars': 'scene:data-story',
    'metric-count': 'scene:data-story',
    'source-focus': 'scene:screen-focus',
  });
  const keys = new Set(result.items.map((item) => item.key));
  for (const item of result.items) if (item.variantOf) assert.ok(keys.has(item.variantOf), item.key);
  assert.ok(result.items.some((item) => item.key === 'sound-generator:pop'));
  assert.ok(result.items.some((item) => item.key === 'word-entrance:pop'));
});

test('caption and kinetic emphasis retain distinct manifest identities from entrances and sounds', async () => {
  const result = await inventory();
  assert.deepEqual(result.items.filter((item) => item.layer === 'caption-emphasis').map((item) => item.nativeId), ['accent', 'pop', 'stretch', 'underline']);
  assert.deepEqual(result.items.filter((item) => item.layer === 'kinetic-emphasis').map((item) => item.nativeId), ['accent', 'latin', 'pop', 'stretch', 'underline', 'weight']);
  assert.equal(result.countsByLayer['caption-emphasis'], 4);
  assert.equal(result.countsByLayer['kinetic-emphasis'], 6);
  for (const key of ['caption-emphasis:pop', 'kinetic-emphasis:pop', 'word-entrance:pop', 'sound-generator:pop']) {
    assert.ok(result.items.some((item) => item.key === key), key);
  }
  const emphasis = result.items.find((item) => item.key === 'kinetic-emphasis:weight');
  assert.equal(emphasis.parentKey, 'scene:kinetic-text');
  assert.equal(emphasis.reachability.manifest, 'declared');
  assert.ok(result.sources.some((source) => source.path === 'engine/src/prepared-edit/caption-emphasis.ts'));
});

test('concept duration floors retain their authored fps and scale for 50 and 60 fps projects', async () => {
  const result = await inventory();
  const concept = result.items.find((item) => item.key === 'concept:button-to-window');
  assert.equal(concept.baseFps, 30);
  assert.equal(concept.minFrames, 150);
  assert.equal(concept.minDurationSec, 5);
  assert.deepEqual(concept.minFramesByFps, {'30': 150, '50': 250, '60': 300});
  assert.equal(concept.defaultDurationSec, 8);
  assert.ok(concept.sourcePaths.includes('engine/src/motion-concepts/types.ts'));
  assert.ok(concept.sourcePaths.includes('engine/src/motion-concepts/timeline.ts'));
});

test('transition subsets count once and source evidence is portable and reproducible', async () => {
  const first = await inventory();
  const second = await inventory();
  assert.deepEqual(first, second);
  for (const [layer, count] of Object.entries({overlay: 10, 'graphics-transition': 12, 'layout-transition': 2,
    'scene-entrance': 3, 'word-entrance': 3, camera: 7})) assert.equal(first.countsByLayer[layer], count, layer);
  assert.equal(first.items.filter((item) => item.nativeId === 'whip-pan').length, 1);
  const source = first.sources.find((item) => item.path === 'engine/src/styles/registry.ts');
  assert.equal(source.sha256, sha((await fs.readFile(path.join(ROOT, source.path),'utf8')).replace(/\r\n/g,'\n')));
  for (const item of first.sources) {
    assert.equal(path.isAbsolute(item.path), false);
    assert.doesNotMatch(item.path, /^(Raw|Projects|Outputs|PROFILE\.json)(?:\/|$)/i);
  }
  const evidencePaths = new Set(first.sources.map((source) => source.path));
  for (const item of first.items) for (const source of item.sourcePaths) assert.ok(evidencePaths.has(source), `${item.key}: ${source}`);
  assert.ok(first.unresolved.some((issue) => issue.code === 'legacy-provenance-path'));
});

test('custom root is read only and primitive TSX is parsed without executing it or scanning personal data', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reel-library-inventory-'));
  t.after(async () => { await fs.rm(root, {recursive: true, force: true}); });
  const files = {
    'engine/src/core/transitions.tsx': 'throw new Error("TSX must never execute");\nexport type Hidden = string;\nexport const Example = () => <div/>;\nconst Local = () => null;\nexport {Local as Alias};\n',
    'Raw/private.tsx': 'export const PrivateRaw = () => <div/>;',
    'Projects/private.tsx': 'export const PrivateProject = () => <div/>;',
    'Outputs/private.tsx': 'export const PrivateOutput = () => <div/>;',
    'PROFILE.json': '{"private":"do not read"}',
    'scripts/lib/project-tmp.mjs': 'throw new Error("must not import project-tmp");',
    'scripts/lib/editor-director.mjs': 'throw new Error("must not import editor-director");',
  };
  for (const [file, text] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, file)), {recursive: true});
    await fs.writeFile(path.join(root, file), text);
  }
  const before = await tree(root);
  const result = await inventory({root});
  assert.deepEqual(await tree(root), before);
  assert.deepEqual(result.items.filter((item) => item.layer === 'primitive').map((item) => item.nativeId), ['Alias', 'Example']);
  assert.equal(result.items.some((item) => /Hidden|Private/.test(item.nativeId)), false);
  assert.ok(result.unresolved.some((issue) => issue.code === 'source-unavailable'));
  assert.equal(result.items.some((item) => item.key === 'style:split-canvas'), false, 'root must not fall back to the real studio');
});

test('transparent imported JSX wrappers share a primitive identity but recomposing wrappers remain distinct', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reel-library-wrapper-'));
  t.after(async () => { await fs.rm(root, {recursive: true, force: true}); });
  const upstream = 'engine/src/motion-library/upstream.tsx';
  const vendor = 'engine/src/motion-library/vendor/remotion-ui.tsx';
  await fs.mkdir(path.dirname(path.join(root, vendor)), {recursive: true});
  await fs.writeFile(path.join(root, vendor), 'throw new Error("never execute"); export const Vendor = () => <div/>;');
  await fs.writeFile(path.join(root, upstream), [
    'throw new Error("never execute");',
    'import {Vendor as Imported} from "./vendor/remotion-ui";',
    'export const DirectAlias = Imported;',
    'export const Forward = (props: {title: string}) => <Imported {...props}/>;',
    'export const Modified = (props: {title: string}) => <Imported {...props} title="changed"/>;',
    'export const Wrapped = (props: {title: string}) => <div><Imported {...props}/></div>;',
    'export const Named = (props: {title: string}) => <Imported title={props.title}/>;',
    'export const SideEffect = (props: {title: string}) => { console.log("side effect"); return <Imported {...props}/>; };',
  ].join('\n'));
  const before = await tree(root), result = await inventory({root});
  const item = (name) => result.items.find((entry) => entry.key === `primitive:${upstream}#${name}`);
  assert.equal(item('Forward').variantOf, `primitive:${vendor}#Vendor`);
  assert.equal(item('DirectAlias').variantOf, `primitive:${vendor}#Vendor`);
  for (const name of ['Modified', 'Wrapped', 'Named', 'SideEffect']) assert.equal(item(name).variantOf, null, name);
  assert.equal(result.items.length, 7, 'wrappers stay inspectable as records');
  assert.equal(result.countsByLayer.primitive, 5, 'exact forwarding wrappers do not add a capability');
  assert.deepEqual(await tree(root), before);
});

test('foreign roots cannot execute metadata modules or their personal-data imports', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reel-library-untrusted-'));
  t.after(async () => { await fs.rm(root, {recursive: true, force: true}); });
  const registry = 'engine/src/styles/registry.ts';
  await fs.mkdir(path.dirname(path.join(root, registry)), {recursive: true});
  await fs.mkdir(path.join(root, 'Raw'));
  await fs.writeFile(path.join(root, 'Raw', 'personal.mjs'), 'import {writeFileSync} from "node:fs"; writeFileSync(new URL("../executed.txt", import.meta.url), "executed");');
  await fs.writeFile(path.join(root, registry), 'import "../../../Raw/personal.mjs"; export const STYLE_METAS = [];');
  const before = await tree(root), result = await inventory({root});
  assert.deepEqual(await tree(root), before);
  assert.ok(result.sources.some((source) => source.path === registry), 'the foreign source can still be hashed as text');
  assert.ok(result.unresolved.some((issue) => issue.code === 'metadata-import-skipped' && issue.source === registry));
  assert.equal(result.sources.some((source) => source.path.startsWith('Raw/')), false);
});

async function tree(root) {
  const records = [];
  async function visit(dir) {
    for (const entry of (await fs.readdir(dir, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name), relative = path.relative(root, file).split(path.sep).join('/');
      if (entry.isDirectory()) { records.push([relative]); await visit(file); }
      else { const stat = await fs.stat(file); records.push([relative, stat.mtimeMs, sha(await fs.readFile(file))]); }
    }
  }
  await visit(root);
  return records;
}

test('CLI exposes inventory, kind filtering, Arabic search and qualified lookup as JSON', async () => {
  const full = cli('inventory');
  assert.equal(full.status, 0, full.stderr);
  const {editSceneSchema}=await import('../engine/src/prepared-edit/schema.ts');
  assert.equal(JSON.parse(full.stdout).countsByLayer.scene, editSceneSchema.def.left.options.length);
  const listed = cli('list', '--kind', 'concept');
  assert.equal(listed.status, 0, listed.stderr);
  const {CATALOG}=await import('../engine/src/motion-concepts/catalog.ts');
  assert.equal(JSON.parse(listed.stdout).items.length, CATALOG.length);
  assert.ok(JSON.parse(listed.stdout).items.every((item) => item.kind === 'concept'));
  const searched = cli('search', '--query', 'أتمتة', '--kind', 'concept', '--limit', '1');
  assert.equal(searched.status, 0, searched.stderr);
  assert.deepEqual(JSON.parse(searched.stdout).items.map((item) => item.key), ['concept:automation-flow']);
  const shown = cli('show', 'scene:data-story');
  assert.equal(shown.status, 0, shown.stderr);
  assert.equal(JSON.parse(shown.stdout).item.nativeId, 'data-story');
});

test('Markdown describes evidence limits and unknown queries do not invent a matching item', () => {
  const rendered = cli('inventory', '--format', 'markdown');
  assert.equal(rendered.status, 0, rendered.stderr);
  assert.match(rendered.stdout, /^# Reel Studio library inventory/m);
  assert.match(rendered.stdout, /unassessed/);
  assert.match(rendered.stdout, /scene:data-story/);
  const empty = cli('search', '--query', 'no-such-capability-xyz');
  assert.equal(empty.status, 0, empty.stderr);
  assert.deepEqual(JSON.parse(empty.stdout).items, []);
  assert.ok(JSON.parse(empty.stdout).hint);
});

test('CLI refuses ambiguous lookup and unsupported write options', () => {
  for (const args of [['show', 'data-story'], ['show', 'scene:missing'], ['list', '--kind', 'asset'],
    ['search'], ['search', '--query', 'data', '--limit', '0'], ['inventory', '--out', 'Raw/unsafe.json'],
    ['inventory', '--format', 'html'], ['render'], ['list', 'extra']]) {
    const result = cli(...args);
    assert.notEqual(result.status, 0, args.join(' '));
    assert.equal(result.stdout, '', args.join(' '));
    assert.match(result.stderr, /library:/, args.join(' '));
  }
});
