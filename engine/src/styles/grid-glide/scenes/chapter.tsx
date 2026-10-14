import React from 'react';
import {useVideoConfig} from 'remotion';
import {Line, Pill, SceneMotion} from './kit';
import {CADENCE, RISE} from './math';
import {layoutGlideChapter} from './layout';
import {assertGlideFits} from './fit-guard';
import {glideChapterPillAt, type GridGlideScene} from './schema';
import {glideWords} from './text';
import {useSceneTheme} from '../../../creative-kit/chapter-theme';

type ChapterScene = Extract<GridGlideScene, {family: 'glide-chapter'}>;

export const GlideChapterScene: React.FC<{scene: ChapterScene}> = ({scene}) => {
  const {data} = scene, layout = layoutGlideChapter(data);
  const fontFamily = useSceneTheme('grid-glide').display;
  const {fps} = useVideoConfig();
  if (layout.issues.length) throw new Error(`${scene.id}: ${layout.issues.join('; ')}`);
  assertGlideFits(`${scene.id} ordinal`, data.ordinal, {...layout.hero, family: fontFamily});
  return <div data-glide-scene="glide-chapter" style={{position: 'absolute', inset: 0}}>
    <SceneMotion enter={data.enter} exit={data.exit} durationInFrames={scene.durationInFrames} watermark={data.watermark} fontFamily={fontFamily}>
      <Line y={layout.hero.y} x={layout.hero.x} width={layout.hero.width} words={glideWords(data.ordinal)} at={data.heroAt} cadence={CADENCE.stack}
        size={layout.hero.size} weight={layout.hero.weight} rise={RISE.stack} dir={layout.hero.dir}/>
      {layout.pill && data.pill ? <Pill y={layout.pill.y} at={glideChapterPillAt(data, fps)} label={data.pill.label} logo={data.pill.logo?.src}/> : null}
    </SceneMotion>
  </div>;
};
