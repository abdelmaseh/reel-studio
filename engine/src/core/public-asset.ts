import {z} from 'zod';

/**
 * A local path under engine/public: relative, with no scheme, query, escape or parent step. The one definition the scene schemas
 * (creative-kit/kinetic/schema.ts re-exports it) and the clip schema (core/clip-schema.ts) share. Node-safe: only zod.
 */
export const publicAssetSchema = z.string().min(1).max(1000).refine(
  (p) => !p.startsWith('/') && !/[\\:%?#]/.test(p) && p.split('/').every((s) => s !== '.' && s !== '..' && s.length > 0),
  'Use a local public asset path',
);
