import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {STYLE_IDS} from '../engine/src/styles/registry.ts';

// SETTINGS_CSS lets the failing case be shown on a copy of the stylesheet; normal runs read the shipped file.
const cssPath = process.env.SETTINGS_CSS ?? new URL('../scripts/settings-ui/app.css', import.meta.url);

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// An id counts only when no identifier character follows it, so `paper` never matches `paper-collage`.
const hasCardRule = (css, id) => new RegExp(`\\.illustration\\.${escapeRegExp(id)}(?![A-Za-z0-9_-])`).test(css);

test('every registered style has a settings card art rule', async () => {
  const css = await readFile(cssPath, 'utf8');
  const missing = STYLE_IDS.filter((id) => !hasCardRule(css, id));
  assert.deepEqual(missing, [], `scripts/settings-ui/app.css has no .illustration.<id> rule for: ${missing.join(', ')}`);
});

test('the card rule matcher reports a missing id and ignores look-alike prefixes', () => {
  assert.equal(hasCardRule('.illustration.paper-collage{color:red}', 'paper-collage'), true);
  assert.equal(hasCardRule('.illustration.a span{color:red}', 'a'), true);
  assert.equal(hasCardRule('.illustration.paper-collage{color:red}', 'paper'), false);
  assert.equal(hasCardRule('.illustration.paper-collage{color:red}', 'judgment-board'), false);
});

// The per-style guide (instructions/styles/<id>.md) is checked by the documentation table test.
test('every style folder has its identity card, theme and sound palette', () => {
  for (const id of STYLE_IDS) {
    for (const file of ['meta.ts', 'theme.ts', 'sound.json']) {
      assert.ok(existsSync(new URL(`../engine/src/styles/${id}/${file}`, import.meta.url)), `engine/src/styles/${id}/${file} is missing`);
    }
  }
});
