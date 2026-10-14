import { getStyleMeta, type StyleId } from "./registry";
import type { GalleryCut, SceneTheme, StyleLayout, StyleThemeModule } from "./theme-types";
import calligraphicReceipts from "./calligraphic-receipts/theme";
import campaignTickets from "./campaign-tickets/theme";
import judgmentBoard from "./judgment-board/theme";
import kineticPaper from "./kinetic-paper/theme";
import liquidGlass from "./liquid-glass/theme";
import magazineInterview from "./magazine-interview/theme";
import paperCollage from "./paper-collage/theme";
import scrapbookRoute from "./scrapbook-route/theme";
import sectionDeck from "./section-deck/theme";
import splitCanvas from "./split-canvas/theme";
import steppedEditorial from "./stepped-editorial/theme";
import gridGlide from "./grid-glide/theme";

/** One entry per registered style. A style without an entry fails the typecheck. */
const THEMES: Record<StyleId, StyleThemeModule> = {
  "split-canvas": splitCanvas,
  "section-deck": sectionDeck,
  "kinetic-paper": kineticPaper,
  "calligraphic-receipts": calligraphicReceipts,
  "paper-collage": paperCollage,
  "judgment-board": judgmentBoard,
  "stepped-editorial": steppedEditorial,
  "liquid-glass": liquidGlass,
  "campaign-tickets": campaignTickets,
  "magazine-interview": magazineInterview,
  "scrapbook-route": scrapbookRoute,
  "grid-glide": gridGlide,
};

// getStyleMeta throws `Unknown style "x". Choose one of: ...` for an id outside the registry.
const resolve = (style: StyleId) => ({ meta: getStyleMeta(style), entry: THEMES[style] });

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
