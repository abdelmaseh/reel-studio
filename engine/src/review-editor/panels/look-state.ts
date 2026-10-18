import type { EditManifest } from "../../prepared-edit/schema.ts";
import { DIGIT_CHOICES, DIGIT_LABELS_AR, type CaptionGrouping, type CaptionPresentation, type DigitChoice, type PreferredFont } from "../../core/preference-options.ts";
import { completeLookPatch, lookResetPatch, setLook, type LookKey, type LookPatch } from "../ops/look.ts";
import type { OpResult } from "../ops/result.ts";
import type { ApplyOptions } from "../store.ts";

/** Arabic labels of the Look choices. The option lists themselves come from ops/look.ts (LOOK_OPTIONS), so a new value shows up with no panel edit. */
export const GROUPING_LABEL: Readonly<Record<CaptionGrouping, string>> = {
  compact: "مدمج (حتى ٤ كلمات)",
  clauses: "جمل كاملة (حتى ٩ كلمات)",
  single: "كلمة كلمة",
};

export const PRESENTATION_LABEL: Readonly<Record<CaptionPresentation, string>> = {
  pill: "كبسولة",
  minimal: "نص بلا خلفية",
  "ink-strip": "شريط داكن",
};

/**
 * One label for every font, so a font cannot be added to the list without being named here (the compiler checks it). The family name stays
 * in the label because the assistant and the settings screen use it; the Arabic hint matches the one on the settings screen.
 */
export const FONT_LABEL: Readonly<Record<PreferredFont, string>> = {
  Cairo: "Cairo",
  Tajawal: "Tajawal",
  "Noto Naskh Arabic": "Noto Naskh Arabic · نسخ عربي",
  "Plex Display": "Plex Display",
  "Grid Sans": "Grid Sans",
  "Noto Kufi Arabic": "Noto Kufi Arabic · كوفي",
  "Readex Pro": "Readex Pro",
  "El Messiri": "El Messiri · المسيري",
};
export const fontLabel = (font: string): string => (FONT_LABEL as Readonly<Record<string, string>>)[font] ?? font;

/** The digits row has three states: «as written» (nothing is stored), then the two fixed values. */
export type DigitsChoice = "auto" | DigitChoice;
export const DIGITS_VALUES: readonly DigitsChoice[] = ["auto", ...DIGIT_CHOICES];
export const digitsLabel = (value: DigitsChoice): string => DIGIT_LABELS_AR[value];
/** "auto" removes the key; any other value goes to `setLook`, which refuses what is not one of the two fixed choices. */
export const digitsPatchValue = (value: string): DigitChoice | null => (value === "auto" ? null : (value as DigitChoice));

/** One undo step per control: quick changes of the same control merge, different controls never do. */
export const LOOK_COALESCE: Readonly<Record<LookKey, string>> = {
  fontFamily: "look:font",
  captionsGrouping: "look:grouping",
  captionsPresentation: "look:presentation",
  digits: "look:digits",
};

/** The name each control gives its undo step («تراجع: …» in the toolbar). */
export const LOOK_STEP: Readonly<Record<LookKey, string>> = {
  fontFamily: "خط الفيديو",
  captionsGrouping: "تجميع الكابشن",
  captionsPresentation: "شكل الكابشن",
  digits: "شكل الأرقام",
};

/** What one control hands to the editor's runner: the step name, the operation and the merge key. The panel and its test send exactly this. */
export type LookCommand = { label: string; fn: (m: EditManifest) => OpResult; options: ApplyOptions };

/** A change made with a control. A grouping that needs a font brings the style's font with it, decided on the manifest as it is when the step runs. */
export const lookChange = (key: LookKey, patch: LookPatch): LookCommand => ({
  label: LOOK_STEP[key],
  fn: (m) => setLook(m, completeLookPatch(m, patch)),
  options: { coalesce: LOOK_COALESCE[key] },
});

/** Back to the style's way. A reset is its own step and never merges into the change before it. */
export const lookReset = (key: LookKey): LookCommand => ({
  label: LOOK_STEP[key],
  fn: (m) => setLook(m, lookResetPatch(m, key)),
  options: { coalesce: false },
});

/** New strings of the Look tab, in neutral Arabic. */
export const LOOK_TEXT = {
  title: "مظهر هذا الفيديو",
  hint: "تغييرات هذا التبويب خاصة بهذا الفيديو فقط، ولا تغيّر إعداداتك المحفوظة. تظهر في المعاينة فورًا ويمكن التراجع عنها.",
  style: "الستايل",
  styleNote: "الستايل للعرض فقط هنا. لتغييره اطلب ذلك من المساعد.",
  font: "الخط",
  fontDefault: "افتراضي الستايل",
  fontNote: "يغيّر خط كل نصوص المشاهد والكابشن.",
  grouping: "تجميع كلمات الكابشن",
  presentation: "شكل الكابشن",
  digits: "شكل الأرقام",
  digitsNote: "يغيّر شكل الأرقام على الشاشة وفي الكابشن. الاختيار «كما هو» يترك كل مشهد على حاله.",
  reset: "افتراضي الستايل",
  resetDigits: "كما هو",
  graphicsNote: "مشاريع الجرافيك بلا كابشن مسجّل، فلا يتغير فيها تجميع الكلمات ولا شكلها.",
  hiddenNote: "الكابشن مخفي في هذا الفيديو. أظهره من تبويب «الكابشن» لتغيير تجميعه وشكله.",
  phrasesNote: "وضع عرض الكابشن الحالي «phrases» يجعل كل عبارة سطرًا واحدًا، فلا يعمل التجميع. لتغييره استخدم زر «وضع العرض» في تبويب «ملخص».",
  clausesNote: "اختيار الجمل الكاملة يثبّت خط الستايل لهذا الفيديو، لأن حماية القياس تعمل مع الخط المحدد فقط.",
} as const;
