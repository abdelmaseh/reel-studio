import { creativeGalleryDefaults } from "../../creative-kit/schema.ts";
import {semanticTemplateData} from '../../creative-kit/semantic/schema.ts';
import {GRID_GLIDE_FAMILIES} from '../../styles/grid-glide/scenes/schema.ts';
import {gridGlideTemplateData} from '../../styles/grid-glide/scenes/templates.ts';


export const TEMPLATE_DATA: Record<string, unknown> = {
  ...semanticTemplateData,
  ...gridGlideTemplateData,
  intro: creativeGalleryDefaults.intro,
  proof: creativeGalleryDefaults.proof,
  process: creativeGalleryDefaults.process,
  comparison: creativeGalleryDefaults.comparison,
  comment: creativeGalleryDefaults.comment,
  follow: creativeGalleryDefaults.follow,
};





const REAL_VALUES: ReadonlySet<string> = new Set(["follow.handle", "glide-follow.pill.label"]);


const GLIDE_CHOICES: ReadonlySet<string> = new Set(["kind", "role", "from", "dir", "sha256"]);


export function sceneDemoFields(scene: { family: string; data: unknown }): string[] {
  const demo = TEMPLATE_DATA[scene.family];
  if (!demo) return [];
  const out: string[] = [];
  const glide = (GRID_GLIDE_FAMILIES as readonly string[]).includes(scene.family);
  const walk = (d: unknown, a: unknown, path: (string | number)[]) => {
    if (typeof d === "string") {
      const choice = glide && GLIDE_CHOICES.has(String(path[path.length - 1]));
      if (a === d && !choice && !REAL_VALUES.has(`${scene.family}.${path.join(".")}`)) out.push(path.join("."));
    } else if (Array.isArray(d)) {
      if (Array.isArray(a)) d.forEach((x, i) => walk(x, a[i], [...path, i]));
    } else if (d && typeof d === "object" && a && typeof a === "object") {
      for (const k of Object.keys(d)) walk((d as Record<string, unknown>)[k], (a as Record<string, unknown>)[k], [...path, k]);
    }
  };
  walk(demo, scene.data, []);
  return out;
}

export type DemoScene = { index: number; id: string; family: string; fields: string[] };


export function demoScenes(m: { scenes: readonly { id: string; family: string; data: unknown }[] }): DemoScene[] {
  const out: DemoScene[] = [];
  m.scenes.forEach((scene, index) => {
    const fields = sceneDemoFields(scene);
    if (fields.length) out.push({ index, id: scene.id, family: scene.family, fields });
  });
  return out;
}
