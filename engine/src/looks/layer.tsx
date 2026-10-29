import React from "react";
import { useProbe } from "../core/safe";
import { BlueprintLook, BlueprintOverlay } from "./blueprint";
import { FilmLook } from "./film";
import { resolveInks, type LookSpec } from "./index.ts";
import { PaperLook } from "./paper";
import { RisoLook } from "./riso";

/**
 * Wraps the picture (canvas, footage, scenes, picture-in-picture) in the chosen look. Captions and transition overlays are mounted by
 * PreparedEdit outside this wrapper, so their pixels are never filtered. With no look, and under the safe-zone probe, it is a
 * pass-through: the markup is exactly the children's.
 */
export const LookLayer: React.FC<{ look?: LookSpec | null; children?: React.ReactNode }> = ({ look, children }) => {
  const probe = useProbe();
  if (!look || probe) return <>{children}</>;
  switch (look.kind) {
    case "riso": return <RisoLook inks={resolveInks(look)}>{children}</RisoLook>;
    case "blueprint": return <><BlueprintLook>{children}</BlueprintLook><BlueprintOverlay /></>;
    case "film": return <FilmLook>{children}</FilmLook>;
    case "paper": return <PaperLook>{children}</PaperLook>;
    default: return <>{children}</>;
  }
};
