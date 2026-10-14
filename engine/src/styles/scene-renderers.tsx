import React from 'react';
import {styleSceneSchema, type StyleScene} from './scenes.ts';
import {ownSceneStyle} from './registry.ts';
import {GlideChapterScene} from './grid-glide/scenes/chapter';
import {GlideCardScene} from './grid-glide/scenes/card';
import {GlideLinesScene} from './grid-glide/scenes/lines';
import {GlideCommentScene, GlideFollowScene} from './grid-glide/scenes/ending';

/** Renders a style-owned scene family. It refuses to draw under a style that does not own the family. */
export const StyleSceneRenderer: React.FC<{scene: StyleScene; style: string}> = ({scene: input, style}) => {
  const scene = styleSceneSchema.parse(input);
  const owner = ownSceneStyle(scene.family);
  if (owner !== style) throw new Error(`${scene.id}: ${scene.family} belongs to ${owner ?? 'no style'}, not ${style}`);
  switch (scene.family) {
    case 'glide-chapter': return <GlideChapterScene scene={scene}/>;
    case 'glide-card': return <GlideCardScene scene={scene}/>;
    case 'glide-lines': return <GlideLinesScene scene={scene}/>;
    case 'glide-comment': return <GlideCommentScene scene={scene}/>;
    case 'glide-follow': return <GlideFollowScene scene={scene}/>;
    default: {
      // A new family without a renderer is a type error here, and a thrown error instead of an empty scene at runtime.
      const unhandled: never = scene;
      throw new Error(`no renderer for the style scene family ${(unhandled as {family?: string}).family}`);
    }
  }
};
