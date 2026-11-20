// 支持的文件格式路由表：扩展名 -> 处理方式。
// 这里是唯一的格式真相来源，index.js / extract.js / 前端提示都从它取值。

export const TEXT_EXTS = [
  '.md', '.markdown', '.mdx', '.txt', '.text', '.rst', '.adoc',
  '.json', '.jsonl', '.ndjson', '.json5', '.log', '.yaml', '.yml', '.toml',
  '.ini', '.conf', '.cfg', '.env', '.properties', '.lock', '.editorconfig',
  '.xml', '.xsd', '.xsl', '.xslt', '.plist', '.svg',
  '.css', '.scss', '.sass', '.less', '.styl',
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.vue', '.svelte', '.astro',
  '.py', '.pyi', '.go', '.rs', '.java', '.kt', '.kts', '.scala', '.groovy', '.gradle',
  '.c', '.h', '.cc', '.cpp', '.cxx', '.hpp', '.hh', '.cs', '.m', '.mm', '.swift',
  '.php', '.rb', '.pl', '.pm', '.lua', '.r', '.jl', '.dart', '.nim', '.zig', '.ex', '.exs', '.erl',
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.psm1', '.psd1', '.bat', '.cmd', '.reg', '.vbs',
  '.sql', '.graphql', '.gql', '.proto', '.thrift', '.tf', '.hcl', '.nix', '.cmake', '.mk',
  '.tex', '.bib', '.cls', '.sty', '.diff', '.patch', '.gitignore', '.dockerignore',
  '.pem', '.crt', '.cer', '.pub', '.asc', '.ascx', '.txt2'
]

// 特殊处理：不走纯文本通道
export const ROUTES = {
  '.csv': 'csv', '.tsv': 'csv', '.tab': 'csv', '.psv': 'csv',
  '.html': 'html', '.htm': 'html', '.xhtml': 'html', '.shtml': 'html',
  '.eml': 'eml', '.mht': 'eml', '.mhtml': 'eml', '.msg': 'eml',
  '.rtf': 'rtf',
  '.srt': 'subtitle', '.vtt': 'subtitle', '.ass': 'subtitle', '.ssa': 'subtitle', '.lrc': 'subtitle', '.sbv': 'subtitle',

  '.docx': 'docx', '.docm': 'docx', '.dotx': 'docx', '.dotm': 'docx', '.dot': 'docx',
  '.xlsx': 'xlsx', '.xlsm': 'xlsx', '.xltx': 'xlsx', '.xltm': 'xlsx',
  '.pptx': 'pptx', '.pptm': 'pptx', '.ppsx': 'pptx', '.potx': 'pptx', '.potm': 'pptx',
  '.odt': 'odf', '.ods': 'odf', '.odp': 'odf', '.odg': 'odf', '.odf': 'odf',
  '.fodt': 'odf', '.fods': 'odf', '.fodp': 'odf', '.sxw': 'odf', '.sxc': 'odf',
  '.epub': 'epub',
  '.pdf': 'pdf',

  '.zip': 'zip', '.jar': 'zip', '.war': 'zip', '.whl': 'zip', '.apk': 'zip', '.xpi': 'zip',
  '.nupkg': 'zip', '.vsix': 'zip', '.crx': 'zip', '.epub2': 'zip', '.kmz': 'zip', '.ipa': 'zip',
  '.tar': 'tar', '.gz': 'targz', '.tgz': 'targz', '.tar.gz': 'targz',

  '.doc': 'legacy', '.xls': 'legacy', '.ppt': 'legacy', '.wps': 'legacy', '.et': 'legacy', '.dps': 'legacy',

  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image', '.webp': 'image', '.bmp': 'image',
  '.tif': 'image', '.tiff': 'image', '.heic': 'image', '.heif': 'image', '.ico': 'image', '.avif': 'image',
  '.psd': 'image', '.ai': 'image', '.eps': 'image', '.raw': 'image', '.cr2': 'image', '.nef': 'image',
  '.mp3': 'av', '.wav': 'av', '.flac': 'av', '.aac': 'av', '.m4a': 'av', '.ogg': 'av', '.opus': 'av',
  '.wma': 'av', '.amr': 'av', '.mid': 'av', '.mp4': 'av', '.mkv': 'av', '.avi': 'av', '.mov': 'av',
  '.webm': 'av', '.flv': 'av', '.wmv': 'av', '.m4v': 'av', '.mpg': 'av', '.mpeg': 'av', '.3gp': 'av',
  '.rmvb': 'av', '.ts2': 'av',

  '.exe': 'binary', '.dll': 'binary', '.msi': 'binary', '.sys': 'binary', '.iso': 'binary',
  '.bin': 'binary', '.db': 'binary', '.sqlite': 'binary', '.sqlite3': 'binary', '.pak': 'binary',
  '.ttf': 'binary', '.otf': 'binary', '.woff': 'binary', '.woff2': 'binary', '.eot': 'binary',
  '.class': 'binary', '.pyc': 'binary', '.o': 'binary', '.obj': 'binary', '.so': 'binary',
  '.lib': 'binary', '.a': 'binary', '.dylib': 'binary', '.wasm': 'binary', '.dwg': 'binary',
  '.stl': 'binary', '.obj2': 'binary', '.vhd': 'binary', '.vhdx': 'binary', '.dmg': 'binary',
  '.deb': 'binary', '.rpm': 'binary', '.pkg': 'binary', '.img': 'binary', '.dat': 'binary',
  '.pst': 'binary', '.ost': 'binary', '.lnk': 'binary', '.hlsl': 'binary', '.vpk': 'binary',
}

export const LEGACY_TARGETS = { '.doc': 'docx', '.xls': 'xlsx', '.ppt': 'pptx' }

// 仅用于界面提示分组
export const FORMAT_GROUPS = [
  { id: 'doc', label: '文档', exts: ['.docx', '.doc', '.odt', '.rtf', '.pdf', '.epub', '.txt', '.md', '.html', '.rtf'] },
  { id: 'sheet', label: '表格', exts: ['.xlsx', '.xls', '.ods', '.csv', '.tsv'] },
  { id: 'slide', label: '演示', exts: ['.pptx', '.ppt', '.odp'] },
  { id: 'sub', label: '字幕 / 邮件', exts: ['.srt', '.vtt', '.ass', '.lrc', '.eml', '.mht'] },
  { id: 'code', label: '代码 / 纯文本', exts: ['.js', '.ts', '.py', '.go', '.java', '.json', '.yaml', '.xml', '.sql'] },
  { id: 'archive', label: '压缩包', exts: ['.zip', '.tar', '.gz', '.tgz'] },
  { id: 'media', label: '图片 / 音视频', exts: ['.png', '.jpg', '.webp', '.svg', '.mp3', '.mp4', '.mov'] },
]

export function extOf(name) {
  const s = String(name || '')
  const lower = s.toLowerCase()
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tar.bz2')) return '.tar.gz'
  const i = lower.lastIndexOf('.')
  if (i <= -1) return ''
  return lower.slice(i)
}

export function routeFor(name) {
  const ext = extOf(name)
  if (ROUTES[ext]) return { ext, route: ROUTES[ext] }
  if (TEXT_EXTS.includes(ext)) return { ext, route: 'text' }
  return { ext, route: 'binary' }
}

export function describeRoute(route) {
  return {
    text: '纯文本',
    csv: '表格转 Markdown',
    html: '网页正文',
    eml: '邮件正文',
    rtf: 'RTF 富文本',
    subtitle: '字幕去时间轴',
    docx: 'Word 文档',
    xlsx: 'Excel 工作簿',
    pptx: 'PowerPoint 演示',
    odf: 'OpenDocument',
    epub: '电子书',
    pdf: 'PDF 文本',
    zip: '压缩包目录',
    tar: 'tar 归档',
    targz: 'gzip 归档',
    legacy: '旧版 Office（需 LibreOffice 引擎转换）',
    image: '图片（仅存附件）',
    av: '音视频（仅存附件）',
    binary: '二进制（仅存附件）',
  }[route] || route
}
