import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('the guide carries the rules the spec requires', () => {
  const guide = read('instructions/styles/cartoon.md');
  for (const needle of ['# cartoon', 'Arabic label: كارتون', 'Introduced in 3.0.0', 'fast preview', '`cartoon`', '`cartoon-ending`', 'sign-off', 'sourceKind', 'mouth', 'tail', 'monitor', 'counter', 'preferences.character', 'SOUND.md']) {
    assert.ok(guide.includes(needle), `guide mentions ${needle}`);
  }
  assert.doesNotMatch(guide, /\b(?:TBD|TODO|FIXME)\b/);
});

test('the shared documents name the style and the counts moved', () => {
  assert.match(read('instructions/STYLES.md'), /\[`cartoon`\]\(styles\/cartoon\.md\)/);
  assert.match(read('instructions/MOTION-CHOICES.md'), /`cartoon`/);
  assert.match(read('instructions/SETTINGS.md'), /preferences\.character|"character"/);
  assert.match(read('instructions/EDITING.md'), /"cartoon"/);
  const readme = read('README.md');
  assert.match(readme, /كارتون/);
  assert.match(readme, /style-cartoon\.jpg/);
  assert.match(readme, /الاثنا عشر التانيين/);
  assert.match(readme, /الـ١٤ ستايل/);
  assert.doesNotMatch(readme, /الـ١٣ ستايل|١٣ ستايل/);
  assert.match(read('docs/media/README.md'), /style-cartoon/);
  assert.match(read('CHANGELOG.md'), /كارتون/);
  assert.match(read('Sound-Kits/README.md'), /twenty-five reusable/);
  assert.ok(existsSync(fileURLToPath(new URL('../docs/images/style-cartoon.jpg', import.meta.url))), 'the README still exists');
});

test('the canonical skill knows the cartoon route and the generated copy is in sync', () => {
  assert.match(read('.agents/skills/reel-studio/SKILL.md'), /cartoon/);
  assert.equal(read('.claude/skills/reel-studio/SKILL.md').includes('cartoon'), true);
});
