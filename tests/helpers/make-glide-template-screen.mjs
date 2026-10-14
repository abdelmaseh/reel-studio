import zlib from 'node:zlib';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Regenerates engine/public/examples/glide-template-screen.png: a flat grey 640 x 360 "screen" with a title bar and
// three content bars. Run `node tests/helpers/make-glide-template-screen.mjs`; it prints the bytes and the sha256 that
// engine/src/styles/grid-glide/scenes/templates.ts pins. The committed file is the source of truth, not this generator.
export const WIDTH = 640;
export const HEIGHT = 360;

const crcTable = Array.from({length: 256}, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

export function glideTemplateScreen() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const rows = [];
  for (let y = 0; y < HEIGHT; y++) {
    const row = Buffer.alloc(1 + WIDTH * 3); // filter type 0
    for (let x = 0; x < WIDTH; x++) {
      const bar = y < 40;
      const block = !bar && x >= 48 && x < 592 && ((y >= 96 && y < 128) || (y >= 160 && y < 176) || (y >= 208 && y < 224) || (y >= 256 && y < 272));
      row.fill(bar ? 0xdc : block ? 0xe2 : 0xf6, 1 + x * 3, 4 + x * 3);
    }
    rows.push(row);
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), {level: 9})), chunk('IEND', Buffer.alloc(0))]);
}

if (process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  const png = glideTemplateScreen();
  writeFileSync(new URL('../../engine/public/examples/glide-template-screen.png', import.meta.url), png);
  console.log(JSON.stringify({file: 'engine/public/examples/glide-template-screen.png', bytes: png.length, width: WIDTH, height: HEIGHT,
    sha256: createHash('sha256').update(png).digest('hex')}));
}
