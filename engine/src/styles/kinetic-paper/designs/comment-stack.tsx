import {DesignText} from '../../../style-kit/digits';
import {useTiming} from '../../../style-kit/design-safety';
import React from 'react';
import {DesignCanvas} from './kit';
import type {FamilyDesignProps} from '../../family-designs';
import {PAPER, INK, LIME, SANS, MONO, Ground, Kicker, Box, Headline, Slam, useDesign, SafeWord} from './kit';


export const CommentStack: React.FC<FamilyDesignProps> = ({scene}) => {
  const {copy, fit} = useDesign();
  if (scene.family !== "comment-stack") return null;
  const d = scene.data;

  const timing=useTiming();
  const specs = [
    {x: 150, y: 550, w: 800, rot: -4, at: 14, lime: false},
    {x: 65, y: 730, w: 800, rot: 2, at: 36, lime: false},
    {x: 65, y: 910, w: 776, rot: -1, at: 58, lime: true},
  ];
  return <DesignCanvas style={{direction:copy.dir,textAlign:copy.align}}>
    <Ground/>
    <Kicker text={d.kicker} top={270} at={2}/>
    <Headline text={d.title} top={350} size={100} min={60} lines={2} at={8}/>
    {d.comments.map((c, i) => {
      const sp = {...specs[i % specs.length],at:timing.frame(c.atFrame,14+i*22)}, H = 154;
      const size = fit(c.text, {width: sp.w - 210, size: 56, min: 30, lines: 1, family: SANS, weight: 900}).size;
      return <Box key={i} x={sp.x} y={sp.y} w={sp.w} h={H} at={sp.at} shadow="solid" sw={11} rot={sp.rot} kick={-5} from={1.3} limeAt={sp.lime ? sp.at - 2 : undefined}>
        <div style={{position: 'absolute', [copy.side]: 34, top: 38, width: 64, height: 64, borderRadius: 46, background: INK, overflow: 'hidden'}}>
          <svg viewBox="0 0 92 92" width="92" height="92"><circle cx="46" cy="36" r="17" fill={sp.lime ? LIME : PAPER}/><path d="M12 92 C12 62 80 62 80 92 Z" fill={sp.lime ? LIME : PAPER}/></svg></div>
        <div style={{position: 'absolute', [copy.side]: 148, top: 34, direction: copy.dir, display: 'flex', gap: 14, alignItems: 'center'}}>
          <span style={{background: INK, color: PAPER, fontFamily: SANS, fontWeight: 800, fontSize: 28, lineHeight: '40px', padding: '0 16px'}}><SafeWord text={c.author} width={sp.w-440} size={28} weight={800}/></span>
          <span style={{fontFamily: MONO, fontWeight: 600, fontSize: 26, letterSpacing: 2, color: INK, opacity: 0.8}}><DesignText>{String(i+1).padStart(2,'0')}</DesignText>/<DesignText>{String(d.comments.length).padStart(2,'0')}</DesignText></span></div>
        <div style={{position: 'absolute', [copy.side]: 148, top: 74, direction: copy.dir, fontFamily: SANS, fontWeight: 900, fontSize: size, lineHeight: '64px', color: INK, whiteSpace: 'nowrap'}}><SafeWord text={c.text} width={sp.w-210} size={size}/></div>
      </Box>;
    })}
    <Slam at={timing.frame(Math.max(...d.comments.map(c=>c.atFrame))+12,90)} style={{position:'absolute',top:1092,left:65,width:788,display:'flex',alignItems:'center',gap:20,direction:copy.dir}}>
      <span style={{background:LIME,color:INK,fontFamily:SANS,fontWeight:900,fontSize:44,padding:'0 20px'}}><SafeWord text={d.keyword} width={240} size={44}/></span>
      <span style={{color:INK,fontFamily:SANS,fontWeight:700,fontSize:30}}><SafeWord text={d.prompt} width={460} size={30} weight={700}/></span>
    </Slam>
  </DesignCanvas>;
};

