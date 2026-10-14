// Node-safe: plain duck typing, shared by the engine, the preparation scripts and the delivery gates.
type SceneLike = {family: string; data?: unknown};
type ClipLike = {kind?: unknown; src?: unknown};

/** Video files a glide-card mounts, in clip order, without duplicates. Every other family returns []. */
export function glideVideoSources(scene: SceneLike): string[] {
  if (scene?.family !== 'glide-card') return [];
  const clips = (scene.data as {media?: {clips?: unknown}} | undefined)?.media?.clips;
  if (!Array.isArray(clips)) return [];
  const found: string[] = [];
  for (const clip of clips as ClipLike[]) {
    if (clip?.kind === 'video' && typeof clip.src === 'string' && !found.includes(clip.src)) found.push(clip.src);
  }
  return found;
}
