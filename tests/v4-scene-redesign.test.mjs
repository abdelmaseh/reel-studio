// The redesigned figures, chat-thread and proof-screen drawings keep the product's data contracts in every rebuilt style.
import test from 'node:test';
import assert from 'node:assert/strict';
import {editSceneSchema} from '../engine/src/prepared-edit/schema.ts';
import {createFrameRenderer} from '../scripts/lib/ssr-frames.mjs';
import {bundleEngine} from './helpers/engine-bundle.mjs';
import {textNodes} from './helpers/markup.mjs';

const REDESIGNED = ['section-deck', 'liquid-glass', 'magazine-interview', 'kinetic-paper', 'calligraphic-receipts', 'paper-collage'];
const OTHERS = ['grid-glide', 'one-shot', 'cartoon', 'documentary', 'layered-speaker'];
const FAMILIES = ['figures', 'chat-thread', 'proof-screen'];
const FRAMES = [0, 30, 60, 179];

const renderer = await createFrameRenderer();
const {familyDesign} = await bundleEngine(`export {familyDesign} from './engine/src/styles/family-designs';`, {ssr: true, media: true});

const scene = (family, data) => editSceneSchema.parse({id: `${family}-contract`, family, layout: 'takeover', motion: 'land', fromFrame: 0, durationInFrames: 180, data});
const draw = (style, s, frame, digits) => renderer.renderScene({scene: s, style, frame, ...(digits ? {digits} : {})});
const ariaLabels = (html) => [...html.matchAll(/aria-label="([^"]*)"/g)].map((match) => match[1]);
const showsNumber = (html, text) => textNodes(html).includes(text) || ariaLabels(html).includes(text);
const assertClean = (html, where) => assert.doesNotMatch(html, /NaN|undefined|Infinity|href=|<iframe/, where);
// Text between tags, outside <style>, that is not only whitespace.
const drawnText = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').split(/<[^>]*>/).filter((text) => text.trim() !== '');
const words = (html) => textNodes(html).flatMap((node) => node.split(/\s+/));

const PROOF = {title: 'صفحة توضيحية 2024', url: 'موقعك.com', blocks: [
  {kind: 'heading', text: 'الفكرة في مكان واحد'}, {kind: 'text', text: 'شرح مكتوب من صاحب المشروع'},
  {kind: 'stat', text: 'قيمة توضيحية', value: 42}, {kind: 'button', text: 'راجع التفاصيل'},
], focus: 2, path: 'focus'};

test('the five other styles keep the shared views until their own decision', () => {
  for (const style of OTHERS) for (const family of FAMILIES) assert.equal(familyDesign(style, family), null, `${style} ${family}`);
});

for (const style of REDESIGNED) {
  test(`${style}: registers its own figures, chat-thread and proof-screen drawings`, () => {
    for (const family of FAMILIES) assert.equal(typeof familyDesign(style, family), 'function', family);
  });

  test(`${style}: figures settle on the exact authored number in the chosen digits`, () => {
    const cases = [
      [{variant: 'counter', value: 42, label: 'عدد الطلبات', unit: 'طلب'}, 'arabic-indic', '٤٢'],
      [{variant: 'counter', value: 42, label: 'عدد الطلبات', unit: 'طلب'}, 'latin', '42'],
      [{variant: 'counter', value: 0.000001, label: 'أصغر قيمة'}, 'latin', '0.000001'],
      [{variant: 'bars', label: 'ساعات المونتاج', unit: 'ساعة', bars: [{label: 'قبل', value: 9}, {label: 'بعد', value: 1.2345}]}, 'latin', '1.2345'],
      [{variant: 'bars', label: 'ساعات المونتاج', unit: 'ساعة', bars: [{label: 'قبل', value: 42}, {label: 'بعد', value: 3}]}, 'arabic-indic', '٤٢'],
      [{variant: 'ring', value: 1.2345, max: 2, label: 'النسبة'}, 'latin', '1.2345'],
      [{variant: 'ring', value: 42, max: 100, label: 'اللي كملوا الفيديو'}, 'arabic-indic', '٤٢'],
    ];
    for (const [data, digits, text] of cases) {
      const s = scene('figures', data);
      for (const frame of FRAMES) assertClean(draw(style, s, frame, digits), `${data.variant} @${frame}`);
      const html = draw(style, s, 179, digits);
      assert.equal(html, draw(style, s, 179, digits), `${data.variant} is deterministic`);
      assert.ok(showsNumber(html, text), `${data.variant} ${digits}: "${text}" is neither a text node nor an aria-label. Text: ${textNodes(html).join(' | ')}`);
    }
    for (const [digits, text] of [['arabic-indic', '٤٢'], ['latin', '42']]) {
      const html = draw(style, scene('figures', {variant: 'slot', value: 42, label: 'المشاهدات في أول يوم'}), 179, digits);
      assert.ok(ariaLabels(html).includes(text), `slot ${digits}: no aria-label="${text}" on the reel group`);
    }
    const sticker = draw(style, scene('figures', {variant: 'counter', value: 42, label: 'عدد الطلبات', sticker: {kind: 'emoji', id: 'money-bag'}}), 179);
    assert.match(sticker, /data-scene-sticker=/, 'figures draws its sticker');
  });

  test(`${style}: chat keeps whole messages, the five newest notifications and the typing side`, () => {
    for (const variant of ['bubbles', 'typing', 'notifications']) {
      const s = scene('chat-thread', {variant, title: 'محادثة توضيحية', messages: [{from: 'them', text: 'رسالة كاملة 42', at: 30}, {from: 'me', text: 'الإجابة واضحة', at: 90}]});
      for (const frame of FRAMES) assertClean(draw(style, s, frame), `${variant} @${frame}`);
      const html = draw(style, s, 150, 'arabic-indic');
      assert.equal(html, draw(style, s, 150, 'arabic-indic'), `${variant} is deterministic`);
      const nodes = textNodes(html);
      // A message set in two weights may split its rows; then the element drawing it carries the whole message as aria-label.
      const labels = ariaLabels(html);
      for (const text of ['رسالة كاملة ٤٢', 'الإجابة واضحة']) assert.ok(nodes.includes(text) || labels.includes(text), `${variant}: "${text}" is neither a whole text node nor its message's aria-label. Text: ${nodes.join(' | ')}`);
      assert.doesNotMatch(html, /white-space:pre-wrap/, variant);
    }
    const long = 'المونتاج خلص بدري والصوت اتظبط والكابشن اتراجع كلمة كلمة قبل ما نصدر النسخة الأخيرة';
    const thread = draw(style, scene('chat-thread', {variant: 'bubbles', title: 'فريق المحتوى', messages: [{from: 'them', text: 'فين النسخة؟', at: 20}, {from: 'me', text: long, at: 60}]}), 170);
    for (const word of long.split(' ')) assert.ok(words(thread).includes(word), `"${word}" is split across nodes or missing`);
    const breaks = draw(style, scene('chat-thread', {variant: 'bubbles', messages: [{from: 'them', text: 'one\ntwo\nthree\nfour', at: 0}]}), 100);
    assert.ok(drawnText(breaks).every((text) => !text.includes('\n')), 'an authored line break reached a drawn text node');
    for (const word of ['one', 'two', 'three', 'four']) assert.ok(words(breaks).includes(word), word);
    const many = scene('chat-thread', {variant: 'notifications', title: 'بعد ما نزل الريل', messages: Array.from({length: 8}, (_, i) => ({from: 'them', text: `رسالة ${i}`, at: i * 15}))});
    const shown = textNodes(draw(style, many, 179)).filter((text) => /^رسالة \d$/.test(text)).sort();
    assert.deepEqual(shown, ['رسالة 3', 'رسالة 4', 'رسالة 5', 'رسالة 6', 'رسالة 7']);
    const typing = scene('chat-thread', {variant: 'typing', messages: [{from: 'them', text: 'first', at: 30}, {from: 'me', text: 'second', at: 90}]});
    assert.match(draw(style, typing, 15), /data-chat-typing="left"/, 'English "them" types on the left');
    assert.match(draw(style, typing, 75), /data-chat-typing="right"/, 'English "me" types on the right');
    const sticker = draw(style, scene('chat-thread', {variant: 'bubbles', messages: [{from: 'them', text: 'رسالة واحدة', at: 20}], sticker: {kind: 'emoji', id: 'fire'}}), 170);
    assert.match(sticker, /data-scene-sticker=/, 'chat draws its sticker');
  });

  test(`${style}: proof pages mark one authored focus, keep words joined and map digits`, () => {
    for (const page of ['web', 'chat', 'dashboard']) {
      const s = scene('proof-screen', {...PROOF, page});
      for (const frame of FRAMES) {
        const html = draw(style, s, frame, 'arabic-indic');
        assertClean(html, `${page} @${frame}`);
        assert.ok((html.match(/data-proof-focus="true"/g) ?? []).length <= 1, `${page} @${frame}: more than one focus marker`);
      }
      const html = draw(style, s, 179, 'arabic-indic');
      assert.equal(html, draw(style, s, 179, 'arabic-indic'), `${page} is deterministic`);
      assert.equal((html.match(/data-proof-focus="true"/g) ?? []).length, 1, `${page}: exactly one focus marker`);
      assert.match(html, /data-proof-block="2"[^>]*data-proof-focus="true"/, `${page}: the marker is on the authored focus block`);
      for (const text of ['الفكرة', 'واحد', '٤٢', '٢٠٢٤']) assert.match(html, new RegExp(text), `${page}: ${text}`);
      const dense = scene('proof-screen', {page, blocks: Array.from({length: 10}, () => ({kind: 'text', text: 'شرح واضح من البريف '.repeat(6).trim()})), focus: 9, path: 'focus'});
      assert.doesNotThrow(() => draw(style, dense, 179, 'latin'), `${page} dense`);
    }
  });
}
