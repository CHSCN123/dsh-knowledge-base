import { mkdir, readFile, writeFile, readdir, stat, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, extname, basename } from 'node:path'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { extract, humanSize } from './lib/extract.js'
import { FORMAT_GROUPS, extOf } from './lib/formats.js'
import { officeStatus } from './lib/office.js'

export const name = 'dsh-knowledge-base'
export const inject = ['connection']

const DEFAULT_ROOT = join(homedir(), 'knowledge-base')
const CONFIG_DIR = join(homedir(), '.dsh', 'dsh-knowledge-base')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')
const MAX_BYTES = 32 * 1024 * 1024
const FOLDERS = ['notes', 'inbox', 'references', 'entities', 'projects']

async function readConfig() {
  let cfg = {}
  try { cfg = JSON.parse(await readFile(CONFIG_FILE, 'utf8')) } catch { cfg = {} }
  return {
    enabled: cfg.enabled !== false,
    root: typeof cfg.root === 'string' && cfg.root ? cfg.root : DEFAULT_ROOT,
    keepOriginal: cfg.keepOriginal !== false,
    legacyEngine: cfg.legacyEngine !== false,
    libreOfficeKitPath: typeof cfg.libreOfficeKitPath === 'string' ? cfg.libreOfficeKitPath : '',
  }
}

async function writeConfig(cfg) {
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8')
}

const sanitize = s => String(s).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80)
const today = () => new Date().toISOString().slice(0, 10)
const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ')

function frontMatter(title, source, format) {
  return [
    '---',
    'title: ' + JSON.stringify(title),
    'tags: ' + JSON.stringify(['拖拽导入']),
    'created: ' + today(),
    'updated: ' + today(),
    'source: ' + JSON.stringify(source),
    'format: ' + JSON.stringify(format || ''),
    'confidence: medium',
    '---',
    '',
  ].join('\n')
}

async function extractTitle(mdPath) {
  try {
    const lines = (await readFile(mdPath, 'utf8')).split(/\r?\n/)
    for (const line of lines.slice(0, 20)) {
      const fm = line.match(/^title:\s*(.*)$/)
      if (fm && fm[1].trim() && fm[1].trim() !== '未命名') return fm[1].trim().replace(/^"|"$/g, '')
    }
    for (const line of lines.slice(0, 20)) {
      const h = line.match(/^#\s+(.*)$/)
      if (h && h[1].trim()) return h[1].trim()
    }
  } catch {}
  return null
}

async function listFiles(root) {
  const out = []
  for (const dir of FOLDERS) {
    let entries = []
    try { entries = await readdir(join(root, dir)) } catch { continue }
    for (const fileName of entries) {
      if (fileName.startsWith('.')) continue
      const full = join(root, dir, fileName)
      let info
      try { info = await stat(full) } catch { continue }
      if (!info.isFile()) continue
      const rel = dir + '/' + fileName
      const isNote = extname(fileName).toLowerCase() === '.md' && fileName !== 'index.md'
      out.push({
        path: rel,
        kind: isNote ? 'note' : 'file',
        title: isNote ? (await extractTitle(full)) || fileName.replace(/\.md$/i, '') : fileName,
        size: info.size,
        updated: info.mtime.toISOString(),
      })
    }
  }
  out.sort((a, b) => String(b.updated).localeCompare(String(a.updated)))
  return out
}

async function rebuildIndex(root) {
  const files = await listFiles(root)
  const groups = {}
  for (const file of files) (groups[file.path.split('/')[0]] = groups[file.path.split('/')[0]] || []).push(file)
  const lines = ['# 知识库索引', '', '> 由 dsh-knowledge-base 插件自动生成，请勿手改。', '', '生成时间：' + stamp(), '']
  for (const group of Object.keys(groups).sort()) {
    lines.push('## ' + group, '')
    for (const file of groups[group].sort((a, b) => a.title.localeCompare(b.title, 'zh'))) {
      lines.push('- [' + file.title + '](' + file.path + ')')
    }
    lines.push('')
  }
  await writeFile(join(root, 'index.md'), lines.join('\n'), 'utf8')
}

async function uniquePath(dir, fileName) {
  const ext = extname(fileName)
  const stem = basename(fileName, ext)
  let candidate = join(dir, fileName)
  let index = 1
  while (existsSync(candidate)) candidate = join(dir, stem + '-' + (index++) + ext)
  return candidate
}

function safeRelPath(input) {
  if (typeof input !== 'string' || !input) return null
  const parts = input.split('/')
  if (parts.length !== 2) return null
  const [dir, name] = parts
  if (!FOLDERS.includes(dir)) return null
  if (!name || name.startsWith('.') || name.includes('\\') || name.includes('..')) return null
  return { dir, name }
}

async function removeEntries(root, paths) {
  const deleted = []
  for (const rel of paths) {
    const parsed = safeRelPath(rel)
    if (!parsed) throw new Error('非法路径：' + rel)
    const full = join(root, parsed.dir, parsed.name)
    let info
    try { info = await stat(full) } catch { continue }
    if (!info.isFile()) throw new Error('只能删除文件：' + rel)
    await rm(full, { force: true })
    deleted.push(rel)
  }
  if (deleted.length) await rebuildIndex(root)
  return deleted
}

const TEXT_EXT = new Set([
  '.md', '.markdown', '.txt', '.text', '.json', '.jsonl', '.csv', '.tsv', '.yml', '.yaml',
  '.log', '.ini', '.cfg', '.conf', '.toml', '.xml', '.html', '.htm', '.css', '.js', '.mjs',
  '.cjs', '.ts', '.tsx', '.jsx', '.py', '.ps1', '.bat', '.sh', '.sql', '.java', '.go', '.rs', '.c', '.h', '.cpp',
])
const PREVIEW_BYTES = 256 * 1024

async function resolveEntry(root, rel) {
  const parsed = safeRelPath(rel)
  if (!parsed) throw new Error('非法路径：' + rel)
  const full = join(root, parsed.dir, parsed.name)
  let info
  try { info = await stat(full) } catch { throw new Error('文件不存在：' + rel) }
  if (!info.isFile()) throw new Error('不是文件：' + rel)
  return { parsed, full, info }
}

async function readEntry(root, rel) {
  const { parsed, full, info } = await resolveEntry(root, rel)
  const ext = extname(parsed.name).toLowerCase()
  if (!TEXT_EXT.has(ext)) {
    return { path: rel, name: parsed.name, kind: 'binary', size: info.size, updated: info.mtime.toISOString() }
  }
  const buffer = await readFile(full)
  const truncated = buffer.length > PREVIEW_BYTES
  return {
    path: rel,
    name: parsed.name,
    kind: 'text',
    size: info.size,
    updated: info.mtime.toISOString(),
    content: buffer.subarray(0, PREVIEW_BYTES).toString('utf8'),
    truncated,
  }
}

async function openEntry(root, rel) {
  const { full } = await resolveEntry(root, rel)
  const detached = { detached: true, stdio: 'ignore', windowsHide: true }
  if (process.platform === 'win32') spawn('cmd.exe', ['/c', 'start', '', full], detached).unref()
  else if (process.platform === 'darwin') spawn('open', [full], detached).unref()
  else spawn('xdg-open', [full], detached).unref()
  return { ok: true, path: rel }
}

async function writeNote(root, slug, content) {
  let notePath = join(root, 'notes', slug + '.md')
  let index = 1
  while (existsSync(notePath)) notePath = join(root, 'notes', slug + '-' + (index++) + '.md')
  await writeFile(notePath, content, 'utf8')
  return notePath
}

function noteBody(result, sourceName, sizeBytes) {
  const extra = []
  if (result.meta && result.meta.pages) extra.push(result.meta.pages + ' 页')
  if (result.meta && result.meta.rows) extra.push(result.meta.rows + ' 行')
  if (result.meta && result.meta.entries) extra.push(result.meta.entries + ' 个条目')
  if (result.meta && result.meta.convertedFrom) extra.push('经 LibreOffice 从 ' + result.meta.convertedFrom + ' 转换')
  const head = '> 来源：' + sourceName + ' · ' + result.label + ' · ' + humanSize(sizeBytes) + ' · ' + stamp() + (extra.length ? ' · ' + extra.join(' · ') : '')
  const lines = [head, '', result.markdown]
  if (result.warnings && result.warnings.length) lines.push('', '---', '', '> ⚠️ ' + result.warnings.join('；'))
  return lines.join('\n')
}

async function ingest(root, fileName, base64, config) {
  const buffer = Buffer.from(base64, 'base64')
  if (!buffer.length) throw new Error('文件为空')
  if (buffer.length > MAX_BYTES) throw new Error('文件过大（上限 ' + Math.round(MAX_BYTES / 1024 / 1024) + 'MB）')
  for (const dir of FOLDERS) await mkdir(join(root, dir), { recursive: true })

  const result = await extract(fileName, buffer, { config })
  const slug = sanitize(basename(fileName, extOf(fileName) || extname(fileName))) || 'note'
  const title = (result.meta && result.meta.title) || slug

  if (result.kind === 'note') {
    const content = frontMatter(title, fileName, result.label) + noteBody(result, fileName, buffer.length) + '\n'
    const notePath = await writeNote(root, slug, content)
    let attachment = null
    if (config.keepOriginal && result.route !== 'text') {
      const target = await uniquePath(join(root, 'inbox'), fileName)
      await writeFile(target, buffer)
      attachment = 'inbox/' + basename(target)
    }
    await rebuildIndex(root)
    return {
      ok: true,
      kind: 'note',
      path: 'notes/' + basename(notePath),
      attachment,
      title,
      route: result.route,
      label: result.label,
      size: buffer.length,
      warnings: result.warnings,
    }
  }

  const target = await uniquePath(join(root, 'inbox'), fileName)
  await writeFile(target, buffer)
  const attachmentRel = 'inbox/' + basename(target)
  const body = frontMatter(title, fileName, result.label)
    + '> 附件：[' + basename(target) + '](' + '../' + attachmentRel + ') · ' + humanSize(buffer.length) + ' · ' + result.label + ' · ' + stamp() + '\n\n'
    + (result.reason ? '> 未提取正文的原因：' + result.reason + '\n' : '')
    + (result.warnings && result.warnings.length ? '\n> ⚠️ ' + result.warnings.join('；') + '\n' : '')
  await writeNote(root, slug, body)
  await rebuildIndex(root)
  return {
    ok: true,
    kind: 'file',
    path: attachmentRel,
    title,
    route: result.route,
    label: result.label,
    size: buffer.length,
    reason: result.reason,
    warnings: result.warnings,
  }
}

async function stats(root) {
  const files = await listFiles(root)
  const notes = files.filter(file => file.kind === 'note')
  const attachments = files.filter(file => file.kind === 'file')
  const bytes = files.reduce((sum, file) => sum + (file.size || 0), 0)
  return {
    notes: notes.length,
    attachments: attachments.length,
    bytes,
    humanSize: humanSize(bytes),
    latest: files.slice(0, 5).map(file => file.title),
  }
}

export async function apply(ctx) {
  const jsonResponse = async run => {
    try {
      return Response.json(await run(), { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      ctx.logger.info('knowledge-base: request failed; error=%s', error.message || String(error))
      return Response.json({ error: error.message || String(error) }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }
  }

  const stateOf = async () => {
    const cfg = await readConfig()
    return {
      ...cfg,
      writable: true,
      maxMegabytes: Math.round(MAX_BYTES / 1024 / 1024),
      files: await listFiles(cfg.root),
      stats: await stats(cfg.root),
      formats: FORMAT_GROUPS,
      office: await officeStatus(cfg),
    }
  }

  ctx.connection.fetch.register({ path: '/api/knowledge-base.state', methods: ['GET'], requestBody: 'buffered', fetch: () => jsonResponse(stateOf) })

  ctx.connection.fetch.register({ path: '/api/knowledge-base.config', methods: ['POST'], requestBody: 'buffered', fetch: request => jsonResponse(async () => {
    const input = await request.json()
    const cfg = await readConfig()
    const next = {
      enabled: typeof input.enabled === 'boolean' ? input.enabled : cfg.enabled,
      root: typeof input.root === 'string' && input.root.trim() ? input.root.trim() : cfg.root,
      keepOriginal: typeof input.keepOriginal === 'boolean' ? input.keepOriginal : cfg.keepOriginal,
      legacyEngine: typeof input.legacyEngine === 'boolean' ? input.legacyEngine : cfg.legacyEngine,
      libreOfficeKitPath: typeof input.libreOfficeKitPath === 'string' ? input.libreOfficeKitPath.trim() : cfg.libreOfficeKitPath,
    }
    await writeConfig(next)
    return stateOf()
  }) })

  ctx.connection.fetch.register({ path: '/api/knowledge-base.ingest', methods: ['POST'], requestBody: 'buffered', fetch: request => jsonResponse(async () => {
    const cfg = await readConfig()
    if (!cfg.enabled) throw new Error('知识库未启用')
    const input = await request.json()
    if (!input || typeof input.name !== 'string' || typeof input.contentBase64 !== 'string') throw new Error('无效请求')
    return ingest(cfg.root, input.name, input.contentBase64, cfg)
  }) })

  ctx.connection.fetch.register({ path: '/api/knowledge-base.delete', methods: ['POST'], requestBody: 'buffered', fetch: request => jsonResponse(async () => {
    const cfg = await readConfig()
    const input = (await request.json()) || {}
    const paths = Array.isArray(input.paths) ? input.paths : [input.path]
    if (!paths.length || paths.some(p => !safeRelPath(p))) throw new Error('无效请求')
    const deleted = await removeEntries(cfg.root, paths)
    return { ok: true, deleted, files: await listFiles(cfg.root), stats: await stats(cfg.root) }
  }) })

  ctx.connection.fetch.register({ path: '/api/knowledge-base.read', methods: ['POST'], requestBody: 'buffered', fetch: request => jsonResponse(async () => {
    const cfg = await readConfig()
    const input = (await request.json()) || {}
    if (typeof input.path !== 'string') throw new Error('无效请求')
    return readEntry(cfg.root, input.path)
  }) })

  ctx.connection.fetch.register({ path: '/api/knowledge-base.open', methods: ['POST'], requestBody: 'buffered', fetch: request => jsonResponse(async () => {
    const cfg = await readConfig()
    const input = (await request.json()) || {}
    if (typeof input.path !== 'string') throw new Error('无效请求')
    return openEntry(cfg.root, input.path)
  }) })

  ctx.connection.fetch.register({ path: '/api/knowledge-base.office', methods: ['POST'], requestBody: 'buffered', fetch: () => jsonResponse(async () => {
    const cfg = await readConfig()
    return { office: await officeStatus(cfg, true) }
  }) })
}
