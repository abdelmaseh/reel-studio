import {clipEnlargementIssue} from '../core/clip-schema.ts';

/** Styles that draw their own screen and cannot host a B-roll scene. */
export const BROLL_REFUSED_STYLES = ['cartoon', 'one-shot', 'grid-glide'] as const;
/**
 * The scene families that count as the video's ending: B-roll never sits on or after them, and the editor allows only one ending (scenes.ts). One list for both.
 * scripts/lib/endings.mjs keeps its own, different list because the delivery gate also counts the cartoon ending.
 */
export const ENDING_FAMILIES: readonly string[] = ['comment', 'follow', 'glide-comment', 'glide-follow', 'creator-cta'];

type BrollScene = {id: string; family: string; fromFrame: number; durationInFrames: number; layout: string; data?: unknown};
type BrollManifest = {style: string; presenter?: false; signoffFromFrame?: number; footage?: {split: {windowTop: number}; pip?: {sceneIds: readonly string[]}}; scenes: readonly BrollScene[]};
type StepSize = {width: number; height: number; fit?: 'cover' | 'contain'; label?: string};

/**
 * A `screens` scene in its B-roll look. Node-safe duck typing, shared by the manifest rules, the sound cues and the director.
 * `core/scene-media.ts` and `creative-kit/kinetic/scenes.tsx` re-derive the same test as `look === 'broll'` on purpose: `core/` must not import `prepared-edit/`
 * (the layering runs the other way), and the render switch needs the check to narrow the scene data type, which this boolean does not. Keep the three in step.
 */
export const isBrollScene = (scene: {family: string; data?: unknown}): boolean =>
  scene.family === 'screens' && (scene.data as {look?: unknown} | null | undefined)?.look === 'broll';

/**
 * What a manifest may not do with B-roll: use a style that draws its own screen, run past the recorded sign-off, sit on or after the ending scenes,
 * ask for the split layout while the presenter is off screen, carry a label while the presenter window sits on it (the window covers the label's corner),
 * or enlarge a clip beyond the limit. A full-screen scene measures its clips in the whole 1080x1920 frame. A split scene measures them in
 * 1080 x footage.split.windowTop, the box above the presenter window, and only when the manifest has `footage`: without it the renderer draws the scene
 * above the style's own seam, which this Node-safe module cannot know, so nothing is guessed here. That case is measured at prepare time instead
 * (`brollSplitIssues`, which verifyKineticAssets calls with the seam of the style), and SceneClip still enforces the limit when it renders.
 */
export function brollIssues(m: BrollManifest): string[] {
  const issues: string[] = [];
  const firstEnding = m.scenes.find((scene) => ENDING_FAMILIES.includes(scene.family))?.fromFrame;
  const withPresenterWindow = new Set(m.footage?.pip?.sceneIds ?? []);
  for (const scene of m.scenes) {
    if (!isBrollScene(scene)) continue;
    if ((BROLL_REFUSED_STYLES as readonly string[]).includes(m.style)) issues.push(`${scene.id}: B-roll is not available in the ${m.style} style, which draws its own screen.`);
    if (m.signoffFromFrame !== undefined && scene.fromFrame + scene.durationInFrames > m.signoffFromFrame) issues.push(`${scene.id}: B-roll must end before the recorded sign-off.`);
    if (firstEnding !== undefined && scene.fromFrame >= firstEnding) issues.push(`${scene.id}: B-roll cannot sit on or after the ending scenes.`);
    if (scene.layout === 'split' && m.presenter === false) issues.push(`${scene.id}: a split B-roll scene needs the presenter on screen; use the full-screen layout.`);
    const split = scene.layout === 'split';
    const steps = (scene.data as {steps?: StepSize[]}).steps ?? [];
    if (withPresenterWindow.has(scene.id) && steps.some((step) => step.label)) {
      issues.push(`${scene.id}: a B-roll scene shown with the presenter window cannot carry a label, because the window covers the label's corner; remove the label or take the scene out of footage.pip.sceneIds.`);
    }
    // Without `footage` a split scene sits above the style's own seam, which only the prepare step can measure (brollSplitIssues), so no check here.
    const boxHeight = split ? m.footage?.split.windowTop : 1920;
    if (boxHeight !== undefined) {
      steps.forEach((step, index) => {
        const issue = clipEnlargementIssue(step, {width: 1080, height: boxHeight}, `${scene.id} step ${index + 1}`, {split, contain: step.fit === 'contain', canSplit: m.presenter !== false});
        if (issue) issues.push(issue);
      });
    }
  }
  return issues;
}

/**
 * The enlargement check of a split B-roll scene in a manifest without `footage`, once the seam of the style is known: the box above the presenter window is
 * 1080 x `seamHeight` (scripts/lib/head-guide.mjs `splitCanvasHeightFor`, as motion-plan.mjs already uses it). Pure, so the arithmetic is testable without
 * ffmpeg. Scenes that are not B-roll or not split give nothing; with `footage` the manifest rule (`brollIssues`) has already measured the scene.
 */
export function brollSplitIssues(scene: BrollScene, seamHeight: number): string[] {
  if (!isBrollScene(scene) || scene.layout !== 'split') return [];
  const steps = (scene.data as {steps?: StepSize[]}).steps ?? [];
  return steps.flatMap((step, index) => {
    const issue = clipEnlargementIssue(step, {width: 1080, height: seamHeight}, `${scene.id} step ${index + 1}`, {split: true, contain: step.fit === 'contain'});
    return issue ? [issue] : [];
  });
}
