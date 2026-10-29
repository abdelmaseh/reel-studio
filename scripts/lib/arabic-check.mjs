import path from 'node:path';
import {ROOT} from './project-paths.mjs';
import {ARABIC_CHECK_CODES, checkArabicMarkup, manifestFindings} from '../../engine/src/core/arabic-check.ts';
import {familyCoverageSync} from './font-coverage.mjs';

// The Arabic correctness check of the delivery pipeline. The rules live in engine/src/core/arabic-check.ts so the review editor runs the very
// same ones; this module adds what only Node can do: read the profile and the real font files, and turn the findings into one verdict.
//   fail          the text would draw broken (cut joins, characters the font lacks): delivery stops
//   needs-review  a person has to look at the frame (mixed direction, stacked harakat, digit style, long lines): never blocks on its own
export {ARABIC_CHECK_CODES};

const FONTS_DIR = path.join(ROOT, 'engine', 'public', 'fonts');

/**
 * What each installed font draws, read lazily from engine/public/fonts the first time a family is asked for.
 * Returns `family => Set<number> | null` (null: the family or its files are not installed, or unreadable).
 */
export function installedFonts({fontsDir = FONTS_DIR} = {}) {
  const memo = new Map();
  return (family) => {
    if (!memo.has(family)) {
      let covered = null;
      try { covered = familyCoverageSync(family, {fontsDir}); } catch { covered = null; }
      memo.set(family, covered);
    }
    return memo.get(family);
  };
}

/** A function, a Map or a plain object of family to code-point Set, as the lookup the rules want. */
function coverageLookup(fonts) {
  if (!fonts) return null;
  if (typeof fonts === 'function') return fonts;
  if (fonts instanceof Map) return (family) => fonts.get(family) ?? null;
  return (family) => (Object.hasOwn(fonts, family) ? fonts[family] ?? null : null);
}

const fixedChoice = (profile, key) => {
  const choice = profile?.preferences?.[key];
  return choice?.mode === 'fixed' && typeof choice.value === 'string' ? choice.value : null;
};

const snippet = (text) => (text.length > 160 ? `${text.slice(0, 160)}…` : text);

/**
 * Check every visible string of an edit manifest, plus any rendered markup, against the Arabic rules.
 *   manifest  the edit manifest (any shape: a partial or odd one is read, never rejected)
 *   profile   the normalised PROFILE.json; its fixed digits and font choices apply when the manifest names none
 *   fonts     what each font draws (see installedFonts); omitted means the glyph check is not run
 *   markup    optional rendered HTML to check for split words and per-letter transforms: [{where, html}]
 * `problems` are `{level, code, where, text, detail}`; `ok` is false when any has level `fail`.
 */
export function checkArabic({manifest, profile, fonts, markup = []} = {}) {
  const {findings, notes} = manifestFindings(manifest, {digits: fixedChoice(profile, 'digits'), profileFont: fixedChoice(profile, 'font'), coverage: coverageLookup(fonts)});
  const problems = findings.map(({level, code, where, text, detail}) => ({level, code, where, text, detail}));
  for (const item of markup ?? []) {
    const html = String(item?.html ?? '');
    for (const finding of checkArabicMarkup(html)) problems.push({level: finding.level, code: finding.code, where: String(item?.where ?? 'markup'), text: snippet(html), detail: finding.detail});
  }
  problems.sort((a, b) => Number(b.level === 'fail') - Number(a.level === 'fail')); // failures first; the sort is stable, so each group keeps its place order
  const fail = problems.filter((problem) => problem.level === 'fail').length;
  return {ok: fail === 0, problems, notes, counts: {fail, needsReview: problems.length - fail}};
}

/**
 * The delivery gate of scripts/render.mjs: the check of the edit manifest inside a composition's props, against the installed fonts.
 * null when the props carry no edit manifest (a doctor video, a gallery). `message` is set when delivery must stop; `review` lists the items for the report.
 */
export function renderArabicGate(props, {fonts = installedFonts()} = {}) {
  if (!props?.edit || typeof props.edit !== 'object') return null;
  const result = checkArabic({manifest: props.edit, fonts});
  return {...result, review: arabicReviewLines(result), ...(result.ok ? {} : {message: arabicFailureMessage(result)})};
}

const describe = (problem) => `${problem.code} at ${problem.where}: «${snippet(problem.text)}» ${problem.detail}`;

/** One sentence for a thrown error: every `fail`, with its place. */
export function arabicFailureMessage(result) {
  const fails = result.problems.filter((problem) => problem.level === 'fail');
  return `Delivery Arabic check: ${fails.map(describe).join(' | ')}. Fix the text (the studio joins Arabic letters itself) and run node scripts/arabic-check.mjs again.`;
}

/** One line per `needs-review` item, for reports and warnings. */
export function arabicReviewLines(result) {
  return result.problems.filter((problem) => problem.level === 'needs-review').map((problem) => `needs-review ${describe(problem)}`);
}
