import {defineStyle} from '../types.ts';

export default defineStyle({
  id: 'judgment-board',
  label: {ar: 'مقارنة ورأي', en: 'Judgment board'},
  description: {ar: 'اختيارات ومقارنات على لوحة', en: 'A clear two-column verdict or comparison.'},
  useCases: ['comparison', 'opinion', 'case-study'],
  grammar: {typography: 'serif-verdict', card: 'verdict-board', annotation: 'verdict-divider', composition: 'two-column-board', caption: 'boxless', motion: 'quiet'},
  legacy: false,
  brand: false,
  pip: {allowed: true, basis: 'inference', evidence: 'See the style guide and review this layout with the creator.'},
  defaults: {font: 'Plex Display', captionsPresentation: 'ink-strip', clauseCaptions: false, staticCaptions: false},
  fit: {purpose: {comparison: 13, opinion: 18}, tone: {energetic: 2, editorial: 4}, semanticBeats: []},
  ownScenes: [],
  since: '1.8.6',
});
