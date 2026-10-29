// Looks: whole-picture treatments applied over any style (manifest root key `look`), and the backdrops scenes can ask for by name.
// This file is Node-safe on purpose (no JSX, no React): the manifest schema, the editor operations, the library inventory and the
// tests import it directly. The components live in layer.tsx, riso.tsx, blueprint.tsx, film.tsx, paper.tsx, girih.tsx, sunburst.tsx and
// backdrop.tsx; the numbers of the layers built on @remotion/effects (film, paper, sunburst) are in effects.ts.
import { z } from "zod";
import { inkPairIssues } from "./math.ts";

export * from "./math.ts";
export * from "./noise.ts";
export * from "./captions.ts";
export * from "./effects.ts";

/**
 * Looks are whole-picture treatments; none is a style (the registered styles live under styles/). riso and blueprint are SVG filters and CSS over
 * the finished picture. film and paper leave the picture as it is and add one layer of their own over it (a <Solid> with effects from
 * @remotion/effects, blended in with a CSS blend mode); the layer is drawn above the picture and below the captions.
 */
export const LOOK_KINDS = ["riso", "blueprint", "film", "paper"] as const;
export type LookKind = (typeof LOOK_KINDS)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/**
 * The manifest root key. `inks` is a riso option: two #RRGGBB colours, the first ink carries the structure and the second the warm
 * tones. Without it the riso look uses blue and fluorescent pink.
 */
export const lookSchema = z.object({
  kind: z.enum(LOOK_KINDS),
  inks: z.tuple([hex, hex]).optional(),
}).strict().superRefine((look, ctx) => {
  if (look.inks === undefined) return;
  if (look.kind !== "riso") {
    ctx.addIssue({ code: "custom", path: ["inks"], message: "Inks apply to the riso look only." });
    return;
  }
  for (const message of inkPairIssues(look.inks)) ctx.addIssue({ code: "custom", path: ["inks"], message });
});
export type LookSpec = z.infer<typeof lookSchema>;

/** Backdrops that scenes (arabic-type) and styles can ask for by name: `<Backdrop kind="girih" .../>` in backdrop.tsx. */
export const BACKDROP_KINDS = ["girih", "sunburst", "paper"] as const;
export type BackdropKind = (typeof BACKDROP_KINDS)[number];

/** What the editor and the library call each backdrop. A new kind must be named here (the compiler checks it). */
export const BACKDROP_LABEL: Readonly<Record<BackdropKind, string>> = {
  girih: "نجوم هندسية",
  sunburst: "شمس",
  paper: "ورقة",
};
