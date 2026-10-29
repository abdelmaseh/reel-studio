// 2026-10-28: explicit V4 metadata/recommendation deltas over the frozen historical record.
// The fixture itself only loses removed style keys. No theme, geometry, sound or markup hash is re-recorded.
export function v4Baseline(record) {
  const out = structuredClone(record);
  out.lists.labels['magazine-interview'].label = 'مجلة';
  for (const entry of Object.values(out.lists.brand)) entry.notices = entry.notices.map(text => text.replace('split-canvas and section-deck', 'section-deck'));
  out.lists.eligibility['kinetic-paper'] = ['ticket-offer', 'comment-stack', 'kinetic-text'];
  const order = out.styles;
  for (const [name, recommendation] of Object.entries(out.recommendations)) {
    const family = name.startsWith('beat:') ? name.slice(5) : null;
    for (const candidate of recommendation.candidates) {
      if (candidate.style !== 'kinetic-paper') continue;
      if (['ticket-offer', 'comment-stack'].includes(family)) {
        candidate.semanticScore = 24;
        candidate.score += 24;
      }
      if (['ticket-offer', 'comment-stack', 'kinetic-text'].includes(family)) {
        const reason = 'Authored kinetic-text/ticket-offer/comment-stack beats qualify this visual grammar (24 points).';
        const at = candidate.reasons.findIndex(text => text.startsWith('Authored '));
        if (at < 0) candidate.reasons.splice(2, 0, reason); else candidate.reasons[at] = reason;
      }
    }
    recommendation.candidates.sort((a,b)=>b.score-a.score || order.indexOf(a.style)-order.indexOf(b.style));
    if (!recommendation.explicit) {
      recommendation.style = recommendation.candidates[0].style;
      recommendation.reasons = [...recommendation.candidates[0].reasons];
    }
  }
  return out;
}
