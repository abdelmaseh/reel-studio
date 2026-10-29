import {SHARED_STYLE_WORDS} from '../../../creative-kit/labels';
import type {SceneCopy} from '../../scene-copy';

// Receipt-specific labels; shared CTA copy comes from sceneCopy().label().
export const RECEIPTS_COPY = {
  receipt: {ar: 'إيصال', en: 'Receipt'},
  source: {ar: 'المصدر', en: 'Source'},
  value: {ar: 'القيمة', en: 'Value'},
  unit: {ar: 'الوحدة', en: 'Unit'},
  total: {ar: 'المجموع', en: 'Total'},
  steps: {ar: 'الخطوات', en: 'Steps'},
  list: {ar: 'القائمة', en: 'Checklist'},
  items: {ar: 'بنود', en: 'items'},
  available: {ar: 'الموجود', en: 'Available'},
  done: {ar: 'المنجز', en: 'Completed'},
  result: {ar: 'النتيجة', en: 'Result'},
  accountCard: {ar: 'بطاقة الحساب', en: 'Account card'},
  account: {ar: 'الحساب', en: 'Account'},
  status: {ar: 'الحالة', en: 'Status'},
  scale: {ar: 'المقياس', en: 'Scale'},
  difference: {ar: 'الفرق', en: 'Difference'},
  example: SHARED_STYLE_WORDS.example,
} as const;
export const receiptCopy = (copy: SceneCopy, key: keyof typeof RECEIPTS_COPY) => RECEIPTS_COPY[key][copy.ar ? 'ar' : 'en'];

