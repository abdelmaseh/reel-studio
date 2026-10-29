import {StatementBand} from '../../../style-kit/statement-band';
import React from 'react';
import {AbsoluteFill, Easing, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {W, X1, CW, MIS, SH, CARD, INK, LIME, ramp, rng, slam, widthOf, hotSet, Slam, Kicker, PaperFx, useDesign, statementSafety, X0} from './kit';

const PasteStrip: React.FC<{line: string; at: number; size: number; box: number; rot: number; shift: number; seed: number; hot: Set<string>; dy?: number}> = ({line, at, size, box, rot, shift, seed, hot, dy = 0}) => {
  const {copy, HEAD, weight} = useDesign();
  const f = useCurrentFrame();
  const s = slam(f, at, 1.28);
  const wipe = ramp(f, at - 8, 8, Easing.out(Easing.cubic));
  const padX = 36, padY = 7;
  const w = Math.ceil(widthOf(line, size, HEAD, weight)) + padX * 2, h = box + padY * 2;
  const r = rng(seed), pts: string[] = [];
  for (let y = 0; y <= h; y += 14) pts.push(`${(r() * 11).toFixed(1)}px ${Math.min(y, h)}px`);          // left edge, top to bottom
  const right: string[] = [];
  for (let y = 0; y <= h; y += 14) right.push(`${(w - r() * 11).toFixed(1)}px ${Math.min(y, h)}px`);
  const poly = `polygon(${[...pts, ...right.reverse()].join(',')})`;
  const segs: {t: string; hot: boolean}[] = [];
  for (const wd of line.split(' ')) { const hh = hot.has(wd); const last = segs[segs.length - 1]; if (last && last.hot === hh) last.t += ' ' + wd; else segs.push({t: wd, hot: hh}); }
  return <div style={{opacity: s.on ? 1 : 0, marginTop: dy, [copy.ar ? 'marginRight' : 'marginLeft']: shift, transform: `translate(${s.dx}px, ${s.dy}px) rotate(${rot + (1 - s.k) * -4}deg) scale(${s.scale})`, transformOrigin: copy.ar ? '100% 50%' : '0% 50%', position: 'relative'}}>
    <div style={{position:'absolute',left:SH-2,top:SH-2,width:w,height:h,clipPath:poly,background:INK}}/>
    <div style={{position: 'relative', width: w, height: h, clipPath: poly, background: CARD}}>
      <PaperFx/>
      <div style={{position: 'absolute', [copy.side]: padX, top: padY, height: box, lineHeight: `${box}px`, fontFamily: HEAD, fontWeight:weight, fontSize: size, color: INK, direction: copy.dir, whiteSpace: 'pre'}}>
        {segs.map((sg, k) => <React.Fragment key={k}>{k > 0 ? ' ' : ''}
          {sg.hot ? <span style={{position: 'relative', display: 'inline-block', padding: '0 0.03em', margin: '0 -0.03em'}}>
            <span style={{position: 'absolute', [copy.opposite]: 0, [copy.side]: 0, top: size * 0.06, bottom: 0, background: LIME, transform: `translate(${-MIS}px, ${MIS}px)`, clipPath: copy.ar ? `inset(0 0 0 ${(1 - wipe) * 100}%)` : `inset(0 ${(1 - wipe) * 100}% 0 0)`}}/>
            <span style={{position: 'relative'}}>{sg.t}</span></span> : <span>{sg.t}</span>}</React.Fragment>)}
      </div>
    </div>
  </div>;
};

const Tape: React.FC<{at: number; left: number; top: number; rot: number}> = ({at, left, top, rot}) => {
  const {copy} = useDesign();
  const zig = (x: number) => { const p: string[] = []; for (let y = 0; y <= 46; y += 8) p.push(`${x + (y / 8 % 2 === 0 ? 0 : 7)}px ${y}px`); return p; };
  const poly = `polygon(${[...zig(0), ...zig(146).reverse()].join(',')})`;
  return <Slam at={at} from={1.5} rot={rot} kick={-10} style={{position: 'absolute', [copy.opposite]:left, top, width: 150, height: 46}}>
    <div style={{width: 150, height: 46, background: LIME, opacity: 0.92, clipPath: poly}}/>
  </Slam>;
};


export const Statement: React.FC<FamilyDesignProps> = (props) => {
  const {scene,headBox}=props;
  const {copy, HEAD, weight, fit} = useDesign();
  if (scene.family !== "statement") return null;
  const d = scene.data;

  // Three crooked paper strips at 120 px on two rows, y 280 to about 550, so nothing reaches the presenter's head below.
  const t = fit(d.title, {width: 560, size: 120, min: 84, lines: 3, lh: 1.0});
  const hot = hotSet(d.title);
  const rows: number[][] = [];
  t.lines.forEach((_, i) => { if (i === 0) rows.push([0]); else if (i % 2 === 1) rows.push([i]); else rows[rows.length - 1].push(i); });
  const rots = [-2.2, 1.7, -1.5, 1.2], shifts = [0, 10, 26, 0];
  const rowH = t.box + 14, step = rowH + 16;
  if(!headBox || Math.max(608,280+(rows.length-1)*step+rowH*1.28+70)>headBox.y-40)return <StatementBand {...props} font={HEAD}/>;
  const safety = statementSafety(Math.max(608,280+(rows.length-1)*step+rowH*1.28+70),headBox?.y);
  return <AbsoluteFill style={{direction:copy.dir,textAlign:copy.align}}>

    <div data-head-clear-bottom={safety.bottom} style={{position:'absolute',inset:0,transform:safety.scale === 1 ? undefined : `scale(${safety.scale})`,transformOrigin:`${copy.ar ? X1 : X0}px 250px`}}>
    <Kicker text={d.kicker} top={296} at={2} right={W - 440}/>
    <div style={{position: 'absolute', top: 280, [copy.side]: W - X1, width: CW}}>
      {rows.map((row, r) => {
        const rowWidth = row.reduce((sum,i)=>sum+Math.ceil(widthOf(t.lines[i],t.size,HEAD,weight))+72+(r===0 ? 0 : i===row[0] ? 10 : 24),0);
        const rowScale = Math.min(1,CW/(rowWidth+40));
        return <div key={r} style={{position: 'absolute', top: r * step, [copy.side]: 0, display: 'flex', flexDirection: copy.ar ? 'row-reverse' : 'row', alignItems: 'flex-start',transform:rowScale<1 ? `scale(${rowScale})` : undefined,transformOrigin:rowScale<1 ? `${copy.side} top` : undefined}}>
        {row.map((i) => <PasteStrip key={i} line={t.lines[i]} at={8 + i * 7} size={t.size} box={t.box} rot={rots[i % 4]} shift={r === 0 ? 0 : (i === row[0] ? shifts[1] : 24)} dy={i === row[0] ? 0 : -6} seed={31 + i * 7} hot={hot}/>)}
      </div>;})}
    </div>
    <Tape at={26} left={452} top={268} rot={-32}/>
    <Tape at={40} left={136} top={478} rot={30}/>
    </div>
  </AbsoluteFill>;
};

