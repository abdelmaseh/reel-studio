import {InkSlab,inkSlabPictureMasks} from '../core/transitions-v4/ink-slab';
import {MagazineFlip,magazinePictureMasks} from '../core/transitions-v4/magazine-flip';
import {LensZoom,lensZoomPictureMasks} from '../core/transitions-v4/lens-zoom';
import type {PictureMasks} from '../core/transitions-v4/picture-mask';
import {PaperPull} from '../core/transitions-v4/paper-pull';
import {PaperSwap} from '../core/transitions-v4/paper-swap';
import {liquidGlassExitLens} from '../styles/liquid-glass/designs';
import type {LensState} from '../styles/liquid-glass/designs/kit';
import type {FamilyDesignProps} from '../styles/family-designs';
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Whiteout,LightLeak,FlashBloom,FilmBurn} from '../core/transitions';
import {WhipPan,LightScan} from '../core/transitions-dir';
import {ClipReveal} from '../core/mask';
import {ChapterCrossfade} from '../creative-kit/chapter-theme';
import type {ChapterPalette} from '../core/chapters';
import {TRANSITION_RULES,type TransitionEntry,type TransitionKind,type Box} from './graphics-transitions';
import {Iris} from '../core/transitions-v4/iris';
import {Keyhole} from '../core/transitions-v4/keyhole';
import {Blinds} from '../core/transitions-v4/blinds';
import {DotZoom} from '../core/transitions-v4/dot-zoom';
import {ZoomThrough} from '../core/transitions-v4/zoom-through';
import {PaperTear} from '../core/transitions-v4/paper-tear';
import {PageTurn} from '../core/transitions-v4/page-turn';
import {PenDotCurtain} from '../core/transitions-v4/pen-dot-curtain';
import {PixelCurtain} from '../core/transitions-v4/pixel-curtain';

export type TransitionProps=Omit<TransitionEntry,'kind'>&{fps:number;box?:Box;from?:ChapterPalette;to?:ChapterPalette;height?:number;paper?:string;ink?:string;outgoing?:React.ReactNode;outgoingLens?:LensState;outgoingHeight?:number;timingManaged?:boolean;children?:React.ReactNode};
const White:React.FC<TransitionProps>=p=><Whiteout at={p.atFrame/p.fps} dur={p.durationInFrames/p.fps}/>;
const Leak:React.FC<TransitionProps>=p=><LightLeak at={p.atFrame/p.fps} dur={p.durationInFrames/p.fps}/>;
const Bloom:React.FC<TransitionProps>=p=><FlashBloom at={p.atFrame/p.fps} decaySec={p.durationInFrames/p.fps}/>;
const Burn:React.FC<TransitionProps>=p=><FilmBurn at={p.atFrame/p.fps} dur={p.durationInFrames/p.fps}/>;
const Whip:React.FC<TransitionProps>=p=><WhipPan dir={p.dir??'rtl'} at={p.atFrame} durF={p.durationInFrames} mode="in" box={p.box}>{p.children}</WhipPan>;
const Wipe:React.FC<TransitionProps>=p=><ClipReveal dir={p.dir??'rtl'} shape={p.shape} origin={p.origin} at={p.atFrame} durF={p.durationInFrames} mode="in" box={p.box}>{p.children}</ClipReveal>;
const Scan:React.FC<TransitionProps>=p=><>{p.children}<LightScan bounds={p.box??{x:0,y:0,width:1080,height:1920}} at={p.atFrame} durF={p.durationInFrames} dir={p.dir??'rtl'}/></>;
const Hue:React.FC<TransitionProps>=p=><>{p.from&&p.to?<ChapterCrossfade from={p.from} to={p.to} atFrame={p.atFrame} durF={p.durationInFrames} height={p.height}/>:null}{p.children}</>;
// Adapters bind the common incoming/outgoing contract to each original drawing.
const Pull:React.FC<TransitionProps>=p=><>{p.children}<PaperPull {...p}>{p.outgoing}</PaperPull></>;
const Flip:React.FC<TransitionProps>=p=>{
  const frame=useCurrentFrame();
  return <><div data-magazine-incoming="" style={{position:'absolute',inset:0,clipPath:magazinePictureMasks(frame-p.atFrame,p.durationInFrames,p.box?.width).incoming}}>{p.children}</div><MagazineFlip {...p}>{p.outgoing}</MagazineFlip></>;
};
type Registration=(typeof TRANSITION_RULES)[TransitionKind]&{Component:React.FC<TransitionProps>;pictureMasks?:(props:TransitionProps,local:number)=>PictureMasks;outgoingProps?:(props:FamilyDesignProps & {font?:string})=>Partial<TransitionProps>};
export const TRANSITIONS:Record<TransitionKind,Registration>={
  'ink-slab':{...TRANSITION_RULES['ink-slab'],Component:InkSlab,pictureMasks:(p,f)=>inkSlabPictureMasks(f,p.durationInFrames,p.box?.width)},
  'magazine-flip':{...TRANSITION_RULES['magazine-flip'],Component:Flip,pictureMasks:(p,f)=>magazinePictureMasks(f,p.durationInFrames,p.box?.width),outgoingProps:({scene,seam})=>({outgoingHeight:scene.layout==='split'?seam:1920})},
  'lens-zoom':{...TRANSITION_RULES['lens-zoom'],Component:LensZoom,pictureMasks:(p,f)=>lensZoomPictureMasks(f,p.durationInFrames,p.outgoingLens!,p.box?.width,p.box?.height),outgoingProps:props=>({outgoingLens:liquidGlassExitLens(props)})},
  'paper-pull':{...TRANSITION_RULES['paper-pull'],Component:Pull},
  'paper-swap':{...TRANSITION_RULES['paper-swap'],Component:PaperSwap},
  whiteout:{...TRANSITION_RULES.whiteout,Component:White},
  leak:{...TRANSITION_RULES.leak,Component:Leak},
  bloom:{...TRANSITION_RULES.bloom,Component:Bloom},
  burn:{...TRANSITION_RULES.burn,Component:Burn},
  'whip-pan':{...TRANSITION_RULES['whip-pan'],Component:Whip},
  'clip-wipe':{...TRANSITION_RULES['clip-wipe'],Component:Wipe},
  'light-scan':{...TRANSITION_RULES['light-scan'],Component:Scan},
  'hue-crossfade':{...TRANSITION_RULES['hue-crossfade'],Component:Hue},
  iris:{...TRANSITION_RULES.iris,Component:Iris},keyhole:{...TRANSITION_RULES.keyhole,Component:Keyhole},
  blinds:{...TRANSITION_RULES.blinds,Component:Blinds},'dot-zoom':{...TRANSITION_RULES['dot-zoom'],Component:DotZoom},
  'zoom-through':{...TRANSITION_RULES['zoom-through'],Component:ZoomThrough},
  'paper-tear':{...TRANSITION_RULES['paper-tear'],Component:PaperTear},
  'page-turn':{...TRANSITION_RULES['page-turn'],Component:PageTurn},
  'pen-dot-curtain':{...TRANSITION_RULES['pen-dot-curtain'],Component:PenDotCurtain},
  'pixel-curtain':{...TRANSITION_RULES['pixel-curtain'],Component:PixelCurtain},
};
