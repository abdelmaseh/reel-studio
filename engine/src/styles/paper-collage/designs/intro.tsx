// Approved V4 pilot; parsed data and direction adapter.
import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {C, BODY, W, ramp, textW, rectShape, polyShape, archVerts, fit, Stage, Piece, Tape, PieceText, Kicker, DesignProvider, useKit} from './kit';

export const Intro: React.FC<FamilyDesignProps> = p => {
  if (p.scene.family !== 'intro') return null;
  return <DesignProvider data={p.scene.data} sectionIndex={p.sectionIndex}><IntroDrawing d={p.scene.data}/></DesignProvider>;
};

const IntroDrawing: React.FC<{d: {kicker: string; title: string; subtitle: string}}> = ({d}) => {
  const {HEAD, copy} = useKit();
  const f = useCurrentFrame();
  const three = fit(d.title, {width: 800, size: 150, min: 112, lines: 3, weight: 700, family: HEAD, lh: 1.14});
  const t = three.fits ? three : fit(d.title, {width: 800, size: 112, min: 84, lines: 4, weight: 700, family: HEAD, lh: 1.14});
  const padX = 46, ph = Math.round(t.box + 14), step = t.lines.length > 3 ? ph + 2 : ph - 14, top0 = 424;
  const fills = [C.teal, C.card, C.terra], inks = [C.card, C.ink, C.card];
  const rights = [1012, 950, 1006, 968], rk = t.lines.length > 3 ? 0.55 : 1, rots = [-2.4 * rk, 1.8 * rk, -1.3 * rk, 1.5 * rk];
  const subTop = top0 + t.lines.length * step + 34;
  const one = fit(d.subtitle, {width: 700, size: 56, min: 46, lines: 1, weight: 600, family: BODY, lh: 1.25});
  const sub = one.fits ? one : fit(d.subtitle, {width: 700, size: 50, min: 38, lines: 2, weight: 600, family: BODY, lh: 1.25});
  return <Stage offcuts={{family: 'half', colors: [C.teal, C.terra, C.mustard]}}>
    <Piece id="intro-arch" x={275} y={318} w={740} h={860} rot={2.2} color={C.mustard} shape={polyShape(archVerts, 1.6)} enter={{at: 0, from: [70, 150], dur: 20, rot: 5}} z={1} depth={1}/>
    <Kicker text={d.kicker} x={1015} y={288} right at={10} id="intro-kick"/>
    {t.lines.map((line, i) => {
      const w = Math.round(textW(line, HEAD, t.size, 700) + padX * 2);
      return <Piece key={i} id={`intro-l${i}`} x={rights[i] - w} y={top0 + i * step} w={w} h={ph} rot={rots[i]} color={fills[i % 3]} shape={rectShape(10)}
        enter={{at: 14 + i * 9, from: [i % 2 ? -300 : 300, -70], dur: 15}} depth={0.55} z={5 + i}
        track={i === 1 ? {at: 62, dur: 18, from: [34, 0], lift: 0.5} : i === 2 ? {at: 66, dur: 16, from: [0, 12], lift: 0.5} : undefined}>
        <PieceText text={line} h={ph} size={t.size} color={inks[i % 3]} dy={-Math.round(t.size * 0.02)}/>
        {i === 0 ? <Tape cx={14} cy={ph - 8} len={110} h={44} rot={-40} at={32} id="intro-t0"/> : null}
        {i === 2 ? <Tape cx={w - 14} cy={10} len={110} h={44} rot={-38} at={50} id="intro-t2"/> : null}
      </Piece>;
    })}
    <div style={{position: 'absolute', top: subTop, [copy.side]: W - 975, width: 700, direction: copy.dir, zIndex: 7, opacity: ramp(f, 52, 14), transform: `translateY(${(1 - ramp(f, 52, 18)) * 22}px)`}}>
      {sub.lines.map((l, i) => <div key={i} style={{height: sub.box, lineHeight: `${sub.box}px`, fontFamily: BODY, fontWeight: 600, fontSize: sub.size, color: C.ink, whiteSpace: 'nowrap', textAlign: copy.align}}>{l}</div>)}
    </div>
  </Stage>;
};

