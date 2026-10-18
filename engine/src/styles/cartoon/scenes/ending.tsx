// The cartoon ending: the last act. It opens with the reveal from the body's theme, shows the comment card and/or the follow card with the
// character's own head as the avatar, and ends with the quiet tail over the recorded sign-off: no band, no headline, no card, no sound,
// the narrator centred at full size and waving.
import React from 'react';
import {Check, Send} from 'lucide-react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {SafeExempt, useProbe} from '../../../core/safe';
import {FAMILY} from '../../../core/fonts';
import {EASE, PALETTES, TAIL, anchorFrame, clamp01, groundOf, inkFlipOffset, type GestureT, type MouthTable, type WordAnchor, type WordLike} from './math.ts';
import {headCanvas, placeAt, type PlaceKey, type Pt} from './rig.ts';
import {cartoonSceneSchema, timelineOf, type CartoonEndingScene} from './schema';
import {GroundStack} from './kit/ground';
import {Headline} from './kit/headline';
import {TopBand} from './kit/band';
import {Label, Mono} from './kit/card-shell';
import {CharacterHead, Figure} from './kit/narrator/figure';
import {narratorPose, onsetsOf, placesOf, resolveArms, sceneWordIndex, stageAt, useHeadlineFont, type Stage} from './scene';

/** The ending cards share one box in the middle band. */
export const ENDING_CARD = {x: 130, y: 640, w: 820, h: 380, enterSeconds: 0.45, exitSeconds: 0.3} as const;
const BUTTON = {left: 40, right: 40, bottom: 34, h: 92} as const;
/** Canvas points the narrator points at: the comment keyword and the follow button. */
export const ENDING_POINTS: Record<'comment' | 'follow', Pt> = {
  comment: {x: ENDING_CARD.x + ENDING_CARD.w / 2, y: ENDING_CARD.y + 150},
  follow: {x: ENDING_CARD.x + ENDING_CARD.w / 2, y: ENDING_CARD.y + ENDING_CARD.h - BUTTON.bottom - BUTTON.h / 2},
};
const isLatin = (text: string): boolean => /[A-Za-z]/.test(text) && !/[؀-ۿ]/.test(text);

/** The scene frames of the ending's beats (word anchors resolved on the compiled words). */
export function endingBeats(scene: CartoonEndingScene, words: readonly WordLike[], fps: number) {
  const d = scene.data, index = sceneWordIndex(words, scene), tl = timelineOf(scene, words, fps);
  const local = (a: WordAnchor | undefined, fallback: number) => (a ? (anchorFrame(a, index, fps) ?? scene.fromFrame + fallback) - scene.fromFrame : fallback);
  const tailFrame = tl.tailFrame;
  const cardEnd = tailFrame !== null ? tailFrame - Math.round(TAIL.fadeSeconds * fps) : scene.durationInFrames;
  const commentAt = local(d.comment?.at, 0), followAt = local(d.follow?.at, commentAt);
  const tapAt = local(d.follow?.tapAt, followAt + fps), shareAt = local(d.follow?.shareAt, tapAt + Math.round(0.5 * fps));
  return {tl, index, tailFrame, cardEnd, commentAt, followAt, tapAt, shareAt};
}

/** The narrator's gestures in the ending: authored ones, or point at the keyword, point at the button, a thumb on the share, a wave in the tail. */
export function endingGestures(scene: CartoonEndingScene, beats: ReturnType<typeof endingBeats>, fps: number): GestureT[] {
  const d = scene.data;
  if (d.gestures) return d.gestures.map((g) => {
    const anchor = g.anchor === 'camera' ? 'camera' as const : g.anchor && 'card' in g.anchor ? ENDING_POINTS[g.anchor.card === 'follow' ? 'follow' : 'comment'] : g.anchor;
    return {frame: (anchorFrame(g.at, beats.index, fps) ?? scene.fromFrame) - scene.fromFrame, arm: g.arm ?? 'auto', kind: g.kind, anchor, brow: g.brow, tilt: g.tilt, look: g.look};
  });
  const out: GestureT[] = [];
  if (d.comment) out.push({frame: beats.commentAt, arm: 'auto', kind: 'point', anchor: ENDING_POINTS.comment, brow: 0.5});
  if (d.follow) {
    out.push({frame: beats.followAt, arm: 'auto', kind: 'point', anchor: ENDING_POINTS.follow, brow: 0.4});
    if (beats.shareAt < (beats.tailFrame ?? Infinity)) out.push({frame: beats.shareAt, arm: 'r', kind: 'thumb', brow: 0.6, look: 'camera'});
  }
  if (beats.tailFrame !== null) out.push({frame: beats.tailFrame, arm: 'l', kind: 'rest'}, {frame: beats.tailFrame, arm: 'r', kind: 'wave', brow: 0.5, look: 'camera'});
  return out.sort((a, b) => a.frame - b.frame);
}

/** The ending's places: the authored ones, else the body's last place (the entrance), then centre at full size for the tail. */
export function endingPlaces(scene: CartoonEndingScene, beats: ReturnType<typeof endingBeats>, fps: number): PlaceKey[] {
  if (scene.data.places) return placesOf(scene.data, beats.tl, beats.index, fps);
  const places: PlaceKey[] = [{startFrame: 0, x: scene.data.entrance.x, scale: scene.data.entrance.scale}];
  if (beats.tailFrame !== null) places.push({startFrame: Math.max(1, beats.tailFrame - Math.round(TAIL.slideSeconds * fps)), x: TAIL.place.x, scale: TAIL.place.scale});
  return places;
}

/** The ending's narrator at a frame (tests and the arm gate; the view memoises the same parts). */
export function endingNarratorAt(input: CartoonEndingScene, words: readonly WordLike[], mouth: MouthTable | undefined, frame: number, fps: number) {
  const scene = cartoonSceneSchema.parse(input) as CartoonEndingScene;
  const beats = endingBeats(scene, words, fps), places = endingPlaces(scene, beats, fps);
  const gestures = resolveArms(endingGestures(scene, beats, fps), places, fps);
  return {...narratorPose({id: scene.id, tl: beats.tl, places, gestures, onsets: onsetsOf(beats.tl), mouth, frame, fps}), character: scene.data.character, places};
}

const EndingCard: React.FC<{stage: Stage; from: number; to: number; id: string; children: React.ReactNode}> = ({stage, from, to, id, children}) => {
  const probe = useProbe();
  const {frame, fps, ink} = stage;
  const enter = EASE.expoOut(clamp01((frame - from) / (ENDING_CARD.enterSeconds * fps))), out = clamp01((frame - to) / (ENDING_CARD.exitSeconds * fps));
  if (frame < from || out >= 1) return null;
  const rise = Math.round((1 - enter) * 70) - Math.round(out * out * 40);
  return <div data-card={id} style={{position: 'absolute', left: ENDING_CARD.x, top: ENDING_CARD.y, width: ENDING_CARD.w, height: ENDING_CARD.h, borderRadius: 34, background: ink.card, border: `2px solid ${ink.line}`,
    ...(probe ? {} : {boxShadow: ink.shadow}), opacity: Number((clamp01(1.5 * enter) * (1 - out)).toFixed(3)), transform: `translateY(${rise}px) scale(${(0.9 + 0.1 * enter).toFixed(3)})`, boxSizing: 'border-box', padding: 30}}>
    {children}
  </div>;
};

export const CartoonEndingView: React.FC<{scene: CartoonEndingScene; words?: readonly WordLike[]; mouth?: MouthTable}> = ({scene: input, words = [], mouth}) => {
  const scene = React.useMemo(() => cartoonSceneSchema.parse(input) as CartoonEndingScene, [input]);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const probe = useProbe();
  const d = scene.data;
  const beats = React.useMemo(() => endingBeats(scene, words, fps), [scene, words, fps]);
  const places = React.useMemo(() => endingPlaces(scene, beats, fps), [scene, beats, fps]);
  const gestures = React.useMemo(() => resolveArms(endingGestures(scene, beats, fps), places, fps), [scene, beats, places, fps]);
  const onsets = React.useMemo(() => onsetsOf(beats.tl), [beats]);
  const accents = React.useMemo(() => new Set(d.accents), [d.accents]);
  const fontFamily = useHeadlineFont();
  const base = stageAt(frame, fps, beats.tl, places, probe, beats.index);
  // The ending is a new act: the reveal opens from the body's theme and the ink flips when the circle covers the band row.
  const origin = headCanvas(placeAt(frame, places, fps));
  const stage: Stage = {...base, ink: frame < inkFlipOffset(origin, fps) ? PALETTES[d.fromTheme] : PALETTES[d.theme], reveal: {prevTheme: d.fromTheme, seconds: frame / fps, origin}};
  const n = narratorPose({id: scene.id, tl: beats.tl, places, gestures, onsets, mouth, frame, fps});
  const inTail = beats.tailFrame !== null && frame >= beats.tailFrame;
  const {ink} = stage;
  const tapped = d.follow !== undefined && frame >= beats.tapAt + Math.round(0.06 * fps);
  const dip = d.follow ? EASE.bell(clamp01((frame - beats.tapAt) / (0.4 * fps))) : 0;
  const share = d.follow ? EASE.bell(clamp01((frame - beats.shareAt) / (0.45 * fps))) : 0;
  return <div data-cartoon="ending" style={{position: 'absolute', inset: 0, overflow: 'hidden', boxSizing: 'border-box'}}>
    <GroundStack theme={d.theme} prevTheme={d.fromTheme} seconds={stage.reveal.seconds} origin={origin} />
    {d.comment ? <EndingCard stage={stage} from={beats.commentAt} to={d.follow ? beats.followAt : beats.cardEnd} id="comment">
      <Mono color={ink.dim}>{'// comment'}</Mono>
      <div dir={isLatin(d.comment.keyword) ? 'ltr' : 'rtl'} style={{marginTop: 18, textAlign: 'center', whiteSpace: 'nowrap', fontFamily: isLatin(d.comment.keyword) ? FAMILY.latinSerif : FAMILY.plexDisplay,
        fontStyle: isLatin(d.comment.keyword) ? 'italic' : 'normal', fontWeight: isLatin(d.comment.keyword) ? 400 : 700, fontSize: 120, color: ink.accentInk, fontSynthesis: 'none', lineHeight: 1.1}}>{d.comment.keyword}</div>
      {d.comment.promise ? <Label color={ink.ink} size={36} style={{marginTop: 14, textAlign: 'center', whiteSpace: 'normal'}}>{d.comment.promise}</Label> : null}
    </EndingCard> : null}
    {d.follow ? <EndingCard stage={stage} from={beats.followAt} to={beats.cardEnd} id="follow">
      <Mono color={ink.dim}>{'// follow'}</Mono>
      <div style={{position: 'absolute', right: 30, top: 22, color: share > 0.05 ? ink.accentInk : ink.dim, transform: `scale(${(1 + 0.25 * share).toFixed(3)}) rotate(${(-12 * share).toFixed(1)}deg)`}}><Send size={34} strokeWidth={2.2} aria-hidden /></div>
      <div style={{display: 'flex', gap: 26, alignItems: 'center', marginTop: 18}}>
        <div style={{width: 150, height: 150, borderRadius: 75, padding: 6, background: ink.accent, boxSizing: 'border-box', flex: 'none'}}>
          <div style={{width: 138, height: 138, borderRadius: 69, border: '4px solid #FFFFFF', overflow: 'hidden', boxSizing: 'border-box'}}><CharacterHead character={d.character} size={130} idPrefix={`${scene.id}-avatar`} /></div>
        </div>
        <div style={{minWidth: 0}}>
          <div dir="ltr" style={{fontFamily: FAMILY.plexDisplay, fontWeight: 700, fontSize: 50, color: ink.ink, fontSynthesis: 'none', whiteSpace: 'nowrap'}}>{d.follow.handle}</div>
          <Label color={ink.dim} size={26} style={{marginTop: 6}}>{d.follow.message}</Label>
        </div>
      </div>
      <div style={{position: 'absolute', left: BUTTON.left, right: BUTTON.right, bottom: BUTTON.bottom, height: BUTTON.h, borderRadius: 22, background: tapped ? ink.line : ink.accent, color: ink.onAccent,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: FAMILY.plexDisplay, fontWeight: 700, fontSize: 40, transform: `scale(${(1 - 0.05 * dip).toFixed(3)})`, fontSynthesis: 'none'}}>
        <span style={{color: tapped ? ink.ink : ink.onAccent}}>{tapped ? 'Following' : 'Follow'}</span>{tapped ? <Check size={34} strokeWidth={3} color={ink.ink} aria-hidden /> : null}
      </div>
    </EndingCard> : null}
    <SafeExempt><Figure character={d.character} place={n.place} pose={n.pose} arms={n.arms} accent={ink.accent} dark={groundOf(d.theme) === 'night'} idPrefix={scene.id} waveDeg={n.waveDeg} /></SafeExempt>
    {!inTail ? <TopBand stage={stage} tally={d.follow ? {label: 'FOLLOW', tapFrame: beats.tapAt} : null} fadeFrame={beats.tailFrame} typeFirst showCounter={d.follow !== undefined} /> : null}
    {!inTail ? <Headline stage={stage} accents={accents} fontFamily={fontFamily} holdUntil={beats.tailFrame} /> : null}
  </div>;
};
