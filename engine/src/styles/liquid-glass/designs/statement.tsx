import {StatementBand} from '../../../style-kit/statement-band';
import React from 'react';
import {useTypographyFont} from '../../../creative-kit/chapter-theme';
import {Easing, useCurrentFrame} from 'remotion';
import type {FamilyDesignProps} from '../../family-designs';
import {C, rgba, clamp01, mix, ramp, soft, FitOpt, tryFit, RIM_MASK, Glass, Headline, DesignScene, H, warnFit} from './kit';
// ---- statement (over the presenter) ----
// StandIn draws the head box at top = height * 0.5 - 360 = 600. The glass block ends 44 px above it.
export const HEAD_TOP = H * 0.5 - 360;
const STMT_T: FitOpt[] = [{size: 100, min: 72, lines: 2}];
export const stmtGeo = (d: any) => {
  const t = tryFit(d.title, d.font, 700, 850, STMT_T, 1.12);
  const bottom = (d.headTop ?? HEAD_TOP) - 44;
  const titleTop = bottom - 30 - t.lines.length * t.box;
  const kickerTop = titleTop - 46;
  const band = {x: 24, y: -110, w: 1032, h: bottom + 110};
  return {t, band, bottom, titleTop, kickerTop};
};
/** A rim light that sweeps once along the band's edge and settles into a steady cyan edge. */
const RimLight: React.FC<{r: number; at: number; dur?: number; w?: number}> = ({r, at, dur = 36, w = 3}) => {
  const f = useCurrentFrame();
  const sw = clamp01((f - at) / dur), e = Easing.inOut(Easing.cubic)(sw), pos = mix(-22, 122, e);
  const settle = ramp(f, at + dur * 0.55, 26);
  return <>
    <div style={{position: 'absolute', inset: 0, borderRadius: r, padding: w, boxSizing: 'border-box', ...RIM_MASK, opacity: settle * 0.9,
      background: `linear-gradient(180deg, ${rgba(C.cyan, 0.2)}, ${rgba(C.cyan, 0.9)})`}}/>
    {sw > 0 && sw < 1 ? <div style={{position: 'absolute', inset: 0, borderRadius: r, padding: w + 1.5, boxSizing: 'border-box', ...RIM_MASK, opacity: Math.sin(Math.PI * sw),
      background: `linear-gradient(270deg, rgba(255,255,255,0) ${pos - 22}%, rgba(255,255,255,1) ${pos}%, rgba(255,255,255,0) ${pos + 22}%)`}}/> : null}
  </>;
};
const StatementBody: React.FC<{d: any; n: string}> = ({d}) => {
  const g = stmtGeo(d);
  const f = useCurrentFrame();
  const lit = ramp(f, 40, 30);
  const travel = (1-Math.min(1,soft(f,6)))*40 + (1-ramp(f,12,22))*34;
  const lift = d.headTop === null ? 0 : Math.max(0,travel-34);
  if (d.headTop !== null && g.kickerTop < 250) {
    warnFit({reason:'No safe statement band above the supplied head',headTop:d.headTop,title:d.title});
    return null;
  }
  return <Glass x={g.band.x} y={g.band.y-lift} w={g.band.w} h={g.band.h} r={56} at={6} dark={0.45} active={lit * 0.55} sweepAt={30} lite>
    <RimLight r={56} at={24}/>
    <div style={{position: 'absolute', top: g.kickerTop - g.band.y, [d.copy.side]: 41, display: 'flex', alignItems: 'center', gap: 14, direction: d.copy.dir, opacity: ramp(f, 8, 14)}}>
      <div style={{width: 14, height: 14, borderRadius: 7, background: C.cyan, boxShadow: `0 0 16px ${C.cyan}`}}/>
      <span style={{fontFamily: d.font, fontWeight: 600, fontSize: 34, color: C.cyan, whiteSpace: 'nowrap', lineHeight: '40px'}}>{d.kicker}</span>
    </div>
    <Headline text={d.title} top={g.titleTop - g.band.y} right={41} width={850} opts={STMT_T} lh={1.12} at={12} stagger={7}/>
  </Glass>;
};
/** Aurora light spilling onto the presenter plate so the glass over it still belongs to the style. */
export const Spill: React.FC = () => <div style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', background: `radial-gradient(90% 38% at 12% 2%, ${rgba(C.cyan, 0.3)}, rgba(0,0,0,0)), radial-gradient(80% 36% at 100% 100%, ${rgba(C.violet, 0.34)}, rgba(0,0,0,0)), radial-gradient(70% 30% at 0% 70%, ${rgba(C.teal, 0.2)}, rgba(0,0,0,0))`}}/>;
const StandGround: React.FC<{tone: number}> = () => <Spill/>;


const StatementFallback:React.FC<FamilyDesignProps>=props=>{const font=useTypographyFont() ?? 'Grid Sans';return <StatementBand {...props} font={font}/>;};
export const Statement: React.FC<FamilyDesignProps> = props => {
  const {scene} = props;
  if (scene.family !== 'statement') return null;
  const font=useTypographyFont() ?? 'Grid Sans';
  const g=stmtGeo({title:scene.data.title,font,headTop:props.headBox?.y??null});
  if(!props.headBox || g.kickerTop<250)return <StatementFallback {...props}/>;
  return <DesignScene {...props} tone={0} Body={StatementBody} Ground={StandGround} />;
};
