// 旧版 Office（.doc/.xls/.ppt）转换桥。
// 优先使用 harness 自带的 @deepseek-ai/libreoffice-kit（原生 LibreOffice 引擎）。
// 引擎属于「可选增强」：探测失败时上层会降级成「仅存附件」，不会让导入失败。
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { LEGACY_TARGETS } from './formats.js'

const KIT_PACKAGE = '@deepseek-ai/libreoffice-kit'
const KIT_ENTRY = join('@deepseek-ai', 'libreoffice-kit', 'lib', 'index.js')

export const KIT_HINT = '可以在「设置 → 插件 → 知识库」里填入 LibreOffice 引擎目录（含 lib/index.js 的 @deepseek-ai/libreoffice-kit），或先把文件另存为 .docx/.xlsx/.pptx 再拖入。'

let cache = { key: undefined, entry: null, api: null, error: null, tried: false }

const message = error => (error && error.message) || String(error)

function unique(list) {
  const out = []
  for (const item of list) if (item && !out.includes(item)) out.push(item)
  return out
}

function candidateBaseDirs() {
  const dirs = []
  for (const key of ['DSH_APP_ROOT', 'DSH_RESOURCES', 'DSH_INSTALL_ROOT', 'APP_ROOT']) {
    const value = process.env[key]
    if (value) dirs.push(join(value, 'node_modules'), join(value, 'resources', 'app.asar.unpacked', 'node_modules'))
  }
  if (process.resourcesPath) {
    dirs.push(join(process.resourcesPath, 'app.asar.unpacked', 'node_modules'))
    dirs.push(join(process.resourcesPath, 'app', 'node_modules'))
    // DSH Desktop 0.12+ 把 @deepseek-ai/libreoffice-kit 的 JS 包留在 app.asar 里，
    // 只有平台引擎（libreoffice-kit-win32-x64）在 app.asar.unpacked。asar 内的 ESM 由
    // Electron 的 asar 支持加载，引擎包由 harness 的 registerOfficeEngineResolution
    // 钩子重定向到 unpacked，所以这里必须把 app.asar\node_modules 也作为候选。
    dirs.push(join(process.resourcesPath, 'app.asar', 'node_modules'))
  }
  const exeDir = dirname(process.execPath || '')
  dirs.push(join(exeDir, 'resources', 'app.asar.unpacked', 'node_modules'))
  dirs.push(join(exeDir, 'resources', 'app.asar', 'node_modules'))
  dirs.push(join(exeDir, 'resources', 'app', 'node_modules'))
  dirs.push(join(exeDir, 'node_modules'))
  if (process.env.DSH_PROFILE_DIR) dirs.push(join(process.env.DSH_PROFILE_DIR, 'node_modules'))
  if (process.env.DSH_HOME) dirs.push(join(process.env.DSH_HOME, 'node_modules'))
  return unique(dirs)
}

async function importKit(entryPath) {
  const mod = await import(pathToFileURL(entryPath).href)
  const api = mod && typeof mod.createConverter === 'function' ? mod : (mod && mod.default) || null
  if (!api || typeof api.createConverter !== 'function') throw new Error('模块已找到但不含 createConverter 导出')
  return { api, entryPath }
}

async function resolveKit(config) {
  const errors = []
  const explicit = config && typeof config.libreOfficeKitPath === 'string' ? config.libreOfficeKitPath.trim() : ''
  const entries = []
  if (explicit) {
    if (explicit.toLowerCase().endsWith('.js') && existsSync(explicit)) entries.push(explicit)
    if (existsSync(join(explicit, 'lib', 'index.js'))) entries.push(join(explicit, 'lib', 'index.js'))
    if (existsSync(join(explicit, KIT_ENTRY))) entries.push(join(explicit, KIT_ENTRY))
    if (!entries.length) errors.push('设置里指定的引擎路径无效：' + explicit)
  }
  for (const dir of candidateBaseDirs()) {
    const direct = join(dir, KIT_ENTRY)
    if (existsSync(direct)) entries.push(direct)
  }
  for (const target of unique(entries)) {
    try { return await importKit(target) } catch (error) { errors.push(target + ' → ' + message(error)) }
  }
  const requireRoots = unique([
    import.meta.url,
    process.env.DSH_PROFILE_DIR ? join(process.env.DSH_PROFILE_DIR, 'index.js') : '',
    ...candidateBaseDirs().map(dir => join(dir, 'index.js')),
  ])
  for (const root of requireRoots) {
    try {
      const resolved = createRequire(root).resolve(KIT_PACKAGE)
      return await importKit(resolved)
    } catch (error) { errors.push(root + ' → ' + message(error)) }
  }
  throw new Error('未找到 LibreOffice 引擎 ' + KIT_PACKAGE + '（候选 ' + entries.length + ' 个路径都不成立；首个错误：' + (errors[0] || '无') + '）')
}

async function getKit(config, force) {
  const key = (config && config.libreOfficeKitPath) || ''
  if (!force && cache.tried && cache.key === key) return cache
  const next = { key, entry: null, api: null, error: null, tried: true }
  try {
    const kit = await resolveKit(config)
    next.entry = kit.entryPath
    next.api = kit.api
  } catch (error) {
    next.error = message(error)
  }
  cache = next
  return cache
}

export async function officeStatus(config, force) {
  const kit = await getKit(config, force)
  if (!kit.api) return { available: false, version: null, backend: null, entry: null, error: kit.error }
  let runtime = null
  try {
    if (typeof kit.api.discoverRuntime === 'function') runtime = await kit.api.discoverRuntime()
  } catch {}
  return {
    available: true,
    version: (runtime && runtime.version) || kit.api.ENGINE_VERSION || null,
    backend: (runtime && runtime.backend) || null,
    entry: kit.entry,
    error: null,
  }
}

export function legacyTargetFor(ext) {
  return LEGACY_TARGETS[ext] || null
}

export async function convertLegacyToOoxml(buffer, ext, options) {
  const target = legacyTargetFor(ext)
  if (!target) return { ok: false, error: '暂不支持把 ' + ext + ' 交给 LibreOffice 转换（只支持 .doc/.xls/.ppt）', hint: KIT_HINT }
  const kit = await getKit(options && options.config)
  if (!kit.api) return { ok: false, error: 'LibreOffice 引擎不可用：' + kit.error, hint: KIT_HINT }
  if (buffer.length > ((options && options.maxInputBytes) || 64 * 1024 * 1024)) {
    return { ok: false, error: '文件超过 LibreOffice 转换上限（64MB）', hint: '请先裁剪内容再导入。' }
  }
  const tempCandidates = [process.env.TEMP, process.env.TMP, process.env.TMPDIR, 'C:\\Windows\\Temp']
  let dir = null
  let tempError = null
  for (const candidate of tempCandidates) {
    if (!candidate || typeof candidate !== 'string') continue
    try { dir = await mkdtemp(join(candidate, 'dskb-legacy-')); process.env.TEMP = candidate; process.env.TMP = candidate; break } catch (error) { tempError = error }
  }
  if (!dir) throw new Error('没有可用的临时目录，无法转换旧格式: ' + (tempError && tempError.message))
  const inputPath = join(dir, 'input' + ext)
  const outputPath = join(dir, 'output.' + target)
  let converter = null
  try {
    await writeFile(inputPath, buffer)
    converter = await kit.api.createConverter({ timeoutMs: (options && options.timeoutMs) || 120000 })
    await converter.convert({ inputPath, outputPath })
    const converted = await readFile(outputPath)
    if (!converted.length) return { ok: false, error: '转换结果为空', hint: KIT_HINT }
    return { ok: true, buffer: converted, ext: target, engine: 'libreoffice-kit' }
  } catch (error) {
    return { ok: false, error: 'LibreOffice 转换失败：' + message(error), hint: KIT_HINT }
  } finally {
    try { if (converter && typeof converter.dispose === 'function') await converter.dispose() } catch {}
    try { await rm(dir, { recursive: true, force: true }) } catch {}
  }
}
