import {displayWeight} from '../../../style-kit/design-safety';
import {useTiming} from '../../../style-kit/design-safety';
// Approved V4 pilot; parsed data and direction adapter.
import React from 'react';
import {useCurrentFrame, Img, staticFile} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {C, BODY, INOUT3, ramp, textW, rectShape, tornShape, fit, Stage, Piece, Tape, Txt, PieceText, RingPiece, DesignProvider, useKit} from './kit';

export const EvidenceWipe: React.FC<FamilyDesignProps> = p => {
  if (p.scene.family !== 'evidence-wipe') return null;
  return <DesignProvider data={p.scene.data} sectionIndex={p.sectionIndex}><EvidenceWipeDrawing d={{title: p.scene.data.title, label: p.scene.data.footer, before: p.scene.data.before, after: p.scene.data.after, dir: p.scene.data.dir,revealFrame:p.scene.data.revealFrame,revealDurationFrames:p.scene.data.revealDurationFrames}}/></DesignProvider>;
};

const EvidenceWipeDrawing: React.FC<{d: {title: string; detail?: string; ringText?: string; label: string; before: {src: string}; after: {src: string}; dir: 'rtl' | 'ltr';revealFrame:number;revealDurationFrames:number}}> = ({d}) => {
  const {HEAD,copy} = useKit();
  const timing=useTiming(),at=timing.frame(d.revealFrame,42),dur=timing.duration(d.revealDurationFrames,26,at);
  const f = useCurrentFrame();
  const CX = 80, CY = 300, CWd = 920, CH = 850;
  const oneLine=fit(d.title,{width:760,size:118,min:64,lines:1,weight:700,family:HEAD});
  const title=oneLine.fits?oneLine:fit(d.title,{width:760,size:64,min:64,lines:2,weight:700,family:HEAD});
  const detail = fit(d.detail ?? '', {width: 700, size: 58, min: 40, lines: 1, weight: 800, family: BODY});
  const lab = fit(d.label, {width: 360, size: 38, min: 28, lines: 1, weight: 700, family: BODY});
  const sx = 36, sy = Math.max(190,90+title.lines.length*title.box), sw = CWd - 72, sh = Math.min(520,CH-sy-80); // the cut-paper screen on the card
  const ring = 1 + 0.06 * Math.max(0, 1 - Math.abs(f - (at+dur+6)) / 6) * (f >= at+dur ? 1 : 0);
  const reveal = ramp(f, at, dur, INOUT3);
  return <Stage offcuts={{family: 'strips', colors: [C.teal, C.mustard, C.terra]}}>
    <Piece id="ev-card" x={CX} y={CY} w={CWd} h={CH} rot={0.9} color={C.card} shape={tornShape('br', 7, 10)} enter={{at: 0, from: [0, 220], dur: 19, rot: 3}} z={2} depth={1}>
      <div style={{position:"absolute",top:76,left:80,right:80,direction:copy.dir,textAlign:copy.align}}>{title.lines.map((line,i)=><div key={i} style={{fontFamily:HEAD,fontWeight:displayWeight(HEAD,'Reem Kufi',700),fontSize:title.size,lineHeight:title.box+"px",whiteSpace:"nowrap"}}>{line}</div>)}</div>
      <Piece id="ev-screen" x={sx} y={sy} w={sw} h={sh} rot={0} color={C.teal} shape={rectShape(0, 1.8, 120)} enter={{at: 14, from: [0, 60], dur: 14, rot: 0}} z={3} depth={0.35}>
        <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
          <Img src={staticFile(d.before.src)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}}/>
          <div data-evidence-reveal={reveal} style={{position: 'absolute', inset: 0, clipPath: d.dir === 'rtl' ? `inset(0 0 0 ${(1 - reveal) * 100}%)` : `inset(0 ${(1 - reveal) * 100}% 0 0)`}}>
            <Img src={staticFile(d.after.src)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}}/>
          </div>
        </div>
        {d.ringText ? <RingPiece id="ev-ring" x={sw - 264} y={34} w={234} h={100} t={9} color={C.terra} scale={ring} z={4}/> : null}
        {d.detail ? <Piece id="ev-callout" x={22} y={166} w={sw - 44} h={96} color={C.terra} shape={rectShape(3, 1.3, 100)} enter={{at: -100}} z={2} tight tooth={0.3}>
          <Txt text={d.detail} top={0} right={28} size={detail.size} family={BODY} weight={800} color={C.card} lh={96}/>
        </Piece> : null}
      </Piece>
      <Tape cx={18} cy={10} len={96} h={32} rot={-36} at={24} id="ev-t1"/>
      <Tape cx={CWd - 18} cy={10} len={190} h={58} rot={34} at={30} from="r" id="ev-t2"/>
    </Piece>
    {/* the flap: it covers nav bar and detail first, then wipes left and off the card, its shadow passing over */}
    <Piece id="ev-flap" dir={d.dir} x={CX + 50 - 1080} y={CY + 204} w={CWd - 100} h={264} rot={-0.8} color={C.ink} shape={rectShape(6)}
      enter={{at: timing.frame(at-18,24), from: [0, -120], dur: 14, rot: 5}} track={{at, dur, from: [1080, 0], lift: 1}} z={9} depth={0.7}/>
    <Piece id="ev-label" railSafe x={CX + 40} y={CY + CH - 40} w={Math.round(textW(d.label, BODY, lab.size, 700)) + 70} h={66} rot={-3.5} color={C.mustard} shape={rectShape(6)}
      enter={{at: timing.frame(at+dur+8,76), from: [-120, 60], dur: 13}} z={11} depth={0.5}>
      <PieceText text={d.label} h={66} size={lab.size} family={BODY} weight={700} color={C.ink} dy={-1}/>
      <Tape cx={Math.round(textW(d.label, BODY, lab.size, 700)) + 40} cy={8} len={90} h={38} rot={32} at={timing.frame(at+dur+22,90)} id="ev-lt"/>
    </Piece>
  </Stage>;
};

