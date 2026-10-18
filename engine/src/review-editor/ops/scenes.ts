import type { EditManifest } from "../../prepared-edit/schema.ts";
import { editSceneSchema } from "../../prepared-edit/schema.ts";
import { creativeGalleryDefaults, sceneFamilies } from "../../creative-kit/schema.ts";
import {semanticFamilies} from '../../creative-kit/semantic/schema.ts';
import {GRID_GLIDE_FAMILIES} from '../../styles/grid-glide/scenes/schema.ts';
import {gridGlideTemplate, gridGlideTemplateFrames} from '../../styles/grid-glide/scenes/templates.ts';
import {glideWords} from '../../styles/grid-glide/scenes/text.ts';
import {ONE_SHOT_FAMILIES} from '../../styles/one-shot/scenes/schema.ts';
import {oneShotTemplateFrames} from '../../styles/one-shot/scenes/templates.ts';
import {CARTOON_FAMILIES} from '../../styles/cartoon/scenes/math.ts';
import {cartoonEndingTemplate, cartoonTemplate, cartoonTemplateFrames} from '../../styles/cartoon/scenes/templates.ts';
import {ownSceneStyle} from '../../styles/registry.ts';
import {compileEdit} from '../../prepared-edit/timeline.ts';
import {minFramesAtFps} from '../../motion-concepts/timeline.ts';
import {getCatalogEntry,catalogDemo} from '../../motion-concepts/catalog.ts';
import type {ConceptId} from '../../motion-concepts/types.ts';
import { totalFrames } from "../time.ts";
import { HANDLE_PATTERN } from "../../prepared-edit/creator.ts";
import { sampleNumberPaths } from "../../prepared-edit/sample-numbers.ts";
import { carryEntrances, dropForegrounds, repairForegrounds } from "./anchors.ts";
import { deepEqual, removeIn, setIn, type Path } from "./paths.ts";
import { TEMPLATE_DATA } from "./demo.ts";
import { finalize, refuse, unchanged, type OpResult } from "./result.ts";
import { KIT_LAYOUT, KIT_TEMPLATE_FAMILIES, TEMPLATE_TEXT, isKitFamily, kitTemplate, type KitTemplateFamily } from "./templates.ts";
import { clamp, insertSorted, limitFrame, removeAt, replaceAt, sceneEnd, sceneIndex, uniqueSlug, type Scene } from "./util.ts";

export { sceneDemoFields, demoScenes, type DemoScene } from "./demo.ts";
export { KIT_TEMPLATE_FAMILIES, kitTemplate, type KitTemplateFamily } from "./templates.ts";

export const LAYOUTS = ["presenter", "split", "takeover"] as const;
export const MOTIONS = ["land", "stagger", "quiet"] as const;
export type SceneLayout = (typeof LAYOUTS)[number];
export type SceneMotion = (typeof MOTIONS)[number];


export const TEMPLATE_FAMILIES = [...sceneFamilies,...semanticFamilies,...KIT_TEMPLATE_FAMILIES,...GRID_GLIDE_FAMILIES,...ONE_SHOT_FAMILIES,...CARTOON_FAMILIES];

// The scene families that count as the video's ending: the delivery gate (scripts/lib/endings.mjs) allows only one ending.
const ENDING_FAMILIES: readonly string[] = ["comment", "follow", "glide-comment", "glide-follow", "creator-cta"];
const NO_ROOM_AFTER_LAST = "لا توجد مساحة بعد آخر مشهد وقبل نهاية الفيديو. قصّر المشهد الأخير أولًا.";


/**
 * Why the creator-cta scene cannot be added to this edit, or null when it can. The delivery gate accepts it only with the
 * profile's comment keyword and a complete handle, as the last scene, and only when no other ending scene exists.
 */
export function creatorCtaIssue(m: EditManifest): string | null {
  const creator = m.creator;
  if (!creator) return "لا يوجد ملف للمبدع في هذا الفيديو، فلا يمكن إضافة دعوة التعليق والمتابعة.";
  const { cta, followCard } = creator.ending;
  if (typeof cta !== "string" || cta.length === 0 || cta.length > 20) return "الملف الشخصي لا يحدد كلمة مفتاحية للتعليق (حتى ٢٠ حرفًا).";
  if (!followCard) return "بطاقة المتابعة مغلقة في الملف الشخصي.";
  if (!creator.handle || !HANDLE_PATTERN.test(creator.handle)) return "الملف الشخصي لا يحتوي معرّفًا كاملًا بصيغة @name.";
  if (m.scenes.some((scene) => ENDING_FAMILIES.includes(scene.family))) return "في الفيديو مشهد ختام موجود بالفعل. عدّله أو احذفه أولًا.";
  const last = m.scenes[m.scenes.length - 1];
  if (limitFrame(m) - (last ? sceneEnd(last) : 0) < Math.ceil(2 * m.source.fps)) return NO_ROOM_AFTER_LAST;
  return null;
}


function kitRefusal(m: EditManifest, family: KitTemplateFamily): string | null {
  if (m.contentMode === "graphics" && KIT_LAYOUT[family] !== "takeover") return `مشاريع الجرافيك تقبل مشاهد الشاشة الكاملة فقط، والمشهد «${family}» ليس منها.`;
  return family === "creator-cta" ? creatorCtaIssue(m) : null;
}


/** The families the picker offers: own-style families only for their style and, when the edit is given, only the kit templates it can take. */
export function templateFamiliesFor(style: string, m?: EditManifest): string[] {
  return TEMPLATE_FAMILIES.filter((family) => {
    const owner = ownSceneStyle(family);
    if (owner !== undefined && owner !== style) return false;
    return !(m !== undefined && isKitFamily(family) && kitRefusal(m, family) !== null);
  });
}
const MIN_SCENE_FRAMES = 30;
const DEFAULT_SCENE_FRAMES = creativeGalleryDefaults.framesPerScene;

const noScene = (id: string) => refuse(`مفيش مشهد اسمه "${id}".`);


export function allowedLayouts(scene: Scene): SceneLayout[] {
  return LAYOUTS.filter((layout) => layout === scene.layout || editSceneSchema.safeParse({ ...scene, layout }).success);
}


export function freeRoomAt(m: EditManifest, atFrame: number, limit: number, minRoom: number): { from: number; room: number } | null {
  let cursor = Math.max(0, Math.round(atFrame));
  for (const s of m.scenes) {
    if (cursor >= sceneEnd(s)) continue;
    if (cursor >= s.fromFrame) {
      cursor = sceneEnd(s);
      continue;
    }
    const room = Math.min(s.fromFrame, limit) - cursor;
    if (room >= minRoom) return { from: cursor, room };
    cursor = sceneEnd(s);
  }
  const room = limit - cursor;
  return room >= minRoom ? { from: cursor, room } : null;
}








export function moveScene(m: EditManifest, id: string, toFrame: number): OpResult {
  const i = sceneIndex(m, id);
  if (i < 0) return noScene(id);
  if (!Number.isFinite(toFrame)) return refuse("الفريم لازم يبقى رقم.");
  const s = m.scenes[i];
  const lo = i > 0 ? sceneEnd(m.scenes[i - 1]) : 0;
  const hi = (i < m.scenes.length - 1 ? m.scenes[i + 1].fromFrame : totalFrames(m)) - s.durationInFrames;
  if (lo > hi) return refuse("مفيش مساحة تتحرك فيها المشهد ده.");
  const from = clamp(Math.round(toFrame), lo, hi);
  if (from === s.fromFrame) return unchanged(m);
  const notes = from !== Math.round(toFrame) ? ["المشهد اتحرك لحد ما لمس المشهد اللي جنبه (أو حدّ الفيديو)."] : [];
  return finishMove(m, replaceAt(m.scenes, i, { ...s, fromFrame: from }), s.fromFrame, from, notes);
}





export function resizeScene(m: EditManifest, id: string, edge: "start" | "end", toFrame: number): OpResult {
  const i = sceneIndex(m, id);
  if (i < 0) return noScene(id);
  if (!Number.isFinite(toFrame)) return refuse("الفريم لازم يبقى رقم.");
  const s = m.scenes[i];
  const end = sceneEnd(s);
  const target = Math.round(toFrame);
  let scene: Scene;
  if (edge === "start") {
    const lo = i > 0 ? sceneEnd(m.scenes[i - 1]) : 0;
    const from = clamp(target, lo, end - 1);
    if (from === s.fromFrame) return unchanged(m);
    scene = { ...s, fromFrame: from, durationInFrames: end - from };
  } else {
    const hi = i < m.scenes.length - 1 ? m.scenes[i + 1].fromFrame : totalFrames(m);
    const to = clamp(target, s.fromFrame + 1, hi);
    if (to === end) return unchanged(m);
    scene = { ...s, durationInFrames: to - s.fromFrame };
  }
  const requested = edge === "start" ? scene.fromFrame === target : sceneEnd(scene) === target;
  return finishMove(m, replaceAt(m.scenes, i, scene), s.fromFrame, scene.fromFrame, requested ? [] : ["الحدّ اتقصّ عشان ميتداخلش مع اللي جنبه."]);
}


export function setSceneDuration(m: EditManifest, id: string, durationInFrames: number): OpResult {
  const s = m.scenes.find((x) => x.id === id);
  if (!s) return noScene(id);
  return resizeScene(m, id, "end", s.fromFrame + Math.round(durationInFrames));
}

function finishMove(m: EditManifest, scenes: Scene[], oldFrom: number, newFrom: number, notes: string[]): OpResult {
  let next: EditManifest = carryEntrances({ ...m, scenes }, oldFrom, newFrom);
  const repaired = repairForegrounds(next);
  if (repaired.failed.length) return refuse(`الـ foreground بتاع المشهد "${repaired.failed[0]}" مش هيغطي المكان الجديد. اختار مكان تاني أو شيل الـ foreground.`);
  next = repaired.manifest;
  return finalize(m, next, undefined, notes);
}







export function deleteScene(m: EditManifest, id: string): OpResult {
  const i = sceneIndex(m, id);
  if (i < 0) return noScene(id);
  const s = m.scenes[i];
  const notes: string[] = [];
  let next: EditManifest = { ...m, scenes: removeAt(m.scenes, i) };
  const gone = m.transitions?.filter((t) => t.atFrame === s.fromFrame).length ?? 0;
  if (gone) {
    next = { ...next, transitions: m.transitions!.filter((t) => t.atFrame !== s.fromFrame) };
    notes.push(`اتشال ${gone} transition كان على أول المشهد.`);
  }
  const goneLayout = m.layoutTransitions?.filter((t) => t.atFrame === s.fromFrame).length ?? 0;
  if (goneLayout) {
    next = { ...next, layoutTransitions: m.layoutTransitions!.filter((t) => t.atFrame !== s.fromFrame) };
    notes.push(`اتشال ${goneLayout} layout transition كان على أول المشهد.`);
  }
  const pip = m.footage?.pip;
  if (pip?.sceneIds.includes(id)) {
    const ids = pip.sceneIds.filter((x) => x !== id);
    if (ids.length) next = { ...next, footage: { ...m.footage!, pip: { ...pip, sceneIds: ids } } };
    else {
      const { pip: _pip, ...footage } = m.footage!;
      next = { ...next, footage };
      notes.push("اتشال الـ PiP لأنه كان على المشهد ده بس.");
    }
  }
  return finalize(m, next, undefined, notes);
}






export function duplicateScene(m: EditManifest, id: string, atFrame?: number): OpResult<{ id: string; index: number }> {
  const i = sceneIndex(m, id);
  if (i < 0) return noScene(id);
  const s = m.scenes[i];
  const limit = limitFrame(m);
  const slot = freeRoomAt(m, atFrame ?? sceneEnd(s), limit, s.durationInFrames) ?? freeRoomAt(m, 0, limit, s.durationInFrames);
  if (!slot) return refuse(`مفيش مساحة فاضية بطول ${s.durationInFrames} فريم عشان النسخة.`);
  const newId = uniqueSlug(`${s.id}-copy`, new Set(m.scenes.map((x) => x.id)));
  const copy = { ...structuredClone(s), id: newId, fromFrame: slot.from } as Scene;
  const [scenes, index] = insertSorted(m.scenes, copy, (x) => x.fromFrame);
  let next: EditManifest = { ...m, scenes };
  const notes: string[] = [];
  const repaired = repairForegrounds(next);
  next = repaired.manifest;
  if (repaired.failed.includes(newId)) {
    next = dropForegrounds(next, [newId]);
    notes.push("النسخة اتعملت من غير الـ foreground لأنه مش هيغطي المكان الجديد.");
  }
  return finalize(m, next, { id: newId, index }, notes);
}




export function setSceneData(m: EditManifest, id: string, data: unknown): OpResult {
  const i = sceneIndex(m, id);
  if (i < 0) return noScene(id);
  const s = m.scenes[i];
  if (data === s.data || deepEqual(data, s.data)) return unchanged(m);
  return finalize(m, { ...m, scenes: replaceAt(m.scenes, i, { ...s, data } as Scene) });
}


export function setSceneField(m: EditManifest, id: string, path: Path, value: unknown): OpResult {
  const s = m.scenes.find((x) => x.id === id);
  if (!s) return noScene(id);
  if (!path.length) return setSceneData(m, id, value);
  return setSceneData(m, id, value === undefined ? removeIn(s.data, path) : setIn(s.data, path, value));
}

export function setLayout(m: EditManifest, id: string, layout: SceneLayout): OpResult {
  const i = sceneIndex(m, id);
  if (i < 0) return noScene(id);
  const s = m.scenes[i];
  if (s.layout === layout) return unchanged(m);
  if (!allowedLayouts(s).includes(layout)) {
    return refuse(`الـ family «${s.family}» بتشتغل بـ layout ${allowedLayouts(s).join(" / ")} بس.`);
  }
  return finalize(m, { ...m, scenes: replaceAt(m.scenes, i, { ...s, layout } as Scene) });
}

export function setMotion(m: EditManifest, id: string, motion: SceneMotion): OpResult {
  const i = sceneIndex(m, id);
  if (i < 0) return noScene(id);
  const s = m.scenes[i];
  if (s.motion === motion) return unchanged(m);
  if (!(MOTIONS as readonly string[]).includes(motion)) return refuse(`الـ motion لازم يكون واحد من: ${MOTIONS.join(" / ")}.`);
  return finalize(m, { ...m, scenes: replaceAt(m.scenes, i, { ...s, motion } as Scene) });
}









function addKitScene(m: EditManifest, family: KitTemplateFamily, options: { atFrame?: number; durationInFrames?: number }): OpResult<{ id: string; index: number }> {
  const refusal = kitRefusal(m, family);
  if (refusal) return refuse(refusal);
  const fps = m.source.fps;
  const least = Math.ceil(2 * fps);
  const limit = limitFrame(m);
  const last = m.scenes[m.scenes.length - 1];
  const after = last ? sceneEnd(last) : 0;
  // The ending scene is always the last one, whatever the playhead says; every other template goes where the playhead finds room.
  const slot = family === "creator-cta" ? (limit - after >= least ? { from: after, room: limit - after } : null) : freeRoomAt(m, options.atFrame ?? 0, limit, least);
  if (!slot) return refuse(family === "creator-cta" ? NO_ROOM_AFTER_LAST : "لا توجد مساحة خالية بطول ثانيتين على الأقل لمشهد جديد. قصّر مشهدًا أو انقل المؤشر إلى مكان خالٍ.");
  const asked = options.durationInFrames === undefined ? slot.room : Math.min(slot.room, Math.round(options.durationInFrames));
  if (!(asked >= least)) return refuse("مدة المشهد يجب ألا تقل عن ثانيتين.");
  const kit = kitTemplate(family, fps, asked);
  if (family === "creator-cta") {
    kit.data.keyword = m.creator!.ending.cta;
    kit.data.handle = m.creator!.handle;
  }
  const id = uniqueSlug(family, new Set(m.scenes.map((x) => x.id)));
  const scene = { id, fromFrame: slot.from, durationInFrames: kit.frames, family, layout: kit.layout, motion: creativeGalleryDefaults.motion, data: kit.data } as Scene;
  const [scenes, index] = insertSorted(m.scenes, scene, (x) => x.fromFrame);
  return finalize(m, { ...m, scenes }, { id, index }, sampleNumberPaths(scene).length ? [TEMPLATE_TEXT.added, TEMPLATE_TEXT.addedWithNumber] : [TEMPLATE_TEXT.added]);
}


export function addSceneFromTemplate(m: EditManifest, family: string, options: { atFrame?: number; durationInFrames?: number; concept?: ConceptId } = {}): OpResult<{ id: string; index: number }> {
  const data = family === 'motion-concept' && options.concept ? {concept: options.concept, config: catalogDemo(options.concept)} : TEMPLATE_DATA[family];
  if (!data) return refuse(`مفيش قالب آمن للـ family «${family}». انسخ مشهد موجود منها (نسخ) وعدّل عليه.`);
  const owner = ownSceneStyle(family);
  if (owner !== undefined && owner !== m.style) return refuse(`المشهد «${family}» متاح في ستايل ${owner} فقط، والستايل الحالي ${m.style}. غيّر الستايل أولا أو اختر نوع مشهد آخر.`);
  if (isKitFamily(family)) return addKitScene(m, family, options);
  const glide = (GRID_GLIDE_FAMILIES as readonly string[]).includes(family);
  const oneShot = (ONE_SHOT_FAMILIES as readonly string[]).includes(family);
  const cartoon = (CARTOON_FAMILIES as readonly string[]).includes(family);
  const defaultFrames=glide?gridGlideTemplateFrames(family,m.source.fps):oneShot?oneShotTemplateFrames(m.source.fps):cartoon?cartoonTemplateFrames(m.source.fps):family==='message-board'?minFramesAtFps(180,m.source.fps):family==='motion-concept'
    ?minFramesAtFps(getCatalogEntry((data as {concept:string}).concept).defaultFrames,m.source.fps):DEFAULT_SCENE_FRAMES;
  const wanted = Math.round(options.durationInFrames ?? defaultFrames);
  if (!(wanted >= 1)) return refuse("مدة المشهد لازم تبقى فريم واحد على الأقل.");
  // Fixed-cue templates need their whole duration; concepts may shrink only to their native
  // fps-scaled choreography floor. Short ordinary scenes keep their existing gap behaviour.
  const minRoom = glide || oneShot || cartoon ? wanted : family === 'motion-concept'
    ? minFramesAtFps(getCatalogEntry((data as {concept: string}).concept).minFrames, m.source.fps)
    : Math.min(MIN_SCENE_FRAMES, wanted);
  const slot = freeRoomAt(m, options.atFrame ?? 0, limitFrame(m), minRoom);
  if (!slot) return refuse("مفيش مساحة فاضية كفاية لمشهد جديد. قصّر مشهد أو حرّك الـ playhead لمكان فاضي.");
  const id = uniqueSlug(family, new Set(m.scenes.map((x) => x.id)));
  const scene = {
    id,
    fromFrame: slot.from,
    durationInFrames: Math.min(wanted, slot.room),
    family,
    layout: creativeGalleryDefaults.layout,
    motion: creativeGalleryDefaults.motion,
    data: glide ? gridGlideTemplate(family, m.source.fps) : structuredClone(data),
  } as Scene;
  // The Grid Glide ending scenes say the creator's own words: the CTA keyword and the profile handle. A profile that has none
  // (or a CTA of more than three words, which a keyword scene cannot hold) keeps the template placeholder.
  const cta=m.creator?.ending.cta;
  if(scene.family==='glide-comment' && typeof cta==='string' && glideWords(cta).length<=3)scene.data.keyword=cta;
  if(scene.family==='glide-follow' && m.creator?.handle)scene.data.handle=m.creator.handle;
  if(cartoon){
    // A cartoon scene is built over the reviewed words inside its own window: its sentences, cards and flips are word anchors.
    let compiled:ReturnType<typeof compileEdit>;
    try{compiled=compileEdit(m);}
    catch{return refuse('توقيت الكلمات مش كافي لعرضها على فريمات الفيديو. راجع التوقيت قبل إضافة مشهد كارتون.');}
    const inScene=compiled.words.filter(word=>word.fromFrame>=scene.fromFrame && word.fromFrame<sceneEnd(scene));
    if(inScene.length<2)return refuse('مشهد الكارتون محتاج كلمات مراجَعة جوه مدته: حرّك الـ playhead لمكان فيه كلام.');
    scene.layout='takeover';scene.motion='quiet';
    scene.data=family===CARTOON_FAMILIES[0]
      ?cartoonTemplate(inScene,{fps:m.source.fps,sceneFrom:scene.fromFrame,durationInFrames:scene.durationInFrames})
      :cartoonEndingTemplate(inScene,{handle:m.creator?.handle??null});
  }
  if(scene.family==='message-board'){
    for(const key of ['gatherFrame','gatherDurationFrames','focusFrame','focusDurationFrames'] as const)scene.data[key]=Math.round(scene.data[key]*m.source.fps/30);
    if(scene.data.closingFrame!==undefined)scene.data.closingFrame=Math.round(scene.data.closingFrame*m.source.fps/30);
  }
  if(scene.family==='kinetic-text'){
    let compiled:ReturnType<typeof compileEdit>;
    try{compiled=compileEdit(m);}
    catch{return refuse('توقيت الكلمات مش كافي لعرضها على فريمات الفيديو. راجع التوقيت أو تجميع الكابشن قبل إضافة كلمات متحركة.');}
    const selected=compiled.words.filter(word=>word.fromFrame>=scene.fromFrame && word.toFrame<=sceneEnd(scene));
    if(!selected.length)return refuse('المشهد ده محتاج كلمات مسجلة في الفترة اللي اخترتها. اختار جزء فيه كلام من الترانسكريبت.');
    scene.data.sourceIndices=[...new Set(selected.map(word=>word.sourceIndex))].sort((a,b)=>a-b).slice(0,32);
    scene.data.lang=selected.some(word=>/[\u0600-\u06ff]/.test(word.text))?'ar':'en';
  }
  const [scenes, index] = insertSorted(m.scenes, scene, (x) => x.fromFrame);
  return finalize(m, { ...m, scenes }, { id, index }, [TEMPLATE_TEXT.added]);
}
