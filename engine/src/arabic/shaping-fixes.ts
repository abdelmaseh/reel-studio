// Small text fixes for how Arabic is revealed or set in particular fonts. Pure and Node-safe.
import { graphemes, joinsForward, joiningTypeOfCode } from "./joining.ts";

const ZWJ = "‍";
const TEH_MARBUTA = 0x0629;
const HAMZA = 0x0621;

/**
 * The first `visible` user-perceived characters of a line, ready to draw while the rest is still hidden.
 *
 * A letter that joins the next one is drawn in its isolated form when the next one is missing, so the typed text would
 * flip shape each time a letter arrives. When the last visible letter joins forward in the full text, a zero width joiner
 * is added so it keeps its connected shape. A letter with its harakat counts as one step.
 */
export function typewriterSlice(text: string, visible: number): string {
  const count = Math.floor(visible);
  if (!(count > 0)) return "";
  const parts = graphemes(text);
  if (count >= parts.length) return text;
  const shown = parts.slice(0, count).join("");
  // The last base letter of the shown part sits at the start of its grapheme.
  const lastStart = shown.length - parts[count - 1].length;
  return joinsForward(text, lastStart) ? shown + ZWJ : shown;
}

/**
 * Aref Ruqaa drops the dots of a final teh marbuta that follows a letter which does not connect forward (ا د ذ ر ز و …).
 * A zero width joiner before the teh marbuta keeps the dots. Applies to every word of the text; text that already has the
 * joiner there, or whose letter before the teh marbuta connects, comes back unchanged.
 */
export function rubaaFix(text: string): string {
  const chars = Array.from(text);
  const out: string[] = [];
  const codeOf = (ch: string): number => ch.codePointAt(0) as number;
  const typeOf = (ch: string) => joiningTypeOfCode(codeOf(ch));
  // An Arabic letter that does not connect to the letter after it: right-joining letters and the stand-alone hamza.
  const stopsJoin = (ch: string): boolean => typeOf(ch) === "R" || codeOf(ch) === HAMZA;
  const isLetter = (ch: string): boolean => typeOf(ch) === "R" || typeOf(ch) === "D" || codeOf(ch) === HAMZA;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (codeOf(ch) === TEH_MARBUTA) {
      // Final: no Arabic letter follows (marks are skipped).
      let k = i + 1;
      while (k < chars.length && typeOf(chars[k]) === "T") k += 1;
      const final = k >= chars.length || !isLetter(chars[k]);
      // The letter before it: skip marks. An existing joiner or tatweel there means there is nothing to fix.
      let j = out.length - 1;
      while (j >= 0 && typeOf(out[j]) === "T") j -= 1;
      if (final && j >= 0 && stopsJoin(out[j])) out.push(ZWJ);
    }
    out.push(ch);
  }
  return out.join("");
}
