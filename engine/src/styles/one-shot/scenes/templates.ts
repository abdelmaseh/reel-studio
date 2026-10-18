import {oneShotMinFrames} from './math.ts';

/** The starter chain the live editor adds. Every string is a placeholder the creator must replace. */
export const oneShotTemplate = {
  brand: 'اسم الأداة',
  intro: {top: 'نتيجة جاهزة', bottom: 'في ٣ خطوات', sub: 'اكتب هنا الفايدة في سطر واحد', start: 'يلا نبدأ'},
  steps: [
    {kind: 'drop', title: {top: 'حطّ الملف', bottom: 'في المكان ده'}, item: 'file.mp4', target: 'Inbox'},
    {kind: 'field', title: {top: 'اكتب الطلب', bottom: 'بكلام بسيط'}, text: 'حوّل الملف لنتيجة', placeholder: 'اكتب رسالتك…'},
    {kind: 'work', title: {top: 'استنى النتيجة', bottom: 'جاهزة للنشر'}, jobs: ['الخطوة الأولى', 'الخطوة التانية', 'الخطوة التالتة']},
  ],
  result: {words: ['نتيجة', 'جاهزة', 'في', 'دقايق', 'مش', 'ساعات']},
  closing: {top: '٣ خطوات بس', sub: 'اكتب هنا جملة الختام', platforms: ['Instagram', 'TikTok', 'Shorts']},
} as const;

export const oneShotTemplateData: Record<string, unknown> = {'one-shot': oneShotTemplate};

/** Frames the starter chain needs at this frame rate. */
export const oneShotTemplateFrames = (fps = 30): number => oneShotMinFrames(oneShotTemplate as never, fps);
