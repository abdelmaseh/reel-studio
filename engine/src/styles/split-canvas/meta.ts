import {defineStyle} from '../types.ts';

export default defineStyle({
  id: 'split-canvas',
  label: {ar: 'شرح بصري', en: 'Split canvas'},
  description: {ar: 'كروت فوقك وظهورك واضح تحتها', en: 'Product UI above a continuous presenter window.'},
  useCases: ['explainer', 'tutorial'],
  grammar: {typography: 'product-sans', card: 'rounded-ui', annotation: 'accent-rule', composition: 'split-panel', caption: 'pill', motion: 'land'},
  legacy: true,
  brand: true,
  pip: {allowed: true, basis: 'observed', evidence: 'See the style guide and review this layout with the creator.'},
  defaults: {font: 'Cairo', captionsPresentation: 'pill', clauseCaptions: false, staticCaptions: true},
  fit: {purpose: {explainer: 13, tutorial: 13, comparison: 18}, tone: {energetic: 4}, semanticBeats: []},
  ownScenes: [],
  mix: {slug: 'split-canvas-pill-explainer', lraMax: 3, source: 'instructions/STYLES.md#split-canvas', section: 'Review the style audio range and preserve the recorded ending.'},
  since: '1.8.6',
});
