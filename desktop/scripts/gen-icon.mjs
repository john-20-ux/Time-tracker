// Generates desktop/build/icon.png — a 512px rounded teal square. electron-
// builder auto-derives the Windows .ico (and other sizes) from this.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const SIZE = 512;
const [R, G, B] = [74, 124, 111]; // brand teal #4a7c6f

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

const radius = SIZE * 0.18;
const row = SIZE * 4 + 1;
const raw = Buffer.alloc(row * SIZE);
for (let y = 0; y < SIZE; y++) {
  raw[y * row] = 0;
  for (let x = 0; x < SIZE; x++) {
    const dx = Math.max(radius - x, x - (SIZE - 1 - radius), 0);
    const dy = Math.max(radius - y, y - (SIZE - 1 - radius), 0);
    const inside = Math.hypot(dx, dy) <= radius;
    const o = y * row + 1 + x * 4;
    raw[o] = R; raw[o + 1] = G; raw[o + 2] = B; raw[o + 3] = inside ? 255 : 0;
  }
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync(new URL('../build/', import.meta.url), { recursive: true });
writeFileSync(new URL('../build/icon.png', import.meta.url), png);
console.log(`wrote desktop/build/icon.png (${png.length} bytes, ${SIZE}px)`);
