import {layeredMinFrames, type LayeredData} from './math.ts';

/** The starter scene the live editor adds. Every string is a placeholder the creator must replace. */
export const layeredTemplate = {
  words: [
    {place: 'behind', text: 'الفرق', atFrame: 6},
    {place: 'right', text: 'اكتب هنا كلمة', atFrame: 30, mark: {kind: 'circle', atFrame: 42}},
    {place: 'left', text: 'وكلمة تانية', atFrame: 48},
  ],
} as const;

export const layeredTemplateData: Record<string, unknown> = {'layered-speaker': layeredTemplate};

/** The words of a scene that are copy the creator writes; every other string (place, mark kind) is a structural choice. */
export const LAYERED_COPY_KEYS: ReadonlySet<string> = new Set(['text']);

/** Frames the starter scene needs at this frame rate, rounded up to a comfortable hold. */
export const layeredTemplateFrames = (fps = 30): number =>
  Math.max(layeredMinFrames(layeredTemplate as unknown as LayeredData, fps), Math.round(3 * fps));
