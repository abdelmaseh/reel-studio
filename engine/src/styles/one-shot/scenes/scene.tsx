// The one-shot scene: one take through the worlds of a chain. This file is the camera. It decides which world is on
// screen at scene time t, draws the bridge between two worlds (a button that swallows the screen, a circle that opens
// the next world, a card that becomes the reel, a pull back to the desk, a swipe, a dive back into the first frame)
// and adds motion blur while the camera moves fast. The numbers come from ./math; the pages from ./worlds.
import React from 'react';
import {CameraMotionBlur} from '@remotion/motion-blur';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {useProbe} from '../../../core/safe';
import {useSceneTheme} from '../../../creative-kit/chapter-theme';
import {useDigits} from '../../../creative-kit/digits';
import {EASE, H, Cursor, Ring, W, colorsOf, focus, fontsOf, lerp, prog, type Ctx} from './kit';
import {blurWindows, introLayout, oneShotTimeline, type Block, type DigitSet, type FinaleTimes, type Timeline} from './math.ts';
import {localizeOneShotData} from './digits.ts';
import type {OneShotData, OneShotScene, OneShotStep} from './schema';
import {AskWorld, ClosingWorld, DOT, FinaleWorld, IntroWorld, PHC, ReelPreview, SEND, SPH, StatWorld, ToggleWorld, sendCursorAt, toggleAnchor} from './worlds';

type Step<K extends OneShotStep['kind']> = Extract<OneShotStep, {kind: K}>;
const box: React.CSSProperties = {position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0'};

const dropItem = (data: OneShotData): string | undefined => (data.steps.find((step) => step.kind === 'drop') as Step<'drop'> | undefined)?.item;

/** The world of one block, drawn at the time in `ctx`. */
const BlockWorld: React.FC<{block: Block; ctx: Ctx; data: OneShotData; cursorOn?: boolean; hideTitles?: boolean; probe?: string | null}> = ({block, ctx, data, cursorOn = true, hideTitles = false, probe = null}) => {
  const steps = data.steps;
  if (block.kind === 'ask') {
    const drop = block.hasDrop ? (steps[block.index] as Step<'drop'>) : undefined;
    const field = steps[block.index + (block.hasDrop ? 1 : 0)] as Step<'field'>;
    return <AskWorld ctx={ctx} b={block} drop={drop} field={field} cursorOn={cursorOn} probe={probe} />;
  }
  if (block.kind === 'toggle') return <ToggleWorld ctx={ctx} b={block} step={steps[block.index] as Step<'toggle'>} cursorOn={cursorOn} probe={probe} />;
  if (block.kind === 'stat') return <StatWorld ctx={ctx} b={block} step={steps[block.index] as Step<'stat'>} probe={probe} />;
  const work = block.index >= 0 ? (steps[block.index] as Step<'work'>) : undefined;
  return <FinaleWorld ctx={ctx} b={block} work={work} file={work?.file ?? dropItem(data)} words={data.result.words} hideTitles={hideTitles} probe={probe} />;
};

/** Where the circle opens from when a block hands over to the next one, and the time it takes. */
const exitOf = (block: Exclude<Block, FinaleTimes>, data: OneShotData): {x: number; y: number; r: number} => {
  if (block.kind === 'ask') return SEND;
  if (block.kind === 'toggle') return toggleAnchor(data.steps[block.index] as Step<'toggle'>);
  return DOT;
};
const irisRadius = (t: number, a: [number, number], anchor: {x: number; y: number; r: number}): number => {
  const rMax = Math.hypot(Math.max(anchor.x, W - anchor.x), Math.max(anchor.y, H - anchor.y)) + 24;
  return anchor.r * Math.pow(rMax / anchor.r, EASE.soft(prog(t, a[0], a[1])));
};

const Stage: React.FC<{data: OneShotData; tl: Timeline; digits: DigitSet}> = ({data, tl, digits}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const theme = useSceneTheme('one-shot');
  const probe = useProbe();
  const t = Math.min(frame / fps, tl.total);
  const ctx: Ctx = {t, c: colorsOf(theme, data.accent), f: fontsOf(theme), digits};
  const {intro, blocks, closing} = tl;
  const fin = blocks[blocks.length - 1] as FinaleTimes;
  const layout = introLayout(data.steps.length);

  // The first and the last frame are the same home page.
  if (t >= closing.holdFrom) return <IntroWorld ctx={{...ctx, t: 0}} data={data} live={false} clickAt={intro.clickAt} probe={probe} />;
  if (t < intro.end - 0.04) {
    // Before the zoom starts the page is drawn as it is on the last frame, so the first frame and the last frame are the same markup.
    if (t < intro.swallow[0] || probe) return <IntroWorld ctx={ctx} data={data} live={!probe} clickAt={intro.clickAt} probe={probe} />;
    const s = Math.exp(Math.log(48) * EASE.expoIn(prog(t, intro.swallow[0], intro.swallow[1])));
    const my = lerp(layout.pillY, 960, EASE.inOut(prog(t, intro.swallow[0], intro.swallow[0] + 0.58)));
    return <div style={{...box, transform: `translate(540px, ${my}px) scale(${s}) translate(-540px, ${-layout.pillY}px)`}}>
      <IntroWorld ctx={ctx} data={data} live clickAt={intro.clickAt} />
    </div>;
  }
  if (t < fin.hero) {
    let k = 0;
    blocks.forEach((block, index) => { if (block.start <= t) k = index; });
    const block = blocks[k], previous = blocks[k - 1];
    if (previous && previous.kind !== 'finale' && t < previous.end && !probe) {
      const anchor = exitOf(previous, data);
      const radius = irisRadius(t, [previous.iris[0], previous.iris[1]], anchor);
      const cursor: [number, number] | null = previous.kind === 'ask' ? sendCursorAt(t, previous) : previous.kind === 'toggle' ? [anchor.x + 6, anchor.y + 8] : null;
      const pressAt = previous.kind === 'ask' ? previous.click : previous.kind === 'toggle' ? previous.presses[previous.presses.length - 1] : -1;
      const press = t >= pressAt && t < pressAt + 0.14;
      return <>
        <BlockWorld block={previous} ctx={ctx} data={data} cursorOn={false} />
        <div style={{...box, clipPath: `circle(${radius}px at ${anchor.x}px ${anchor.y}px)`}}><BlockWorld block={block} ctx={ctx} data={data} /></div>
        {cursor && t < previous.iris[0] + 0.65 ? <div style={box}>
          <Ring x={cursor[0]} y={cursor[1]} t={t} t0={pressAt} color={ctx.c.ink} />
          <Cursor x={cursor[0]} y={cursor[1]} press={press} opacity={1 - prog(t, previous.iris[0] + 0.35, previous.iris[0] + 0.6)} ink={ctx.c.ink} />
        </div> : null}
      </>;
    }
    if (block.kind === 'finale' && !probe) {
      const e = 1 - EASE.expoInOut(prog(t, block.dive[0], block.dive[1]));
      return <div style={{...box, transform: focus(e, 540, 960, 2)}}><BlockWorld block={block} ctx={ctx} data={data} /></div>;
    }
    return <BlockWorld block={block} ctx={ctx} data={data} probe={probe} />;
  }
  if (t < closing.pull[0] && !probe) {
    return <ReelPreview ctx={ctx} words={data.result.words} karaoke={fin.karaoke} />;
  }
  let e = 1;
  if (!probe) {
    if (t < closing.pull[1]) e = EASE.pull(prog(t, closing.pull[0], closing.pull[1]));
    else if (t >= closing.loop[0]) e = 1 - EASE.expoIn(prog(t, closing.loop[0], closing.loop[1]));
  }
  const last = fin.hasWork ? fin : (blocks[blocks.length - 2] as Exclude<Block, FinaleTimes>);
  const restAt = fin.hasWork ? fin.dones[fin.dones.length - 1] + 0.2 : (last as Exclude<Block, FinaleTimes>).iris[0] - 0.05;
  const laptop = <BlockWorld block={last} ctx={{...ctx, t: restAt}} data={data} cursorOn={false} hideTitles probe={probe} />;
  return <div style={{...box, transform: probe ? undefined : focus(e, PHC.x, PHC.y, SPH)}}>
    <ClosingWorld ctx={ctx} data={data} closing={closing} laptop={laptop} reel={{words: data.result.words, karaoke: fin.karaoke}} e={e} probe={probe} />
  </div>;
};

export const OneShotSceneView: React.FC<{scene: OneShotScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const probe = useProbe();
  // The video's digits choice reaches every number and every copy line; without a choice the style keeps its Arabic-Indic numbering.
  const choice = useDigits();
  const data = React.useMemo(() => localizeOneShotData(scene.data, choice), [scene.data, choice]);
  const tl = React.useMemo(() => oneShotTimeline(data), [data]);
  const t = frame / fps;
  const blurring = !probe && blurWindows(tl).some(([a, b]) => t >= a && t <= b);
  const stage = <Stage data={data} tl={tl} digits={choice ?? 'arabic-indic'} />;
  return <div data-one-shot="one-shot" style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
    {blurring ? <CameraMotionBlur shutterAngle={180} samples={6}>{stage}</CameraMotionBlur> : stage}
  </div>;
};

