import {DesignText} from '../../../style-kit/digits';
import {displayWeight as headlineWeight} from '../../../style-kit/design-safety';
import {useTiming,fittedSize} from '../../../style-kit/design-safety';
import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {C, MONO, DIM, GLOW, rgba, mix, ramp, widthOf, fit, Glass, Chip, Headline, headH, walk, lensState, DesignScene, X0, X1, CW, instrumentFont, instrumentSpacing, instrumentDirection} from './kit';
import {glassWord} from './copy';
// ---- token-lens (signature) ----
const TOK_AT = [36, 66, 94];
const TOK_HEAD = [{size:52,min:32,lines:1}];
const TOK_RADIUS = 220, TOK_ZOOM = 1.3;
const tokAt=(d:any,i:number)=>d.groups[i]?.atFrame ?? TOK_AT[i] ?? 36+i*28;
export const tokGeo = (d: any) => {
  const gap = 20, pad = 44, h = 168;
  const headingBottom = 376 + headH(d.title, TOK_HEAD, CW, 700, 1.2, d.font);
  // Clear the heading by 24 px even including the bezel's 28 px ticks.
  const top = headingBottom + 24 + 28 + TOK_RADIUS - h / 2;
  const words: string[][] = d.groups.map((g: {text:string}) => g.text.trim().split(/\s+/));
  let size = Math.min(72,Math.floor((h-48)/(Math.max(...words.map(w=>w.length))*1.3)));
  const weight = headlineWeight(d.font,'Grid Sans',700);
  const widths = (sz: number) => words.map((ws) => Math.ceil(Math.max(...ws.map((w) => widthOf(w, d.font, sz, weight)))) + pad);
  // Fit the whole chip at a real magnification; never solve overflow by zooming out.
  while (size > 1 && (widths(size).reduce((a, b) => a + b, 0) + gap * (d.groups.length - 1) > CW || widths(size).some(w=>TOK_ZOOM*Math.hypot(w,h)>TOK_RADIUS*2*.86))) size -= 1;
  const ws = widths(size);
  const pos: {x: number; y: number; w: number; h: number}[] = [];
  let right = X1;
  ws.forEach((w, i) => { pos[i] = {x: right - w, y: top, w, h}; right -= w + gap; });
  const used = X1 - right - gap;           // the row is centred as a whole
  const shift = Math.round((CW - used) / 2);
  pos.forEach((p) => { p.x -= shift; });
  return {size, pos, words, headingBottom, cardTop: top + h + 70, bottom: top + h};
};
const tokStops = (d: any) => { const g = tokGeo(d); const c = (i: number) => ({x:g.pos[i].x+g.pos[i].w/2,y:g.pos[i].y+g.pos[i].h/2,r:TOK_RADIUS});
  return [{x: 270, y: 1010, at: 20, r: TOK_RADIUS}, ...d.groups.map((_: any, i: number) => ({...c(i), at: tokAt(d,i)}))]; };
const TokenBody: React.FC<{d: any; n: string}> = ({d}) => {
  const f = useCurrentFrame();
  const timing=useTiming();
  d={...d,groups:d.groups.map((gr:any,i:number)=>({...gr,atFrame:timing.frame(gr.atFrame,TOK_AT[i]??36+i*28)}))};
  const g = tokGeo(d);
  const w = walk(f, tokStops(d), 20, 40);
  const sel = d.lens && f>=d.lens.atFrame ? d.lens.groupIndex : Math.max(0, Math.min(d.groups.length - 1, Math.round(w.idx - 1 + (w.since >= 0 ? 0 : 0.5))));
  const last = d.groups.length - 1;
  const act = (i: number) => ramp(f, tokAt(d,i) - 3, 10) * (i < last ? 1 - ramp(f, tokAt(d,i+1) - 16, 8) : 1);
  const lab = d.groups[sel];
  const mono = fit(d.note, instrumentFont(d.note,d.font), 400, 787, {size: 25, min: 18, lines: 1}, 1.2);
  const px = g.pos[sel];
  const lineH = Math.round(g.size * 1.2);
  const compact = (text:string,weight:number,size:number,min:number,height:number) => {
    const t=fit(text,d.font,weight,CW-116,{size,min,lines:2},1.25);
    const fitted=Math.min(t.size,t.size*height/(t.lines.length*t.box),...t.lines.map(line=>fittedSize(line,d.font,weight,t.size,CW-116)));
    return {...t,size:fitted,box:t.box*fitted/t.size};
  };
  const label = compact(lab.label,headlineWeight(d.font,'Grid Sans',700),112,32,132);
  const detail = compact(lab.text,500,42,26,84);
  return <>
    <Chip text={d.kicker} y={292} at={2}/>
    <Headline text={d.title} top={376} opts={TOK_HEAD} at={4}/>
    {d.groups.map((gr: any, i: number) => {
      const p = g.pos[i], a = act(i);
      return <Glass key={i} x={p.x} y={p.y} w={p.w} h={p.h} r={42} at={tokAt(d,i)} dark={0.6} active={a} sweepAt={tokAt(d,i) - 3}>
        <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: d.copy.dir, fontFamily: d.font, fontWeight:headlineWeight(d.font,'Grid Sans',700), fontSize: g.size,
          color: '#fff', whiteSpace: 'nowrap', textShadow: GLOW, opacity: mix(0.84, 1, a), lineHeight: `${lineH}px`}}>{g.words[i].map((wd: string, k: number) => <div key={k}>{wd}</div>)}</div>
        <div style={{position: 'absolute', top: 10, [d.copy.side]: 24, fontFamily: MONO, fontWeight: 600, fontSize: 16, lineHeight:'20px', letterSpacing: 2, color: a > 0.5 ? C.cyan : DIM, direction: 'ltr'}}><DesignText>{`0${i + 1}`}</DesignText></div>
      </Glass>;
    })}
    {/* leader from the selected chip down to its label */}
    <div style={{position: 'absolute', [d.copy.opposite]: px.x + px.w / 2 - 1.5, top: g.bottom, width: 3, height: g.cardTop - g.bottom, background: `linear-gradient(180deg, ${rgba(C.cyan, 0.15)}, ${C.cyan})`,
      boxShadow: `0 0 16px ${rgba(C.cyan, 0.8)}`, opacity: ramp(f, 30, 10)}}/>
    <div style={{position: 'absolute', [d.copy.opposite]: px.x + px.w / 2 - 9, top: g.cardTop - 9, width: 18, height: 18, borderRadius: 9, background: C.cyan, boxShadow: `0 0 22px ${C.cyan}`, opacity: ramp(f, 30, 10)}}/>
    <Glass x={X0} y={g.cardTop} w={CW} h={1236 - g.cardTop} r={56} at={20} dark={0.8} active={ramp(f, 28, 10)} sweepAt={tokAt(d,sel) + 2}>
      <div style={{position: 'absolute', top: 34, [d.copy.side]: 56, fontFamily: MONO, fontWeight: 600, fontSize: 26, letterSpacing: 3, color: C.cyan, direction: 'ltr'}}><DesignText>{`${glassWord('label', d.copy)} 0${sel + 1} / 0${d.groups.length}`}</DesignText></div>
      <div style={{position: 'absolute', top: 76, [d.copy.side]: 56, direction: d.copy.dir, fontFamily: d.font, fontWeight:headlineWeight(d.font,'Grid Sans',700), fontSize: label.size, lineHeight: `${label.box}px`, color: '#fff', whiteSpace: 'nowrap',
        textShadow: `0 0 50px ${rgba(C.cyan, 0.5)}, 0 4px 26px rgba(5,9,22,0.4)`}}>{label.lines.map((line,i)=><div key={i}>{line}</div>)}</div>
      <div style={{position: 'absolute', top: 76 + label.lines.length*label.box + 16, [d.copy.side]: 58, direction: d.copy.dir, fontFamily: d.font, fontWeight: 500, fontSize: detail.size, lineHeight: `${detail.box}px`, color: DIM, whiteSpace: 'nowrap'}}>{detail.lines.map((line,i)=><div key={i}>{line}</div>)}</div>
      <div style={{position: 'absolute', bottom: 26, left: 0, width: 787, textAlign: 'center', fontFamily: instrumentFont(d.note,d.font), fontWeight: 400, fontSize: mono.size, letterSpacing: instrumentSpacing(d.note,1.4), color: 'rgba(255,255,255,0.58)', direction: instrumentDirection(d.note)}}>{d.note}</div>
    </Glass>
  </>;
};
export const tokLens = (f: number, d: any) => {
 const stops=tokStops(d),g=tokGeo(d),w=walk(f,stops,20,40),i=d.lens?.groupIndex ?? Math.max(0,Math.min(g.pos.length-1,Math.round(w.idx-1))),p=g.pos[i];
 const state=lensState(f,stops,{appear:d.lens?.atFrame ?? 14,r:TOK_RADIUS,zoom:TOK_ZOOM,travel:20,arc:40,tag:true});
 const cx=d.lens?p.x+p.w/2:state.cx,cy=d.lens?p.y+p.h/2:state.cy;
 const headingShift=34*(1-ramp(f,4,22));
 return {...state,zoom:TOK_ZOOM,cx:Math.max(TOK_RADIUS+36,Math.min(1080-TOK_RADIUS-36,cx)),cy:Math.max(g.headingBottom+headingShift+24+28+state.r,cy)};
};


export const TokenLens: React.FC<FamilyDesignProps> = props => {
  const {scene} = props;
  if (scene.family !== 'token-lens') return null;
  return <DesignScene {...props} tone={4} Body={TokenBody} lens={tokLens} data={{...scene.data, note:scene.data.footer, groups:scene.data.groups.map(g=>({label:g.label,text:g.tokens.join(' '),atFrame:g.atFrame}))}}/>;
};
