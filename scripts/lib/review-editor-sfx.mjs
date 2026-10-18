import { loadSoundCatalog, validateHits } from './job-sound.mjs';
import { mixHits, encodeWav } from '../sfx.mjs';
import { HttpError } from './review-editor-jobs.mjs';

// Preview-only sound for the live editor. It reuses the export's own mixer, so the editor plays what the export mixes, one recipe at a
// time. Never import scripts/sound-catalog.mjs here: it parses the command line when it is imported.

const MAX_GAIN = 2;

/** The slider steps by 0.05; 0.1 steps keep the number of different mixes (each one synchronous on the server loop) small. */
export const quantizeGain = (gain) => Math.round(gain * 10) / 10;

/**
 * One cache of finished WAV buffers per editor session.
 * `wav(recipeId, gain)` resolves to the PCM16 stereo 48 kHz file of that recipe with every hit scaled by `gain` (as prepare does for a
 * sounds[] entry) and rejects with an HttpError: 400 for a bad gain, 404 for an unknown recipe, 422 when the scaled hits are not valid.
 * `handle({ req, res, params, url })` writes the HTTP answer itself (200, or 206 for one Range, or 416) and returns undefined.
 */
export function createSfxPreview({ loadCatalog = loadSoundCatalog, limit = 64 } = {}) {
  const cache = new Map();
  let catalog = null;
  const recipes = () => {
    catalog ??= loadCatalog().catch((error) => { catalog = null; throw error; });
    return catalog;
  };

  function mix(recipe, gain) {
    const hits = recipe.hits.map((hit) => ({ ...hit, gain: (hit.gain ?? 1) * gain }));
    try { validateHits(hits, recipe.duration); } catch (error) { throw new HttpError(422, error.message); }
    const { L, R } = mixHits(hits, recipe.duration);
    return encodeWav(L, R);
  }

  async function wav(recipeId, gain) {
    if (typeof gain !== 'number' || !Number.isFinite(gain) || gain < 0 || gain > MAX_GAIN) throw new HttpError(400, `gain must be a number from 0 to ${MAX_GAIN}`);
    const rounded = quantizeGain(gain);
    const recipe = (await recipes()).recipes.find((item) => item.id === recipeId);
    if (!recipe) throw new HttpError(404, `unknown sound recipe: ${String(recipeId)}`);
    const key = `${recipe.id}|${rounded.toFixed(1)}`;
    let hit = cache.get(key);
    if (hit) {
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    }
    hit = Promise.resolve().then(() => mix(recipe, rounded));
    cache.set(key, hit);
    hit.catch(() => cache.delete(key));
    while (cache.size > limit) cache.delete(cache.keys().next().value);
    return hit;
  }

  async function handle({ req, res, params, url }) {
    const raw = url.searchParams.get('gain');
    const body = await wav(params.recipe, raw === null || raw === '' ? 1 : Number(raw));
    const size = body.length;
    const base = { 'content-type': 'audio/wav', 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff' };
    let start = 0;
    let end = size - 1;
    let status = 200;
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? '').trim());
    if (range && (range[1] || range[2])) {
      if (range[1]) { start = Number(range[1]); end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1; }
      else { start = Math.max(0, size - Number(range[2])); }
      if (start > end || start >= size) { res.writeHead(416, { ...base, 'content-range': `bytes */${size}` }); res.end(); return; }
      status = 206;
    }
    res.writeHead(status, { ...base, 'content-length': end - start + 1, ...(status === 206 ? { 'content-range': `bytes ${start}-${end}/${size}` } : {}) });
    res.end(body.subarray(start, end + 1));
  }

  return { wav, handle };
}
