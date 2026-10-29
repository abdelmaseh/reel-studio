import './lib/project-tmp.mjs';
import path from 'node:path';
import {promises as fs} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {ROOT, run} from './lib/media.mjs';
import {
  BUDGET_BYTES, checkInstalled, convertAll, downloadTable, installStatus, recipesFromLedger, spliceCatalogText, stampLedger, validateLedger,
} from './lib/cc0-sounds.mjs';

// The bundled CC0 recordings (Sound-Kits/cc0). Everything here is local; nothing downloads. The owner approves the files in `urls`, someone
// downloads them into a scratch folder, then `convert` and `stamp` put them in place.
//
//   node scripts/cc0-sounds.mjs list                    the ledger rows with their install state
//   node scripts/cc0-sounds.mjs urls                    the download table: id, exact url, exact size, licence
//   node scripts/cc0-sounds.mjs check                   the ledger rules, then every installed file (hash, length, level)
//   node scripts/cc0-sounds.mjs convert --from <dir>    <dir>/<saveAs of urls> -> Sound-Kits/cc0/<id>.wav (48 kHz, 16-bit) with ffmpeg
//   node scripts/cc0-sounds.mjs stamp                   write sha256, bytes, seconds, channels of the installed files into the ledger
//   node scripts/cc0-sounds.mjs catalog [--write]       the cc0-* recipes for Sound-Kits/catalog.json (needs a stamped ledger)

const DIR = path.join(ROOT, 'Sound-Kits', 'cc0');
const LEDGER = path.join(DIR, 'ledger.json');
const CATALOG = path.join(ROOT, 'Sound-Kits', 'catalog.json');
const USAGE = 'Usage: node scripts/cc0-sounds.mjs list | urls | check | convert --from <folder> | stamp | catalog [--write]';

const readLedger = async () => validateLedger(JSON.parse(await fs.readFile(LEDGER, 'utf8')));
const writeAtomic = async (file, text) => {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, text, 'utf8');
  await fs.rename(temporary, file);
};
const option = (argv, name) => {
  const at = argv.indexOf(`--${name}`);
  if (at < 0) return undefined;
  const value = argv[at + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}.`);
  return value;
};

try {
  const argv = process.argv.slice(2);
  const [action = 'list'] = argv;
  const ledger = await readLedger();
  let result;
  if (action === 'list') {
    const status = installStatus(ledger, DIR);
    result = {ok: true, licence: ledger.licence, count: status.length, installed: status.filter((row) => row.installed).length, stamped: status.filter((row) => row.stamped).length, files: status};
  } else if (action === 'urls') {
    result = {ok: true, budgetBytes: BUDGET_BYTES, ...downloadTable(ledger)};
  } else if (action === 'check') {
    const problems = checkInstalled(ledger, DIR);
    const status = installStatus(ledger, DIR);
    result = {ok: problems.length === 0, ledger: 'valid', installed: status.filter((row) => row.installed).length, pending: status.filter((row) => !row.installed).map((row) => row.id), problems};
    if (!result.ok) process.exitCode = 1;
  } else if (action === 'convert') {
    const from = option(argv, 'from');
    if (!from) throw new Error(USAGE);
    await fs.mkdir(DIR, {recursive: true});
    result = {ok: true, ...await convertAll(ledger, path.resolve(from), DIR, (args) => run('ffmpeg', args)), next: 'node scripts/cc0-sounds.mjs stamp'};
  } else if (action === 'stamp') {
    const {ledger: next, stamped, missing} = stampLedger(ledger, DIR);
    await writeAtomic(LEDGER, `${JSON.stringify(next, null, 2)}\n`);
    result = {ok: true, stamped, missing, next: missing.length ? 'convert the missing files, then stamp again' : 'node scripts/cc0-sounds.mjs catalog --write'};
  } else if (action === 'catalog') {
    const recipes = recipesFromLedger(ledger);
    if (argv.includes('--write')) {
      const text = await fs.readFile(CATALOG, 'utf8');
      await writeAtomic(CATALOG, spliceCatalogText(text, recipes));
      result = {ok: true, wrote: 'Sound-Kits/catalog.json', recipes: recipes.map((recipe) => recipe.id), note: 'Update the pinned counts in tests/sound-policy.test.mjs and tests/library-inventory.test.mjs.'};
    } else {
      result = {ok: true, recipes};
    }
  } else {
    throw new Error(USAGE);
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`cc0-sounds: ${error.message}`);
  process.exitCode = 1;
}
