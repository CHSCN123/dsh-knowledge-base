// 统一分发：文件 Buffer → 笔记正文 / 附件。
import { basename } from 'node:path'
import { routeFor, describeRoute, extOf } from './formats.js'
import { docxToMarkdown, xlsxToMarkdown, pptxToMarkdown, opendocumentToMarkdown, epubToMarkdown, zipListing } from './ooxml.js'
import { decodeText, looksLikeText, htmlToText, rtfToText, subtitleToText, emlToText, csvToMarkdown } from './textfile.js'
import { pdfToText } from './pdf.js'
import { maybeGunzip, tarListing } from './tar.js'
import { convertLegacyToOoxml } from './office.js'

export const DEFAULT_LIMITS = { maxChars: 300000, maxRows: 5000, maxEntries: 5000, maxPages: 400 }

// 这些格式会额外把原文件存进 inbox，便于回溯原始排版
export const KEEP_ORIGINAL_ROUTES = ['docx', 'xlsx', 'pptx', 'odf', 'epub', 'pdf', 'legacy', 'image', 'av', 'binary']

const message = error => (error && error.message) || String(error)

export function humanSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = Number(bytes) || 0
  let index = 0
  while (value >= 1024 && index < units.length - 1) { value = value / 1024; index++ }
  return (index === 0 ? String(value) : value.toFixed(1)) + ' ' + units[index]
}

function clip(text, limits, warnings) {
  const raw = String(text == null ? '' : text).replace(/\r\n/g, '\n')
  const s = raw.split('\n').map(line => line.replace(/[ \t]+$/, '')).join('\n').replace(/\n{4,}/g, '\n\n\n').trim()
  if (s.length <= limits.maxChars) return s
  warnings.push('正文超过 ' + limits.maxChars + ' 字，已截断（原文 ' + s.length + ' 字）')
  return s.slice(0, limits.maxChars) + '\n\n> …（内容过长，已截断）'
}

function listingMarkdown(entries, limits, warnings, heading) {
  const dirs = entries.filter(item => item.directory)
  const files = entries.filter(item => !item.directory)
  const total = files.reduce((sum, item) => sum + (item.size || 0), 0)
  const lines = [
    heading + '：' + files.length + ' 个文件' + (dirs.length ? '、' + dirs.length + ' 个目录' : '') + '，未压缩合计 ' + humanSize(total),
    '',
    '| 路径 | 大小 |',
    '| --- | --- |',
  ]
  const shown = files.slice(0, limits.maxEntries)
  for (const item of shown) lines.push('| ' + String(item.name).replace(/\\\\/g, '/') + ' | ' + humanSize(item.size) + ' |')
  if (files.length > shown.length) {
    warnings.push('目录项过多，仅列出前 ' + limits.maxEntries + ' 个')
    lines.push('| …（其余 ' + (files.length - shown.length) + ' 个已省略） | |')
  }
  lines.push('', '> 这里只是压缩包内的目录清单；需要某个文件的内容时，请把它单独拖进知识库。')
  return lines.join('\n')
}

const PARSERS = {
  docx: docxToMarkdown,
  xlsx: xlsxToMarkdown,
  pptx: pptxToMarkdown,
  odf: opendocumentToMarkdown,
  epub: epubToMarkdown,
}

export async function extract(name, buffer, options) {
  const config = (options && options.config) || null
  const limits = Object.assign({}, DEFAULT_LIMITS, (options && options.limits) || {})
  const depth = (options && options.depth) || 0
  const { ext, route } = routeFor(name)
  const result = {
    kind: 'note',
    route,
    ext,
    label: describeRoute(route),
    title: basename(name, extOf(name)) || name,
    markdown: '',
    meta: {},
    warnings: [],
    reason: null,
  }
  if (!buffer || !buffer.length) {
    result.kind = 'attachment'
    result.reason = '文件为空'
    return result
  }
  try {
    switch (route) {
      case 'text':
        result.markdown = clip(decodeText(buffer), limits, result.warnings)
        break
      case 'csv': {
        const parsed = csvToMarkdown(decodeText(buffer), { maxRows: limits.maxRows })
        if (parsed.rows >= limits.maxRows) result.warnings.push('行数超过 ' + limits.maxRows + '，仅保留前 ' + limits.maxRows + ' 行')
        result.meta.rows = parsed.rows
        result.meta.delimiter = parsed.delimiter
        result.markdown = clip(parsed.markdown, limits, result.warnings)
        break
      }
      case 'html':
        result.markdown = clip(htmlToText(decodeText(buffer)), limits, result.warnings)
        break
      case 'eml':
        result.markdown = clip(emlToText(decodeText(buffer)), limits, result.warnings)
        break
      case 'rtf':
        result.markdown = clip(rtfToText(decodeText(buffer)), limits, result.warnings)
        break
      case 'subtitle':
        result.markdown = clip(subtitleToText(decodeText(buffer)), limits, result.warnings)
        break
      case 'docx':
      case 'xlsx':
      case 'pptx':
      case 'odf':
      case 'epub': {
        const parsed = PARSERS[route](buffer, limits)
        result.markdown = clip(parsed.markdown, limits, result.warnings)
        Object.assign(result.meta, parsed.meta || {})
        break
      }
      case 'pdf': {
        const parsed = pdfToText(buffer, limits)
        result.markdown = clip(parsed.markdown, limits, result.warnings)
        Object.assign(result.meta, parsed.meta || {})
        if (parsed.pageCount != null) result.meta.pages = parsed.pageCount
        break
      }
      case 'zip': {
        const parsed = zipListing(buffer)
        result.meta.entries = parsed.entries.length
        result.markdown = listingMarkdown(parsed.entries, limits, result.warnings, '压缩包目录')
        break
      }
      case 'tar':
      case 'targz': {
        const inner = route === 'targz' ? maybeGunzip(buffer) : buffer
        if (route === 'targz' && inner === buffer) {
          result.kind = 'attachment'
          result.reason = '不是有效的 gzip 文件'
          break
        }
        const entries = tarListing(inner)
        if (!entries.length) {
          if (looksLikeText(inner)) {
            result.markdown = clip(decodeText(inner), limits, result.warnings)
            break
          }
          result.kind = 'attachment'
          result.reason = '不是有效的 tar 归档'
          break
        }
        result.meta.entries = entries.length
        result.markdown = listingMarkdown(entries, limits, result.warnings, '归档目录')
        break
      }
      case 'legacy': {
        if (depth > 2) {
          result.kind = 'attachment'
          result.reason = '转换层数过深，停止继续转换'
          break
        }
        if (config && config.legacyEngine === false) {
          result.kind = 'attachment'
          result.reason = '旧版 Office 转换已在设置中关闭'
          break
        }
        const converted = await convertLegacyToOoxml(buffer, ext, { config, timeoutMs: (options && options.timeoutMs) || 120000 })
        if (!converted.ok) {
          result.kind = 'attachment'
          result.reason = converted.error
          if (converted.hint) result.warnings.push(converted.hint)
          break
        }
        const inner = await extract('converted.' + converted.ext, converted.buffer, { config, limits, depth: depth + 1, timeoutMs: options && options.timeoutMs })
        result.route = inner.route
        result.label = inner.label
        result.markdown = inner.markdown
        result.meta = Object.assign({}, inner.meta, { convertedFrom: ext, engine: converted.engine })
        result.warnings = result.warnings.concat(inner.warnings)
        if (inner.kind === 'attachment') {
          result.kind = 'attachment'
          result.reason = inner.reason
        }
        break
      }
      default: {
        if (looksLikeText(buffer)) {
          result.markdown = clip(decodeText(buffer), limits, result.warnings)
          break
        }
        result.kind = 'attachment'
        result.reason = route === 'image'
          ? '图片不做 OCR，先作为附件保存'
          : route === 'av'
            ? '音视频不提取文字，作为附件保存'
            : '二进制文件，作为附件保存'
      }
    }
  } catch (error) {
    result.kind = 'attachment'
    result.reason = '解析失败：' + message(error)
  }
  if (result.kind === 'note' && !result.markdown.trim()) {
    result.kind = 'attachment'
    result.reason = '没有提取到任何文字（可能是扫描件、纯图片或加密文件）'
  }
  return result
}
