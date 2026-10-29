import React from "react";
import { GirihBackdrop, type GirihBackdropProps } from "./girih";
import { BACKDROP_KINDS, type BackdropKind } from "./index.ts";
import { PaperBackdrop } from "./paper";
import { SunburstBackdrop } from "./sunburst";

/** What every backdrop takes: `colour` is the style's accent and `ground` its background; each backdrop uses what it needs and ignores the rest. */
export type BackdropProps = GirihBackdropProps & { ground?: string };

/**
 * The one door for scenes that take a `backdrop` by name (arabic-type `backdrop: "girih" | "sunburst" | "paper"`, and any style that wants one).
 * An unknown kind fails loudly instead of silently drawing nothing.
 */
export const Backdrop: React.FC<{ kind: BackdropKind } & BackdropProps> = ({ kind, ground, ...rest }) => {
  switch (kind) {
    case "girih": return <GirihBackdrop {...rest} />;
    case "sunburst": return <SunburstBackdrop colour={rest.colour} ground={ground} speed={rest.speed} />;
    case "paper": return <PaperBackdrop />;
    default: throw new Error(`Unknown backdrop ${JSON.stringify(kind)}. Choose ${BACKDROP_KINDS.join(", ")}.`);
  }
};
