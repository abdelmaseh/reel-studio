import test from 'node:test';
import assert from 'node:assert/strict';
import {bundleEngine, setSsrFps, setSsrFrame} from './helpers/engine-bundle.mjs';

const mod = await bundleEngine([
  "import React from 'react';",
  "import {renderToStaticMarkup} from 'react-dom/server';",
  "import {KineticSceneRenderer} from './engine/src/creative-kit/kinetic/scenes';",
  "const geometry = {windowTop:960, windowHeight:960, videoWidth:1080, videoLeft:0, videoTop:960};",
  "export const render = scene => renderToStaticMarkup(React.createElement(KineticSceneRenderer, {scene, style:'section-deck', geometry, aspect:16/9, seam:960}));",
].join('\n'), {ssr:true, media:true, plateStub:true});

const styleOf = value => Object.fromEntries(value.split(';').filter(Boolean).map(declaration => {
  const colon = declaration.indexOf(':');
  return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()];
}));
const elementsOf = html => {
  const elements = [], stack = [];
  // Keep card children and their text together; CSS property order is irrelevant.
  for (const match of html.matchAll(/<\/?([a-z][\w-]*)\b[^>]*>|([^<]+)/gi)) {
    const [token, tag, text] = match;
    if (text !== undefined) {
      for (const node of stack) node.text += (node.text ? ' ' : '') + text;
    } else if (token.startsWith('</')) {
      assert.equal(stack.pop()?.tag, tag, 'the rendered elements are balanced');
    } else {
      const node = {tag, style:styleOf(/\bstyle="([^"]*)"/.exec(token)?.[1] ?? ''), children:[], text:''};
      stack.at(-1)?.children.push(node);
      elements.push(node);
      if (!/\/>$/.test(token) && !/^(?:img|br|hr|input|link|meta|source)$/.test(tag)) stack.push(node);
    }
  }
  return elements;
};
const cardsOf = html => elementsOf(html).filter(node => node.style.display === 'flex' && node.style['align-items'] === 'center'
  && node.children.length === 3 && node.children[0].tag === 'span');
const render = (variant, items, {frame = 119, latin = false, image} = {}) => {
  setSsrFps(30); setSsrFrame(frame);
  return mod.render({id:'checklist-direction', family:'checklist', fromFrame:0, durationInFrames:120,
    layout:'takeover', motion:'land', data:{variant, kicker:latin ? 'CHECKLIST' : 'الخطوات',
      title:latin ? 'Clear steps' : 'قائمة واضحة', items, ...(image ? {image} : {})}});
};
const isolated = (node, direction) => {
  assert.equal(node.style.direction, direction, 'each text part keeps its own direction');
  assert.equal(node.style['unicode-bidi'], 'isolate', 'each text part is isolated from the row');
};
const assertCard = (card, item, index, {variant, rowDirection, labelDirection, detailDirection}) => {
  assert.equal(card.style.direction, rowDirection);
  assert.equal(card.style['flex-direction'] ?? 'row', 'row', 'the flex direction must not reverse the authored parts');
  const [number, middle, outer] = card.children;
  assert.equal(number.text, String(index + 1).padStart(2, '0'));
  isolated(number, 'ltr');
  assert.equal(number.style['text-align'] ?? 'left', rowDirection === 'rtl' ? 'right' : 'left', 'the number hugs the start edge');
  assert.equal(middle.style.direction, rowDirection, 'the title block anchors at the row start edge');
  const title = middle.children.at(-1);
  assert.equal(title.text, item.label, 'the title stays in the middle');
  isolated(title, labelDirection);
  assert.equal(title.style['text-align'], rowDirection === 'rtl' ? 'right' : 'left', 'title alignment follows the row');
  if (variant === 'blueprint') {
    const detail = middle.children[0];
    assert.equal(detail.style.direction, rowDirection, 'the blueprint detail block anchors beside its title');
    assert.equal(detail.text, item.detail);
    isolated(detail.children[0], detailDirection);
    assert.equal(detail.children[0].style['text-align'], rowDirection === 'rtl' ? 'right' : 'left');
    assert.equal(outer.text, '✓');
    isolated(outer, 'ltr');
  } else {
    assert.equal(outer.text, item.detail);
    assert.equal(outer.style.direction, rowDirection);
    isolated(outer.children[0], detailDirection);
    assert.equal(outer.children[0].style['text-align'], rowDirection === 'rtl' ? 'left' : 'right');
  }
};

for (const variant of ['missing', 'blueprint']) {
  test(variant + ': ChatGPT anchors beside its number in an Arabic row', () => {
    const items = [{label:'نكتب الفكرة', detail:'تم', atFrame:20},
      {label:'ChatGPT', detail:'API!', atFrame:40}, {label:'ننشر الريل', detail:'جاهز', atFrame:60}];
    const cards = cardsOf(render(variant, items));
    assert.equal(cards.length, items.length);
    cards.forEach((card, index) => assertCard(card, items[index], index,
      {variant, rowDirection:'rtl', labelDirection:index === 1 ? 'ltr' : 'rtl', detailDirection:index === 1 ? 'ltr' : 'rtl'}));
  });

  test(variant + ': only an Arabic row mirrors the image and its angle', () => {
    for (const latin of [false, true]) {
      const items = [{label:latin ? 'Plan' : 'خطة عربية', detail:'+10%', atFrame:20}];
      const images = elementsOf(render(variant, items, {latin, image:'tall.svg'}))
        .filter(node => node.children.some(child => child.tag === 'img'));
      assert.equal(images.length, 1);
      assert.equal(images[0].style.left, latin ? '580px' : '120px');
      assert.equal(images[0].style.transform, latin ? 'rotate(3deg)' : 'rotate(-3deg)');
      assert.equal(images[0].style.width, '380px');
      assert.equal(images[0].style.height, '630px');
    }
  });

  test(variant + ': Arabic rows mirror the parts while Latin details stay ltr', () => {
    const items = [{label:'خطوة أولى', detail:'+10%', atFrame:20}, {label:'خطوة ثانية', detail:'API!', atFrame:40}];
    const cards = cardsOf(render(variant, items));
    assert.equal(cards.length, items.length);
    cards.forEach((card, index) => assertCard(card, items[index], index,
      {variant, rowDirection:'rtl', labelDirection:'rtl', detailDirection:'ltr'}));
  });

  test(variant + ': Latin rows keep their original order and detail alignment', () => {
    const items = [{label:'Plan', detail:'+10%', atFrame:20}, {label:'Build', detail:'API!', atFrame:40}];
    const cards = cardsOf(render(variant, items, {latin:true}));
    assert.equal(cards.length, items.length);
    cards.forEach((card, index) => assertCard(card, items[index], index,
      {variant, rowDirection:'ltr', labelDirection:'ltr', detailDirection:'ltr'}));
  });

  test(variant + ': Arabic details choose one shared direction even for a fully Latin card', () => {
    const items = [{label:'Plan', detail:'تفاصيل عربية واضحة', atFrame:20}, {label:'API!', detail:'+10%', atFrame:40}];
    const cards = cardsOf(render(variant, items, {latin:true}));
    assert.equal(cards.length, items.length);
    cards.forEach((card, index) => assertCard(card, items[index], index,
      {variant, rowDirection:'rtl', labelDirection:'ltr', detailDirection:index === 0 ? 'rtl' : 'ltr'}));
  });
}

test('an inactive missing card isolates the label it actually displays and aligns it left', () => {
  const items = [{label:'خطوة عربية', detail:'API!', atFrame:20}];
  const cards = cardsOf(render('missing', items, {frame:0}));
  assert.equal(cards.length, 1);
  assertCard(cards[0], {...items[0], detail:'ناقص'}, 0,
    {variant:'missing', rowDirection:'rtl', labelDirection:'rtl', detailDirection:'rtl'});
});

test('card and part lookup tolerates a different CSS property order', () => {
  const items = [{label:'خطوة عربية', detail:'+10%', atFrame:20}];
  const html = render('missing', items).replace(/style="([^"]*)"/g,
    (_attribute, style) => 'style="' + style.split(';').reverse().join(';') + '"');
  const cards = cardsOf(html);
  assert.equal(cards.length, 1);
  assertCard(cards[0], items[0], 0,
    {variant:'missing', rowDirection:'rtl', labelDirection:'rtl', detailDirection:'ltr'});
});
