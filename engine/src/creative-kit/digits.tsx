import React from "react";
import { displayDigits, type DigitMapOptions } from "../core/digits.ts";
import type { DigitChoice } from "../styles/types.ts";

// The video's digits preference, mounted once at the top of PreparedEdit. `null` means "as it is today": every reader
// then returns exactly what it was given, so a video that never chose digits renders byte for byte as before.
const DigitsCtx = React.createContext<DigitChoice | null>(null);

export const DigitsProvider: React.FC<{ digits: DigitChoice | null | undefined; children?: React.ReactNode }> = ({ digits, children }) =>
  <DigitsCtx.Provider value={digits ?? null}>{children}</DigitsCtx.Provider>;

/** The chosen digit set, or null when the creator chose none. */
export const useDigits = (): DigitChoice | null => React.useContext(DigitsCtx);

/** For numbers the engine builds itself: with no choice they are drawn in Latin digits, as they always were. */
export const useStatDigits = (): DigitChoice => useDigits() ?? "latin";

/** Text as it is shown: mapped to the chosen set, or unchanged with no choice. */
export const useDisplayText = (text: string, options?: DigitMapOptions): string => displayDigits(text, useDigits(), options);
