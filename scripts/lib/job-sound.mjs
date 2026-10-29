import { finite, object, readJson } from './job-paths.mjs';
import { SAMPLE_PREFIX, ledgerSampleIds } from './cc0-sounds.mjs';

const OPTION_NAMES = {
  whoosh: ['dur', 'seed', 'lo', 'hi'], whooshSoft: ['seed'], impact: ['dur', 'f0', 'f1', 'seed'],
  pop: ['freq', 'dur', 'seed'], click: ['dur', 'seed', 'fc'], riser: ['dur', 'seed'],
  swipe: ['dur', 'seed'], paper: ['dur', 'seed'], chime: ['dur', 'seed'], tick: ['seed'],
  keyTap: ['dur', 'seed', 'fc'], mouseClick: ['dur', 'seed', 'fc'], whooshShort: ['dur', 'seed', 'f0', 'f1'],
  subBoom: [], subThump: [], subThud: [], subSwellHit: [], uiClick: [],
  airRise: ['dur', 'seed', 'lo', 'hi'], airPass: ['dur', 'seed', 'lo', 'hi'],
};
export const SOUND_NAMES = Object.freeze(Object.keys(OPTION_NAMES));

// A hit names a synthesized voice, or `sample:<id>` for a bundled CC0 recording (Sound-Kits/cc0/ledger.json). `samples` (a Set of ledger ids)
// is optional: with it, an id that is not in the ledger is refused here instead of when the stem is rendered.
export function validateHits(hits, duration, { samples } = {}) {
  finite(duration, 0.01, 600, 'sound duration');
  if (!Array.isArray(hits) || hits.length > 4000) throw new Error('SFX hits must be an array with at most 4000 entries.');
  for (const [index, hit] of hits.entries()) {
    object(hit, ['t', 'sound', 'gain', 'pan', 'opts'], `hit ${index}`);
    const sample = typeof hit.sound === 'string' && hit.sound.startsWith(SAMPLE_PREFIX) ? hit.sound.slice(SAMPLE_PREFIX.length) : null;
    if (sample !== null) {
      if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(sample)) throw new Error(`Invalid sample name: ${String(hit.sound)}`);
      if (samples && !samples.has(sample)) throw new Error(`Unknown sample: ${sample}`);
    } else if (!SOUND_NAMES.includes(hit.sound)) throw new Error(`Unknown sound: ${String(hit.sound)}`);
    finite(hit.t, 0, duration, 'hit time');
    if (hit.t === duration) throw new Error('A sound must start before the stem ends.');
    if (hit.gain !== undefined) finite(hit.gain, 0, 2, 'hit gain');
    if (hit.pan !== undefined) finite(hit.pan, -1, 1, 'hit pan');
    const opts = object(hit.opts ?? {}, sample !== null ? [] : OPTION_NAMES[hit.sound], 'sound option');
    for (const [key, value] of Object.entries(opts)) {
      if (key === 'dur') finite(value, 0.005, 5, 'effect duration');
      else if (key === 'seed') finite(value, 0, 4294967295, 'seed', { integer: true });
      else finite(value, 20, 10000, `effect ${key}`);
    }
  }
  return hits;
}

export async function loadSoundCatalog() {
  const catalog = object(await readJson('Sound-Kits/catalog.json'), ['version', 'sampleRate', 'provenance', 'sounds', 'recipes'], 'sound catalog');
  if (catalog.version !== 1 || catalog.sampleRate !== 48000 || !Array.isArray(catalog.recipes)) throw new Error('Unsupported sound catalog.');
  const ids = new Set();
  // The ledger is read only when a recipe uses a bundled recording, so a catalog without any stays independent of Sound-Kits/cc0.
  const usesSamples = catalog.recipes.some((recipe) => Array.isArray(recipe?.hits) && recipe.hits.some((hit) => typeof hit?.sound === 'string' && hit.sound.startsWith(SAMPLE_PREFIX)));
  const samples = usesSamples ? ledgerSampleIds() : undefined;
  for (const recipe of catalog.recipes) {
    object(recipe, ['id', 'name', 'use', 'duration', 'hits'], 'recipe');
    if (typeof recipe.id !== 'string' || !/^[a-z0-9-]+$/.test(recipe.id) || ids.has(recipe.id)) throw new Error('Recipe IDs must be unique lowercase slugs.');
    ids.add(recipe.id);
    validateHits(recipe.hits, recipe.duration, { samples });
  }
  return catalog;
}

export async function soundRecipe(id) {
  const catalog = await loadSoundCatalog();
  const recipe = catalog.recipes.find((item) => item.id === id);
  if (!recipe) throw new Error(`Unknown sound recipe: ${String(id)}`);
  return recipe;
}
