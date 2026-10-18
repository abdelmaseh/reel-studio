import React from 'react';
import {useDigits} from '../../../creative-kit/digits';
import {localizeGlideData} from './digits.ts';

/** A Grid Glide scene's authored data with the video's digits choice applied to every drawn text. Unchanged with no choice. */
export function useGlideData<T extends object>(data: T): T {
  const digits = useDigits();
  return React.useMemo(() => localizeGlideData(data, digits), [data, digits]);
}
