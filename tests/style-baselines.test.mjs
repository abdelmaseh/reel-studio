import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BASELINE_FILE, BASELINE_SECTIONS, captureStyleBaselines} from '../scripts/capture-style-baselines.mjs';

// The fixture was captured from the hand-written style lists before they moved into
// engine/src/styles/. Everything below recomputes it from the code as it is now.
const fixture = JSON.parse(await readFile(BASELINE_FILE, 'utf8'));
// The recorded example files are passed back, so an example added to instructions/examples later changes nothing.
const recordedExamples = Object.keys(fixture.parses).filter((key) => key.startsWith('example:')).map((key) => key.slice('example:'.length));
const actual = await captureStyleBaselines({styles: fixture.styles, examples: recordedExamples});

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Lists the paths whose values differ, so a failure names the style and the scene instead of printing a wall of JSON.
function differences(now, then, at = '') {
  if (now !== null && then !== null && typeof now === 'object' && typeof then === 'object' && Array.isArray(now) === Array.isArray(then)) {
    const keys = [...new Set([...Object.keys(now), ...Object.keys(then)])];
    return keys.flatMap((key) => differences(now[key], then[key], `${at}/${key}`));
  }
  return same(now, then) ? [] : [at || '/'];
}

test('the fixture records the eleven styles and every section', () => {
  assert.equal(fixture.version, 1);
  assert.equal(fixture.styles.length, 11);
  assert.deepEqual(Object.keys(fixture).sort(), ['styles', 'version', ...BASELINE_SECTIONS].sort());
  assert.deepEqual(Object.keys(fixture.markup), fixture.styles);
  for (const style of fixture.styles) assert.ok(Object.keys(fixture.markup[style]).length >= 50, `${style} must cover every scene family and concept`);
  const sceneParses = Object.entries(fixture.parses).filter(([key]) => key.startsWith('scene:'));
  assert.ok(sceneParses.length >= 40, 'the parse record must cover every template and demo scene');
  assert.deepEqual(sceneParses.filter(([, parse]) => !parse.ok).map(([key]) => key), [], 'every template and demo scene must parse when it is recorded');
  assert.ok(recordedExamples.length >= 2, 'the parse record must cover every shipped example');
});

for (const section of BASELINE_SECTIONS) {
  test(`${section} is identical to the pre-migration record`, () => {
    assert.deepEqual(differences(actual[section], fixture[section]).slice(0, 25), [],
      `${section} changed. A migration step must not change a style's behaviour.`);
    assert.deepEqual(actual[section], fixture[section]);
  });
}
