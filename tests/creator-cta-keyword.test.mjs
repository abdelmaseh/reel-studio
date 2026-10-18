import test from 'node:test';
import assert from 'node:assert/strict';
import {editSceneSchema} from '../engine/src/prepared-edit/schema.ts';
import {fieldHint} from '../engine/src/review-editor/panels/form-schema.ts';
import {kitTemplate, kitTemplateData} from '../engine/src/review-editor/ops/templates.ts';
import {addSceneFromTemplate, sceneDemoFields} from '../engine/src/review-editor/ops/scenes.ts';
import {validateManifest} from '../engine/src/review-editor/validate.ts';
import {endingIssues} from '../scripts/lib/endings.mjs';
import {assertDeliveryReady} from '../scripts/lib/editor-director.mjs';
import {createFrameRenderer} from '../scripts/lib/ssr-frames.mjs';
import {bundleEngine} from './helpers/engine-bundle.mjs';
import {dialectIn} from './helpers/dialect.mjs';
import {textNodes} from './helpers/markup.mjs';
import {reviewManifest} from './helpers/review-manifest.mjs';

// The creator CTA scene draws the comment keyword only where its prompt says {keyword} (or spells the keyword out). The default
// template, the delivery ending gate, the editor's delivery list and the rendered text have to agree on that.
const KEYWORD = 'دليل';
const HANDLE = '@reel.studio';
const MESSAGE = (id) => `The creator CTA scene «${id}» never shows the comment keyword «${KEYWORD}»: write {keyword} in its prompt, or the keyword itself.`;
const REAL_TITLE = 'تريد الدليل كاملًا؟';

// A 30-second recording whose profile asks for the comment keyword and the follow card.
const manifestWithProfile = () => {
  const m = reviewManifest('cta-keyword');
  m.source.totalFrames = m.source.fps * 30;
  m.segments = [{fromFrame: 0, toFrame: m.source.fps * 30}];
  m.scenes = [];
  m.creator = {displayName: 'Reel Studio', handle: HANDLE, ending: {cta: KEYWORD, followCard: true, signOff: null}};
  return m;
};
// The scene the editor adds, then changed by `change(data)`.
const withCta = (change = () => {}) => {
  const added = addSceneFromTemplate(manifestWithProfile(), 'creator-cta', {atFrame: 0});
  assert.equal(added.ok, true, added.reason);
  change(added.manifest.scenes[added.index].data);
  return added.manifest;
};
const readyToDeliver = (m) => {
  m.purpose = 'delivery';
  m.captions.status = 'reviewed';
  m.captions.reviewer = 'Recorded words reviewed';
  return m;
};
const codes = (validation, code) => validation.issues.filter((issue) => issue.code === code);

test('the creator-cta template says {keyword} in its prompt, in neutral Arabic, at every frame rate', () => {
  for (const fps of [24, 25, 30, 50, 60]) {
    const {prompt} = kitTemplate('creator-cta', fps).data;
    assert.ok(prompt.includes('{keyword}'), `${fps} fps: ${prompt}`);
    assert.match(prompt, /\p{Script=Arabic}/u);
    assert.deepEqual(dialectIn(prompt), []);
    assert.ok(prompt.length <= 80, 'inside the schema limit');
  }
  assert.equal(kitTemplateData['creator-cta'].prompt, kitTemplate('creator-cta', 30).data.prompt);
  const scene = withCta().scenes[0];
  assert.equal(scene.data.keyword, KEYWORD, 'the editor fills the profile keyword');
  assert.ok(scene.data.prompt.includes('{keyword}'));
  assert.deepEqual(sceneDemoFields(scene).sort(), ['prompt', 'title'], 'the prompt is still sample text until the creator writes their own');
});

test('the ending gate accepts the default template, a {keyword} prompt and a prompt that spells the keyword', () => {
  assert.deepEqual(endingIssues(withCta()), [], 'the default template');
  for (const prompt of ['اكتب {keyword} واستلم الدليل', `اكتب ${KEYWORD} في التعليقات`, '{keyword}', KEYWORD]) {
    assert.deepEqual(endingIssues(withCta((data) => { data.prompt = prompt; })), [], prompt);
  }
});

test('the ending gate refuses a creator-cta prompt that never shows the keyword and names the scene', () => {
  for (const prompt of ['اكتب طلبك للمشاهد', 'اكتب كلمة التعليق', 'اكتب {Keyword}', 'اكتب {keywords']) {
    assert.deepEqual(endingIssues(withCta((data) => { data.prompt = prompt; })), [MESSAGE('creator-cta')], prompt);
  }
  const unnamed = withCta();
  unnamed.scenes[0].id = 'ending-card';
  delete unnamed.scenes[0].data.prompt;
  assert.deepEqual(endingIssues(unnamed), [MESSAGE('ending-card')], 'a missing prompt shows nothing either');
  // Only a profile that asks for the keyword has anything to check.
  const noCta = withCta((data) => { data.prompt = 'اكتب طلبك للمشاهد'; });
  noCta.creator.ending = {cta: null, followCard: false, signOff: null};
  assert.deepEqual(endingIssues(noCta), ['The CTA and the follow card are both off for this video; remove the ending scenes.']);
});

test('assertDeliveryReady refuses a prompt without the keyword, accepts one that shows it and stops the untouched template at its placeholder words', () => {
  const finished = (prompt) => readyToDeliver(withCta((data) => { Object.assign(data, {title: REAL_TITLE, prompt}); }));
  assert.throws(() => assertDeliveryReady(finished('اكتب طلبك للمشاهد')), (error) => {
    assert.equal(error.message, `Delivery ending: ${MESSAGE('creator-cta')}`);
    return true;
  });
  assert.equal(assertDeliveryReady(finished('اكتب {keyword} وسأرسل لك الدليل')).ok, true);
  assert.equal(assertDeliveryReady(finished(`اكتب ${KEYWORD} وسأرسل لك الملف`)).ok, true);
  // The untouched template passes the ending gate, then stops at its own placeholder words.
  assert.throws(() => assertDeliveryReady(readyToDeliver(withCta())), (error) => {
    assert.equal(error.message, 'Delivery sample text: scene creator-cta still holds the template words at data.title, data.prompt. Write the real words in those fields before delivery.');
    return true;
  });
});

test('the editor lists a creator-cta prompt without the keyword as a delivery error on the prompt field', () => {
  const bad = readyToDeliver(withCta((data) => { Object.assign(data, {title: REAL_TITLE, prompt: 'اكتب طلبك للمشاهد'}); }));
  const result = validateManifest(bad);
  assert.equal(result.ok, true, 'saving and previewing are never blocked');
  assert.equal(result.deliveryReady, false);
  const issues = codes(result, 'delivery:cta-keyword');
  assert.equal(issues.length, 1);
  assert.equal(issues[0].severity, 'error');
  assert.equal(issues[0].stage, 'delivery');
  assert.equal(issues[0].path, 'scenes.0.data.prompt');
  assert.ok(issues[0].where.includes('creator-cta') && issues[0].where.includes('prompt'), issues[0].where);
  assert.ok(issues[0].message.includes('creator-cta') && issues[0].message.includes(KEYWORD) && issues[0].message.includes('{keyword}'), issues[0].message);
  assert.deepEqual(dialectIn(issues[0].message), []);
  assert.equal(issues[0].detail, `The creator CTA scene creator-cta never shows the comment keyword ${KEYWORD}: write {keyword} in its prompt, or the keyword itself.`);
  for (const prompt of ['اكتب {keyword} وسأرسل لك الدليل', `اكتب ${KEYWORD} وسأرسل لك الملف`]) {
    const good = validateManifest(readyToDeliver(withCta((data) => { Object.assign(data, {title: REAL_TITLE, prompt}); })));
    assert.equal(codes(good, 'delivery:cta-keyword').length, 0, prompt);
    assert.equal(good.deliveryReady, true, prompt);
  }
  const template = validateManifest(readyToDeliver(withCta()));
  assert.equal(codes(template, 'delivery:cta-keyword').length, 0, 'the default template shows the keyword');
  assert.deepEqual(codes(template, 'delivery:sample-text').map((issue) => issue.path), ['scenes.0.data']);
});

test('the rendered creator CTA shows the keyword from the default template and not from a prompt without it', async () => {
  const renderer = await createFrameRenderer();
  const shown = (scene) => textNodes(renderer.renderScene({scene: editSceneSchema.parse(scene), style: 'section-deck', frame: 100})).join(' ');
  const scene = withCta().scenes[0];
  const text = shown(scene);
  assert.ok(text.includes(`اكتب طلبك للمشاهد بكلمة ${KEYWORD}`), text);
  assert.equal(text.includes('{keyword}'), false, 'the token is replaced, never drawn');
  const bare = structuredClone(scene);
  bare.data.prompt = 'اكتب طلبك للمشاهد';
  assert.equal(shown(bare).includes(KEYWORD), false, 'without the token or the word, the viewer never sees the keyword');
  const spelled = structuredClone(scene);
  spelled.data.prompt = `اكتب ${KEYWORD} في التعليقات`;
  assert.ok(shown(spelled).includes(`اكتب ${KEYWORD} في التعليقات`));
});

test('the creator-cta prompt field carries a short hint in the scene form and no other field does', async () => {
  const hint = fieldHint('creator-cta', 'prompt');
  assert.ok(hint?.includes('{keyword}'), hint);
  assert.match(hint, /\p{Script=Arabic}/u);
  assert.deepEqual(dialectIn(hint), []);
  for (const key of ['title', 'keyword', 'handle', 'followFrame']) assert.equal(fieldHint('creator-cta', key), undefined, key);
  assert.equal(fieldHint('statement', 'prompt'), undefined);
  const {renderForm} = await bundleEngine(`
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {SchemaForm} from './engine/src/review-editor/panels/schema-form.tsx';
    export const renderForm = (family, data) => renderToStaticMarkup(React.createElement(SchemaForm, {family, data, fps: 30, onCommit: () => null}));
  `);
  const html = renderForm('creator-cta', kitTemplate('creator-cta', 30).data);
  assert.equal(html.split(hint).length - 1, 1, 'shown once');
  assert.ok(html.indexOf(hint) > html.indexOf('اكتب طلبك للمشاهد'), 'under the prompt field');
  assert.equal(renderForm('statement', kitTemplate('statement', 30).data).includes(hint), false);
});
