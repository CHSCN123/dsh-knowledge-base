/**
 * Pragmatic PDF text extraction (pure Node.js).
 * Handles classic xref + xref streams, object streams, Flate content streams,
 * ToUnicode CMaps, and the usual text-showing operators.
 */
import { inflateSync } from 'node:zlib'

const BACKSLASH = String.fromCharCode(92)

function parseDict(text, objects) {
  const dict = {}
  const body = text.trim()
  if (!body.startsWith('<<')) return dict
  let i = 2
  while (i < body.length - 1) {
    while (i < body.length && /\s/.test(body[i])) i++
    if (body[i] !== '/') break
    let j = i + 1
    while (j < body.length && !/[\s/<>\[\]()]/.test(body[j])) j++
    const key = body.slice(i + 1, j)
    i = j
    const parsed = parseValue(body, i, objects)
    dict[key] = parsed.value
    i = parsed.next
  }
  return dict
}

function parseValue(text, start, objects) {
  let i = start
  while (i < text.length && /\s/.test(text[i])) i++
  const c = text[i]
  if (c === '<' && text[i + 1] === '<') {
    const end = matchDict(text, i)
    return { value: parseDict(text.slice(i, end), objects), next: end }
  }
  if (c === '<') {
    const end = text.indexOf('>', i)
    return { value: { hex: text.slice(i + 1, end < 0 ? text.length : end) }, next: end < 0 ? text.length : end + 1 }
  }
  if (c === '[') {
    const arr = []
    let k = i + 1
    while (k < text.length && text[k] !== ']') {
      const parsed = parseValue(text, k, objects)
      arr.push(parsed.value)
      k = parsed.next
    }
    return { value: arr, next: k + 1 }
  }
  if (c === '/') {
    let j = i + 1
    while (j < text.length && !/[\s/<>\[\]()]/.test(text[j])) j++
    return { value: { name: text.slice(i + 1, j) }, next: j }
  }
  if (c === '(') {
    let depth = 0
    let j = i
    let str = ''
    while (j < text.length) {
      const ch = text[j]
      if (ch === BACKSLASH) { str += text.slice(j, j + 2); j += 2; continue }
      if (ch === '(') { depth++; if (depth === 1) { j++; continue } }
      if (ch === ')') { depth--; if (depth === 0) { j++; break } }
      str += ch
      j++
    }
    return { value: { literal: str }, next: j }
  }
  const numMatch = /^[+-]?[\d.]+/.exec(text.slice(i))
  if (numMatch) {
    const after = i + numMatch[0].length
    const refMatch = /^\s+(\d+)\s+R\b/.exec(text.slice(after))
    if (refMatch) return { value: { ref: Number(numMatch[0]) }, next: after + refMatch[0].length }
    const n = Number(numMatch[0])
    return { value: Number.isFinite(n) ? n : numMatch[0], next: after }
  }
  const wordMatch = /^[A-Za-z*'"]+/.exec(text.slice(i))
  if (wordMatch) return { value: { keyword: wordMatch[0] }, next: i + wordMatch[0].length }
  return { value: undefined, next: i + 1 }
}

function matchDict(text, start) {
  let depth = 0
  let i = start
  while (i < text.length) {
    if (text[i] === '<' && text[i + 1] === '<') { depth++; i += 2; continue }
    if (text[i] === '>' && text[i + 1] === '>') { depth--; i += 2; if (depth === 0) return i; continue }
    i++
  }
  return text.length
}

function applyPredictor(data, parms) {
  const predictor = parms && parms.Predictor ? Number(parms.Predictor) : 1
  if (!predictor || predictor < 2) return data
  const colors = parms.Colors ? Number(parms.Colors) : 1
  const bpc = parms.BitsPerComponent ? Number(parms.BitsPerComponent) : 8
  const columns = parms.Columns ? Number(parms.Columns) : 1
  const bpp = Math.max(1, Math.ceil((colors * bpc) / 8))
  const rowLen = Math.ceil((colors * bpc * columns) / 8)
  if (predictor === 2) return data
  const out = Buffer.alloc(data.length)
  let inPos = 0
  let outPos = 0
  let prev = Buffer.alloc(rowLen)
  while (inPos < data.length) {
    const type = data[inPos++]
    const row = data.subarray(inPos, inPos + rowLen)
    inPos += rowLen
    const cur = Buffer.alloc(rowLen)
    for (let i = 0; i < rowLen; i++) {
      const raw = row[i] || 0
      const left = i >= bpp ? cur[i - bpp] : 0
      const up = prev[i] || 0
      const upLeft = i >= bpp ? prev[i - bpp] : 0
      let value
      if (type === 0) value = raw
      else if (type === 1) value = raw + left
      else if (type === 2) value = raw + up
      else if (type === 3) value = raw + Math.floor((left + up) / 2)
      else {
        const p = left + up - upLeft
        const pa = Math.abs(p - left)
        const pb = Math.abs(p - up)
        const pc = Math.abs(p - upLeft)
        value = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)
      }
      cur[i] = value & 0xff
    }
    cur.copy(out, outPos)
    outPos += rowLen
    prev = cur
  }
  return out.subarray(0, outPos)
}

function ascii85Decode(buf) {
  let text = buf.toString('latin1').replace(/\s/g, '')
  if (text.startsWith('<~')) text = text.slice(2)
  const end = text.indexOf('~>')
  if (end >= 0) text = text.slice(0, end)
  const out = []
  let tuple = 0
  let count = 0
  for (const ch of text) {
    if (ch === 'z' && count === 0) { out.push(0, 0, 0, 0); continue }
    const code = ch.charCodeAt(0) - 33
    if (code < 0 || code > 84) continue
    tuple = tuple * 85 + code
    if (++count === 5) {
      out.push((tuple >>> 24) & 0xff, (tuple >>> 16) & 0xff, (tuple >>> 8) & 0xff, tuple & 0xff)
      tuple = 0
      count = 0
    }
  }
  if (count > 0) {
    for (let i = count; i < 5; i++) tuple = tuple * 85 + 84
    out.push((tuple >>> 24) & 0xff, (tuple >>> 16) & 0xff, (tuple >>> 8) & 0xff, tuple & 0xff)
  }
  return Buffer.from(out)
}

function hexDecode(buf) {
  const text = buf.toString('latin1').replace(/[^0-9A-Fa-f]/g, '')
  const out = Buffer.alloc(Math.floor(text.length / 2))
  for (let i = 0; i < out.length; i++) out[i] = parseInt(text.substr(i * 2, 2), 16)
  return out
}

function decodeStream(raw, dict, objects) {
  let filters = dict.Filter
  if (filters && filters.name) filters = [filters]
  if (!Array.isArray(filters)) filters = filters ? [filters] : []
  let parms = dict.DecodeParms
  if (parms && parms.name) parms = [parms]
  if (!Array.isArray(parms)) parms = parms ? [parms] : []
  let data = raw
  for (let i = 0; i < filters.length; i++) {
    const name = filters[i] && filters[i].name ? filters[i].name : String(filters[i])
    const param = resolve(parms[i], objects)
    if (name === 'FlateDecode' || name === 'Fl') data = applyPredictor(inflateSync(data), param || {})
    else if (name === 'ASCIIHexDecode' || name === 'AHx') data = hexDecode(data)
    else if (name === 'ASCII85Decode' || name === 'A85') data = ascii85Decode(data)
    else if (name === 'Crypt') continue
    else throw new Error('不支持的 PDF 过滤器: ' + name)
  }
  return data
}

function resolve(value, objects) {
  let current = value
  for (let hop = 0; hop < 8; hop++) {
    if (!current || typeof current !== 'object' || current.ref === undefined) break
    const obj = objects.get(current.ref)
    if (!obj) return undefined
    current = obj.dict
  }
  return current
}

function resolveNumber(value, objects) {
  const v = resolve(value, objects)
  return typeof v === 'number' ? v : undefined
}

/* ------------------------------------------------------------- PDF 解析 */

function parseAllObjects(buf) {
  const latin = buf.toString('latin1')
  const objects = new Map()
  const re = /(?:^|[\s>\]])(\d+)\s+(\d+)\s+obj\b/g
  let m
  while ((m = re.exec(latin))) {
    const num = Number(m[1])
    if (objects.has(num)) continue
    const bodyStart = m.index + m[0].length
    const endIdx = latin.indexOf('endobj', bodyStart)
    const bodyText = latin.slice(bodyStart, endIdx < 0 ? latin.length : endIdx)
    objects.set(num, parseObjectBody(bodyText, buf, bodyStart))
  }
  return { latin, objects }
}

function parseObjectBody(bodyText, buf, bodyStart) {
  const streamIdx = /\bstream\b/.exec(bodyText)
  let dictText = streamIdx ? bodyText.slice(0, streamIdx.index) : bodyText
  const dict = parseDict(dictText, new Map())
  const obj = { dict, raw: bodyText }
  if (streamIdx) {
    let dataStart = bodyStart + streamIdx.index + streamIdx[0].length
    const src = buf
    if (src[dataStart] === 0x0d) dataStart++
    if (src[dataStart] === 0x0a) dataStart++
    const length = typeof dict.Length === 'number' ? dict.Length : undefined
    let dataEnd
    if (length !== undefined && dataStart + length <= src.length) {
      dataEnd = dataStart + length
    } else {
      const searchFrom = src.toString('latin1', dataStart, Math.min(src.length, dataStart + 4096))
      void searchFrom
      const idx = src.toString('latin1').indexOf('endstream', dataStart)
      dataEnd = idx < 0 ? src.length : idx
      while (dataEnd > dataStart && (src[dataEnd - 1] === 0x0a || src[dataEnd - 1] === 0x0d)) dataEnd--
    }
    obj.streamRaw = src.subarray(dataStart, Math.min(dataEnd, src.length))
    obj.streamStart = dataStart
  }
  return obj
}

/** 展开 /Type /XRef 与 /Type /ObjStm，补齐被压缩的对象。 */
function expandCompressedObjects(objects) {
  const addList = []
  for (const obj of [...objects.values()]) {
    const type = resolve(obj.dict.Type, objects)
    const typeName = type && type.name ? type.name : type
    if (typeName !== 'ObjStm' || !obj.streamRaw) continue
    let data
    try { data = decodeStream(obj.streamRaw, obj.dict, objects) } catch { continue }
    const n = resolveNumber(obj.dict.N, objects) || 0
    const first = resolveNumber(obj.dict.First, objects) || 0
    const head = data.toString('latin1', 0, first)
    const nums = head.trim().split(/\s+/).map(Number).filter((v) => Number.isFinite(v))
    const latinData = data.toString('latin1')
    for (let i = 0; i < n; i++) {
      const num = nums[i * 2]
      const offset = nums[i * 2 + 1]
      if (!Number.isFinite(num) || !Number.isFinite(offset)) continue
      if (objects.has(num)) continue
      const text = latinData.slice(first + offset)
      addList.push([num, parseObjectBody(text, Buffer.from(latinData, 'latin1'), 0)])
    }
  }
  for (const [num, obj] of addList) objects.set(num, obj)
}

function hexToText(hex) {
  let out = ''
  const clean = hex.replace(/[^0-9A-Fa-f]/g, '')
  for (let i = 0; i + 3 < clean.length + 1 && i + 2 <= clean.length; i += 4) {
    const unit = parseInt(clean.substr(i, 4), 16)
    if (Number.isFinite(unit)) out += String.fromCharCode(unit)
  }
  return out
}

export function parseCMap(text) {
  const map = new Map()
  const twoByte = /begincodespacerange\s*<([0-9A-Fa-f]{4,})>/.test(text)
  let m
  const bfcharRe = /beginbfchar([\s\S]*?)endbfchar/g
  while ((m = bfcharRe.exec(text))) {
    const pairRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g
    let p
    while ((p = pairRe.exec(m[1]))) {
      const code = parseInt(p[1], 16)
      if (Number.isFinite(code)) map.set(code, hexToText(p[2]))
    }
  }
  const bfrangeRe = /beginbfrange([\s\S]*?)endbfrange/g
  while ((m = bfrangeRe.exec(text))) {
    const lineRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([\s\S]*?)\])/g
    let l
    while ((l = lineRe.exec(m[1]))) {
      const lo = parseInt(l[1], 16)
      const hi = parseInt(l[2], 16)
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue
      if (l[3] !== undefined) {
        const dst = parseInt(l[3], 16)
        if (!Number.isFinite(dst)) continue
        for (let c = lo; c <= hi && c - lo < 65536; c++) map.set(c, String.fromCodePoint(dst + (c - lo)))
      } else if (l[4] !== undefined) {
        const items = l[4].match(/<([0-9A-Fa-f]+)>/g) || []
        items.forEach((h, i) => { if (lo + i <= hi) map.set(lo + i, hexToText(h.slice(1, -1))) })
      }
    }
  }
  return { map, twoByte }
}

function buildFont(objects, fontRefValue, cache) {
  const key = fontRefValue && fontRefValue.ref !== undefined ? fontRefValue.ref : null
  if (key !== null && cache.has(key)) return cache.get(key)
  const dict = resolve(fontRefValue, objects)
  const font = { map: null, twoByte: false, subtype: '', baseFont: '' }
  if (dict && typeof dict === 'object') {
    font.subtype = dict.Subtype && dict.Subtype.name ? dict.Subtype.name : ''
    font.baseFont = dict.BaseFont && dict.BaseFont.name ? dict.BaseFont.name : ''
    const toUnicode = objects.get(dict.ToUnicode && dict.ToUnicode.ref)
    if (toUnicode && toUnicode.streamRaw) {
      try {
        const cmapText = decodeStream(toUnicode.streamRaw, toUnicode.dict, objects).toString('latin1')
        const parsed = parseCMap(cmapText)
        font.map = parsed.map
        font.twoByte = parsed.twoByte || font.subtype === 'Type0'
      } catch { /* ignore broken cmap */ }
    }
    if (!font.map && font.subtype === 'Type0') font.twoByte = true
  }
  if (key !== null) cache.set(key, font)
  return font
}

function decodeLiteral(raw) {
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (c !== BACKSLASH) { out += c; continue }
    const next = raw[++i]
    if (next === 'n') out += '\n'
    else if (next === 'r') out += '\r'
    else if (next === 't') out += '\t'
    else if (next === 'b' || next === 'f') out += ' '
    else if (next === '\n') out += ''
    else if (next >= '0' && next <= '7') {
      let oct = next
      while (oct.length < 3 && raw[i + 1] >= '0' && raw[i + 1] <= '7') oct += raw[++i]
      out += String.fromCharCode(parseInt(oct, 8) & 0xff)
    } else out += next === undefined ? '' : next
  }
  return out
}

function bytesFromPdfString(token) {
  if (token.literal !== undefined) {
    const decoded = decodeLiteral(token.literal)
    const bytes = []
    for (let i = 0; i < decoded.length; i++) bytes.push(decoded.charCodeAt(i) & 0xff)
    return bytes
  }
  if (token.hex !== undefined) {
    const clean = token.hex.replace(/[^0-9A-Fa-f]/g, '')
    const bytes = []
    for (let i = 0; i + 1 < clean.length + 1 && i + 2 <= clean.length; i += 2) bytes.push(parseInt(clean.substr(i, 2), 16))
    return bytes
  }
  return []
}

function mapBytes(bytes, font) {
  if (!font) return Buffer.from(bytes).toString('latin1')
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = ''
    for (let i = 2; i + 1 < bytes.length; i += 2) out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1])
    return out
  }
  if (font.map && font.map.size) {
    let out = ''
    if (font.twoByte) {
      for (let i = 0; i + 1 < bytes.length; i += 2) {
        const code = (bytes[i] << 8) | bytes[i + 1]
        out += font.map.get(code) !== undefined ? font.map.get(code) : ''
      }
    } else {
      for (const b of bytes) {
        const mapped = font.map.get(b)
        out += mapped !== undefined ? mapped : String.fromCharCode(b)
      }
    }
    return out
  }
  if (font.twoByte) {
    let out = ''
    for (let i = 0; i + 1 < bytes.length; i += 2) out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1])
    return out
  }
  return Buffer.from(bytes).toString('latin1')
}

function contentToText(content, objects, fontCache) {
  const out = []
  const stack = []
  let font = null
  let lineY = null
  let lineX = null
  let pendingBreak = false
  let pendingSpace = false
  let i = 0
  const flush = (text) => {
    if (!text) return
    if (pendingBreak && out.length) { out.push('\n'); pendingBreak = false; pendingSpace = false }
    else if (pendingSpace && out.length && !/\s$/.test(out[out.length - 1])) { out.push(' '); pendingSpace = false }
    out.push(text)
  }
  const showString = (token) => {
    const bytes = bytesFromPdfString(token)
    if (bytes.length) flush(mapBytes(bytes, font))
  }
  while (i < content.length) {
    const c = content[i]
    if (c === '%') { const nl = content.indexOf('\n', i); i = nl < 0 ? content.length : nl + 1; continue }
    if (/\s/.test(c)) { i++; continue }
    if (c === '(') {
      let depth = 0
      let j = i
      let raw = ''
      while (j < content.length) {
        const ch = content[j]
        if (ch === BACKSLASH) { raw += content.slice(j, j + 2); j += 2; continue }
        if (ch === '(') { depth++; if (depth === 1) { j++; continue } }
        if (ch === ')') { depth--; if (depth === 0) { j++; break } }
        raw += ch
        j++
      }
      stack.push({ literal: raw })
      i = j
      continue
    }
    if (c === '<' && content[i + 1] !== '<') {
      const end = content.indexOf('>', i)
      stack.push({ hex: content.slice(i + 1, end < 0 ? content.length : end) })
      i = end < 0 ? content.length : end + 1
      continue
    }
    if (c === '<' && content[i + 1] === '<') { const end = matchDict(content, i); i = end; continue }
    if (c === '[') { stack.push('['); i++; continue }
    if (c === ']') { stack.push(']'); i++; continue }
    if (c === '/') {
      let j = i + 1
      while (j < content.length && !/[\s/<>\[\]()]/.test(content[j])) j++
      stack.push({ name: content.slice(i + 1, j) })
      i = j
      continue
    }
    if (/[0-9+-.]/.test(c)) {
      const numMatch = /^[+-]?[\d.]+/.exec(content.slice(i))
      if (numMatch && numMatch[0] !== '-' && numMatch[0] !== '+') {
        stack.push(Number(numMatch[0]))
        i += numMatch[0].length
        continue
      }
      i++
      continue
    }
    if (/[A-Za-z*'"]/.test(c)) {
      const opMatch = /^[A-Za-z*'"]+/.exec(content.slice(i))
      const op = opMatch[0]
      i += op.length
      if (op === 'Tf') {
        const name = stack[stack.length - 2]
        if (name && name.name) {
          const fonts = contentToText.fonts
          font = fonts && fonts[name.name] ? fonts[name.name] : null
        }
        void objects
      } else if (op === 'Td' || op === 'TD') {
        const ty = stack[stack.length - 1]
        const tx = stack[stack.length - 2]
        if (typeof ty === 'number') {
          if (lineY !== null && Math.abs(ty) > 0.5) pendingBreak = true
          else if (typeof tx === 'number' && Math.abs(tx) > 8) pendingSpace = true
          lineY = ty
        }
        if (typeof tx === 'number') lineX = tx
      } else if (op === 'Tm') {
        const f = stack[stack.length - 1]
        const e = stack[stack.length - 2]
        if (typeof f === 'number') {
          if (lineY !== null && Math.abs(f - lineY) > 1.5) pendingBreak = true
          else if (typeof e === 'number' && lineX !== null && Math.abs(e - lineX) > 8) pendingSpace = true
          lineY = f
        }
        if (typeof e === 'number') lineX = e
      } else if (op === 'T*') { pendingBreak = true }
      else if (op === 'Tj' || op === "'" || op === '"') { showString(stack[stack.length - 1]) }
      else if (op === 'TJ') {
        const arr = stack.filter((v) => v && typeof v === 'object' && (v.literal !== undefined || v.hex !== undefined))
        const arrStart = stack.indexOf('[')
        const partial = arrStart >= 0 ? stack.slice(arrStart) : stack
        let pending = false
        for (const item of partial) {
          if (typeof item === 'number') { if (item <= -120) pending = true; continue }
          if (item && (item.literal !== undefined || item.hex !== undefined)) { if (pending) { pendingSpace = true; pending = false } showString(item) }
        }
        void arr
      } else if (op === 'BT') { lineY = null; lineX = null; pendingBreak = false; pendingSpace = false }
      else if (op === 'ET') { pendingBreak = true }
      stack.length = 0
      continue
    }
    i++
  }
  return out.join('').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function pageText(objects, pageDict, fontCache, limits) {
  const resources = resolve(pageDict.Resources, objects) || {}
  const fontDict = resolve(resources.Font, objects) || {}
  const fonts = {}
  for (const [name, value] of Object.entries(fontDict)) fonts[name] = buildFont(objects, value, fontCache)
  const contentsValue = pageDict.Contents
  const contentRefs = Array.isArray(contentsValue) ? contentsValue : [contentsValue]
  const pieces = []
  for (const ref of contentRefs) {
    const obj = ref && ref.ref !== undefined ? objects.get(ref.ref) : null
    if (!obj || !obj.streamRaw) continue
    let data
    try { data = decodeStream(obj.streamRaw, obj.dict, objects) } catch { continue }
    const saved = contentToText.fonts
    contentToText.fonts = fonts
    try { pieces.push(contentToText(data.toString('latin1'), objects, fontCache)) } finally { contentToText.fonts = saved }
    if (limits && pieces.join('').length > limits.maxChars) break
  }
  return pieces.filter(Boolean).join('\n')
}

function collectPages(objects) {
  const byTree = []
  // 尝试从 Catalog → Pages 顺序遍历
  let rootRef = null
  for (const obj of objects.values()) {
    const type = resolve(obj.dict.Type, objects)
    const name = type && type.name ? type.name : type
    if (name === 'Catalog' && obj.dict.Pages) { rootRef = obj.dict.Pages.ref; break }
  }
  const seen = new Set()
  const walk = (ref, depth) => {
    if (depth > 64) return
    const node = ref && ref.ref !== undefined ? objects.get(ref.ref) : null
    const dict = node ? node.dict : resolve(ref, objects)
    if (!dict || typeof dict !== 'object') return
    const type = resolve(dict.Type, objects)
    const name = type && type.name ? type.name : type
    const kids = resolve(dict.Kids, objects)
    if (name === 'Pages' && Array.isArray(kids)) { for (const kid of kids) walk(kid, depth + 1); return }
    if (name === 'Page') { if (ref && ref.ref !== undefined && !seen.has(ref.ref)) { seen.add(ref.ref); byTree.push(dict) } return }
    if (Array.isArray(kids)) for (const kid of kids) walk(kid, depth + 1)
  }
  if (rootRef !== null && rootRef !== undefined) {
    const rootObj = objects.get(rootRef)
    if (rootObj) walk(rootObj.dict.Pages, 0)
  }
  return byTree
}

function fallbackPages(objects) {
  const out = []
  for (const obj of objects.values()) {
    const type = resolve(obj.dict.Type, objects)
    const name = type && type.name ? type.name : type
    if (name === 'Page') out.push(obj.dict)
  }
  return out
}

export function pdfToText(buffer, limits) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  const { objects } = parseAllObjects(buf)
  expandCompressedObjects(objects)
  if (!objects.size) throw new Error('无法解析这个 PDF（可能是扫描件或加密文件）')
  let pages = collectPages(objects)
  if (!pages.length) pages = fallbackPages(objects)
  if (!pages.length) throw new Error('这个 PDF 里没有找到页面')
  const fontCache = new Map()
  const cap = (limits && limits.maxChars) || 400000
  const maxPages = (limits && limits.maxPages) || 200
  const parts = []
  let total = 0
  for (let i = 0; i < pages.length && i < maxPages; i++) {
    let text = ''
    try { text = pageText(objects, pages[i], fontCache, limits) } catch { text = '' }
    if (text) parts.push('## 第 ' + (i + 1) + ' 页\n\n' + text)
    else parts.push('## 第 ' + (i + 1) + ' 页\n\n*(本页无可提取文字，可能是扫描图片)*')
    total += text.length
    if (total > cap) { parts.push('\n*(已达提取上限，剩余页面省略)*'); break }
  }
  const markdown = parts.join('\n\n').replace(/\n{3,}/g, '\n\n')
  const printable = markdown.replace(/[\s\S]*?\n\n/g, '').length
  void printable
  const info = (() => {
    for (const obj of objects.values()) {
      const dict = obj.dict
      if (dict && dict.Title) {
        const t = resolve(dict.Title, objects)
        void t
      }
    }
    return {}
  })()
  return { markdown, meta: info, pageCount: pages.length }
}
