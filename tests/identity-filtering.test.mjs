import test from 'node:test';
import assert from 'node:assert/strict';
import {bundleEngine} from './helpers/engine-bundle.mjs';

const modules = bundleEngine(`
  export * from './engine/src/motion-concepts/identity-filtering/schema.ts';
  export * from './engine/src/motion-concepts/identity-filtering/math.ts';
  export {CONCEPT_BOX} from './engine/src/motion-concepts/shared.tsx';
  export {minFramesAtFps, assertFiniteState, assertHoldFrozen} from './engine/src/motion-concepts/timeline.ts';
  export {rectIssues} from './engine/src/motion-concepts/geometry.ts';
`, {ssr: true});
const clone = (data) => structuredClone(data);
const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

test('typed predicates include equal threshold values and never coerce boolean or numeric data', async () => {
  const {evaluatePredicate} = await modules;
  for (const [attributes, criterion, want] of [
    [{score: 75}, {field: 'score', op: 'gte', value: 75}, true],
    [{score: 74}, {field: 'score', op: 'gte', value: 75}, false],
    [{cost: 40}, {field: 'cost', op: 'lte', value: 40}, true],
    [{cost: 41}, {field: 'cost', op: 'lte', value: 40}, false],
    [{score: 0}, {field: 'score', op: 'eq', value: 0}, true],
    [{verified: false}, {field: 'verified', op: 'eq', value: false}, true],
    [{verified: false}, {field: 'verified', op: 'eq', value: true}, false],
  ]) assert.equal(evaluatePredicate(attributes, criterion), want);
  assert.throws(() => evaluatePredicate({score: true}, {field: 'score', op: 'gte', value: 1}), /type|number/i);
  assert.throws(() => evaluatePredicate({}, {field: 'score', op: 'eq', value: 0}), /missing/i);
});

test('authored attributes determine a monotonic survivor subset and preserve original IDs and order', async () => {
  const {identityFilteringDemo, evaluateFiltering} = await modules;
  const original = clone(identityFilteringDemo);
  const result = evaluateFiltering(identityFilteringDemo);
  assert.deepEqual(result.stages.map(({inputIds, retainedIds, rejectedIds}) => ({inputIds, retainedIds, rejectedIds})), [
    {inputIds: ['A1', 'B2', 'C3', 'D4', 'E5', 'F6'], retainedIds: ['A1', 'B2', 'D4', 'F6'], rejectedIds: ['C3', 'E5']},
    {inputIds: ['A1', 'B2', 'D4', 'F6'], retainedIds: ['A1', 'D4'], rejectedIds: ['B2', 'F6']},
  ]);
  assert.deepEqual(result.retainedIds, ['A1', 'D4']);
  assert.deepEqual(result.rejectedIds, ['B2', 'C3', 'E5', 'F6']);
  assert.deepEqual(identityFilteringDemo, original, 'evaluation does not mutate authored data');
});

test('schema rejects duplicate IDs, unreferenced fields, missing fields and mismatched attribute types', async () => {
  const {identityFilteringDemo, identityFilteringSchema} = await modules;
  for (const mutate of [
    (d) => { d.cards[1].id = d.cards[0].id; },
    (d) => { d.criteria[1].id = d.criteria[0].id; },
    (d) => { delete d.cards[2].attributes.score; },
    (d) => { d.cards[2].attributes.score = true; },
    (d) => { d.criteria[0].value = false; },
    (d) => { d.criteria[1].op = 'gte'; },
    (d) => { d.cards[0].attributes.score = Infinity; },
    (d) => { d.cards[0].attributes.score = 1000001; },
    (d) => { d.criteria[0].value = -1000001; },
    (d) => { d.criteria[0].value = 0.1234567; },
    (d) => { d.criteria[0].field = 'notPresent'; },
    (d) => { d.criteria[0].op = 'eval'; },
    (d) => { d.cards[0].survivor = true; },
    (d) => { d.cards[0].attributes = {'__proto__': true}; },
  ]) {
    const data = clone(identityFilteringDemo); mutate(data);
    assert.equal(identityFilteringSchema.safeParse(data).success, false, JSON.stringify(data));
  }
});

test('schema bounds copy, cardinality and keys while permitting authored mixed-language labels', async () => {
  const {identityFilteringDemo, identityFilteringSchema} = await modules;
  assert.equal(identityFilteringSchema.safeParse(identityFilteringDemo).success, true);
  for (const mutate of [
    (d) => { d.cards = d.cards.slice(0, 2); },
    (d) => { d.cards.push({...d.cards[0], id: 'G7'}); },
    (d) => { d.criteria = []; },
    (d) => { d.criteria.push({...d.criteria[0], id: 'three'}, {...d.criteria[0], id: 'four'}); },
    (d) => { d.cards[0].label = 'x'.repeat(23); },
    (d) => { d.criteria[0].label = 'x'.repeat(25); },
    (d) => { d.criteria[0].label = 'x'.repeat(24); },
    (d) => { d.title = ' '; },
    (d) => { d.cards[0].label = 'unsafe\u202E'; },
    (d) => { d.cards[0].id = 'unsafe id'; },
    (d) => { d.criteria[0].field = 'constructor'; },
  ]) { const data = clone(identityFilteringDemo); mutate(data); assert.equal(identityFilteringSchema.safeParse(data).success, false); }
});

test('zero and all survivors retain every original identity and produce honest empty subsequent stages', async () => {
  const {identityFilteringDemo, evaluateFiltering} = await modules;
  const zero = clone(identityFilteringDemo);
  zero.criteria[0].value = 100;
  const none = evaluateFiltering(zero);
  assert.deepEqual(none.retainedIds, []);
  assert.deepEqual(none.stages[1].inputIds, []);
  assert.deepEqual(none.stages[1].rejectedIds, []);
  assert.equal(none.rejectedIds.length, 6);
  const all = clone(identityFilteringDemo);
  all.criteria = [{id: 'min', label: 'الحد الأدنى', field: 'score', op: 'gte', value: 0}, {id: 'max', label: 'الحد الأعلى', field: 'score', op: 'lte', value: 100}];
  assert.deepEqual(evaluateFiltering(all).retainedIds, ['A1', 'B2', 'C3', 'D4', 'E5', 'F6']);
});

test('a third predicate operates only on the original surviving cards', async () => {
  const {identityFilteringDemo, evaluateFiltering} = await modules;
  const data = clone(identityFilteringDemo);
  data.criteria.push({id: 'cap', label: 'أقل من ٨٥', field: 'score', op: 'lte', value: 85});
  const result = evaluateFiltering(data);
  assert.deepEqual(result.stages[2].inputIds, ['A1', 'D4']);
  assert.deepEqual(result.stages[2].retainedIds, ['D4']);
  assert.deepEqual(result.stages[2].rejectedIds, ['A1']);
});

test('each supported fps keeps readable ordered criterion beats and a final frozen hold', async () => {
  const {identityFilteringDemo, beatsFor, stateAt, MIN_FRAMES, minFramesAtFps, assertHoldFrozen, CONCEPT_BOX} = await modules;
  for (const fps of [24, 25, 30, 50, 60]) for (const count of [1, 2, 3]) {
    const data = clone(identityFilteringDemo);
    data.criteria = data.criteria.slice(0, count);
    if (count === 3) data.criteria.push({id: 'cap', label: 'الحد الأعلى', field: 'score', op: 'lte', value: 100});
    const duration = minFramesAtFps(MIN_FRAMES, fps);
    const beats = beatsFor(duration, count);
    assert.ok((duration - beats.hold.from) / duration >= .2);
    assert.ok(beats.stages.every((s) => (s.route.to - s.read.from) / fps >= 1), 'a criterion gets at least a readable second');
    assert.ok(beats.stages.every((s, i) => i === 0 || s.read.from >= beats.stages[i - 1].route.to));
    assertHoldFrozen((frame) => stateAt(frame, duration, {data, box: CONCEPT_BOX, mode: 'once'}), beats.hold);
  }
});

test('stable row geometry is finite, safe and non-overlapping throughout each filtering stage', async () => {
  const {identityFilteringDemo, stateAt, layoutFor, assertFiniteState, rectIssues, CONCEPT_BOX, MIN_FRAMES} = await modules;
  for (const rtl of [true, false]) for (const count of [3, 4, 5, 6]) {
    const data = clone(identityFilteringDemo); data.cards = data.cards.slice(0, count);
    const params = {data, box: CONCEPT_BOX, mode: 'once', rtl};
    const layout = layoutFor(CONCEPT_BOX, count, data.criteria.length, rtl);
    for (let frame = 0; frame <= MIN_FRAMES; frame++) {
      const state = stateAt(frame, MIN_FRAMES, params);
      assertFiniteState(state);
      assert.deepEqual(state.cards.map((c) => c.id), data.cards.map((c) => c.id));
      assert.equal(new Set(state.cards.map((c) => c.id)).size, count);
      for (const card of state.cards) assert.deepEqual(rectIssues(card.rect, CONCEPT_BOX), []);
      for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) assert.equal(overlap(state.cards[a].rect, state.cards[b].rect), false);
    }
    for (const rect of [layout.title, layout.footer, ...layout.criteria, ...layout.laneLabels]) assert.deepEqual(rectIssues(rect, CONCEPT_BOX), []);
  }
});

test('rejected cards stay parked with their original rejecting criterion while survivors continue', async () => {
  const {identityFilteringDemo, stateAt, beatsFor, CONCEPT_BOX} = await modules;
  const params = {data: identityFilteringDemo, box: CONCEPT_BOX, mode: 'once'};
  const beats = beatsFor(240, 2);
  const first = stateAt(beats.stages[0].route.to, 240, params);
  const next = stateAt(beats.stages[1].inspect.to, 240, params);
  const final = stateAt(beats.hold.from, 240, params);
  for (const id of ['C3', 'E5']) {
    const card = (s) => s.cards.find((c) => c.id === id);
    assert.deepEqual(card(next).rect, card(first).rect);
    assert.deepEqual(card(final).rect, card(first).rect);
    assert.equal(card(final).rejectedAt, 0);
    assert.equal(card(final).status, 'rejected');
  }
  assert.deepEqual(final.cards.filter((c) => c.status === 'retained').map((c) => c.id), ['A1', 'D4']);
  assert.equal(final.resolved, 1);
});

test('invalid timing and loop requests fail explicitly instead of fabricating another identity cycle', async () => {
  const {identityFilteringDemo, stateAt, beatsFor, CONCEPT_BOX} = await modules;
  const params = {data: identityFilteringDemo, box: CONCEPT_BOX, mode: 'once'};
  assert.throws(() => stateAt(NaN, 240, params), /finite/i);
  assert.throws(() => beatsFor(0, 2), /duration/i);
  assert.throws(() => beatsFor(240, 4), /criteria|criterion/i);
  assert.throws(() => stateAt(0, 240, {...params, mode: 'loop'}), /once|loop/i);
});

test('the actual scene keeps all original card identities visible and labels their final rejection stage', async () => {
  const {capture, demo} = await bundleEngine(`
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {IdentityFiltering} from './engine/src/motion-concepts/identity-filtering/scene.tsx';
    import {TypographyProvider} from './engine/src/creative-kit/chapter-theme.tsx';
    import {identityFilteringDemo} from './engine/src/motion-concepts/identity-filtering/schema.ts';
    export const demo = identityFilteringDemo;
    export const capture = (data = identityFilteringDemo, fontFamily = null) => {
      globalThis.__SSR_FRAME__ = 590;
      return renderToStaticMarkup(React.createElement(TypographyProvider, {fontFamily}, React.createElement(IdentityFiltering, {data, style:'kinetic-paper', backdrop:'none'})));
    };
  `, {ssr: true});
  const html = capture();
  assert.equal((html.match(/data-card-id=/g) ?? []).length, 6);
  for (const card of demo.cards) assert.ok(html.includes(card.label), card.id);
  assert.match(html, /data-card-id="C3"[^>]*data-status="rejected"[^>]*data-rejected-at="0"/);
  assert.match(html, /data-card-id="A1"[^>]*data-status="retained"/);
  assert.ok(html.includes(demo.criteria[0].label));
  assert.ok(html.includes(demo.criteria[1].label));
  assert.doesNotMatch(html, /letter-spacing:[1-9]|NaN|Infinity/);
  const precision = structuredClone(demo);
  precision.cards[0].attributes.score = .123456;
  precision.criteria[0].value = .123456;
  assert.ok(capture(precision).includes('٠٫١٢٣٤٥٦'), 'predicate evidence shows the actual supplied number without rounding away a decisive decimal');
  const maximum = structuredClone(demo);
  maximum.criteria.push({id: 'last', label: 'الخبرة الإضافية المطلوبة', field: 'score', op: 'lte', value: 100});
  maximum.criteria[0].label = 'التقييم الإضافي المطلوب';
  maximum.cards[0].label = 'اختيار مناسب للفريق';
  maximum.cards[0].id = 'IdentityCard001A';
  assert.doesNotThrow(() => capture(maximum, 'Noto Naskh Arabic'), 'authored multi-line criteria and long IDs fit under the selected Arabic font');
});

test('Arabic-indic stage counts, ratios and predicates use an isolated LTR override without reversing authored math', async () => {
  const {capture} = await bundleEngine(`
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {IdentityFiltering} from './engine/src/motion-concepts/identity-filtering/scene.tsx';
    import {identityFilteringDemo} from './engine/src/motion-concepts/identity-filtering/schema.ts';
    export const capture = (frame = 590) => {
      globalThis.__SSR_FRAME__ = frame;
      return renderToStaticMarkup(React.createElement(IdentityFiltering, {data:identityFilteringDemo, style:'kinetic-paper', backdrop:'none'}));
    };
  `, {ssr: true});
  const assertLtrMath = (html, expression) => {
    const runs = [...html.matchAll(/<bdi\b([^>]*)>([^<]*)<\/bdi>/gu)];
    const run = runs.find((match) => match[2] === expression);
    assert.ok(run, `a single whole numeric expression contains exactly ${expression}`);
    assert.match(run[1], /dir="ltr"/);
    assert.match(run[1], /direction:ltr(?:;|")/);
    assert.match(run[1], /unicode-bidi:isolate-override(?:;|")/, 'Arabic-indic numeric runs need explicit override as well as an isolated LTR paragraph');
  };
  const final = capture();
  for (const expression of ['٦ → ٤', '٤ → ٢', '٢ / ٦', '≥ ٧٥', '= ✓']) assertLtrMath(final, expression);
  const opening = capture(55);
  for (const expression of ['١ / ٢', '٢ / ٢']) assertLtrMath(opening, expression);
  assert.match(final, /direction:rtl[^>]*><div[^>]*>التقييم ٧٥ أو أكثر<\/div>/u, 'whole Arabic labels retain their RTL text layout');
});
