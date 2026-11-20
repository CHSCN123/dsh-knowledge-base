/**
 * Plain-text family decoding: charset sniffing, HTML, RTF, subtitles, e-mail, CSV.
 */
import { decodeEntities } from './xml.js'

const BACKSLASH = String.fromCharCode(92)

/** Decode a byte buffer to text, guessing UTF-8 / UTF-16 / GB18030 / Big5 / Shift_JIS. */
export function decodeText(buffer, hint) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  if (!buf.length) return ''
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString('utf8')
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le')
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf.subarray(2))
    if (swapped.length % 2 === 1) return swapped.subarray(0, swapped.length - 1).toString('utf16le')
    swapped.swap16()
    return swapped.toString('utf16le')
  }
  // 大量 NUL 字节 → UTF-16 无 BOM
  const probe = buf.subarray(0, Math.min(buf.length, 4096))
  let nuls = 0
  for (const b of probe) if (b === 0) nuls++
  if (probe.length > 8 && nuls / probe.length > 0.25) {
    try { return new TextDecoder('utf-16le').decode(buf).replace(/\uFEFF/g, '') } catch { /* fall through */ }
  }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf) } catch { /* not UTF-8 */ }
  const head = buf.subarray(0, 4096).toString('latin1')
  const declared = (/charset\s*=\s*["']?([\w-]+)/i.exec(head) || [])[1]
  const candidates = [hint, declared ? declared.toLowerCase() : '', 'gb18030', 'big5', 'shift_jis', 'euc-kr', 'windows-1252']
  for (const enc of candidates) {
    if (!enc) continue
    try {
      const decoded = new TextDecoder(enc).decode(buf)
      if (decoded && !decoded.includes('\uFFFD') || enc === 'windows-1252') return decoded
    } catch { /* unsupported label, keep trying */ }
  }
  return buf.toString('latin1')
}

export function looksLikeText(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  const probe = buf.subarray(0, Math.min(buf.length, 8192))
  if (!probe.length) return true
  let bad = 0
  for (const b of probe) {
    if (b === 0) return false
    if (b < 9 || (b > 13 && b < 32)) bad++
  }
  return bad / probe.length < 0.02
}

export function htmlToText(html, options) {
  let s = String(html || '')
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  s = s.replace(/<(script|style|head|noscript|svg|iframe|template)[\s\S]*?<\/\1\s*>/gi, '')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<(h[1-6])[^>]*>/gi, (m, tag) => '\n\n' + '#'.repeat(Number(tag[1])) + ' ')
  s = s.replace(/<li[^>]*>/gi, '\n- ')
  s = s.replace(/<t[dh][^>]*>/gi, ' | ')
  s = s.replace(/<\/(p|div|li|tr|h[1-6]|section|article|blockquote|pre|ul|ol|table|dd|dt)>/gi, '\n')
  if (options && options.keepLinks) s = s.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi, (m, href) => ' [' + href + '] ')
  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
  s = s.replace(/\r\n?/g, '\n')
  s = s.replace(/[ \t\u00A0]+/g, ' ')
  s = s.replace(/ *\n */g, '\n')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

const RTF_SKIP_GROUPS = new Set([
  'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'nonshppict', 'shppict',
  'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'xmlnstbl', 'datastore',
  'themedata', 'colorschememapping', 'latentstyles', 'header', 'headerl', 'headerr', 'headerf',
  'footer', 'footerl', 'footerr', 'footerf', 'footnote', 'annotation', 'fldinst', 'filetbl',
])

export function rtfToText(source) {
  const s = String(source || '')
  const out = []
  let i = 0
  let depth = 0
  const skipAt = new Set()
  const pendingBytes = []
  let skipNextWord = 0
  const flushBytes = () => {
    if (!pendingBytes.length) return
    const codePage = /\\ansicpg(\d+)/.exec(s.slice(0, 2048))
    const enc = codePage && codePage[1] === '936' ? 'gb18030' : 'windows-1252'
    try { out.push(new TextDecoder(enc).decode(Buffer.from(pendingBytes))) } catch { out.push(Buffer.from(pendingBytes).toString('latin1')) }
    pendingBytes.length = 0
  }
  while (i < s.length) {
    const ch = s[i]
    if (ch === '{') {
      depth++
      // 检测紧随其后的 \* 或跳过目标
      const rest = s.slice(i + 1)
      const dest = /^(?:\\\*\s*)?\\([a-zA-Z]+)/.exec(rest)
      if (rest.startsWith(BACKSLASH + '*') || (dest && RTF_SKIP_GROUPS.has(dest[1].toLowerCase()))) skipAt.add(depth)
      i++
      continue
    }
    if (ch === '}') {
      skipAt.delete(depth)
      depth--
      i++
      continue
    }
    if (skipAt.size) {
      if (ch === BACKSLASH) {
        const m = /^\\[a-zA-Z]+-?\d* ?/.exec(s.slice(i))
        if (m) { i += m[0].length; continue }
        if (s[i + 1] === "'") { i += 4; continue }
        i += 2
        continue
      }
      i++
      continue
    }
    if (ch === BACKSLASH) {
      const next = s[i + 1]
      if (next === BACKSLASH || next === '{' || next === '}') { flushBytes(); out.push(next); i += 2; continue }
      if (next === "'") {
        const code = parseInt(s.substr(i + 2, 2), 16)
        if (Number.isFinite(code)) pendingBytes.push(code)
        i += 4
        continue
      }
      if (next === '~') { flushBytes(); out.push(' '); i += 2; continue }
      if (next === '_') { flushBytes(); out.push('-'); i += 2; continue }
      if (next === '*') { i += 2; continue }
      const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(s.slice(i))
      if (m) {
        const word = m[1].toLowerCase()
        const arg = m[2] === undefined ? undefined : Number(m[2])
        i += m[0].length
        if (word === 'par' || word === 'line' || word === 'sect' || word === 'page' || word === 'row') { flushBytes(); out.push('\n') }
        else if (word === 'tab') { flushBytes(); out.push(' ') }
        else if (word === 'cell') { flushBytes(); out.push(' | ') }
        else if (word === 'bullet') { flushBytes(); out.push('- ') }
        else if (word === 'u' && arg !== undefined) {
          flushBytes()
          const code = arg < 0 ? arg + 65536 : arg
          out.push(String.fromCharCode(code))
          skipNextWord = 1
        } else if (/^[a-z]+$/.test(word)) {
          flushBytes()
        }
        continue
      }
      i++
      continue
    }
    if (ch === '\n' || ch === '\r') { i++; continue }
    if (skipNextWord > 0) { i++; continue }
    flushBytes()
    out.push(ch)
    i++
  }
  flushBytes()
  return out.join('').replace(/\r/g, '').replace(/[ \t\u00A0]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function subtitleToText(raw) {
  const lines = String(raw || '').replace(/\r/g, '').split('\n')
  const out = []
  for (let line of lines) {
    const t = line.trim()
    if (!t) continue
    if (/^WEBVTT/i.test(t)) continue
    if (/^NOTE\b/i.test(t)) continue
    if (/^\d+$/.test(t)) continue
    if (t.includes('-->')) {
      const m = /^(\d{1,2}:\d{2}:\d{2})[.,]\d{3}\s*-->/.exec(t)
      if (m && out.length) out.push('')
      continue
    }
    if (/^(Kind|Language):/i.test(t)) continue
    const clean = t.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim()
    if (!clean) continue
    if (out.length && out[out.length - 1] === clean) continue
    out.push(clean)
  }
  const collapsed = []
  for (const line of out) {
    if (line === '' && (!collapsed.length || collapsed[collapsed.length - 1] === '')) continue
    collapsed.push(line)
  }
  return collapsed.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function encodeWord(text) {
  return text.replace(/=\?([\s\S]*?)\?=/g, (m) => m)
}

function decodeQuotedPrintable(input) {
  const text = String(input).replace(/=\r?\n/g, '')
  const bytes = []
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(text.substr(i + 1, 2))) {
      bytes.push(parseInt(text.substr(i + 1, 2), 16))
      i += 2
    } else bytes.push(text.charCodeAt(i) & 0xff)
  }
  return Buffer.from(bytes)
}

export function emlToText(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n')
  const split = text.indexOf('\n\n')
  const headerBlock = split < 0 ? '' : text.slice(0, split)
  let body = split < 0 ? text : text.slice(split + 2)
  const headers = {}
  let current = ''
  for (const line of headerBlock.split('\n')) {
    if (/^[ \t]/.test(line) && current) { headers[current] += ' ' + line.trim(); continue }
    const idx = line.indexOf(':')
    if (idx < 0) continue
    current = line.slice(0, idx).trim().toLowerCase()
    headers[current] = line.slice(idx + 1).trim()
  }
  const encoding = (headers['content-transfer-encoding'] || '').toLowerCase()
  const contentType = headers['content-type'] || ''
  const m = /charset=["']?([\w-]+)/i.exec(contentType)
  const charset = m ? m[1] : ''
  let bytes = null
  if (/base64/.test(encoding)) {
    const joined = body.replace(/[^A-Za-z0-9+/=]/g, '')
    try { bytes = Buffer.from(joined, 'base64') } catch { bytes = null }
  } else if (/quoted-printable/.test(encoding)) {
    bytes = decodeQuotedPrintable(body)
  }
  if (bytes) {
    let decoded = decodeText(bytes, charset || undefined)
    return wrapMail(headers, decoded, contentType)
  }
  return wrapMail(headers, body, contentType)
}

function wrapMail(headers, body, contentType) {
  let content = body
  if (/text\/html/i.test(contentType) || /<\s*(html|body|div|p)\b/i.test(content.slice(0, 4000))) content = htmlToText(content)
  const head = []
  for (const key of ['from', 'to', 'cc', 'subject', 'date']) {
    if (headers[key]) head.push('- **' + key[0].toUpperCase() + key.slice(1) + '**: ' + headers[key])
  }
  return (head.length ? head.join('\n') + '\n\n' : '') + String(content || '').replace(/\n{3,}/g, '\n\n').trim()
}

export function csvToMarkdown(raw, options) {
  const text = String(raw || '').replace(/\r\n?/g, '\n')
  const sample = text.slice(0, 4096)
  const counts = { '\t': 0, ',': 0, ';': 0, '|': 0 }
  for (const key of Object.keys(counts)) counts[key] = sample.split(key).length - 1
  let delimiter = (options && options.delimiter) || ''
  if (!delimiter) {
    delimiter = Object.keys(counts).reduce((a, b) => (counts[a] >= counts[b] ? a : b), ',')
    if (counts[delimiter] === 0) delimiter = ','
  }
  const maxRows = (options && options.maxRows) || 200
  const maxCols = (options && options.maxCols) || 30
  const rows = []
  let field = ''
  let row = []
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false }
      else field += c
      continue
    }
    if (c === '"') { quoted = true; continue }
    if (c === delimiter) { row.push(field.trim()); field = ''; continue }
    if (c === '\n') {
      row.push(field.trim())
      field = ''
      if (row.some((v) => v !== '')) rows.push(row)
      row = []
      if (rows.length > maxRows) break
      continue
    }
    field += c
  }
  if (field !== '' || row.length) { row.push(field.trim()); if (row.some((v) => v !== '')) rows.push(row) }
  if (!rows.length) return { markdown: '', delimiter, rows: 0 }
  const grid = rows.slice(0, maxRows).map((r) => r.slice(0, maxCols))
  const width = Math.max(...grid.map((r) => r.length))
  const pad = (r) => { const c = r.slice(); while (c.length < width) c.push(''); return c }
  const esc = (v) => String(v).split('|').join(BACKSLASH + '|')
  const lines = ['| ' + pad(grid[0]).map(esc).join(' | ') + ' |', '| ' + new Array(width).fill('---').join(' | ') + ' |']
  for (const r of grid.slice(1)) lines.push('| ' + pad(r).map(esc).join(' | ') + ' |')
  if (rows.length > maxRows) lines.push('', '*(已截断，仅保留前 ' + maxRows + ' 行)*')
  return { markdown: lines.join('\n'), delimiter, rows: rows.length }
}
