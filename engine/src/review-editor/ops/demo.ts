import { creativeGalleryDefaults } from "../../creative-kit/schema.ts";
import {semanticTemplateData} from '../../creative-kit/semantic/schema.ts';
import {GRID_GLIDE_FAMILIES} from '../../styles/grid-glide/scenes/schema.ts';
import {gridGlideTemplateData} from '../../styles/grid-glide/scenes/templates.ts';
import {ONE_SHOT_FAMILIES} from '../../styles/one-shot/scenes/schema.ts';
import {oneShotTemplateData} from '../../styles/one-shot/scenes/templates.ts';
import {CARTOON_FAMILIES} from '../../styles/cartoon/scenes/math.ts';
import {CARTOON_COPY_KEYS, cartoonTemplateData} from '../../styles/cartoon/scenes/templates.ts';
import {CATALOG,catalogDemo} from '../../motion-concepts/catalog.ts';
import {kitTemplateData} from './templates.ts';


export const TEMPLATE_DATA: Record<string, unknown> = {
  ...semanticTemplateData,
  ...gridGlideTemplateData,
  ...oneShotTemplateData,
  ...cartoonTemplateData,
  ...kitTemplateData,
  intro: creativeGalleryDefaults.intro,
  proof: creativeGalleryDefaults.proof,
  process: creativeGalleryDefaults.process,
  comparison: creativeGalleryDefaults.comparison,
  comment: creativeGalleryDefaults.comment,
  follow: creativeGalleryDefaults.follow,
};





const REAL_VALUES: ReadonlySet<string> = new Set(["follow.handle", "glide-follow.pill.label", "one-shot.closing.platforms.0", "one-shot.closing.platforms.1", "one-shot.closing.platforms.2", "cartoon-ending.follow.handle"]);


const GLIDE_CHOICES: ReadonlySet<string> = new Set(["kind", "role", "from", "dir", "sha256"]);


// Structural choices of the kit templates: the creator keeps them on purpose, so they never count as sample text.
const KIT_CHOICES: ReadonlySet<string> = new Set(["checklist.variant", "count.suffix", "data-story.display", "data-story.suffix"]);


export function sceneDemoFields(scene: { family: string; data: unknown }): string[] {
  const concept = scene.family === 'motion-concept' ? CATALOG.find(entry => entry.id === (scene.data as {concept?: unknown} | null)?.concept)?.id : undefined;
  const demo = concept ? {concept, config: catalogDemo(concept)} : TEMPLATE_DATA[scene.family];
  if (!demo) return [];
  const out: string[] = [];
  const glide = (GRID_GLIDE_FAMILIES as readonly string[]).includes(scene.family) || (ONE_SHOT_FAMILIES as readonly string[]).includes(scene.family);
  // In a cartoon scene only creator copy counts as sample text; themes, kinds, colours, icons, shapes and ids are structural choices.
  const cartoon = (CARTOON_FAMILIES as readonly string[]).includes(scene.family);
  const lastKey = (path: (string | number)[]) => String([...path].reverse().find((part) => typeof part === 'string') ?? '');
  const walk = (d: unknown, a: unknown, path: (string | number)[]) => {
    if (typeof d === "string") {
      const choice = cartoon && !CARTOON_COPY_KEYS.has(lastKey(path)) || glide && GLIDE_CHOICES.has(String(path[path.length - 1])) || Boolean(concept) && ['concept', 'kind', 'op', 'field'].includes(String(path[path.length - 1])) || KIT_CHOICES.has(`${scene.family}.${path.join(".")}`);
      if (d !== "" && a === d && !choice && !REAL_VALUES.has(`${scene.family}.${path.join(".")}`)) out.push(path.join("."));
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
