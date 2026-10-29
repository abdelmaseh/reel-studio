// The layered-speaker scene. Three layers, bottom to top, over the speaker's own picture (the plate the edit already shows):
//   1. behind the speaker: the big word, with its hand-drawn mark
//   2. the speaker: an alpha clip of the person cut from the same source frames (the matte)
//   3. in front: the words beside and above the head, with their marks
// Without a matte there is no layer 2 to hide the big word, so it sits above the head and nothing is painted over the face.
import React from 'react';
import { useProbe } from '../../../core/safe';
import { Footage, type WindowGeo } from '../../../core/plate';
import { clamp01, useClock, useEnterF } from '../../../core/motion';
import { isArabic } from '../../../core/type';
import { useSceneTheme } from '../../../creative-kit/chapter-theme';
import { FitText, fitTextLayout, type SceneTheme } from '../../../creative-kit/primitives';
import { LIFT_TRAVEL, type HeadBoxPx } from '../../../creative-kit/head-clear.ts';
import { MarkStroke } from '../../../creative-kit/marks/MarkStroke';
import type { RoughKind } from '../../../creative-kit/marks/rough.ts';
import { HeroWord, canvasAvailable, useHeroLayout } from './hero';
import { MARKED_HEIGHT, SIDE, TIMING, aboveBox, fitMark, frames, markRoom, sideBox, zonesFor, type Box, type HeroBand } from './math.ts';
import type { LayeredScene } from './schema.ts';

type Word = LayeredScene['data']['words'][number];

const INK = '#0B0E13';

/** A heavy sticker outline for DOM text: eight hard offsets, a hard drop shadow and a soft one. */
export const outlineShadow = (px: number): string =>
  [
    ...[[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]].map(([x, y]) => `${x * px}px ${y * px}px 0 ${INK}`),
    `${px * 2}px ${px * 2.5}px 0 rgba(5,7,10,0.5)`,
    `0 ${px * 4}px ${px * 8}px rgba(5,7,10,0.45)`,
  ].join(', ');

const presetFor = (motion: LayeredScene['motion']) => (motion === 'quiet' ? 'tight' : motion === 'stagger' ? 'snap' : 'land');
const LEAN = { left: -3, right: 3, above: 0, behind: 0 } as const;

type Placed = { width: number; height: number; fit: ReturnType<typeof fitTextLayout>; rect: Box; mark: ReturnType<typeof fitMark> };

const LineWord: React.FC<{ word: Word; box: Box; theme: SceneTheme; motion: LayeredScene['motion']; seed: string; avoid: HeroBand | null }> = ({ word, box, theme, motion, seed, avoid }) => {
  const enter = useEnterF(word.atFrame, presetFor(motion));
  const probe = useProbe();
  const color = word.accent ? theme.accent : theme.text;
  const side = word.place === 'left' ? -1 : word.place === 'right' ? 1 : 0;
  const travel = LIFT_TRAVEL[motion];
  const size = word.place === 'above' ? 120 : 100;
  const dir = isArabic(word.text) ? 'rtl' : 'ltr';
  const markSeed = `${seed}:${word.place}:${word.text}`;
  const kind = word.mark?.kind as RoughKind | undefined;
  // A marked word is set smaller than its box, so the stroke has room around the text and stays inside the safe area and off the big
  // word. Each try takes a smaller text block than the one before; the first whose stroke fits is used.
  const placed = React.useMemo((): Placed | null => {
    const room = kind ? markRoom(kind) : 0;
    for (const shrink of kind ? [1, 0.88, 0.76, 0.64] : [1]) {
      const width = Math.floor((box.width - 2 * room) * shrink);
      const height = kind ? Math.min(box.height, MARKED_HEIGHT) : box.height;
      let fit: ReturnType<typeof fitTextLayout>;
      try {
        fit = fitTextLayout({ text: word.text, theme, width, height, size, min: 34, lines: 3, role: 'title' });
      } catch {
        continue;
      }
      if (!fit.fits || fit.height > height) continue;
      const rect = { x: box.x + (box.width - fit.width) / 2, y: box.y + (box.height - fit.height) / 2, width: fit.width, height: fit.height };
      if (!kind) return { width, height, fit, rect, mark: null };
      const mark = fitMark(kind, rect, dir, markSeed, avoid);
      if (mark !== null) return { width, height, fit, rect, mark };
    }
    return null;
  }, [word.text, kind, theme, box, size, dir, markSeed, avoid]);
  if (placed === null) {
    throw new Error(
      kind
        ? `layered-speaker: the ${kind} on "${word.text}" would leave the safe area or cross the big word. Use another mark, or move the word to the other side of the head.`
        : `layered-speaker: "${word.text}" does not fit its place ${word.place} beside the head. Shorten it or move it.`,
    );
  }
  const visible = probe ? 1 : clamp01(enter);
  const mark = placed.mark ? <MarkStroke kind={kind as RoughKind} target={placed.rect} dir={placed.mark.dir} from={placed.mark.from} at={word.mark?.atFrame ?? 0} color={theme.accent} seed={markSeed} /> : null;
  return (
    <>
      {/* A highlighter band goes under the word; every other mark goes over it. */}
      {kind === 'band' ? mark : null}
      <div
        data-layered-word={word.place}
        style={{
          position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: visible,
          transform: probe ? undefined : `translate(${Math.round(side * (1 - enter) * travel)}px, ${side === 0 ? Math.round(-(1 - enter) * travel) : 0}px) rotate(${LEAN[word.place]}deg)`,
          transformOrigin: '50% 50%',
        }}
      >
        <FitText text={word.text} theme={theme} role="title" width={placed.width} height={placed.height} size={size} min={34} lines={3} color={color} align="center"
          style={{ textShadow: outlineShadow(3) }} />
      </div>
      {kind === 'band' ? null : mark}
    </>
  );
};

export const LayeredSceneView: React.FC<{
  scene: LayeredScene;
  style: string;
  geometry?: WindowGeo;
  aspect?: number;
  headBox?: HeadBoxPx | null;
  /** A drawn stand-in for the matte layer, for library previews that have no footage. It puts the big word behind the head like a matte does. */
  standIn?: React.ReactNode;
}> = ({ scene, geometry, aspect, headBox, standIn }) => {
  const { frame, fps } = useClock();
  const probe = useProbe();
  const theme = useSceneTheme('layered-speaker');
  const { data } = scene;
  const zones = React.useMemo(() => zonesFor(headBox), [headBox]);
  const matte = data.foreground;
  const layered = Boolean(matte) || standIn !== undefined;
  const hero = data.words.find((word) => word.place === 'behind');
  const drawing = canvasAvailable();
  const heroLayout = useHeroLayout(hero?.text ?? null, layered ? 'behind' : 'above', zones, theme.display, Boolean(hero?.mark));
  const lines = data.words.filter((word) => word.place !== 'behind');
  const exit = probe ? 1 : clamp01((scene.durationInFrames - frame) / frames(TIMING.exitSeconds, fps));
  const layer: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: exit };
  const seed = scene.id;
  return (
    <>
      <div style={layer}>
        {data.words
          .filter((word) => word.place === 'behind')
          .map((word) => (
            <HeroWord key="hero" text={word.text} mode={layered ? 'behind' : 'above'} layout={heroLayout} atFrame={word.atFrame}
              fill={word.accent ? theme.accent : theme.text} mark={word.mark} markColor={theme.accent} seed={seed} />
          ))}
      </div>
      {standIn !== undefined ? standIn : null}
      {matte && geometry && aspect ? (
        <div style={{ position: 'absolute', top: geometry.windowTop, left: 0, width: 1080, height: geometry.windowHeight, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: geometry.videoLeft, top: geometry.videoTop, width: geometry.videoWidth, height: Math.round(geometry.videoWidth * aspect) }}>
            <Footage src={matte.src} transparent muted startFromSec={matte.trimBeforeFrame / fps} />
          </div>
        </div>
      ) : null}
      <div style={layer}>
        {/* The words around the big word wait until the big word is measured: where they sit depends on the rows its letters take. */}
        {(hero && drawing && heroLayout === null ? [] : lines).map((word) => {
          const box = word.place === 'above' ? aboveBox(zones, Boolean(hero && layered)) : sideBox(zones, word.place as 'left' | 'right', heroLayout?.band ?? null, Boolean(word.mark));
          if (box === null) {
            throw new Error(
              `layered-speaker: no room for the ${word.place} word "${word.text}" around the head (the free strip is under ${SIDE.minWidth}px wide or too low). Move it to another side or shorten the scene's words.`,
            );
          }
          return <LineWord key={word.place} word={word} box={box} theme={theme} motion={scene.motion} seed={seed} avoid={heroLayout?.band ?? null} />;
        })}
      </div>
    </>
  );
};
