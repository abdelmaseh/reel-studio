import path from 'node:path';
import {ROOT, cliArgs, readJson, relativePath, slug} from './lib/job-paths.mjs';
import {PROFILE_FILE, readProfileFile} from './lib/branding.mjs';
import {publishContext, validatePublishCopy} from './lib/publish-pack.mjs';
import {checkCaptionCopy, spokenText} from './lib/caption-check.mjs';

const USAGE = 'Usage: node scripts/caption-check.mjs --project <slug> [--keyword "<primary search phrase>"] [--copy <publish-copy.json>] [--profile <file>]';
try {
  const args = cliArgs(process.argv.slice(2), ['project', 'keyword', 'copy', 'profile']);
  if (typeof args.project !== 'string' || args._.length) throw new Error(USAGE);
  const id = args.project;
  slug(id, 'project');
  const profile = await readProfileFile(path.resolve(ROOT, args.profile ?? PROFILE_FILE));
  const manifest = await readJson(`Projects/${id}/edit.json`);
  const spoken = spokenText(manifest);
  if (!spoken) throw new Error(`Projects/${id}/edit.json has no reviewed spoken words to compare the publish copy with.`);
  const copyPath = (args.copy ?? `Projects/${id}/publish-copy.json`).replaceAll('\\', '/');
  relativePath(copyPath);
  const copy = validatePublishCopy(await readJson(copyPath), {profile, ...publishContext(profile, manifest)});
  const keyword = typeof args.keyword === 'string' && args.keyword.trim() ? args.keyword.trim() : null;
  const result = checkCaptionCopy({copy, platforms: profile.platforms, spokenText: spoken, keyword});
  console.log(JSON.stringify({ok: result.ok, project: id, keyword, failures: result.failures, platforms: result.platforms}, null, 2));
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ok: false, error: error.message}));
  process.exitCode = 1;
}
