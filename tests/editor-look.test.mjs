import test from 'node:test';
import assert from 'node:assert/strict';
import {CAPTION_GROUPING, CAPTION_PRESENTATION, DIGIT_CHOICES, DIGIT_LABELS_AR, FONT_CHOICES} from '../engine/src/core/preference-options.ts';
import {compileEdit} from '../engine/src/prepared-edit/timeline.ts';
import {STYLE_IDS, clauseCaptionsDefault, defaultCaptionsFor, defaultFontFor} from '../engine/src/styles/registry.ts';
import {LOOK_KEYS, LOOK_OPTIONS, completeLookPatch, effectiveGrouping, lookResetPatch, lookView, setLook} from '../engine/src/review-editor/ops/look.ts';
import {validateManifest} from '../engine/src/review-editor/validate.ts';
import {createEditorStore} from '../engine/src/review-editor/store.ts';
import {
  DIGITS_VALUES, FONT_LABEL, GROUPING_LABEL, LOOK_COALESCE, LOOK_STEP, LOOK_TEXT, PRESENTATION_LABEL, digitsLabel, digitsPatchValue, fontLabel, lookChange, lookReset,
} from '../engine/src/review-editor/panels/look-state.ts';
import {buildReviewApp} from '../scripts/lib/review-editor-build.mjs';
import {bundleEngine} from './helpers/engine-bundle.mjs';
import {dialectIn} from './helpers/dialect.mjs';
import {reviewManifest} from './helpers/review-manifest.mjs';

const LETTERS = 'أبجدهوزحطيكلمنسعفصقرشتثخذضظغ';
const words = (count = 12) => Array.from({length: count}, (_, i) => ({text: `كلمة${LETTERS[i]}`, startMs: i * 300, endMs: (i + 1) * 300, confidence: 1}));
// A recording from before fonts were written: no chosen font, no grouping, no caption shape. Twelve words, 0.3 s each.
const legacy = (style = 'liquid-glass') => {
  const m = reviewManifest('look-test');
  m.style = style;
  delete m.fontFamily;
  delete m.captions.grouping;
  delete m.captions.presentation;
  m.captions.words = words();
  return m;
};
const differing = (a, b) => Object.keys({...a, ...b}).filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]));
const bad = (m) => effectiveGrouping(m) === 'clauses' && m.fontFamily === undefined;
const styleWay = (style) => (clauseCaptionsDefault(style) ? 'clauses' : 'compact');
// The words the first compiled caption group holds for each grouping of the twelve-word fixture.
const FIRST_GROUP_WORDS = {compact: 4, clauses: 9, single: 1};
// The registry decides which styles group by sentence and which prefer a caption shape other than the pill; the tests follow it.
const CLAUSE_STYLES = STYLE_IDS.filter((id) => clauseCaptionsDefault(id));
const COMPACT_STYLES = STYLE_IDS.filter((id) => !clauseCaptionsDefault(id));
const SHAPE_STYLES = STYLE_IDS.filter((id) => defaultCaptionsFor(id) !== 'pill');

test('the Look choices are the very lists the planner and the settings screen use', () => {
  assert.equal(LOOK_OPTIONS.fonts, FONT_CHOICES);
  assert.equal(LOOK_OPTIONS.groupings, CAPTION_GROUPING);
  assert.equal(LOOK_OPTIONS.presentations, CAPTION_PRESENTATION);
  assert.equal(LOOK_OPTIONS.digits, DIGIT_CHOICES);
  assert.deepEqual([...LOOK_KEYS], ['fontFamily', 'captionsGrouping', 'captionsPresentation', 'digits']);
});

test('a Look patch writes only its own keys, clears what may be cleared and treats an equal value as no change', () => {
  const m = legacy();
  const before = JSON.stringify(m);
  const font = setLook(m, {fontFamily: 'Tajawal'});
  assert.equal(font.ok, true, font.reason);
  assert.equal(font.changed, true);
  assert.deepEqual(differing(m, font.manifest), ['fontFamily']);
  const again = setLook(font.manifest, {fontFamily: 'Tajawal'});
  assert.equal(again.ok, true);
  assert.equal(again.changed, false);
  assert.equal(again.manifest, font.manifest, 'an equal value hands back the same manifest, so the editor stays clean');

  const shape = setLook(m, {captionsPresentation: 'minimal'});
  assert.deepEqual(differing(m, shape.manifest), ['captions']);
  assert.deepEqual(differing(m.captions, shape.manifest.captions), ['presentation']);
  const grouping = setLook(m, {captionsGrouping: 'single'});
  assert.deepEqual(differing(m.captions, grouping.manifest.captions), ['grouping']);
  const cleared = setLook(grouping.manifest, {captionsGrouping: null});
  assert.equal('grouping' in cleared.manifest.captions, false, 'null removes the grouping key');
  assert.deepEqual(cleared.manifest, m);
  const digits = setLook(m, {digits: 'arabic-indic'});
  assert.equal(digits.manifest.digits, 'arabic-indic');
  assert.deepEqual(differing(m, digits.manifest), ['digits']);
  const noDigits = setLook(digits.manifest, {digits: null});
  assert.equal('digits' in noDigits.manifest, false, 'null removes the digits key');
  assert.deepEqual(noDigits.manifest, m);

  assert.equal(setLook(m, {digits: null}).changed, false, 'clearing what is absent changes nothing');
  assert.equal(setLook(m, {captionsGrouping: null}).changed, false);
  assert.equal(setLook(m, {}).changed, false);

  const all = setLook(m, {fontFamily: 'Tajawal', captionsGrouping: 'compact', captionsPresentation: 'ink-strip', digits: 'latin'});
  assert.equal(all.ok, true, all.reason);
  assert.deepEqual(differing(m, all.manifest).sort(), ['captions', 'digits', 'fontFamily']);
  assert.deepEqual(differing(m.captions, all.manifest.captions).sort(), ['grouping', 'presentation']);
  for (const result of [font, shape, grouping, cleared, digits, noDigits, all]) assert.equal(validateManifest(result.manifest).ok, true);
  assert.equal(JSON.stringify(m), before, 'the input manifest is never mutated');
});

test('every font, caption shape, grouping and digits choice in the lists is accepted and reads back', () => {
  const m = legacy();
  for (const font of FONT_CHOICES) {
    const result = setLook(m, {fontFamily: font});
    assert.equal(result.ok, true, `${font}: ${result.reason}`);
    assert.equal(result.manifest.fontFamily, font);
    assert.equal(lookView(result.manifest).font.value, font);
    assert.equal(validateManifest(result.manifest).ok, true, font);
  }
  for (const shape of CAPTION_PRESENTATION) assert.equal(lookView(setLook(m, {captionsPresentation: shape}).manifest).presentation.value, shape, shape);
  for (const digits of DIGIT_CHOICES) assert.equal(lookView(setLook(m, {digits}).manifest).digits.value, digits, digits);
  // The pair the full-sentence grouping needs is accepted for every font, so the matrix of fonts and groupings never meets a refusal.
  for (const font of FONT_CHOICES) {
    for (const grouping of CAPTION_GROUPING) {
      const result = setLook(m, completeLookPatch(m, {fontFamily: font, captionsGrouping: grouping}));
      assert.equal(result.ok, true, `${font} + ${grouping}: ${result.reason}`);
      assert.equal(result.manifest.fontFamily, font);
      assert.equal(result.manifest.captions.grouping, grouping);
      assert.equal(bad(result.manifest), false);
    }
  }
});

test('unknown keys, values outside the lists and impossible deletions are refused in neutral Arabic', () => {
  const cases = [
    [{color: 'red'}, /غير معروفة/], [{fontFamily: 'Comic Sans'}, /غير متاح/], [{fontFamily: null}, /لا يُحذف الخط/],
    [{captionsPresentation: 'wow'}, /غير متاح/], [{captionsPresentation: null}, /لا يُحذف شكل/],
    [{captionsGrouping: 'huge'}, /غير متاح/], [{digits: 'roman'}, /غير متاح/],
  ];
  for (const [patch, pattern] of cases) {
    const m = legacy();
    const result = setLook(m, patch);
    assert.equal(result.ok, false, JSON.stringify(patch));
    assert.match(result.reason, pattern, JSON.stringify(patch));
    assert.deepEqual(dialectIn(result.reason), [], result.reason);
    assert.equal(m.fontFamily, undefined);
  }
  const noFont = setLook(legacy(), {captionsGrouping: 'clauses'});
  assert.equal(noFont.ok, false);
  assert.match(noFont.reason, /خطًا محددًا/);
  assert.deepEqual(dialectIn(noFont.reason), [], noFont.reason);
  const graphics = legacy();
  graphics.contentMode = 'graphics';
  for (const patch of [{captionsGrouping: 'single'}, {captionsPresentation: 'minimal'}]) {
    const result = setLook(graphics, patch);
    assert.equal(result.ok, false);
    assert.match(result.reason, /مشاريع الجرافيك/);
    assert.deepEqual(dialectIn(result.reason), []);
  }
  assert.equal(setLook(graphics, {fontFamily: 'Tajawal'}).ok, true, 'a graphics project still takes a font');
  assert.equal(setLook(graphics, {digits: 'latin'}).ok, true, 'and the digits');
});

test('reset writes the style default explicitly for font and caption shape and removes grouping and digits', () => {
  assert.ok(STYLE_IDS.length > 0);
  for (const style of STYLE_IDS) {
    const m = legacy(style);
    assert.deepEqual(lookResetPatch(m, 'fontFamily'), {fontFamily: defaultFontFor(style)}, style);
    assert.deepEqual(lookResetPatch(m, 'captionsPresentation'), {captionsPresentation: defaultCaptionsFor(style)}, style);
    assert.deepEqual(lookResetPatch(m, 'digits'), {digits: null});
    const font = setLook(m, lookResetPatch(m, 'fontFamily'));
    assert.equal(font.manifest.fontFamily, defaultFontFor(style), `${style}: the font is written, not deleted`);
    assert.ok(FONT_CHOICES.includes(font.manifest.fontFamily), style);
    const shape = setLook(m, lookResetPatch(m, 'captionsPresentation'));
    assert.equal(shape.manifest.captions.presentation, defaultCaptionsFor(style), `${style}: the caption shape is written, not deleted`);

    const single = setLook(m, completeLookPatch(m, {captionsGrouping: 'single'})).manifest;
    const reset = setLook(single, lookResetPatch(single, 'captionsGrouping'));
    assert.equal(reset.ok, true, `${style}: ${reset.reason}`);
    assert.equal('grouping' in reset.manifest.captions, false);
    assert.equal(effectiveGrouping(reset.manifest), styleWay(style));
    assert.equal(bad(reset.manifest), false, `${style}: the reset never leaves full sentences without a font`);
    assert.equal(validateManifest(reset.manifest).ok, true, style);
  }
});

test('the full-sentence grouping is never left without a chosen font, whatever order the choices come in', () => {
  assert.ok(COMPACT_STYLES.length > 0 && CLAUSE_STYLES.length > 0, 'the registry has styles of both ways');
  const pool = [{captionsGrouping: 'clauses'}, {captionsGrouping: 'single'}, {captionsGrouping: 'compact'}, {captionsGrouping: null},
    {fontFamily: 'Tajawal'}, {captionsPresentation: 'minimal'}, {digits: 'latin'}, {digits: null}];
  const start = legacy(COMPACT_STYLES[0]);
  assert.equal(setLook(start, {captionsGrouping: 'clauses'}).ok, false, 'on its own the pair is refused');
  const completed = setLook(start, completeLookPatch(start, {captionsGrouping: 'clauses'}));
  assert.equal(completed.ok, true, completed.reason);
  assert.equal(completed.manifest.fontFamily, defaultFontFor(start.style), 'the panel sends the style font together with the grouping');

  let accepted = 0;
  const walk = (m, depth) => {
    if (depth === 0) return;
    for (const patch of pool) {
      const result = setLook(m, patch);
      if (result.ok) {
        accepted++;
        assert.equal(bad(result.manifest), false, JSON.stringify(patch));
        walk(result.manifest, depth - 1);
      }
      const sent = setLook(m, completeLookPatch(m, patch));
      assert.equal(sent.ok, true, `a completed patch is always accepted: ${JSON.stringify(patch)} ${sent.reason}`);
      assert.equal(bad(sent.manifest), false);
    }
  };
  walk(start, 3);
  assert.ok(accepted > 100, `the walk covered ${accepted} accepted states`);

  // A style that groups by sentence starts in the state the invariant forbids once a grouping is touched; the reset and the style way both get the font.
  for (const style of CLAUSE_STYLES) {
    const old = legacy(style);
    assert.equal(bad(old), true, `${style}: a manifest from before fonts can already be in that state (the style groups by sentence)`);
    assert.equal(setLook(old, {digits: 'latin'}).ok, true, `${style}: a patch that does not touch the grouping is never refused for it`);
    assert.equal(setLook(old, {captionsGrouping: 'clauses'}).ok, false, style);
    assert.equal(setLook(old, completeLookPatch(old, {captionsGrouping: 'clauses'})).ok, true, style);
    assert.equal(setLook(old, {captionsGrouping: 'single'}).ok, true, `${style}: leaving the sentence grouping needs no font`);
  }
});

test('lookView reports the grouping the timeline really compiles, the shape the renderer draws and the chosen font', () => {
  for (const style of STYLE_IDS) {
    for (const value of [undefined, ...CAPTION_GROUPING]) {
      const m = legacy(style);
      if (value) m.captions.grouping = value;
      const view = lookView(m);
      const expected = value ?? styleWay(style);
      assert.equal(view.grouping.effective, expected, `${style} ${value}`);
      assert.equal(view.grouping.value, value ?? null);
      assert.equal(view.grouping.ignored, false);
      assert.equal(compileEdit(m).captionGroups[0].words.length, FIRST_GROUP_WORDS[expected], `${style} ${value}: effective grouping matches the first compiled group`);
    }
  }
  const phrases = legacy();
  phrases.captions.mode = 'phrases';
  assert.equal(lookView(phrases).grouping.ignored, true, 'phrases mode ignores the grouping');
  assert.equal(compileEdit(phrases).captionGroups[0].words.length, 1);

  assert.ok(SHAPE_STYLES.length > 0, 'the registry has a style whose caption shape is not the pill');
  for (const style of STYLE_IDS) {
    const bare = lookView(legacy(style));
    assert.equal(bare.presentation.effective, 'pill', `${style}: a missing shape is drawn as the pill whatever the style prefers`);
    assert.equal(bare.presentation.styleDefault, defaultCaptionsFor(style), style);
    assert.equal(bare.presentation.value, null);
    assert.deepEqual(bare.font, {value: null, styleDefault: defaultFontFor(style)}, style);
    assert.deepEqual(bare.digits, {value: null}, 'a missing digits choice reads as «as written», never as Latin');
    assert.equal(bare.style, style);
  }
  const glide = legacy(SHAPE_STYLES[0]);
  const chosen = setLook(glide, {fontFamily: 'Tajawal', captionsPresentation: 'ink-strip', digits: 'arabic-indic'}).manifest;
  const view = lookView(chosen);
  assert.equal(view.font.value, 'Tajawal');
  assert.equal(view.presentation.value, 'ink-strip');
  assert.equal(view.presentation.effective, 'ink-strip');
  assert.deepEqual(view.digits, {value: 'arabic-indic'});
  assert.equal(view.style, SHAPE_STYLES[0]);
  assert.equal(view.captionsShown, true);
  assert.equal(view.graphics, false);

  const hidden = legacy();
  hidden.captions.visible = false;
  assert.equal(lookView(hidden).captionsShown, false);
  const graphics = legacy();
  graphics.contentMode = 'graphics';
  assert.equal(lookView(graphics).graphics, true);
  assert.equal(lookView(graphics).captionsShown, false);
});

// ---- the panel: labels, one undo per control, the real tab -----------------------------------------------------
const ARABIC = /\p{Script=Arabic}/u;

test('every Look option has an Arabic label, the digits row shows the three owner-approved labels and the text is neutral Arabic', () => {
  assert.deepEqual(Object.keys(GROUPING_LABEL).sort(), [...CAPTION_GROUPING].sort());
  assert.deepEqual(Object.keys(PRESENTATION_LABEL).sort(), [...CAPTION_PRESENTATION].sort());
  assert.deepEqual(Object.keys(FONT_LABEL).sort(), [...FONT_CHOICES].sort(), 'every font in the list has its own label');
  for (const font of FONT_CHOICES) {
    assert.ok(fontLabel(font).includes(font), `${font}: the label keeps the family name the assistant and the settings screen use`);
    if (fontLabel(font) !== font) assert.match(fontLabel(font), ARABIC, `${font}: a hint is written in Arabic`);
  }
  assert.equal(fontLabel('A font from a later release'), 'A font from a later release', 'an unlisted font is shown by its own name');
  assert.deepEqual([...DIGITS_VALUES], ['auto', ...DIGIT_CHOICES]);
  assert.deepEqual(DIGITS_VALUES.map(digitsLabel), ['كما هو', '1 2 3', '١ ٢ ٣']);
  for (const value of DIGITS_VALUES) assert.equal(digitsLabel(value), DIGIT_LABELS_AR[value], 'the editor reads the same map as the settings screen');
  assert.equal(digitsPatchValue('auto'), null);
  assert.equal(digitsPatchValue('latin'), 'latin');
  assert.equal(digitsPatchValue('arabic-indic'), 'arabic-indic');
  assert.deepEqual(LOOK_COALESCE, {fontFamily: 'look:font', captionsGrouping: 'look:grouping', captionsPresentation: 'look:presentation', digits: 'look:digits'});
  assert.deepEqual(Object.keys(LOOK_COALESCE).sort(), [...LOOK_KEYS].sort());
  assert.equal(new Set(Object.values(LOOK_COALESCE)).size, LOOK_KEYS.length);
  assert.deepEqual(Object.keys(LOOK_STEP).sort(), [...LOOK_KEYS].sort());
  const texts = [...Object.values(GROUPING_LABEL), ...Object.values(PRESENTATION_LABEL), ...Object.values(LOOK_STEP), ...Object.values(LOOK_TEXT)];
  for (const text of texts) {
    assert.match(text, ARABIC, text);
    assert.deepEqual(dialectIn(text), [], text);
  }
  for (const text of [...Object.values(FONT_LABEL), ...DIGITS_VALUES.map(digitsLabel)]) assert.deepEqual(dialectIn(text), [], text);
});

test('each control is one undo step however fast it changes, and two controls are two steps', () => {
  let clock = 1000;
  const store = createEditorStore(legacy(), {now: () => clock});
  // The same command the panel sends, applied the way the panel's runner applies it.
  const send = (target, {label, fn, options}) => target.apply((current) => {
    const result = fn(current);
    return result.ok ? result.manifest : current;
  }, label, options);
  send(store, lookChange('fontFamily', {fontFamily: 'Tajawal'}));
  clock += 100;
  send(store, lookChange('fontFamily', {fontFamily: 'Cairo'}));
  clock += 100;
  send(store, lookChange('fontFamily', {fontFamily: 'Plex Display'}));
  clock += 100;
  send(store, lookChange('digits', {digits: 'latin'}));
  assert.equal(store.getSnapshot().manifest.fontFamily, 'Plex Display');
  assert.equal(store.getSnapshot().undoLabel, LOOK_STEP.digits);
  store.undo();
  assert.equal(store.getSnapshot().manifest.digits, undefined, 'the digits step went first');
  assert.equal(store.getSnapshot().manifest.fontFamily, 'Plex Display');
  store.undo();
  assert.equal(store.getSnapshot().manifest.fontFamily, undefined, 'three quick font changes were one step');
  assert.equal(store.getSnapshot().canUndo, false);
  store.redo();
  assert.equal(store.getSnapshot().manifest.fontFamily, 'Plex Display');

  // A reset is a step of its own and never merges into the change before it.
  clock += 100;
  send(store, lookReset('fontFamily'));
  assert.equal(store.getSnapshot().manifest.fontFamily, defaultFontFor('liquid-glass'));
  store.undo();
  assert.equal(store.getSnapshot().manifest.fontFamily, 'Plex Display');

  // A grouping change on a manifest without a font carries the style font in the same step.
  const fresh = createEditorStore(legacy('section-deck'), {now: () => clock});
  send(fresh, lookChange('captionsGrouping', {captionsGrouping: 'clauses'}));
  assert.equal(fresh.getSnapshot().manifest.captions.grouping, 'clauses');
  assert.equal(fresh.getSnapshot().manifest.fontFamily, defaultFontFor('section-deck'));
  fresh.undo();
  assert.equal(fresh.getSnapshot().manifest.fontFamily, undefined, 'font and grouping were applied and undone together');
  assert.equal(fresh.getSnapshot().manifest.captions.grouping, undefined);
});

test('the Look tab renders the style, every choice and the right notes and disabled controls', async () => {
  const {render} = await bundleEngine(`
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {EditorStoreProvider, createEditorStore} from './engine/src/review-editor/store.ts';
    import {LookPanel} from './engine/src/review-editor/panels/look.tsx';
    export const render = (manifest) => {
      const store = createEditorStore(manifest);
      const props = {manifest, apply: store.apply, playhead: 0, seek() {}, selection: null, select() {}, issues: [], project: {staticFiles: []}};
      return renderToStaticMarkup(React.createElement(EditorStoreProvider, {store}, React.createElement(LookPanel, props)));
    };
  `);
  const tag = (html, name, label) => new RegExp(`<${name}[^>]*aria-label="${label}"[^>]*>`).exec(html)?.[0] ?? '';
  const select = (html, label) => tag(html, 'select', label);
  const resetButton = (html, section) => tag(html, 'button', `${section === LOOK_TEXT.digits ? LOOK_TEXT.resetDigits : LOOK_TEXT.reset}: ${section}`);
  const m = legacy();
  const html = render(m);
  for (const text of [LOOK_TEXT.title, LOOK_TEXT.hint, LOOK_TEXT.styleNote, 'liquid-glass', `${LOOK_TEXT.fontDefault} (Cairo)`, LOOK_TEXT.clausesNote, LOOK_TEXT.digitsNote]) assert.ok(html.includes(text), text);
  for (const font of FONT_CHOICES) assert.ok(html.includes(`>${fontLabel(font)}</option>`), font);
  for (const label of Object.values(GROUPING_LABEL)) assert.ok(html.includes(`>${label}</option>`), label);
  for (const label of Object.values(PRESENTATION_LABEL)) assert.ok(html.includes(`>${label}</option>`), label);
  for (const value of DIGITS_VALUES) assert.ok(html.includes(`>${digitsLabel(value)}</option>`), value);
  for (const label of [LOOK_TEXT.font, LOOK_TEXT.grouping, LOOK_TEXT.presentation, LOOK_TEXT.digits]) {
    assert.ok(select(html, label), `the ${label} select exists`);
    assert.doesNotMatch(select(html, label), /disabled/, label);
  }
  assert.ok(html.includes('value="compact" selected'), 'the grouping shows what the timeline compiles');
  assert.ok(html.includes('value="pill" selected'), 'and the caption shape shows what the renderer draws');
  assert.ok(html.includes('value="auto" selected'), 'and the digits show «as written» while nothing is chosen');
  for (const section of [LOOK_TEXT.font, LOOK_TEXT.grouping, LOOK_TEXT.presentation, LOOK_TEXT.digits]) {
    assert.ok(resetButton(html, section), `the ${section} reset button exists`);
    assert.match(resetButton(html, section), /disabled/, `${section}: nothing to reset on a manifest that follows the style`);
  }

  const withFont = setLook(m, {fontFamily: 'Tajawal'}).manifest;
  const chosen = render(withFont);
  assert.equal(chosen.includes(`${LOOK_TEXT.fontDefault} (`), false, 'a chosen font replaces the style-default placeholder');
  assert.equal(chosen.includes(LOOK_TEXT.clausesNote), false, 'and the note about pinning the style font goes with it');
  assert.ok(chosen.includes('value="Tajawal" selected'));
  assert.doesNotMatch(resetButton(chosen, LOOK_TEXT.font), /disabled/, 'a font other than the style default can be reset');
  const atDefault = render(setLook(m, {fontFamily: defaultFontFor(m.style)}).manifest);
  assert.match(resetButton(atDefault, LOOK_TEXT.font), /disabled/, 'a font that already is the style default has nothing to reset');
  const grouped = render(setLook(m, {captionsGrouping: 'single'}).manifest);
  assert.ok(grouped.includes('value="single" selected'));
  assert.doesNotMatch(resetButton(grouped, LOOK_TEXT.grouping), /disabled/);
  assert.equal(render(setLook(m, {digits: 'arabic-indic'}).manifest).includes('value="arabic-indic" selected'), true);
  assert.doesNotMatch(resetButton(render(setLook(m, {digits: 'latin'}).manifest), LOOK_TEXT.digits), /disabled/);

  // Every style shows its own default font and the caption shape of the registry, whatever the registry holds.
  for (const style of STYLE_IDS) {
    const page = render(legacy(style));
    assert.ok(page.includes(`${LOOK_TEXT.fontDefault} (${fontLabel(defaultFontFor(style))})`), `${style}: the style font is named`);
    assert.ok(page.includes(`value="${styleWay(style)}" selected`), `${style}: the grouping shows the style's way`);
    const shape = setLook(legacy(style), {captionsPresentation: defaultCaptionsFor(style)}).manifest;
    assert.match(resetButton(render(shape), LOOK_TEXT.presentation), /disabled/, `${style}: at its default shape there is nothing to reset`);
  }

  const graphics = legacy();
  graphics.contentMode = 'graphics';
  const g = render(graphics);
  assert.match(select(g, LOOK_TEXT.grouping), /disabled/);
  assert.match(select(g, LOOK_TEXT.presentation), /disabled/);
  assert.doesNotMatch(select(g, LOOK_TEXT.font), /disabled/);
  assert.doesNotMatch(select(g, LOOK_TEXT.digits), /disabled/);
  assert.ok(g.includes(LOOK_TEXT.graphicsNote));

  const hidden = legacy();
  hidden.captions.visible = false;
  const h = render(hidden);
  assert.match(select(h, LOOK_TEXT.grouping), /disabled/);
  assert.match(select(h, LOOK_TEXT.presentation), /disabled/);
  assert.ok(h.includes(LOOK_TEXT.hiddenNote));

  const phrases = legacy();
  phrases.captions.mode = 'phrases';
  const p = render(phrases);
  assert.match(select(p, LOOK_TEXT.grouping), /disabled/);
  assert.doesNotMatch(select(p, LOOK_TEXT.presentation), /disabled/);
  assert.ok(p.includes(LOOK_TEXT.phrasesNote));
});

test('the editor bundle lists the Look tab as the last panel and registers it', async () => {
  const built = await buildReviewApp({});
  assert.ok(built.panels.includes('look.tsx'));
  assert.ok(built.panels.includes('look-state.ts'));
  const js = built.files.get('/app.js').contents.toString('utf8');
  assert.match(js, /id: "look"/);
  assert.match(js, /order: 50/);
  for (const [id, order] of [['captions', 10], ['scenes', 20], ['cuts', 30], ['effects', 40]]) assert.match(js, new RegExp(`id: "${id}"[^\\n]*order: ${order}`), `${id} keeps its position`);
});
