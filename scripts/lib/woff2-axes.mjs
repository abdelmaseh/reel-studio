import {brotliDecompressSync} from 'node:zlib';

// Registered table tags of the WOFF2 table directory, indexed by the low six bits of the flags byte.
const KNOWN_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

function readBase128(bytes, at) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = bytes[at.offset++];
    if (byte === undefined) throw new Error('WOFF2 table directory ends inside a length.');
    value = value * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) return value;
  }
  throw new Error('WOFF2 table directory has an over-long length.');
}

/** Variation axes of a WOFF2 font as `[{tag, min, default, max}]`; empty for a static font. */
export function woff2Axes(buffer) {
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 48 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'wOF2') throw new Error('Not a WOFF2 font.');
  const tableCount = view.getUint16(12);
  const compressedSize = view.getUint32(20);
  const at = {offset: 48};
  const tables = [];
  for (let i = 0; i < tableCount; i++) {
    const flags = bytes[at.offset++];
    const index = flags & 0x3f, version = flags >> 6;
    let tag;
    if (index === 63) { tag = String.fromCharCode(...bytes.subarray(at.offset, at.offset + 4)); at.offset += 4; }
    else tag = KNOWN_TAGS[index];
    const original = readBase128(bytes, at);
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    tables.push({tag, stored: transformed ? readBase128(bytes, at) : original});
  }
  const data = brotliDecompressSync(bytes.subarray(at.offset, at.offset + compressedSize));
  let start = 0;
  for (const table of tables) {
    if (table.tag === 'fvar') {
      const fvar = new DataView(data.buffer, data.byteOffset + start, table.stored);
      const first = fvar.getUint16(4), count = fvar.getUint16(8), size = fvar.getUint16(10);
      return Array.from({length: count}, (_, i) => {
        const record = first + i * size;
        const fixed = (offset) => fvar.getInt32(record + offset) / 65536;
        const tag = String.fromCharCode(fvar.getUint8(record), fvar.getUint8(record + 1), fvar.getUint8(record + 2), fvar.getUint8(record + 3));
        return {tag, min: fixed(4), default: fixed(8), max: fixed(12)};
      });
    }
    start += table.stored;
  }
  return [];
}
