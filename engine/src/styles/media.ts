// Video files any style-owned scene mounts. Node-safe duck typing (no zod, no React): the plate list, the transition rules,
// the delivery footage gate and the asset verifier all read this one predicate, so a style that adds moving footage adds it here.
import {glideVideoSources} from './grid-glide/scenes/media.ts';
import {cartoonVideoSources} from './cartoon/scenes/media.ts';

export const styleSceneVideoSources = (scene: {family: string; data?: unknown}): string[] => [...glideVideoSources(scene), ...cartoonVideoSources(scene)];
