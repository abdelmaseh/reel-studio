import {DesignText} from '../../../style-kit/digits';
import {useTiming} from '../../../style-kit/design-safety';
import React from 'react';
import {AbsoluteFill, Easing, spring, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {X1, FPS, MIS, PAPER, CARD, INK, LIME, SANS, MONO, ramp, slam, dotTile, Slam, Ground, Headline, Kicker, useDesign, SafeWord} from './kit';

const ticketHoles = (from: number, to: number, step: number) => { const a: number[] = []; for (let y = from; y <= to; y += step) a.push(y); return a; };


export const TicketOffer: React.FC<FamilyDesignProps> = ({scene,sectionIndex}) => {
  const {copy, fit} = useDesign();
  if (scene.family !== "ticket-offer") return null;
  const d = scene.data;

  const f = useCurrentFrame();
  const timing=useTiming(),at=timing.frame(d.ticket.atFrame,6);
  const TW = 880, TH = 470, LP = 232, R = 32, r = 7;
  const s = slam(f, at, 1.14);
  const draw = ramp(f, at, 12, Easing.out(Easing.quad));
  const holes = ticketHoles(R + 28, TH - R - 28, 36);
  const bodyD = `M ${LP + R} 0 H ${TW} V ${TH} H ${LP + R} A ${R} ${R} 0 0 0 ${LP} ${TH - R} ` + [...holes].reverse().map((cy) => `L ${LP} ${cy + r} A ${r} ${r} 0 0 0 ${LP} ${cy - r}`).join(' ') + ` L ${LP} ${R} A ${R} ${R} 0 0 0 ${LP + R} 0 Z`;
  const stubD = `M 0 0 H ${LP - R} A ${R} ${R} 0 0 0 ${LP} ${R} ` + holes.map((cy) => `L ${LP} ${cy - r} A ${r} ${r} 0 0 0 ${LP} ${cy + r}`).join(' ') + ` L ${LP} ${TH - R} A ${R} ${R} 0 0 0 ${LP - R} ${TH} H 0 Z`;
  const tearAt = timing.frame(at+60,66);
  const tt = f < tearAt ? 0 : spring({frame: f - tearAt, fps: FPS, config: {stiffness: 130, damping: 13, mass: 0.7}});
  const jolt = f >= tearAt && f < tearAt + 8 ? (f % 2 === 0 ? 1 : -1) * 5 * (1 - (f - tearAt) / 8) : 0;
  let t = fit(d.ticket.value, {width: TW - LP - 100, size: 180, min: 56, lines: 2});
  if(t.lines.length*t.box>248){
    const size=Math.floor(t.size*248/(t.lines.length*t.box));
    t=fit(d.ticket.value,{width:TW-LP-100,size,min:size,lines:2});
  }
  const bars = [10, 4, 14, 6, 6, 12, 4, 10, 8, 4, 14, 6, 10, 4, 8];
  const grow = ramp(f, 4, 20, Easing.out(Easing.quad));
  const title = fit(d.title,{width:930,size:84,min:56,lines:2});
  const titleBottom = Math.max(352+title.lines.length*title.box,...title.lines.map((_,i)=>{
    const motion=slam(f,8+i*5,1.3);
    return 352+i*title.box+title.box/2+motion.dy+title.box*motion.scale/2;
  }));
  // Reserve the rotated entrance, torn stub and shadow before fitting the ticket.
  // The heading keeps its authored type size; this scene fits its own objects.
  const ticketScale = Math.min(1,(1098-24-titleBottom-24)/(TH+150+56));
  const ticketTop = titleBottom+24+56*ticketScale;
  return <AbsoluteFill style={{direction:copy.dir,textAlign:copy.align}}>
    <Ground/>
    <Kicker text={d.kicker} top={270} at={2}/>
    <Headline text={d.title} top={352} size={84} min={56} lines={2} at={8}/>
    <div data-ticket-title-bottom={titleBottom} data-ticket-scale={ticketScale} style={{position:'absolute',[copy.opposite]:X1-TW,top:ticketTop,width:TW,height:TH,transform:`scale(${ticketScale})`,transformOrigin:'50% 0%'}}>
    <div data-ticket-top={ticketTop} data-cue-at={at} data-event-progress={s.on?s.k:0} style={{position: 'absolute', left:0,top:0,width: TW, height: TH, opacity: s.on ? 1 : 0, transform: `translate(${s.dx}px, ${s.dy}px) rotate(-1.8deg) scale(${s.scale})`, transformOrigin: '50% 50%'}}>
      {/* one halftone screen: the shadow of the whole body */}
      <div style={{position: 'absolute', [copy.opposite]: LP + 30, top: 34, width: TW - LP, height: TH, backgroundImage: dotTile(4.3 * grow), backgroundSize: '20px 20px'}}/>
      <div style={{position: 'absolute', [copy.opposite]: 0, top: 0, width: TW, height: TH, transform: `translate(${jolt}px, 0)`}}>
        <svg width={TW} height={TH} style={{position: 'absolute', [copy.opposite]: 0, top: 0, overflow: 'visible'}}>
          <g transform={copy.ar ? undefined : `translate(${TW} 0) scale(-1 1)`}>
          <path d={bodyD} fill={CARD}/>
          <path d={bodyD} fill={LIME} transform={`translate(${-MIS} ${MIS})`} clipPath="none"/>
          <path d={bodyD} fill="none" stroke={INK} strokeWidth="12" strokeLinejoin="miter" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw}/>
          </g>
        </svg>
        <div style={{position: 'absolute', [copy.opposite]: LP + 46, [copy.side]: 46, top: 60, direction: copy.dir}}>
          <div style={{fontFamily:SANS,fontWeight:800,fontSize:28,lineHeight:"44px",whiteSpace:"nowrap"}}><SafeWord text={d.ticket.label} width={TW-LP-100} size={28} weight={800}/></div>
          <Headline text={d.ticket.value} top={58} width={TW - LP - 100} right={0} size={t.size} min={t.size} lines={2} at={timing.frame(at+10,16)} stagger={6} hot={false}/>
        </div>
        <Slam at={timing.frame(at+34,40)} from={1.2} origin="100% 50%" style={{position: 'absolute', [copy.side]: 46, top: Math.min(TH-94,60 + 58 + t.lines.length * t.box + 12), direction: copy.dir, display: 'flex', alignItems: 'center', gap: 16}}>
          <span style={{background: INK, color: PAPER, fontFamily: SANS, fontWeight: 900, fontSize: 46, lineHeight: '66px', padding: '0 24px', whiteSpace: 'nowrap'}}><SafeWord text={d.ticket.detail} width={TW-LP-140} size={46}/></span></Slam>
      </div>
      {/* the stub: ink face, lime plate peeking out, serial and barcode */}
      <div style={{position: 'absolute', [copy.opposite]: 0, top: 0, width: LP, height: TH, transformOrigin: `${LP}px ${TH}px`, transform: `translate(${-4 * tt}px, ${104 * tt}px) rotate(${-5.5 * tt}deg)`}}>
        <svg width={LP} height={TH} style={{position: 'absolute', [copy.opposite]: 0, top: 0, overflow: 'visible'}}>
          <g transform={copy.ar ? undefined : `translate(${LP} 0) scale(-1 1)`}>
          <path d={stubD} fill={LIME} transform={`translate(${-MIS} ${MIS})`}/>
          <path d={stubD} fill={INK}/>
          </g>
        </svg>
        {sectionIndex!==undefined && Number.isInteger(sectionIndex) && sectionIndex>=0 ? <div style={{position:'absolute',left:20,right:20,top:210,fontFamily:MONO,fontWeight:600,fontSize:34,color:PAPER,textAlign:'center',direction:'ltr'}}>No. <DesignText>{String(sectionIndex).padStart(2,'0')}</DesignText></div>:null}
        <div style={{position: 'absolute', [copy.opposite]: 30, top: 64, display: 'flex', gap: 5, alignItems: 'flex-end', height: 74}}>{bars.map((b, i) => <div key={i} style={{width: b, height: 74, background: PAPER}}/>)}</div>
      </div>
    </div>
    </div>
    <div style={{position:'absolute',top:1098,left:65,width:788,fontFamily:copy.ar?SANS:MONO,fontWeight:600,fontSize:26,lineHeight:'38px',color:INK,direction:copy.dir}}>
      <SafeWord text={d.footer} width={788} size={26} family={copy.ar?SANS:MONO} weight={600}/>
    </div>
  </AbsoluteFill>;
};

