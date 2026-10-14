import '../../scripts/lib/project-tmp.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs, ROOT } from '../../scripts/lib/media.mjs';
import { installWhisper, installPinnedWhisper } from '../../scripts/lib/transcription-install.mjs';

const args = parseArgs(process.argv.slice(2));
const allowed = new Set(['_', 'release', 'model', 'with-vad', 'help']);
try {
  for (const key of Object.keys(args)) if (!allowed.has(key)) throw new Error(`Unknown option --${key}.`);
  if (args.help) console.log('Usage: node engine/tools/install-whisper.mjs [--release b4938] [--model medium] [--with-vad]\nWithout options it installs the runtime, medium model and VAD pinned in versions.lock.json (setup does the same). Another release or model uses the official release lookup. Everything stays inside this project.');
  else {
    const pins = JSON.parse(readFileSync(path.join(ROOT, 'versions.lock.json'), 'utf8')).transcription;
    const custom = (args.release && args.release !== pins.runtime.release) || (args.model && args.model !== pins.model.name);
    const result = custom
      ? await installWhisper({ releaseTag: args.release, model: args.model, withVad: args['with-vad'] === true })
      : await installPinnedWhisper(pins);
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
