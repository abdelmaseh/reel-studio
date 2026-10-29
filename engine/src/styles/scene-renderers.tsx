import {Verdict} from './magazine-interview/designs/verdict';
import {ClaimProof} from './calligraphic-receipts/designs/claim-proof';
import type {FamilyDesignProps} from './family-designs';
import React from 'react';
import {styleSceneSchema, type StyleScene} from './scenes.ts';
import {ownSceneStyle} from './registry.ts';
import {GlideChapterScene} from './grid-glide/scenes/chapter';
import {GlideCardScene} from './grid-glide/scenes/card';
import {GlideLinesScene} from './grid-glide/scenes/lines';
import {GlideCommentScene, GlideFollowScene} from './grid-glide/scenes/ending';
import {OneShotSceneView} from './one-shot/scenes/scene';
import type {MouthTable, WordLike} from './cartoon/scenes/math.ts';
import {CartoonSceneView} from './cartoon/scenes/scene';
import {CartoonEndingView} from './cartoon/scenes/ending';
import {MapRouteSceneView} from './documentary/scenes/map-route';
import {MapFocusSceneView} from './documentary/scenes/map-focus';
import {CutoutCardSceneView} from './documentary/scenes/cutout-card';
import {LayeredSceneView} from './layered-speaker/scenes/scene';
import type {WindowGeo} from '../core/plate';
import type {HeadBoxPx} from '../creative-kit/head-clear.ts';

/** Renders a style-owned scene family. It refuses to draw under a style that does not own the family.
 * Cartoon scenes read the compiled edit words (their times are word anchors); the others ignore them.
 * Layered-speaker scenes also read where the speaker's picture sits (geometry, aspect) and the head box, to layer words around the person. */
export const StyleSceneRenderer: React.FC<{scene: StyleScene; style: string; words?: readonly WordLike[]; mouth?: MouthTable; geometry?: WindowGeo; aspect?: number; headBox?: HeadBoxPx | null; standIn?: React.ReactNode}> = ({scene: input, style, words = [], mouth, geometry, aspect, headBox, standIn}) => {
  const scene = styleSceneSchema.parse(input);
  const owner = ownSceneStyle(scene.family);
  if (owner !== style) throw new Error(`${scene.id}: ${scene.family} belongs to ${owner ?? 'no style'}, not ${style}`);
  switch (scene.family) {
    case 'claim-proof': return <ClaimProof scene={scene}/>;
    case 'verdict': return <Verdict scene={scene} style={style as FamilyDesignProps['style']} geometry={geometry ?? {windowTop:1080,windowHeight:840,videoWidth:1080,videoLeft:0,videoTop:0}} aspect={aspect ?? 16/9} seam={1080} headBox={headBox}/>;
    case 'map-route': return <MapRouteSceneView scene={scene}/>;
    case 'map-focus': return <MapFocusSceneView scene={scene}/>;
    case 'cutout-card': return <CutoutCardSceneView scene={scene}/>;
    case 'glide-chapter': return <GlideChapterScene scene={scene}/>;
    case 'glide-card': return <GlideCardScene scene={scene}/>;
    case 'glide-lines': return <GlideLinesScene scene={scene}/>;
    case 'glide-comment': return <GlideCommentScene scene={scene}/>;
    case 'glide-follow': return <GlideFollowScene scene={scene}/>;
    case 'one-shot': return <OneShotSceneView scene={scene}/>;
    case 'cartoon': return <CartoonSceneView scene={scene} words={words} mouth={mouth}/>;
    case 'cartoon-ending': return <CartoonEndingView scene={scene} words={words} mouth={mouth}/>;
    case 'layered-speaker': return <LayeredSceneView scene={scene} style={style} geometry={geometry} aspect={aspect} headBox={headBox} standIn={standIn}/>;
    default: {
      // A new family without a renderer is a type error here, and a thrown error instead of an empty scene at runtime.
      const unhandled: never = scene;
      throw new Error(`no renderer for the style scene family ${(unhandled as {family?: string}).family}`);
    }
  }
};
