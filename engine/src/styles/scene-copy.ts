import {arabicCopy, cardLabel, type CardLabelKey} from '../creative-kit/labels.ts';

/** Visible scene copy decides language; asset names and option values do not. */
export function sceneCopy(data: unknown) {
  const ar = arabicCopy(data);
  return {
    ar,
    dir: ar ? 'rtl' as const : 'ltr' as const,
    align: ar ? 'right' as const : 'left' as const,
    side: ar ? 'right' as const : 'left' as const,
    opposite: ar ? 'left' as const : 'right' as const,
    label: (key: CardLabelKey) => cardLabel(key, data),
  };
}

export type SceneCopy = ReturnType<typeof sceneCopy>;
