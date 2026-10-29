import {defineStyle} from '../types.ts';

export default defineStyle({
  id: 'magazine-interview',
  label: {ar: 'مجلة', en: 'Magazine interview'},
  description: {ar: 'فصول واقتباسات واسم المتحدث بوضوح', en: 'Numbered chapters, restrained quote rules and clear speaker attribution.'},
  useCases: ['opinion', 'case-study', 'story'],
  grammar: {typography: 'serif-editorial', card: 'magazine-rule', annotation: 'chapter-rule', composition: 'magazine-column', caption: 'boxless', motion: 'quiet'},
  legacy: false,
  brand: false,
  pip: {allowed: false, basis: 'inference', evidence: 'Use the split presenter window with speaker attribution above it.'},
  defaults: {font: 'Alexandria', captionsPresentation: 'minimal', clauseCaptions: false, staticCaptions: false},
  fit: {purpose: {}, tone: {}, semanticBeats: ['chapter-quote', 'verdict']},
  familiesOff: [],
  ownScenes: ['verdict'],
  signatureTransition: 'magazine-flip',
  since: '2.0.0',
});
