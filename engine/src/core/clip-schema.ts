import {z} from 'zod';
import {publicAssetSchema} from './public-asset.ts';

/** A clip may be drawn at most this much larger than its file; beyond it text and edges go soft. */
export const CLIP_MAX_ENLARGEMENT = 1.25;
/** One B-roll scene cuts between at most this many clips. */
export const CLIP_MAX_STEPS = 6;

const frame = z.number().int().min(0).max(4320000);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);

/** A staged, normalised clip: always an .mp4 under engine/public. */
export const clipSrcSchema = publicAssetSchema.refine((p) => /\.mp4$/i.test(p), 'A clip must be a local .mp4 file');

/** What the engine verifies about a clip file: where it is, its bytes and its pixel size. */
export const clipRecordShape = {
  src: clipSrcSchema,
  sha256,
  width: z.number().int().min(2).max(16384),
  height: z.number().int().min(2).max(16384),
};

/** One use of a clip: the record plus where it starts, how it fills its box and where it is centred. */
export const clipValueShape = {
  ...clipRecordShape,
  trimBeforeFrame: frame.default(0),
  fit: z.enum(['cover', 'contain']).default('cover'),
  focus: z.object({x: z.number().min(0).max(1), y: z.number().min(0).max(1)}).strict().optional(),
};

export const clipRecordSchema = z.object(clipRecordShape).strict();
export const clipValueSchema = z.object(clipValueShape).strict().meta({'x-reel-clip': true});
export type ClipRecord = z.infer<typeof clipRecordSchema>;
export type ClipValue = z.infer<typeof clipValueSchema>;

/** One line of Projects/<slug>/clips.json, written only by scripts/clips.mjs. */
export const clipIndexEntrySchema = z.object({
  id: z.string().regex(/^clip-[a-f0-9]{8}$/),
  label: z.string().min(1).max(80).regex(/\S/),
  ...clipRecordShape,
  fps: z.number().int().min(1).max(120),
  frames: z.number().int().min(1).max(4320000),
  inFrame: frame,
  window: z.object({fromSec: z.number().min(0), toSec: z.number().positive()}).strict(),
  source: z.object({path: z.string().min(1).max(2000), sha256}).strict(),
  licence: z.string().min(1).max(300).regex(/\S/),
  credit: z.string().min(1).max(300).optional(),
  hadAudio: z.boolean(),
  hdrSource: z.enum(['hlg', 'pq']).optional(),
  addedAt: z.string().min(1).max(40),
}).strict();
export const clipIndexSchema = z.object({version: z.literal(1), clips: z.array(clipIndexEntrySchema).max(500)}).strict();
export type ClipIndexEntry = z.infer<typeof clipIndexEntrySchema>;
export type ClipIndex = z.infer<typeof clipIndexSchema>;

export type ClipBox = {width: number; height: number};
type ClipSize = {width: number; height: number; fit?: 'cover' | 'contain'};

/** How much larger than the file the clip is drawn in `box`: `cover` fills the box, `contain` fits inside it. */
export function clipEnlargement(clip: ClipSize, box: ClipBox): number {
  const across = box.width / clip.width;
  const down = box.height / clip.height;
  return clip.fit === 'contain' ? Math.min(across, down) : Math.max(across, down);
}

/** What the hint of a refusal may suggest: `split` marks a box that already is the split layout, `contain` a clip whose fit already is contain, `canSplit: false` an edit that cannot show the split layout (no presenter on screen). */
export type EnlargementHintOptions = {split?: boolean; contain?: boolean; canSplit?: boolean};

/** The refusal for a clip enlarged beyond the limit in `box`. The hint lists, in order, only the remedies that can still help: the split layout, fit "contain", a larger clip. */
export function clipEnlargementIssue(clip: ClipSize, box: ClipBox, where: string, options: EnlargementHintOptions = {}): string | null {
  const scale = clipEnlargement(clip, box);
  if (scale <= CLIP_MAX_ENLARGEMENT + 1e-9) return null;
  const remedies = [
    ...(options.split || options.canSplit === false ? [] : ['the split layout']),
    ...(options.contain ? [] : ['fit "contain"']),
    'a larger clip',
  ];
  const last = remedies.pop();
  const remedy = remedies.length ? `${remedies.join(', ')} or ${last}` : last;
  return `${where}: the clip would be enlarged ${scale.toFixed(2)}x in its ${box.width}x${box.height} box (limit ${CLIP_MAX_ENLARGEMENT}x); use ${remedy}.`;
}
