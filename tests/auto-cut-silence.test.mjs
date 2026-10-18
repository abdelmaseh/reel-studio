import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeCuts, approvedSegments} from '../scripts/lib/auto-cut.mjs';

const fps = 30;
const totalFrames = 195;
const word = (text, from, to) => ({text, startMs: from * 1000, endMs: to * 1000});
// A greeting, a first take of a sentence, then the same sentence again (a retake), with pauses between them.
const words = [
  word('اهلا', 0.5, 0.9),
  word('النهارده', 2.0, 2.5), word('هشرح', 2.55, 2.9), word('الاداه', 2.95, 3.4),
  word('النهارده', 4.2, 4.7), word('هشرح', 4.75, 5.1), word('الاداه', 5.15, 5.6),
];
const silences = [{start: 0, end: 0.48}, {start: 0.95, end: 1.95}, {start: 3.45, end: 4.15}, {start: 5.65, end: 6.5}];
const proposal = proposeCuts({words, silences, fps, totalFrames});

const keeps = (segments, w) => segments.some((s) => w.startMs * fps / 1000 >= s.fromFrame && w.endMs * fps / 1000 <= s.toFrame);
const frames = (segments) => segments.reduce((sum, s) => sum + s.toFrame - s.fromFrame, 0);

test('the pause-only cut keeps every word and removes the pauses', () => {
  assert.ok(proposal.silenceSegments.length > 1);
  for (const w of words) assert.ok(keeps(proposal.silenceSegments, w), `${w.text} at ${w.startMs} must stay`);
  assert.ok(frames(proposal.silenceSegments) < totalFrames);
});

test('the speech cut removes the first take while the pause-only cut keeps it', () => {
  const retake = proposal.removed.find((r) => r.reason === 'retake');
  assert.ok(retake, 'the repeated sentence is proposed as a retake');
  assert.ok(!keeps(proposal.segments, words[1]));
  assert.ok(keeps(proposal.silenceSegments, words[1]));
  assert.ok(frames(proposal.segments) < frames(proposal.silenceSegments));
});

test('approving nothing gives the pause-only cut', () => {
  assert.deepEqual(approvedSegments({words, fps, totalFrames, removed: proposal.removed, approved: [], pauses: proposal.pausesNearSpeechCuts}), proposal.silenceSegments);
});

test('approving every proposed entry gives the full proposal', () => {
  const approved = proposal.removed.map((r, i) => (r.status === 'proposed' ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(approvedSegments({words, fps, totalFrames, removed: proposal.removed, approved, pauses: proposal.pausesNearSpeechCuts}), proposal.segments);
});

test('an entry that is not in the proposal is refused', () => {
  assert.throws(() => approvedSegments({words, fps, totalFrames, removed: proposal.removed, approved: [proposal.removed.length]}),
    /is not in the proposal/);
});
