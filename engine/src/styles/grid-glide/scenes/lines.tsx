import React from 'react';
import {BoxLine, Line, SceneMotion} from './kit';
import {RISE} from './math';
import {layoutGlideLines} from './layout';
import {assertGlideFits} from './fit-guard';
import type {GridGlideScene} from './schema';
import {useSceneTheme} from '../../../creative-kit/chapter-theme';
import {useGlideData} from './use-glide-data';

type LinesScene = Extract<GridGlideScene, {family: 'glide-lines'}>;

export const GlideLinesScene: React.FC<{scene: LinesScene}> = ({scene}) => {
  const data = useGlideData(scene.data), layout = layoutGlideLines(data);
  const fontFamily = useSceneTheme('grid-glide').display;
  if (layout.issues.length) throw new Error(`${scene.id}: ${layout.issues.join('; ')}`);
  layout.lines.forEach((line, index) => assertGlideFits(`${scene.id} line ${index + 1}`, line.words.join(' '), {...line, family: fontFamily}));
  return <div data-glide-scene="glide-lines" style={{position: 'absolute', inset: 0}}>
    <SceneMotion enter={data.enter} exit={data.exit} durationInFrames={scene.durationInFrames} watermark={data.watermark} grid={data.grid} fontFamily={fontFamily}>
      {layout.lines.map((line, index) => <Line key={`line-${index}`} y={line.y} x={line.x} width={line.width} words={line.words} at={line.at}
        cadence={line.cadence} size={line.size} weight={line.weight} rise={RISE.stack} dir={line.dir}/>)}
      {data.box && layout.box ? <BoxLine y={layout.box.y} text={data.box.text} at={data.box.at} dir={layout.box.dir}/> : null}
    </SceneMotion>
  </div>;
};
