import {defineStyle} from '../types.ts';

export default defineStyle({
  id: 'stepped-editorial',
  label: {ar: 'تحريري', en: 'Stepped editorial'},
  description: {ar: 'تكوينات مرتبة وحضور قوي للكلام', en: 'Editorial spreads with offset plates and marked evidence.'},
  useCases: ['opinion', 'case-study', 'story'],
  grammar: {typography: 'serif-editorial', card: 'offset-plate', annotation: 'yellow-marker', composition: 'editorial-spread', caption: 'boxless', motion: 'land'},
  legacy: false,
  brand: false,
  pip: {allowed: true, basis: 'inference', evidence: 'See the style guide and review this layout with the creator.'},
  defaults: {font: 'Plex Display', captionsPresentation: 'ink-strip', clauseCaptions: false, staticCaptions: false},
  fit: {purpose: {explainer: 10, 'case-study': 13, opinion: 13, story: 9}, tone: {editorial: 6}, semanticBeats: []},
  ownScenes: [],
  since: '1.8.6',
});
