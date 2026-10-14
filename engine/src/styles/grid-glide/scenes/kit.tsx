// Grid Glide building blocks: words that rise into a finished layout, a box line with one wipe,
// bevelled still cards, a tool pill, sparkle bullets, and the scene wrapper that slides, pushes
// and dips. The numbers live in ./math (Node-safe); this file only draws them.
//
// Every frame here is SCENE-RELATIVE: the scene renderer mounts its content inside the scene's own
// <Sequence>, so useCurrentFrame() is 0 on the scene's first frame. The motion law is authored at
// 30 fps: each component reads the edit's frame rate from useVideoConfig() and passes it to ./math,
// which stretches every frame count by fps / 30. `at` values are frames of the edit; a line's
// `cadence` is a rhythm in 30 fps frames.
// Under the safe-zone probe (core/safe.tsx) every component draws its rest pose and skips
// decoration, so the check measures the final layout.
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FAMILY } from "../../../core/fonts";
import { FRAME, SafeExempt, useProbe } from "../../../core/safe";
import { isArabic, safeWidthFor } from "../../../core/type";
import { textWidth, type TextSpec } from "./fit";
import {
  BOX,
  BULLET,
  CADENCE,
  CARD,
  COLOR,
  GAP,
  GRID,
  LINE_HEIGHT,
  OPTICAL_SIZE,
  PILL,
  RISE,
  SIZE,
  STAR,
  WATERMARK,
  WEIGHT,
  boxHidePercent,
  bulletSlide,
  cadence as startFrames,
  clipIndexAt,
  clipWindow,
  coverFit,
  gridGeometry,
  largestFit,
  pillOffset,
  pillOpacity,
  scale,
  sceneMotionState,
  scrollOffset,
  sparkleRotation,
  sparkleScale,
  vignetteOpacity,
  wordProgress,
  type EnterSpec,
  type ExitSpec,
} from "./math";

export type Dir = "rtl" | "ltr";
export type LineRole = "lead" | "hero";
export type GlideClip = {
  /** Scene frame where this clip is cut in. Clip 0 is on screen from frame 0 whatever its `at`. */
  at: number;
  src: string;
  width: number;
  height: number;
  kind: "image" | "video";
  /** Stills only: fraction of the scrollable range at the start and at the end of the clip. */
  scroll?: { from: number; to: number };
  /** Videos only: frames to skip at the start of the file (Remotion 4 `trimBefore`; `startFrom` is deprecated). */
  trimBefore?: number;
};

/* ------------------------------------------------------------------ typography */

const FontContext = React.createContext<string>(FAMILY.gridSans);

/** Overrides the family every Grid Glide component draws and measures with (the creator's font choice). */
export const GlideFontProvider: React.FC<{ family: string; children?: React.ReactNode }> = ({ family, children }) => (
  <FontContext.Provider value={family}>{children}</FontContext.Provider>
);
export const useGlideFont = (): string => React.useContext(FontContext);

const textBase = (family: string): React.CSSProperties => ({
  fontFamily: family,
  fontVariationSettings: `"opsz" ${OPTICAL_SIZE}`,
  fontKerning: "normal",
  fontSynthesis: "none",
  whiteSpace: "pre",
});

/** Arabic is never letter-spaced: tracking breaks the joins between letters. */
const latinTracking = (text: string, em: string): string | undefined => (isArabic(text) ? undefined : em);

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Width in px of a row of words laid out with the kit's word gap. */
export const rowWidth = (words: readonly string[], spec: TextSpec): number =>
  words.reduce((sum, word) => sum + textWidth(word, spec), 0) + spec.size * GAP * Math.max(0, words.length - 1);

/* ------------------------------------------------------------------------ words */

/** One word. Opacity and rise share p = OUT((frame - start) / 30) at 30 fps (30 x fps / 30 frames). No blur, scale, overshoot or character splitting. */
export const Word: React.FC<{
  text: string;
  start: number;
  size: number;
  weight: number;
  rise?: number;
  slideX?: number;
  color?: string;
}> = ({ text, start, size, weight, rise = 0, slideX = 0, color = COLOR.ink }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const probe = useProbe();
  const family = useGlideFont();
  const p = probe ? 1 : wordProgress(frame, start, fps);
  return (
    <span
      data-glide="word"
      style={{
        ...textBase(family),
        display: "inline-block",
        fontSize: size,
        fontWeight: weight,
        color,
        opacity: p,
        transform: `translate3d(${(1 - p) * slideX}px, ${(1 - p) * rise}px, 0)`,
      }}
    >
      {text}
    </span>
  );
};

/** In a right-to-left line every run of consecutive Latin words keeps its own order inside one ltr group. */
const WordRow: React.FC<{
  words: readonly string[];
  dir: Dir;
  gap: number;
  render: (word: string, index: number) => React.ReactNode;
}> = ({ words, dir, gap, render }) => {
  if (dir !== "rtl") return <>{words.map((word, index) => render(word, index))}</>;
  const out: React.ReactNode[] = [];
  for (let i = 0; i < words.length; ) {
    if (isArabic(words[i])) {
      out.push(render(words[i], i));
      i += 1;
      continue;
    }
    let j = i;
    while (j < words.length && !isArabic(words[j])) j += 1;
    out.push(
      <span
        key={`run-${i}`}
        data-glide="latin-run"
        style={{ display: "inline-flex", direction: "ltr", columnGap: gap, alignItems: "baseline" }}
      >
        {words.slice(i, j).map((word, q) => render(word, i + q))}
      </span>,
    );
    i = j;
  }
  return <>{out}</>;
};

/**
 * A line of up to six words laid out once in its final geometry; each word is invisible until its
 * start (at + index x scale(cadence, fps)). `at` is a frame of the edit, `cadence` a rhythm in 30 fps
 * frames. Fails loudly when the row is wider than the safe band at its height.
 * `rise` is RISE.stack (130) for chapter and hero stacks and RISE.caption (80) for caption blocks.
 */
export const Line: React.FC<{
  words: readonly string[];
  at: number;
  cadence: number;
  y: number;
  size?: number;
  role?: LineRole;
  weight?: number;
  rise?: number;
  dir?: Dir;
  align?: "center" | "start" | "end";
  x?: number;
  width?: number;
  color?: string;
}> = ({
  words,
  at,
  cadence: step,
  y,
  size,
  role = "lead",
  weight,
  rise = RISE.stack,
  dir = "rtl",
  align = "center",
  x = 0,
  width = FRAME.width,
  color,
}) => {
  const family = useGlideFont();
  const { fps } = useVideoConfig();
  const px = size ?? (role === "hero" ? SIZE.hero : SIZE.lead);
  const wt = weight ?? (role === "hero" ? WEIGHT.hero : WEIGHT.lead);
  const height = px * LINE_HEIGHT;
  const used = rowWidth(words, { family, size: px, weight: wt });
  const safe = safeWidthFor(y, height, "organic");
  if (used > safe.width) {
    throw new Error(
      `grid-glide: the line ${JSON.stringify(words.join(" "))} is ${Math.ceil(used)}px wide at ${px}px but only ${safe.width}px are safe at y ${y}. Use fewer or shorter words, or a smaller size.`,
    );
  }
  const starts = startFrames(words.length, at, step, fps);
  return (
    <div
      data-glide="line"
      style={{
        position: "absolute",
        left: x,
        width,
        top: y,
        height,
        display: "flex",
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: align === "center" ? "center" : align === "start" ? "flex-start" : "flex-end",
        columnGap: px * GAP,
        direction: dir,
        lineHeight: LINE_HEIGHT,
      }}
    >
      <WordRow
        words={words}
        dir={dir}
        gap={px * GAP}
        render={(word, index) => (
          <Word key={index} text={word} start={starts[index]} size={px} weight={wt} rise={rise} color={color} />
        )}
      />
    </div>
  );
};

/**
 * Light text on a dark box, revealed by one continuous clip edge in reading direction: right to
 * left in Arabic, left to right in Latin. The box has a fixed width; the text is fitted to 95 % of
 * it (48-88 px) and the render fails when it cannot fit.
 */
export const BoxLine: React.FC<{
  text: string;
  at: number;
  y: number;
  dir?: Dir;
  width?: number;
  x?: number;
}> = ({ text, at, y, dir = "rtl", width = BOX.width, x }) => {
  const frame = useCurrentFrame();
  const probe = useProbe();
  const family = useGlideFont();
  const { fps } = useVideoConfig();
  const words = text.trim().split(/\s+/).length;
  const limit = Math.floor(width * BOX.fit);
  const fitted = largestFit((size) => textWidth(text, { family, size, weight: WEIGHT.box }), limit, BOX.min, SIZE.box);
  if (!fitted.fits) {
    throw new Error(
      `grid-glide: the box text ${JSON.stringify(text)} needs ${Math.ceil(fitted.width)}px at ${BOX.min}px but the box allows ${limit}px. Shorten the text.`,
    );
  }
  const hide = round3(boxHidePercent(frame, at, words, fps));
  const clip = probe ? undefined : dir === "rtl" ? `inset(0 0 0 ${hide}%)` : `inset(0 ${hide}% 0 0)`;
  return (
    <div
      data-glide="box"
      style={{
        ...textBase(family),
        position: "absolute",
        left: x ?? (FRAME.width - width) / 2,
        top: y,
        width,
        height: Math.round(fitted.size * BOX.height),
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: COLOR.box,
        color: COLOR.boxText,
        fontSize: fitted.size,
        fontWeight: WEIGHT.box,
        lineHeight: 1,
        direction: dir,
        clipPath: clip,
      }}
    >
      {text}
    </div>
  );
};

/* ------------------------------------------------------------------------ cards */

/**
 * Bevelled slab with a screen inset. Dead still: it never moves, tilts or scales. The screen is a
 * positioned, clipped box: position every child placed in it (absolute or relative, as CardMedia
 * does) so it paints above the screen.
 */
export const Card: React.FC<{
  y: number;
  h: number;
  x?: number;
  w?: number;
  screenBg?: string;
  children?: React.ReactNode;
}> = ({ y, h, x = CARD.x, w = CARD.w, screenBg = COLOR.screen, children }) => {
  const probe = useProbe();
  return (
    <div
      data-glide="card"
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: CARD.radius,
        background: COLOR.cardFace,
        boxShadow: probe ? CARD.bevel : `${CARD.bevel}, ${CARD.shadow}`,
      }}
    >
      <div
        data-glide="card-screen"
        style={{ position: "absolute", inset: CARD.inset, borderRadius: CARD.innerRadius, overflow: "hidden", background: screenBg }}
      >
        {children}
      </div>
    </div>
  );
};

/**
 * Media inside a card screen of `width` x `height` px. Clips change by hard cuts only. A still
 * covers the screen and may scroll down like a recording; a video plays from its own cut-in.
 * `until` is the scene frame where the last clip stops (normally the scene duration).
 */
export const CardMedia: React.FC<{
  clips: readonly GlideClip[];
  width: number;
  height: number;
  until: number;
}> = ({ clips, width, height, until }) => {
  const frame = useCurrentFrame();
  const probe = useProbe();
  if (probe) return <AbsoluteFill style={{ background: probe }} />;
  if (clips.length === 0) throw new Error("grid-glide: a card needs at least one media clip.");
  const ats = clips.map((clip) => clip.at);
  const index = clipIndexAt(ats, frame);
  const clip = clips[index];
  const span = clipWindow(ats, index, until);
  if (clip.kind === "video") {
    return (
      <div key={index} data-glide="media-video" style={{ position: "absolute", inset: 0 }}>
        <Sequence from={span.start} layout="none">
          <OffthreadVideo
            src={staticFile(clip.src)}
            muted
            trimBefore={clip.trimBefore}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </Sequence>
      </div>
    );
  }
  const fit = coverFit(clip.width, clip.height, width, height);
  return (
    <Img
      key={index}
      data-glide="media-image"
      src={staticFile(clip.src)}
      style={{
        position: "absolute",
        left: fit.left,
        top: -scrollOffset(fit.rangeY, clip.scroll, frame, span),
        width: fit.width,
        height: fit.height,
        maxWidth: "none",
      }}
    />
  );
};

/* ------------------------------------------------------------------- pill, bullets */

/**
 * Pill for a chapter's tool or for the follow card. Slides in from the left (screen space, also in Arabic) and fades in
 * linearly. The label is fitted to 50-72 px (uppercase for Latin) and the render fails when it cannot fit.
 * The dark tile exists to hold a logo: with a `logo` it sits before the label, without one the label is centred on the pill.
 */
export const Pill: React.FC<{ y: number; at: number; label: string; logo?: string }> = ({ y, at, label, logo }) => {
  const frame = useCurrentFrame();
  const probe = useProbe();
  const family = useGlideFont();
  const { fps } = useVideoConfig();
  const latin = !isArabic(label);
  const tracking = latinTracking(label, "-0.01em");
  const fitted = largestFit(
    (size) => textWidth(label, { family, size, weight: WEIGHT.label, transform: latin ? "uppercase" : undefined, tracking }),
    PILL.labelSlot,
    PILL.labelMin,
    PILL.label,
  );
  if (!fitted.fits) {
    throw new Error(
      `grid-glide: the pill label ${JSON.stringify(label)} needs ${Math.ceil(fitted.width)}px at ${PILL.labelMin}px but only ${PILL.labelSlot}px are free. Shorten the label.`,
    );
  }
  return (
    <div
      data-glide="pill"
      style={{
        position: "absolute",
        left: PILL.x,
        top: y,
        width: PILL.w,
        height: PILL.h,
        borderRadius: PILL.radius,
        background: COLOR.pillFace,
        boxShadow: probe ? PILL.bevel : `${PILL.bevel}, ${PILL.shadow}`,
        transform: `translateX(${probe ? 0 : pillOffset(frame, at, fps)}px)`,
        opacity: probe ? 1 : pillOpacity(frame, at, fps),
        display: "flex",
        alignItems: "center",
        direction: "ltr",
      }}
    >
      {logo ? (
        <div
          data-glide="pill-tile"
          style={{
            width: PILL.tile,
            height: PILL.tile,
            marginLeft: PILL.tileInset,
            borderRadius: PILL.tileRadius,
            background: COLOR.pillInk,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flex: "none",
          }}
        >
          <Img src={staticFile(logo)} style={{ width: PILL.tile * PILL.logoScale, height: PILL.tile * PILL.logoScale, objectFit: "contain" }} />
        </div>
      ) : null}
      <div
        data-glide="pill-label"
        style={{
          ...textBase(family),
          ...(logo ? { marginLeft: PILL.labelGap } : { marginLeft: 0, flex: 1, textAlign: "center" as const }),
          fontSize: fitted.size,
          fontWeight: WEIGHT.label,
          color: COLOR.pillInk,
          lineHeight: 1,
          textTransform: latin ? "uppercase" : undefined,
          letterSpacing: tracking,
          unicodeBidi: "plaintext",
        }}
      >
        {label}
      </div>
    </div>
  );
};

const STAR_PATH = "M0,-1 C0.09,-0.27 0.27,-0.09 1,0 C0.27,0.09 0.09,0.27 0,1 C-0.09,0.27 -0.27,0.09 -1,0 C-0.27,-0.09 -0.09,-0.27 0,-1 Z";

/** Four-point sparkle, drawn as a path. Grows linearly over 8.5 frames (30 fps) while unwinding 16 degrees; fully dark from its first frame. */
export const Sparkle: React.FC<{ cx: number; cy: number; at: number; size?: number; color?: string }> = ({
  cx,
  cy,
  at,
  size = STAR.size,
  color = COLOR.box,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const probe = useProbe();
  const t = frame - at;
  if (!probe && t < 0) return null;
  return (
    <svg
      data-glide="sparkle"
      width={size}
      height={size}
      viewBox="-1 -1 2 2"
      style={{
        position: "absolute",
        left: cx - size / 2,
        top: cy - size / 2,
        transform: `rotate(${probe ? 0 : sparkleRotation(t, fps)}deg) scale(${probe ? 1 : sparkleScale(t, fps)})`,
        overflow: "visible",
      }}
    >
      <path d={STAR_PATH} fill={color} />
    </svg>
  );
};

/**
 * One bullet row: a sparkle and 3-5 words that slide horizontally toward it, 5 frames apart (30 fps).
 * `at` is the first word's start; the sparkle starts STAR.lead (2 frames at 30 fps) earlier. In Arabic the
 * star sits on the right and the words flow left; in Latin the row is mirrored. The font shrinks
 * from `size` to 48 px to fit the row inside the safe band and the render fails below that.
 */
export const Bullet: React.FC<{
  words: readonly string[];
  at: number;
  y: number;
  size?: number;
  dir?: Dir;
  starX?: number;
  weight?: number;
}> = ({ words, at, y, size = SIZE.bullet, dir = "rtl", starX, weight = WEIGHT.lead }) => {
  const family = useGlideFont();
  const { fps } = useVideoConfig();
  const star = starX ?? (dir === "rtl" ? BULLET.starRtl : BULLET.starLtr);
  const textEdge = dir === "rtl" ? star - STAR.size / 2 - STAR.gapToText : star + STAR.size / 2 + STAR.gapToText;
  const safe = safeWidthFor(y, size * LINE_HEIGHT, "organic");
  const room = dir === "rtl" ? textEdge - safe.left : safe.right - textEdge;
  const floor = Math.min(BULLET.min, size);
  const fitted = largestFit((s) => rowWidth(words, { family, size: s, weight }), room, floor, size);
  if (!fitted.fits) {
    throw new Error(
      `grid-glide: the bullet ${JSON.stringify(words.join(" "))} needs ${Math.ceil(fitted.width)}px at ${floor}px but only ${room}px are free beside the star. Shorten it.`,
    );
  }
  const px = fitted.size;
  const starts = startFrames(words.length, at, CADENCE.bullet, fps);
  const slide = dir === "rtl" ? -bulletSlide(px) : bulletSlide(px);
  return (
    <>
      <Sparkle cx={star} cy={y + (px * LINE_HEIGHT) / 2} at={at - scale(STAR.lead, fps)} />
      <div
        data-glide="bullet-row"
        style={{
          position: "absolute",
          top: y,
          height: px * LINE_HEIGHT,
          ...(dir === "rtl" ? { right: FRAME.width - textEdge, left: 40 } : { left: textEdge, right: 40 }),
          display: "flex",
          alignItems: "baseline",
          columnGap: px * GAP,
          direction: dir,
          lineHeight: LINE_HEIGHT,
        }}
      >
        <WordRow
          words={words}
          dir={dir}
          gap={px * GAP}
          render={(word, index) => (
            <Word key={index} text={word} start={starts[index]} size={px} weight={weight} slideX={slide} />
          )}
        />
      </div>
    </>
  );
};

/* ---------------------------------------------------------- scene frame and dressing */

/** Faint centred text near the bottom edge. It never moves with the scene (a dip does blur it). */
export const Watermark: React.FC<{ text: string }> = ({ text }) => {
  const family = useGlideFont();
  const room = FRAME.width - 2 * 65;
  const fitted = largestFit(
    (size) => textWidth(text, { family, size, weight: WATERMARK.weight, tracking: latinTracking(text, WATERMARK.tracking) }),
    room,
    WATERMARK.min,
    WATERMARK.size,
  );
  if (!fitted.fits) {
    throw new Error(
      `grid-glide: the watermark ${JSON.stringify(text)} needs ${Math.ceil(fitted.width)}px at ${WATERMARK.min}px but only ${room}px are free. Shorten the watermark.`,
    );
  }
  return (
    <SafeExempt>
      <div
        data-glide="watermark"
        style={{
          ...textBase(family),
          position: "absolute",
          left: 0,
          width: FRAME.width,
          top: WATERMARK.y,
          textAlign: "center",
          fontSize: fitted.size,
          fontWeight: WATERMARK.weight,
          letterSpacing: latinTracking(text, WATERMARK.tracking),
          lineHeight: 1,
          color: COLOR.watermark,
          unicodeBidi: "plaintext",
        }}
      >
        {text}
      </div>
    </SafeExempt>
  );
};

const VIGNETTE_BACKGROUND = `radial-gradient(circle farthest-corner at 50% 50%, rgba(0,0,0,0) 12.4%, ${COLOR.vignette} 100%)`;

/** Black corner vignette of a dip. `boundary` is the first frame of the incoming scene, in this scene's frames. */
export const Vignette: React.FC<{ boundary: number }> = ({ boundary }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = vignetteOpacity(frame, boundary, fps);
  if (opacity <= 0) return null;
  return (
    <SafeExempt>
      <AbsoluteFill data-glide="vignette" style={{ background: VIGNETTE_BACKGROUND, opacity }} />
    </SafeExempt>
  );
};

/** Dashed hook grid with a dot at every crossing, generated from a spacing and centred on the canvas. */
export const GlideGrid: React.FC<{ spacing?: number }> = ({ spacing = GRID.spacing }) => {
  const g = gridGeometry(spacing);
  return (
    <SafeExempt>
      <svg data-glide="grid" width={FRAME.width} height={FRAME.height} style={{ position: "absolute", left: 0, top: 0 }}>
        {g.xs.map((x) => (
          <line key={`v${x}`} x1={x} x2={x} y1={g.y0} y2={g.y1} stroke={COLOR.grid} strokeWidth={GRID.stroke} strokeDasharray={GRID.dashV} />
        ))}
        {g.ys.map((y) => (
          <line key={`h${y}`} x1={g.x0} x2={g.x1} y1={y} y2={y} stroke={COLOR.grid} strokeWidth={GRID.stroke} strokeDasharray={GRID.dashH} />
        ))}
        {g.xs.flatMap((x) => g.ys.map((y) => <circle key={`d${x}-${y}`} cx={x} cy={y} r={GRID.dot} fill={COLOR.grid} />))}
      </svg>
    </SafeExempt>
  );
};

const AT_REST = { dx: 0, dy: 0, blur: 0 } as const;

/**
 * Wraps one scene. `enter` and `exit` come straight from the scene data. The moving layer holds
 * only the children; the watermark and grid sit behind it and the vignette in front, so a push
 * moves the content but not the dressing. A dip blurs everything except the vignette.
 * `durationInFrames` is the scene length (useVideoConfig() reports the whole composition, and the frame rate
 * the push, slide and dip counts are scaled to).
 * The canvas colour is painted by the caller. Pass `fontFamily` to honour the creator's font choice.
 */
export const SceneMotion: React.FC<{
  durationInFrames: number;
  enter: EnterSpec;
  exit: ExitSpec;
  watermark?: string;
  grid?: boolean;
  fontFamily?: string;
  children?: React.ReactNode;
}> = ({ durationInFrames, enter, exit, watermark, grid = false, fontFamily, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const probe = useProbe();
  const state = probe ? AT_REST : sceneMotionState(frame, durationInFrames, enter, exit, fps);
  const body = (
    <>
      <AbsoluteFill data-glide="dip-layer" style={{ filter: state.blur > 0 ? `blur(${state.blur}px)` : undefined }}>
        {grid ? <GlideGrid /> : null}
        {watermark ? <Watermark text={watermark} /> : null}
        <AbsoluteFill
          data-glide="moving-layer"
          style={{ transform: state.dx !== 0 || state.dy !== 0 ? `translate(${state.dx}px, ${state.dy}px)` : undefined }}
        >
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
      {enter.kind === "dip" ? <Vignette boundary={0} /> : null}
      {exit.kind === "dip" ? <Vignette boundary={durationInFrames} /> : null}
    </>
  );
  return fontFamily ? <GlideFontProvider family={fontFamily}>{body}</GlideFontProvider> : body;
};
