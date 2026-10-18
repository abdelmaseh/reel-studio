import React from "react";
import { Audio, Sequence } from "remotion";
import { PreparedEdit, type PreparedEditProps } from "../prepared-edit/PreparedEdit";
import type { PreviewSound } from "./shell/preview-sounds.ts";

export type PreviewCompositionProps = PreparedEditProps & { sounds: readonly PreviewSound[] };

/** A sound that cannot load must never take the picture down with it, so its failure renders nothing. */
class SilentBoundary extends React.Component<{ children?: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * What the live editor's Player plays: the unchanged PreparedEdit plus one audio sequence per preview sound. The export never imports this
 * file; it renders PreparedEdit alone and mixes the same effects into `sounds.wav` (render.mjs --sfx).
 */
export const PreviewComposition: React.FC<PreviewCompositionProps> = ({ sounds, ...rest }) => (
  <>
    <PreparedEdit {...rest} />
    {sounds.map((sound) => (
      <Sequence key={sound.key} from={sound.from} durationInFrames={sound.durationInFrames} layout="none">
        <SilentBoundary>
          <Audio src={sound.src} />
        </SilentBoundary>
      </Sequence>
    ))}
  </>
);
