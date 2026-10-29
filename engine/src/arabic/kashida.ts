// Kashida (tatweel, U+0640) placement. Pure and Node-safe.
//
// A kashida stretches a word along one of its connections. Only a connection between two Arabic letters is legal: the first
// letter must join forward and the next letter must be able to receive the join. Where a mark sits on the first letter the
// tatweel goes after the whole mark cluster, never between a letter and its own mark.
//
// Our rules (spec section 3.1): never after ا أ إ آ ٱ د ذ ر ز و ؤ ة ء ى, never inside lam-alef, never at the start or the end
// of a word, words under three letters are left alone. Priority: +3 after س ش ص ض, +2 when the next letter is the last letter,
// -1 when that last letter is one of ب ت ث ن ي ئ. Among equal priorities the slot nearest the middle of the word wins, and
// if two are equally near, the one nearer the start of the word.
import { joiningTypeOfCode } from "./joining.ts";

export interface KashidaSlot {
  /** Insert one tatweel after text[index]. For a letter with marks, index is the last mark of its cluster. */
  index: number;
  priority: number;
}

const TATWEEL = "ـ";
const LAM = 0x0644;
const ALEFS = new Set([0x0627, 0x0623, 0x0625, 0x0622, 0x0671]);
const SEEN_FAMILY = new Set([0x0633, 0x0634, 0x0635, 0x0636]); // س ش ص ض
const WEAK_FINALS = new Set([0x0628, 0x062a, 0x062b, 0x0646, 0x064a, 0x0626, 0x06cc]); // ب ت ث ن ي ئ (and Persian yeh)

type Item = { code: number; joinsOn: boolean; accepts: boolean; end: number };

const isLetterCode = (code: number, type: string): boolean => type === "R" || type === "D" || code === 0x0621 || code === 0x0674;

/** Splits a token into runs of Arabic letters; each letter carries the index of the last character of its mark cluster. */
const letterRuns = (word: string): Item[][] => {
  const runs: Item[][] = [];
  let run: Item[] = [];
  const flush = (): void => {
    if (run.length > 0) runs.push(run);
    run = [];
  };
  let i = 0;
  while (i < word.length) {
    const code = word.codePointAt(i) as number;
    const len = code > 0xffff ? 2 : 1;
    const type = joiningTypeOfCode(code);
    if (isLetterCode(code, type)) {
      let end = i + len - 1;
      let j = i + len;
      while (j < word.length) {
        const next = word.codePointAt(j) as number;
        const nextType = joiningTypeOfCode(next);
        // Marks, an existing tatweel and the joiner belong to the letter before them; bidi controls end the run.
        if (nextType === "C" || (nextType === "T" && next < 0x2000)) {
          j += next > 0xffff ? 2 : 1;
          end = j - 1;
        } else break;
      }
      run.push({ code, joinsOn: type === "D", accepts: type === "R" || type === "D", end });
      i = j;
    } else {
      const stray = type === "C" || type === "T";
      if (!stray || (type === "T" && code >= 0x2000)) flush();
      i += len;
    }
  }
  flush();
  return runs;
};

type Ranked = KashidaSlot & { distance: number };

/** Legal slots of a word, best first. A token with punctuation or Latin around the Arabic works too: each Arabic run is judged on its own. */
export function kashidaSlots(word: string): KashidaSlot[] {
  const ranked: Ranked[] = [];
  for (const run of letterRuns(word)) {
    const n = run.length;
    if (n < 3) continue;
    const last = run[n - 1];
    for (let i = 0; i < n - 1; i++) {
      const here = run[i];
      const next = run[i + 1];
      if (!here.joinsOn || !next.accepts) continue;
      if (here.code === LAM && ALEFS.has(next.code)) continue;
      let priority = 0;
      if (SEEN_FAMILY.has(here.code)) priority += 3;
      if (i + 1 === n - 1) {
        priority += 2;
        if (WEAK_FINALS.has(last.code)) priority -= 1;
      }
      ranked.push({ index: here.end, priority, distance: Math.abs(i + 1 - n / 2) });
    }
  }
  ranked.sort((a, b) => b.priority - a.priority || a.distance - b.distance || a.index - b.index);
  return ranked.map(({ index, priority }) => ({ index, priority }));
}

/**
 * Adds `tatweels` tatweel characters to a word. All of them go to the best slot unless `maxPerSlot` caps a slot, in which case
 * the next best slot takes the rest. A word with no legal slot comes back unchanged, and so does a count of zero or less.
 * Tatweels that no slot has room for are dropped.
 */
export function stretchWord(word: string, tatweels: number, opts: { maxPerSlot?: number } = {}): string {
  const total = Math.floor(tatweels);
  if (!(total > 0)) return word;
  const slots = kashidaSlots(word);
  if (slots.length === 0) return word;
  const cap = opts.maxPerSlot === undefined ? Number.POSITIVE_INFINITY : Math.max(1, Math.floor(opts.maxPerSlot));
  const placed: { index: number; count: number }[] = [];
  let left = total;
  for (const slot of slots) {
    if (left <= 0) break;
    const count = Math.min(cap, left);
    placed.push({ index: slot.index, count });
    left -= count;
  }
  placed.sort((a, b) => b.index - a.index);
  let out = word;
  for (const { index, count } of placed) out = out.slice(0, index + 1) + TATWEEL.repeat(count) + out.slice(index + 1);
  return out;
}

/**
 * Spreads `extra` tatweels over a whole line. Words are ranked by their best slot; the tatweels are dealt one at a time in
 * rounds that shrink from all stretchable words down to the best one, so the word with the highest-priority slot gets the most.
 * Spacing is kept; a word with no slot stays unchanged.
 */
export function stretchLine(line: string, extra: number): string {
  const total = Math.floor(extra);
  if (!(total > 0)) return line;
  const parts = line.split(/(\s+)/);
  const ranked: { part: number; priority: number }[] = [];
  for (let p = 0; p < parts.length; p += 2) {
    const slots = kashidaSlots(parts[p]);
    if (slots.length > 0) ranked.push({ part: p, priority: slots[0].priority });
  }
  if (ranked.length === 0) return line;
  ranked.sort((a, b) => b.priority - a.priority || a.part - b.part);
  const counts = new Array<number>(ranked.length).fill(0);
  let left = total;
  while (left > 0) {
    for (let take = ranked.length; take >= 1 && left > 0; take--) {
      for (let r = 0; r < take && left > 0; r++) {
        counts[r] += 1;
        left -= 1;
      }
    }
  }
  ranked.forEach((entry, r) => {
    parts[entry.part] = stretchWord(parts[entry.part], counts[r]);
  });
  return parts.join("");
}
