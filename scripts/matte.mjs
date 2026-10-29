import './lib/project-tmp.mjs';
import { cliArgs, atomicJson, checkedPath, fileSnapshot, readJson, slug, withFileLock } from './lib/job-paths.mjs';

const usage = 'node scripts/matte.mjs status | make --source Raw/my-video.mp4 --project my-edit [--start-frame 0] [--frames 300] [--width 1080] | attach --manifest Projects/my-edit/edit.json --scene hook --matte _prepared/my-edit/matte-<key>.webm';

function integer(value, label, min) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min) throw new Error(`${label} must be a whole number of at least ${min}.`);
  return number;
}

try {
  const args = cliArgs(process.argv.slice(2), ['source', 'project', 'start-frame', 'frames', 'width', 'manifest', 'scene', 'matte', 'help'], ['help']);
  const command = args._[0];
  if (args.help || !command) {
    console.log(usage);
    process.exitCode = command ? 0 : 1;
  } else if (args._.length !== 1 || !['status', 'make', 'attach'].includes(command)) {
    throw new Error(usage);
  } else if (command === 'status') {
    const { matteModelStatus, MATTE_MODEL } = await import('./lib/matte-runtime.mjs');
    const status = await matteModelStatus();
    console.log(JSON.stringify({ ok: status.state === 'ok', command, model: { id: MATTE_MODEL.id, url: MATTE_MODEL.url, license: MATTE_MODEL.license }, ...status }, null, 2));
    process.exitCode = status.state === 'ok' ? 0 : 1;
  } else if (command === 'make') {
    if (!args.source) throw new Error('An explicit --source is required; source media is never discovered on its own.');
    if (!args.project) throw new Error('--project names the edit the matte belongs to.');
    slug(args.project, 'project');
    const { makeMatte } = await import('./lib/matte-runtime.mjs');
    const result = await makeMatte({
      source: args.source, project: args.project,
      startFrame: args['start-frame'] === undefined ? 0 : integer(args['start-frame'], '--start-frame', 0),
      frames: args.frames === undefined ? undefined : integer(args.frames, '--frames', 1),
      outWidth: args.width === undefined ? 1080 : integer(args.width, '--width', 16),
      log: (message) => process.stderr.write(`${message}\n`),
    });
    console.log(JSON.stringify({ ok: true, command, ...result, next: `node scripts/matte.mjs attach --manifest Projects/${args.project}/edit.json --scene <layered-speaker scene id> --matte ${result.foreground.src}` }, null, 2));
  } else {
    for (const name of ['manifest', 'scene', 'matte']) if (!args[name]) throw new Error(`attach needs --${name}.`);
    const { attachForeground, foregroundRecord } = await import('./lib/matte-core.mjs');
    const { editManifestSchema } = await import('../engine/src/prepared-edit/schema.ts');
    if (!/^_prepared\/[a-z0-9-]+\/matte-[a-f0-9]{16}\.webm$/.test(args.matte)) throw new Error('--matte is the src printed by make, like _prepared/my-edit/matte-0123456789abcdef.webm.');
    const file = `engine/public/${args.matte}`;
    const sidecar = await readJson(`${file}.matte.json`, { internal: false });
    const snapshot = await fileSnapshot(file);
    if (snapshot.sha256 !== sidecar.outputHash) throw new Error('The matte file changed after it was made; cut it again.');
    const record = foregroundRecord({ src: args.matte, sourceSha256: sidecar.source.sha256, sourceFromFrame: sidecar.range.startFrame, frames: sidecar.range.frames });
    await checkedPath(args.manifest, { mustExist: true });
    const manifest = editManifestSchema.parse(await readJson(args.manifest));
    if (!args.manifest.startsWith(`Projects/${manifest.id}/`)) throw new Error('The manifest must stay in its own project.');
    const { manifest: next, trimBeforeFrame } = attachForeground(manifest, args.scene, record);
    const checked = editManifestSchema.parse(next);
    await withFileLock(`Projects/${manifest.id}/edit.lock`, { project: manifest.id }, async () => {
      await atomicJson(args.manifest, checked, { project: manifest.id });
    });
    console.log(JSON.stringify({ ok: true, command, scene: args.scene, matte: args.matte, trimBeforeFrame, note: 'Run node scripts/editor.mjs prepare on the manifest, then check the head frames with node scripts/head-check.mjs: a scene with a matte reports behind-subject-matte for a human look.' }, null, 2));
  }
} catch (error) {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
  process.exitCode = 1;
}
