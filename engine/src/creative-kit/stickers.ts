// Stickers: small curated animated icons and emoji that scenes may place next to authored text.
//
// Node-safe: no JSX, no packages except zod. The files live in engine/public/stickers/ (so Remotion can serve them with staticFile) and
// are fetched once, with the owner's approval, from the pinned urls below; each source keeps its licence file in third-party/.
// A scene never takes a free-form path or url: it names a sticker by kind and id, and a refused id lists the valid ones.
//
//   kind "lottie"  animated icons (useAnimations, Meteocons)            -> stickers/icons/<id>.json
//   kind "emoji"   animated emoji (Noto, Lottie) or stills (Fluent SVG) -> stickers/emoji/animated/<id>.json | stickers/emoji/still/<id>.svg
//
// `at` of stickerSchema is seconds from the start of the element that carries the sticker (hosts convert with the fps: stickerStartFrame).
// Scene data (figures, chat-thread, arabic-type) uses sceneStickerSchema instead: there `at` is a scene-local FRAME, like every other cue in those scenes.
import { z } from "zod";

export const STICKER_KINDS = ["lottie", "emoji"] as const;
export type StickerKind = (typeof STICKER_KINDS)[number];
export type StickerFormat = "lottie" | "svg";
export type StickerSourceId = "useanimations" | "meteocons" | "noto-animated-emoji" | "fluent-emoji";

/** All four sources together may add at most this many bytes to the install (owner's budget for icons and emoji). */
export const STICKER_BUDGET_BYTES = 4 * 1024 * 1024;

export type StickerSource = {
  name: string;
  licence: "MIT" | "CC-BY-4.0";
  /** Licence or notice text kept in the repository next to the credit in NOTICE.md. */
  licenceFile: string;
  home: string;
  /** Pinned url prefix; `upstream` of each entry is appended (path segments url-encoded). */
  base: string;
};

export const STICKER_SOURCES: Readonly<Record<StickerSourceId, StickerSource>> = {
  useanimations: {
    name: "useAnimations", licence: "MIT", licenceFile: "third-party/icons/LICENSE-useanimations",
    home: "https://github.com/useanimations/react-useanimations",
    base: "https://raw.githubusercontent.com/useanimations/react-useanimations/035f164df779da512f06f1de4b0b59f7bf5624ba/icons/",
  },
  meteocons: {
    name: "Meteocons", licence: "MIT", licenceFile: "third-party/icons/LICENSE-meteocons",
    home: "https://github.com/basmilius/meteocons",
    base: "https://cdn.jsdelivr.net/npm/@meteocons/lottie@0.1.0/fill/",
  },
  "noto-animated-emoji": {
    name: "Google Noto Animated Emoji", licence: "CC-BY-4.0", licenceFile: "third-party/emoji/NOTICE-noto-animated-emoji.md",
    home: "https://googlefonts.github.io/noto-emoji-animation/",
    base: "https://fonts.gstatic.com/s/e/notoemoji/latest/",
  },
  "fluent-emoji": {
    name: "Microsoft Fluent Emoji", licence: "MIT", licenceFile: "third-party/emoji/LICENSE-fluent-emoji",
    home: "https://github.com/microsoft/fluentui-emoji",
    base: "https://raw.githubusercontent.com/microsoft/fluentui-emoji/1ffb34c752ecf5d402f04cfb4b392c77f57c54bc/assets/",
  },
};

export type StickerEntry = {
  id: string;
  kind: StickerKind;
  format: StickerFormat;
  source: StickerSourceId;
  /** Path of the file inside the source (below its `base`). */
  upstream: string;
  /** Size of the upstream file in bytes, measured when the table was made. */
  bytes: number;
  /** Arabic label for pickers (a proposal; the owner can rename). */
  ar: string;
};

export const STICKERS: readonly StickerEntry[] = [
  // Animated icons: useAnimations (MIT)
  { id: "checkmark", kind: "lottie", format: "lottie", source: "useanimations", upstream: "checkmark.json", bytes: 981, ar: "علامة صح" },
  { id: "check-circle", kind: "lottie", format: "lottie", source: "useanimations", upstream: "checkCircle.json", bytes: 2355, ar: "صح داخل دائرة" },
  { id: "alert-triangle", kind: "lottie", format: "lottie", source: "useanimations", upstream: "alertTriangle.json", bytes: 3325, ar: "تنبيه مثلث" },
  { id: "info", kind: "lottie", format: "lottie", source: "useanimations", upstream: "info.json", bytes: 2489, ar: "معلومة" },
  { id: "help", kind: "lottie", format: "lottie", source: "useanimations", upstream: "help.json", bytes: 2621, ar: "سؤال" },
  { id: "heart", kind: "lottie", format: "lottie", source: "useanimations", upstream: "heart.json", bytes: 2421, ar: "قلب" },
  { id: "star", kind: "lottie", format: "lottie", source: "useanimations", upstream: "star.json", bytes: 2050, ar: "نجمة" },
  { id: "thumbs-up", kind: "lottie", format: "lottie", source: "useanimations", upstream: "thumbUp.json", bytes: 6883, ar: "إعجاب" },
  { id: "trending-up", kind: "lottie", format: "lottie", source: "useanimations", upstream: "trendingUp.json", bytes: 1940, ar: "منحنى صاعد" },
  { id: "trending-down", kind: "lottie", format: "lottie", source: "useanimations", upstream: "trendingDown.json", bytes: 1944, ar: "منحنى هابط" },
  { id: "bar-chart", kind: "lottie", format: "lottie", source: "useanimations", upstream: "barChart.json", bytes: 3368, ar: "أعمدة بيانية" },
  { id: "target", kind: "lottie", format: "lottie", source: "useanimations", upstream: "target.json", bytes: 3266, ar: "هدف" },
  { id: "zap", kind: "lottie", format: "lottie", source: "useanimations", upstream: "zap.json", bytes: 1624, ar: "برق" },
  { id: "lock", kind: "lottie", format: "lottie", source: "useanimations", upstream: "lock.json", bytes: 1668, ar: "قفل" },
  { id: "notification", kind: "lottie", format: "lottie", source: "useanimations", upstream: "notification.json", bytes: 2193, ar: "كتم التنبيهات" },
  // Animated icons: Meteocons fill style (MIT)
  { id: "weather-clear-day", kind: "lottie", format: "lottie", source: "meteocons", upstream: "clear-day.json", bytes: 7302, ar: "شمس" },
  { id: "weather-clear-night", kind: "lottie", format: "lottie", source: "meteocons", upstream: "clear-night.json", bytes: 1820, ar: "ليل صافٍ" },
  { id: "weather-lightning-bolt", kind: "lottie", format: "lottie", source: "meteocons", upstream: "lightning-bolt.json", bytes: 2845, ar: "صاعقة" },
  { id: "weather-rainbow", kind: "lottie", format: "lottie", source: "meteocons", upstream: "rainbow.json", bytes: 3511, ar: "قوس قزح" },
  { id: "weather-thermometer", kind: "lottie", format: "lottie", source: "meteocons", upstream: "thermometer.json", bytes: 4459, ar: "ميزان حرارة" },
  // Animated emoji: Google Noto Animated Emoji (CC BY 4.0)
  { id: "fire", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "1f525/lottie.json", bytes: 29358, ar: "نار" },
  { id: "hundred", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "1f4af/lottie.json", bytes: 66142, ar: "مئة بالمئة" },
  { id: "party", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "1f389/lottie.json", bytes: 67875, ar: "احتفال" },
  { id: "thumbs-up", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "1f44d/lottie.json", bytes: 40892, ar: "إعجاب" },
  { id: "red-heart", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "2764_fe0f/lottie.json", bytes: 8439, ar: "قلب أحمر" },
  { id: "thinking", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "1f914/lottie.json", bytes: 68027, ar: "تفكير" },
  { id: "surprised", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "1f62e/lottie.json", bytes: 18749, ar: "دهشة" },
  { id: "light-bulb", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "1f4a1/lottie.json", bytes: 23436, ar: "فكرة" },
  { id: "rocket", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "1f680/lottie.json", bytes: 81575, ar: "صاروخ" },
  { id: "star", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "2b50/lottie.json", bytes: 12057, ar: "نجمة" },
  { id: "sparkles", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "2728/lottie.json", bytes: 15584, ar: "لمعان" },
  { id: "eyes", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "1f440/lottie.json", bytes: 28242, ar: "عيون" },
  { id: "bullseye", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "1f3af/lottie.json", bytes: 45947, ar: "هدف" },
  { id: "check-mark", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "2705/lottie.json", bytes: 15925, ar: "علامة صح" },
  { id: "cross-mark", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "274c/lottie.json", bytes: 7292, ar: "علامة خطأ" },
  { id: "high-voltage", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "26a1/lottie.json", bytes: 89096, ar: "طاقة" },
  { id: "chart-up", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "1f4c8/lottie.json", bytes: 12551, ar: "منحنى صاعد" },
  { id: "warning", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "26a0_fe0f/lottie.json", bytes: 16168, ar: "تحذير" },
  { id: "bar-chart", kind: "emoji", format: "lottie", source: "noto-animated-emoji", upstream: "1f4ca/lottie.json", bytes: 15238, ar: "أعمدة بيانية" },
  // Emoji stills: Microsoft Fluent Emoji, Color style (MIT)
  { id: "money-bag", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Money bag/Color/money_bag_color.svg", bytes: 12574, ar: "كيس مال" },
  { id: "crescent-moon", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Crescent moon/Color/crescent_moon_color.svg", bytes: 14461, ar: "هلال" },
  { id: "mobile-phone", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Mobile phone/Color/mobile_phone_color.svg", bytes: 21323, ar: "هاتف" },
  { id: "pushpin", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Pushpin/Color/pushpin_color.svg", bytes: 9469, ar: "دبوس" },
  { id: "key", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Key/Color/key_color.svg", bytes: 4483, ar: "مفتاح" },
  { id: "bell", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Bell/Color/bell_color.svg", bytes: 8290, ar: "جرس" },
  { id: "megaphone", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Megaphone/Color/megaphone_color.svg", bytes: 9043, ar: "مكبر صوت" },
  { id: "magnifying-glass", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Magnifying glass tilted left/Color/magnifying_glass_tilted_left_color.svg", bytes: 8617, ar: "عدسة مكبرة" },
  { id: "calendar", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Calendar/Color/calendar_color.svg", bytes: 20832, ar: "تقويم" },
  { id: "books", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Books/Color/books_color.svg", bytes: 13569, ar: "كتب" },
  { id: "clapper-board", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Clapper board/Color/clapper_board_color.svg", bytes: 19442, ar: "لوح تصوير" },
  { id: "studio-microphone", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Studio microphone/Color/studio_microphone_color.svg", bytes: 13438, ar: "ميكروفون استوديو" },
  { id: "briefcase", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Briefcase/Color/briefcase_color.svg", bytes: 11477, ar: "حقيبة عمل" },
  { id: "pencil", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Pencil/Color/pencil_color.svg", bytes: 6068, ar: "قلم رصاص" },
  { id: "package", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Package/Color/package_color.svg", bytes: 9535, ar: "طرد" },
  { id: "globe-europe-africa", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Globe showing europe-africa/Color/globe_showing_europe-africa_color.svg", bytes: 12505, ar: "كرة أرضية" },
  { id: "gem-stone", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Gem stone/Color/gem_stone_color.svg", bytes: 4669, ar: "جوهرة" },
  { id: "trophy", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Trophy/Color/trophy_color.svg", bytes: 14280, ar: "كأس" },
  { id: "memo", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Memo/Color/memo_color.svg", bytes: 13776, ar: "مذكرة" },
  { id: "credit-card", kind: "emoji", format: "svg", source: "fluent-emoji", upstream: "Credit card/Color/credit_card_color.svg", bytes: 8961, ar: "بطاقة دفع" },
];

export const stickerById = (kind: StickerKind, id: string): StickerEntry | undefined =>
  STICKERS.find((entry) => entry.kind === kind && entry.id === id);

/** Path below engine/public, the argument of staticFile(). */
export const stickerFile = (entry: StickerEntry): string =>
  entry.kind === "lottie"
    ? `stickers/icons/${entry.id}.json`
    : entry.format === "lottie"
      ? `stickers/emoji/animated/${entry.id}.json`
      : `stickers/emoji/still/${entry.id}.svg`;

/** The pinned url the file is downloaded from (after the owner approves). */
export const stickerSourceUrl = (entry: StickerEntry): string =>
  STICKER_SOURCES[entry.source].base + entry.upstream.split("/").map(encodeURIComponent).join("/");

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// The two fields every sticker schema shares, and the one check that the id is in the table for its kind (a refused id lists the valid ones).
const stickerFields = { kind: z.enum(STICKER_KINDS), id: z.string().regex(SLUG, "Sticker ids are lowercase slugs") };
const knownSticker = (sticker: { kind: StickerKind; id: string }, ctx: z.RefinementCtx): void => {
  if (!stickerById(sticker.kind, sticker.id)) {
    const valid = STICKERS.filter((entry) => entry.kind === sticker.kind).map((entry) => entry.id).join(", ");
    ctx.addIssue({ code: "custom", path: ["id"], message: `Unknown ${sticker.kind} sticker "${sticker.id}". Choose one of: ${valid}.` });
  }
};

export const stickerSchema = z
  .object({ ...stickerFields, at: z.number().min(0).max(600).optional() })
  .strict()
  .superRefine(knownSticker);
export type Sticker = z.infer<typeof stickerSchema>;

/**
 * The sticker of scene data. `at` is a scene-local frame (integer, default 0 = the scene start), the same unit as every other cue in the scene.
 * The titles are what the editor form shows for these fields (it reads the JSON-Schema title before its own label table).
 */
export const sceneStickerSchema = z
  .object({
    kind: stickerFields.kind.meta({ title: "نوع الملصق" }),
    id: stickerFields.id.meta({ title: "الملصق" }),
    at: z.number().int().min(0).max(4320000).optional().meta({ title: "يظهر عند فريم" }),
  })
  .strict()
  .superRefine(knownSticker);
export type SceneSticker = z.infer<typeof sceneStickerSchema>;

/** What is wrong with a scene sticker that would start at or after the last frame of its scene; undefined when it is fine. */
export const sceneStickerTimingIssue = (sticker: Pick<SceneSticker, "at"> | undefined, durationInFrames: number): string | undefined =>
  sticker?.at !== undefined && sticker.at >= durationInFrames
    ? `The sticker starts at frame ${sticker.at}, but the scene is only ${durationInFrames} frames long (frames 0-${durationInFrames - 1}). Start it before frame ${durationInFrames}.`
    : undefined;

/** Scene-level check for the schemas that carry a sticker: `.superRefine(refineSceneSticker)` on the scene object. */
export const refineSceneSticker = (scene: { durationInFrames: number; data: { sticker?: SceneSticker | undefined } }, ctx: z.RefinementCtx): void => {
  const message = sceneStickerTimingIssue(scene.data.sticker, scene.durationInFrames);
  if (message) ctx.addIssue({ code: "custom", path: ["data", "sticker", "at"], message });
};

/** The scene families that can carry one sticker. */
export type SceneStickerHost = "figures" | "chat-thread" | "arabic-type";
/**
 * Where each family draws its sticker: one fixed square on the 1080x1920 frame, inside every safe-zone profile and clear of the family's text.
 * figures and chat-thread keep their column at x 120-820, so the sticker sits in the free strip to its right beside the title (the leading side
 * of right-to-left copy). arabic-type centres its headline on the middle of the frame, so the sticker sits centred above it.
 */
export const SCENE_STICKER_SPOTS: Readonly<Record<SceneStickerHost, { left: number; top: number; size: number }>> = {
  figures: { left: 848, top: 340, size: 160 },
  "chat-thread": { left: 848, top: 340, size: 160 },
  "arabic-type": { left: 460, top: 280, size: 160 },
};

/** Sources whose icons are plain black (every stroke and fill is 0,0,0), so they vanish on a dark scene unless inverted. The colour sources are never touched. */
export const MONOCHROME_STICKER_SOURCES: readonly StickerSourceId[] = ["useanimations"];

/** True for a light "#rrggbb" ink, i.e. text that sits on a dark scene. Anything else (a gradient, a name) counts as dark ink. */
export const isLightInk = (color: string | undefined): boolean => {
  const match = /^#([0-9a-f]{6})$/i.exec(color ?? "");
  if (!match) return false;
  const n = parseInt(match[1], 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 > 0.6;
};

/** First frame a sticker is drawn at, from its `at` seconds. */
export const stickerStartFrame = (sticker: Pick<Sticker, "at">, fps: number): number => Math.round((sticker.at ?? 0) * fps);

export { normalizeLottie, type LottieData } from "../core/lottie-data.ts";
