import {displayWeight} from '../../../style-kit/design-safety';
// Approved V4 pilot; parsed data and direction adapter.
import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {C, BODY, LAT, clamp01, INOUT3, ramp, lighten, textW, pstr, rectShape, polyShape, circleVerts, checkVerts, shadowFilter, fit, Stage, Piece, Tape, PieceText, DesignProvider, useKit} from './kit';

export const Follow: React.FC<FamilyDesignProps> = p => {
  if (p.scene.family !== 'follow') return null;
  return <DesignProvider data={p.scene.data} sectionIndex={p.sectionIndex}><FollowDrawing d={p.scene.data} tap={80}/></DesignProvider>;
};

const FollowDrawing: React.FC<{d: {handle: string; message: string}; tap: number}> = ({d, tap}) => {
  const {HEAD, copy, word} = useKit();
  const f = useCurrentFrame();
  const letter = d.handle.replace('@', '').slice(0, 1).toUpperCase();
  const handle = fit(d.handle, {width: 600, size: 116, min: 70, lines: 1, weight: 700, family: LAT});
  const hw = Math.round(textW(d.handle, LAT, handle.size, 700)) + 100;
  const msg = fit(d.message, {width: 700, size: 54, min: 36, lines: 1, weight: 600, family: BODY});
  const mw = Math.round(textW(d.message, BODY, msg.size, 600)) + 104;
  const BW = 680, BH = 156, BX = 200, BY = 972;
  const press = f >= tap && f < tap + 4 ? 0.95 : 1;
  const flip = ramp(f, tap + 3, 14, INOUT3);
  const angle = 180 * flip;
  const lift = Math.sin(Math.PI * flip);
  const edge = (c: string) => lighten(c, 0.5);
  const faceShape = rectShape(7)(BW, BH, 'follow-btn');
  const Face: React.FC<{color: string; children: React.ReactNode; back?: boolean}> = ({color, children, back}) =>
    <div style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: back ? 'rotateY(180deg)' : undefined, filter: shadowFilter(lift, 0.4)}}>
      <svg width={BW} height={BH} viewBox={`0 0 ${BW} ${BH}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <polygon points={pstr(faceShape.pts)} fill={color}/>
        <polygon points={pstr(faceShape.pts)} fill="#fff" filter="url(#rs-tooth)" style={{mixBlendMode: 'overlay'}} opacity={0.3}/>
        <polygon points={pstr(faceShape.pts)} fill="none" stroke={edge(color)} strokeWidth={1.5} opacity={0.85}/>
      </svg>
      {children}
    </div>;
  return <Stage offcuts={{family: 'tri', colors: [C.teal, C.mustard, C.terra]}}>
    <Piece id="fl-badge" x={330} y={282} w={420} h={420} rot={-3} color={C.mustard} shape={polyShape(circleVerts, 2)} enter={{at: 2, from: [0, -220], dur: 18, rot: 8}} z={3} depth={1}>
      <Tape cx={210} cy={16} len={180} h={56} rot={-6} at={24} id="fl-bt"/>
    </Piece>
    <Piece id="fl-inner" x={378} y={330} w={324} h={324} rot={2} color={C.card} shape={polyShape(circleVerts, 1.6)} enter={{at: 12, from: [0, -120], dur: 14, rot: -10}} z={5} depth={0.4}>
      <PieceText text={letter} h={324} size={230} family={LAT} weight={700} color={C.ink} dy={-14}/>
    </Piece>
    <Piece id="fl-handle" x={540 - hw / 2 + 14} y={664} w={hw} h={140} rot={-1.8} color={C.card} shape={rectShape(7)} enter={{at: 20, from: [260, 20], dur: 15}} z={7} depth={0.7}>
      <PieceText text={d.handle} h={140} size={handle.size} family={LAT} weight={700} color={C.ink} dy={-6} dir="ltr"/>
      <Tape cx={26} cy={14} len={104} h={42} rot={-38} at={36} id="fl-ht"/>
    </Piece>
    <Piece id="fl-msg" x={540 - mw / 2 - 24} y={806} w={mw} h={96} rot={1.4} color={C.terra} shape={rectShape(8)} enter={{at: 30, from: [-280, 20], dur: 15}} z={8} depth={0.6}>
      <PieceText text={d.message} h={96} size={msg.size} family={BODY} weight={600} color={C.card} dy={-1}/>
    </Piece>
    {/* the button sits on the paper: a floor shadow keeps the depth while the piece turns edge-on */}
    <div style={{position: 'absolute', left: BX + BW * (1 - Math.abs(Math.cos((angle * Math.PI) / 180))) / 2, top: BY + 26, width: BW * Math.abs(Math.cos((angle * Math.PI) / 180)), height: BH - 20, zIndex: 9,
      background: 'rgba(0,0,0,0.16)', filter: 'blur(26px)', opacity: ramp(f, 38, 8)}}/>
    <div style={{position: 'absolute', left: BX, top: BY + (1 - ramp(f, 38, 14)) * 150 - lift * 14, width: BW, height: BH, zIndex: 10, perspective: 1500, opacity: ramp(f, 38, 5),
      transform: `rotate(${-1 + flip * 1.6}deg) scale(${press * (1 + lift * 0.05)})`}}>
      <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateY(${angle}deg)`}}>
        {/* the paper edge: when the button is edge-on, its thickness still shows as a thin line */}
        <div style={{position: 'absolute', left: BW / 2 - 2.5, top: 4, width: 5, height: BH - 8, background: lighten(C.teal, 0.55), opacity: clamp01(1 - Math.abs(Math.cos((angle * Math.PI) / 180)) / 0.12), transform: 'translateZ(0px)'}}/>
        <Face color={C.teal}><PieceText text={word('follow')} h={BH} size={72} color={C.card} dy={-2}/></Face>
        <Face color={C.mustard} back>
          <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, direction: copy.dir}}>
            <svg width={76} height={76} viewBox="0 0 100 100"><polygon points={pstr(checkVerts(100, 100))} fill={C.teal}/></svg>
            <span style={{fontFamily: HEAD, fontWeight: displayWeight(HEAD,'Reem Kufi',700), fontSize: 68, color: C.ink, lineHeight: `${BH}px`, whiteSpace: 'nowrap'}}>{word('followed')}</span>
          </div>
        </Face>
      </div>
    </div>
    <div style={{position: 'absolute', left: BX + BW - 40, top: BY + 70, width: 120, height: 120, borderRadius: 60, border: `5px solid ${C.terra}`, zIndex: 12, boxSizing: 'border-box',
      opacity: f >= tap && f < tap + 12 ? 1 - (f - tap) / 12 : 0, transform: `scale(${0.6 + ((f - tap) / 12) * 0.8})`}}/>
  </Stage>;
};

// ---------- signature scenes ----------

