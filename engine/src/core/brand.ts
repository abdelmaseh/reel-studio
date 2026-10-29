import {
  bestInk,
  contrastRatio,
  describeIssues,
  mergeTheme,
  mixToHex,
  readableShift,
  relativeLuminance,
  themeContrastIssues,
  toHex,
  validateChapter,
  CHAPTER_MIN_CONTRAST,
  type ChapterPalette,
  type ChapterThemeTokens,
} from "./chapters.ts";
import { brandStyles, normalizeStyleId } from "../styles/registry.ts";

export type BrandColors = { primary: string; accent: string; background: string | null; text: string | null };
export type BrandStyle = "section-deck";
// Which styles take brand colours is declared in engine/src/styles/<id>/meta.ts (`brand: true`);
// the colour tokens each of them needs stay below.
export const BRAND_STYLES = brandStyles() as readonly BrandStyle[];



export const BRAND_STYLE_BASES: Record<BrandStyle, ChapterThemeTokens> = {
  "section-deck": { background: "#0F1B33", card: "rgba(16,16,22,0.72)", border: "rgba(255,255,255,0.16)", text: "#FFFFFF", dim: "rgba(255,255,255,0.55)", accent: "#FF6B35", good: "#4FBF67", bad: "#FF5C5C", pill: "#FFFFFF", pillText: "#141414" },
};

export const BRAND_STYLE_DEFAULTS: Record<BrandStyle, { ground: string; ink: string }> = {
  "section-deck": { ground: "#0F1B33", ink: "#FFFFFF" },
};

for (const style of BRAND_STYLES) {
  if (!BRAND_STYLE_BASES[style] || !BRAND_STYLE_DEFAULTS[style]) throw new Error(`core/brand: ${style} takes brand colours but has no brand tokens.`);
}
const BRAND_STYLE_NAMES = BRAND_STYLES.length > 1 ? `${BRAND_STYLES.slice(0, -1).join(", ")} and ${BRAND_STYLES[BRAND_STYLES.length - 1]}` : BRAND_STYLES.join("");

const WHITE = "#FFFFFF";
const BLACK = "#000000";

const deep = (color: string): string => mixToHex(color, "#0D0D11", 0.72);

const cardFor = (ground: string, ink: string): string =>
  mixToHex(ground, WHITE, relativeLuminance(ground) >= relativeLuminance(ink) ? 0.6 : 0.07);








export function fitChapter(ground: string, ink: string, accent: string): ChapterPalette {
  const g = toHex(ground);
  const pole = bestInk(g, [BLACK, WHITE]);
  const card = mixToHex(g, WHITE, pole === BLACK ? 0.6 : 0.07);
  const i = readableShift(toHex(ink), [g, card], pole);
  const a = readableShift(toHex(accent), [i], bestInk(i, [BLACK, WHITE]));
  return { ground: g, accent: a, ink: i, onAccent: i };
}


export function chapterProblems(style: BrandStyle, palette: ChapterPalette): string[] {
  const verdict = validateChapter(palette);
  if (!verdict.ok) return [describeIssues(verdict.issues)];
  const problems: string[] = [];
  const inkAccent = contrastRatio(palette.ink, palette.accent);
  if (inkAccent < CHAPTER_MIN_CONTRAST) problems.push(`ink/accent ${inkAccent.toFixed(2)}:1`);
  const inkCard = contrastRatio(palette.ink, cardFor(palette.ground, palette.ink));
  if (inkCard < CHAPTER_MIN_CONTRAST) problems.push(`ink/card ${inkCard.toFixed(2)}:1`);
  const issues = themeContrastIssues(mergeTheme(BRAND_STYLE_BASES[style], palette), { inkOnAccent: true });
  if (issues.length) problems.push(describeIssues(issues));
  return problems;
}

export type BrandPlan = { palettes: ChapterPalette[]; notices: string[] };



export function brandPalettes(style: BrandStyle, brand: BrandColors): BrandPlan {
  const ground = brand.background ?? BRAND_STYLE_DEFAULTS[style].ground;
  const ink = brand.text ?? BRAND_STYLE_DEFAULTS[style].ink;
  const specs =
    [{ ground, accent: brand.primary }, { ground: deep(brand.primary), accent: brand.accent }, { ground: deep(brand.accent), accent: brand.primary }];
  const palettes: ChapterPalette[] = [];
  let adjusted = 0;
  let refused = 0;
  for (const spec of specs) {
    const palette = fitChapter(spec.ground, ink, spec.accent);
    if (chapterProblems(style, palette).length) { refused++; continue; }
    if (palette.ink !== toHex(ink) || palette.accent !== toHex(spec.accent)) adjusted++;
    palettes.push(palette);
  }
  const notices: string[] = [];
  if (!palettes.length) notices.push(`Brand colours cannot be made readable in ${style}; this video uses the style's own colours.`);
  else if (refused) notices.push(`${refused} of ${specs.length} ${style} brand palettes could not be made readable and were skipped; the rest are used${adjusted ? ", some lightened or darkened for readability" : ""}.`);
  else if (adjusted) notices.push(`Some brand colours were lightened or darkened so text stays readable in ${style}.`);
  return { palettes, notices };
}

export type BrandableScene = { chapter?: ChapterPalette };


export function applyBrandToScenes<S extends BrandableScene>(style: string, brand: BrandColors | null, scenes: readonly S[]): { brand: ChapterPalette | undefined; scenes: S[]; notices: string[] } {
  style = normalizeStyleId(style);
  if (!brand) return { brand: undefined, scenes: [...scenes], notices: [] };
  if (!(BRAND_STYLES as readonly string[]).includes(style)) return { brand: undefined, scenes: [...scenes], notices: [`Brand colours apply to ${BRAND_STYLE_NAMES}; ${style} keeps its own colours.`] };
  const plan = brandPalettes(style as BrandStyle, brand);
  if (!plan.palettes.length) return { brand: undefined, scenes: [...scenes], notices: plan.notices };
  const n = plan.palettes.length;
  return { brand: plan.palettes[0], scenes: scenes.map((scene, index) => (scene.chapter ? scene : { ...scene, chapter: plan.palettes[index % n] })), notices: plan.notices };
}
