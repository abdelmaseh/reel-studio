// The digits choice applied to the texts a Grid Glide scene draws. Node-safe: explicit .ts imports only, no packages.
//
// The authored data is never changed: this returns a copy whose drawn texts follow the video's digits choice, and the
// very same object when there is no choice. The comment keyword, the handle and the watermark are never mapped.
import {displayDigitList, displayDigits} from '../../../core/digits.ts';
import type {DigitChoice} from '../../types.ts';

type Words = {words: readonly string[]};
type Texted = {text: string};
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function localizeGlideData<T extends object>(data: T, digits: DigitChoice | null | undefined): T {
  if (digits !== 'latin' && digits !== 'arabic-indic') return data;
  const source = data as Record<string, unknown>;
  // The keyword of a comment scene may also appear inside a lead-in line; it stays exactly as the creator wrote it.
  const options = {keep: typeof source.keyword === 'string' ? [source.keyword] : []};
  const next: Record<string, unknown> = {...source};
  if (Array.isArray(source.lines)) next.lines = source.lines.map((line: Words) => ({...line, words: displayDigitList(line.words, digits, options)}));
  if (isObject(source.box) && typeof source.box.text === 'string') next.box = {...source.box, text: displayDigits(source.box.text, digits, options)};
  if (Array.isArray(source.bullets)) next.bullets = source.bullets.map((bullet: Texted) => ({...bullet, text: displayDigits(bullet.text, digits, options)}));
  if (typeof source.ordinal === 'string') next.ordinal = displayDigits(source.ordinal, digits, options);
  if (isObject(source.pill) && typeof source.pill.label === 'string') next.pill = {...source.pill, label: displayDigits(source.pill.label, digits, options)};
  return next as T;
}
