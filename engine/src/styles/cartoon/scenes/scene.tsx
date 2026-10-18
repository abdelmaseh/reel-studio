// The cartoon body scene. Every layer reads one Stage per frame: the resolved timeline, the act and its ink, the reveal, the narrator's places.
// Back to front: ground and reveal, cards, narrator, viewfinder brackets, top band, headline.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {SafeExempt, useProbe} from '../../../core/safe';
import {FAMILY} from '../../../core/fonts';
import {useSceneTheme} from '../../../creative-kit/chapter-theme';
import {
  MOUTH_LEAD_FRAMES, PALETTES, anchorFrame, blinkAt, cardAnchors, clamp01, deriveGestures, derivePlaces, groundOf, inkFlipOffset, nodAt, resolveCartoonTimeline, seedOf, wordIndex,
  type GestureIn, type GestureT, type MouthTable, type Palette, type PlaceIn, type Theme, type Timeline, type WordIndex, type WordLike,
} from './math.ts';
import {MOTION_LIMITS, characterExtents, type Character} from './character.ts';
import {armKeys, armStateAt, gazeAt, headCanvas, placeAt, type Arm, type ArmState, type GestureSpec, type Place, type PlaceKey, type Pt} from './rig.ts';
import {cartoonSceneSchema, type CartoonBodyScene} from './schema';
import {GroundStack} from './kit/ground';
import {Headline} from './kit/headline';
import {Brackets, TopBand} from './kit/band';
import {Cards} from './kit/cards';
import {Figure, type Pose} from './kit/narrator/figure';

/** Everything a layer needs at one frame. Frames are scene-relative; words keep edit frames (subtract `sceneFrom`). */
export type Stage = {
  t: number; frame: number; fps: number; tl: Timeline; act: number; theme: Theme; ink: Palette;
  reveal: {prevTheme: Theme | null; seconds: number; origin: {x: number; y: number}};
  places: PlaceKey[]; probe: string | null; sceneFrom: number; wordsIndex: WordIndex;
};

/** The words inside a scene window, indexed by source index. */
export const sceneWordIndex = (words: readonly WordLike[], scene: {fromFrame: number; durationInFrames: number}): WordIndex =>
  wordIndex(words.filter((w) => w.fromFrame >= scene.fromFrame && w.fromFrame < scene.fromFrame + scene.durationInFrames));

/** The narrator's places: the authored ones (word anchors) or the derived ones. The reveal origin and the figure read the same list. */
export function placesOf(data: {places?: readonly PlaceIn[]; character: Character}, tl: Timeline, index: WordIndex, fps: number): PlaceKey[] {
  if (!data.places) return derivePlaces(tl, characterExtents(data.character), fps);
  return data.places.map((p) => ({startFrame: Math.max(0, (anchorFrame(p.at, index, fps) ?? tl.sceneFrom) - tl.sceneFrom), x: p.x, scale: p.scale}));
}

export function stageAt(frame: number, fps: number, tl: Timeline, places: PlaceKey[], probe: string | null, wordsIndex: WordIndex): Stage {
  let act = 0;
  tl.acts.forEach((a, i) => { if (a.flipFrame <= frame) act = i; });
  const current = tl.acts[act] ?? {theme: 'light' as Theme, flipFrame: 0};
  const theme = current.theme, prevTheme = act > 0 ? tl.acts[act - 1].theme : null;
  const origin = headCanvas(placeAt(frame, places, fps));
  const since = (frame - current.flipFrame) / fps;
  // Text, cards and glow switch to the new ink on the frame whose circle covers the band row; before that the previous palette stays.
  const inkTheme = prevTheme !== null && frame - current.flipFrame < inkFlipOffset(origin, fps) ? prevTheme : theme;
  return {t: frame / fps, frame, fps, tl, act, theme, ink: PALETTES[inkTheme], reveal: {prevTheme, seconds: since, origin}, places, probe, sceneFrom: tl.sceneFrom, wordsIndex};
}

// ---- the narrator ----
export type NarratorGesture = GestureSpec & {look?: 'camera' | Pt; brow?: number; tilt?: number};

/** Authored gestures (word anchors, card anchors) as scene frames and canvas points, or the derived ones. */
export function bodyGestures(data: {gestures?: readonly GestureIn[]}, tl: Timeline, places: readonly PlaceKey[], index: WordIndex, fps: number): GestureT[] {
  if (!data.gestures) return deriveGestures(tl, places, fps);
  return data.gestures.map((g) => {
    let anchor: GestureT['anchor'];
    if (g.anchor === 'camera') anchor = 'camera';
    else if (g.anchor && 'card' in g.anchor) {
      const ref = g.anchor;
      const card = tl.cards.find((c) => c.id === ref.card);
      anchor = card ? cardAnchors(card)[ref.point] ?? cardAnchors(card).centre : undefined;
    } else anchor = g.anchor;
    return {frame: (anchorFrame(g.at, index, fps) ?? tl.sceneFrom) - tl.sceneFrom, arm: g.arm ?? 'auto', kind: g.kind, anchor, brow: g.brow, tilt: g.tilt, look: g.look};
  });
}
/** `auto` picks the arm on the anchor's side of the figure at that frame (right on a tie); an auto rest lowers both arms. */
export function resolveArms(list: readonly GestureT[], places: readonly PlaceKey[], fps: number): NarratorGesture[] {
  const out: NarratorGesture[] = [];
  for (const g of list) {
    if (g.arm !== 'auto') { out.push({...g, arm: g.arm}); continue; }
    if (g.kind === 'rest') { out.push({...g, arm: 'l'}, {...g, arm: 'r'}); continue; }
    const anchor = g.anchor;
    const arm: Arm = anchor && anchor !== 'camera' && anchor.x < placeAt(g.frame, places, fps).x ? 'l' : 'r';
    out.push({...g, arm});
  }
  return out.sort((a, b) => a.frame - b.frame);
}

export type NarratorFrame = {place: Place; pose: Pose; arms: Record<Arm, ArmState>; waveDeg: number};
const clampAbs = (n: number, max: number): number => Math.max(-max, Math.min(max, n));

/** The per-frame part of the narrator: where it stands, how its arms are posed, its face and its idle life. */
export function narratorPose({id, tl, places, gestures, onsets, mouth, frame, fps}: {id: string; tl: Timeline; places: readonly PlaceKey[]; gestures: readonly NarratorGesture[];
  onsets: readonly number[]; mouth?: MouthTable; frame: number; fps: number}): NarratorFrame {
  const place = placeAt(frame, places, fps);
  const arms = armStateAt(frame, armKeys(gestures, fps, place), fps, place);
  let mood: NarratorGesture | undefined;
  for (const g of gestures) if (g.frame <= frame && (g.brow !== undefined || g.tilt !== undefined)) mood = g;
  const at = tl.sceneFrom + frame + MOUTH_LEAD_FRAMES;
  const open = mouth && mouth.values.length ? clamp01(mouth.values[Math.max(0, Math.min(mouth.values.length - 1, at))] ?? 0) : 0;
  const t = frame / fps, nod = nodAt(frame, onsets, fps), gaze = gazeAt(frame, gestures, arms, place), moodTilt = mood?.tilt ?? 0;
  const pose: Pose = {
    open, blink: blinkAt(frame, fps, seedOf(id)), gaze, brow: mood?.brow ?? 0.3, turn: 0.9 * gaze.gx,
    // Tilt and lean stay inside the limits the safe-box extents were measured at.
    tilt: clampAbs(moodTilt + 3 * gaze.gx + 1.4 * Math.sin(4.1 * t) * open + 1.1 * Math.sin(0.9 * t), MOTION_LIMITS.tiltDeg),
    bob: -3 * open + 2.5 * Math.sin(1.3 * t) + 4 * nod,
    lean: clampAbs(0.35 * moodTilt + 0.9 * Math.sin(1.15 * t) + 0.5 * Math.sin(2.7 * t) * Math.min(1, 2 * open), MOTION_LIMITS.leanDeg),
    breathe: 1 + 0.006 * Math.sin(1.9 * t),
  };
  return {place, pose, arms, waveDeg: 16 * Math.sin(2 * Math.PI * 2.1 * t)};
}

/** Word onsets of the scene's sentences, scene-relative: the nods. */
export const onsetsOf = (tl: Timeline): number[] => tl.sentences.flatMap((s) => s.words.map((w) => w.fromFrame - tl.sceneFrom));

/** The whole narrator of a body scene at a frame (tests, stills and the arm gate use it; the view memoises the same parts). */
export function narratorAt(input: CartoonBodyScene, words: readonly WordLike[], mouth: MouthTable | undefined, frame: number, fps: number): NarratorFrame & {character: Character; tl: Timeline; places: PlaceKey[]} {
  const scene = cartoonSceneSchema.parse(input) as CartoonBodyScene;
  const tl = resolveCartoonTimeline(scene.data, scene, words, fps), index = sceneWordIndex(words, scene);
  const places = placesOf(scene.data, tl, index, fps);
  const gestures = resolveArms(bodyGestures(scene.data, tl, places, index, fps), places, fps);
  return {...narratorPose({id: scene.id, tl, places, gestures, onsets: onsetsOf(tl), mouth, frame, fps}), character: scene.data.character, tl, places};
}

// ---- the view ----
/** The creator's font preference for Arabic words, or null for the style's display face. */
export const useHeadlineFont = (): string | null => {
  const theme = useSceneTheme('cartoon');
  return theme.ar === FAMILY.plexDisplay ? null : theme.ar;
};

/** The scene with the schema defaults applied (character, accents, counter, brackets), whatever the caller passed. */
export const useParsedBody = (input: CartoonBodyScene): CartoonBodyScene =>
  React.useMemo(() => cartoonSceneSchema.parse(input) as CartoonBodyScene, [input]);

export const CartoonSceneView: React.FC<{scene: CartoonBodyScene; words?: readonly WordLike[]; mouth?: MouthTable}> = ({scene: input, words = [], mouth}) => {
  const scene = useParsedBody(input);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const probe = useProbe();
  const tl = React.useMemo(() => resolveCartoonTimeline(scene.data, scene, words, fps), [scene, words, fps]);
  const index = React.useMemo(() => sceneWordIndex(words, scene), [words, scene]);
  const places = React.useMemo(() => placesOf(scene.data, tl, index, fps), [scene.data, tl, index, fps]);
  const gestures = React.useMemo(() => resolveArms(bodyGestures(scene.data, tl, places, index, fps), places, fps), [scene.data, tl, places, index, fps]);
  const onsets = React.useMemo(() => onsetsOf(tl), [tl]);
  const accents = React.useMemo(() => new Set(scene.data.accents), [scene.data.accents]);
  const fontFamily = useHeadlineFont();
  const stage = stageAt(frame, fps, tl, places, probe, index);
  const n = narratorPose({id: scene.id, tl, places, gestures, onsets, mouth, frame, fps});
  return <div data-cartoon="body" style={{position: 'absolute', inset: 0, overflow: 'hidden', boxSizing: 'border-box'}}>
    <GroundStack theme={stage.theme} prevTheme={stage.reveal.prevTheme} seconds={stage.reveal.seconds} origin={stage.reveal.origin} />
    <Cards stage={stage} />
    <SafeExempt><Figure character={scene.data.character} place={n.place} pose={n.pose} arms={n.arms} accent={stage.ink.accent} dark={groundOf(stage.theme) === 'night'} idPrefix={scene.id} waveDeg={n.waveDeg} /></SafeExempt>
    {scene.data.brackets ? <Brackets stage={stage} until={tl.sentences[0]?.endFrame ?? 0} /> : null}
    <TopBand stage={stage} fadeFrame={tl.tailFrame} />
    <Headline stage={stage} accents={accents} fontFamily={fontFamily} holdUntil={tl.tailFrame} />
  </div>;
};
