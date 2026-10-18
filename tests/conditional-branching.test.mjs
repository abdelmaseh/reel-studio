import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {assertFiniteState, assertHoldFrozen} from '../engine/src/motion-concepts/timeline.ts';
import {intersectRect, rectIssues} from '../engine/src/motion-concepts/geometry.ts';
import {bundleEngine} from './helpers/engine-bundle.mjs';

// Missing modules are the first RED state: each test still reports the absent contract.
const load = async (file) => {
  const url = new URL(`../engine/src/motion-concepts/conditional-branching/${file}.ts`, import.meta.url);
  try { await access(url); } catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
  return import(url.href);
};
const schema = await load('schema');
const math = await load('math');
const required = (api, name) => {
  assert.ok(api[name], `${name} must implement the conditional decision contract`);
  return api[name];
};
const base = {
  input: {id: 'lead-042', label: 'طلب أحمد SAMPLE', value: 82},
  condition: {kind: 'number-at-least', label: 'الدرجة', threshold: 75},
  branches: {whenTrue: 'تجهيز العرض', whenFalse: 'مراجعة الطلب'},
};
const box = {left: 65, top: 250, right: 1015, bottom: 1470, width: 950, height: 1220, rail: {x: 853, y: 1150}};

test('numeric decisions include equality and choose the false outcome below the supplied threshold', () => {
  const evaluate = required(math, 'evaluateCondition');
  for (const [value, threshold, expected] of [[82, 75, true], [75, 75, true], [74.999, 75, false], [-2, -1, false], [-1, -2, true]]) {
    assert.equal(evaluate({...base, input: {...base.input, value}, condition: {...base.condition, threshold}}), expected);
  }
});

test('boolean equality uses the authored expected boolean rather than treating false as missing', () => {
  const evaluate = required(math, 'evaluateCondition');
  for (const [value, equals, expected] of [[true, true, true], [false, true, false], [false, false, true], [true, false, false]]) {
    assert.equal(evaluate({...base, input: {...base.input, value}, condition: {kind: 'boolean-equals', label: 'مكتمل', equals}}), expected);
  }
});

test('strict supplied-data validation rejects mismatched types, unsafe copy, non-finite values and result overrides', () => {
  const validator = required(schema, 'conditionalBranchingSchema');
  assert.deepEqual(validator.parse(base), base);
  assert.ok(validator.safeParse(required(schema, 'conditionalBranchingDemo')).success);
  const invalid = [
    {...base, input: {...base.input, value: '82'}},
    {...base, input: {...base.input, value: true}},
    {...base, condition: {kind: 'boolean-equals', label: 'مكتمل', equals: true}},
    {...base, condition: {...base.condition, threshold: Infinity}},
    {...base, input: {...base.input, value: NaN}},
    {...base, input: {...base.input, value: 1e10}},
    {...base, input: {...base.input, id: ''}},
    {...base, input: {...base.input, id: 'x\u202ey'}},
    {...base, input: {...base.input, label: '   '}},
    {...base, condition: {...base.condition, label: 'x'.repeat(25)}},
    {...base, branches: {...base.branches, whenFalse: 'x'.repeat(31)}},
    {...base, selected: 'whenFalse'},
    {...base, condition: {...base.condition, expression: 'value > 10'}},
    {...base, branches: {...base.branches, extra: 'third route'}},
  ];
  for (const value of invalid) assert.equal(validator.safeParse(value).success, false, JSON.stringify(value));
  assert.throws(() => required(math, 'evaluateCondition')(invalid[1]), /value|condition|number/i);
});

test('one stable token reaches only the evaluated outcome while the alternative remains inspectable', () => {
  const stateAt = required(math, 'stateAt');
  for (const value of [82, 40]) {
    const data = {...base, input: {...base.input, value}};
    const selected = value === 82 ? 'whenTrue' : 'whenFalse';
    for (let frame = 0; frame <= 270; frame++) {
      const state = stateAt(frame, 270, {data, box, rtl: true});
      assert.equal(state.token.id, 'lead-042');
      assert.equal(state.token.label, base.input.label);
      assert.equal(state.token.value, value);
      assert.ok(state.branches.filter((branch) => branch.active).length <= 1);
      const other = state.branches.find((branch) => branch.key !== selected);
      assert.equal(other.progress, 0, 'the rejected path must never receive a traveling token');
    }
    const final = stateAt(270, 270, {data, box, rtl: true});
    assert.equal(final.selected, selected);
    assert.equal(final.condition.result, selected === 'whenTrue');
    assert.deepEqual(final.branches.filter((branch) => branch.active).map((branch) => branch.key), [selected]);
    assert.ok(final.branches.every((branch) => branch.presence === 1));
    assert.equal(final.branches.find((branch) => branch.key === selected).progress, 1);
    const layout = required(math, 'layoutFor')(box, true);
    const destination = layout.branches.find((branch) => branch.key === selected).dock;
    assert.equal(final.token.x, destination.x);
    assert.equal(final.token.y, destination.y);
  }
});

test('minimum and default durations leave condition reading time and a frozen readable final outcome', () => {
  const stateAt = required(math, 'stateAt');
  const beatsFor = required(math, 'beatsFor');
  for (const duration of [210, 270, 540]) {
    const beats = beatsFor(duration);
    assert.deepEqual(required(math, 'modeIssues')(duration), []);
    assert.ok(beats.evaluate.to - beats.evaluate.from >= duration * 0.14);
    assert.ok((duration - beats.hold.from) / duration >= 0.25);
    const params = {data: base, box, rtl: false};
    assert.equal(stateAt(beats.evaluate.from - 1, duration, params).selected, null);
    assert.equal(stateAt(beats.evaluate.to, duration, params).selected, 'whenTrue');
    assertHoldFrozen((frame) => stateAt(frame, duration, params), beats.hold);
    assert.deepEqual(stateAt(duration + 300, duration, params), stateAt(duration, duration, params));
    assert.deepEqual(stateAt(-100, duration, params), stateAt(0, duration, params));
  }
  assert.throws(() => stateAt(NaN, 270, {data: base, box, rtl: false}), /finite/i);
  assert.throws(() => stateAt(0, 0, {data: base, box, rtl: false}), /duration|whole/i);
  assert.throws(() => stateAt(0, 270, {data: base, box, rtl: false, mode: 'loop'}), /once|loop/i);
});

test('routes, token and outcome cards stay finite, separated and inside the native safe geometry', () => {
  const stateAt = required(math, 'stateAt');
  const layoutFor = required(math, 'layoutFor');
  for (const rtl of [false, true]) {
    const layout = layoutFor(box, rtl);
    const [a, b] = [...layout.branches].sort((x, y) => x.rect.x - y.rect.x);
    assert.ok(a.rect.x + a.rect.width + 24 <= b.rect.x, 'outcome cards need a visible gutter');
    assert.ok(layout.condition.x + layout.condition.width + 28 < layout.gate.x - layout.token.width / 2 || layout.gate.x + layout.token.width / 2 + 28 < layout.condition.x);
    for (const value of [82, 40]) {
      let previous;
      for (let frame = 0; frame <= 270; frame++) {
        const state = stateAt(frame, 270, {data: {...base, input: {...base.input, value}}, box, rtl});
        assertFiniteState(state);
        for (const rect of state.rects) assert.deepEqual(rectIssues(rect, box), [], `frame ${frame}: ${JSON.stringify(rect)}`);
        if (previous) assert.ok(Math.hypot(state.token.x - previous.x, state.token.y - previous.y) < 44, `token jumped at ${frame}`);
        previous = state.token;
      }
    }
  }
});

test('the moving token never covers condition copy or either outcome label on its way to the dock', () => {
  const stateAt = required(math, 'stateAt');
  const layoutFor = required(math, 'layoutFor');
  for (const rtl of [false, true]) {
    const layout = layoutFor(box, rtl);
    for (const value of [82, 40]) {
      for (let frame = 0; frame <= 270; frame++) {
        const state = stateAt(frame, 270, {data: {...base, input: {...base.input, value}}, box, rtl});
        const token = {x: state.token.x - state.token.width / 2, y: state.token.y - state.token.height / 2, width: state.token.width, height: state.token.height};
        for (const text of [layout.condition, ...layout.branches.map((branch) => branch.label)]) {
          assert.equal(intersectRect(token, text), null, `token covers readable copy at frame ${frame}`);
        }
      }
    }
  }
});

test('accepted 28-character token labels fit two readable lines across Arabic fonts without hiding identity', async () => {
  const {capture} = await bundleEngine(`
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {TypographyProvider} from './engine/src/creative-kit/chapter-theme.tsx';
    import {ConditionalBranching} from './engine/src/motion-concepts/conditional-branching/scene.tsx';
    import {conditionalBranchingDemo,conditionalBranchingSchema} from './engine/src/motion-concepts/conditional-branching/schema.ts';
    export function capture(label,fontFamily,rtl){
      const data=structuredClone(conditionalBranchingDemo); data.input.label=label;
      if(!rtl){data.condition.label='Score';data.branches={whenTrue:'Prepare quote',whenFalse:'Review order'};}
      conditionalBranchingSchema.parse(data);globalThis.__SSR_FRAME__=590;
      return renderToStaticMarkup(React.createElement(TypographyProvider,{fontFamily},React.createElement(ConditionalBranching,{data,style:'paper-collage'})));
    }
  `,{ssr:true});
  const labels = [
    {text:'طلب جديد لخدمات فريق التسويق',rtl:true,natural:true},
    {text:'Marketing service order test',rtl:false,natural:true},
    {text:'W'.repeat(28),rtl:false,natural:false},
    {text:'م'.repeat(28),rtl:true,natural:false},
  ];
  assert.equal(labels[0].text.length,28);
  assert.equal(labels[1].text.length,28);
  for(const font of ['Noto Naskh Arabic','Cairo','Tajawal'])for(const label of labels){
    let html;
    assert.doesNotThrow(()=>{html=capture(label.text,font,label.rtl);},`${font}: ${label.text}`);
    const flat=html.replace(/<[^>]*>/g,'').replace(/\s+/g,'');
    assert.ok(flat.includes(label.text.replace(/\s+/g,'')),'all original label characters survive wrapping');
    assert.ok(flat.includes('sample-042'),'the original ID remains visible');
    assert.match(html,/data-token-id="sample-042"/);
    const details=/data-token-part="label" data-label-lines="(\d+)" data-label-font-size="(\d+)"/.exec(html);
    assert.ok(details,'the actual label exposes its fitted geometry for inspection');
    assert.ok(Number(details[1])<=2);
    assert.ok(Number(details[2])>=(label.natural?20:14));
    assert.doesNotMatch(html,/text-overflow:ellipsis|letter-spacing:[1-9]/);
  }
});

test('both accepted 30-character outcomes preserve natural and unbroken Arabic or Latin copy in their fixed boxes', async () => {
  const {capture} = await bundleEngine(`
    import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
    import {TypographyProvider} from './engine/src/creative-kit/chapter-theme.tsx';
    import {ConditionalBranching} from './engine/src/motion-concepts/conditional-branching/scene.tsx';
    import {conditionalBranchingDemo,conditionalBranchingSchema} from './engine/src/motion-concepts/conditional-branching/schema.ts';
    export function capture(branch,label,fontFamily){const data=structuredClone(conditionalBranchingDemo);data.branches[branch]=label;
      conditionalBranchingSchema.parse(data);globalThis.__SSR_FRAME__=590;
      return renderToStaticMarkup(React.createElement(TypographyProvider,{fontFamily},React.createElement(ConditionalBranching,{data,style:'paper-collage'})));}
  `,{ssr:true});
  const cases = [
    {text:'W'.repeat(30),natural:false},
    {text:'م'.repeat(30),natural:false},
    {text:'Prepare proposal for new order',natural:true},
    {text:'تجهيز عرض السعر للعميل الجديد.',natural:true},
  ];
  for(const font of ['Noto Naskh Arabic','Cairo'])for(const branch of ['whenTrue','whenFalse'])for(const label of cases){
    assert.equal(label.text.length,30);
    let html;
    assert.doesNotThrow(()=>{html=capture(branch,label.text,font);},`${branch}/${font}: ${label.text}`);
    const flat=html.replace(/<[^>]*>/g,'').replace(/\s+/g,'');
    assert.ok(flat.includes(label.text.replace(/\s+/g,'')),'the complete supplied outcome remains visible');
    assert.ok(flat.includes('sample-042'),'the input identity remains visible beside the outcome');
    const fitted=[...html.matchAll(/data-copy-part="outcome-label" data-copy-lines="(\d+)" data-copy-font-size="(\d+)"/g)];
    assert.equal(fitted.length,2);
    for(const [,lines,size] of fitted){assert.ok(Number(lines)<=2);assert.ok(Number(size)>=14);}
    if(label.natural)assert.ok(Number(fitted[branch==='whenTrue'?0:1][2])>=18,'natural outcome copy keeps its standard readable minimum');
    assert.doesNotMatch(html,/text-overflow:ellipsis|letter-spacing:[1-9]/);
  }
});
