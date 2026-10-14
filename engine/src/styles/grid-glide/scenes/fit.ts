import { measureText } from "@remotion/layout-utils";
import { assertFontsReady } from "../../../core/fonts";
import { isArabic } from "../../../core/type";
import { OPTICAL_SIZE } from "./math";

// The only place the Grid Glide kit measures text. Measurement needs a browser, so the SSR tests
// replace this one module with a deterministic stand-in; everything else stays real.

type AdditionalStyles = NonNullable<Parameters<typeof measureText>[0]["additionalStyles"]>;

export type TextSpec = {
  family: string;
  size: number;
  weight: number;
  /** Latin only: the CSS text-transform the text is rendered with, so measuring and rendering agree. */
  transform?: "uppercase";
  /** Latin only: CSS letter-spacing as an em or px string. Arabic is never letter-spaced. */
  tracking?: string;
};

const EXTRAS = { fontVariationSettings: `"opsz" ${OPTICAL_SIZE}`, fontKerning: "normal" } as AdditionalStyles;

/** Width in px of one line of text, measured with the same optical size the kit renders with. */
export const textWidth = (text: string, spec: TextSpec): number => {
  assertFontsReady();
  return Math.ceil(
    measureText({
      text,
      fontFamily: spec.family,
      fontSize: spec.size,
      fontWeight: spec.weight,
      letterSpacing: isArabic(text) ? undefined : spec.tracking,
      textTransform: spec.transform ?? "none",
      additionalStyles: EXTRAS,
    }).width,
  );
};
