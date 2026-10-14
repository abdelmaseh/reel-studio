import React from 'react';
import {useVideoConfig} from 'remotion';
import {BoxLine, Line, Pill, SceneMotion, rowWidth} from './kit';
import {RISE, largestFit} from './math';
import {centredRowY, layoutGlideComment, layoutGlideFollow, type EndingRow} from './layout';
import {assertGlideFits} from './fit-guard';
import {glideChapterPillAt, type GridGlideScene} from './schema';
import {useSceneTheme} from '../../../creative-kit/chapter-theme';

type CommentScene = Extract<GridGlideScene, {family: 'glide-comment'}>;
type FollowScene = Extract<GridGlideScene, {family: 'glide-follow'}>;

// The keyword and the handle are the biggest text of their scene. They fit the safe column at the largest size that
// holds, and the render fails (like a box line or a pill label does) when even the smallest size is too wide, so the
// complete word or handle is never clipped.
const fitRow = (id: string, what: string, row: EndingRow, family: string): number => {
  const text = row.words.join(' ');
  const fitted = largestFit((size) => rowWidth(row.words, {family, size, weight: row.weight}), row.width, row.min, row.max);
  if (!fitted.fits) {
    throw new Error(`${id}: the ${what} ${JSON.stringify(text)} needs ${Math.ceil(fitted.width)}px at ${row.min}px but only ${row.width}px are free. Shorten the ${what}.`);
  }
  return fitted.size;
};

const BigRow: React.FC<{row: EndingRow; size: number}> = ({row, size}) => (
  <Line y={centredRowY(row, size)} x={row.x} width={row.width} words={row.words} at={row.at} cadence={row.cadence}
    size={size} weight={row.weight} rise={RISE.stack} dir={row.dir}/>
);

export const GlideCommentScene: React.FC<{scene: CommentScene}> = ({scene}) => {
  const {data} = scene, layout = layoutGlideComment(data);
  const fontFamily = useSceneTheme('grid-glide').display;
  if (layout.issues.length) throw new Error(`${scene.id}: ${layout.issues.join('; ')}`);
  layout.lines.forEach((line, index) => assertGlideFits(`${scene.id} line ${index + 1}`, line.words.join(' '), {...line, family: fontFamily}));
  const size = fitRow(scene.id, 'keyword', layout.keyword, fontFamily);
  return <div data-glide-scene="glide-comment" style={{position: 'absolute', inset: 0}}>
    <SceneMotion enter={data.enter} exit={data.exit} durationInFrames={scene.durationInFrames} watermark={data.watermark} fontFamily={fontFamily}>
      {layout.lines.map((line, index) => <Line key={`line-${index}`} y={line.y} x={line.x} width={line.width} words={line.words} at={line.at}
        cadence={line.cadence} size={line.size} weight={line.weight} rise={RISE.stack} dir={line.dir}/>)}
      <BigRow row={layout.keyword} size={size}/>
      {data.box && layout.box ? <BoxLine y={layout.box.y} text={data.box.text} at={data.box.at} dir={layout.box.dir}/> : null}
    </SceneMotion>
  </div>;
};

export const GlideFollowScene: React.FC<{scene: FollowScene}> = ({scene}) => {
  const {data} = scene, layout = layoutGlideFollow(data);
  const fontFamily = useSceneTheme('grid-glide').display;
  const {fps} = useVideoConfig();
  if (layout.issues.length) throw new Error(`${scene.id}: ${layout.issues.join('; ')}`);
  layout.lines.forEach((line, index) => assertGlideFits(`${scene.id} line ${index + 1}`, line.words.join(' '), {...line, family: fontFamily}));
  const size = fitRow(scene.id, 'handle', layout.handle, fontFamily);
  return <div data-glide-scene="glide-follow" style={{position: 'absolute', inset: 0}}>
    <SceneMotion enter={data.enter} exit={data.exit} durationInFrames={scene.durationInFrames} watermark={data.watermark} fontFamily={fontFamily}>
      {layout.lines.map((line, index) => <Line key={`line-${index}`} y={line.y} x={line.x} width={line.width} words={line.words} at={line.at}
        cadence={line.cadence} size={line.size} weight={line.weight} rise={RISE.stack} dir={line.dir}/>)}
      <BigRow row={layout.handle} size={size}/>
      <Pill y={layout.pill.y} at={glideChapterPillAt(data, fps)} label={data.pill.label}/>
    </SceneMotion>
  </div>;
};
