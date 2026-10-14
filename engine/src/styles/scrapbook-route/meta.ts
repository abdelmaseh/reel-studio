import {defineStyle} from '../types.ts';

export default defineStyle({
  id: 'scrapbook-route',
  label: {ar: 'رحلة على ورق', en: 'Scrapbook route'},
  description: {ar: 'خريطة ومحطات وصور متثبتة على الورق', en: 'Paper routes, station markers and optional taped local photos.'},
  useCases: ['story', 'tutorial', 'case-study'],
  grammar: {typography: 'mixed-paper', card: 'route-paper', annotation: 'route-marker', composition: 'route-map', caption: 'paper-label', motion: 'land'},
  legacy: false,
  brand: false,
  pip: {allowed: false, basis: 'inference', evidence: 'Use the split presenter window; map stops reserve the takeover canvas.'},
  defaults: {font: 'Tajawal', captionsPresentation: 'pill', clauseCaptions: false, staticCaptions: false},
  fit: {purpose: {}, tone: {}, semanticBeats: ['route-stops']},
  ownScenes: [],
  since: '2.0.0',
});
