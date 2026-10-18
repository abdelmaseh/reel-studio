import {z} from 'zod';
import {
  GRID_GLIDE_FAMILIES, gridGlideAssetClaims, gridGlideAssets, gridGlideDipIssues, gridGlideSceneVariants,
  validateGridGlideTiming, type GlideAssetClaim,
} from './grid-glide/scenes/schema.ts';
import {gridGlideLayoutIssues} from './grid-glide/scenes/layout.ts';
import {ONE_SHOT_FAMILIES, oneShotSceneVariants, validateOneShotTiming} from './one-shot/scenes/schema.ts';
import {
  CARTOON_FAMILIES, cartoonAssetClaims, cartoonAssets, cartoonSceneVariants, cartoonSequenceIssues,
  validateCartoonTiming, validateCartoonWords,
} from './cartoon/scenes/schema.ts';
import type {WordLike} from './cartoon/scenes/math.ts';

// One spread per style that owns scene families. A family listed in a style meta's `ownScenes` is registered here
// exactly once; the edit manifest refuses it in every other style.
export const styleSceneVariants = [...gridGlideSceneVariants, ...oneShotSceneVariants, ...cartoonSceneVariants] as const;
export const styleSceneSchema = z.discriminatedUnion('family', styleSceneVariants);
export type StyleScene = z.infer<typeof styleSceneSchema>;
export const styleSceneFamilies: readonly string[] = [...GRID_GLIDE_FAMILIES, ...ONE_SHOT_FAMILIES, ...CARTOON_FAMILIES];

export function validateStyleSceneTiming(scene: StyleScene, fps = 30): string[] {
  if (scene.family === 'one-shot') return validateOneShotTiming(scene, fps);
  if (scene.family === 'cartoon' || scene.family === 'cartoon-ending') return validateCartoonTiming(scene, fps);
  return [...validateGridGlideTiming(scene, fps), ...gridGlideLayoutIssues(scene)];
}

/** Checks that need the compiled words (cartoon only today). */
export function validateStyleSceneWords(scene: StyleScene, words: readonly WordLike[], fps: number): string[] {
  if (scene.family === 'cartoon' || scene.family === 'cartoon-ending') return validateCartoonWords(scene, words, fps);
  return [];
}

/** Rules that need the neighbours of a scene (scenes are already ordered and disjoint). */
export function styleSceneSequenceIssues(scenes: readonly {id: string; family: string; fromFrame: number; durationInFrames: number; data?: unknown}[]): string[] {
  return [...gridGlideDipIssues(scenes), ...cartoonSequenceIssues(scenes)];
}

export function styleSceneAssets(scene: StyleScene): string[] {
  if (scene.family === 'one-shot') return [];
  if (scene.family === 'cartoon' || scene.family === 'cartoon-ending') return cartoonAssets(scene);
  return gridGlideAssets(scene);
}

export function styleSceneAssetClaims(scene: StyleScene): GlideAssetClaim[] {
  if (scene.family === 'one-shot') return [];
  if (scene.family === 'cartoon' || scene.family === 'cartoon-ending') return cartoonAssetClaims(scene);
  return gridGlideAssetClaims(scene);
}

/** Video files any style-owned scene mounts (Grid Glide cards, cartoon monitor cards); the Node-safe module holds the predicate. */
export {styleSceneVideoSources} from './media.ts';
