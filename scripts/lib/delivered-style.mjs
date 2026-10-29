// The style id a delivered render reports to the install counter: a registry id (aliases resolved) or "other".
// Only ids from the studio's own list can leave the machine, never text the creator wrote.
import {isStyleId, normalizeStyleId} from '../../engine/src/styles/registry.ts';

export function deliveredStyle(comp, edit) {
  if (comp !== 'PreparedEdit' || typeof edit?.style !== 'string') return 'other';
  const id = normalizeStyleId(edit.style, () => {});
  return typeof id === 'string' && isStyleId(id) ? id : 'other';
}
