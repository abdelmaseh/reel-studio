import {findSignoffSec} from './auto-cut.mjs';
import {compileEdit} from '../../engine/src/prepared-edit/timeline.ts';
import {CARTOON_FAMILIES} from '../../engine/src/styles/cartoon/scenes/math.ts';






export function resolveEnding({creator, words, signoffFromSec}) {
  const ending = {...creator.ending};
  const notices = [];
  let at = null;
  if (ending.signOff !== null) {
    at = Number.isFinite(signoffFromSec) ? signoffFromSec : findSignoffSec(words, ending.signOff);
    if (at === null) {
      notices.push(`The recorded sign-off «${ending.signOff}» is not in this video's transcript, so the sign-off is off for this video.`);
      ending.signOff = null;
    }
  } else if (Number.isFinite(signoffFromSec)) {
    notices.push('signoffFromSec was ignored: the recorded sign-off is off in the profile.');
  }
  return {creator: {...creator, ending}, signoffFromSec: at, notices};
}

// Grid Glide draws its own ending scenes (glide-comment, glide-follow); each counts as the shared scene it replaces.
// The cartoon style draws one ending scene that holds the comment part, the follow part or both.
const COMMENT_FAMILIES = ['comment', 'glide-comment'];
const FOLLOW_FAMILIES = ['follow', 'glide-follow'];
export const CARTOON_ENDING = CARTOON_FAMILIES[1];
const ENDING_FAMILIES = [...COMMENT_FAMILIES, ...FOLLOW_FAMILIES, 'creator-cta', CARTOON_ENDING];

/** The edit frame where a cartoon scene's quiet tail starts, or null when it has none or its word is cut away. */
export function tailFrameOf(scene, manifest) {
  if (!CARTOON_FAMILIES.includes(scene?.family) || !scene.data?.tail) return null;
  const word = compileEdit(manifest).words.find((w) => w.sourceIndex === scene.data.tail.at.word);
  return word ? word.fromFrame + Math.round((scene.data.tail.at.dt ?? 0) * manifest.source.fps) : null;
}

/**
 * Every scene finishes before the recorded sign-off, except the last scene when it is a cartoon scene whose quiet tail
 * (no band, no headline, no card, no sound) starts at or before the sign-off and that runs to the edit end.
 */
export function signoffCoverageIssues(manifest) {
  const signoff = manifest.signoffFromFrame;
  if (!Number.isInteger(signoff)) return [];
  const scenes = manifest.scenes, last = scenes.at(-1);
  let total = null;
  const editEnd = () => (total ??= compileEdit(manifest).durationInFrames);
  const issues = scenes.flatMap((scene) => {
    if (scene.fromFrame + scene.durationInFrames <= signoff) return [];
    if (scene !== last || !CARTOON_FAMILIES.includes(scene.family)) return ['Every scene must finish before the recorded sign-off.'];
    const tail = tailFrameOf(scene, manifest);
    if (tail === null) return [`Scene ${scene.id} covers the recorded sign-off; only a cartoon tail may do that: set tail.at on the sign-off's first word.`];
    if (tail > signoff) return [`Scene ${scene.id}: the tail must start at or before the sign-off (frame ${signoff}).`];
    if (scene.fromFrame + scene.durationInFrames !== editEnd()) return [`Scene ${scene.id}: a cartoon tail runs to the edit end (frame ${editEnd()}).`];
    return [];
  });
  return [...new Set(issues)];
}


export function endingIssues(manifest) {
  if (!manifest.creator) return ['Delivery needs the creator profile.'];
  const {handle, ending} = manifest.creator;
  const scenes = manifest.scenes;
  const last = scenes.at(-1), prior = scenes.at(-2);
  const cta = ending.cta !== null, follow = ending.followCard, signOff = ending.signOff !== null;
  const issues = [];
  const keyword = (scene, data = scene.data) => { if (data.keyword !== ending.cta) issues.push(`The comment CTA keyword must be «${ending.cta}».`); };
  const followHandle = (scene, data = scene.data) => { if (data.handle !== handle) issues.push(`The follow card must show the complete profile handle ${handle}.`); };
  const present = (families) => scenes.some((scene) => families.includes(scene.family));
  // The creator CTA draws its keyword only where the prompt says {keyword} (the scene fills it in) or spells the keyword out.
  const promptKeyword = (scene) => {
    const prompt = typeof scene.data.prompt === 'string' ? scene.data.prompt : '', word = scene.data.keyword;
    if (prompt.includes('{keyword}') || (typeof word === 'string' && word !== '' && prompt.includes(word))) return;
    issues.push(`The creator CTA scene «${scene.id}» never shows the comment keyword «${ending.cta}»: write {keyword} in its prompt, or the keyword itself.`);
  };
  const cartoon = last?.family === CARTOON_ENDING ? last : null;
  if (cartoon) {
    // One scene carries the parts that are on for this video, and nothing else.
    if (cta) { if (!cartoon.data.comment) issues.push('The cartoon ending needs the comment part.'); else keyword(cartoon, cartoon.data.comment); }
    else if (cartoon.data.comment) issues.push('No CTA keyword was chosen for this video; remove the comment part.');
    if (follow) { if (!cartoon.data.follow) issues.push('The cartoon ending needs the follow part.'); else followHandle(cartoon, cartoon.data.follow); }
    else if (cartoon.data.follow) issues.push('The follow card is off in the profile; remove the follow part.');
    if (!cta && !follow) issues.push('The CTA and the follow card are both off for this video; remove the ending scene.');
    if (scenes.slice(0, -1).some((scene) => ENDING_FAMILIES.includes(scene.family))) issues.push('The cartoon ending is the only ending scene; remove the other ending scenes.');
  } else if (cta && follow) {
    if (last?.family === 'creator-cta') {
      keyword(last);
      followHandle(last);
      if (!(last.data.followFrame > 0 && last.data.clickedFrame > last.data.followFrame && last.data.clickedFrame < last.durationInFrames)) {
        issues.push('Creator CTA needs comment, follow and click in order.');
      }
    } else if (COMMENT_FAMILIES.includes(prior?.family) && FOLLOW_FAMILIES.includes(last?.family)) { keyword(prior); followHandle(last); }
    else issues.push('The ending needs the comment CTA scene and then the follow card as the last two scenes.');
  } else if (cta) {
    if (COMMENT_FAMILIES.includes(last?.family)) keyword(last);
    else issues.push('The ending needs the comment CTA scene as the last scene.');
    if (present(FOLLOW_FAMILIES) || present(['creator-cta'])) issues.push('The follow card is off in the profile; remove the follow scene.');
  } else if (follow) {
    if (FOLLOW_FAMILIES.includes(last?.family)) followHandle(last);
    else issues.push('The ending needs the follow card as the last scene.');
    if (present(COMMENT_FAMILIES) || present(['creator-cta'])) issues.push('No CTA keyword was chosen for this video; remove the comment CTA scene.');
  } else if (scenes.some((scene) => ENDING_FAMILIES.includes(scene.family))) {
    issues.push('The CTA and the follow card are both off for this video; remove the ending scenes.');
  }
  if (cta) scenes.filter((scene) => scene.family === 'creator-cta').forEach(promptKeyword);
  if (signOff) {
    if (!Number.isInteger(manifest.signoffFromFrame)) issues.push('The recorded sign-off is on, so the manifest needs signoffFromFrame.');
    else issues.push(...signoffCoverageIssues(manifest));
  } else if (manifest.signoffFromFrame !== undefined) {
    issues.push('The sign-off is off for this video, so the manifest must not keep signoffFromFrame.');
  }
  return issues;
}
