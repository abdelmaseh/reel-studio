// Letter-level work on a rasterised line. Arabic must never be split into per-letter DOM elements, so effects that need
// pieces of a line (dots falling onto their letters, tiles snapping together, a kashida bar stretching) draw the whole line
// once into a canvas and cut the bitmap into connected blobs.
//
// `segmentBlobs` and `kashidaBar` are pure functions over an ImageData-like object, so they run (and are tested) in plain Node.
// `rasterLine` needs a canvas, so it only runs in the browser that renders the frame.

/** The part of ImageData these functions read. A real `ImageData` fits. */
export interface ImageLike {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

export interface Blob {
  /** Bounding box in the source image. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Number of ink pixels. */
  area: number;
  kind: "body" | "dot";
  /** w x h pixels holding only this blob's ink (RGBA copied from the source, everything else transparent). */
  mask: ImageData;
}

/** A pixel is ink when its alpha is above this value. */
export const INK_ALPHA = 32;

const makeImageData = (w: number, h: number, data: Uint8ClampedArray<ArrayBuffer>): ImageData =>
  typeof ImageData !== "undefined" ? new ImageData(data, w, h) : ({ width: w, height: h, data, colorSpace: "srgb" } as unknown as ImageData);

const requireSize = (who: string, size: number): void => {
  if (!Number.isFinite(size) || size <= 0) throw new Error(`arabic/segment ${who}: size must be a positive font size in pixels, got ${size}.`);
};

/**
 * Cuts a bitmap into 8-connected blobs of ink and tells letter bodies from dots (and other small marks such as hamza).
 * With S = the font size in pixels, a blob is a dot when h < 0.34 S and w < 0.42 S and area < 0.06 S^2.
 * Blobs come back in reading order for right-to-left text: the rightmost first, then from the top.
 */
export function segmentBlobs(img: ImageLike, size: number): Blob[] {
  requireSize("segmentBlobs", size);
  const { width: W, height: H, data } = img;
  const labels = new Int32Array(W * H);
  const found: { minX: number; minY: number; maxX: number; maxY: number; pixels: number[] }[] = [];
  const stack: number[] = [];
  for (let start = 0; start < W * H; start++) {
    if (labels[start] !== 0 || (data[start * 4 + 3] as number) <= INK_ALPHA) continue;
    const label = found.length + 1;
    const blob = { minX: W, minY: H, maxX: -1, maxY: -1, pixels: [] as number[] };
    labels[start] = label;
    stack.push(start);
    while (stack.length > 0) {
      const p = stack.pop() as number;
      const px = p % W;
      const py = (p - px) / W;
      blob.pixels.push(p);
      if (px < blob.minX) blob.minX = px;
      if (px > blob.maxX) blob.maxX = px;
      if (py < blob.minY) blob.minY = py;
      if (py > blob.maxY) blob.maxY = py;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx;
          if (nx < 0 || nx >= W || (dx === 0 && dy === 0)) continue;
          const q = ny * W + nx;
          if (labels[q] === 0 && (data[q * 4 + 3] as number) > INK_ALPHA) {
            labels[q] = label;
            stack.push(q);
          }
        }
      }
    }
    found.push(blob);
  }
  const blobs: Blob[] = found.map((b) => {
    const w = b.maxX - b.minX + 1;
    const h = b.maxY - b.minY + 1;
    const pixels = new Uint8ClampedArray(w * h * 4);
    for (const p of b.pixels) {
      const px = (p % W) - b.minX;
      const py = Math.floor(p / W) - b.minY;
      const to = (py * w + px) * 4;
      for (let c = 0; c < 4; c++) pixels[to + c] = data[p * 4 + c] as number;
    }
    const area = b.pixels.length;
    const dot = h < 0.34 * size && w < 0.42 * size && area < 0.06 * size * size;
    return { x: b.minX, y: b.minY, w, h, area, kind: dot ? "dot" : "body", mask: makeImageData(w, h, pixels) } as Blob;
  });
  blobs.sort((a, b) => b.x + b.w - (a.x + a.w) || a.y - b.y || a.x - b.x);
  return blobs;
}

/**
 * Finds the kashida bar of a line drawn with a long tatweel: the widest run of columns that are thin (ink height under
 * 0.18 S) and whose ink top and bottom both stay within 4 K pixels (K = S / 100) of the run's first column. A letter's
 * thin tail that drops below the baseline changes the bottom, so it ends the run instead of joining it.
 * `x0` is the first column of the bar and `x1` the column after the last; `top` is the first ink row and `bottom` the row after the last.
 * Returns null when the image has no bar at least 0.15 S wide.
 */
export function kashidaBar(img: ImageLike, size: number): { x0: number; x1: number; top: number; bottom: number } | null {
  requireSize("kashidaBar", size);
  const { width: W, height: H, data } = img;
  const K = size / 100;
  const tolerance = 4 * K;
  const thin = 0.18 * size;
  const top = new Int32Array(W).fill(-1);
  const bottom = new Int32Array(W).fill(-1);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      if ((data[(y * W + x) * 4 + 3] as number) > INK_ALPHA) {
        if (top[x] < 0) top[x] = y;
        bottom[x] = y + 1;
      }
    }
  }
  const isThin = (x: number): boolean => top[x] >= 0 && bottom[x] - top[x] < thin;
  let best: { x0: number; x1: number; top: number; bottom: number } | null = null;
  for (let x0 = 0; x0 < W; x0++) {
    if (!isThin(x0)) continue;
    let x = x0;
    let lo = top[x0];
    let hi = bottom[x0];
    while (x + 1 < W && isThin(x + 1) && Math.abs(top[x + 1] - top[x0]) <= tolerance && Math.abs(bottom[x + 1] - bottom[x0]) <= tolerance) {
      x += 1;
      lo = Math.min(lo, top[x]);
      hi = Math.max(hi, bottom[x]);
    }
    if (best === null || x + 1 - x0 > best.x1 - best.x0) best = { x0, x1: x + 1, top: lo, bottom: hi };
  }
  const minWidth = Math.max(4, Math.round(0.15 * size));
  return best !== null && best.x1 - best.x0 >= minWidth ? best : null;
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿ]/;
const STYLE_PREFIX = /^((?:(?:italic|oblique|normal|bold|bolder|lighter|small-caps|\d{3,4})\s+)*)([\s\S]*)$/i;

/** Builds a canvas font string: "Cairo" at 100 gives `100px Cairo`; a weight prefix ("700 Cairo") goes in front; a string that already has a px size is used as given. */
export function canvasFont(font: string, size: number): string {
  const trimmed = font.trim();
  if (/\b\d+(?:\.\d+)?px\b/.test(trimmed)) return trimmed;
  const parts = STYLE_PREFIX.exec(trimmed);
  const prefix = (parts?.[1] ?? "").trim();
  const family = (parts?.[2] ?? trimmed).trim();
  const quoted = /^["']/.test(family) || !/\s/.test(family) || family.includes(",") ? family : `"${family}"`;
  return `${prefix === "" ? "" : `${prefix} `}${size}px ${quoted}`;
}

const makeCanvas = (width: number, height: number): OffscreenCanvas | HTMLCanvasElement => {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

/**
 * Draws one line of text, whole, into a new canvas and returns it with its size and baseline row.
 * `ctx` is only used to measure; the fonts must already be loaded (see `useFontsReady`). The ink is white on a transparent
 * background, padded by 0.2 size on every side so tails and dots are never clipped.
 */
export function rasterLine(
  ctx: Ctx2D,
  text: string,
  font: string,
  size: number,
): { canvas: OffscreenCanvas | HTMLCanvasElement; width: number; height: number; baseline: number } {
  requireSize("rasterLine", size);
  const spec = canvasFont(font, size);
  const direction = ARABIC.test(text) ? "rtl" : "ltr";
  ctx.save();
  ctx.font = spec;
  ctx.direction = direction;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const m = ctx.measureText(text);
  ctx.restore();
  const pad = Math.ceil(size * 0.2);
  const left = Math.max(0, m.actualBoundingBoxLeft || 0);
  const right = Math.max(m.width, m.actualBoundingBoxRight || 0);
  const ascent = Math.ceil(Math.max(m.actualBoundingBoxAscent || 0, size * 0.5));
  const descent = Math.ceil(Math.max(m.actualBoundingBoxDescent || 0, size * 0.1));
  const width = Math.ceil(left + right) + pad * 2;
  const height = ascent + descent + pad * 2;
  const baseline = pad + ascent;
  const canvas = makeCanvas(width, height);
  const draw = canvas.getContext("2d") as Ctx2D;
  draw.font = spec;
  draw.direction = direction;
  draw.textAlign = "left";
  draw.textBaseline = "alphabetic";
  draw.fillStyle = "#ffffff";
  draw.fillText(text, pad + left, baseline);
  return { canvas, width, height, baseline };
}
