import { getStyleMeta, type StyleId } from "./registry";
import type { GalleryCut, SceneTheme, StyleLayout, StyleThemeModule } from "./theme-types";
import calligraphicReceipts from "./calligraphic-receipts/theme";
import kineticPaper from "./kinetic-paper/theme";
import liquidGlass from "./liquid-glass/theme";
import magazineInterview from "./magazine-interview/theme";
import paperCollage from "./paper-collage/theme";
import sectionDeck from "./section-deck/theme";
import gridGlide from "./grid-glide/theme";
import oneShot from "./one-shot/theme";
import cartoon from "./cartoon/theme";
import documentary from "./documentary/theme";
import layeredSpeaker from "./layered-speaker/theme";

/** One entry per registered style. A style without an entry fails the typecheck. */
const THEMES: Record<StyleId, StyleThemeModule> = {
  "section-deck": sectionDeck,
  "kinetic-paper": kineticPaper,
  "calligraphic-receipts": calligraphicReceipts,
  "paper-collage": paperCollage,
  "liquid-glass": liquidGlass,
  "magazine-interview": magazineInterview,
  "grid-glide": gridGlide,
  "one-shot": oneShot,
  "cartoon": cartoon,
  "documentary": documentary,
  "layered-speaker": layeredSpeaker,
};

// getStyleMeta throws `Unknown style "x". Choose one of: ...` for an id outside the registry.
const resolve = (style: StyleId) => { const meta = getStyleMeta(style); return { meta, entry: THEMES[meta.id] }; };

/** The scene theme. Adapted styles carry their grammar from the meta; legacy styles have none. */
export function getStyleTheme(style: StyleId): SceneTheme {
  const { meta, entry } = resolve(style);
  return meta.legacy ? { ...entry.theme } : { ...entry.theme, grammar: meta.grammar };
}

export function getStyleLayout(style: StyleId): StyleLayout {
  return resolve(style).entry.layout;
}

export function getGalleryCut(style: StyleId): GalleryCut {
  return resolve(style).entry.galleryCut;
}

/** Optional caption contract belongs to the theme module; no style-name policy in the compositor. */
export function getStyleCaption(style:StyleId) {return resolve(style).entry.caption;}
