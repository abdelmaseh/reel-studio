import {z} from 'zod';
import {
  GRID_GLIDE_FAMILIES, gridGlideAssetClaims, gridGlideAssets, gridGlideDipIssues, gridGlideSceneVariants,
  validateGridGlideTiming, type GlideAssetClaim,
} from './grid-glide/scenes/schema.ts';
import {gridGlideLayoutIssues} from './grid-glide/scenes/layout.ts';

// One spread per style that owns scene families. A family listed in a style meta's `ownScenes` is registered here
// exactly once; the edit manifest refuses it in every other style.
export const styleSceneVariants = [...gridGlideSceneVariants] as const;
export const styleSceneSchema = z.discriminatedUnion('family', styleSceneVariants);
export type StyleScene = z.infer<typeof styleSceneSchema>;
export const styleSceneFamilies: readonly string[] = [...GRID_GLIDE_FAMILIES];

export function validateStyleSceneTiming(scene: StyleScene, fps = 30): string[] {
  return [...validateGridGlideTiming(scene, fps), ...gridGlideLayoutIssues(scene)];
}

/** Rules that need the neighbours of a scene (scenes are already ordered and disjoint). */
export function styleSceneSequenceIssues(scenes: readonly {id: string; family: string; fromFrame: number; durationInFrames: number}[]): string[] {
  return gridGlideDipIssues(scenes);
}

export function styleSceneAssets(scene: StyleScene): string[] {
  return gridGlideAssets(scene);
}

export function styleSceneAssetClaims(scene: StyleScene): GlideAssetClaim[] {
  return gridGlideAssetClaims(scene);
}
