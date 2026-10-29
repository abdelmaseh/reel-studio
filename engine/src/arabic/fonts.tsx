// Waiting for fonts before text is measured or drawn into a canvas. Canvas effects rasterise a line once and cut it into
// blobs, so a line drawn in the fallback face before the real face arrives would be cut into the wrong pieces.
import { useEffect, useRef, useState } from "react";
import { continueRender, delayRender } from "remotion";

// Arabic letters, the tatweel, digits and Latin: faces are often split by unicode-range, and only the faces that cover the
// sample are fetched, so the sample has to touch every range the effect will draw.
const SAMPLE = "ابتثجحخدذرزسشصضطظعغفقكلمنهويء ـ 0123456789 ABCabc";
const TIMEOUT_MS = 10_000;

// Families already confirmed in this page: a later mount does not hold the render again.
const VERIFIED = new Set<string>();

const supported = (): boolean => typeof document !== "undefined" && typeof document.fonts !== "undefined";
const verifiedAll = (families: readonly string[]): boolean => families.every((family) => VERIFIED.has(family));
const fontSpec = (family: string): string => `16px "${family.replace(/"/g, '\\"')}"`;

/**
 * Holds the render (one `delayRender` handle) until every family is loaded in `document.fonts`, then returns true.
 * Without a browser (static markup in tests) it returns true at once. If a family does not arrive within 10 seconds the
 * render continues with a console warning, so a missing font file never hangs a render.
 */
export function useFontsReady(families: string[]): boolean {
  const key = families.join("|");
  const [initial] = useState<number | null>(() => (supported() && !verifiedAll(families) ? delayRender(`arabic/useFontsReady: ${key}`) : null));
  const [readyKey, setReadyKey] = useState<string | null>(initial === null ? key : null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (!supported()) {
      setReadyKey(key);
      return;
    }
    let handle = firstRun.current ? initial : null;
    firstRun.current = false;
    if (handle === null) {
      if (verifiedAll(families)) {
        setReadyKey(key);
        return;
      }
      handle = delayRender(`arabic/useFontsReady: ${key}`);
    }
    const mine = handle;
    let finished = false;
    const finish = (ok: boolean): void => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (ok) for (const family of families) VERIFIED.add(family);
      else console.warn(`arabic/useFontsReady: ${key} did not finish loading in ${TIMEOUT_MS / 1000}s; continuing with whatever is available.`);
      setReadyKey(key);
      continueRender(mine);
    };
    const timer = setTimeout(() => finish(false), TIMEOUT_MS);
    Promise.all(families.map((family) => document.fonts.load(fontSpec(family), SAMPLE)))
      .then(() => finish(families.every((family) => document.fonts.check(fontSpec(family), SAMPLE))))
      .catch(() => finish(false));
    // No cleanup on purpose: the handle must be released even if the component goes away first.
  }, [key]);

  return readyKey === key;
}
