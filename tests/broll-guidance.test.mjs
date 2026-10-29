import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {collectLibraryEditorial} from '../scripts/lib/library-selection.mjs';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('the guides tell the assistant how to bring in and place B-roll', async () => {
  const editing = await read('instructions/EDITING.md');
  assert.match(editing, /node scripts\/clips\.mjs add --project Projects\/<slug>/);
  assert.match(editing, /never search folders for footage/);
  const editorial = await read('instructions/EDITORIAL.md');
  for (const rule of [/never proof/i, /6 frames/, /1\.25x/, /comment keyword, the follow card or the recorded sign-off/, /cartoon.*one-shot.*grid-glide/s]) assert.match(editorial, rule, String(rule));
  assert.match(await read('instructions/agents/editorial.md'), /B-roll: only registered clips/);
  assert.match(await read('instructions/MOTION-CHOICES.md'), /`screens` with `look: "broll"`/);
  assert.match(await read('instructions/STYLES.md'), /B-roll availability/);
  assert.match(await read('instructions/TECHNIQUES.md'), /B-roll clips/);
  assert.match(await read('instructions/REVIEW-EDITOR.md'), /B-roll/);
  assert.match(await read('instructions/PERFORMANCE.md'), /decodes two videos/);
  assert.match(await read('instructions/ASSET-PRODUCTION.md'), /scripts\/clips\.mjs add/);
  const projectScenes = await read('instructions/PROJECT-SCENES.md');
  assert.match(projectScenes, /`clip` field/);
  assert.match(projectScenes, /SceneClip/);
  assert.match(projectScenes, /cannot import `OffthreadVideo`/);
});

test('the technique catalog lists the clip intake and its implementation exists', async () => {
  const catalog = JSON.parse(await read('instructions/technique-catalog.json'));
  const entry = catalog.techniques.find((technique) => technique.id === 'broll-clips');
  assert.equal(entry.implementationPath, 'scripts/clips.mjs');
  await read(entry.implementationPath);
});

test('the selection catalog describes both looks of screens and the clip field of project scenes', async () => {
  const data = await collectLibraryEditorial();
  const screens = data.items.find((item) => item.key === 'scene:screens').editorial;
  assert.equal(screens.assessment, 'current');
  assert.match([screens.explains, screens.action, ...screens.useWhen, ...screens.avoidWhen, ...screens.requirements].join(' '), /B-roll/);
  assert.ok(screens.avoidWhen.some((line) => /proof/i.test(line)));
  assert.match(screens.requirements.join(' '), /scripts\/clips\.mjs add/);
  const project = data.items.find((item) => item.key === 'scene:project-scene').editorial;
  assert.equal(project.assessment, 'current');
  assert.match(project.requirements.join(' '), /SceneClip/);
});

// Review fixes: each pin is its own test, so a removed sentence names itself.
const PINS = [
  ['a hand-written step starts at the clip record\'s inFrame', 'instructions/EDITING.md', /set `trimBeforeFrame` to the record's `inFrame`/],
  ['a step plays at most the record\'s frames minus trimBeforeFrame', 'instructions/EDITING.md', /a step can play at most the record's `frames` minus `trimBeforeFrame` frames of the file/],
  ['the live editor fills the step from the picked clip', 'instructions/EDITING.md', /The live editor does both when the creator picks a clip/],
  ['the step label and the registration label have different limits', 'instructions/EDITING.md', /separate field of at most 60 characters.*may be up to 80/],
  ['the intake synopsis offers --credit', 'instructions/EDITING.md', /\[--credit "<attribution>"\]/],
  ['correcting the text means running add again with label and licence', 'instructions/EDITING.md', /run `add` again with the same file and window and with `--label` and `--licence` given again/],
  ['the editorial guide links to the intake', 'instructions/EDITORIAL.md', /\[EDITING\.md\]\(EDITING\.md#named-b-roll-clips\)/],
  ['the graphics route registers clips at the spec rate', 'instructions/GRAPHICS.md', /clips\.mjs add \.\.\. --fps <the graphics spec's rate>/],
  ['the graphics route places a full-screen broll beat', 'instructions/GRAPHICS.md', /full-screen `screens` beat with `look: "broll"`.*no presenter, so the split layout and the presenter window do not apply/],
  ['plate and clip decode together only over split and PiP B-roll', 'instructions/PERFORMANCE.md', /named in `footage\.pip\.sceneIds`, the presenter plate and the clip are decoded together/],
  ['a plain full-screen B-roll scene decodes only the clip', 'instructions/PERFORMANCE.md', /a plain full-screen takeover B-roll scene, which decodes only the clip/],
  ['moving captures in project scenes are screen captures', 'instructions/PROJECT-SCENES.md', /For moving screen captures use the existing `screens`/],
  ['a clip the component always needs is a required field', 'instructions/PROJECT-SCENES.md', /Declare the clip field with `required: true` when the component always needs a clip, because an optional clip field arrives as `undefined` when the creator has not chosen one and `SceneClip` needs a clip/],
  ['a clip credit goes to the credits of the publish copy', 'instructions/EDITING.md', /When a clip record has a `credit`, add that line, as registered, to `credits` in `Projects\/<slug>\/publish-copy\.json`/],
  ['the credit is never invented', 'instructions/EDITING.md', /never write a credit the record does not hold/],
  ['a B-roll scene shown with the presenter window carries no label', 'instructions/EDITING.md', /A B-roll scene named in `footage\.pip\.sceneIds` carries no `label`: the presenter window covers the label's corner/],
  ['the placement guide repeats that the presenter window and a label do not go together', 'instructions/EDITORIAL.md', /shown with that window carries no `label`, because the window covers the label's corner/],
  ['captions are checked on the still of each B-roll scene', 'instructions/EDITORIAL.md', /look at the still of each B-roll scene with its captions/],
  ['the caption styles without a backing are named from their themes', 'instructions/EDITORIAL.md', /whose pill is transparent \(`calligraphic-receipts` and `magazine-interview`/],
  ['a caption without a backing gets a proposed presentation, never an override', 'instructions/EDITORIAL.md', /propose `captionsPresentation: "ink-strip"` for this video to the creator.*never override a `captionsPresentation` the creator fixed/],
  ['a hand-written clip value in a project scene starts at the inFrame', 'instructions/PROJECT-SCENES.md', /set `trimBeforeFrame` to the clip record's `inFrame`/],
  ['two decodes can be slower, not always', 'instructions/PERFORMANCE.md', /decodes two videos and can be slower than a plain full-screen takeover B-roll scene/],
  ['the assets worker leaves registered clip ids alone', 'instructions/agents/assets.md', /a clip id \(`clip-` followed by eight hex characters\) is already registered by the manager with `scripts\/clips\.mjs`; leave it alone and do not make it/],
];
for (const [name, file, pattern] of PINS) test(`guide pin: ${name}`, async () => assert.match(await read(file), pattern));

test('guide pin: the PERFORMANCE guide no longer says the presenter plate always plays under B-roll', async () => {
  assert.doesNotMatch(await read('instructions/PERFORMANCE.md'), /Over a B-roll scene the presenter plate and the clip play together/);
});

test('guide pin: the PERFORMANCE guide does not state a slowdown it never measured', async () => {
  assert.doesNotMatch(await read('instructions/PERFORMANCE.md'), /decodes two videos and is slower/);
});

test('guide pin: the caption styles without a backing really have a transparent pill and the presentation names are real', async () => {
  const transparent = [];
  for (const style of ['calligraphic-receipts', 'magazine-interview', 'section-deck', 'paper-collage']) {
    if (/pill:\s*["']transparent["']/.test(await read(`engine/src/styles/${style}/theme.ts`))) transparent.push(style);
  }
  assert.deepEqual(transparent, ['calligraphic-receipts', 'magazine-interview'], 'the guide names exactly these');
  assert.match(await read('engine/src/styles/types.ts'), /CAPTION_PRESENTATION\s*=\s*\[[^\]]*'pill'[^\]]*'minimal'[^\]]*'ink-strip'[^\]]*\]/, 'ink-strip is a real captionsPresentation value');
});

test('guide pin: the intake links land on a heading that exists', async () => {
  assert.match(await read('instructions/EDITING.md'), /^### Named B-roll clips\s*$/m);
});

test('guide pin: the editorial worker reads the registered clips and reports a missing one', async () => {
  const agent = await read('instructions/agents/editorial.md');
  const inputs = agent.slice(agent.indexOf('## Inputs you may read'), agent.indexOf('## Steps'));
  assert.match(inputs, /`Projects\/<id>\/clips\.json` \(the registered clips, read-only\)/);
  assert.match(agent, /goes into `questions\.md`[^\n]*never invent a clip id/);
});

test('the selection catalog cites the code its B-roll wording describes', async () => {
  const data = await collectLibraryEditorial();
  const cited = (key) => data.items.find((item) => item.key === key).editorial.evidence.map((entry) => entry.path);
  const wanted = {
    'scene:screens': ['engine/src/prepared-edit/broll.ts', 'engine/src/core/clip-schema.ts', 'engine/src/creative-kit/kinetic/broll.tsx'],
    'scene:project-scene': ['engine/src/core/clip.tsx'],
  };
  const missing = Object.entries(wanted).flatMap(([key, files]) => files.filter((file) => !cited(key).includes(file)).map((file) => `${key} -> ${file}`));
  assert.deepEqual(missing, []);
});
