import {ARABIC_TYPE_MOVES} from '../engine/src/arabic-type/schema.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {previewDefinitions, previewAssetFiles, previewFixtureIssues, getPreviewDefinition, previewAuthoredWords} from '../engine/src/library-preview/fixtures.ts';
import {CATALOG} from '../engine/src/motion-concepts/catalog.ts';
import {STYLE_IDS, ownSceneStyle} from '../engine/src/styles/registry.ts';
import {collectLibraryInventory} from '../scripts/lib/library-inventory.mjs';
import {createHash} from 'node:crypto';
import {messageBoardState} from '../engine/src/creative-kit/semantic/message-board.ts';
import {resolveEmphasis, tokenizeSpoken} from '../engine/src/creative-kit/kinetic-words-logic.ts';

test('message board sample keeps readable card boxes throughout scatter, gather and focus', () => {
  const definition = getPreviewDefinition('scene:message-board');
  // Actual getSceneGeometry budgets on the 1080x1920 canvas: Section Deck has a 900px caption
  // center; Paper Collage has a 1240px caption center. The failing renderer used the compact one.
  const geometry = definition.style === 'paper-collage' ? {x: 109, y: 497, width: 862, height: 625}
    : {x: 95, y: 469, width: 890, height: 313};
  for (let frame = 0; frame < definition.durationInFrames; frame++) {
    const state = messageBoardState(definition.fixture.scene.data, frame, geometry);
    state.items.forEach((pose, index) => {
      const item = definition.fixture.scene.data.items[index], height = Math.round(pose.height);
      const labelHeight = Math.round(item.detail ? Math.min(height * .4, 240) : height - 40);
      const lineHeight = definition.style === 'section-deck' ? 1.6 : 1.28;
      assert.ok(labelHeight >= 18 * lineHeight, `frame ${frame}: label has only ${labelHeight}px`);
      if (item.detail) assert.ok(height - labelHeight - 52 >= 14 * lineHeight, `frame ${frame}: detail box cannot fit one minimum line`);
    });
  }
});

test('latin emphasis uses an authored Latin token and every emphasis preset resolves', () => {
  for (const preset of ['accent', 'latin', 'pop', 'underline', 'weight', 'stretch']) {
    const words = previewAuthoredWords(preset === 'latin');
    const tokens = tokenizeSpoken(words);
    assert.doesNotThrow(() => resolveEmphasis(tokens, [{sourceIndex: 1, kind: preset}]), preset);
  }
});

test('per-frame definition lookup reuses the static table', () => {
  assert.equal(getPreviewDefinition('concept:prompt-to-results'), getPreviewDefinition('concept:prompt-to-results'));
  assert.equal(getPreviewDefinition('scene:message-board'), getPreviewDefinition('scene:message-board'));
});

test('every existing concept, scene, effect, recipe variant and style is explicitly represented', async () => {
  const definitions = previewDefinitions();
  const inventory = await collectLibraryInventory();
  const expected = inventory.items.filter(item => ['concept', 'scene', 'effect', 'style'].includes(item.kind) || item.layer === 'recipe-variant');
  assert.deepEqual(definitions.filter(item => !item.canonicalKey).map(item => item.key).sort(), expected.map(item => item.key).sort());
  assert.deepEqual(definitions.filter(item => item.canonicalKey).map(item => item.key).sort(), [...ARABIC_TYPE_MOVES.filter(move=>move!=='decrypt').map(move=>'preview:arabic-type-'+move),'preview:conditional-branching-false', 'preview:identity-filtering-all'].sort());
  for (const variant of definitions.filter(item => item.canonicalKey)) assert.ok(definitions.some(item => item.key === variant.canonicalKey && !item.canonicalKey));
  assert.equal(new Set(definitions.map(item => item.key)).size, definitions.length);
  assert.equal(new Set(definitions.map(item => item.slug)).size, definitions.length);
  assert.equal(definitions.filter(item => item.status !== 'supported').length, 1);
  const extension = definitions.find(item => item.key === 'scene:project-scene');
  assert.equal(extension.status, 'requires-project-pack');
  assert.match(extension.reason, /project/i);
});

test('definitions are serializable renderer demonstrations with validated timing and owned styles', () => {
  for (const definition of previewDefinitions()) {
    assert.deepEqual(JSON.parse(JSON.stringify(definition)), definition, definition.key);
    assert.deepEqual(definition.props, {previewKey: definition.key});
    assert.equal(definition.fps, 30, definition.key);
    assert.ok(Number.isInteger(definition.durationInFrames) && definition.durationInFrames >= 120, definition.key);
    assert.ok(STYLE_IDS.includes(definition.style), definition.key);
    assert.match(definition.notes.join(' '), /ILLUSTRATION|renderer-only/i, definition.key);
    assert.deepEqual(previewFixtureIssues(definition), [], definition.key);
    assert.ok(definition.labelAr && !definition.labelAr.startsWith('مثال '), definition.key);
    if (definition.fixture.scene) assert.equal(definition.fixture.scene.durationInFrames, definition.durationInFrames, definition.key);
    const family = definition.fixture.scene?.family;
    if (family && ownSceneStyle(family)) assert.equal(definition.style, ownSceneStyle(family), definition.key);
  }
  assert.throws(() => getPreviewDefinition('concept:does-not-exist'), /Unknown library preview/);
  for (const concept of CATALOG) {
    assert.ok(previewDefinitions().find(item => item.key === `concept:${concept.id}`).durationInFrames >= concept.minFrames);
  }
});

test('fixtures contain original local illustration assets without creator media, identities or external URLs', () => {
  const text = JSON.stringify(previewDefinitions());
  assert.doesNotMatch(text, /Editor pro max|_prepared|Raw[\\/]|PROFILE|Projects[\\/]|https?:|[A-Za-z]:\\/i);
  const assets = previewAssetFiles();
  assert.equal(new Set(assets.map(asset => asset.path)).size, assets.length);
  for (const asset of assets) {
    assert.match(asset.path, /^library-preview\/[a-z-]+\.svg$/);
    assert.match(asset.text, /ILLUSTRATION/);
    assert.equal(createHash('sha256').update(asset.text).digest('hex'), asset.sha256, asset.path);
  }
  const kinetic = previewDefinitions().find(item => item.key === 'scene:kinetic-text');
  assert.match(kinetic.scope, /renderer-only/i);
  assert.match(kinetic.notes.join(' '), /authored timing/i);
});
