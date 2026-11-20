/**
 * OOXML (docx/xlsx/pptx), OpenDocument (odt/ods/odp) and EPUB text extraction.
 * Pure Node.js: unzip with ./zip.js, walk XML with ./xml.js.
 */
import { readZipEntries, entry, entriesWhere, text } from './zip.js'
import { parseXml, findAll, findChildren, findFirst, textOf, attr, children } from './xml.js'
import { htmlToText } from './textfile.js'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const BACKSLASH = String.fromCharCode(92)
const PIPE = String.fromCharCode(124)
const IMAGE_MARK = '[图片]'

function escPipe(s) { return s.split(PIPE).join(BACKSLASH + PIPE) }
function tidy(s) { return String(s || '').replace(/[ \t\u00A0]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim() }

/* ------------------------------------------------------------------ docx */

function paraText(p) {
  let out = ''
  const walk = (node) => {
    for (const c of node.children || []) {
      if (typeof c === 'string') { out += c; continue }
      switch (c.local) {
        case 't': out += textOf(c); break
        case 'tab': out += ' '; break
        case 'br': case 'cr': out += ' '; break
        case 'drawing': case 'pict': case 'object': out += ' ' + IMAGE_MARK + ' '; break
        case 'delText': case 'instrText': case 'fldChar': break
        default: walk(c)
      }
    }
  }
  walk(p)
  return out.replace(/[ \t\u00A0]+/g, ' ').trim()
}

function headingLevel(p) {
  const pPr = findFirst(p, 'pPr')
  if (!pPr) return 0
  const style = findFirst(pPr, 'pStyle')
  const val = style ? String(attr(style, 'val') || '') : ''
  let m = /^heading\s*([1-9])$/i.exec(val) || /^标题\s*([1-9])$/.exec(val) || /^[Hh]([1-6])$/.exec(val)
  if (m) return Number(m[1])
  if (/^title$/i.test(val)) return 1
  if (/^subtitle$/i.test(val)) return 2
  const outline = findFirst(pPr, 'outlineLvl')
  if (outline) {
    const n = Number(attr(outline, 'val'))
    if (Number.isFinite(n)) return Math.max(1, Math.min(6, n + 1))
  }
  return 0
}

function listLevel(p) {
  const pPr = findFirst(p, 'pPr')
  const numPr = pPr ? findFirst(pPr, 'numPr') : undefined
  if (!numPr) return -1
  const ilvl = findFirst(numPr, 'ilvl')
  const n = ilvl ? Number(attr(ilvl, 'val')) : 0
  return Number.isFinite(n) ? Math.max(0, Math.min(n, 5)) : 0
}

function renderParagraph(p, opts) {
  const body = paraText(p)
  const level = headingLevel(p)
  if (level) return opts.noIndent ? '#'.repeat(level) + ' ' + body : '#'.repeat(level) + ' ' + body
  const li = listLevel(p)
  if (li >= 0) return '  '.repeat(li) + '- ' + body
  return body
}

function renderTable(tbl, maxRows, maxCols) {
  const rows = findChildren(tbl, 'tr')
  if (!rows.length) return ''
  const grid = []
  for (const tr of rows.slice(0, maxRows)) {
    const cells = []
    for (const tc of findChildren(tr, 'tc')) {
      const span = Number(attr(findFirst(tc, 'tcPr') ? findFirst(findFirst(tc, 'tcPr'), 'gridSpan') : undefined, 'val') || 1)
      const parts = findChildren(tc, 'p').map((p) => paraText(p)).filter(Boolean)
      let cellText = parts.join(' ')
      const nested = findChildren(tc, 'tbl')
      if (nested.length) {
        for (const nt of nested) {
          const inner = renderTable(nt, maxRows, maxCols)
          if (inner) cellText = (cellText + ' ' + inner.split('\n').join(' / ')).trim()
        }
      }
      cells.push(escPipe(cellText))
      for (let i = 1; i < Math.min(span, 4); i++) cells.push('')
    }
    if (cells.length) grid.push(cells.slice(0, maxCols))
  }
  if (!grid.length) return ''
  const width = Math.max(...grid.map((r) => r.length))
  const pad = (r) => { const c = r.slice(); while (c.length < width) c.push(''); return c }
  const head = pad(grid[0])
  const out = ['| ' + head.join(' | ') + ' |', '| ' + head.map(() => '---').join(' | ') + ' |']
  for (const r of grid.slice(1)) out.push('| ' + pad(r).join(' | ') + ' |')
  if (rows.length > maxRows) out.push('', '*(表格已截断，仅保留前 ' + maxRows + ' 行)*')
  return out.join('\n')
}

function coreProperties(map, section) {
  const raw = text(entry(map, section))
  if (!raw) return {}
  const root = parseXml(raw)
  const out = {}
  for (const key of ['title', 'subject', 'creator', 'description', 'keywords', 'lastModifiedBy', 'created', 'modified', 'category']) {
    const node = findFirst(root, key)
    if (node) { const v = textOf(node).trim(); if (v) out[key] = v }
  }
  return out
}

export function docxToMarkdown(buffer, limits) {
  const map = readZipEntries(buffer)
  const docPart = text(entry(map, 'word/document.xml'))
  if (!docPart) throw new Error('这个 .docx 里找不到 word/document.xml，文件可能已损坏')
  const root = parseXml(docPart)
  const body = findFirst(root, 'body') || root
  const maxRows = (limits && limits.maxTableRows) || 300
  const maxCols = (limits && limits.maxTableCols) || 16
  const blocks = []
  for (const node of children(body)) {
    if (node.local === 'p') { const line = renderParagraph(node, {}); if (line) blocks.push(line) }
    else if (node.local === 'tbl') { const t = renderTable(node, maxRows, maxCols); if (t) blocks.push(t) }
    else if (node.local === 'sdt') {
      for (const p of findChildren(node, 'p')) { const line = renderParagraph(p, {}); if (line) blocks.push(line) }
      for (const t of findChildren(node, 'tbl')) { const s = renderTable(t, maxRows, maxCols); if (s) blocks.push(s) }
    }
  }
  // 页眉页脚（简短附在后面，常常包含部门/标题信息）
  const extras = []
  for (const [name, data] of entriesWhere(map, (lower) => /^word\/(header|footer)\d*\.xml$/.test(lower))) {
    const hf = parseXml(data.toString('utf8'))
    const lines = findAll(hf, 'p').map((p) => paraText(p)).filter(Boolean)
    const uniq = [...new Set(lines)]
    if (uniq.length) extras.push(name.split('/').pop().replace('.xml', '') + ': ' + uniq.slice(0, 6).join(' / '))
  }
  if (extras.length) blocks.push('', '---', '**页眉页脚**: ' + extras.slice(0, 4).join(' | '))
  const images = entriesWhere(map, (lower) => /^word\/media\//.test(lower)).length
  if (images) blocks.push('', '**内嵌图片**: ' + images + ' 张（未导出）')
  return { markdown: blocks.join('\n\n'), meta: coreProperties(map, 'docProps/core.xml') }
}

/* ------------------------------------------------------------------ xlsx */

function sharedStrings(map) {
  const raw = text(entry(map, 'xl/sharedStrings.xml'))
  if (!raw) return []
  const root = parseXml(raw)
  return findAll(root, 'si').map((si) => {
    let s = ''
    for (const t of findAll(si, 't', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')) s += textOf(t)
    if (!s) s = textOf(si)
    return s
  })
}

function customDateFormats(map) {
  const raw = text(entry(map, 'xl/styles.xml'))
  const out = { numFmts: {}, xf: [] }
  if (!raw) return out
  const root = parseXml(raw)
  const numFmts = findFirst(root, 'numFmts')
  if (numFmts) for (const f of findChildren(numFmts, 'numFmt')) out.numFmts[Number(attr(f, 'numFmtId'))] = String(attr(f, 'formatCode') || '')
  const cellXfs = findFirst(root, 'cellXfs')
  if (cellXfs) for (const xf of findChildren(cellXfs, 'xf')) out.xf.push(Number(attr(xf, 'numFmtId') || 0))
  return out
}

function looksLikeDate(code) {
  if (!code) return false
  const stripped = code.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '')
  if (/[yYdD]/.test(stripped) || /m{3,}/.test(stripped)) return true
  return /h.*m|m.*s/i.test(stripped) && /[:hHsS]/.test(stripped)
}

function isDateStyle(styles, styleIndex) {
  if (styleIndex === undefined || styleIndex === null || styleIndex === '') return false
  const idx = Number(styleIndex)
  if (!Number.isFinite(idx)) return false
  const numFmtId = styles.xf[idx]
  if (numFmtId === undefined) return false
  if (numFmtId >= 14 && numFmtId <= 22) return true
  if (numFmtId >= 45 && numFmtId <= 47) return true
  return looksLikeDate(styles.numFmts[numFmtId])
}

function serialToDate(serial) {
  const ms = Math.round((serial - 25569) * 86400000)
  const d = new Date(ms)
  if (!Number.isFinite(d.getTime())) return String(serial)
  const pad = (n) => String(n).padStart(2, '0')
  const hasTime = Math.abs(serial - Math.floor(serial)) > 1e-9
  const date = d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
  return hasTime ? date + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) : date
}

function columnIndex(ref) {
  let n = 0
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i)
    if (c < 65 || c > 90) break
    n = n * 26 + (c - 64)
  }
  return n - 1
}

function sheetEntries(map) {
  const workbook = text(entry(map, 'xl/workbook.xml'))
  const relsRaw = text(entry(map, 'xl/_rels/workbook.xml.rels'))
  const relTargets = {}
  if (relsRaw) {
    const rels = parseXml(relsRaw)
    for (const r of findAll(rels, 'Relationship')) relTargets[String(attr(r, 'Id'))] = String(attr(r, 'Target') || '')
  }
  const sheets = []
  if (workbook) {
    const wb = parseXml(workbook)
    for (const sheet of findAll(wb, 'sheet')) {
      const name = String(attr(sheet, 'name') || '')
      const rid = String(attr(sheet, 'id') || '')
      let target = relTargets[rid] || ''
      if (target && !target.startsWith('/')) target = 'xl/' + target.replace(/^\.\//, '')
      target = target.replace(/^\//, '')
      if (target) sheets.push({ name, target })
    }
  }
  if (!sheets.length) {
    const found = entriesWhere(map, (lower) => /^xl\/worksheets\/sheet\d*\.xml$/.test(lower))
    found.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    for (const [name] of found) sheets.push({ name: name.split('/').pop().replace('.xml', ''), target: name })
  }
  return sheets
}

export function xlsxToMarkdown(buffer, limits) {
  const map = readZipEntries(buffer)
  const shared = sharedStrings(map)
  const styles = customDateFormats(map)
  const sheets = sheetEntries(map)
  const maxRows = (limits && limits.maxSheetRows) || 200
  const maxCols = (limits && limits.maxSheetCols) || 30
  const cellCap = (limits && limits.maxCellChars) || 300
  const parts = []
  for (const sheet of sheets) {
    const raw = text(entry(map, sheet.target))
    if (!raw) continue
    let root
    try { root = parseXml(raw) } catch { continue }
    const data = findFirst(root, 'sheetData')
    if (!data) continue
    const grid = []
    let truncated = false
    for (const row of findChildren(data, 'row')) {
      if (grid.length >= maxRows) { truncated = true; break }
      const cells = []
      for (const c of findChildren(row, 'c')) {
        const ref = String(attr(c, 'r') || '')
        const idx = ref ? columnIndex(ref) : cells.length
        if (idx >= maxCols) continue
        while (cells.length < idx) cells.push('')
        const type = String(attr(c, 't') || '')
        let value = ''
        if (type === 's') {
          const v = findFirst(c, 'v')
          const i = v ? Number(textOf(v)) : NaN
          value = Number.isFinite(i) ? (shared[i] || '') : ''
        } else if (type === 'inlineStr') {
          value = findFirst(c, 'is') ? textOf(findFirst(c, 'is')) : ''
        } else if (type === 'b') {
          const v = findFirst(c, 'v')
          value = textOf(v) === '1' ? 'TRUE' : 'FALSE'
        } else {
          const v = findFirst(c, 'v')
          let raw2 = v ? textOf(v) : ''
          if (raw2 && isDateStyle(styles, attr(c, 's'))) {
            const n = Number(raw2)
            if (Number.isFinite(n) && n > 0 && n < 2958466) raw2 = serialToDate(n)
          }
          value = raw2
        }
        if (/^\d+(\.\d+)?[eE][+-]?\d+$/.test(value.trim())) {
          const n = Number(value)
          if (Number.isFinite(n)) value = String(n)
        }
        cells.push(value.length > cellCap ? value.slice(0, cellCap) + '…' : value)
      }
      while (cells.length && cells[cells.length - 1] === '') cells.pop()
      grid.push(cells)
    }
    while (grid.length && grid[grid.length - 1].every((c) => c === '')) grid.pop()
    if (!grid.length) { parts.push('### ' + (sheet.name || '工作表') + '\n\n*(空表)*'); continue }
    const width = Math.max(...grid.map((r) => r.length))
    const pad = (r) => { const c = r.slice(); while (c.length < width) c.push(''); return c }
    const lines = ['### ' + (sheet.name || '工作表'), '', '| ' + pad(grid[0]).map(escPipe).join(' | ') + ' |', '| ' + new Array(width).fill('---').join(' | ') + ' |']
    for (const r of grid.slice(1)) lines.push('| ' + pad(r).map(escPipe).join(' | ') + ' |')
    if (truncated) lines.push('', '*(工作表已截断，仅保留前 ' + maxRows + ' 行 / ' + maxCols + ' 列)*')
    parts.push(lines.join('\n'))
  }
  if (!parts.length) throw new Error('这个表格里没有可读取的工作表数据')
  return { markdown: parts.join('\n\n'), meta: coreProperties(map, 'docProps/core.xml') }
}

/* ------------------------------------------------------------------ pptx */

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'

function shapeText(sp) {
  const body = findFirst(sp, 'txBody')
  if (!body) return []
  const lines = []
  for (const p of findChildren(body, 'p')) {
    let s = ''
    for (const r of findAll(p, 'r')) for (const t of findChildren(r, 't')) s += textOf(t)
    const fld = findAll(p, 'fld')
    for (const f of fld) s += textOf(f)
    s = s.replace(/[ \t\u00A0]+/g, ' ').trim()
    if (s) lines.push(s)
  }
  return lines
}

function shapeKind(sp) {
  const nv = findFirst(sp, 'nvSpPr')
  const ph = nv ? findFirst(findFirst(nv, 'nvPr') || nv, 'ph') : undefined
  const type = ph ? String(attr(ph, 'type') || '') : ''
  if (/title/i.test(type)) return 'title'
  return 'body'
}

function slideTableText(tbl) {
  const rows = []
  for (const tr of findChildren(tbl, 'tr')) {
    const cells = []
    for (const tc of findChildren(tr, 'tc')) {
      const s = findAll(tc, 't').map((t) => textOf(t)).join(' ').replace(/[ \t\u00A0]+/g, ' ').trim()
      cells.push(s)
    }
    if (cells.some(Boolean)) rows.push(cells)
  }
  if (!rows.length) return []
  const width = Math.max(...rows.map((r) => r.length))
  const pad = (r) => { const c = r.slice(); while (c.length < width) c.push(''); return c }
  const out = ['| ' + pad(rows[0]).map(escPipe).join(' | ') + ' |', '| ' + new Array(width).fill('---').join(' | ') + ' |']
  for (const r of rows.slice(1)) out.push('| ' + pad(r).map(escPipe).join(' | ') + ' |')
  return out
}

export function pptxToMarkdown(buffer, limits) {
  const map = readZipEntries(buffer)
  const rels = text(entry(map, 'ppt/_rels/presentation.xml.rels'))
  const relMap = {}
  if (rels) {
    const r = parseXml(rels)
    for (const item of findAll(r, 'Relationship')) relMap[String(attr(item, 'Id'))] = String(attr(item, 'Target') || '')
  }
  const order = []
  const pres = text(entry(map, 'ppt/presentation.xml'))
  if (pres) {
    const root = parseXml(pres)
    const lst = findFirst(root, 'sldIdLst')
    if (lst) for (const sld of findChildren(lst, 'sldId')) {
      const target = relMap[String(attr(sld, 'id') || '')]
      if (target) order.push('ppt/' + target.replace(/^\.\//, ''))
    }
  }
  if (!order.length) {
    const found = entriesWhere(map, (lower) => /^ppt\/slides\/slide\d*\.xml$/.test(lower))
    found.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    for (const [name] of found) order.push(name)
  }
  const maxSlides = (limits && limits.maxSlides) || 120
  const parts = []
  let index = 0
  for (const slidePath of order) {
    index++
    if (index > maxSlides) { parts.push('*(共 ' + order.length + ' 页，仅展开前 ' + maxSlides + ' 页)*'); break }
    const raw = text(entry(map, slidePath))
    if (!raw) continue
    let root
    try { root = parseXml(raw) } catch { continue }
    const lines = []
    for (const sp of findAll(root, 'sp')) {
      const textLines = shapeText(sp)
      if (!textLines.length) continue
      if (shapeKind(sp) === 'title') lines.push('### ' + textLines.join(' '))
      else for (const l of textLines) lines.push('- ' + l)
    }
    for (const tbl of findAll(root, 'tbl')) for (const l of slideTableText(tbl)) lines.push(l)
    const notesRel = text(entry(map, slidePath.replace(/slides\/([^/]+)$/, 'slides/_rels/$1.rels')))
    if (notesRel) {
      const nr = parseXml(notesRel)
      for (const item of findAll(nr, 'Relationship')) {
        const target = String(attr(item, 'Target') || '')
        if (!/notesSlide/.test(target)) continue
        const notesPath = slidePath.replace(/slides\/[^/]+$/, target.replace(/^\.\.\//, ''))
        const notesRaw = text(entry(map, notesPath))
        if (!notesRaw) continue
        const notesRoot = parseXml(notesRaw)
        const noteLines = []
        for (const sp of findAll(notesRoot, 'sp')) for (const l of shapeText(sp)) noteLines.push(l)
        const uniq = [...new Set(noteLines)].filter((l) => !/^\d+$/.test(l))
        if (uniq.length) lines.push('', '> 备注: ' + uniq.join(' '))
      }
    }
    if (lines.length) parts.push('## 幻灯片 ' + index + '\n\n' + lines.join('\n'))
    else parts.push('## 幻灯片 ' + index + '\n\n*(本页无文字)*')
  }
  if (!parts.length) throw new Error('这个 .pptx 里没有可读取的幻灯片文字')
  return { markdown: parts.join('\n\n'), meta: coreProperties(map, 'docProps/core.xml') }
}

/* -------------------------------------------------------- OpenDocument */

const TEXT_NS = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0'
const TABLE_NS = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0'

function odfInline(el) {
  let out = ''
  const walk = (node) => {
    for (const c of node.children || []) {
      if (typeof c === 'string') { out += c; continue }
      if (c.local === 's') { out += ' '.repeat(Number(attr(c, 'c') || 1)); continue }
      if (c.local === 'tab') { out += ' '; continue }
      if (c.local === 'line-break') { out += ' '; continue }
      if (c.ns === TEXT_NS && (c.local === 'p' || c.local === 'h')) { walk(c); continue }
      walk(c)
    }
  }
  walk(el)
  return out.replace(/[ \t\u00A0]+/g, ' ').trim()
}

export function opendocumentToMarkdown(buffer, limits) {
  const map = readZipEntries(buffer)
  const raw = text(entry(map, 'content.xml'))
  if (!raw) throw new Error('这个 OpenDocument 文件里找不到 content.xml')
  const root = parseXml(raw)
  const body = findFirst(root, 'body') || root
  const parts = []
  const maxRows = (limits && limits.maxSheetRows) || 200
  const maxCols = (limits && limits.maxSheetCols) || 30
  const flushText = (container) => {
    for (const node of children(container)) {
      if (node.local === 'h') {
        const level = Math.max(1, Math.min(6, Number(attr(node, 'outline-level') || 1)))
        const s = odfInline(node)
        if (s) parts.push('#'.repeat(level) + ' ' + s + '\n')
      } else if (node.local === 'p') {
        const s = odfInline(node)
        if (s) parts.push(s + '\n')
      } else if (node.local === 'table') {
        const grid = []
        for (const row of findAll(node, 'table-row')) {
          if (grid.length >= maxRows) break
          const cells = []
          for (const cell of findChildren(row, 'table-cell')) {
            let s = odfInline(cell)
            const repeat = Number(attr(cell, 'number-columns-repeated') || 1)
            if (!s && repeat > 3) continue
            cells.push(s)
            for (let i = 1; i < Math.min(repeat, 6); i++) cells.push('')
          }
          while (cells.length && cells[cells.length - 1] === '') cells.pop()
          if (cells.length) grid.push(cells.slice(0, maxCols))
        }
        if (grid.length) {
          const width = Math.max(...grid.map((r) => r.length))
          const pad = (r) => { const c = r.slice(); while (c.length < width) c.push(''); return c }
          parts.push('| ' + pad(grid[0]).map(escPipe).join(' | ') + ' |')
          parts.push('| ' + new Array(width).fill('---').join(' | ') + ' |')
          for (const r of grid.slice(1)) parts.push('| ' + pad(r).map(escPipe).join(' | ') + ' |')
          parts.push('')
        }
      } else if (node.local === 'section' || node.local === 'text' || node.local === 'spreadsheet' || node.local === 'presentation') {
        flushText(node)
      }
    }
  }
  flushText(body)
  const out = parts.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!out) throw new Error('这个文档里没有可读取的文字')
  let meta = {}
  const metaRaw = text(entry(map, 'meta.xml'))
  if (metaRaw) {
    const m = parseXml(metaRaw)
    for (const key of ['title', 'subject', 'creator', 'description', 'creation-date']) {
      const node = findFirst(m, key)
      if (node) { const v = textOf(node).trim(); if (v) meta[key] = v }
    }
  }
  return { markdown: out, meta }
}

/* ---------------------------------------------------------------- epub */

export function epubToMarkdown(buffer, limits) {
  const map = readZipEntries(buffer)
  const containerRaw = text(entry(map, 'META-INF/container.xml'))
  let opfPath = ''
  if (containerRaw) {
    const c = parseXml(containerRaw)
    const rf = findFirst(c, 'rootfile')
    if (rf) opfPath = String(attr(rf, 'full-path') || '')
  }
  if (!opfPath) {
    const found = entriesWhere(map, (lower) => lower.endsWith('.opf'))
    if (found.length) opfPath = found[0][0]
  }
  if (!opfPath) throw new Error('这个 EPUB 里找不到 OPF 清单')
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''
  const opf = parseXml(text(entry(map, opfPath)))
  const manifest = {}
  for (const item of findAll(opf, 'item')) manifest[String(attr(item, 'id'))] = String(attr(item, 'href') || '')
  const order = []
  const spine = findFirst(opf, 'spine')
  if (spine) for (const itemref of findChildren(spine, 'itemref')) { const h = manifest[String(attr(itemref, 'idref') || '')]; if (h) order.push(h) }
  if (!order.length) for (const id of Object.keys(manifest)) if (/\.x?html?$/i.test(manifest[id])) order.push(manifest[id])
  const maxFiles = (limits && limits.maxEpubFiles) || 200
  const parts = []
  let n = 0
  for (const href of order) {
    n++
    if (n > maxFiles) { parts.push('*(共 ' + order.length + ' 章，仅展开前 ' + maxFiles + ' 章)*'); break }
    const full = decodeURIComponent((base + href).replace(/\.\//g, ''))
    const raw = text(entry(map, full)) || text(entry(map, href))
    if (!raw) continue
    const plain = htmlToText(raw, { keepLinks: false })
    if (plain.trim()) parts.push(plain.trim())
  }
  if (!parts.length) throw new Error('这个 EPUB 里没有可读取的正文')
  const meta = {}
  const titleNode = findFirst(opf, 'title')
  if (titleNode) meta.title = textOf(titleNode).trim()
  const creatorNode = findFirst(opf, 'creator')
  if (creatorNode) meta.creator = textOf(creatorNode).trim()
  return { markdown: parts.join('\n\n---\n\n'), meta }
}

export function zipListing(buffer) {
  const map = readZipEntries(buffer)
  const lines = []
  let total = 0
  for (const [name, data] of map) { total += data.length; lines.push('- ' + name + '  (' + data.length + ' B)') }
  lines.sort()
  const head = '共 ' + map.size + ' 个条目，解压后 ' + (total / 1048576).toFixed(2) + ' MB'
  const list = lines.slice(0, 300)
  return {
    markdown: head + '\n\n' + list.join('\n') + (lines.length > list.length ? '\n\n*(仅列出前 300 个条目)*' : ''),
    entries: [...map.keys()],
  }
}
