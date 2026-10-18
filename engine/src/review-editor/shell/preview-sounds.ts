import type { EditManifest } from "../../prepared-edit/schema.ts";
import type { RecipeInfo } from "../types.ts";

/** One audible effect of the preview: a Remotion sequence that starts at `from` and plays the recipe's WAV for `durationInFrames`. */
export type PreviewSound = { key: string; from: number; durationInFrames: number; src: string };

/**
 * The Player pools its audio tags: `numberOfSharedAudioTags` is 12 and three stay free for the plate's own audio and other media, so
 * nine effects may sound at once. One more mounted tag throws "Tried to simultaneously mount N+1 Html5Audio tags" and blanks the preview.
 */
export const MAX_PREVIEW_SOUNDS = 9;
export const SHARED_AUDIO_TAGS = 12;

/** The preview asks the server for gains in tenths, as the server rounds them (scripts/lib/review-editor-sfx.mjs). */
export const quantizeGain = (gain: number): number => Math.round(gain * 10) / 10;

/** New strings of the preview player, in neutral Arabic. */
export const PREVIEW_SFX_TEXT = {
  on: "مؤثرات المعاينة: تعمل",
  off: "مؤثرات المعاينة: متوقفة",
  skipped: (count: number) => ` (${count} بلا صوت)`,
  title: "تُسمع المؤثرات الصوتية في أماكنها وبمستواها أثناء التشغيل، ويُسكتها زر الكتم. عند تداخل أصوات كثيرة قد يخفض التصدير النهائي المستوى الكلي قليلًا.",
  skippedTitle: "أصوات لم تُشغَّل في المعاينة لأن عددها تجاوز الحد الذي يتحمله المشغّل في اللحظة نفسها، أو لأن نوعها غير معروف أو مستواها صفر. تبقى كلها في التصدير النهائي.",
  panelHint: "تُسمع الأصوات في المعاينة أيضًا، ويُسكتها زر الكتم.",
} as const;

/**
 * The effects the preview can play for this manifest. A sound whose recipe is not in the catalog, or whose gain rounds to zero, is
 * skipped; so is any sound that would start while `maxConcurrent` earlier ones are still playing (greedy, in time order).
 * Skipped sounds still count in `skipped`, and none of this touches the manifest or the export.
 */
export function previewSoundsFor(
  manifest: { sounds: EditManifest["sounds"]; source: { fps: number } },
  recipes: readonly RecipeInfo[],
  urlFor: (recipe: string, gain: number) => string,
  options: { maxConcurrent?: number } = {},
): { sounds: PreviewSound[]; skipped: number } {
  const cap = options.maxConcurrent ?? MAX_PREVIEW_SOUNDS;
  const fps = manifest.source.fps;
  const info = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const ordered = manifest.sounds.map((sound, index) => ({ sound, index })).sort((a, b) => a.sound.atFrame - b.sound.atFrame || a.index - b.index);
  const playing: number[] = [];
  const sounds: PreviewSound[] = [];
  let skipped = 0;
  for (const { sound, index } of ordered) {
    const recipe = info.get(sound.recipe);
    const gain = quantizeGain(sound.gain);
    if (!recipe || !(recipe.duration > 0) || gain <= 0) {
      skipped++;
      continue;
    }
    const durationInFrames = Math.max(1, Math.ceil(recipe.duration * fps));
    for (let i = playing.length - 1; i >= 0; i--) if (playing[i] <= sound.atFrame) playing.splice(i, 1);
    if (playing.length >= cap) {
      skipped++;
      continue;
    }
    playing.push(sound.atFrame + durationInFrames);
    sounds.push({ key: `${index}:${sound.recipe}:${sound.atFrame}`, from: sound.atFrame, durationInFrames, src: urlFor(sound.recipe, gain) });
  }
  return { sounds, skipped };
}
