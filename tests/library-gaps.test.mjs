import test from 'node:test';
import assert from 'node:assert/strict';
import {collectLibraryInventory} from '../scripts/lib/library-inventory.mjs';

// A missing module is the initial RED state, not an unrelated import failure.
const api = await import('../scripts/lib/library-gaps.mjs').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && error.url?.endsWith('/scripts/lib/library-gaps.mjs')) return {};
  throw error;
});
let inventoryPromise;
const inventory = () => inventoryPromise ??= collectLibraryInventory();
const analyze = (input) => {
  assert.equal(typeof api.analyzeLibraryGaps, 'function', 'source-backed gap analysis must be exported');
  return api.analyzeLibraryGaps(input);
};

test('existing chronology, comparisons and stable grouping are covered without relabeling them as missing', async () => {
  const report = analyze(await inventory());
  for (const [id, key] of [['chronology', 'scene:route-stops'], ['comparison', 'scene:comparison'], ['grouping', 'scene:message-board']]) {
    const entry = report.coverage.find((item) => item.id === id);
    assert.equal(entry.status, 'declared');
    assert.ok(entry.existingCandidates.some((item) => item.key === key));
    assert.equal(report.gaps.some((gap) => gap.visualJob === id && gap.reason === 'missing'), false);
  }
  for(const [job,key] of [['branching','concept:conditional-branching'],['filtering','concept:identity-filtering']]){
    const covered=report.coverage.find(item=>item.id===job);
    assert.equal(covered.status,'declared');
    assert.ok(covered.existingCandidates.some(item=>item.key===key));
    assert.ok(!report.gaps.some(item=>item.visualJob===job&&item.reason==='missing'));
  }
});

test('backlog separates new mechanisms, internal wiring, actual review and unsupported layouts', async () => {
  const report = analyze(await inventory());
  assert.deepEqual(new Set(report.gaps.map((gap) => gap.reason)), new Set(['missing', 'internal-only', 'not-reviewed', 'unsupported-in-context']));
  assert.equal(report.gaps.find((gap) => gap.id === 'editable-path-morph').scope, 'wire');
  const review = report.gaps.find((gap) => gap.id === 'existing-motion-review');
  assert.equal(review.scope, 'review');
  assert.ok(review.existingCandidates.some((item) => item.key === 'scene:route-stops'));
  const context = report.gaps.find((gap) => gap.id === 'concept-split-layout');
  assert.equal(context.reason, 'unsupported-in-context');
  assert.equal(context.decision, 'use-existing-alternative-or-project-scene');
  assert.equal(report.gaps.find((gap) => gap.id === 'semantic-feedback').reason, 'missing', 'playback loop is not a semantic return edge');
});

test('ranking has source evidence and explicit subjective factors, and does not mutate or depend on inventory order', async () => {
  const input = await inventory();
  const before = JSON.stringify(input);
  const report = analyze(input);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(analyze({...input, items: [...input.items].reverse(), sources: [...input.sources].reverse()}), report);
  assert.ok(report.methodology.rankingBasis.includes('subjective'));
  assert.equal(report.total, undefined, 'different inventory layers must not be combined into a total');
  for (let index = 0; index < report.gaps.length; index++) {
    const gap = report.gaps[index];
    assert.equal(gap.rank, index + 1);
    if (index) assert.ok(report.gaps[index - 1].priority >= gap.priority);
    for (const name of ['id', 'key', 'labelAr', 'labelEn', 'rationale', 'proposedBehavior', 'useCase', 'evidenceConfidence']) assert.ok(gap[name], `${gap.id}: ${name}`);
    assert.ok(gap.sourceEvidence.length > 0);
    assert.ok(gap.sourceEvidence.every((evidence) => evidence.path && evidence.observation && evidence.verification));
    assert.ok(gap.factors.every((factor) => Number.isFinite(factor.value) && factor.rationale && Number.isFinite(factor.weight)));
    assert.ok(gap.context.constraints.some((constraint) => /Arabic/i.test(constraint)));
    assert.doesNotMatch(JSON.stringify(gap.factors), /measured demand|usage frequency/i);
  }
  assert.ok(report.gaps.find((gap) => gap.id === 'queue-bottleneck').priority > report.gaps.find((gap) => gap.id === 'semantic-feedback').priority);
});

test('absent or changed source anchors downgrade conclusions instead of claiming definite missing capability', async () => {
  const input = await inventory();
  const changed = {...input, sources: input.sources.map((source) => source.path === 'engine/src/motion-concepts/automation-flow/schema.ts' ? {...source, sha256: '0'.repeat(64)} : source)};
  const branch = analyze(changed).gaps.find((gap) => gap.id === 'semantic-feedback');
  assert.equal(branch.evidenceConfidence, 'low');
  assert.equal(branch.assessment, 'needs-reassessment');
  assert.ok(branch.sourceEvidence.some((evidence) => evidence.verification === 'changed'));
  const empty = analyze({version: 1, items: [], sources: [], countsByLayer: {}, unresolved: []});
  assert.ok(empty.coverage.every((entry) => entry.status === 'unresolved'));
  assert.ok(empty.gaps.every((gap) => gap.assessment === 'needs-reassessment'));
  assert.ok(empty.limitations.some((limitation) => /incomplete|unavailable/i.test(limitation)));
});

test('known aliases remain inspectable without becoming canonical coverage or extra visual mechanisms', async () => {
  const input = await inventory();
  const report = analyze(input);
  const variants = report.inventory.variants.filter((item) => item.canonicalKey === 'scene:data-story');
  assert.ok(variants.length >= 2);
  assert.equal(report.inventory.canonicalKeysByLayer.scene.filter((key) => key === 'scene:data-story').length, 1);
  assert.ok(variants.every((item) => !report.inventory.canonicalKeysByLayer['recipe-variant']?.includes(item.key)));
});

test('retired declarations and aliases cannot hide an unmet visual job', async () => {
  const input = await inventory();
  const extended = {...input, items: [...input.items.filter(item=>item.key!=='concept:conditional-branching'),
    {key: 'concept:old-branch', kind: 'concept', layer: 'concept', lifecycle: 'retired', visualJobs: ['branching']},
    {key: 'concept:branch-alias', kind: 'concept', layer: 'concept', variantOf: 'concept:automation-flow', visualJobs: ['branching']},
  ]};
  assert.ok(analyze(extended).gaps.some((gap) => gap.id === 'conditional-branching'));
  const retired={...input,items:input.items.map(item=>item.key==='concept:conditional-branching'?{...item,lifecycle:'retired'}:item)};
  assert.ok(analyze(retired).gaps.some(gap=>gap.id==='conditional-branching'));
});

test('review readiness never follows from a lifecycle label alone', async () => {
  const input = await inventory();
  const declaredReady = {...input, items: input.items.map((item) => ({...item, lifecycle: 'ready'}))};
  assert.ok(analyze(declaredReady).gaps.some((gap) => gap.id === 'existing-motion-review'));
});

test('Markdown exposes limitations, existing candidate limits, confidence and ranking without inventing approval', async () => {
  const report = analyze(await inventory());
  assert.equal(typeof api.gapsMarkdown, 'function');
  const markdown = api.gapsMarkdown(report);
  assert.match(markdown, /^# Reel Studio motion coverage and gaps/m);
  assert.match(markdown, /subjective/i);
  assert.match(markdown, /scene:route-stops/);
  assert.match(markdown, /not-reviewed/);
  assert.match(markdown, /engine\/src\/motion-concepts\/automation-flow\/schema\.ts/);
  assert.match(markdown, /Confidence/i);
  assert.match(markdown, /creator approval|creator acceptance/i);
});

test('invalid inventory shapes fail with a useful error', () => {
  for (const input of [null, {}, {items: null}, {items: [{key: 'a'}, {key: 'a'}], sources: []}]) {
    assert.throws(() => analyze(input), /inventory|duplicate/i);
  }
});
