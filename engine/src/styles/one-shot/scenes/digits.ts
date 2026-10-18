// The video's digits choice applied to the copy a one-shot chain draws. Node-safe: explicit .ts imports only, no packages.
//
// The authored data is never changed: with a choice this returns a copy whose drawn texts follow it, and with no choice
// the very same object, so the style keeps its own Arabic-Indic numbering and the copy stays as written.
import {displayDigits} from '../../../core/digits.ts';
import type {DigitChoice} from '../../types.ts';

/** Values that are never drawn as copy: the step kind and the accent colour. */
const NOT_COPY = new Set(['kind', 'accent']);

export function localizeOneShotData<T>(data: T, digits: DigitChoice | null | undefined): T {
  if (digits !== 'latin' && digits !== 'arabic-indic') return data;
  const map = (value: unknown, key: string): unknown => {
    if (NOT_COPY.has(key)) return value;
    if (typeof value === 'string') return displayDigits(value, digits);
    if (Array.isArray(value)) return value.map((item) => map(item, key));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, map(item, name)]));
    return value;
  };
  return map(data, '') as T;
}
