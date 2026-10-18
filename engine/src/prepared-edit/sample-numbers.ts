// The one figure every kit number template carries until the creator writes a real one.
// Node-safe: no imports, no JSX and erasable TypeScript only, because scripts/lib/editor-director.mjs loads it in plain Node.

export const SAMPLE_NUMBER = 987654;

export type SampleNumberScene = { readonly id: string; readonly family: string; readonly data: unknown };
export type SampleNumberHit = { sceneId: string; family: string; path: string };

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** Data paths of one scene that still hold the sample figure. Only the two families that show a figure are guarded. */
export function sampleNumberPaths(scene: { family: string; data: unknown }): string[] {
  const data = record(scene.data);
  if (!data) return [];
  if (scene.family === "count") return data.value === SAMPLE_NUMBER ? ["value"] : [];
  if (scene.family === "data-story" && Array.isArray(data.items)) {
    const out: string[] = [];
    data.items.forEach((item, index) => {
      if (record(item)?.value === SAMPLE_NUMBER) out.push(`items.${index}.value`);
    });
    return out;
  }
  return [];
}

export function manifestSampleNumbers(m: { scenes: readonly SampleNumberScene[] }): SampleNumberHit[] {
  return m.scenes.flatMap((scene) => sampleNumberPaths(scene).map((path) => ({ sceneId: scene.id, family: scene.family, path })));
}
