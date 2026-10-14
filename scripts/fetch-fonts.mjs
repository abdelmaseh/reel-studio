import './lib/project-tmp.mjs';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseArgs, ROOT } from './lib/media.mjs';
import { shouldPruneFontFile } from './lib/font-files.mjs';
import {
  DECLARED_FONTS, cssRequestUrl, fontFileName, lockEntriesFromManifest, manifestWeight, matchesWeight,
  parseFaces, slug, upsertLockFonts, upsertTemplateFonts,
} from './lib/font-css.mjs';
import { validateLock } from './lib/studio-lock.mjs';
import { woff2Axes } from './lib/woff2-axes.mjs';

// Developer-side font fetcher. Normal setup downloads the files pinned in versions.lock.json;
// this script produces those pins.
//   node scripts/fetch-fonts.mjs                         rebuild every family in DECLARED_FONTS
//   node scripts/fetch-fonts.mjs --family Name [--weights 400,700] [--subsets arabic,latin]
//                                                         add or refresh one family
//   node scripts/fetch-fonts.mjs --family Inter --lock   also record the pins in versions.lock.json
//                                                         and engine/public/fonts/manifest.template.json
// A declared family with `axes` (Inter) is fetched as one variable file per subset.

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const args = parseArgs(process.argv.slice(2));
const OUT = path.join(ROOT, 'engine', 'public', 'fonts');
const LOCK = path.join(ROOT, 'versions.lock.json');

const fetchCss = async (spec) => {
  const url = cssRequestUrl(spec);
  const r = await fetch(url, { headers: { 'User-Agent': CHROME_UA } });
  if (!r.ok) throw new Error(`${spec.family}: css ${r.status}`);
  return { css: await r.text(), url };
};

if (args.list) {
  const files = await fs.readdir(OUT).catch(() => []);
  console.log(JSON.stringify({ dir: OUT, count: files.length, files }, null, 2));
  process.exit(0);
}

const additive = Boolean(args.family);
const declaredVariable = DECLARED_FONTS.find((spec) => spec.family === args.family && spec.axes);
const requested = additive
  ? [declaredVariable && args.weights === undefined && args.subsets === undefined
      ? declaredVariable
      : {
          family: String(args.family),
          weights: String(args.weights ?? '400,700').split(',').map(Number),
          subsets: String(args.subsets ?? 'arabic,latin').split(','),
        }]
  : DECLARED_FONTS;

await fs.mkdir(OUT, { recursive: true });
const MANIFEST = path.join(OUT, 'manifest.json');

const requestedFamilies = new Set(requested.map((spec) => spec.family));
const existing = JSON.parse(await fs.readFile(MANIFEST, 'utf8').catch(() => '[]'));
const previous = additive ? existing : [];
const manifest = previous.filter((e) => !requestedFamilies.has(e.family));
const axesFound = {};
let fetched = 0, kept = 0;

for (const spec of requested) {
  const { css, url: cssUrl } = await fetchCss(spec);
  const faces = parseFaces(css).filter((f) => spec.subsets.includes(f.subset));
  if (!faces.length) throw new Error(`${spec.family}: no face matched subsets ${spec.subsets.join(',')}`);
  for (const subset of spec.subsets) {
    for (const weight of spec.weights) {
      if (!faces.some((f) => f.subset === subset && matchesWeight(spec, f, weight))) {
        throw new Error(`${spec.family}: missing requested ${subset}/${weight}`);
      }
    }
  }
  for (const f of faces) {
    const name = fontFileName(spec, f);
    const dest = path.join(OUT, name);
    const have = await fs.stat(dest).catch(() => null);
    let downloaded = false;
    if (have && have.size > 1024) { kept++; }
    else {
      const r = await fetch(f.url, { headers: { 'User-Agent': CHROME_UA } });
      if (!r.ok) throw new Error(`${name}: ${r.status}`);
      await fs.writeFile(dest, Buffer.from(await r.arrayBuffer()));
      fetched++;
      downloaded = true;
    }
    const bytes = await fs.readFile(dest);
    if (bytes.toString('ascii', 0, 4) !== 'wOF2') throw new Error(`${name}: not a WOFF2 font`);
    if (spec.axes) {
      const found = woff2Axes(bytes);
      for (const [tag, range] of Object.entries(spec.axes)) {
        const axis = found.find((item) => item.tag === tag);
        if (!axis || axis.min > range[0] || axis.max < range[1]) {
          throw new Error(`${name}: expected a ${tag} axis covering ${range[0]}..${range[1]}, found ${axis ? `${axis.min}..${axis.max}` : 'none'}`);
        }
      }
      axesFound[name] = found.map((axis) => `${axis.tag} ${axis.min}..${axis.max}`);
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const prior = existing.find((entry) => entry.file === name && entry.sha256 === sha256);
    manifest.push({
      family: spec.family, file: name, subset: f.subset,
      weight: manifestWeight(spec, f), style: f.style,
      bytes: bytes.length,
      unicodeRange: downloaded ? f.unicodeRange : prior?.unicodeRange ?? f.unicodeRange,
      sha256,
      sourceUrl: downloaded ? f.url : prior?.sourceUrl,
      cssUrl: downloaded ? cssUrl : prior?.cssUrl,
      retrievedAt: downloaded ? new Date().toISOString() : prior?.retrievedAt,
    });
  }
}

// Additive runs only prune files of the family they refreshed; a rebuild prunes anything undeclared.
const ownedPrefixes = additive ? requested.map((spec) => `${slug(spec.family)}-`) : null;
const declaredFiles = new Set(manifest.map((entry) => entry.file));
let pruned = 0;
for (const stale of await fs.readdir(OUT)) {
  if (!shouldPruneFontFile(stale, declaredFiles, ownedPrefixes)) continue;
  await fs.rm(path.join(OUT, stale), { force: true });
  pruned++;
}

manifest.sort((a, b) => a.file.localeCompare(b.file));
await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

let locked = null;
if (args.lock) {
  const families = [...requestedFamilies];
  const lock = JSON.parse(await fs.readFile(LOCK, 'utf8'));
  const entries = lockEntriesFromManifest(manifest, families);
  const next = validateLock(upsertLockFonts(lock, entries, families));
  await fs.writeFile(LOCK, JSON.stringify(next, null, 2) + '\n');
  const templateFile = path.join(OUT, 'manifest.template.json');
  const template = JSON.parse(await fs.readFile(templateFile, 'utf8'));
  await fs.writeFile(templateFile, JSON.stringify(upsertTemplateFonts(template, entries, families), null, 2) + '\n');
  locked = `versions.lock.json and engine/public/fonts/manifest.template.json updated for ${families.join(', ')}`;
}

const byFamily = {};
for (const m of manifest) (byFamily[m.family] ??= []).push(`${m.subset}/${m.weight}`);
console.log(JSON.stringify({
  ok: true, dir: OUT,
  mode: additive ? `additive: ${requested.map((spec) => spec.family).join(', ')}` : 'rebuild from DECLARED_FONTS',
  fetched, kept, pruned,
  totalKB: Math.round(manifest.reduce((n, m) => n + m.bytes, 0) / 1024),
  ...(Object.keys(axesFound).length ? { axes: axesFound } : {}),
  ...(locked ? { lock: locked } : {}),
  families: byFamily,
}, null, 2));
