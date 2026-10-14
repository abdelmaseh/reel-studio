import {defineStyle} from '../types.ts';

export default defineStyle({
  id: 'magazine-interview',
  label: {ar: 'حوار مجلة', en: 'Magazine interview'},
  description: {ar: 'فصول واقتباسات واسم المتحدث بوضوح', en: 'Numbered chapters, restrained quote rules and clear speaker attribution.'},
  useCases: ['opinion', 'case-study', 'story'],
  grammar: {typography: 'serif-editorial', card: 'magazine-rule', annotation: 'chapter-rule', composition: 'magazine-column', caption: 'boxless', motion: 'quiet'},
  legacy: false,
  brand: false,
  pip: {allowed: false, basis: 'inference', evidence: 'Use the split presenter window with speaker attribution above it.'},
  defaults: {font: 'Cairo', captionsPresentation: 'minimal', clauseCaptions: false, staticCaptions: false},
  fit: {purpose: {}, tone: {}, semanticBeats: ['chapter-quote']},
  ownScenes: [],
  since: '2.0.0',
});
