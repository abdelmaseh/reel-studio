import type { EditManifest } from "../../prepared-edit/schema.ts";
import { captionOverlayVisible } from "../../prepared-edit/visibility.ts";
import {
  CAPTION_GROUPING, CAPTION_PRESENTATION, CAPTION_SKINS, DIGIT_CHOICES, FONT_CHOICES,
  type CaptionGrouping, type CaptionPresentation, type CaptionSkin, type DigitChoice, type PreferredFont,
} from "../../core/preference-options.ts";
import { clauseCaptionsFor, defaultCaptionsFor, defaultFontFor, aliasPolicy } from "../../styles/style-compat.ts";
import { LOOK_KINDS, inkPairProblems, lookSchema, resolveInks, type InkProblem, type LookKind, type LookSpec } from "../../looks/index.ts";
import { finalize, refuse, unchanged, type OpResult } from "./result.ts";

/** The four per-video appearance choices of the Look tab. They are the same lists the settings screen and the planner use, never copies. */
export const LOOK_OPTIONS = { fonts: FONT_CHOICES, groupings: CAPTION_GROUPING, presentations: CAPTION_PRESENTATION, skins: CAPTION_SKINS, digits: DIGIT_CHOICES, looks: LOOK_KINDS } as const;
export const LOOK_KEYS = ["fontFamily", "captionsGrouping", "captionsPresentation", "captionsSkin", "digits", "look"] as const;
export type LookKey = (typeof LOOK_KEYS)[number];

/** `null` removes a grouping or a digits choice (back to the style's way). A font and a caption shape are never removed. */
export type LookPatch = {
  fontFamily?: PreferredFont;
  captionsGrouping?: CaptionGrouping | null;
  captionsPresentation?: CaptionPresentation;
  captionsSkin?: CaptionSkin | null;
  digits?: DigitChoice | null;
  /** The whole-picture look (riso, blueprint, film or paper); `null` takes it off. */
  look?: LookSpec | null;
};

export type LookView = {
  style: string;
  font: { value: PreferredFont | null; styleDefault: PreferredFont };
  grouping: { value: CaptionGrouping | null; effective: CaptionGrouping; ignored: boolean };
  presentation: { value: CaptionPresentation | null; effective: CaptionPresentation; styleDefault: CaptionPresentation };
  skin: { value: CaptionSkin | null };
  digits: { value: DigitChoice | null };
  captionsShown: boolean;
  graphics: boolean;
  /** `inks` is what a riso look prints with (the chosen pair, else the default one); `custom` says whether a pair was chosen. */
  look: { value: LookSpec | null; kind: LookKind | null; inks: [string, string]; custom: boolean };
};

/** The grouping the timeline compiles with (prepared-edit/timeline.ts): the chosen one, else the style's way. */
export const effectiveGrouping = (m: EditManifest): CaptionGrouping => m.captions.grouping ?? (clauseCaptionsFor(m.style,m.styleAlias) ? "clauses" : "compact");

export function lookView(m: EditManifest): LookView {
  const graphics = m.contentMode === "graphics";
  return {
    style: m.style,
    font: { value: m.fontFamily ?? null, styleDefault: defaultFontFor(m.style,m.styleAlias) },
    grouping: { value: m.captions.grouping ?? null, effective: effectiveGrouping(m), ignored: m.captions.mode === "phrases" },
    // Native manifests keep the historical pill fallback; migrated ones inherit their origin presentation.
    presentation: { value: m.captions.presentation ?? null, effective: m.captions.presentation ?? aliasPolicy(m.style,m.styleAlias)?.captionsPresentation ?? "pill", styleDefault: defaultCaptionsFor(m.style,m.styleAlias) },
    digits: { value: m.digits ?? null },
    skin: { value: m.captions.skin ?? null },
    captionsShown: captionOverlayVisible(m),
    graphics,
    look: { value: m.look ?? null, kind: m.look?.kind ?? null, inks: resolveInks(m.look), custom: m.look?.inks !== undefined },
  };
}

const has = (list: readonly string[], value: unknown): boolean => typeof value === "string" && list.includes(value);

const INK_PROBLEM_AR: Readonly<Record<InkProblem["code"], string>> = {
  count: "المظهر الطباعي يحتاج حبرين اثنين بالضبط.",
  format: "لون الحبر يجب أن يكون بصيغة #RRGGBB.",
  same: "يجب أن يختلف الحبران.",
  close: "الحبران متقاربان جدًا ولا يمكن فصلهما إلى طبقتين.",
  pale: "الحبران فاتحان جدًا ولن يُقرأ المكتوب على الورق؛ اختر حبرًا أغمق.",
};

/** Why a look was refused, in neutral Arabic. */
function lookRefusal(value: unknown): string {
  const v = value as { kind?: unknown; inks?: unknown } | null;
  if (!v || typeof v !== "object" || !has(LOOK_KINDS, v.kind)) return `المظهر «${typeof v?.kind === "string" ? v.kind : ""}» غير متاح.`;
  if (v.inks !== undefined) {
    if (v.kind !== "riso") return "الحبران يخصان مظهر الطباعة فقط.";
    const [first] = inkPairProblems(Array.isArray(v.inks) ? v.inks : []);
    if (first) return INK_PROBLEM_AR[first.code];
  }
  return "إعداد المظهر غير صالح.";
}

/**
 * Applies a Look patch to this video's manifest. Only fontFamily, captions.grouping, captions.presentation and digits change; a value equal
 * to the current one is a no-op. Never leaves the full-sentence grouping without a chosen font: the renderer's fit protection runs only
 * when `fontFamily` is set, so a nine-word caption would throw «Caption does not fit safely» while validation still passes.
 */
export function setLook(m: EditManifest, patch: LookPatch): OpResult {
  const keys = Object.keys(patch) as string[];
  const unknown = keys.find((key) => !(LOOK_KEYS as readonly string[]).includes(key));
  if (unknown) return refuse(`خاصية المظهر «${unknown}» غير معروفة.`);
  const graphics = m.contentMode === "graphics";
  if (graphics && ("captionsGrouping" in patch || "captionsPresentation" in patch || "captionsSkin" in patch)) return refuse("مشاريع الجرافيك بلا كابشن مسجّل، فلا يتغير فيها تجميع الكلمات ولا شكلها.");
  const p = patch as Record<string, unknown>;
  if ("fontFamily" in p && !has(FONT_CHOICES, p.fontFamily)) return refuse(p.fontFamily == null ? "لا يُحذف الخط؛ اختر خطًا أو أعده إلى الافتراضي." : `الخط «${String(p.fontFamily)}» غير متاح.`);
  if ("captionsPresentation" in p && !has(CAPTION_PRESENTATION, p.captionsPresentation)) return refuse(p.captionsPresentation == null ? "لا يُحذف شكل الكابشن؛ اختر شكلًا أو أعده إلى الافتراضي." : `شكل الكابشن «${String(p.captionsPresentation)}» غير متاح.`);
  if ("captionsGrouping" in p && p.captionsGrouping !== null && !has(CAPTION_GROUPING, p.captionsGrouping)) return refuse(`تجميع الكلمات «${String(p.captionsGrouping)}» غير متاح.`);
  if ("digits" in p && p.digits !== null && !has(DIGIT_CHOICES, p.digits)) return refuse(`شكل الأرقام «${String(p.digits)}» غير متاح.`);
  if ("captionsSkin" in p && p.captionsSkin !== null && !has(CAPTION_SKINS, p.captionsSkin)) return refuse(`سكين الكابشن «${String(p.captionsSkin)}» غير متاح.`);
  let wantedLook: LookSpec | null | undefined;
  if ("look" in p) {
    if (p.look === null) wantedLook = null;
    else {
      const parsed = lookSchema.safeParse(p.look);
      if (!parsed.success) return refuse(lookRefusal(p.look));
      wantedLook = parsed.data;
    }
  }

  let next: EditManifest = m;
  if (patch.fontFamily !== undefined && m.fontFamily !== patch.fontFamily) next = { ...next, fontFamily: patch.fontFamily };
  if (patch.captionsPresentation !== undefined && m.captions.presentation !== patch.captionsPresentation) next = { ...next, captions: { ...next.captions, presentation: patch.captionsPresentation } };
  if (patch.captionsSkin === null && m.captions.skin !== undefined) {
    const { skin: _gone, ...captions } = next.captions;
    next = { ...next, captions };
  } else if (patch.captionsSkin && m.captions.skin !== patch.captionsSkin) next = { ...next, captions: { ...next.captions, skin: patch.captionsSkin } };
  if (patch.captionsGrouping === null && m.captions.grouping !== undefined) {
    const { grouping: _gone, ...captions } = next.captions;
    next = { ...next, captions };
  } else if (patch.captionsGrouping && m.captions.grouping !== patch.captionsGrouping) next = { ...next, captions: { ...next.captions, grouping: patch.captionsGrouping } };
  if (patch.digits === null && m.digits !== undefined) {
    const { digits: _gone, ...rest } = next;
    next = rest;
  } else if (patch.digits && m.digits !== patch.digits) next = { ...next, digits: patch.digits };
  if (wantedLook === null) {
    if (m.look !== undefined) {
      const { look: _gone, ...rest } = next;
      next = rest;
    }
  } else if (wantedLook !== undefined && JSON.stringify(m.look) !== JSON.stringify(wantedLook)) next = { ...next, look: wantedLook };

  if (next === m) return unchanged(m);
  if ("captionsGrouping" in patch && effectiveGrouping(next) === "clauses" && next.fontFamily === undefined) {
    return refuse("تجميع الجمل الكاملة يحتاج خطًا محددًا لهذا الفيديو. اختر الخط معه أو أعده إلى الافتراضي.");
  }
  return finalize(m, next);
}

/**
 * The patch the panel should send for a grouping change: when the result would be the full-sentence grouping and the video has no chosen
 * font yet (a manifest from before fonts were written), the style's font travels in the same patch so the pair is applied together.
 */
export function completeLookPatch(m: EditManifest, patch: LookPatch): LookPatch {
  if (!("captionsGrouping" in patch) || "fontFamily" in patch || m.fontFamily !== undefined) return patch;
  const grouping = patch.captionsGrouping ?? (clauseCaptionsFor(m.style,m.styleAlias) ? "clauses" : "compact");
  return grouping === "clauses" ? { ...patch, fontFamily: defaultFontFor(m.style,m.styleAlias) } : patch;
}

/**
 * Reset writes the style's own default explicitly (as the planner always does) because the renderer would otherwise fall back to the
 * style typography or to the pill; grouping and digits are removed because their absence already means the style's way.
 */
export function lookResetPatch(m: EditManifest, key: LookKey): LookPatch {
  switch (key) {
    case "fontFamily": return { fontFamily: defaultFontFor(m.style,m.styleAlias) };
    case "captionsPresentation": return { captionsPresentation: defaultCaptionsFor(m.style,m.styleAlias) };
    case "captionsSkin": return { captionsSkin: null };
    case "captionsGrouping": return completeLookPatch(m, { captionsGrouping: null });
    case "digits": return { digits: null };
    case "look": return { look: null };
  }
}
