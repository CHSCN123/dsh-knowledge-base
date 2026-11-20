// 极简 tar / tar.gz 读取器（512 字节块头 + GNU/PAX 长文件名）
import { gunzipSync } from 'node:zlib'

export function maybeGunzip(buffer) {
  if (buffer && buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    try { return gunzipSync(buffer) } catch { return buffer }
  }
  return buffer
}

function parseOctal(chunk) {
  const s = Buffer.from(chunk).toString('latin1').split('\u0000')[0].trim()
  if (!s) return 0
  const n = parseInt(s.replace(/[^0-7]/g, ''), 8)
  return Number.isFinite(n) ? n : 0
}

function cstr(buf) {
  return Buffer.from(buf).toString('utf8').split('\u0000')[0]
}

function parsePax(payload) {
  const out = {}
  const text = Buffer.from(payload).toString('utf8')
  const re = /(\d+) ([A-Za-z0-9_.]+)=([^\n]*)\n/g
  let m
  while ((m = re.exec(text)) !== null) out[m[2]] = m[3]
  return out
}

export function readTarEntries(buffer) {
  const map = new Map()
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  let offset = 0
  let pendingName = null
  let pax = null
  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512)
    if (header.every(b => b === 0)) break
    const typeFlag = String.fromCharCode(header[156] || 48)
    const size = parseOctal(header.subarray(124, 136))
    let name = cstr(header.subarray(0, 100))
    const prefix = cstr(header.subarray(345, 500))
    if (prefix) name = prefix + '/' + name
    const dataStart = offset + 512
    const dataEnd = Math.min(dataStart + size, data.length)
    if (typeFlag === 'x' || typeFlag === 'X' || typeFlag === 'g') {
      const parsed = parsePax(data.subarray(dataStart, dataEnd))
      if (parsed.path) pendingName = parsed.path
      if (typeFlag === 'g') pax = parsed
    } else if (typeFlag === 'L') {
      pendingName = cstr(data.subarray(dataStart, dataEnd))
    } else if (typeFlag === '0' || typeFlag === '\u0000' || typeFlag === '7') {
      if (pendingName) { name = pendingName; pendingName = null }
      if (pax && pax.path) { name = pax.path; pax = null }
      map.set(name.replace(/^\.\//, ''), data.subarray(dataStart, dataEnd))
    }
    offset = dataStart + Math.ceil(size / 512) * 512
  }
  return map
}

export function tarListing(buffer) {
  const entries = []
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  let offset = 0
  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512)
    if (header.every(b => b === 0)) break
    const typeFlag = String.fromCharCode(header[156] || 48)
    const size = parseOctal(header.subarray(124, 136))
    let name = cstr(header.subarray(0, 100))
    const prefix = cstr(header.subarray(345, 500))
    if (prefix) name = prefix + '/' + name
    const dataStart = offset + 512
    if (typeFlag !== 'x' && typeFlag !== 'X' && typeFlag !== 'g' && typeFlag !== 'L') {
      entries.push({ name: name.replace(/^\.\//, ''), size, directory: typeFlag === '5' })
    }
    offset = dataStart + Math.ceil(size / 512) * 512
  }
  return entries
}
