import type { EditManifest } from "../../prepared-edit/schema.ts";
import { BROLL_REFUSED_STYLES } from "../../prepared-edit/broll.ts";
import { CLIP_MAX_ENLARGEMENT, clipEnlargement } from "../../core/clip-schema.ts";
import type { ClipIndexEntry } from "../../core/clip-schema.ts";
import { finalize, refuse } from "./result.ts";
import type { OpResult } from "./result.ts";
import { freeRoomAt } from "./scenes.ts";
import { insertSorted, limitFrame, uniqueSlug } from "./util.ts";
import type { Scene } from "./util.ts";

/** Strings of the B-roll section of the Scenes panel, in neutral Arabic. */
export const BROLL_TEXT = {
  section: "لقطة B-roll",
  pick: "اختر اللقطة",
  add: "أضف B-roll عند المؤشر",
  none: "لا توجد لقطات مسجّلة في هذا المشروع. اطلب من المساعد تجهيز لقطة من ملف تسمّيه.",
  added: "أُضيف مشهد B-roll بلقطة صامتة فوق كلامك. غيّر اللقطة أو مدتها أو الشكل من نموذج المشهد.",
  addedContained: "اللقطة صغيرة على الشاشة الكاملة، فوُضعت بوضع contain حتى لا تتشوّه. اجعل المشهد نصف الشاشة أو استخدم لقطة أكبر لتملأ الشاشة.",
  noRoom: "لا توجد مساحة خالية بطول ثانية على الأقل لمشهد B-roll. قصّر مشهدًا أو انقل المؤشر إلى مكان خالٍ.",
  tooSmall: "اللقطة أصغر من أن تملأ الشاشة حتى بوضع contain. اطلب من المساعد لقطة بدقة أعلى.",
} as const;

const FULL_BOX = { width: 1080, height: 1920 } as const;

/** One clip in a list: its label and the length of the window the creator asked for, not the file with its two one-second handles (frames / fps). */
export const clipOptionLabel = (clip: ClipIndexEntry): string => `${clip.label} · ${(clip.window.toSec - clip.window.fromSec).toFixed(1)}ث`;

/** Why B-roll cannot be added to this edit, or null when it can. */
export function brollRefusal(m: EditManifest): string | null {
  return (BROLL_REFUSED_STYLES as readonly string[]).includes(m.style) ? `B-roll غير متاح في ستايل ${m.style} لأنه يرسم الشاشة بنفسه.` : null;
}

/** Add a full-screen B-roll scene that plays `clip` from where it was cut, in the first free gap at or after `atFrame`. */
export function addBrollScene(m: EditManifest, clip: ClipIndexEntry, options: { atFrame?: number; durationInFrames?: number } = {}): OpResult<{ id: string; index: number }> {
  const refusal = brollRefusal(m);
  if (refusal) return refuse(refusal);
  const fps = m.source.fps;
  if (clip.fps !== fps) return refuse(`اللقطة «${clip.label}» مسجّلة بمعدل ${clip.fps} فريم/ث والفيديو يعمل بمعدل ${fps}. اطلب من المساعد تجهيزها من جديد.`);
  // `cover` fills the screen when the clip is large enough; otherwise `contain` is the fallback, and a clip too small even for that cannot be added at all.
  const fits = (fit: "cover" | "contain") => clipEnlargement({ width: clip.width, height: clip.height, fit }, FULL_BOX) <= CLIP_MAX_ENLARGEMENT + 1e-9;
  const contained = !fits("cover");
  if (contained && !fits("contain")) return refuse(`${BROLL_TEXT.tooSmall} (اللقطة «${clip.label}»: ${clip.width}×${clip.height})`);
  const slot = freeRoomAt(m, options.atFrame ?? 0, limitFrame(m), Math.ceil(fps));
  if (!slot) return refuse(BROLL_TEXT.noRoom);
  const wanted = Math.round(options.durationInFrames ?? 2 * fps);
  const durationInFrames = Math.max(1, Math.min(wanted, slot.room, clip.frames - clip.inFrame));
  const id = uniqueSlug("broll", new Set(m.scenes.map((x) => x.id)));
  const scene = {
    id, fromFrame: slot.from, durationInFrames, family: "screens", layout: "takeover", motion: "quiet",
    data: { look: "broll", steps: [{ atFrame: 0, src: clip.src, sha256: clip.sha256, width: clip.width, height: clip.height, trimBeforeFrame: clip.inFrame, fit: contained ? "contain" : "cover" }] },
  } as Scene;
  const [scenes, index] = insertSorted(m.scenes, scene, (x) => x.fromFrame);
  return finalize(m, { ...m, scenes }, { id, index }, contained ? [BROLL_TEXT.added, BROLL_TEXT.addedContained] : [BROLL_TEXT.added]);
}
