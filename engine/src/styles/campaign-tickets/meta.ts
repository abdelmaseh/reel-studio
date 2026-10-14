import {defineStyle} from '../types.ts';

export default defineStyle({
  id: 'campaign-tickets',
  label: {ar: 'تذاكر وحملات', en: 'Campaign tickets'},
  description: {ar: 'تذاكر دهبية وكروت للأسئلة والتعليقات', en: 'Warm gold tickets, coral stubs and audience comment cards.'},
  useCases: ['explainer', 'case-study', 'story'],
  grammar: {typography: 'heavy-poster', card: 'perforated-ticket', annotation: 'ticket-stub', composition: 'ticket-stack', caption: 'ink-strip', motion: 'stagger'},
  legacy: false,
  brand: false,
  pip: {allowed: false, basis: 'inference', evidence: 'Use the split presenter window to keep tickets and comments clear.'},
  defaults: {font: 'Cairo', captionsPresentation: 'ink-strip', clauseCaptions: false, staticCaptions: false},
  fit: {purpose: {}, tone: {}, semanticBeats: ['ticket-offer', 'comment-stack']},
  ownScenes: [],
  since: '2.0.0',
});
