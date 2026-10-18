import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BASELINE_FILE, BASELINE_SECTIONS, captureStyleBaselines} from '../scripts/capture-style-baselines.mjs';

// The fixture was captured from the hand-written style lists before they moved into
// engine/src/styles/. Everything below recomputes it from the code as it is now.
// One deliberate exception (2026-10-18): the palettes, resolvedPalettes and soundPlans sections were
// re-recorded when the sound policy replaced the sweep recipes with soft landings (instructions/SOUND.md).
// Every other section is still the original capture.
const fixture = JSON.parse(await readFile(BASELINE_FILE, 'utf8'));
// The recorded example files are passed back, so an example added to instructions/examples later changes nothing.
const recordedExamples = Object.keys(fixture.parses).filter((key) => key.startsWith('example:')).map((key) => key.slice('example:'.length));
const actual = historicalSnapshot(await captureStyleBaselines({styles: fixture.styles, examples: recordedExamples}), fixture);

// This is a migration record of its original cases. Later concepts have their own integration
// tests; adding one must not expand the frozen historical snapshot. Keep whole recorded values
// and every recorded key so changed or missing originals still fail the comparison below.
function historicalSnapshot(snapshot, recorded) {
  const recordedEntries = (values, entries) => Object.fromEntries(Object.keys(entries).map(key => [key, values?.[key]]));
  return {...snapshot,
    markup: Object.fromEntries(Object.entries(recorded.markup).map(([style, entries]) => [style, recordedEntries(snapshot.markup?.[style], entries)])),
    parses: recordedEntries(snapshot.parses, recorded.parses),
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Lists the paths whose values differ, so a failure names the style and the scene instead of printing a wall of JSON.
function differences(now, then, at = '') {
  if (now !== null && then !== null && typeof now === 'object' && typeof then === 'object' && Array.isArray(now) === Array.isArray(then)) {
    const keys = [...new Set([...Object.keys(now), ...Object.keys(then)])];
    return keys.flatMap((key) => differences(now[key], then[key], `${at}/${key}`));
  }
  return same(now, then) ? [] : [at || '/'];
}

test('historical comparison allows added concept cases without rewriting the recorded snapshot', () => {
  const recorded = {markup: {original: {'concept:existing': 'original-hash'}}, parses: {'scene:concept:existing': {ok: true, sha256: 'original-parse'}}};
  const expanded = {markup: {original: {...recorded.markup.original, 'concept:added': 'new-hash'}}, parses: {...recorded.parses, 'scene:concept:added': {ok: true, sha256: 'new-parse'}}};
  assert.deepEqual(historicalSnapshot(expanded, recorded), recorded);
  assert.ok(Object.hasOwn(expanded.markup.original, 'concept:added'), 'Projection must leave the current capture intact');
});

test('historical comparison still detects changed or missing original markup and parses', () => {
  const recorded = {markup: {original: {'concept:existing': 'original-hash'}}, parses: {'scene:concept:existing': {ok: true, sha256: 'original-parse'}}};
  for (const changed of [
    {...recorded, markup: {original: {'concept:existing': 'changed-hash'}}},
    {...recorded, markup: {original: {}}},
    {...recorded, parses: {'scene:concept:existing': {ok: false, sha256: 'changed-parse'}}},
    {...recorded, parses: {}},
  ]) assert.ok(differences(historicalSnapshot(changed, recorded), recorded).length > 0);
});

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
