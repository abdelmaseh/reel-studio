import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFrameRenderer} from '../scripts/lib/ssr-frames.mjs';
import {editSceneSchema} from '../engine/src/prepared-edit/schema.ts';
import {bundleEngine} from './helpers/engine-bundle.mjs';
import {textNodes} from './helpers/markup.mjs';

const {CARD_LABELS, arabicCopy, cardLabel} = await bundleEngine(`export {CARD_LABELS, arabicCopy, cardLabel} from './engine/src/creative-kit/labels';`);
let rendererPromise;
const frames = () => rendererPromise ??= createFrameRenderer();

test('file names, hashes and option values never decide the language of a card label', () => {
  const english = {kicker: 'Settings screen', steps: [{title: 'Open settings', src: 'captures/الإعدادات.png', kind: 'image', fit: 'contain'}]};
  assert.equal(arabicCopy(english), false, 'an Arabic file name under English copy');
  assert.equal(cardLabel('source', english), CARD_LABELS.source.en);
  const arabic = {kicker: 'افتح الإعدادات', steps: [{title: 'اضغط Settings', src: 'captures/settings.png'}]};
  assert.equal(cardLabel('source', arabic), CARD_LABELS.source.ar);
  assert.equal(arabicCopy({items: [{label: 'One', sha256: 'abc', src: 'a/ب.png', path: 'ج/د.png'}]}), false);
});

// An English card whose image file has an Arabic name.
const englishChecklist = (variant = 'missing') => ({kicker: 'Setup check', title: 'Before you post', variant, image: 'captures/الإعدادات.png',
  items: [{label: 'Open settings', detail: 'Do this first', atFrame: 20}, {label: 'Pick a plan', detail: 'Then this', atFrame: 40}]});

test('an asset path under image, icon, logo or poster never decides the language of a card label', () => {
  const english = englishChecklist();
  assert.equal(arabicCopy(english), false, 'an Arabic image file name under English copy');
  assert.equal(cardLabel('missing', english), CARD_LABELS.missing.en);
  assert.equal(cardLabel('source', english), CARD_LABELS.source.en);
  for (const key of ['image', 'icon', 'logo', 'poster', 'productIcon', 'visualSrc']) {
    assert.equal(arabicCopy({title: 'Open settings', [key]: 'captures/الإعدادات.png'}), false, key);
  }
  assert.equal(arabicCopy({...english, title: 'افتح الإعدادات'}), true, 'the visible copy still decides');
  assert.equal(cardLabel('missing', {...english, title: 'افتح الإعدادات'}), CARD_LABELS.missing.ar);
});

test('a generic checklist keeps its English MISSING label whatever its image file is called', async () => {
  const renderer = await frames();
  const scene = (data) => editSceneSchema.parse({id: 'checklist', family: 'checklist', fromFrame: 0, durationInFrames: 120, layout: 'takeover', motion: 'quiet', data});
  // Grid Glide has no checklist design and still uses the generic checklist renderer.
  const shown = (data) => textNodes(renderer.renderScene({scene: scene(data), style: 'grid-glide', frame: 5})).join(' ');
  const english = shown(englishChecklist());
  assert.ok(english.includes(CARD_LABELS.missing.en), english);
  assert.equal(english.includes(CARD_LABELS.missing.ar), false, english);
  const arabic = shown({...englishChecklist(), title: 'افتح الإعدادات'});
  assert.ok(arabic.includes(CARD_LABELS.missing.ar), 'Arabic copy still gets the Arabic label');
});

test('section-deck comment and follow use labels in the language of the visible copy', async () => {
  const renderer = await frames();
  for (const ar of [false, true]) {
    const language = ar ? 'ar' : 'en';
    const scene = (family, data) => editSceneSchema.parse({id:family,family,fromFrame:0,durationInFrames:150,layout:'takeover',motion:'land',data});
    const comment = scene('comment', {keyword:ar ? 'قالب' : 'guide',promise:ar ? 'مثال توضيحي' : 'An illustrative example',caption:ar ? 'مثال' : 'Example'});
    const shown = textNodes(renderer.renderScene({scene:comment,style:'section-deck',frame:50})).join(' ');
    assert.ok(shown.includes(CARD_LABELS.templateLine[language]), shown);
    assert.ok(shown.includes(CARD_LABELS.commentBadge[language]), shown);
    const follow = scene('follow', {handle:'@example',message:ar ? 'أفكار عملية' : 'Practical ideas',caption:ar ? 'مثال' : 'Example'});
    for (const [frame,key] of [[20,'followPill'],[100,'following']]) {
      const text = textNodes(renderer.renderScene({scene:follow,style:'section-deck',frame}));
      assert.ok(text.includes(CARD_LABELS[key][language]), text.join(' '));
      assert.ok(!text.includes(CARD_LABELS[key][ar ? 'en' : 'ar']));
    }
  }
});

test('section-deck English copy anchors its headline on the left with ltr text', async () => {
  const renderer = await frames();
  const scene = editSceneSchema.parse({id:'intro',family:'intro',fromFrame:0,durationInFrames:150,layout:'takeover',motion:'land',
    data:{kicker:'Example',title:'One clear idea',subtitle:'Explain the idea',caption:'Example'}});
  const html = renderer.renderScene({scene,style:'section-deck',frame:50});
  assert.match(html,/top:380px;left:65px;width:950px/);
  assert.match(html,/align-items:flex-start/);
  assert.match(html,/direction:ltr/);
  assert.doesNotMatch(html,/top:380px;right:/);
});

test('mixed copy with technical English stays Arabic, and an explicit language wins', () => {
  assert.equal(arabicCopy({title: 'اشرح API و MCP'}), true);
  assert.equal(arabicCopy({title: 'Claude Code', subtitle: 'أداة للمطورين'}), true);
  assert.equal(arabicCopy({lang: 'en', title: 'كلمة'}), false);
  assert.equal(arabicCopy({lang: 'ar', title: 'Hello'}), true);
});

test('the follow card localises its button pill too', () => {
  const source = readFileSync(new URL('../engine/src/creative-kit/scenes.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /text="Follow"/, 'the pill text comes from the card labels');
  assert.match(source, /cardLabel\("followPill", copy\)/);
});
