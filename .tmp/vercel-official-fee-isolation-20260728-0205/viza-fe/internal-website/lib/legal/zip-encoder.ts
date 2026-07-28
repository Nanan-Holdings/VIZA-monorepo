import { Buffer } from "node:buffer";

/**
 * Minimal ZIP (STORE-only) encoder for LEGAL-004 export bundles.
 *
 * Designed to avoid an extra dep. STORE means no compression, which is
 * fine for our use — the caller streams the bundle to the user once.
 *
 * Spec: PKWARE APPNOTE.TXT §4.3 (local file headers + central directory
 * + end-of-central-directory record). Single-disk, no Zip64.
 */

const SIG_LFH = 0x04034b50;
const SIG_CDH = 0x02014b50;
const SIG_EOCD = 0x06054b50;

const CRC_TABLE: number[] = (() => {
  const t = new Array<number>(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d: Date): { time: number; date: number } {
  const time =
    ((d.getHours() & 0x1f) << 11) |
    ((d.getMinutes() & 0x3f) << 5) |
    ((Math.floor(d.getSeconds() / 2)) & 0x1f);
  const date =
    (((d.getFullYear() - 1980) & 0x7f) << 9) |
    (((d.getMonth() + 1) & 0x0f) << 5) |
    (d.getDate() & 0x1f);
  return { time, date };
}

export interface ZipEntry {
  /** Relative path inside the archive; forward-slash separated. */
  name: string;
  data: Buffer | Uint8Array | string;
  date?: Date;
}

export function buildZip(entries: ZipEntry[]): Buffer {
  const lfhParts: Buffer[] = [];
  const cdhParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const data =
      typeof entry.data === "string"
        ? Buffer.from(entry.data, "utf8")
        : Buffer.from(entry.data);
    const nameBuf = Buffer.from(entry.name, "utf8");
    const { time, date } = dosTime(entry.date ?? new Date());
    const crc = crc32(data);
    const size = data.length;

    // Local file header (30 + n)
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(SIG_LFH, 0);
    lfh.writeUInt16LE(20, 4); // version needed
    lfh.writeUInt16LE(0x0800, 6); // utf8 filename flag
    lfh.writeUInt16LE(0, 8); // method = STORE
    lfh.writeUInt16LE(time, 10);
    lfh.writeUInt16LE(date, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(size, 18); // compressed size = uncompressed (STORE)
    lfh.writeUInt32LE(size, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28); // extra length
    lfhParts.push(lfh, nameBuf, data);

    // Central directory header (46 + n)
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(SIG_CDH, 0);
    cdh.writeUInt16LE(20, 4); // version made by
    cdh.writeUInt16LE(20, 6); // version needed
    cdh.writeUInt16LE(0x0800, 8);
    cdh.writeUInt16LE(0, 10);
    cdh.writeUInt16LE(time, 12);
    cdh.writeUInt16LE(date, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(size, 20);
    cdh.writeUInt32LE(size, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30); // extra
    cdh.writeUInt16LE(0, 32); // comment
    cdh.writeUInt16LE(0, 34); // disk number start
    cdh.writeUInt16LE(0, 36); // internal attrs
    cdh.writeUInt32LE(0, 38); // external attrs
    cdh.writeUInt32LE(offset, 42);
    cdhParts.push(cdh, nameBuf);

    offset += 30 + nameBuf.length + size;
  }

  const cdStart = offset;
  const cdSize = cdhParts.reduce((n, b) => n + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(0, 4); // disk
  eocd.writeUInt16LE(0, 6); // disk start of cd
  eocd.writeUInt16LE(entries.length, 8); // entries on this disk
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...lfhParts, ...cdhParts, eocd]);
}
