import {arabicTypeTemplateData} from '../../arabic-type/schema.ts';
import {arabicTypeMinimumSeconds} from '../../arabic-type/timing.ts';
import { SAMPLE_NUMBER } from "../../prepared-edit/sample-numbers.ts";

/** Scene families the editor can add as ready templates beyond the original kit. */
export const KIT_TEMPLATE_FAMILIES = ["arabic-type", "figures", "chat-thread", "checklist", "data-story", "count", "outcome", "statement", "creator-cta", "proof-screen"] as const;
export type KitTemplateFamily = (typeof KIT_TEMPLATE_FAMILIES)[number];
export type KitLayout = "presenter" | "split" | "takeover";

export const isKitFamily = (family: string): family is KitTemplateFamily => (KIT_TEMPLATE_FAMILIES as readonly string[]).includes(family);

/** Length of each template at 30 fps; other rates scale it. */
const BASE_FRAMES: Record<KitTemplateFamily, number> = { "arabic-type": 150, figures: 120, "chat-thread": 120, checklist: 120, "data-story": 120, count: 120, outcome: 120, statement: 90, "creator-cta": 120, "proof-screen": 120 };

/** The layout each family's schema allows: a literal gives its value and the data-story choice takes the full canvas. */
export const KIT_LAYOUT: Record<KitTemplateFamily, KitLayout> = {
  "arabic-type": "takeover", figures: "takeover", "chat-thread": "takeover", checklist: "takeover", "data-story": "takeover", count: "split", outcome: "split", statement: "presenter", "creator-cta": "presenter",
  "proof-screen": "takeover",
};

/** Neutral Arabic notes the add operation returns. */
export const TEMPLATE_TEXT = {
  added: "هذا مشهد جاهز بنص تجريبي. بدّله بكلامك قبل التصدير النهائي.",
  addedWithNumber: "يحمل المشهد رقمًا تجريبيًا يمنع التصدير النهائي حتى تكتب رقمك الحقيقي.",
} as const;

type Scale = (frames: number) => number;

function templateData(family: KitTemplateFamily, f: Scale, d: Scale): Record<string, unknown> {
  switch (family) {
    case "arabic-type": return {...arabicTypeTemplateData};
    case "figures":return {variant:"counter",value:SAMPLE_NUMBER,label:"اكتب اسم الرقم",unit:"اكتب الوحدة"};
    case "chat-thread":return {variant:"bubbles",title:"اكتب عنوان المحادثة",messages:[{from:"them",text:"اكتب الرسالة الأولى",at:f(12)},{from:"me",text:"اكتب الرد",at:f(55)}]};
    case "proof-screen":
      return {page:"web",title:"اكتب عنوان الصفحة",blocks:[{kind:"heading",text:"اكتب الفكرة الأساسية"},{kind:"text",text:"اكتب شرحك من البريف"},{kind:"stat",text:"اكتب وصف الرقم ومصدره",value:SAMPLE_NUMBER}],focus:2,path:"focus"};
    case "checklist":
      return {
        kicker: "اكتب السطر الصغير", title: "اكتب عنوان القائمة", variant: "blueprint",
        items: [
          { label: "اكتب النقطة الأولى", detail: "اكتب تفصيلها", atFrame: f(20) },
          { label: "اكتب النقطة الثانية", detail: "اكتب تفصيلها", atFrame: f(48) },
          { label: "اكتب النقطة الثالثة", detail: "اكتب تفصيلها", atFrame: f(76) },
        ],
      };
    case "data-story":
      return {
        kicker: "اكتب السطر الصغير", title: "اكتب العنوان", sourceNote: "اكتب مصدر الرقم", display: "metric", suffix: "", unit: "اكتب الوحدة",
        animateFrames: d(30), items: [{ label: "اكتب اسم الرقم", value: SAMPLE_NUMBER, atFrame: f(10) }],
      };
    case "count":
      return {
        // No default suffix: a "+" would turn the creator's real 1250 into "1,250+", a claim nobody typed.
        kicker: "اكتب السطر الصغير", title: "اكتب العنوان", value: SAMPLE_NUMBER, suffix: "", unit: "اكتب الوحدة",
        rollFrame: f(20), rollDuration: d(40), unitFrame: f(50),
      };
    case "outcome":
      return {
        kicker: "اكتب السطر الصغير", title: "اكتب العنوان",
        items: ["اكتب النتيجة الأولى", "اكتب النتيجة الثانية", "اكتب النتيجة الثالثة"], footer: "اكتب السطر الأخير",
      };
    case "statement":
      return { kicker: "اكتب السطر الصغير", title: "اكتب الجملة الكبيرة" };
    case "creator-cta":
      // The scene draws the comment keyword only where the prompt says {keyword} (or spells the keyword), so the sample says it.
      return { title: "اكتب عنوان الدعوة", keyword: "الكلمة", prompt: "اكتب طلبك للمشاهد بكلمة {keyword}", handle: "@username", followFrame: f(30), clickedFrame: f(60) };
  }
}

/**
 * Ready data, length and layout of one kit template. Frame keys scale by fps/30, then by room/wanted when the gap is
 * shorter than the template, so a template fits any gap of at least two seconds instead of being refused.
 */
export function kitTemplate(family: KitTemplateFamily, fps: number, room?: number): { data: Record<string, unknown>; frames: number; layout: KitLayout } {
  const wanted = Math.max(1, Math.round((BASE_FRAMES[family] * fps) / 30));
  const frames = room === undefined ? wanted : Math.min(wanted, Math.floor(room));
  const least = Math.ceil((family === "arabic-type" ? arabicTypeMinimumSeconds(arabicTypeTemplateData) : 2) * fps);
  if (frames < least) throw new RangeError(`A ${family} template needs at least ${least} frames at ${fps} fps; got ${frames}.`);
  const k = (fps / 30) * (frames / wanted);
  const f: Scale = (n) => Math.max(0, Math.round(n * k));
  const d: Scale = (n) => Math.max(1, Math.round(n * k));
  return { data: templateData(family, f, d), frames, layout: KIT_LAYOUT[family] };
}

/** The 30 fps data of every kit template: the demo the Scenes panel compares a scene against. */
export const kitTemplateData: Record<KitTemplateFamily, Record<string, unknown>> = Object.fromEntries(
  KIT_TEMPLATE_FAMILIES.map((family) => [family, kitTemplate(family, 30).data]),
) as Record<KitTemplateFamily, Record<string, unknown>>;
