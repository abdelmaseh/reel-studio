import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {editManifestSchema} from '../engine/src/prepared-edit/schema.ts';
import {
  BACKDROP_KINDS, BLUEPRINT, DEFAULT_RISO_INKS, GIRIH_FOLDS, LOOK_KINDS, RISO_GRAIN_HOLD, RISO_PAPER, RISO_REGISTRATION,
  NOISE_TILE, base64, blueprintMarks, closedPath, girihCells, girihLattice, girihOpacity, girihProgress, girihRotation, grainOffsetAt, grainSeedAt,
  hankinStar, inkMatrixValues, inkPairIssues, lookSchema, noiseDataUri, noisePng, plateMatrixValues, polygonArea, registrationDistance, resolveInks,
  separateInks,
} from '../engine/src/looks/index.ts';
import {inflateSync} from 'node:zlib';
import {contrastRatio} from '../engine/src/core/chapters.ts';
import {bundleEngine, setSsrFrame} from './helpers/engine-bundle.mjs';
import {reviewManifest} from './helpers/review-manifest.mjs';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
const source = async (file) => (await readFile(new URL(`../${file}`, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

// ---- schema -------------------------------------------------------------------------------------------------
test('a look is one of four kinds, riso may carry two inks and nothing else is accepted', () => {
  assert.deepEqual([...LOOK_KINDS], ['riso', 'blueprint', 'film', 'paper']);
  assert.deepEqual(lookSchema.parse({kind: 'riso'}), {kind: 'riso'});
  assert.deepEqual(lookSchema.parse({kind: 'blueprint'}), {kind: 'blueprint'});
  assert.deepEqual(lookSchema.parse({kind: 'film'}), {kind: 'film'});
  assert.deepEqual(lookSchema.parse({kind: 'paper'}), {kind: 'paper'});
  const inks = ['#0078bf', '#ff48b0'];
  assert.deepEqual(lookSchema.parse({kind: 'riso', inks}), {kind: 'riso', inks});
  for (const bad of [{kind: 'vhs'}, {}, {kind: 'riso', extra: 1}, {kind: 'riso', inks: ['#0078bf']}, {kind: 'riso', inks: [...inks, '#000000']},
    {kind: 'riso', inks: ['0078bf', '#ff48b0']}, {kind: 'riso', inks: ['#0078bf', 'pink']}, {kind: 'riso', inks: ['#0078bf', '#0078bf']},
    {kind: 'blueprint', inks}, {kind: 'film', inks}, {kind: 'paper', inks}, 'riso', null]) {
    assert.equal(lookSchema.safeParse(bad).success, false, JSON.stringify(bad));
  }
});

test('the manifest root takes an optional look, keeps it through parsing and refuses a bad one', () => {
  const base = reviewManifest('look-root');
  assert.equal('look' in editManifestSchema.parse(base), false, 'no look key is added to an edit that has none');
  for (const look of [{kind: 'riso'}, {kind: 'riso', inks: ['#0078bf', '#ff48b0']}, {kind: 'blueprint'}, {kind: 'film'}, {kind: 'paper'}]) {
    const parsed = editManifestSchema.safeParse({...base, look});
    assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
    assert.deepEqual(parsed.data.look, look);
  }
  for (const look of [{kind: 'riso', inks: ['#ffffff', '#fffff0']}, {kind: 'blueprint', inks: ['#0078bf', '#ff48b0']}, {kind: 'noir'}]) {
    assert.equal(editManifestSchema.safeParse({...base, look}).success, false, JSON.stringify(look));
  }
});

// ---- riso ink pair --------------------------------------------------------------------------------------------
test('an ink pair is two different hex colours, apart enough to separate and dark enough to read on the paper', () => {
  assert.deepEqual(inkPairIssues(DEFAULT_RISO_INKS), []);
  assert.deepEqual(inkPairIssues(['#0078BF', '#FF48B0']), [], 'upper case hex is fine');
  assert.ok(inkPairIssues(['#0078bf']).length > 0, 'one ink');
  assert.ok(inkPairIssues(['#0078bf', '#ff48b0', '#000000']).length > 0, 'three inks');
  assert.ok(inkPairIssues(['#0078bf', 'ff48b0']).length > 0, 'a hex colour needs its #');
  assert.ok(inkPairIssues(['#0078bf', '#f4b']).length > 0, 'short hex is refused: the pair is always #RRGGBB');
  assert.ok(inkPairIssues(['#0078bf', '#0078bf']).length > 0, 'the same ink twice');
  assert.ok(inkPairIssues(['#0078bf', '#0a7cc0']).length > 0, 'two inks too close to unmix');
  assert.ok(inkPairIssues(['#ffe800', '#fff3a0']).length > 0, 'both inks too pale to read on paper');
  assert.deepEqual(inkPairIssues(['#ffe800', '#0078bf']), [], 'a pale ink beside a dark one is a real riso pair');
  assert.deepEqual(resolveInks(undefined), [...DEFAULT_RISO_INKS]);
  assert.deepEqual(resolveInks({kind: 'riso'}), [...DEFAULT_RISO_INKS]);
  assert.deepEqual(resolveInks({kind: 'riso', inks: ['#111111', '#d02020']}), ['#111111', '#d02020']);
  assert.ok(Math.max(...DEFAULT_RISO_INKS.map((ink) => contrastRatio(ink, RISO_PAPER))) >= 3);
});

test('two-ink separation sends white to paper, an ink colour to its own layer and black to both', () => {
  const [a, b] = DEFAULT_RISO_INKS;
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [whiteA, whiteB] = separateInks(DEFAULT_RISO_INKS, [1, 1, 1]);
  near(whiteA, 0); near(whiteB, 0);
  const [blackA, blackB] = separateInks(DEFAULT_RISO_INKS, [0, 0, 0]);
  assert.ok(blackA > 0.9 && blackB > 0.9, `black prints both inks: ${blackA} ${blackB}`);
  const [aA, aB] = separateInks(DEFAULT_RISO_INKS, rgb(a));
  assert.ok(aA > 0.8 && aB < 0.2, `the first ink colour is the first layer: ${aA} ${aB}`);
  const [bA, bB] = separateInks(DEFAULT_RISO_INKS, rgb(b));
  assert.ok(bB > 0.8 && bA < 0.2, `the second ink colour is the second layer: ${bA} ${bB}`);
  // A different pair unmixes against its own inks.
  const other = ['#111111', '#d02020'];
  const [oA, oB] = separateInks(other, rgb('#d02020'));
  assert.ok(oB > 0.8 && oA < 0.25, `${oA} ${oB}`);
  // The SVG matrix is the same linear map: 4 rows x 5 columns, alpha row keeps the picture opaque.
  const values = inkMatrixValues(DEFAULT_RISO_INKS).trim().split(/\s+/).map(Number);
  assert.equal(values.length, 20);
  assert.deepEqual(values.slice(15), [0, 0, 0, 0, 1]);
  const apply = (rgbIn, row) => Math.min(1, Math.max(0, values[row * 5] * rgbIn[0] + values[row * 5 + 1] * rgbIn[1] + values[row * 5 + 2] * rgbIn[2] + values[row * 5 + 4]));
  const sample = [0.3, 0.5, 0.2];
  const [sa, sb] = separateInks(DEFAULT_RISO_INKS, sample);
  near(apply(sample, 0), sa, 1e-5); near(apply(sample, 1), sb, 1e-5);
});

test('misregistration is a fixed 2 to 4 pixel offset between the two inks and the grain holds its seed', () => {
  const d = registrationDistance();
  assert.ok(d >= 2 && d <= 4, `offset ${d}`);
  near(d, Math.hypot(RISO_REGISTRATION.b.dx - RISO_REGISTRATION.a.dx, RISO_REGISTRATION.b.dy - RISO_REGISTRATION.a.dy));
  assert.ok(RISO_GRAIN_HOLD >= 1);
  for (let frame = 0; frame < 40; frame++) {
    assert.equal(grainSeedAt(frame), grainSeedAt(frame), 'pure');
    assert.equal(grainSeedAt(frame), grainSeedAt(frame - (frame % RISO_GRAIN_HOLD)), `frame ${frame} shares the seed of its hold`);
    const seed = grainSeedAt(frame);
    assert.ok(Number.isInteger(seed) && seed >= 1 && seed <= 30011, `seed ${seed}`);
  }
  assert.notEqual(grainSeedAt(0), grainSeedAt(RISO_GRAIN_HOLD), 'the grain boils between holds');
  for (let frame = 0; frame < 40; frame++) {
    const o = grainOffsetAt(frame, 256);
    assert.deepEqual(o, grainOffsetAt(frame - (frame % RISO_GRAIN_HOLD), 256), `frame ${frame} shares the grain place of its hold`);
    assert.ok(Number.isInteger(o.x) && Number.isInteger(o.y) && o.x >= 0 && o.x < 256 && o.y >= 0 && o.y < 256, JSON.stringify(o));
  }
  const places = new Set(Array.from({length: 40}, (_, hold) => JSON.stringify(grainOffsetAt(hold * RISO_GRAIN_HOLD, 256))));
  assert.ok(places.size >= 38, `the grain moves to a new place every hold (${places.size} of 40)`);
});

// ---- the noise tile ------------------------------------------------------------------------------------------------
test('the noise tile is a valid PNG of uniform seeded noise, identical on every call', () => {
  const png = noisePng();
  assert.deepEqual(png, noisePng(), 'same arguments, same bytes');
  assert.notDeepEqual(png, noisePng(NOISE_TILE, 7), 'another seed, another tile');
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks = {};
  for (let at = 8; at < png.length;) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.slice(at + 4, at + 8));
    const body = png.slice(at + 8, at + 8 + length);
    const crc = view.getUint32(at + 8 + length);
    assert.equal(crc32(png.slice(at + 4, at + 8 + length)), crc, `${type} checksum`);
    chunks[type] = body;
    at += 12 + length;
  }
  assert.deepEqual(Object.keys(chunks), ['IHDR', 'IDAT', 'IEND']);
  const header = new DataView(chunks.IHDR.buffer, chunks.IHDR.byteOffset, 13);
  assert.equal(header.getUint32(0), NOISE_TILE);
  assert.equal(header.getUint32(4), NOISE_TILE);
  assert.deepEqual([...chunks.IHDR.slice(8)], [8, 2, 0, 0, 0], '8-bit RGB, no interlace');
  const raw = inflateSync(chunks.IDAT);
  assert.equal(raw.length, NOISE_TILE * (1 + NOISE_TILE * 3));
  const sums = [0, 0, 0], samples = [[], [], []];
  for (let row = 0; row < NOISE_TILE; row++) {
    assert.equal(raw[row * (1 + NOISE_TILE * 3)], 0, 'no row filter');
    for (let col = 0; col < NOISE_TILE; col++) for (let c = 0; c < 3; c++) {
      const v = raw[row * (1 + NOISE_TILE * 3) + 1 + col * 3 + c];
      sums[c] += v; samples[c].push(v);
    }
  }
  const n = NOISE_TILE * NOISE_TILE;
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(sums[c] / n - 127.5) < 3, `channel ${c} is centred (mean ${sums[c] / n})`);
  const corr = (a, b) => {
    const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
    let ab = 0, aa = 0, bb = 0;
    for (let i = 0; i < n; i++) { ab += (a[i] - ma) * (b[i] - mb); aa += (a[i] - ma) ** 2; bb += (b[i] - mb) ** 2; }
    return ab / Math.sqrt(aa * bb);
  };
  assert.ok(Math.abs(corr(samples[0], samples[1])) < 0.05, 'plate 1 and plate 2 grain are independent');
  assert.ok(Math.abs(corr(samples[0], samples[0].slice(1).concat(samples[0][0]))) < 0.05, 'neighbouring pixels are independent');
  const uri = noiseDataUri();
  assert.ok(uri.startsWith('data:image/png;base64,'));
  assert.deepEqual([...Buffer.from(uri.slice(22), 'base64')], [...png], 'the data URI is the PNG');
  assert.equal(base64(new Uint8Array([1, 2, 3, 4])), Buffer.from([1, 2, 3, 4]).toString('base64'));
  assert.equal(base64(new Uint8Array([255, 254])), Buffer.from([255, 254]).toString('base64'));
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

// ---- blueprint ------------------------------------------------------------------------------------------------
test('blueprint line work reads on its blue paper and its marks stay in the safe zone', () => {
  assert.ok(contrastRatio(BLUEPRINT.line, BLUEPRINT.paper) >= 9, 'white line work on the paper');
  assert.ok(contrastRatio(BLUEPRINT.line, BLUEPRINT.light) >= 4.5, 'and on the lightest fill');
  const profile = JSON.parse(readFileSync(new URL('../engine/src/core/platform/instagram-reels.json', import.meta.url), 'utf8')).profiles['ig-reels-organic'];
  const {segments, circles} = blueprintMarks();
  assert.ok(segments.length >= 12 && circles.length >= 3);
  // The studio's own rule (core/safe.tsx inDeadZone): outside the box or on the action rail is a dead zone.
  const inside = (x, y) => !(y < profile.top || y >= profile.bottom || x < profile.left || x >= profile.right || (x >= profile.rail.x && y >= profile.rail.y));
  for (const [x1, y1, x2, y2] of segments) {
    assert.ok(inside(x1, y1) && inside(x2, y2), `segment ${x1},${y1} ${x2},${y2} leaves the safe zone`);
    // The midpoint matters as well: a long segment may only cross the rail region through its ends.
    assert.ok(inside((x1 + x2) / 2, (y1 + y2) / 2), `segment ${x1},${y1} ${x2},${y2} crosses the rail`);
  }
  for (const [cx, cy, r] of circles) assert.ok(inside(cx - r, cy - r) && inside(cx + r, cy + r), `circle ${cx},${cy}`);
});

// ---- girih ------------------------------------------------------------------------------------------------------
test('the Hankin star of a regular polygon has 2n points and the radii the construction promises', () => {
  for (const [n, theta] of [[8, Math.PI / 4], [6, Math.PI / 3], [12, Math.PI / 3], [4, Math.PI / 4], [3, Math.PI / 3]]) {
    const apothem = 7.5, rot = 0.3;
    const {outer, inner, loop} = hankinStar(n, apothem, rot, theta);
    assert.equal(outer.length, n);
    assert.equal(inner.length, n);
    assert.equal(loop.length, 2 * n);
    for (const p of outer) near(Math.hypot(p.x, p.y), apothem, 1e-9);
    const r = apothem * Math.cos(theta) / Math.cos(theta - Math.PI / n);
    for (const p of inner) near(Math.hypot(p.x, p.y), r, 1e-9);
    // Each arm leaves the edge midpoint at the contact angle: the chord from an outer to the next inner point.
    const arm = {x: inner[0].x - outer[0].x, y: inner[0].y - outer[0].y};
    const tangent = {x: -Math.sin(rot), y: Math.cos(rot)};
    const angle = Math.acos((arm.x * tangent.x + arm.y * tangent.y) / Math.hypot(arm.x, arm.y));
    near(angle, theta, 1e-9);
  }
  // The classic eight-point star: the inner radius of {8/2}.
  near(hankinStar(8, 1, 0, Math.PI / 4).inner[0].x ** 2 + hankinStar(8, 1, 0, Math.PI / 4).inner[0].y ** 2, (Math.cos(Math.PI / 4) / Math.cos(Math.PI / 8)) ** 2, 1e-12);
});

test('each lattice tiles the plane: the polygons of N x M anchors add up to the area of their period', () => {
  const pitch = 240;
  const periods = {8: pitch * pitch, 6: Math.sqrt(3) / 2 * pitch * pitch, 12: Math.sqrt(3) / 2 * pitch * pitch};
  assert.deepEqual([...GIRIH_FOLDS], [6, 8, 12]);
  for (const fold of GIRIH_FOLDS) {
    const cells = girihLattice(fold, pitch, 0, 5, 0, 4);
    const total = cells.reduce((sum, cell) => sum + Math.abs(polygonArea(cell.outline)), 0);
    near(total / (5 * 4 * periods[fold]), 1, 1e-9);
    for (const cell of cells) {
      assert.equal(cell.outline.length, cell.sides);
      assert.equal(cell.star.length, 2 * cell.sides);
    }
  }
  const kinds = (fold) => [...new Set(girihLattice(fold, pitch, 0, 1, 0, 1).map((cell) => cell.shape))].sort();
  assert.deepEqual(kinds(8), ['octagon', 'square']);
  assert.deepEqual(kinds(6), ['hexagon']);
  assert.deepEqual(kinds(12), ['dodecagon', 'triangle']);
});

test('neighbouring cells meet at the midpoint of their shared edge, so the star lines run on without a break', () => {
  for (const fold of GIRIH_FOLDS) {
    const cells = girihCells({fold, pitch: 200, radius: 900});
    const key = (p) => `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)}`;
    const owners = new Map();
    for (const cell of cells) for (let i = 0; i < cell.star.length; i += 2) {
      const k = key(cell.star[i]);
      owners.set(k, (owners.get(k) ?? 0) + 1);
    }
    let checked = 0;
    for (const cell of cells) {
      if (Math.hypot(cell.cx, cell.cy) > 450) continue;
      for (let i = 0; i < cell.star.length; i += 2) {
        assert.equal(owners.get(key(cell.star[i])), 2, `fold ${fold} ${cell.id} point ${i / 2} touches exactly one neighbour`);
        checked++;
      }
    }
    assert.ok(checked > 40, `fold ${fold} checked ${checked}`);
  }
});

test('the girih construction is deterministic and covers the requested disk', () => {
  for (const fold of GIRIH_FOLDS) {
    const options = {fold, pitch: 240, radius: 1500, centre: {x: 540, y: 760}};
    const first = girihCells(options), second = girihCells({...options});
    assert.equal(JSON.stringify(first), JSON.stringify(second));
    assert.ok(first.length > 30, `fold ${fold}: ${first.length} cells`);
    assert.equal(new Set(first.map((cell) => cell.id)).size, first.length, 'ids are unique');
    assert.ok(first.every((cell) => Math.hypot(cell.cx - 540, cell.cy - 760) <= 1500 + 1e-6));
    // The frame corners are covered by a cell whose outline contains them (no gaps in the plane).
    for (const [x, y] of [[0, 0], [1080, 0], [0, 1920], [1080, 1920], [540, 960]]) {
      assert.ok(first.some((cell) => contains(cell.outline, x, y)), `fold ${fold}: ${x},${y} is covered`);
    }
  }
  const d = closedPath([{x: 1, y: 2}, {x: 3.14159, y: 4}, {x: 5, y: 6.006}]);
  assert.equal(d, 'M1 2L3.14 4L5 6.01Z');
});
function contains(polygon, x, y) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

test('the draw-on timeline spreads from the centre, settles to a faint texture and rotates slowly', () => {
  const centre = {x: 540, y: 760};
  const near0 = {cx: 540, cy: 760}, far = {cx: 540 + 900, cy: 760};
  assert.equal(girihProgress(near0, centre, 0), 0);
  assert.ok(girihProgress(near0, centre, 0.3) > 0 && girihProgress(near0, centre, 0.3) < 1);
  assert.equal(girihProgress(near0, centre, 0.6), 1);
  assert.equal(girihProgress(far, centre, 0.5), 0, 'the far cell has not started');
  assert.equal(girihProgress(far, centre, 0.9 * 0.8 + 0.6), 1, 'and finishes after its delay');
  assert.ok(girihProgress(near0, centre, 0.3, 2) > girihProgress(near0, centre, 0.3, 1), 'speed shortens the draw');
  near(girihOpacity(0, {}), 0.5);
  near(girihOpacity(1.5, {}), 0.5);
  near(girihOpacity(2.3, {}), 0.15);
  near(girihOpacity(5, {}), 0.15);
  assert.ok(girihOpacity(1.9, {}) < 0.5 && girihOpacity(1.9, {}) > 0.15);
  assert.ok(girihOpacity(4.3, {out: 4}) < 0.15, 'the exit starts at 4 s and fades below the resting opacity');
  assert.equal(girihOpacity(4.7, {out: 4}), 0);
  near(girihRotation(5, 1), 10);
  near(girihRotation(5, 2), 20);
});

// ---- the components ---------------------------------------------------------------------------------------------
const mod = await bundleEngine(`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {SafeRoot} from './engine/src/core/safe';
  import {LookLayer} from './engine/src/looks/layer';
  import {GirihBackdrop} from './engine/src/looks/girih';
  import {Backdrop} from './engine/src/looks/backdrop';
  const child = React.createElement('div', {id: 'scene-stack'}, 'scene');
  export const layer = (look, probe) => {
    const node = React.createElement(LookLayer, {look}, child);
    return renderToStaticMarkup(probe ? React.createElement(SafeRoot, {probe}, node) : node);
  };
  export const girih = (props, probe) => {
    const node = React.createElement(GirihBackdrop, props);
    return renderToStaticMarkup(probe ? React.createElement(SafeRoot, {probe}, node) : node);
  };
  export const backdrop = (kind, props) => renderToStaticMarkup(React.createElement(Backdrop, {kind, ...props}));
`, {ssr: true});
const stack = '<div id="scene-stack">scene</div>';

test('no look draws exactly the scene stack, and a probe frame never gets a filter or an overlay', () => {
  setSsrFrame(10);
  assert.equal(mod.layer(undefined), stack);
  for (const look of [{kind: 'riso'}, {kind: 'blueprint'}]) {
    assert.equal(mod.layer(look, '#00ff00').includes('<filter'), false, `${look.kind}: no filter under the probe`);
    const probed = mod.layer(look, '#00ff00');
    assert.ok(probed.includes(stack), `${look.kind}: the scene stack is still drawn under the probe`);
    assert.doesNotMatch(probed, /<svg|<pattern|<line|<path/, `${look.kind}: no overlay under the probe`);
  }
});

test('riso draws the stack through a two-ink filter with offset layers and a boiling grain', () => {
  setSsrFrame(0);
  const html = mod.layer({kind: 'riso'});
  assert.equal(html.split(stack).length, 2, 'the stack is drawn once');
  for (const part of ['<filter', '<feColorMatrix', '<feOffset', 'mode="multiply"', 'filter:url(#', 'background-image:url(data:image/png;base64,']) assert.ok(html.includes(part), part);
  assert.equal(html.includes('<feTurbulence'), false, 'the grain is a cached bitmap, not a per-frame turbulence');
  const [a, b] = DEFAULT_RISO_INKS;
  assert.ok(html.includes(plateMatrixValues(a, 'r', 14, 0.95)), 'plate 1 is printed in the first ink');
  assert.ok(html.includes(plateMatrixValues(b, 'g', 14, 0.95)), 'plate 2 is printed in the second ink');
  assert.ok(html.toLowerCase().includes(RISO_PAPER));
  setSsrFrame(RISO_GRAIN_HOLD - 1);
  assert.equal(mod.layer({kind: 'riso'}), html, 'frames of one hold draw the same grain');
  const places = (frame) => { setSsrFrame(frame); return [...mod.layer({kind: 'riso'}).matchAll(/background-position:(\d+px \d+px)/g)].map((m) => m[1]).join(','); };
  assert.notEqual(places(0), places(RISO_GRAIN_HOLD), 'the grain moves to a new place after a hold');
  assert.equal(places(1), places(0));
  const custom = mod.layer({kind: 'riso', inks: ['#111111', '#d02020']});
  assert.ok(custom.includes(plateMatrixValues('#111111', 'r', 14, 0.95)) && custom.includes(plateMatrixValues('#d02020', 'g', 14, 0.95)));
  assert.equal(custom.includes(plateMatrixValues(a, 'r', 14, 0.95)), false, 'a chosen pair replaces the default inks');
});

test('blueprint draws the stack through an edge filter and adds a faint grid and drawing marks', () => {
  setSsrFrame(0);
  const html = mod.layer({kind: 'blueprint'});
  assert.equal(html.split(stack).length, 2);
  for (const part of ['<filter', '<feGaussianBlur', 'mode="difference"', '<pattern', '<line', 'filter:url(#', 'background-image:url(data:image/png;base64,']) assert.ok(html.includes(part), part);
  assert.equal(html.includes('<feConvolveMatrix') || html.includes('<feTurbulence'), false, 'the slow primitives are not used: a convolution over the whole frame costs more than the rest of the render');
  assert.ok(html.toLowerCase().includes(BLUEPRINT.paper));
  assert.doesNotMatch(html, /<text/, 'the drawing marks carry no words or numbers, so nothing is claimed');
});

test('the girih backdrop is decoration: it draws itself outward, is deterministic and disappears under the probe', () => {
  setSsrFrame(0);
  const first = mod.girih({colour: '#e2b85f'});
  assert.equal(first, mod.girih({colour: '#e2b85f'}));
  assert.ok(first.includes('#e2b85f'));
  assert.doesNotMatch(mod.girih({colour: '#e2b85f'}, '#00ff00'), /<svg|<path/, 'nothing under the probe');
  const drawn = (frame, props = {}) => { setSsrFrame(frame); return mod.girih({colour: '#e2b85f', ...props}); };
  const offsets = (html) => [...html.matchAll(/stroke-dashoffset="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.ok(offsets(drawn(0)).every((value) => value === 1), 'at frame 0 nothing is drawn yet');
  assert.ok(offsets(drawn(24)).some((value) => value === 0) && offsets(drawn(24)).some((value) => value === 1), 'the middle is drawn, the rim is not yet');
  assert.ok(offsets(drawn(150)).every((value) => value === 0), 'later every line is drawn');
  assert.notEqual(drawn(60), drawn(120), 'the pattern moves');
  const slow = offsets(drawn(30, {speed: 0.5})).filter((value) => value < 1).length;
  const fast = offsets(drawn(30, {speed: 2})).filter((value) => value < 1).length;
  assert.ok(fast > slow, `speed spreads the draw faster (${fast} vs ${slow})`);
  const sparse = (drawn(150, {density: 0.6}).match(/<path/g) ?? []).length;
  const dense = (drawn(150, {density: 1.6}).match(/<path/g) ?? []).length;
  assert.ok(dense > sparse * 2, `density adds cells (${dense} vs ${sparse})`);
  for (const fold of GIRIH_FOLDS) assert.ok(drawn(150, {fold}).includes('<path'), `fold ${fold}`);
  assert.doesNotMatch(drawn(150), /NaN|undefined|Infinity/);
});

test('arabic-type scenes ask for a backdrop by name: girih, sunburst and paper are the registered kinds', () => {
  assert.deepEqual([...BACKDROP_KINDS], ['girih', 'sunburst', 'paper']);
  setSsrFrame(150);
  assert.equal(mod.backdrop('girih', {colour: '#e2b85f'}), mod.girih({colour: '#e2b85f'}));
  assert.throws(() => mod.backdrop('plaid', {}), /backdrop/i);
});

// ---- the root and the rules -------------------------------------------------------------------------------------
test('PreparedEdit wraps the picture in the look and keeps the caption track outside it', async () => {
  const text = await source('engine/src/prepared-edit/PreparedEdit.tsx');
  const open = text.indexOf('<LookLayer look={edit.look}>');
  const canvas = text.indexOf('<CanvasFill background={theme.background}/>');
  const plate = text.indexOf('<ContinuousWindowPlate');
  const pip = text.indexOf('<PipPlate');
  const close = text.indexOf('</LookLayer>');
  const captions = text.indexOf('<CaptionTrack edit={edit} compiled={compiled} center={captionCenterFor(nominalState.layout)}/>');
  assert.ok(open > -1 && close > -1, 'the look wrapper is mounted');
  assert.ok(open < canvas && canvas < plate && plate < pip && pip < close, 'canvas, footage, scenes and the picture-in-picture are inside the look');
  assert.ok(close < captions, 'the captions are drawn after, and outside, the look: their pixels are never filtered');
  assert.ok(text.indexOf('</LookLayer>') < text.indexOf('{(edit.transitions??[]).map'), 'transition overlays are outside as well');
});

test('the looks folder is deterministic and keeps registered styles apart', async () => {
  const files = (await readdir(new URL('../engine/src/looks/', import.meta.url))).sort();
  for (const file of ['index.ts', 'math.ts', 'effects.ts', 'riso.tsx', 'blueprint.tsx', 'film.tsx', 'paper.tsx', 'girih.tsx', 'sunburst.tsx', 'layer.tsx', 'backdrop.tsx']) assert.ok(files.includes(file), file);
  for (const file of files) {
    const text = await source(`engine/src/looks/${file}`);
    assert.doesNotMatch(text, /Math\.random|Date\.now|performance\.now|new Date\(/, `${file}: frames are a pure function of frame and props`);
    // riso, blueprint and girih are SVG and CSS; film, paper and sunburst are <Solid> layers whose effects come from @remotion/effects. No file draws on a canvas or in GL itself.
    assert.doesNotMatch(text, /getContext\(|WebGLRenderingContext|createShader\(/, `${file}: no raw canvas or GL code`);
    assert.doesNotMatch(text, /<text[\s>]/, `${file}: the looks draw no words or numbers`);
  }
  const registry = await source('engine/src/styles/registry.ts');
  assert.equal(registry.includes('/looks'), false, 'looks are not styles');
  assert.equal((await readdir(new URL('../engine/src/styles/', import.meta.url))).includes('looks'), false, 'every folder under styles/ is a registered style');
});
