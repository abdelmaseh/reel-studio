// The top band: the act tag typed on the right, the counter on the left, and the viewfinder brackets of the hook.
import React from 'react';
import {Check} from 'lucide-react';
import {FAMILY} from '../../../../core/fonts';
import {useDigits} from '../../../../creative-kit/digits';
import {displayDigits} from '../../../../core/digits';
import {SafeExempt} from '../../../../core/safe';
import {BAND, EASE, clamp01} from '../math.ts';
import {headCanvas, placeAt} from '../rig.ts';
import type {Stage} from '../scene';

const isArabic = (text: string): boolean => /[؀-ۿ]/.test(text);
/** Mono for Latin with tracking; an Arabic tag uses the display face and no letter-spacing. */
/** Band text sits on a small chip of the act's ground, so the dot fields of the dark and pink acts never cut through it. */
const bandText = (color: string, spacing: number, text: string, ground: string): React.CSSProperties => ({fontFamily: isArabic(text) ? FAMILY.plexDisplay : FAMILY.plexMono, fontWeight: 600, fontSize: BAND.size, color,
  letterSpacing: isArabic(text) ? 0 : spacing, direction: isArabic(text) ? 'rtl' : 'ltr', whiteSpace: 'pre', fontSynthesis: 'none', background: ground, padding: '2px 10px', borderRadius: 8});
const pad2 = (n: number): string => String(n).padStart(2, '0');

export type Tally = {label: string; tapFrame: number};

/** `typeFirst` types the first act's tag too (the ending is a new act); `showCounter` false draws the tag alone. */
export const TopBand: React.FC<{stage: Stage; tally?: Tally | null; fadeFrame?: number | null; typeFirst?: boolean; showCounter?: boolean}> = ({stage, tally = null, fadeFrame = null, typeFirst = false, showCounter = true}) => {
  const digits = useDigits();
  const num = (text: string): string => displayDigits(text, digits);
  const {tl, frame, fps, act, ink} = stage;
  const current = tl.acts[act];
  if (!current) return null;
  const typed = act === 0 && !typeFirst ? current.tag : current.tag.slice(0, Math.round(current.tag.length * clamp01((frame - current.flipFrame) / (BAND.typeSeconds * fps))));
  const opacity = fadeFrame === null ? 1 : 1 - clamp01((frame - (fadeFrame - BAND.fadeSeconds * fps)) / (BAND.fadeSeconds * fps));
  if (opacity <= 0) return null;
  let label = '', value = '', popAt = current.flipFrame, check = false;
  if (tally) {
    const tapped = frame >= tally.tapFrame;
    label = tally.label; value = tapped ? `${num('1')}/${num('1')}` : `${num('0')}/${num('1')}`; check = tapped; popAt = tapped ? tally.tapFrame : -1e9;
  } else if (tl.counter?.kind === 'sections') {
    label = 'PART'; value = `${num(pad2(act + 1))}/${num(pad2(tl.counter.total))}`;
  } else if (tl.counter?.kind === 'seconds') {
    const stopped = frame >= tl.counter.stopFrame;
    const seconds = Math.min(tl.counter.total, (stopped ? tl.counter.stopFrame : frame) / fps);
    const whole = pad2(Math.floor(seconds));
    label = tl.counter.label;
    value = `${num(stopped ? `${whole}.${Math.floor((seconds % 1) * 10 + 1e-9)}` : whole)}/${num(String(tl.counter.total))}`;
    check = stopped; popAt = stopped ? tl.counter.stopFrame : -1e9;
  }
  const pop = 1 + 0.15 * EASE.bell(clamp01((frame - popAt) / (BAND.popSeconds * fps)));
  const text = label && showCounter ? `${label} ${value}` : '';
  return <div data-cartoon-band="true" style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: Number(opacity.toFixed(3)), pointerEvents: 'none'}}>
    {typed ? <div style={{position: 'absolute', right: BAND.side, top: BAND.top, ...bandText(ink.dim, 0.6, current.tag, ink.ground)}}>{typed}</div> : null}
    {text ? <div style={{position: 'absolute', left: BAND.side, top: BAND.top, display: 'flex', alignItems: 'center', gap: 8, transform: `scale(${pop.toFixed(3)})`, transformOrigin: '0 50%'}}>
      <span style={bandText(check ? ink.accentInk : ink.dim, 1.2, text, ink.ground)}>{text}</span>
      {check ? <Check size={24} strokeWidth={3} color={ink.accentInk} aria-hidden /> : null}
    </div> : null}
  </div>;
};

/** Viewfinder corners and a pulsing dot around the narrator while sentence 1 is on screen, fading over 0.3 s at its end. Decoration: hidden under the probe. */
export const Brackets: React.FC<{stage: Stage; until: number}> = ({stage, until}) => {
  const {frame, fps, ink, places} = stage;
  const vis = 1 - clamp01((frame - until) / (0.3 * fps));
  if (vis <= 0) return null;
  const place = placeAt(frame, places, fps), head = headCanvas(place), s = place.scale;
  const l = head.x - (190 * s + 24), r = head.x + (190 * s + 24), top = head.y - (222 * s + 20), bottom = 1468, len = 54;
  const k = 1 + 0.04 * (1 - EASE.expoOut(clamp01(frame / (0.6 * fps))));
  const corner = (x: number, y: number, dx: number, dy: number) => `M ${x.toFixed(1)} ${(y + dy * len).toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)} L ${(x + dx * len).toFixed(1)} ${y.toFixed(1)}`;
  const pulse = 0.6 + 0.4 * Math.sin((frame / fps) * 8);
  return <SafeExempt>
    <svg data-cartoon-brackets="true" width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, opacity: Number((vis * 0.75).toFixed(3)), transform: `scale(${k.toFixed(4)})`, transformOrigin: `${((l + r) / 2).toFixed(1)}px ${((top + bottom) / 2).toFixed(1)}px`}}>
      <path d={[corner(l, top, 1, 1), corner(r, top, -1, 1), corner(l, bottom, 1, -1), corner(r, bottom, -1, -1)].join(' ')} fill="none" stroke={ink.ink} strokeWidth={5} strokeLinecap="round" />
      <circle cx={r - 30} cy={top + 30} r={9} fill={ink.accent} opacity={pulse.toFixed(3)} />
    </svg>
  </SafeExempt>;
};
