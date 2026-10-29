import './lib/project-tmp.mjs';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {ROOT, checkedPath, cliArgs, readJson, slug} from './lib/job-paths.mjs';
import {PROFILE_FILE, readProfileFile} from './lib/branding.mjs';
import {checkArabic, installedFonts} from './lib/arabic-check.mjs';

const USAGE = 'Usage: node scripts/arabic-check.mjs (--project <slug> | --manifest <edit.json>) [--profile <file>] [--markup <file.html>]';
try {
  const args = cliArgs(process.argv.slice(2), ['project', 'manifest', 'profile', 'markup']);
  if (args._.length || (args.project === undefined) === (args.manifest === undefined)) throw new Error(USAGE);
  const source = args.project !== undefined ? `Projects/${slug(args.project, 'project')}/edit.json` : String(args.manifest).replaceAll('\\', '/');
  const manifest = await readJson(source);
  // The profile only adds the digits and font choices the manifest does not name. A studio without a PROFILE.json is checked without them.
  let profile = null;
  if (args.profile !== undefined) profile = await readProfileFile(path.resolve(ROOT, args.profile));
  else if (await fs.stat(path.join(ROOT, PROFILE_FILE)).then(() => true, () => false)) profile = await readProfileFile(path.join(ROOT, PROFILE_FILE));
  const markup = [];
  if (args.markup !== undefined) {
    const file = String(args.markup).replaceAll('\\', '/');
    markup.push({where: file, html: await fs.readFile(await checkedPath(file, {mustExist: true}), 'utf8')});
  }
  const result = checkArabic({manifest, profile, fonts: installedFonts(), markup});
  console.log(JSON.stringify({source, ...result}, null, 2));
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ok: false, error: error.message}));
  process.exitCode = 1;
}
