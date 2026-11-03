const table = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
export function crc32(bytes) { let c = 0xffffffff; for (const x of bytes) c = table[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function createZip(entries) {
  if (entries.length > 65535) throw new Error('Too many ZIP entries');
  const parts = [], directory = [], names = new Set();
  let offset = 0;
  for (const { name, data } of entries) {
    if (!name || /(^\/|\\|(^|\/)\.\.(\/|$)|^[a-z]:|\0)/i.test(name) || names.has(name)) throw new Error('Unsafe or duplicate ZIP entry');
    names.add(name);
    const path = Buffer.from(name, 'utf8'), body = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    if (path.length > 65535 || body.length > 0xffffffff) throw new Error('ZIP entry too large');
    const crc = crc32(body), local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(body.length, 22); local.writeUInt16LE(path.length, 26);
    parts.push(local, path, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(0x21, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(path.length, 28); central.writeUInt32LE(offset, 42);
    directory.push(central, path);
    offset += local.length + path.length + body.length;
    if (offset > 0xffffffff) throw new Error('ZIP archive too large');
  }
  const centralSize = directory.reduce((sum, x) => sum + x.length, 0), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...directory, end]);
}
