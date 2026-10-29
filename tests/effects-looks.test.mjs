// The six curated effects built on @remotion/effects (looks film and paper, overlay pixel-curtain, backdrops sunburst and paper) and the
// one place that pins the render browser's GL backend. Every effect here is a layer of its own (a <Solid>), never an effect on the scene's pixels.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {BACKDROP_KINDS, LOOK_KINDS, lookCaptionGuard, lookSchema} from '../engine/src/looks/index.ts';
import {OVERLAY_KINDS, TRANSITION_KINDS, graphicsTransitionIssues, isCentredKind} from '../engine/src/prepared-edit/graphics-transitions.ts';
import {editManifestSchema, transitionSchema} from '../engine/src/prepared-edit/schema.ts';
import {arabicTypeDataSchema} from '../engine/src/arabic-type/schema.ts';
import {TRANSITION_DEFAULTS, addTransition} from '../engine/src/review-editor/ops/events.ts';
import {LOOK_OPTIONS, setLook} from '../engine/src/review-editor/ops/look.ts';
import {LOOK_EFFECT_LABEL} from '../engine/src/review-editor/panels/look-state.ts';
import {enumOptionLabel} from '../engine/src/review-editor/panels/form-schema.ts';
import {getPreviewDefinition, previewDefinitions, previewFixtureIssues} from '../engine/src/library-preview/fixtures.ts';
import {collectLibraryInventory} from '../scripts/lib/library-inventory.mjs';
import {editCues} from '../scripts/lib/scene-cues.mjs';
import {RENDER_GL, renderChromiumOptions} from '../scripts/lib/render-gl.mjs';
import {contrastRatio} from '../engine/src/core/chapters.ts';
import {bundleEngine, setSsrFrame} from './helpers/engine-bundle.mjs';
import {transitionSample} from './helpers/ssr-frames.mjs';
import {reviewManifest} from './helpers/review-manifest.mjs';
import {dialectIn} from './helpers/dialect.mjs';

const read = async (file) => (await readFile(new URL(`../${file}`, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const arabic = /\p{Script=Arabic}/u;

// ---- the HTML of a frame, read back ---------------------------------------------------------------------------------------------------
const decode = (text) => text.replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
/** Every <Solid> of a frame as {color, effects:[{type, params}], style}: the test stand-in writes the effect list into the canvas. */
const solids = (html) => [...html.matchAll(/<canvas\b([^>]*)>/g)].map((match) => {
  const attrs = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], decode(a[2])]));
  return {color: attrs['data-solid'], effects: JSON.parse(attrs['data-effects'] || '[]'), style: attrs.style ?? '', width: Number(attrs.width), height: Number(attrs.height)};
});
// The type names differ in style (dev.remotion.effects.noise, remotion/starburst): compare the letters only.
const letters = (text) => text.toLowerCase().replace(/[^a-z]/g, '');
const effect = (layer, name) => layer.effects.find((item) => letters(item.type).endsWith(letters(name))) ?? assert.fail(`${name} is not in ${JSON.stringify(layer.effects.map((item) => item.type))}`);

const mod = await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {SafeRoot} from './engine/src/core/safe';
  import {LookLayer} from './engine/src/looks/layer';
  import {Backdrop} from './engine/src/looks/backdrop';
  import {TRANSITIONS} from './engine/src/prepared-edit/transition-registry';
  import {ArabicTypeSceneView} from './engine/src/arabic-type/scene';
  import {getStyleTheme} from './engine/src/styles/themes';
  import {STYLE_IDS} from './engine/src/styles/registry';
  export {sunburstTones, paperBackdropDarkest, FILM, FILM_GRAIN_MAX, PAPER_LOOK, SUNBURST, PIXEL_CURTAIN} from './engine/src/looks/effects';
  export {STYLE_IDS, getStyleTheme};
  const child = React.createElement('div', {id: 'scene-stack'}, 'scene');
  const probed = (node, probe) => renderToStaticMarkup(probe ? React.createElement(SafeRoot, {probe}, node) : node);
  export const layer = (look, probe) => probed(React.createElement(LookLayer, {look}, child), probe);
  export const backdrop = (kind, props, probe) => probed(React.createElement(Backdrop, {kind, ...props}), probe);
  export const overlay = (kind, props, probe) => probed(React.createElement(TRANSITIONS[kind].Component, props), probe);
  export const arabicScene = (backdrop, style) => renderToStaticMarkup(React.createElement(ArabicTypeSceneView, {style, scene: {id: 'type', family: 'arabic-type', fromFrame: 0, durationInFrames: 120, layout: 'takeover', motion: 'land',
    data: {text: 'فكرة واضحة', move: 'decrypt', ...(backdrop ? {backdrop} : {})}}}));
`, {ssr: true, media: true, plateStub: true});
const stack = '<div id="scene-stack">scene</div>';

// ---- kinds and schemas ------------------------------------------------------------------------------------------------------------------
test('the new kinds are registered: two looks, one overlay and two backdrops, and unknown names are still refused', () => {
  assert.deepEqual([...LOOK_KINDS], ['riso', 'blueprint', 'film', 'paper']);
  assert.deepEqual([...BACKDROP_KINDS], ['girih', 'sunburst', 'paper']);
  assert.ok(OVERLAY_KINDS.includes('pixel-curtain') && TRANSITION_KINDS.includes('pixel-curtain'));
  for (const kind of ['film', 'paper']) {
    assert.deepEqual(lookSchema.parse({kind}), {kind});
    assert.equal(lookSchema.safeParse({kind, inks: ['#0078bf', '#ff48b0']}).success, false, `${kind} has no inks: they belong to riso`);
    assert.equal(lookSchema.safeParse({kind, strength: 1}).success, false, `${kind} takes no other option`);
    assert.equal(editManifestSchema.safeParse({...reviewManifest('fx-look'), look: {kind}}).success, true, kind);
  }
  assert.equal(lookSchema.safeParse({kind: 'sepia'}).success, false);
  assert.equal(transitionSchema.safeParse({atFrame: 60, durationInFrames: 24, kind: 'pixel-curtain'}).success, true);
  assert.equal(transitionSchema.safeParse({atFrame: 60, durationInFrames: 24, kind: 'pixel-curtian'}).success, false);
  for (const backdrop of ['plain', ...BACKDROP_KINDS]) assert.equal(arabicTypeDataSchema.safeParse({text: 'فكرة', move: 'decrypt', backdrop}).success, true, backdrop);
  assert.equal(arabicTypeDataSchema.safeParse({text: 'فكرة', move: 'decrypt', backdrop: 'plaid'}).success, false);
});

// ---- looks: film and paper ----------------------------------------------------------------------------------------------------------------
test('film keeps the picture and adds one layer above it: a vignette and a grain that moves with the frame', () => {
  setSsrFrame(12);
  const html = mod.layer({kind: 'film'});
  assert.equal(html.split(stack).length, 2, 'the scene stack is drawn once, unchanged');
  assert.ok(html.indexOf(stack) < html.indexOf('<canvas'), 'the film layer is above the picture');
  const layers = solids(html);
  assert.equal(layers.length, 1);
  const [film] = layers;
  assert.deepEqual([film.width, film.height], [1080, 1920]);
  assert.match(film.style, /mix-blend-mode:\s*(overlay|soft-light)/, 'blended into the picture, not drawn over it');
  assert.match(film.style, /pointer-events:\s*none/);
  const grain = effect(film, 'noise'), vignette = effect(film, 'vignette');
  assert.ok(grain.params.amount > 0 && grain.params.amount <= mod.FILM_GRAIN_MAX, `grain amount ${grain.params.amount} stays light enough for captions`);
  assert.ok(mod.FILM_GRAIN_MAX <= 0.12);
  assert.ok(vignette.params.amount > 0 && vignette.params.amount <= 0.5, 'the vignette darkens the corners, not the middle');
  const seeds = [12, 13, 14, 40].map((frame) => { setSsrFrame(frame); return effect(solids(mod.layer({kind: 'film'}))[0], 'noise').params.seed; });
  assert.equal(new Set(seeds).size, seeds.length, 'a new grain every frame');
  setSsrFrame(12);
  assert.equal(mod.layer({kind: 'film'}), html, 'a frame is a pure function of its number');
});

test('paper prints the picture on a fixed sheet: multiplied over it, the same on every frame, never a flicker', () => {
  setSsrFrame(3);
  const html = mod.layer({kind: 'paper'});
  assert.equal(html.split(stack).length, 2);
  assert.ok(html.indexOf(stack) < html.indexOf('<canvas'));
  const [sheet] = solids(html);
  assert.match(sheet.style, /mix-blend-mode:\s*multiply/, 'a multiply never lightens the picture');
  const opacity = Number(/opacity:\s*([\d.]+)/.exec(sheet.style)?.[1]);
  assert.ok(opacity > 0 && opacity <= 0.8, `the sheet is partly transparent (${opacity}) so faces and type stay natural`);
  const texture = effect(sheet, 'paper');
  assert.equal(texture.params.folds, 0, 'no fold lines across a face');
  assert.ok(texture.params.amount <= 0.6);
  for (const frame of [0, 37, 119, 400]) { setSsrFrame(frame); assert.equal(mod.layer({kind: 'paper'}), html, `frame ${frame} draws the same sheet`); }
  assert.deepEqual(effect(sheet, 'paper').params, mod.PAPER_LOOK.texture, 'the sheet parameters are the exported constants');
});

test('under the safe-zone probe a look is a pass-through: the picture only, no layer, no canvas', () => {
  setSsrFrame(10);
  assert.equal(mod.layer(undefined), stack);
  for (const kind of ['film', 'paper']) {
    const probed = mod.layer({kind}, '#00ff00');
    assert.ok(probed.includes(stack), kind);
    assert.doesNotMatch(probed, /<canvas|<svg|<filter/, `${kind}: nothing is added under the probe`);
  }
});

test('captions stay unbacked under film and paper: the layer is light and a multiply can only darken', () => {
  for (const kind of ['film', 'paper']) {
    assert.equal(lookCaptionGuard({kind}, 'transparent'), null, `${kind}: a transparent caption needs no chip`);
    assert.equal(lookCaptionGuard({kind}, '#ffffff'), null);
  }
  assert.notEqual(lookCaptionGuard({kind: 'riso'}, 'transparent'), null, 'riso keeps its chip');
  assert.notEqual(lookCaptionGuard({kind: 'blueprint'}, 'transparent'), null, 'blueprint keeps its chip');
  assert.ok(mod.FILM.grain <= mod.FILM_GRAIN_MAX, 'the one reason film needs no chip: its grain stays under the caption limit');
  assert.equal(mod.PAPER_LOOK.blend, 'multiply', 'the one reason paper needs no chip');
});

test('the editor offers both looks with an Arabic label and accepts them for any video', () => {
  assert.equal(LOOK_OPTIONS.looks, LOOK_KINDS);
  assert.deepEqual(Object.keys(LOOK_EFFECT_LABEL).sort(), ['none', ...LOOK_KINDS].sort());
  assert.equal(LOOK_EFFECT_LABEL.film, 'حبيبات فيلم');
  assert.equal(LOOK_EFFECT_LABEL.paper, 'ورق');
  const manifest = reviewManifest('fx-editor');
  for (const kind of ['film', 'paper']) {
    const result = setLook(manifest, {look: {kind}});
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(result.manifest.look, {kind});
  }
  assert.equal(setLook(manifest, {look: {kind: 'film', inks: ['#0078bf', '#ff48b0']}}).ok, false);
  assert.equal(setLook(manifest, {look: {kind: 'sepia'}}).ok, false);
});

// ---- overlay: pixel-curtain ---------------------------------------------------------------------------------------------------------------
const curtain = (frame, props = {}, probe) => { setSsrFrame(frame); return mod.overlay('pixel-curtain', {atFrame: 60, durationInFrames: 24, fps: 30, paper: '#123456', ...props}, probe); };
const dissolve = (html) => effect(solids(html)[0], 'pixelDissolve').params.progress;

test('pixel-curtain is a centred overlay: it covers the whole frame at atFrame and half its duration follows', () => {
  assert.equal(isCentredKind('pixel-curtain'), true);
  assert.equal(TRANSITION_DEFAULTS['pixel-curtain'].durationInFrames, 24);
  const edit = transitionSample('pixel-curtain');
  edit.transitions[0] = {kind: 'pixel-curtain', atFrame: 165, durationInFrames: 24};
  assert.equal(editManifestSchema.safeParse(edit).success, true, 'the tail is only half the duration');
  edit.transitions[0].atFrame = 175;
  assert.equal(editManifestSchema.safeParse(edit).success, false, 'half the duration must still fit before the end');
  assert.deepEqual(graphicsTransitionIssues([{kind: 'pixel-curtain', atFrame: 61, durationInFrames: 24}], transitionSample('whiteout').scenes), [], 'an overlay needs no scene boundary');
  const added = addTransition(transitionSample('whiteout'), {kind: 'pixel-curtain', atFrame: 65});
  assert.equal(added.ok, true, added.reason);
});

test('the curtain builds from nothing, is solid at atFrame and dissolves away to the incoming scene', () => {
  assert.equal(curtain(48), '', 'not live before its first half');
  assert.equal(curtain(72), '', 'gone after its second half');
  const cover = curtain(60);
  assert.match(cover, /data-cut-cover="full"/);
  assert.equal(dissolve(cover), 0, 'nothing dissolved: every cell of the curtain is there');
  const [layer] = solids(cover);
  assert.deepEqual([layer.width, layer.height], [1080, 1920], 'the layer is the whole frame');
  assert.equal(layer.color.toLowerCase(), '#123456', 'the colour is the style theme background handed in as paper');
  assert.doesNotMatch(curtain(59), /data-cut-cover/, 'only the cut frame carries the full-cover mark');
  const building = [49, 52, 54, 57, 59].map((frame) => dissolve(curtain(frame)));
  const opening = [61, 63, 66, 68, 71].map((frame) => dissolve(curtain(frame)));
  assert.deepEqual([...building].sort((a, b) => b - a), building, 'the first half only builds');
  assert.deepEqual([...opening].sort((a, b) => a - b), opening, 'the second half only dissolves');
  assert.ok(building[0] > 0.8 && opening.at(-1) > 0.8, 'it starts and ends almost empty');
  assert.ok(Math.abs(dissolve(curtain(54)) - 0.5) < 0.1 && Math.abs(dissolve(curtain(66)) - 0.5) < 0.1, 'half covered at a quarter and three quarters of the duration');
  assert.equal(curtain(54), curtain(54), 'deterministic');
  assert.doesNotMatch(curtain(54), /NaN|Infinity|undefined/);
});

test('the curtain paints nothing under the probe and falls back to a dark ground without a theme colour', () => {
  assert.doesNotMatch(curtain(60, {}, '#00ff00'), /<canvas|data-cut-cover/);
  assert.match(solids(curtain(60, {paper: undefined}))[0].color, /^#[0-9a-f]{6}$/i);
});

test('the editor, the previews and the sound treat pixel-curtain like every overlay', () => {
  const preview = getPreviewDefinition('overlay:pixel-curtain');
  assert.equal(preview.fixture.preset, 'pixel-curtain');
  assert.deepEqual(previewFixtureIssues(preview), []);
  assert.equal(preview.labelAr, 'طبقة انتقال · ستارة بكسلات');
  const manifest = transitionSample('pixel-curtain');
  assert.deepEqual(editCues(manifest).filter((cue) => cue.kind === 'transition' && cue.frame === 60), [{frame: 60, kind: 'transition', sceneId: 'new'}],
    'the generic transition cue lands on the covered cut, and no recipe names a sweep');
});

// ---- backdrops: sunburst and paper -----------------------------------------------------------------------------------------------------------
test('sunburst draws two warm tones in rotating rays and paper draws a textured sheet, both as a layer of their own', () => {
  setSsrFrame(0);
  const sun = solids(mod.backdrop('sunburst', {colour: '#e2b85f', ground: '#102027'}));
  assert.equal(sun.length, 1);
  const rays = effect(sun[0], 'starburst').params;
  assert.ok(rays.rays >= 8 && rays.rays % 2 === 0, `${rays.rays} rays alternate the two tones`);
  assert.equal(rays.colors.length, 2);
  assert.ok(rays.rotation !== 0 && rays.rotation > 0 && rays.rotation < 360, 'rotation is never zero: at zero the ray phase differs between GL backends');
  const turn = (frame) => { setSsrFrame(frame); return effect(solids(mod.backdrop('sunburst', {colour: '#e2b85f', ground: '#102027'}))[0], 'starburst').params.rotation; };
  assert.notEqual(turn(0), turn(60), 'the rays turn slowly');
  assert.ok(Math.abs(turn(60) - turn(0)) < 30, 'a calm turn, not a spin');
  assert.equal(turn(60), turn(60), 'deterministic');
  const sheet = solids(mod.backdrop('paper', {ground: '#f3ead8'}));
  assert.equal(sheet.length, 1);
  assert.ok(effect(sheet[0], 'paper').params.amount > 0);
  assert.equal(sheet[0].color.toLowerCase(), '#ffffff', "a white sheet: the style's ground shows through the multiply");
  assert.match(sheet[0].style, /mix-blend-mode:s*multiply/);
  assert.equal(effect(sheet[0], 'paper').params.folds, 0);
  setSsrFrame(0);
  const a = mod.backdrop('paper', {ground: '#f3ead8'});
  setSsrFrame(150);
  assert.equal(mod.backdrop('paper', {ground: '#f3ead8'}), a, 'the sheet does not change with the frame');
  setSsrFrame(0);
  for (const kind of ['sunburst', 'paper']) {
    assert.doesNotMatch(mod.backdrop(kind, {colour: '#e2b85f', ground: '#102027'}, '#00ff00'), /<canvas/, `${kind}: nothing under the probe`);
    assert.doesNotMatch(mod.backdrop(kind, {}), /NaN|Infinity|undefined/, `${kind} with no colours`);
  }
  assert.throws(() => mod.backdrop('plaid', {}), /backdrop/i);
});

test('the backdrop tones are the style\'s own ground tinted, so text keeps its contrast on every registered style', () => {
  for (const style of mod.STYLE_IDS) {
    const theme = mod.getStyleTheme(style);
    const ground = contrastRatio(theme.text, theme.background);
    const [strong, soft] = mod.sunburstTones(theme.accent, theme.background);
    const darkest = mod.paperBackdropDarkest(theme.background);
    for (const tone of [strong, soft]) {
      assert.match(tone, /^#[0-9a-f]{6}$/i);
      assert.ok(contrastRatio(theme.text, tone) >= Math.min(ground, 4.5) * 0.9, `${style}: text on the sunburst tone ${tone} (${contrastRatio(theme.text, tone).toFixed(2)} vs ${ground.toFixed(2)})`);
      const accentOn = contrastRatio(theme.accent, tone);
      assert.ok(accentOn >= Math.min(3, contrastRatio(theme.accent, theme.background) * 0.75), `${style}: an accent that read as large text keeps 3:1 on ${tone} (${accentOn.toFixed(2)})`);
    }
    assert.ok(contrastRatio(theme.text, darkest) >= Math.min(ground, 4.5) * 0.9, `${style}: text on the darkest paper tone ${darkest}`);
  }
});

test('arabic-type scenes take the new backdrops by name and draw nothing extra for plain', () => {
  setSsrFrame(30);
  const plain = mod.arabicScene(undefined, 'section-deck');
  // The move draws its own canvas; the layers of this family are the ones that carry data-solid.
  const layers = (html) => html.match(/data-solid=/g)?.length ?? 0;
  assert.equal(layers(plain), 0);
  assert.equal(layers(mod.arabicScene('plain', 'section-deck')), 0);
  for (const kind of ['sunburst', 'paper']) {
    const html = mod.arabicScene(kind, 'section-deck');
    assert.equal(layers(html), 1, `${kind} adds one layer`);
    assert.ok(html.indexOf('data-solid=') < html.indexOf('data-arabic-move'), `${kind} sits behind the moving text`);
    assert.match(html, /فكرة واضحة/);
  }
});

test('the scene form offers every backdrop by its Arabic name and the Effects tab names the new overlay', async () => {
  for (const [value, label] of [['plain', 'بدون خلفية'], ['girih', 'نجوم هندسية'], ['sunburst', 'شمس'], ['paper', 'ورقة']]) assert.equal(enumOptionLabel('backdrop', value), label, value);
  assert.equal(enumOptionLabel('other', 'plain'), 'plain', 'other fields keep their own values');
  const panel = await read('engine/src/review-editor/panels/effects.tsx');
  assert.match(panel, /'pixel-curtain':'ستارة بكسلات'/, 'the transition list names it');
  assert.match(panel, /"pixel-curtain": "[^"]*\p{Script=Arabic}[^"]*"/u, 'and gives it a hint');
});

test('the editor and the library name every new backdrop in Arabic', () => {
  const effects = previewDefinitions();
  for (const key of ['look:film', 'look:paper', 'backdrop:sunburst', 'backdrop:paper', 'overlay:pixel-curtain']) {
    const definition = effects.find((entry) => entry.key === key);
    assert.ok(definition, `${key} has a preview definition`);
    assert.deepEqual(previewFixtureIssues(definition), [], key);
    assert.match(definition.labelAr, arabic, key);
  }
  const labels = {film: 'حبيبات فيلم', paper: 'ورق'};
  assert.equal(effects.find((entry) => entry.key === 'look:film').labelAr, `تأثير المظهر · ${labels.film}`);
  assert.equal(effects.find((entry) => entry.key === 'backdrop:sunburst').labelAr, 'خلفية · شمس');
  assert.equal(effects.find((entry) => entry.key === 'backdrop:paper').labelAr, 'خلفية · ورقة');
  for (const text of ['حبيبات فيلم', 'ورق', 'شمس', 'ورقة', 'ستارة بكسلات']) assert.deepEqual(dialectIn(text), [], text);
});

test('the library inventory lists every new kind from the registries, not from a copy', async () => {
  const inventory = await collectLibraryInventory();
  for (const key of ['look:film', 'look:paper', 'backdrop:sunburst', 'backdrop:paper', 'overlay:pixel-curtain']) assert.ok(inventory.items.some((item) => item.key === key), key);
  assert.equal(inventory.countsByLayer.look, LOOK_KINDS.length);
  assert.equal(inventory.countsByLayer.backdrop, BACKDROP_KINDS.length);
  assert.equal(inventory.countsByLayer.overlay, OVERLAY_KINDS.length);
});

// ---- the layers are layers: no effect on the scene's own pixels, no element that needs a flag in the user's browser --------------------------
test('every effect is its own <Solid> layer: nothing wraps the scene, no HtmlInCanvas, no raw canvas or GL code', async () => {
  const files = ['film.tsx', 'paper.tsx', 'sunburst.tsx', 'effects.ts'];
  const present = new Set(await readdir(new URL('../engine/src/looks/', import.meta.url)));
  for (const file of files) assert.ok(present.has(file), `engine/src/looks/${file}`);
  const sources = [...files.map((file) => `engine/src/looks/${file}`), 'engine/src/core/transitions-v4/pixel-curtain.tsx'];
  for (const file of sources) {
    const text = await read(file);
    assert.doesNotMatch(text, /HtmlInCanvas/, `${file}: effects over the DOM need a browser flag and the preview would disagree with the render`);
    assert.doesNotMatch(text, /getContext\(|Math\.random|Date\.now|performance\.now|new Date\(/, file);
    if (file.endsWith('.tsx')) {
      assert.match(text, /<Solid\b/, `${file} draws its effect on a Solid`);
      assert.doesNotMatch(text, /<Img\b[^>]*effects=/, `${file}: effects are not put on the scene's own pixels`);
    }
  }
  assert.doesNotMatch(await read('engine/src/looks/layer.tsx'), /effects=\{/, 'the look wrapper itself never carries an effect');
});

// ---- the render browser's GL backend is pinned in one place -------------------------------------------------------------------------------
test('the render GL backend is swangle, merged into any chromium options already there', () => {
  assert.equal(RENDER_GL, 'swangle');
  assert.deepEqual(renderChromiumOptions(), {gl: 'swangle'});
  assert.deepEqual(renderChromiumOptions({headless: true}), {headless: true, gl: 'swangle'});
  assert.deepEqual(renderChromiumOptions({gl: 'angle'}), {gl: 'swangle'}, 'the pin wins over a stray value');
  const given = {headless: true};
  renderChromiumOptions(given);
  assert.deepEqual(given, {headless: true}, 'the caller\'s object is not changed');
});

async function* walk(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) { if (!['data', 'python', 'node_modules'].includes(entry.name)) yield* walk(path); }
    else if (entry.name.endsWith('.mjs')) yield path;
  }
}
// Not render paths: they open the browser only to run a CPU model (MediaPipe, delegate "CPU") over frames and never draw pixels that are kept.
const NOT_RENDER = new Set(['scripts/lib/matte-runtime.mjs', 'scripts/lib/reframe-runtime.mjs']);

test('every script that renders through the browser takes its options from the shared pin', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url)).replaceAll('\\', '/').replace(/\/$/, '');
  const found = [];
  for await (const path of walk(`${root}/scripts`)) {
    const file = path.slice(root.length + 1);
    if (file === 'scripts/lib/render-gl.mjs' || NOT_RENDER.has(file)) continue;
    const text = await readFile(path, 'utf8');
    const calls = [...text.matchAll(/\b(openBrowser|renderMedia|renderStill|renderFrames)\s*\(/g)];
    if (!calls.length) continue;
    found.push(file);
    assert.match(text, /render-gl\.mjs['"]/, `${file} imports the shared GL pin`);
    assert.ok((text.match(/renderChromiumOptions\(/g) ?? []).length >= 1, `${file} calls renderChromiumOptions()`);
    for (const call of calls.filter((entry) => entry[1] === 'openBrowser')) {
      const args = text.slice(call.index, call.index + 400).split('\n')[0];
      assert.match(args, /chromiumOptions:\s*renderChromiumOptions\(/, `${file}: every openBrowser call carries the pin (${args.trim().slice(0, 80)})`);
    }
  }
  for (const expected of ['scripts/render.mjs', 'scripts/stills.mjs', 'scripts/safe-check.mjs', 'scripts/head-check.mjs', 'scripts/concept-stills.mjs', 'scripts/practice.mjs', 'scripts/lib/library-preview-runner.mjs'])
    assert.ok(found.includes(expected), `${expected} was scanned`);
});

// Every frame of the audio pass still mounts the scene with its look on software GL, so a default tab count (half the cores) runs out of memory.
test('the full-length audio pass opens no more browser tabs than the picture render', async () => {
  const text = await readFile(new URL('../scripts/render.mjs', import.meta.url), 'utf8');
  const call = text.split(/\r?\n/).find((line) => /renderMedia\(\{.*codec:\s*'wav'/.test(line));
  assert.ok(call, 'render.mjs renders the full-length audio track');
  assert.match(call, /[{,]\s*concurrency\s*[,}]/, 'the audio pass takes the chosen concurrency');
  assert.match(call, /chromiumOptions:\s*renderChromiumOptions\(/);
});
