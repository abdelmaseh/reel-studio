import React from 'react';
import {AbsoluteFill, useCurrentFrame, type CalculateMetadataFunction} from 'remotion';
import {SafeRoot, CanvasFill} from '../core/safe';
import {CreativeFonts, Reveal, getSceneTheme} from '../creative-kit/primitives';
import {getConcept} from '../motion-concepts/registry';
import {IntroScene, ProofScene, ProcessScene, ComparisonScene, CommentGateScene, FollowScene} from '../creative-kit/scenes';
import {KineticSceneRenderer} from '../creative-kit/kinetic/scenes';
import {kineticSceneSchema} from '../creative-kit/kinetic/schema.ts';
import {SemanticSceneRenderer} from '../creative-kit/semantic/scenes';
import {semanticSceneSchema} from '../creative-kit/semantic/schema.ts';
import {LibrarySceneRenderer} from '../motion-library/scenes';
import {librarySceneSchema} from '../motion-library/schema.ts';
import {StyleSceneRenderer} from '../styles/scene-renderers';
import {styleSceneSchema} from '../styles/scenes.ts';
import {PreparedPlateProvider, ScreenRecordingScene} from '../screen-recording/ScreenRecordingScene';
import {screenRecordingSceneSchema} from '../screen-recording/schema.ts';
import {SpokenLine} from '../creative-kit/kinetic-words';
import type {TokenEnter, EmphasisKind} from '../creative-kit/kinetic-words-logic.ts';
import {CaptionTrack} from '../prepared-edit/PreparedEdit';
import type {EditManifest} from '../prepared-edit/schema.ts';
import type {compileEdit} from '../prepared-edit/timeline.ts';
import {emphasisPunch, toCamKeys, type PunchKind} from '../core/camera';
import {useCamBox} from '../core/plate';
import {layoutTransitionState} from '../prepared-edit/footage.ts';
import {Whiteout, LightLeak, FlashBloom, FilmBurn} from '../core/transitions';
import {WhipPan, LightScan} from '../core/transitions-dir';
import {ClipReveal} from '../core/mask';
import {ChapterCrossfade} from '../creative-kit/chapter-theme';
import {getPreviewDefinition, PREVIEW_SCREEN_VIDEO, PREVIEW_SCREEN_SIZE, previewFixtureIssues, previewAuthoredWords} from './fixtures.ts';
import type {LibraryPreviewProps, PreviewDefinition} from './types.ts';

export const calculateLibraryPreviewMetadata: CalculateMetadataFunction<LibraryPreviewProps> = ({props}) => {
  const definition = getPreviewDefinition(props.previewKey);
  const issues = previewFixtureIssues(definition);
  if (issues.length) throw new Error(`${definition.key}: ${issues.join('; ')}`);
  return {width: 1080, height: 1920, fps: definition.fps, durationInFrames: definition.durationInFrames};
};

/** Explanatory copy timed for renderer demonstrations only; never compiled into an edit manifest. */
const authoredWords = previewAuthoredWords();
const fullGeo = {windowTop: 0, windowHeight: 1920, videoWidth: 1080, videoLeft: 0, videoTop: 0};
const splitGeo = {windowTop: 1040, windowHeight: 880, videoWidth: 1080, videoLeft: 0, videoTop: -520};

/** A neutral stage makes the existing effect visible without claiming presenter or footage verification. */
const NeutralGraphics: React.FC<{label?: string; variant?: boolean}> = ({label = 'فكرة واحدة واضحة', variant = false}) => <>
  <div style={{position: 'absolute', left: 100, top: 400, width: 800, height: 850, border: '3px solid #ADC5C9', borderRadius: 28, background: 'linear-gradient(145deg,#173A45,#11242C)', boxSizing: 'border-box'}}>
    <div style={{position: 'absolute', inset: 24, backgroundImage: 'linear-gradient(#C1DDE215 1px,transparent 1px),linear-gradient(90deg,#C1DDE215 1px,transparent 1px)', backgroundSize: '40px 40px'}}/>
    <div style={{position: 'absolute', left: 55, top: 115, width: 685, textAlign: 'center', fontFamily: 'Cairo', fontSize: 58, fontWeight: 800, color: '#F5F2E8', direction: 'rtl'}}>{label}</div>
    <div style={{position: 'absolute', left: 265, top: 345, width: 264, height: 264, borderRadius: variant ? 28 : 132, background: variant ? '#C7E8DD' : '#E2B85F', border: '8px solid #F5F2E8'}}/>
    <div style={{position: 'absolute', left: 120, right: 120, bottom: 75, textAlign: 'center', fontFamily: 'IBM Plex Mono', fontSize: 25, color: '#BDD0D4'}}>AUTHORED GRAPHICS ONLY</div>
  </div>
</>;

const Placeholder: React.FC<{top?: number; height?: number}> = ({top = 1080, height = 840}) => <div style={{position: 'absolute', left: 0, top, width: 1080, height, background: 'repeating-linear-gradient(135deg,#263C46 0px,#263C46 35px,#2B434D 35px,#2B434D 70px)', overflow: 'hidden'}}>
  <div style={{position: 'absolute', left: 120, right: 170, top: Math.min(120, height / 4), color: '#D1DFDF', fontFamily: 'Cairo', fontSize: 31, textAlign: 'center', direction: 'rtl'}}>مساحة محايدة بدل تصوير المتحدث</div>
  <div style={{position: 'absolute', left: 120, right: 170, top: Math.min(180, height / 4 + 60), color: '#9EB4BC', fontFamily: 'IBM Plex Mono', fontSize: 22, textAlign: 'center'}}>ABSTRACT PLACEHOLDER · NO PERSON</div>
</div>;

const CameraDemo: React.FC<{preset: string}> = ({preset}) => {
  const keys = emphasisPunch({kind: preset as PunchKind, atFrame: 60, scale: 1.07, holdFrames: 60, releaseFrames: 6, pushFrames: 30, anchor: {x: .5, y: .45}});
  const box = useCamBox(toCamKeys(keys, 30), 1080, 1920);
  return <AbsoluteFill style={{overflow: 'hidden'}}><div style={{position: 'absolute', width: 1080, height: 1920, left: box.left, top: box.top, transform: `scale(${box.scale})`, transformOrigin: '0 0'}}><NeutralGraphics/></div></AbsoluteFill>;
};

const LayoutDemo: React.FC<{preset: string}> = ({preset}) => {
  const frame = useCurrentFrame();
  const transition = {atFrame: 40, durationInFrames: 45, kind: preset as 'curtain' | 'window-morph', from: 'presenter' as const, to: 'split' as const};
  const state = layoutTransitionState(transition, frame, {presenter: fullGeo, split: splitGeo}, false);
  const geo = state.geo;
  return <>
    <Placeholder top={geo.windowTop} height={geo.windowHeight}/>
    <div style={{position: 'absolute', inset: 0, clipPath: `inset(0 0 ${1920 - state.seamY}px 0)`}}>
      <div style={{position: 'absolute', inset: 0, transform: preset === 'curtain' ? `translateY(${state.contentShift}px)` : undefined, opacity: preset === 'curtain' ? state.upper : 1}}><NeutralGraphics label="مساحة للفكرة"/></div>
    </div>
  </>;
};

const TextDemo: React.FC<{definition: PreviewDefinition}> = ({definition}) => {
  const {layer, preset} = definition.fixture;
  const theme = getSceneTheme(definition.style);
  const words = previewAuthoredWords(layer === 'kinetic-emphasis' && preset === 'latin');
  if (layer === 'caption-emphasis') {
    // Render the actual CaptionTrack against an isolated authored cue, without compileEdit or a fake source manifest.
    const edit = {style: definition.style, scenes: [], captions: {mode: 'words', presentation: 'pill', grouping: 'single', emphasis: [{sourceIndex: 1, kind: preset}]}} as unknown as EditManifest;
    const compiled = {captionGroups: [{fromFrame: 15, toFrame: 165, words: authoredWords}], words: authoredWords} as ReturnType<typeof compileEdit>;
    return <><NeutralGraphics label="تأكيد داخل كارت النص"/><CaptionTrack edit={edit} compiled={compiled} center={1390}/></>;
  }
  return <>
    <div style={{position: 'absolute', left: 100, top: 490, width: 800, height: 600, border: `2px solid ${theme.dim}`, borderRadius: 24}}/>
    <SpokenLine words={words} lang="ar" font={{fontFamily: theme.ar, fontSize: 115, fontWeight: 800}}
      box={{left: 145, top: 670, width: 690}} color={theme.text} accent={theme.accent} maxLines={3} minSize={40}
      enter={layer === 'word-entrance' ? preset as TokenEnter : 'rise'}
      emphasis={layer === 'kinetic-emphasis' ? [{sourceIndex: 1, kind: preset as EmphasisKind}] : []}
      origin={0} untilFrame={180} align="center"/>
  </>;
};

const EffectDemo: React.FC<{definition: PreviewDefinition}> = ({definition}) => {
  const frame = useCurrentFrame();
  const {layer, preset} = definition.fixture;
  if (layer === 'camera') return <CameraDemo preset={preset}/>;
  if (layer === 'layout-transition') return <LayoutDemo preset={preset}/>;
  if (layer.includes('emphasis') || layer === 'word-entrance') return <TextDemo definition={definition}/>;
  if (layer === 'scene-entrance') return <>{[0, 1, 2].map(index => <Reveal key={index} motion={preset} order={index * 5} style={{position: 'absolute', left: 140, top: 460 + index * 245, width: 720, height: 175, background: index === 1 ? '#E2B85F' : '#D8E8E6', borderRadius: 24, color: '#17333D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cairo', fontSize: 48, fontWeight: 800}}>{['فكرة', 'خطوة', 'صورة'][index]}</Reveal>)}</>;
  if (layer === 'overlay') return <><NeutralGraphics/>
    {preset === 'whiteout' ? <Whiteout at={2} dur={.6}/> : preset === 'leak' ? <LightLeak at={2} dur={.75}/> : preset === 'bloom' ? <FlashBloom at={2} decaySec={.6}/> : <FilmBurn at={2} dur={.75}/>}</>;
  const bounds = {x: 0, y: 0, width: 1080, height: 1920};
  if (preset === 'hue-crossfade') return <><ChapterCrossfade from={{ground: '#102027', accent: '#E2B85F', ink: '#FFFFFF', onAccent: '#102027'}} to={{ground: '#F7F3E8', accent: '#1C4E42', ink: '#102027', onAccent: '#FFFFFF'}} atFrame={45} durF={60}/><NeutralGraphics label="لون جديد لنفس الفكرة"/></>;
  const next = <NeutralGraphics label="الفكرة بعد الانتقال" variant/>;
  return <>
    {frame < 45 ? <NeutralGraphics label="الفكرة قبل الانتقال"/> : null}
    {preset === 'whip-pan' ? <WhipPan dir="rtl" at={45} durF={18} mode="in" box={bounds}>{next}</WhipPan>
      : preset === 'clip-wipe' ? <ClipReveal dir="rtl" at={45} durF={30} box={bounds}>{next}</ClipReveal>
      : <>{frame >= 45 ? next : null}<LightScan bounds={bounds} at={45} durF={30} dir="rtl"/></>}
  </>;
};

const SceneDemo: React.FC<{definition: PreviewDefinition}> = ({definition}) => {
  const {fixture, style} = definition;
  const scene = fixture.scene;
  const options = {style, layout: scene?.layout === 'split' ? 'split' as const : 'takeover' as const, motion: scene?.motion, showCaption: false};
  let content: React.ReactNode;
  switch (fixture.kind) {
    case 'concept': {const Component = getConcept(String(fixture.concept)).Component; return <Component style={style} data={fixture.data} mode="once" backdrop="canvas"/>;}
    case 'creative': {
      const components: Record<string, React.ComponentType<any>> = {intro: IntroScene, proof: ProofScene, process: ProcessScene, comparison: ComparisonScene, comment: CommentGateScene, follow: FollowScene};
      const Component = components[scene.family]; content = <Component {...options} data={scene.data}/>; break;
    }
    case 'kinetic': content = <KineticSceneRenderer scene={kineticSceneSchema.parse(scene)} style={style} geometry={splitGeo} aspect={1920 / 1080} seam={1040}/>; break;
    case 'semantic': content = <SemanticSceneRenderer scene={semanticSceneSchema.parse(scene)} style={style} words={scene.family === 'kinetic-text' ? authoredWords : []}/>; break;
    case 'library': content = <LibrarySceneRenderer scene={librarySceneSchema.parse(scene)} style={style} seam={1040}/>; break;
    case 'style-scene': content = <StyleSceneRenderer scene={styleSceneSchema.parse(scene)} style={style} words={fixture.words ?? []}/>; break;
    case 'screen-recording': content = <PreparedPlateProvider plate={{src: PREVIEW_SCREEN_VIDEO, ...PREVIEW_SCREEN_SIZE}}><ScreenRecordingScene scene={screenRecordingSceneSchema.parse(scene)} style={style}/></PreparedPlateProvider>; break;
    case 'effect': return <EffectDemo definition={definition}/>;
    default: return <div style={{position: 'absolute', top: 550, left: 100, right: 150, color: '#FFFFFF', fontFamily: 'Cairo', fontSize: 48, direction: 'rtl'}}>المشهد محتاج حزمة خاصة بالمشروع</div>;
  }
  return <>{scene?.layout === 'presenter' || scene?.layout === 'split' ? <Placeholder/> : null}{content}</>;
};

export const LibraryItemPreview: React.FC<LibraryPreviewProps> = (props) => {
  const definition = getPreviewDefinition(props.previewKey);
  const theme = getSceneTheme(definition.style);
  return <SafeRoot><CreativeFonts>
    <CanvasFill background={theme.background}/>
    <SceneDemo definition={definition}/>
    <div style={{position: 'absolute', top: 125, left: 65, right: 110, fontFamily: 'IBM Plex Mono', fontSize: 21, lineHeight: 1.6, color: '#FFFFFF', background: '#102027DC', border: '1px solid #82999C', borderRadius: 6, padding: '9px 15px'}}>ILLUSTRATION · {definition.key}</div>
    <div style={{position: 'absolute', top: 1710, left: 70, right: 155, fontFamily: 'Cairo', fontSize: 24, lineHeight: 1.6, color: '#FFFFFF', background: '#102027E8', borderRadius: 6, padding: '7px 16px', textAlign: 'center', direction: 'rtl'}}>بيانات توضيحية · معاينة للحركة وليست نتيجة حقيقية</div>
  </CreativeFonts></SafeRoot>;
};
