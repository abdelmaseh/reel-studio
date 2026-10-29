import {displayWeight} from '../../../style-kit/design-safety';
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, AXIS, pen, clamp01, ramp, pop, useInkLayout, one, Parchment, Tooth, BrushRule, PenBox, Receipt, naskh, PAD} from './kit';

import type {FamilyDesignProps} from '../../family-designs';
import {DesignRoot, sceneCopy, useFonts} from './kit';

export const Comment: React.FC<FamilyDesignProps> = ({scene}) => {
  if (scene.family !== 'comment') return null;
  const d = scene.data;
  const copy = sceneCopy(d), FONT = useFonts(), inkLayout = useInkLayout();
  const f = useCurrentFrame();
  const card = pop(f, 4, 15, 150);
  const KW = one(d.keyword, {family: FONT.ruqaa, weight: 700, width: 640, size: 250, min: 120});
  const lay = inkLayout(copy.label('templateLine'), {family: FONT.naskh, weight: 700, width: 760, size: 60, min: 40, lines: 1, lh: 1.3});
  const P = inkLayout(d.promise, {family: FONT.naskh, weight: 700, width: 480, size: 48, min: 30, lines: 2, lh: 1.3});
  const cardTop = 330, cardW = 860, cardH = 700, cardCx = 540;
  return <DesignRoot copy={copy}>
    <Parchment/>
    {/* the promise: printed on a small receipt tucked under the note card */}
    <Receipt left={AXIS - 330} top={cardTop + cardH - 70} width={660} start={62} rot={1.2} seed={31} slot={false} rows={[
      {h: 150, node: <div style={{height: 150, padding: `70px ${PAD}px 0`, display: 'flex', alignItems: 'center', direction: copy.dir, gap: 18}}>
        <svg width="74" height="44" viewBox="0 0 74 44" style={{overflow: 'visible'}}><path d="M70 22 C 50 20, 30 24, 6 22 M26 4 C 20 12, 12 18, 5 22 C 12 27, 20 33, 27 41" fill="none" stroke={C.rust} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <div style={{flex: 1}}>{P.lines.map((l, i) => <div key={i} style={naskh(P.size, {lineHeight: `${P.box}px`, whiteSpace: 'nowrap'})}>{l}</div>)}</div></div>},
    ]}/>
    <div style={{position: 'absolute', left: cardCx - cardW / 2, top: cardTop, width: cardW, height: cardH, transform: `translateY(${(1 - card) * 70}px) rotate(-1.6deg)`, opacity: clamp01(card * 1.6),
      filter: 'drop-shadow(0 22px 26px rgba(60,38,20,0.30)) drop-shadow(0 2px 2px rgba(60,38,20,0.25))'}}>
      <div style={{position: 'absolute', inset: 0, background: '#FFFDF7', overflow: 'hidden', borderRadius: 6}}>
        <div style={{position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(to bottom, transparent 69px, rgba(120,150,170,0.22) 69px)', backgroundSize: '100% 70px', backgroundPosition: '0 40px'}}/>
        <div style={{position: 'absolute', top: 0, bottom: 0, right: 74, width: 2, background: 'rgba(165,69,34,0.30)'}}/>
        <Tooth w={cardW} h={cardH} tooth={0.12} fibre={0.05} seed={19} tint={[0.45, 0.4, 0.33]}/>
        <div style={{position: 'absolute', left: 70, top: 54, width: cardW - 200, display: 'flex', justifyContent: 'center'}}>
          <div style={{...naskh(lay.size, {whiteSpace: 'nowrap'}), WebkitMaskImage: `linear-gradient(to ${copy.ar ? 'left' : 'right'}, #000 ${ramp(f, 12, 22, pen) * 130 - 30}%, transparent ${ramp(f, 12, 22, pen) * 130}%)`}}>{lay.lines[0]}</div></div>
        <div style={{position: 'absolute', left: 70, top: 190, width: cardW - 200, height: 380}}>
          <PenBox w={cardW - 200} h={380} r={34} at={26} dur={22} width={5} seed={4}/>
          <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 38}}>
            <div style={{position: 'relative', padding: '40px 40px 90px'}}>
              <div style={{fontFamily: FONT.ruqaa, fontWeight: displayWeight(FONT.ruqaa,'Aref Ruqaa',700), fontSize: KW.fontSize, lineHeight: 1.1, color: C.ink, direction: copy.dir, whiteSpace: 'nowrap',
                WebkitMaskImage: `linear-gradient(to ${copy.ar ? 'left' : 'right'}, #000 ${ramp(f, 44, 22, pen) * 130 - 30}%, transparent ${ramp(f, 44, 22, pen) * 130}%)`}}>{d.keyword}</div>
              <BrushRule local left={40} top={KW.fontSize * 1.1 + 34} w={Math.min(KW.width,cardW-300)} h={30} at={62} dur={16} streak="#FFFDF7"/>
            </div>
          </div>
        </div>
      </div>
      {/* a strip of tape holds the card */}
      <div style={{position: 'absolute', left: cardW / 2 - 90, top: -22, width: 180, height: 50, background: 'rgba(214,186,128,0.62)', transform: 'rotate(2deg)',
        clipPath: 'polygon(0 6%, 4% 0, 8% 8%, 12% 0, 100% 0, 97% 25%, 100% 50%, 97% 75%, 100% 100%, 12% 100%, 8% 92%, 4% 100%, 0 94%, 3% 70%, 0 50%, 3% 25%)'}}/>
    </div>
  </DesignRoot>;
};

