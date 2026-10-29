// Lints that keep Arabic joined. Node-safe: plain strings in, plain strings out, no DOM and no packages.
//
// `perLetterLint` reads markup (what React renders to static HTML for a frame) and reports Arabic that was torn into
// pieces: letters of one word in separate elements, a transform on a single letter, letter-spacing on Arabic.
// `perLetterSourceLint` reads TypeScript source and reports the code patterns that cause those problems.
import { graphemes, joinsForward, joiningTypeOfCode } from "./joining.ts";

// ---- a small, forgiving markup reader --------------------------------------------------------------------------------

type El = { id: number; tag: string; style: Map<string, string>; children: (El | string)[]; parent: El | null };

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const RAW = new Set(["script", "style"]);
const BLOCK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "body", "canvas", "dd", "details", "div", "dl", "dt", "fieldset", "figcaption", "figure",
  "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "html", "img", "li", "main", "nav", "ol", "p", "pre", "section",
  "svg", "table", "tbody", "td", "text", "tfoot", "th", "thead", "tr", "ul", "video",
]);
// Atomic inline boxes (inline-block and friends) are boxes too: text on either side of one is shaped on its own.
const BOX_DISPLAY = /^(block|flex|grid|table|list-item|flow-root|table-.*|inline-block|inline-flex|inline-grid|inline-table)$/;
const BLOCKIFYING_PARENT = /^(flex|inline-flex|grid|inline-grid)$/;

const ENTITY = /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi;
const decode = (text: string): string =>
  text.replace(ENTITY, (_, body: string) => {
    const lower = body.toLowerCase();
    if (lower === "amp") return "&";
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    if (lower === "nbsp") return " ";
    const code = lower.startsWith("#x") ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });

const parseStyle = (attrs: string): Map<string, string> => {
  const out = new Map<string, string>();
  const match = /(?:^|\s)style\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
  const body = match === null ? "" : (match[1] ?? match[2] ?? "");
  for (const declaration of body.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const name = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).replace(/!important/i, "").trim().toLowerCase();
    if (name !== "") out.set(name, value);
  }
  return out;
};

const TOKEN = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|[^<]+|</g;

const parse = (markup: string): El => {
  const root: El = { id: 0, tag: "#root", style: new Map(), children: [], parent: null };
  let current = root;
  let nextId = 1;
  TOKEN.lastIndex = 0;
  for (let m = TOKEN.exec(markup); m !== null; m = TOKEN.exec(markup)) {
    const whole = m[0];
    if (whole.startsWith("<!--")) continue;
    const tag = m[2]?.toLowerCase();
    if (tag === undefined) {
      current.children.push(decode(whole));
      continue;
    }
    if (m[1] === "/") {
      for (let up: El | null = current; up !== null; up = up.parent) {
        if (up.tag === tag) {
          current = up.parent ?? root;
          break;
        }
      }
      continue;
    }
    const el: El = { id: nextId++, tag, style: parseStyle(m[3] ?? ""), children: [], parent: current };
    current.children.push(el);
    const selfClosing = (m[3] ?? "").trimEnd().endsWith("/");
    if (RAW.has(tag) && !selfClosing) {
      const close = new RegExp(`</${tag}\\s*>`, "i");
      const rest = markup.slice(TOKEN.lastIndex);
      const found = close.exec(rest);
      TOKEN.lastIndex += found === null ? rest.length : found.index + found[0].length;
      continue;
    }
    if (!VOID.has(tag) && !selfClosing) current = el;
  }
  return root;
};

const textOf = (node: El): string => node.children.map((child) => (typeof child === "string" ? child : textOf(child))).join("");

/** An element that lays out as its own box, so Arabic on either side of it is not one run of text. */
const isBox = (el: El, parent: El): boolean => {
  if (BLOCK_TAGS.has(el.tag)) return true;
  const position = el.style.get("position");
  if (position === "absolute" || position === "fixed") return true;
  const display = el.style.get("display");
  if (display !== undefined && BOX_DISPLAY.test(display)) return true;
  const float = el.style.get("float");
  if (float !== undefined && float !== "none") return true;
  const parentDisplay = parent.style.get("display");
  return parentDisplay !== undefined && BLOCKIFYING_PARENT.test(parentDisplay);
};

// ---- letters ---------------------------------------------------------------------------------------------------------

const WAW = 0x0648;
const HAMZA = 0x0621;

const isLetterCode = (code: number): boolean => {
  const type = joiningTypeOfCode(code);
  return type === "R" || type === "D" || code === HAMZA;
};
const hasArabicLetter = (text: string): boolean => {
  for (const ch of text) if (isLetterCode(ch.codePointAt(0) as number)) return true;
  return false;
};
const isTransparentAt = (text: string, index: number): boolean => joiningTypeOfCode(text.codePointAt(index) as number) === "T";

/** The text's only grapheme when it has exactly one and its base is an Arabic letter; otherwise null. */
const soleLetter = (text: string): string | null => {
  const parts = graphemes(text);
  if (parts.length !== 1) return null;
  return isLetterCode(parts[0].codePointAt(0) as number) ? parts[0] : null;
};

// ---- markup rules ------------------------------------------------------------------------------------------------------

type Flow = { text: string; owners: number[] };

/** Runs of text that one browser line would shape together: text in inline elements, cut at every box and line break. */
const collectFlows = (root: El): Flow[] => {
  const flows: Flow[] = [];
  let flow: Flow = { text: "", owners: [] };
  const flush = (): void => {
    if (flow.text !== "") flows.push(flow);
    flow = { text: "", owners: [] };
  };
  const walk = (node: El): void => {
    for (const child of node.children) {
      if (typeof child === "string") {
        for (let i = 0; i < child.length; i++) flow.owners.push(node.id);
        flow.text += child;
      } else if (child.tag === "br" || child.tag === "wbr") {
        flush();
      } else if (isBox(child, node)) {
        flush();
        walk(child);
        flush();
      } else {
        walk(child);
      }
    }
  };
  walk(root);
  flush();
  return flows;
};

const splitWordProblems = (flow: Flow): string[] => {
  const { text, owners } = flow;
  const wordStartOf = (index: number): number => {
    let i = index;
    while (i > 0 && !/\s/.test(text[i - 1])) i -= 1;
    return i;
  };
  const splits = new Map<number, number[]>();
  for (let i = 0; i < text.length; i++) {
    if (!joinsForward(text, i)) continue;
    let j = i + 1;
    while (j < text.length && isTransparentAt(text, j)) j += 1;
    let crosses = false;
    for (let k = i; k <= j && k < text.length; k++) if (owners[k] !== owners[i]) crosses = true;
    if (!crosses) continue;
    const start = wordStartOf(i);
    const list = splits.get(start) ?? [];
    list.push(j);
    splits.set(start, list);
  }
  const problems: string[] = [];
  for (const [start, cuts] of splits) {
    let end = start;
    while (end < text.length && !/\s/.test(text[end])) end += 1;
    let shown = "";
    for (let k = start; k < end; k++) shown += (cuts.includes(k) ? "|" : "") + text[k];
    problems.push(
      `Arabic word split across elements: «${shown}». The pieces are shaped separately once they are inline-block, positioned or transformed, which breaks the cursive joins. Keep a whole word in one text node.`,
    );
  }
  return problems;
};

const TRANSFORM_PROPS = ["transform", "translate", "rotate", "scale", "skew"];

const siblingProblems = (node: El): string[] => {
  const problems: string[] = [];
  const kids = node.children;
  let run: string[] = [];
  const closeRun = (): void => {
    if (run.length > 0) {
      problems.push(`Single Arabic letters in separate boxes (${run.join(" ")}): each box is shaped alone, so the word loses its joins. Animate the whole word instead of its letters.`);
    }
    run = [];
  };
  for (let i = 0; i + 1 < kids.length; i++) {
    const a = kids[i];
    const b = kids[i + 1];
    let flagged = false;
    if (typeof a !== "string" && typeof b !== "string" && isBox(a, node) && isBox(b, node)) {
      // A box holding one dual-joining letter is a piece of a word. It joins the box after it when that starts with a letter that takes the join.
      const left = soleLetter(textOf(a));
      const right = textOf(b);
      if (left !== null && joiningTypeOfCode(left.codePointAt(0) as number) === "D" && joinsForward(left + right, 0)) {
        flagged = true;
        run.push(`«${left}|${[...right].slice(0, 3).join("")}»`);
      }
    }
    if (!flagged) closeRun();
  }
  closeRun();
  return problems;
};

const spacingValue = (value: string | undefined, inherited: number): number => {
  if (value === undefined || value === "inherit") return inherited;
  if (value === "normal" || value === "initial" || value === "unset") return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : inherited;
};

/** Problems in rendered markup: Arabic torn into pieces. An empty list means the markup keeps its Arabic joined. */
export function perLetterLint(markup: string): string[] {
  const root = parse(markup);
  const problems: string[] = [];

  for (const flow of collectFlows(root)) problems.push(...splitWordProblems(flow));

  const walk = (node: El, spacing: number): void => {
    problems.push(...siblingProblems(node));
    for (const child of node.children) {
      if (typeof child === "string") {
        if (spacing !== 0 && hasArabicLetter(child)) {
          problems.push(`letter-spacing on Arabic text «${child.trim().slice(0, 24)}»: spacing breaks the joins of cursive letters. Set letter-spacing only on Latin text.`);
        }
        continue;
      }
      const own = soleLetter(textOf(child));
      if (own !== null && (own.codePointAt(0) as number) !== WAW) {
        const prop = TRANSFORM_PROPS.find((name) => {
          const value = child.style.get(name);
          return value !== undefined && value !== "none";
        });
        if (prop !== undefined) problems.push(`${prop} on the single Arabic letter «${own}»: a letter moved on its own leaves its word. Transform the whole word.`);
      }
      walk(child, spacingValue(child.style.get("letter-spacing"), spacing));
    }
  };
  walk(root, 0);
  return problems;
}

// ---- source rules ------------------------------------------------------------------------------------------------------

// Comments are removed first so a rule explained in a comment is not a finding. A `//` that follows an opening bracket,
// operator or quote starts a regex or sits in a string, not a comment.
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^(,=:[!&|?+*%<>~^'"`])\/\/.*$/gm, "$1");

const SPLIT_PATTERNS: RegExp[] = [
  /\.split\(\s*(?:''|""|``|\/\(\?:\)\/u?|\/\/u?)\s*\)/,
  /\[\s*\.\.\.\s*[\w.]*(?:text|word|label|line|title|str)[\w.]*\s*\]/i,
  /Array\.from\(\s*[\w.]*(?:text|word|label|line|title|str)\w*\s*[,)]/i,
  /Intl\.Segmenter/,
];

export type SourceLintOptions = {
  /** Code that proves a file sets letter-spacing only for Latin text. Default: isArabic, a ؀ range or a forced ltr box. */
  guard?: RegExp;
  /** Run only one family of rules. */
  only?: "split" | "spacing";
};

/** Problems in TypeScript source that would split or space Arabic. An empty list means none of the known patterns appear. */
export function perLetterSourceLint(source: string, opts: SourceLintOptions = {}): string[] {
  const code = stripComments(source);
  const problems: string[] = [];
  if (opts.only !== "spacing") {
    for (const pattern of SPLIT_PATTERNS) {
      const hit = pattern.exec(code);
      if (hit !== null) problems.push(`split: ${JSON.stringify(hit[0])} breaks text into characters (${pattern}). Arabic is animated by whole word or line.`);
    }
  }
  if (opts.only !== "split" && /letter-?spacing/i.test(code)) {
    const guard = opts.guard ?? /isArabic|\\u0600|dir="ltr"/;
    if (!guard.test(code)) problems.push(`spacing: letter-spacing is set without an Arabic guard (${guard}). Arabic is never letter-spaced.`);
  }
  return problems;
}
