import React from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { LottieIcon } from "../core/lottie-icon";
import { useProbe } from "../core/safe";
import { MONOCHROME_STICKER_SOURCES, SCENE_STICKER_SPOTS, isLightInk, stickerById, stickerFile, stickerStartFrame, type SceneSticker, type SceneStickerHost, type Sticker } from "./stickers.ts";

export type StickerViewProps = {
  sticker: Sticker;
  /** The frame (of the host element) the sticker is first drawn at. Wins over `sticker.at`, which is in seconds; scene data carries frames, so scene hosts pass this. */
  startFrame?: number;
  /** Draw a black line icon in white, for a dark scene (the useAnimations icons are plain black). Colour icons and emoji ignore it. Default false. */
  onDark?: boolean;
  /** Edge of the square box in px. Default 160. */
  size?: number;
  /** Same meaning as LottieIcon.decoration: decoration draws nothing under the safe-zone probe. Default true. */
  decoration?: boolean;
  style?: React.CSSProperties;
};

/**
 * One sticker from the curated table: a Lottie player for animated icons and animated emoji, an image for emoji stills. It is drawn from
 * its `at` second on (seconds from the start of the host element), or from `startFrame` when the host counts in frames, and nothing before.
 * A name that is not in the table stops the render.
 */
export const StickerView: React.FC<StickerViewProps> = ({ sticker, startFrame, onDark = false, size = 160, decoration = true, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const probe = useProbe();
  const entry = stickerById(sticker.kind, sticker.id);
  if (!entry) throw new Error(`StickerView: unknown ${sticker.kind} sticker "${sticker.id}".`);
  const start = startFrame ?? stickerStartFrame(sticker, fps);
  if (frame < start || (decoration && probe !== null)) return null;
  const file = stickerFile(entry);
  if (entry.format === "lottie") {
    const tone = onDark && MONOCHROME_STICKER_SOURCES.includes(entry.source) ? { filter: "invert(1)" } : null;
    return <LottieIcon key={file} src={file} frameOffset={start} loop={entry.kind === "emoji"} size={size} decoration={decoration} style={{ ...tone, ...style }} />;
  }
  return <Img src={staticFile(file)} style={{ width: size, height: size, objectFit: "contain", ...style }} />;
};

/**
 * The sticker of a figures, chat-thread or arabic-type scene, in the one fixed spot of its family (SCENE_STICKER_SPOTS). It is content that sits
 * next to authored text, not decoration, so the safe-zone probe measures it. It starts on the scene frame `sticker.at` (default 0). Without a
 * sticker it draws nothing, so a scene that has none renders exactly as it did before stickers. `ink` is the scene's text colour: a light ink means a
 * dark scene, where the black useAnimations icons are shown in white.
 */
export const SceneStickerSlot: React.FC<{ host: SceneStickerHost; sticker?: SceneSticker; ink?: string }> = ({ host, sticker, ink }) => {
  if (!sticker) return null;
  const { left, top, size } = SCENE_STICKER_SPOTS[host];
  return (
    <div data-scene-sticker={host} style={{ position: "absolute", left, top, width: size, height: size }}>
      <StickerView sticker={sticker} startFrame={sticker.at ?? 0} onDark={isLightInk(ink)} size={size} decoration={false} />
    </div>
  );
};
