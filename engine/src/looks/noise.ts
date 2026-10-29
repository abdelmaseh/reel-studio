// A small tile of uniform noise as a PNG, built in code from a seeded generator (no asset file, no canvas, no clock).
// Looks use it as a CSS background for grain and paper fibre: Chrome decodes it once and keeps the bitmap, which costs far less per frame
// than re-evaluating an feTurbulence over the whole picture. Pure functions; safe in Node and in the browser.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const adler32 = (bytes: Uint8Array): number => {
  let a = 1, b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
};

const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ascii = (text: string): number[] => Array.from(text, (ch) => ch.charCodeAt(0));

function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = new Uint8Array(4 + data.length);
  body.set(ascii(type), 0);
  body.set(data, 4);
  const out = new Uint8Array(8 + data.length + 4);
  out.set(u32(data.length), 0);
  out.set(body, 4);
  out.set(u32(crc32(body)), 8 + data.length);
  return out;
}

/** zlib stream made of stored (uncompressed) deflate blocks: valid everywhere, no compressor needed. */
function zlibStored(raw: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(raw.length / 65535));
  const out = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  let o = 0;
  out[o++] = 0x78;
  out[o++] = 0x01;
  for (let b = 0; b < blocks; b++) {
    const start = b * 65535, len = Math.min(65535, raw.length - start);
    out[o++] = b === blocks - 1 ? 1 : 0;
    out[o++] = len & 255;
    out[o++] = len >>> 8;
    out[o++] = ~len & 255;
    out[o++] = (~len >>> 8) & 255;
    out.set(raw.subarray(start, start + len), o);
    o += len;
  }
  out.set(u32(adler32(raw)), o);
  return out;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function base64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63] + (i + 1 < bytes.length ? B64[(n >>> 6) & 63] : "=") + (i + 2 < bytes.length ? B64[n & 63] : "=");
  }
  return out;
}

/** Edge length of the tile the looks draw, in px. Offsets in math.ts wrap at this size. */
export const NOISE_TILE = 128;
export const NOISE_SEED = 0x5eed1234;

/** An RGB PNG of independent uniform noise per channel (xorshift32). Same arguments, same bytes. */
export function noisePng(size: number = NOISE_TILE, seed: number = NOISE_SEED): Uint8Array {
  let x = seed >>> 0 || 1;
  const next = (): number => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x;
  };
  const raw = new Uint8Array(size * (1 + size * 3));
  let o = 0;
  for (let row = 0; row < size; row++) {
    raw[o++] = 0; // filter type: none
    for (let col = 0; col < size * 3; col++) raw[o++] = (next() >>> 11) & 255;
  }
  const header = new Uint8Array([...u32(size), ...u32(size), 8, 2, 0, 0, 0]);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", zlibStored(raw)), chunk("IEND", new Uint8Array(0))];
  const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let p = 0;
  for (const part of parts) { png.set(part, p); p += part.length; }
  return png;
}

let cached: string | undefined;
/** `url(...)`-ready data URI of the default tile, built once. */
export function noiseDataUri(): string {
  cached ??= `data:image/png;base64,${base64(noisePng())}`;
  return cached;
}
