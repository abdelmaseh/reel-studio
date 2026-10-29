import type {SceneCopy} from '../../scene-copy';

// Instrument markings retain the pilot's Latin lettering in both languages.
export const GLASS_WORDS = {
  serial: {ar:'N°',en:'N°'},
  step: {ar:'STEP',en:'STEP'},
  missing: {ar:'MISSING',en:'MISSING'},
  done: {ar:'DONE',en:'DONE'},
  label: {ar:'LABEL',en:'LABEL'},
  points: {ar:'pts',en:'pts'},
} as const;
export const glassWord = (key: keyof typeof GLASS_WORDS, copy: SceneCopy) => GLASS_WORDS[key][copy.ar ? 'ar' : 'en'];
