import type { KitTemplateFamily } from "../ops/templates.ts";

/** Arabic labels for the scene picker; families that are not listed keep their id. */
export const FAMILY_LABEL_AR: Record<KitTemplateFamily, string> = {
  checklist: "قائمة نقاط (checklist)",
  "data-story": "رقم أو مقارنة (data-story)",
  count: "عدّاد رقم (count)",
  outcome: "نتيجة (outcome)",
  statement: "جملة كبيرة (statement)",
  "creator-cta": "دعوة تعليق ومتابعة (creator-cta)",
};

export const familyLabel = (family: string): string => (FAMILY_LABEL_AR as Record<string, string>)[family] ?? family;

/** New strings of the Scenes panel, in neutral Arabic. */
export const SCENES_TEXT = {
  helper: "يُضاف المشهد الجديد بنص تجريبي وعليه علامة «نص تجريبي» حتى تبدّل الكلام بكلامك. للأنواع الأخرى انسخ مشهدًا موجودًا.",
  sampleNumberBadge: "رقم تجريبي",
  sampleNumberTitle: "الرقم 987654 تجريبي ويمنع التصدير النهائي حتى تكتب رقمك الحقيقي.",
  earlier: "▲ قدّم",
  later: "▼ أخّر",
  earlierTitle: "بدّل مكان هذا المشهد مع المشهد الذي قبله",
  laterTitle: "بدّل مكان هذا المشهد مع المشهد الذي بعده",
} as const;

/** Strings of the clip picker inside the scene form, in neutral Arabic. */
export const CLIP_TEXT = {
  label: "اللقطة",
  choose: "اختر لقطة",
  unregistered: "لقطة غير مسجّلة في المشروع",
  inPoint: "فريم داخل ملف اللقطة نفسه: النقطة التي تبدأ اللقطة بالتشغيل منها.",
  none: "لا توجد لقطات مسجّلة في هذا المشروع. اطلب من المساعد تجهيز لقطة من ملف تسمّيه.",
} as const;
