import React from "react";
import { Lottie, type LottieAnimationData } from "@remotion/lottie";
import { Sequence, cancelRender, continueRender, delayRender, staticFile, useVideoConfig } from "remotion";
import { normalizeLottie } from "./lottie-data.ts";
import { useProbe } from "./safe";

export type LottieIconProps = {
  /** Path below engine/public, as staticFile() takes it, e.g. "stickers/icons/checkmark.json". */
  src: string;
  /** Frame (of the enclosing sequence) the animation starts at. Nothing is drawn before it. Default 0. */
  frameOffset?: number;
  /** Repeat after the last frame. Default false: the animation plays once and holds its last frame. */
  loop?: boolean;
  /** Playback speed, 1 = the file's own. Default 1. */
  playbackRate?: number;
  /** Edge of the square box in px; the animation is fitted inside it (aspect kept). Default 160. */
  size?: number;
  /**
   * An icon beside the text is decoration: under the safe-zone probe it draws nothing. Set false for an icon that carries meaning
   * on its own, so the probe sees it and the safe-zone check covers it. Default true.
   */
  decoration?: boolean;
  style?: React.CSSProperties;
};

/**
 * Remotion's Lottie advances one file frame per video frame, whatever the file's own rate. Scaling by file fps / video fps plays a 60 fps
 * file at its real speed in a 30 fps video (and a 30 fps file in a 60 fps one).
 */
export const lottieRate = (playbackRate: number, fileFps: number, videoFps: number): number => playbackRate * (fileFps / videoFps);

const loaded = new Map<string, LottieAnimationData>();
const loading = new Map<string, Promise<LottieAnimationData>>();

/** Fetches and checks one Lottie file from engine/public, once per file for the whole render. */
export const loadLottieFile = (src: string): Promise<LottieAnimationData> => {
  const pending = loading.get(src);
  if (pending) return pending;
  const request = fetch(staticFile(src))
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `LottieIcon: ${src} answered ${response.status}. The sticker files are installed with the studio; see third-party/icons/README.md and third-party/emoji/README.md.`,
        );
      }
      const animation = normalizeLottie(await response.json(), src) as LottieAnimationData;
      loaded.set(src, animation);
      return animation;
    })
    .catch((error) => {
      loading.delete(src);
      throw error;
    });
  loading.set(src, request);
  return request;
};

/**
 * A Lottie animation in a fixed square box. The frame waits (delayRender) until the file is loaded, so a render never shows an empty box.
 * Frames are a pure function of the file and the clock; there is no wall-clock time.
 */
export const LottieIcon: React.FC<LottieIconProps> = ({
  src,
  frameOffset = 0,
  loop = false,
  playbackRate = 1,
  size = 160,
  decoration = true,
  style,
}) => {
  const probe = useProbe();
  const { fps } = useVideoConfig();
  const skip = decoration && probe !== null;
  const [data, setData] = React.useState<LottieAnimationData | null>(() => loaded.get(src) ?? null);
  const [handle] = React.useState<number | null>(() => (skip || loaded.has(src) ? null : delayRender(`LottieIcon: loading ${src}`)));
  const released = React.useRef(false);

  React.useEffect(() => {
    const release = () => {
      if (handle !== null && !released.current) {
        released.current = true;
        continueRender(handle);
      }
    };
    if (skip) return undefined;
    const ready = loaded.get(src);
    if (ready) {
      setData(ready);
      release();
      return undefined;
    }
    let live = true;
    loadLottieFile(src).then(
      (animation) => {
        if (!live) return;
        setData(animation);
        release();
      },
      (error) => cancelRender(error),
    );
    return () => {
      live = false;
      release();
    };
  }, [src, skip, handle]);

  if (skip) return null;
  return (
    <div data-lottie-icon={src} style={{ width: size, height: size, ...style }}>
      {data ? (
        <Sequence from={frameOffset} layout="none">
          <Lottie
            animationData={data}
            loop={loop}
            playbackRate={lottieRate(playbackRate, (data as { fr: number }).fr, fps)}
            preserveAspectRatio="xMidYMid meet"
            style={{ width: "100%", height: "100%" }}
          />
        </Sequence>
      ) : null}
    </div>
  );
};
