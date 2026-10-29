import type { EditManifest } from "../../prepared-edit/schema.ts";
import {
  SCENE_CAMERA_MOVES,
  SCENE_CAMERA_STRENGTHS,
  sceneCameraIssues,
  type SceneCameraMove,
  type SceneCameraSpec,
  type SceneCameraStrength,
} from "../../core/camera.ts";
import { explainEnglish } from "./explain.ts";
import { deepEqual } from "./paths.ts";
import { finalize, refuse, unchanged, type OpResult } from "./result.ts";
import { replaceAt, sceneIndex, type Scene } from "./util.ts";

/** Creator-facing names of the scene camera (proposals in the studio's Arabic). */
export const CAMERA_MOVE_LABEL: Record<SceneCameraMove, string> = {
  "snap-zoom": "ضربة زووم",
  orbit: "دوران حوالين المشهد",
  dolly: "اقتراب سينمائي",
  handheld: "كاميرا في الإيد",
};
export const CAMERA_STRENGTH_LABEL: Record<SceneCameraStrength, string> = { soft: "خفيفة", normal: "عادية", strong: "قوية" };
export const CAMERA_TEXT = {
  title: "حركة الكاميرا",
  none: "من غير",
  strength: "القوة",
  cue: "لحظة الضربة",
  cueHint: "فريم جوّه المشهد تنزل عليه الضربة. لو سبته فاضي بتنزل قبل نص المشهد بشوية.",
  unavailable: "حركة الكاميرا متاحة لمشاهد الشاشة الكاملة (takeover) ونص الشاشة (split) بس.",
  splitHint: "في مشهد نص الشاشة (split) الحركة بتشتغل على الجرافيك بس، والفيديو اللي تحته ثابت.",
} as const;

export const SCENE_CAMERA_OPTIONS = { moves: SCENE_CAMERA_MOVES, strengths: SCENE_CAMERA_STRENGTHS } as const;

/** Why this scene cannot carry a camera move, in Arabic, or null when it can. */
export function sceneCameraRefusal(scene: Pick<Scene, "id" | "family" | "layout" | "durationInFrames">): string | null {
  const reasons = sceneCameraIssues({ ...scene, camera: { move: "orbit" } });
  return reasons.length ? (explainEnglish(reasons[0]) ?? reasons[0]) : null;
}

/** Only the keys that mean something: the cue belongs to snap-zoom alone, an unset strength stays unset. */
const tidy = (camera: SceneCameraSpec): SceneCameraSpec => ({
  move: camera.move,
  ...(camera.strength === undefined ? {} : { strength: camera.strength }),
  ...(camera.move === "snap-zoom" && camera.at !== undefined ? { at: Math.round(camera.at) } : {}),
});

/** Sets, changes or (with null) clears the camera move of one scene. */
export function setSceneCamera(m: EditManifest, id: string, camera: SceneCameraSpec | null): OpResult {
  const i = sceneIndex(m, id);
  if (i < 0) return refuse(`مفيش مشهد اسمه "${id}".`);
  const scene = m.scenes[i];
  if (camera === null) {
    if (scene.camera === undefined) return unchanged(m);
    const { camera: _removed, ...rest } = scene;
    return finalize(m, { ...m, scenes: replaceAt(m.scenes, i, rest as Scene) });
  }
  if (!(SCENE_CAMERA_MOVES as readonly string[]).includes(camera.move)) return refuse(`حركة الكاميرا لازم تكون واحدة من: ${SCENE_CAMERA_MOVES.join(" / ")}.`);
  if (camera.strength !== undefined && !(SCENE_CAMERA_STRENGTHS as readonly string[]).includes(camera.strength)) {
    return refuse(`قوة الحركة لازم تكون واحدة من: ${SCENE_CAMERA_STRENGTHS.join(" / ")}.`);
  }
  const refusal = sceneCameraRefusal(scene);
  if (refusal) return refuse(refusal);
  const next = tidy(camera);
  if (scene.camera !== undefined && deepEqual(scene.camera, next)) return unchanged(m);
  return finalize(m, { ...m, scenes: replaceAt(m.scenes, i, { ...scene, camera: next } as Scene) });
}
