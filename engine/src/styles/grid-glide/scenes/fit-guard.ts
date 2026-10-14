import {textWidth} from './fit';

/**
 * A line that is wider than its safe column fails the render instead of clipping. Measuring needs the render page's
 * fonts, so Node-only runs (SSR tests) skip it; every real render and every Studio preview measures.
 * It measures with the kit's own measurer and the family the scene draws with (the creator's font when one is set),
 * so the guard and the kit agree on every width.
 */
export function assertGlideFits(id: string, text: string, box: {size: number; weight: number; maxWidth: number; family: string}): void {
  if (typeof document === 'undefined') return;
  const width = Math.ceil(textWidth(text, {family: box.family, size: box.size, weight: box.weight}));
  if (width > box.maxWidth) throw new Error(`${id}: "${text}" is ${width}px wide at ${box.size}px but its safe column is ${box.maxWidth}px; shorten the words or split the line`);
}
