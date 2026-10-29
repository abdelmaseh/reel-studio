import {RECEIPTS_FAMILIES, receiptsSceneVariants, validateReceiptsTiming} from './calligraphic-receipts/scenes/schema.ts';
import {MAGAZINE_FAMILIES, magazineSceneVariants, validateMagazineTiming} from './magazine-interview/scenes/schema.ts';
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
import {LAYERED_FAMILIES, layeredAssets, layeredSceneVariants, validateLayeredTiming} from './layered-speaker/scenes/schema.ts';
import type {WordLike} from './cartoon/scenes/math.ts';
import {DOCUMENTARY_FAMILIES, documentarySceneVariants, validateDocumentaryTiming, documentaryAssets, documentaryAssetClaims} from './documentary/scenes/schema.ts';

// One spread per style that owns scene families. A family listed in a style meta's `ownScenes` is registered here
// exactly once; the edit manifest refuses it in every other style.
export const styleSceneVariants = [...gridGlideSceneVariants, ...oneShotSceneVariants, ...cartoonSceneVariants, ...documentarySceneVariants, ...layeredSceneVariants, ...magazineSceneVariants, ...receiptsSceneVariants] as const;
export const styleSceneSchema = z.discriminatedUnion('family', styleSceneVariants);
export type StyleScene = z.infer<typeof styleSceneSchema>;
export const styleSceneFamilies: readonly string[] = [...GRID_GLIDE_FAMILIES, ...ONE_SHOT_FAMILIES, ...CARTOON_FAMILIES, ...DOCUMENTARY_FAMILIES, ...LAYERED_FAMILIES, ...MAGAZINE_FAMILIES, ...RECEIPTS_FAMILIES];

export function validateStyleSceneTiming(scene: StyleScene, fps = 30): string[] {
  if (scene.family === 'map-route' || scene.family === 'map-focus' || scene.family === 'cutout-card') return validateDocumentaryTiming(scene, fps);
  if (scene.family === 'one-shot') return validateOneShotTiming(scene, fps);
  if (scene.family === 'cartoon' || scene.family === 'cartoon-ending') return validateCartoonTiming(scene, fps);
  if (scene.family === 'layered-speaker') return validateLayeredTiming(scene, fps);
  if (scene.family === 'verdict') return validateMagazineTiming(scene, fps);
  if (scene.family === 'claim-proof') return validateReceiptsTiming(scene, fps);
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
  if (scene.family === 'map-route' || scene.family === 'map-focus' || scene.family === 'cutout-card') return documentaryAssets(scene);
  if (scene.family === 'one-shot') return [];
  if (scene.family === 'layered-speaker') return layeredAssets(scene);
  if (scene.family === 'cartoon' || scene.family === 'cartoon-ending') return cartoonAssets(scene);
  if (scene.family === 'verdict') return [];
  if (scene.family === 'claim-proof') return [];
  return gridGlideAssets(scene);
}

export function styleSceneAssetClaims(scene: StyleScene): GlideAssetClaim[] {
  if (scene.family === 'map-route' || scene.family === 'map-focus' || scene.family === 'cutout-card') return documentaryAssetClaims(scene);
  if (scene.family === 'one-shot' || scene.family === 'layered-speaker') return [];
  if (scene.family === 'cartoon' || scene.family === 'cartoon-ending') return cartoonAssetClaims(scene);
  if (scene.family === 'verdict') return [];
  if (scene.family === 'claim-proof') return [];
  return gridGlideAssetClaims(scene);
}

/** Video files any style-owned scene mounts (Grid Glide cards, cartoon monitor cards); the Node-safe module holds the predicate. */
export {styleSceneVideoSources} from './media.ts';
