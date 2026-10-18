import {promises as fs, constants as fsc} from 'node:fs';
import path from 'node:path';
import {ROOT, checkedPath, digest, ensureOutput} from './job-paths.mjs';
import {createManifestStore, historyDir} from './review-editor-jobs.mjs';
import {manifestRevision} from './review-editor-revision.mjs';

// Framing is editable too. Without trusted provenance, an automatic face fix cannot be
// distinguished from a manual crop, so both must remain protected during replanning.
export function editHash(manifest) {
  return digest(JSON.parse(JSON.stringify(manifest)));
}

export function nonCaptionEditHash(manifest) {
  const {captions: _captions, ...rest} = JSON.parse(JSON.stringify(manifest));
  return digest(rest);
}

// Only new records attest to framing. Old full-manifest hashes can prove equality,
// but an old footage-excluding hash is never evidence that a changed edit is safe.
export function untouchedSincePlan(current, record) {
  if (record?.editHashVersion === 2 && typeof record.editHash === 'string') return editHash(current) === record.editHash;
  if (typeof record?.manifestHash === 'string') return digest(JSON.parse(JSON.stringify(current))) === record.manifestHash ? true : null;
  return null;
}

export function captionOnlySincePlan(current, record) {
  return record?.editHashVersion === 2 && typeof record.nonCaptionHash === 'string'
    && nonCaptionEditHash(current) === record.nonCaptionHash;
}

export async function readEditSnapshot(manifestPath) {
  const absolute = await checkedPath(manifestPath);
  let text;
  try { text = await fs.readFile(absolute, 'utf8'); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (Buffer.byteLength(text, 'utf8') > 8 * 1024 * 1024) throw new Error(`JSON file is too large: ${manifestPath}`);
  let manifest;
  try { manifest = JSON.parse(text); } catch { throw new Error(`Invalid JSON: ${manifestPath}`); }
  return {text, manifest, revision: manifestRevision(text)};
}

// Copies the current edit.json into the editor's History folder so it can be restored from the editor.
export async function backupEdit(manifestPath, project, label) {
  const dir = historyDir(manifestPath);
  const now = Date.now();
  for (let bump = 0; bump < 50; bump++) {
    const name = `${new Date(now + bump).toISOString().replace(/[:.]/g, '-')}~${label}.json`;
    const target = await ensureOutput(`${dir}/${name}`, {project});
    try {
      await fs.copyFile(path.join(ROOT, ...manifestPath.split('/')), target, fsc.COPYFILE_EXCL);
      return `${dir}/${name}`;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  throw new Error('Could not back up edit.json before replacing it; nothing was changed.');
}

// Marks an edit that was reviewed in the editor as ready for delivery, without rebuilding it from the brief.
export async function promoteEdit(manifestPath, {reviewedBy} = {}) {
  const snapshot = await readEditSnapshot(manifestPath);
  if (!snapshot) throw new Error(`Required input is missing: ${manifestPath}`);
  const {manifest} = snapshot;
  const reviewed = manifest.captions?.status === 'reviewed';
  if (!reviewed && !(typeof reviewedBy === 'string' && reviewedBy.trim())) {
    throw new Error('The captions are still a draft. Pass --reviewed-by "<the name the creator gave>" after they confirm the words.');
  }
  const next = {...manifest, purpose: 'delivery',
    captions: reviewed ? manifest.captions : {...manifest.captions, status: 'reviewed', reviewer: reviewedBy.trim()}};
  const {assertDeliveryReady} = await import('./editor-director.mjs');
  assertDeliveryReady(next);
  const store = createManifestStore({manifestPath});
  const saved = await store.save({manifest: next, baseRevision: snapshot.revision, label: 'قبل اعتماد التسليم'});
  return {ok: true, manifest: manifestPath, purpose: 'delivery', captionStatus: 'reviewed', backup: saved.backup,
    next: 'Run face-check --fix and motion-plan, then render --deliver.'};
}
