// Node-safe: plain duck typing, shared by the engine, the preparation scripts and the delivery gates (no zod, no React).
type SceneLike = {family: string; data?: unknown};
type CardLike = {kind?: unknown; data?: {clip?: {kind?: unknown; src?: unknown}}};

/** Video files a cartoon body mounts (its monitor cards), in card order, without duplicates. Every other family returns []. */
export function cartoonVideoSources(scene: SceneLike): string[] {
  if (scene?.family !== 'cartoon') return [];
  const cards = (scene.data as {cards?: unknown} | undefined)?.cards;
  if (!Array.isArray(cards)) return [];
  const found: string[] = [];
  for (const card of cards as CardLike[]) {
    const clip = card?.kind === 'monitor' ? card.data?.clip : undefined;
    if (clip?.kind === 'video' && typeof clip.src === 'string' && !found.includes(clip.src)) found.push(clip.src);
  }
  return found;
}
