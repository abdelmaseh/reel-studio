// Node-safe (no JSX, no packages): the shape check for a Lottie file, shared by the player (core/lottie-icon.tsx) and the sticker table
// (creative-kit/stickers.ts). Keep explicit `.ts` import extensions in files that import this one.

export type LottieData = { fr: number; w: number; h: number; op: number } & Record<string | number | symbol, unknown>;

/**
 * A Lottie file as the player wants it. Some icon packs ship `{ animationData, interaction }` instead of the bare animation; both are accepted.
 * `label` names the file in the error.
 */
export const normalizeLottie = (raw: unknown, label: string): LottieData => {
  const wrapped = raw && typeof raw === "object" ? (raw as { animationData?: unknown }).animationData : undefined;
  const data = (wrapped && typeof wrapped === "object" ? wrapped : raw) as Partial<LottieData> | null;
  if (!data || typeof data !== "object") throw new Error(`stickers: ${label} is not a Lottie animation (no JSON object).`);
  const { fr, w, h, op } = data;
  if (typeof fr !== "number" || !(fr > 0)) throw new Error(`stickers: ${label} has no usable frame rate (fr).`);
  if (typeof w !== "number" || typeof h !== "number" || !(w > 0) || !(h > 0)) throw new Error(`stickers: ${label} has no usable size (w, h).`);
  if (typeof op !== "number" || !(op > 0)) throw new Error(`stickers: ${label} has no usable length (op).`);
  return data as LottieData;
};
