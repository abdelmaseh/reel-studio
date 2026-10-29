import {TRANSITION_RULES} from '../../prepared-edit/graphics-transitions.ts';
import type { EditManifest } from "../../prepared-edit/schema.ts";
import { kineticSceneSchema, validateKineticTiming } from "../../creative-kit/kinetic/schema.ts";
import { librarySceneSchema, validateLibraryTiming } from "../../motion-library/schema.ts";
import { foregroundSourceFrame } from "../../prepared-edit/visibility.ts";
import { FOREGROUND_FAMILIES } from "../../core/scene-media.ts";
import { isEntranceKind, type TransitionKind } from "../../prepared-edit/graphics-transitions.ts";
import type { Scene } from "./util.ts";
import {proofScreenSceneSchema} from '../../creative-kit/proof-screen/schema.ts';
import {validateProofScreenTiming} from '../../creative-kit/proof-screen/timing.ts';





export function sceneTimingIssues(scene: Scene, fps=30): string[] {
  const proofScreen=proofScreenSceneSchema.safeParse(scene);
  if(proofScreen.success)return validateProofScreenTiming(proofScreen.data,fps);
  const library = librarySceneSchema.safeParse(scene);
  if (library.success) return validateLibraryTiming(library.data);
  const kinetic = kineticSceneSchema.safeParse(scene);
  if (kinetic.success) return validateKineticTiming(kinetic.data);
  return [];
}


export const isSceneAnchoredKind = (kind: string | undefined): boolean => kind==='hue-crossfade'||isEntranceKind(kind as TransitionKind)||Boolean(TRANSITION_RULES[kind as TransitionKind]?.lead || TRANSITION_RULES[kind as TransitionKind]?.needsOutgoing);







export function repairForegrounds(m: EditManifest): { manifest: EditManifest; fixed: string[]; failed: string[] } {
  const fixed: string[] = [];
  const failed: string[] = [];
  let scenes = m.scenes;
  m.scenes.forEach((s, i) => {
    if (!FOREGROUND_FAMILIES.includes(s.family)) return;
    const fg = (s.data as any).foreground;
    if (!fg) return;
    let expected: number;
    try {
      expected = foregroundSourceFrame(m, s.fromFrame);
    } catch {
      return;
    }
    if (fg.sourceFromFrame + (fg.trimBeforeFrame ?? 0) === expected) return;
    const trim = expected - fg.sourceFromFrame;
    if (trim < 0 || trim + s.durationInFrames > fg.frames) {
      failed.push(s.id);
      return;
    }
    if (scenes === m.scenes) scenes = m.scenes.slice();
    scenes[i] = { ...s, data: { ...s.data, foreground: { ...fg, trimBeforeFrame: trim } } } as Scene;
    fixed.push(s.id);
  });
  return { manifest: scenes === m.scenes ? m : { ...m, scenes }, fixed, failed };
}


export function dropForegrounds(m: EditManifest, ids: readonly string[]): EditManifest {
  if (!ids.length) return m;
  return {
    ...m,
    scenes: m.scenes.map((s) => {
      if (!ids.includes(s.id) || !FOREGROUND_FAMILIES.includes(s.family)) return s;
      const { foreground: _gone, ...data } = s.data as any;
      return { ...s, data } as Scene;
    }),
  };
}


export function carryEntrances(m: EditManifest, oldFrom: number, newFrom: number): EditManifest {
  if (oldFrom === newFrom) return m;
  let next = m;
  if (m.transitions?.some((t) => t.atFrame === oldFrom)) next = { ...next, transitions: m.transitions.map((t) => (t.atFrame === oldFrom ? { ...t, atFrame: newFrom } : t)) };
  if (m.layoutTransitions?.some((t) => t.atFrame === oldFrom)) next = { ...next, layoutTransitions: m.layoutTransitions.map((t) => (t.atFrame === oldFrom ? { ...t, atFrame: newFrom } : t)) };
  return next;
}
