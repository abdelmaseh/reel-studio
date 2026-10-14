import React from 'react';
import {BoxLine, Bullet, Card, CardMedia, Line, SceneMotion} from './kit';
import {RISE, SIZE} from './math';
import {WEIGHT, layoutGlideCard} from './layout';
import {assertGlideFits} from './fit-guard';
import type {GridGlideScene} from './schema';
import {useSceneTheme} from '../../../creative-kit/chapter-theme';

type CardScene = Extract<GridGlideScene, {family: 'glide-card'}>;

export const GlideCardScene: React.FC<{scene: CardScene}> = ({scene}) => {
  const {data} = scene, layout = layoutGlideCard(data);
  const fontFamily = useSceneTheme('grid-glide').display;
  if (layout.issues.length) throw new Error(`${scene.id}: ${layout.issues.join('; ')}`);
  layout.lines.forEach((line, index) => assertGlideFits(`${scene.id} line ${index + 1}`, line.words.join(' '), {...line, family: fontFamily}));
  return <div data-glide-scene="glide-card" style={{position: 'absolute', inset: 0}}>
    <SceneMotion enter={data.enter} exit={data.exit} durationInFrames={scene.durationInFrames} watermark={data.watermark} fontFamily={fontFamily}>
      <Card x={layout.card.x} y={layout.card.y} w={layout.card.w} h={layout.card.h}>
        <CardMedia clips={data.media.clips} width={layout.card.innerW} height={layout.card.innerH} until={scene.durationInFrames}/>
      </Card>
      {layout.lines.map((line, index) => <Line key={`line-${index}`} y={line.y} x={line.x} width={line.width} words={line.words} at={line.at}
        cadence={line.cadence} size={line.size} weight={line.weight} rise={RISE.caption} dir={line.dir}/>)}
      {data.box && layout.box ? <BoxLine y={layout.box.y} text={data.box.text} at={data.box.at} dir={layout.box.dir}/> : null}
      {layout.bullets.map((bullet, index) => <Bullet key={`bullet-${index}`} y={bullet.y} at={bullet.at} words={bullet.words}
        size={SIZE.bullet} dir={bullet.dir} starX={bullet.starX} weight={WEIGHT.bullet}/>)}
    </SceneMotion>
  </div>;
};
