import {SHARED_STYLE_WORDS} from '../../../creative-kit/labels';
// Style-only print furniture. Content and identities come from scene.data.
const WORDS = {
  "number": {
    "ar": "NO.",
    "en": "NO."
  },
  "example": SHARED_STYLE_WORDS.example,
  "sample": {
    "ar": "SAMPLE",
    "en": "SAMPLE"
  },
  "missing": {
    "ar": "ناقص",
    "en": "MISSING"
  },
  "commentTitle": SHARED_STYLE_WORDS.commentPrompt,
  "comment": SHARED_STYLE_WORDS.commentWord,
  "send": {
    "ar": "إرسال",
    "en": "Send"
  }
} as const;
export const styleWord = (key:keyof typeof WORDS, ar:boolean) => WORDS[key][ar ? 'ar' : 'en'];
