import assert from 'node:assert/strict';

// Exact pilot markup is superseded by authored timing, face clearance and fitted
// geometry. Preserve material identity and whole primary copy here; the round-one
// tests check each changed visible event against sceneCues separately.
export function assertStyleIdentity(actual, pilot, data, family) {
  assert.doesNotMatch(actual, /NaN|Infinity|undefined/);
  const palette = new Set(pilot.match(/#[0-9a-f]{6}\b/gi) ?? []);
  const retained = [...palette].filter(color => actual.toLowerCase().includes(color.toLowerCase()));
  assert.ok(retained.length >= Math.min(2, palette.size), family + ': pilot inks retained');
  if(family==='follow'&&actual.includes('data-receipt-printed="0"'))return;
  const primary = data.title ?? data.label ?? data.keyword ?? data.handle ?? data.claim?.join(' ') ?? data.boardTitle ?? data.question ?? '';
  const text = actual.replace(/<[^>]+>/g, ' ').replaceAll('&amp;', '&').replaceAll('&#x27;', "'");
  for (const word of String(primary).split(/\s+/).filter(Boolean)) {
    assert.ok(text.includes(word), family + ': supplied whole word ' + word);
  }
}
