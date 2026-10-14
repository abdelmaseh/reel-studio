import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGlide, KIT_ENTRY} from './helpers/glide-ssr.mjs';
import {WIPE, wipeFrames, bulletSlide, vignetteOpacity} from '../engine/src/styles/grid-glide/scenes/math.ts';

// Real components, themes and safe-zone helpers; only the frame clock and frame rate, media elements and
// text measurement are replaced (tests/helpers/glide-ssr.mjs). The stand-in measures half a font size per
// character. `html(name, props, frame, {fps})` renders at another frame rate; the default is 30 fps.
const {html, h, kit} = await loadGlide(KIT_ENTRY);

const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label ?? 'value'}: ${actual} is not within ${tolerance} of ${expected}`);
const tags = (markup, name) => [...markup.matchAll(new RegExp(`<[a-z]+[^>]*data-glide="${name}"[^>]*>`, 'g'))].map((match) => match[0]);
const css = (tag, property) => {
  const style = (tag.match(/style="([^"]*)"/)?.[1] ?? '').replaceAll('&quot;', '"');
  const hit = style.split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith(`${property}:`));
  return hit === undefined ? undefined : hit.slice(property.length + 1);
};
const number = (text) => Number.parseFloat(text);
const move3d = (tag) => {
  const m = css(tag, 'transform')?.match(/translate3d\((-?[\d.]+)px, (-?[\d.]+)px, 0\)/);
  assert.ok(m, `no translate3d in ${tag}`);
  return {x: number(m[1]), y: number(m[2])};
};
const texts = (markup, name) => [...markup.matchAll(new RegExp(`data-glide="${name}"[^>]*>([^<]*)<`, 'g'))].map((match) => match[1]);
const opacities = (markup) => tags(markup, 'word').map((tag) => number(css(tag, 'opacity')));

const PROBE = '#00FF00';

test('a word is invisible on its start frame, first visible a frame later and settled 30 frames on', () => {
  const props = {text: 'Hello', start: 40, size: 70, weight: 500, rise: 130};
  const word = (frame, options) => tags(html('Word', props, frame, options), 'word')[0];
  const start = word(40);
  assert.equal(css(start, 'opacity'), '0');
  assert.deepEqual(move3d(start), {x: 0, y: 130});
  const first = word(41);
  near(number(css(first, 'opacity')), 0.2441, 1e-4);
  near(move3d(first).y, 98.3, 0.1);
  const settled = word(70);
  assert.equal(css(settled, 'opacity'), '1');
  assert.deepEqual(move3d(settled), {x: 0, y: 0});
  assert.equal(css(settled, 'font-family'), 'Grid Sans', 'text uses the Grid Sans alias, never a loaded file');
  assert.match(css(settled, 'font-variation-settings'), /opsz/);
  // The safe-zone probe measures the rest pose on any frame.
  const probed = word(40, {probe: PROBE});
  assert.equal(css(probed, 'opacity'), '1');
  assert.deepEqual(move3d(probed), {x: 0, y: 0});
});

test('an Arabic line animates whole words right to left and keeps Latin runs in order', () => {
  const words = ['افتح', 'Smart', 'Search', 'الآن'];
  const line = (frame, extra = {}) => html('Line', {words, at: 10, cadence: 7, y: 400, ...extra}, frame);
  const markup = line(10);
  assert.equal(css(tags(markup, 'line')[0], 'direction'), 'rtl');
  assert.deepEqual(texts(markup, 'word'), words, 'every word is one element: no per-character spans');
  const run = markup.match(/data-glide="latin-run"[^>]*>(.*?<\/span>)<\/span>/)[1];
  assert.deepEqual([...run.matchAll(/>([^<]+)</g)].map((match) => match[1]), ['Smart', 'Search']);
  assert.equal(css(tags(markup, 'latin-run')[0], 'direction'), 'ltr');
  assert.equal(tags(markup, 'latin-run').length, 1);
  // Word i starts at at + i x cadence: invisible on its start frame, later words still hidden.
  assert.deepEqual(opacities(line(10)), [0, 0, 0, 0]);
  const at17 = opacities(line(17));
  assert.ok(at17[0] > 0 && at17[1] === 0 && at17[2] === 0 && at17[3] === 0, `at 17: ${at17}`);
  const at24 = opacities(line(24));
  assert.ok(at24[0] > 0 && at24[1] > 0 && at24[2] === 0 && at24[3] === 0, `at 24: ${at24}`);
  assert.deepEqual(opacities(line(10 + 21 + 30)), [1, 1, 1, 1]);
  // Fractional cadences are legal.
  const half = opacities(line(17, {cadence: 6.5}));
  assert.ok(half[1] > 0, 'a word starting at 16.5 is drawn from frame 17');
  // Left to right text is not grouped.
  const english = html('Line', {words: ['Search', 'the', 'web'], at: 0, cadence: 7, y: 400, dir: 'ltr'}, 0);
  assert.equal(tags(english, 'latin-run').length, 0);
  assert.equal(css(tags(english, 'line')[0], 'direction'), 'ltr');
});

test('a line that cannot fit the safe width fails loudly instead of clipping', () => {
  const long = ['abcdefghijkl', 'abcdefghijkl', 'abcdefghijkl', 'abcdefghijkl', 'abcdefghijkl', 'abcdefghijkl'];
  assert.throws(() => html('Line', {words: long, at: 0, cadence: 7, y: 400, size: 100, role: 'hero'}, 0), /the line .* is \d+px wide at 100px but only 950px are safe/);
  // Below the action rail the safe band is narrower.
  const medium = ['abcdefgh', 'abcdefgh', 'abcdefgh'];
  assert.doesNotThrow(() => html('Line', {words: medium, at: 0, cadence: 7, y: 400, size: 70}, 0));
  assert.throws(() => html('Line', {words: ['abcdefghijklmnop', 'abcdefghijklmnop', 'abcdefghijklmnop'], at: 0, cadence: 7, y: 1200, size: 60}, 0), /only 788px are safe at y 1200/);
});

test('a box line wipes in reading direction with one clip edge and a fixed width', () => {
  const text = 'ثلاث خطوات بسيطة';
  const box = (frame, extra = {}) => tags(html('BoxLine', {text, at: 10, y: 800, ...extra}, frame), 'box')[0];
  const hideOf = (frame, extra) => number(css(box(frame, extra), 'clip-path').match(/inset\(0 0 0 ([\d.]+)%\)/)[1]);
  assert.equal(css(box(9), 'clip-path'), 'inset(0 0 0 100%)');
  assert.equal(css(box(10), 'clip-path'), 'inset(0 0 0 100%)');
  const words = 3;
  near(hideOf(25), (1 - WIPE(15 / wipeFrames(words))) * 100, 0.001, 'right-to-left clip at frame 25');
  assert.ok(hideOf(25) > 0 && hideOf(25) < 100);
  assert.equal(css(box(10 + 30), 'clip-path'), 'inset(0 0 0 0%)');
  assert.equal(css(box(25), 'direction'), 'rtl');
  // Left to right text wipes from the left edge.
  const ltr = tags(html('BoxLine', {text: 'Three simple steps', at: 10, y: 800, dir: 'ltr'}, 25), 'box')[0];
  const ltrHide = number(css(ltr, 'clip-path').match(/^inset\(0 ([\d.]+)% 0 0\)$/)[1]);
  near(ltrHide, (1 - WIPE(15 / wipeFrames(3))) * 100, 0.001);
  assert.equal(css(ltr, 'direction'), 'ltr');
  // Fixed 830 px box whatever the text; the text is fitted to 95 % of it, never larger than 88 px.
  assert.equal(css(box(25), 'width'), '830px');
  assert.equal(css(box(25), 'font-size'), '88px');
  const longer = tags(html('BoxLine', {text: 'x'.repeat(20), at: 10, y: 800}, 25), 'box')[0];
  assert.equal(css(longer, 'width'), '830px');
  assert.equal(css(longer, 'font-size'), '78px');
  assert.equal(css(longer, 'background'), '#262626');
  assert.equal(css(longer, 'color'), '#F4F4F4');
  assert.throws(() => html('BoxLine', {text: 'x'.repeat(100), at: 10, y: 800}, 25), /the box text .* needs \d+px at 48px but the box allows 788px/);
  // The probe sees the finished box.
  const probed = tags(html('BoxLine', {text, at: 10, y: 800}, 0, {probe: PROBE}), 'box')[0];
  assert.equal(css(probed, 'clip-path'), undefined);
});

test('a card is dead still: bevel, two-layer shadow, radius 24 and a 9 px screen', () => {
  const markup = html('Card', {y: 600, h: 465, children: h('i', null, 'screen')}, 33);
  const card = tags(markup, 'card')[0];
  assert.equal(css(card, 'transform'), undefined, 'a card never moves, tilts or scales');
  assert.equal(css(card, 'border-radius'), '24px');
  assert.equal(css(card, 'left'), '127px');
  assert.equal(css(card, 'width'), '827px');
  const shadow = css(card, 'box-shadow');
  assert.ok(shadow.includes('15px 15px 27px -3px rgba(0,0,0,.255), 48px 48px 45px 7px rgba(0,0,0,.163)'));
  assert.ok(shadow.startsWith('inset 0 1px 0 0 #fefefe'));
  assert.equal(css(card, 'background'), '#F9F9F7');
  const screen = tags(markup, 'card-screen')[0];
  assert.equal(css(screen, 'inset'), '9px');
  assert.equal(css(screen, 'border-radius'), '15px');
  assert.equal(css(screen, 'overflow'), 'hidden');
  assert.equal(markup, html('Card', {y: 600, h: 465, children: h('i', null, 'screen')}, 0), 'the same markup on every frame');
  const probed = tags(html('Card', {y: 600, h: 465}, 0, {probe: PROBE}), 'card')[0];
  assert.equal(css(probed, 'box-shadow').includes('rgba(0,0,0,.255)'), false, 'the outer shadow is decoration and is skipped under the probe');
});

test('card media changes by hard cuts, scrolls stills and plays videos from their cut-in', () => {
  const clips = [
    {at: 0, src: 'media/page.png', width: 1000, height: 3000, kind: 'image', scroll: {from: 0, to: 1}},
    {at: 40, src: 'media/clip.mp4', width: 1920, height: 1080, kind: 'video'},
    {at: 80, src: 'media/after.png', width: 1600, height: 900, kind: 'image'},
  ];
  const media = (frame, options) => html('CardMedia', {clips, width: 809, height: 447, until: 120}, frame, options);
  const still = tags(media(20), 'media-image')[0];
  near(-number(css(still, 'top').replace('px', '')), 990, 0.01, 'half way through its window the page is half scrolled');
  assert.equal(css(still, 'width'), '809px');
  assert.match(media(20), /src="\/media\/page\.png"/);
  assert.equal(css(tags(media(0), 'media-image')[0], 'top'), '0', 'scrolling starts at the top');
  near(-number(css(tags(media(39), 'media-image')[0], 'top').replace('px', '')), 1980 * 39 / 40, 0.01);
  // Frame 40 is a hard cut to the video: no crossfade, no leftover image.
  const cut = media(40);
  assert.equal(tags(cut, 'media-image').length, 0);
  assert.equal(tags(cut, 'media-video').length, 1);
  assert.match(cut, /data-kit="OffthreadVideo"/);
  assert.match(cut, /data-muted="true"/);
  assert.equal(/opacity|transition/.test(cut), false);
  assert.equal(/data-trim-before/.test(cut), false, 'no trim unless the clip asks for one');
  const trimmed = html('CardMedia', {clips: [{at: 0, src: 'media/clip.mp4', width: 1920, height: 1080, kind: 'video', trimBefore: 9}], width: 809, height: 447, until: 60}, 5);
  assert.match(trimmed, /data-trim-before="9"/);
  const last = tags(media(100), 'media-image')[0];
  assert.match(media(100), /src="\/media\/after\.png"/);
  assert.ok(number(css(last, 'height')) >= 447);
  // A first clip that is cut in late still fills the card from frame 0.
  const late = html('CardMedia', {clips: [{...clips[0], at: 12}, clips[1]], width: 809, height: 447, until: 120}, 3);
  assert.equal(tags(late, 'media-image').length, 1);
  assert.equal(media(20, {probe: PROBE}).includes('media/page.png'), false, 'the probe replaces footage with a flat fill');
  assert.throws(() => html('CardMedia', {clips: [], width: 809, height: 447, until: 120}, 0), /at least one media clip/);
});

test('the tool pill slides in from the left, fades in, and fits its label', () => {
  const pill = (frame, extra = {}, options) => html('Pill', {y: 937, at: 10, label: 'Notes', ...extra}, frame, options);
  const started = tags(pill(10), 'pill')[0];
  assert.equal(css(started, 'transform'), 'translateX(-660.6px)');
  assert.equal(css(started, 'opacity'), '0');
  const moving = tags(pill(20), 'pill')[0];
  const x = number(css(moving, 'transform').match(/translateX\((-?[\d.]+)px\)/)[1]);
  assert.ok(x < 0 && x > -100, `pill is nearly home after 10 frames: ${x}`);
  const settled = tags(pill(60), 'pill')[0];
  assert.equal(css(settled, 'transform'), 'translateX(0px)');
  assert.equal(css(settled, 'opacity'), '1');
  assert.equal(css(settled, 'left'), '133px');
  assert.equal(css(settled, 'direction'), 'ltr');
  assert.equal(css(settled, 'background'), '#E5E5E5');
  const label = tags(pill(60), 'pill-label')[0];
  assert.equal(css(label, 'text-transform'), 'uppercase', 'Latin labels are uppercase');
  assert.equal(css(label, 'font-size'), '72px');
  assert.match(css(label, 'letter-spacing'), /-0\.01em/);
  assert.equal(css(label, 'color'), '#191919');
  assert.match(pill(60, {logo: 'logos/tool.png'}), /<img src="\/logos\/tool\.png"/);
  assert.equal(/<img/.test(pill(60)), false, 'no logo, no image');
  // The dark tile belongs to a logo: without one the label is centred on the pill instead of sitting beside an empty square.
  assert.equal(tags(pill(60), 'pill-tile').length, 0, 'no logo, no tile');
  assert.equal(tags(pill(60, {logo: 'logos/tool.png'}), 'pill-tile').length, 1, 'a logo sits in the dark tile');
  const plain = tags(pill(60), 'pill-label')[0], withLogo = tags(pill(60, {logo: 'logos/tool.png'}), 'pill-label')[0];
  assert.equal(css(plain, 'text-align'), 'center');
  assert.equal(css(plain, 'flex'), '1');
  assert.equal(css(plain, 'margin-left'), '0');
  assert.equal(css(withLogo, 'text-align'), undefined, 'beside a logo the label keeps its place');
  assert.equal(css(withLogo, 'margin-left'), '22px');
  assert.equal(css(tags(pill(60, {logo: 'logos/tool.png'}), 'pill-tile')[0], 'margin-left'), '17px');
  // A long label shrinks to the 50 px floor, then fails.
  assert.equal(css(tags(pill(60, {label: 'A'.repeat(20)}), 'pill-label')[0], 'font-size'), '60px');
  assert.throws(() => pill(60, {label: 'A'.repeat(26)}), /the pill label .* needs \d+px at 50px but only 601px are free/);
  // Arabic: no uppercase and never letter-spaced.
  const arabic = tags(pill(60, {label: 'دفتر الملاحظات'}), 'pill-label')[0];
  assert.equal(css(arabic, 'text-transform'), undefined);
  assert.equal(css(arabic, 'letter-spacing'), undefined);
  // Probe: rest pose, no outer shadow.
  const probed = tags(pill(10, {}, {probe: PROBE}), 'pill')[0];
  assert.equal(css(probed, 'transform'), 'translateX(0px)');
  assert.equal(css(probed, 'opacity'), '1');
  assert.equal(css(probed, 'box-shadow').includes('rgba(0,0,0,.245)'), false);
});

test('the sparkle grows from nothing while unwinding, and is absent before its start', () => {
  const sparkle = (frame, options) => html('Sparkle', {cx: 790, cy: 1200, at: 5}, frame, options);
  assert.equal(sparkle(4), '');
  const first = tags(sparkle(5), 'sparkle')[0];
  assert.equal(css(first, 'transform'), `rotate(16deg) scale(${0.5 / 8.5})`);
  assert.equal(css(first, 'left'), '754px');
  assert.equal(css(first, 'top'), '1164px');
  assert.equal(css(tags(sparkle(13), 'sparkle')[0], 'transform'), 'rotate(0deg) scale(1)');
  assert.match(sparkle(13), /fill="#262626"/);
  assert.equal(css(tags(sparkle(0, {probe: PROBE}), 'sparkle')[0], 'transform'), 'rotate(0deg) scale(1)');
});

test('bullets mirror in Arabic: star on the right, words slide in from the left toward it', () => {
  const rtl = (frame, extra = {}) => html('Bullet', {words: ['يبحث', 'في', 'الويب'], at: 20, y: 1200, ...extra}, frame);
  const sparkles = (markup) => tags(markup, 'sparkle');
  assert.equal(sparkles(rtl(17)).length, 0, 'the star starts two frames before the first word');
  assert.equal(sparkles(rtl(18)).length, 1);
  assert.equal(css(sparkles(rtl(18))[0], 'left'), '754px', 'RTL star centre x 790');
  const row = tags(rtl(20), 'bullet-row')[0];
  assert.equal(css(row, 'right'), '378px', 'text starts at x 702');
  assert.equal(css(row, 'direction'), 'rtl');
  const words = tags(rtl(20), 'word');
  assert.equal(words.length, 3);
  words.forEach((tag) => assert.deepEqual(move3d(tag), {x: -bulletSlide(64), y: 0}));
  // Words are 5 frames apart.
  const at25 = opacities(rtl(25));
  assert.ok(at25[0] > 0 && at25[1] === 0, `at 25: ${at25}`);
  const at30 = opacities(rtl(30));
  assert.ok(at30[1] > 0 && at30[2] === 0, `at 30: ${at30}`);
  // Left to right is the mirror image.
  const ltr = html('Bullet', {words: ['Search', 'the', 'web'], at: 20, y: 1200, dir: 'ltr'}, 20);
  assert.equal(css(tags(ltr, 'sparkle')[0], 'left'), '164px');
  assert.equal(css(tags(ltr, 'bullet-row')[0], 'left'), '288px');
  tags(ltr, 'word').forEach((tag) => assert.deepEqual(move3d(tag), {x: bulletSlide(64), y: 0}));
  // A row too wide for its room shrinks toward 48 px, then fails.
  const shrunk = html('Bullet', {words: ['abcdefgh', 'ijklmnop', 'qrstuv'], at: 20, y: 1200}, 20);
  assert.equal(css(tags(shrunk, 'word')[0], 'font-size'), '55px');
  assert.deepEqual(move3d(tags(shrunk, 'word')[0]), {x: -bulletSlide(55), y: 0});
  assert.throws(() => html('Bullet', {words: ['abcdefghijkl', 'abcdefghijkl', 'abcdefghij'], at: 20, y: 1200}, 20), /the bullet .* needs \d+px at 48px but only 637px are free/);
  // Before its start every word is hidden; the probe sees the finished row.
  tags(rtl(0), 'word').forEach((tag) => assert.equal(css(tag, 'opacity'), '0'));
  const probed = html('Bullet', {words: ['يبحث', 'في', 'الويب'], at: 20, y: 1200}, 0, {probe: PROBE});
  tags(probed, 'word').forEach((tag) => assert.deepEqual(move3d(tag), {x: 0, y: 0}));
});

test('the watermark is faint, never letter-spaced in Arabic and hidden from the probe', () => {
  const latin = tags(html('Watermark', {text: '@example'}, 0), 'watermark')[0];
  assert.equal(css(latin, 'top'), '1617px');
  assert.equal(css(latin, 'font-size'), '75px');
  assert.equal(css(latin, 'font-weight'), '650');
  assert.equal(css(latin, 'letter-spacing'), '-0.049em');
  assert.equal(css(latin, 'color'), 'rgba(0,0,0,0.124)');
  assert.ok(html('Watermark', {text: '@example'}, 0).includes('>@example<'), 'the caller supplies the text; nothing is hard-coded');
  const arabic = tags(html('Watermark', {text: 'اسم القناة'}, 0), 'watermark')[0];
  assert.equal(css(arabic, 'letter-spacing'), undefined);
  assert.equal(html('Watermark', {text: '@example'}, 0, {probe: PROBE}).includes('watermark'), false);
});

test('a long watermark shrinks to fit the 950 px column and one that cannot fit at 36 px fails the render', () => {
  const size = (text) => number(css(tags(html('Watermark', {text}, 0), 'watermark')[0], 'font-size'));
  assert.equal(size('@abcdefghijklmno'), 75, 'a 16 character handle stays at 75 px');
  const handle = '@' + 'a'.repeat(30);
  assert.equal(size(handle), 61, 'a 31 character handle shrinks to the largest size that fits');
  assert.ok(handle.length * size(handle) * 0.5 <= 950, 'and its measured width is inside the column');
  assert.ok(handle.length * size(handle) * 0.5 <= 1015, 'and inside the frame margins');
  assert.equal(size('a'.repeat(52)), 36, 'a text that needs exactly the floor is drawn at 36 px');
  assert.throws(() => html('Watermark', {text: 'a'.repeat(54)}, 0), /Shorten the watermark/);
  assert.equal(css(tags(html('Watermark', {text: handle}, 0), 'watermark')[0], 'letter-spacing'), '-0.049em', 'the Latin tracking rule is unchanged');
});

test('the vignette bump peaks one frame before the boundary and hides from the probe', () => {
  const vignette = (frame, options) => html('Vignette', {boundary: 100}, frame, options);
  assert.equal(vignette(94), '');
  assert.equal(vignette(104), '');
  [95, 96, 97, 98, 99, 100, 101, 102, 103].forEach((frame) => {
    assert.equal(number(css(tags(vignette(frame), 'vignette')[0], 'opacity')), vignetteOpacity(frame, 100));
  });
  assert.equal(css(tags(vignette(99), 'vignette')[0], 'opacity'), '1');
  assert.match(css(tags(vignette(99), 'vignette')[0], 'background'), /rgba\(0,0,0,0\.24\) 100%\)$/);
  assert.equal(vignette(99, {probe: PROBE}).includes('vignette'), false);
});

test('the hook grid is a 7 by 9 lattice of dashed lines with a dot at every crossing', () => {
  const markup = html('GlideGrid', {}, 0);
  assert.equal((markup.match(/<line /g) ?? []).length, 16);
  assert.equal((markup.match(/<circle /g) ?? []).length, 63);
  assert.match(markup, /stroke="#CECECE"/);
  assert.match(markup, /stroke-dasharray="5 6"/);
  assert.equal(html('GlideGrid', {}, 0, {probe: PROBE}).includes('<svg'), false);
  const tight = html('GlideGrid', {spacing: 100}, 0);
  assert.match(tight, /x1="240"/);
});

test('a scene pushes its content out in the last 15 frames and the dressing stays put', () => {
  const scene = (frame, extra = {}, options) =>
    html('SceneMotion', {
      durationInFrames: 120, enter: {kind: 'cut'}, exit: {kind: 'push', dir: 'right'}, watermark: '@example', grid: true,
      children: h('i', {id: 'content'}, 'x'), ...extra,
    }, frame, options);
  const moving = (markup) => tags(markup, 'moving-layer')[0];
  const shift = (markup) => {
    const m = css(moving(markup), 'transform')?.match(/translate\((-?[\d.e-]+)px, (-?[\d.e-]+)px\)/);
    return m ? {x: number(m[1]), y: number(m[2])} : null;
  };
  assert.equal(shift(scene(105)), null, 'frame 105 is still at rest');
  near(shift(scene(106)).x, 0.6, 0.05);
  near(shift(scene(119)).x, 256.0, 0.1, 'last shown frame of a horizontal push');
  assert.equal(shift(scene(119)).y, 0);
  near(shift(scene(119, {exit: {kind: 'push', dir: 'left'}})).x, -256.0, 0.1);
  near(shift(scene(119, {exit: {kind: 'push', dir: 'down'}})).y, 128.0, 0.1, 'vertical pushes travel 200 px');
  near(shift(scene(119, {exit: {kind: 'push', dir: 'up'}})).y, -128.0, 0.1);
  // The moving layer holds the content and nothing else.
  const markup = scene(119);
  const layer = markup.slice(markup.indexOf('data-glide="moving-layer"'));
  assert.ok(layer.includes('id="content"'));
  assert.equal(layer.includes('data-glide="watermark"'), false, 'the watermark does not move with the scene');
  assert.equal(layer.includes('data-glide="grid"'), false, 'the grid does not move with the scene');
  assert.equal(markup.includes('data-glide="watermark"'), true);
  assert.equal(markup.includes('data-glide="grid"'), true);
  assert.equal(css(tags(markup, 'dip-layer')[0], 'filter'), undefined);
  // Slide-ins start offset and settle after 30 frames.
  const enter = (frame, extra) => scene(frame, {enter: {kind: 'slide', from: 'left', distance: 400}, exit: {kind: 'cut'}, ...extra});
  assert.equal(shift(enter(0)).x, -400);
  assert.equal(shift(enter(0, {enter: {kind: 'slide', from: 'right', distance: 500}})).x, 500);
  near(shift(enter(1)).x, -302.4, 0.1);
  assert.equal(shift(enter(30)), null);
  // A hard cut moves nothing.
  assert.equal(shift(scene(0, {enter: {kind: 'cut'}, exit: {kind: 'cut'}})), null);
  assert.equal(shift(scene(119, {enter: {kind: 'cut'}, exit: {kind: 'cut'}})), null);
  // The probe sees the rest pose of the content, and no dressing.
  const probed = scene(119, {}, {probe: PROBE});
  assert.equal(shift(probed), null);
  assert.equal(probed.includes('data-glide="watermark"'), false);
  assert.equal(probed.includes('data-glide="grid"'), false);
  assert.ok(probed.includes('id="content"'));
});

test('a dip blurs the whole scene, watermark included, and adds the vignette on both sides of the cut', () => {
  const scene = (frame, extra = {}) =>
    html('SceneMotion', {durationInFrames: 120, enter: {kind: 'dip'}, exit: {kind: 'dip'}, watermark: '@example', children: h('i', {id: 'content'}, 'x'), ...extra}, frame);
  const blur = (markup) => {
    const m = css(tags(markup, 'dip-layer')[0], 'filter')?.match(/^blur\(([\d.]+)px\)$/);
    return m ? number(m[1]) : 0;
  };
  // Incoming half: frames 0-4 of the next scene.
  near(blur(scene(0)), 14.8, 0.05);
  near(blur(scene(1)), 13.4, 0.05);
  near(blur(scene(4)), 2.35, 0.01);
  assert.equal(blur(scene(5)), 0);
  assert.equal(number(css(tags(scene(0), 'vignette')[0], 'opacity')), 0.93);
  assert.equal(tags(scene(4), 'vignette').length, 0);
  // Outgoing half: the last five frames of this scene.
  assert.equal(blur(scene(114)), 0);
  near(blur(scene(115)), 2.35, 0.01);
  near(blur(scene(119)), 14.8, 0.05);
  assert.equal(number(css(tags(scene(119), 'vignette')[0], 'opacity')), 1, 'the vignette peaks on the last shown frame');
  assert.equal(number(css(tags(scene(115), 'vignette')[0], 'opacity')), 0.12);
  // The watermark sits inside the blurred layer; the vignette is outside it.
  const markup = scene(119);
  const blurred = markup.slice(markup.indexOf('data-glide="dip-layer"'), markup.indexOf('data-glide="vignette"'));
  assert.ok(blurred.includes('data-glide="watermark"'));
  assert.equal(blurred.includes('data-glide="vignette"'), false);
  assert.equal(css(tags(markup, 'moving-layer')[0], 'transform'), undefined, 'a dip never translates');
  // Pair it with a slide or push and both effects apply.
  const mixed = html('SceneMotion', {durationInFrames: 120, enter: {kind: 'cut'}, exit: {kind: 'dip'}, children: h('i', null, 'x')}, 119);
  assert.equal(tags(mixed, 'vignette').length, 1);
  assert.equal(html('SceneMotion', {durationInFrames: 120, enter: {kind: 'cut'}, exit: {kind: 'cut'}, children: h('i', null, 'x')}, 60).includes('vignette'), false);
});

test('scene fonts follow the creator choice when one is passed and Grid Sans otherwise', () => {
  const child = h(kit.Word, {text: 'Hello', start: 0, size: 70, weight: 500});
  const fontOf = (markup) => css(tags(markup, 'word')[0], 'font-family');
  const base = {durationInFrames: 120, enter: {kind: 'cut'}, exit: {kind: 'cut'}, children: child};
  assert.equal(fontOf(html('SceneMotion', base, 30)), 'Grid Sans');
  assert.equal(fontOf(html('SceneMotion', {...base, fontFamily: 'Cairo'}, 30)), 'Cairo');
  assert.equal(fontOf(html('GlideFontProvider', {family: 'Tajawal', children: child}, 30)), 'Tajawal');
});

test('the kit follows the edit frame rate: the 30 fps law is stretched by fps / 30', () => {
  const at60 = {fps: 60};
  // Words: frame 2 at 60 fps looks like frame 1 at 30 fps, and a word settles after 60 frames.
  const word = (frame, options) => tags(html('Word', {text: 'Hello', start: 40, size: 70, weight: 500, rise: 130}, frame, options), 'word')[0];
  assert.equal(css(word(40, at60), 'opacity'), '0');
  near(number(css(word(42, at60), 'opacity')), number(css(word(41), 'opacity')), 1e-9, 'opacity two frames in at 60 fps');
  near(move3d(word(42, at60)).y, move3d(word(41)).y, 1e-6, 'rise two frames in at 60 fps');
  assert.notEqual(css(word(99, at60), 'opacity'), '1');
  assert.equal(css(word(100, at60), 'opacity'), '1');
  // Lines: the 7-frame cadence becomes 14 frames, while `at` stays a frame of the edit.
  const row = (frame) => opacities(html('Line', {words: ['one', 'two', 'three'], at: 10, cadence: 7, y: 400}, frame, at60));
  assert.ok(row(24)[0] > 0 && row(24)[1] === 0 && row(24)[2] === 0, `at 24: ${row(24)}`);
  assert.ok(row(25)[1] > 0 && row(25)[2] === 0, `at 25: ${row(25)}`);
  assert.ok(row(38)[1] > 0 && row(38)[2] === 0, `at 38: ${row(38)}`);
  assert.ok(row(39)[2] > 0, `at 39: ${row(39)}`);
  // The box wipe: three words take 23 frames at 30 fps and 46 at 60 fps.
  const box = (frame, options) => css(tags(html('BoxLine', {text: 'ثلاث خطوات بسيطة', at: 10, y: 800}, frame, options), 'box')[0], 'clip-path');
  [5, 10, 15].forEach((k) => assert.equal(box(10 + 2 * k, at60), box(10 + k), `frame ${2 * k} of the wipe at 60 fps is frame ${k} at 30 fps`));
  assert.equal(box(10 + 46, at60), 'inset(0 0 0 0%)');
  assert.equal(box(10 + 23), 'inset(0 0 0 0%)', 'the 30 fps wipe is unchanged');
  // The pill slides for 43.5 frames and its fade starts 5 frames after it.
  const pill = (frame, options) => tags(html('Pill', {y: 937, at: 10, label: 'Notes'}, frame, options), 'pill')[0];
  const pillX = (frame, options) => number(css(pill(frame, options), 'transform').match(/translateX\((-?[\d.]+)px\)/)[1]);
  near(pillX(30, at60), pillX(20), 1e-9, 'frame 20 after the start at 60 fps is frame 10 at 30 fps');
  assert.ok(pillX(52, at60) < 0, 'still sliding 42 frames in');
  assert.equal(pillX(54, at60), 0);
  assert.equal(css(pill(15, at60), 'opacity'), '0');
  assert.ok(number(css(pill(16, at60), 'opacity')) > 0);
  // The sparkle grows twice as slowly and starts 4 frames before its row's first word; bullet words are 10 frames apart.
  const sparkle = (frame, options) => tags(html('Sparkle', {cx: 790, cy: 1200, at: 5}, frame, options), 'sparkle')[0];
  assert.equal(css(sparkle(9, at60), 'transform'), css(sparkle(7), 'transform'), 'frame 4 after the start at 60 fps is frame 2 at 30 fps');
  const bullet = (frame) => html('Bullet', {words: ['يبحث', 'في', 'الويب'], at: 20, y: 1200}, frame, at60);
  assert.equal(tags(bullet(15), 'sparkle').length, 0);
  assert.equal(tags(bullet(16), 'sparkle').length, 1);
  assert.ok(opacities(bullet(30))[0] > 0 && opacities(bullet(30))[1] === 0, `at 30: ${opacities(bullet(30))}`);
  assert.ok(opacities(bullet(31))[1] > 0 && opacities(bullet(31))[2] === 0, `at 31: ${opacities(bullet(31))}`);
  // Scenes: pushes, slide-ins and dips stretch too.
  const scene = (frame, extra = {}) =>
    html('SceneMotion', {durationInFrames: 240, enter: {kind: 'cut'}, exit: {kind: 'push', dir: 'right'}, children: h('i', null, 'x'), ...extra}, frame, at60);
  const shift = (markup) => {
    const m = css(tags(markup, 'moving-layer')[0], 'transform')?.match(/translate\((-?[\d.e-]+)px, (-?[\d.e-]+)px\)/);
    return m ? {x: number(m[1]), y: number(m[2])} : null;
  };
  assert.equal(shift(scene(210)), null, 'the push starts 30 frames before the end at 60 fps');
  near(shift(scene(212)).x, 0.6, 0.05);
  near(shift(scene(238)).x, 256.0, 0.1, 'frame 238 at 60 fps is frame 14 of the 30 fps push');
  const slide = {enter: {kind: 'slide', from: 'left', distance: 400}, exit: {kind: 'cut'}};
  assert.equal(shift(scene(0, slide)).x, -400);
  near(shift(scene(2, slide)).x, -302.4, 0.1);
  assert.equal(shift(scene(60, slide)), null, 'the slide-in settles after 60 frames');
  const dip = (frame) => scene(frame, {enter: {kind: 'dip'}, exit: {kind: 'dip'}});
  const blur = (markup) => {
    const m = css(tags(markup, 'dip-layer')[0], 'filter')?.match(/^blur\(([\d.]+)px\)$/);
    return m ? number(m[1]) : 0;
  };
  // The dip keeps the 30 fps clock: frame 2k at 60 fps is frame k at 30 fps, so the window is ten frames out and nine in.
  near(blur(dip(0)), 14.82, 0.01, 'an incoming dip starts at the 30 fps value');
  near(blur(dip(8)), 2.35, 0.01);
  assert.equal(blur(dip(9)), 0);
  assert.equal(blur(dip(229)), 0);
  near(blur(dip(230)), 2.35, 0.01);
  near(blur(dip(239)), 15, 0.01);
  assert.equal(number(css(tags(dip(238), 'vignette')[0], 'opacity')), 1, 'the vignette peaks on the frame that is B - 1 at 30 fps');
  near(number(css(tags(dip(239), 'vignette')[0], 'opacity')), 0.965, 1e-9);
  near(number(css(tags(dip(0), 'vignette')[0], 'opacity')), 0.93, 1e-9);
  assert.equal(tags(dip(228), 'vignette').length, 0);
  assert.ok(number(css(tags(dip(229), 'vignette')[0], 'opacity')) > 0);
});
