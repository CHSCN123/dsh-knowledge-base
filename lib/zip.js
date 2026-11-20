/**
 * Minimal ZIP reader for the knowledge-base plugin.
 * Read-only: parses the central directory and inflates entries with node:zlib.
 * Handles stored (0) and deflate (8) entries, UTF-8 names, and data descriptors.
 */
import { inflateRawSync } from 'node:zlib'

const LOCAL_SIG = 0x04034b50
const CENTRAL_SIG = 0x02014b50
const EOCD_SIG = 0x06054b50

function findEocd(buf) {
  const min = Math.max(0, buf.length - 0x10000 - 22)
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i
  }
  return -1
}

/** List every entry: { name, method, size, compressedSize, offset } */
export function listZip(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  const eocd = findEocd(buf)
  if (eocd < 0) throw new Error('不是有效的 ZIP/OOXML 文件（找不到中央目录）')
  let count = buf.readUInt16LE(eocd + 10)
  let cdOffset = buf.readUInt32LE(eocd + 16)
  if (count === 0xffff || cdOffset === 0xffffffff) {
    // ZIP64 locator directly before the EOCD record
    const loc = eocd - 20
    if (loc >= 0 && buf.readUInt32LE(loc) === 0x07064b50) {
      const z64 = Number(buf.readBigUInt64LE(loc + 8))
      if (z64 >= 0 && z64 + 56 <= buf.length) {
        count = Number(buf.readBigUInt64LE(z64 + 32))
        cdOffset = Number(buf.readBigUInt64LE(z64 + 48))
      }
    }
  }
  const entries = []
  let p = cdOffset
  for (let i = 0; i < count && p + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(p) !== CENTRAL_SIG) break
    const flags = buf.readUInt16LE(p + 8)
    const method = buf.readUInt16LE(p + 10)
    const compressedSize = buf.readUInt32LE(p + 20)
    const size = buf.readUInt32LE(p + 24)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const offset = buf.readUInt32LE(p + 42)
    const rawName = buf.subarray(p + 46, p + 46 + nameLen)
    const name = (flags & 0x800) ? rawName.toString('utf8') : rawName.toString('utf8')
    entries.push({ name, method, size, compressedSize, offset, encrypted: (flags & 1) === 1 })
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

function readEntryData(buf, entry) {
  if (entry.encrypted) throw new Error('加密的 ZIP 条目无法读取: ' + entry.name)
  if (entry.offset + 30 > buf.length) throw new Error('ZIP 条目偏移越界: ' + entry.name)
  if (buf.readUInt32LE(entry.offset) !== LOCAL_SIG) throw new Error('ZIP 本地头损坏: ' + entry.name)
  const nameLen = buf.readUInt16LE(entry.offset + 26)
  const extraLen = buf.readUInt16LE(entry.offset + 28)
  const start = entry.offset + 30 + nameLen + extraLen
  let size = entry.compressedSize
  if (size === 0) size = Math.max(0, buf.length - start) // streamed with data descriptor
  const raw = buf.subarray(start, Math.min(buf.length, start + size))
  if (entry.method === 0) return Buffer.from(raw)
  if (entry.method === 8) return inflateRawSync(raw)
  throw new Error('不支持的 ZIP 压缩方式 ' + entry.method + ': ' + entry.name)
}

/** Read every entry into a Map<name, Buffer>. */
export function readZipEntries(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  const out = new Map()
  for (const entry of listZip(buf)) {
    if (entry.name.endsWith('/')) continue
    try { out.set(entry.name, readEntryData(buf, entry)) } catch { /* skip unreadable entry */ }
  }
  return out
}

/** Case-insensitive lookup in an entry map (OOXML part names vary in case). */
export function entry(map, name) {
  if (map.has(name)) return map.get(name)
  const lower = name.toLowerCase()
  for (const [k, v] of map) if (k.toLowerCase() === lower) return v
  const base = lower.split('/').pop()
  for (const [k, v] of map) if (k.toLowerCase().endsWith('/' + base) || k.toLowerCase() === base) return v
  return undefined
}

/** All entries whose lower-cased name matches a predicate. */
export function entriesWhere(map, predicate) {
  const out = []
  for (const [name, data] of map) if (predicate(name.toLowerCase(), name)) out.push([name, data])
  return out
}

export function text(entryData) {
  return entryData ? entryData.toString('utf8').replace(/^\uFEFF/, '') : ''
}
