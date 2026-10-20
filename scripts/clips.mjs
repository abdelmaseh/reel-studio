import './lib/project-tmp.mjs';
import {cliArgs} from './lib/job-paths.mjs';
import {addClip, readClipIndex} from './lib/clips.mjs';

const USAGE = 'Usage: node scripts/clips.mjs add --project Projects/<slug> --file <named file> --label <what it shows> --licence <usage statement, for example "creator-supplied (own footage)"> [--credit <text>] [--from <sec> --to <sec>] [--fps <24-60>] | node scripts/clips.mjs list --project Projects/<slug>';
const PROJECT = /^Projects\/([a-z0-9][a-z0-9-]{0,63})$/;
const seconds = (value, name) => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be a number of seconds from zero.`);
  return parsed;
};

try {
  const [command, ...rest] = process.argv.slice(2);
  if (command !== 'add' && command !== 'list') throw new Error(USAGE);
  const args = cliArgs(rest, ['project', 'file', 'label', 'licence', 'credit', 'from', 'to', 'fps']);
  const match = PROJECT.exec(args.project ?? '');
  if (!match || args._.length) throw new Error(USAGE);
  if (command === 'list') {
    console.log(JSON.stringify({ok: true, project: args.project, clips: (await readClipIndex(match[1])).clips}, null, 2));
  } else {
    const result = await addClip({project: match[1], file: args.file, label: args.label, licence: args.licence, credit: args.credit,
      fromSec: seconds(args.from, '--from'), toSec: seconds(args.to, '--to'), fps: args.fps === undefined ? undefined : Number(args.fps)});
    console.log(JSON.stringify({ok: true, ...result}, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ok: false, error: error.message}));
  process.exitCode = 1;
}
