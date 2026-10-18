// The headline that replaces subtitles: one sentence at a time, every word rising on its recorded onset, Latin runs in serif italic.
// Arabic is animated by whole word only and never letter-spaced; a Latin run stays one left-to-right box inside the Arabic line.
import React from 'react';
import {FAMILY} from '../../../../core/fonts';
import {useDigits} from '../../../../creative-kit/digits';
import {displayDigits} from '../../../../core/digits';
import {EASE, HEADLINE, clamp01} from '../math.ts';
import type {Stage} from '../scene';

/** An Arabic prefix and the rest of the token from its first Latin letter or digit (`الـAPI` -> `الـ` + `API`). */
export const splitRun = (text: string): {pre: string; run: string} => {
  const i = text.search(/[A-Za-z0-9٠-٩]/);
  return i < 0 ? {pre: text, run: ''} : {pre: text.slice(0, i), run: text.slice(i)};
};
const ARABIC_DIGITS_ONLY = /^[٠-٩.,٫٬%]+$/;

export const Headline: React.FC<{stage: Stage; accents: ReadonlySet<number>; fontFamily?: string | null; holdUntil?: number | null}> = ({stage, accents, fontFamily = null, holdUntil = null}) => {
  const digits = useDigits();
  const {tl, frame, fps, ink} = stage;
  const sentence = tl.sentences.find((s) => frame >= s.startFrame && frame < s.endFrame);
  if (!sentence || (holdUntil !== null && frame >= holdUntil)) return null;
  // At a flip the outgoing sentence fades over 0.12 s from the flip; every other change is a hard swap.
  const flip = tl.acts.find((a) => a.index > 0 && a.flipFrame > sentence.startFrame && a.flipFrame <= frame && a.flipFrame < sentence.endFrame);
  const opacity = flip ? 1 - clamp01((frame - flip.flipFrame) / (HEADLINE.flipFadeSeconds * fps)) : 1;
  if (opacity <= 0) return null;
  const arabicFamily = fontFamily ?? FAMILY.plexDisplay;
  const arabic = (color: string): React.CSSProperties => ({fontFamily: arabicFamily, fontWeight: 700, fontSize: HEADLINE.arabicSize, color, fontSynthesis: 'none'});
  return <div dir="rtl" data-cartoon-headline="true" style={{position: 'absolute', left: HEADLINE.left, top: HEADLINE.top, width: HEADLINE.width, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
    columnGap: HEADLINE.gap, rowGap: 0, opacity: Number(opacity.toFixed(3)), boxSizing: 'border-box'}}>
    {sentence.words.map((word) => {
      const onset = word.fromFrame - stage.sceneFrom;
      const since = (frame - onset) / fps;
      if (since < 0) return null;
      const p = onset < 0.05 * fps ? 1 : EASE.expoOut(clamp01(since / HEADLINE.riseSeconds));
      const {pre, run} = splitRun(displayDigits(word.text, digits));
      const accent = accents.has(word.sourceIndex);
      const style: React.CSSProperties = {display: 'inline-block', whiteSpace: 'nowrap', lineHeight: HEADLINE.lineHeight, transform: `translateY(${Math.round((1 - p) * HEADLINE.risePx)}px)`, opacity: Number(clamp01(1.4 * p).toFixed(3))};
      return <span key={word.sourceIndex} style={style}>
        {pre ? <span style={arabic(accent && !run ? ink.accentInk : ink.ink)}>{pre}</span> : null}
        {run && ARABIC_DIGITS_ONLY.test(run) ? <span style={arabic(ink.accentInk)}>{run}</span> : null}
        {run && !ARABIC_DIGITS_ONLY.test(run) ? <span dir="ltr" style={{fontFamily: FAMILY.latinSerif, fontStyle: 'italic', fontWeight: 400, fontSize: HEADLINE.latinSize, letterSpacing: -1, color: ink.accentInk, fontSynthesis: 'none'}}>{run}</span> : null}
      </span>;
    })}
  </div>;
};
