/**
 * Tiny namespace-aware XML parser for OOXML / ODF / EPUB parts.
 * Builds a lightweight tree: { name, local, ns, attrs, children, text }
 * where text nodes are plain strings inside children.
 */
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0' }

export function decodeEntities(s) {
  if (!s || s.indexOf('&') < 0) return s
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m
    }
    const named = ENTITIES[body.toLowerCase()]
    return named === undefined ? m : named
  })
}

function parseAttrs(src) {
  const attrs = {}
  const re = /([^\s=\/]+)\s*=\s*("([^"]*)"|'([^']*)')/g
  let m
  while ((m = re.exec(src))) attrs[m[1]] = decodeEntities(m[3] !== undefined ? m[3] : m[4])
  return attrs
}

/** Parse an XML string into a tree. Returns the root element node. */
export function parseXml(source) {
  const src = String(source || '').replace(/^\uFEFF/, '')
  const root = { name: '#root', local: '#root', ns: '', attrs: {}, children: [] }
  const stack = [root]
  const nsStack = [{}]
  let i = 0
  while (i < src.length) {
    const lt = src.indexOf('<', i)
    if (lt < 0) { pushText(stack[stack.length - 1], src.slice(i)); break }
    if (lt > i) pushText(stack[stack.length - 1], src.slice(i, lt))
    if (src.startsWith('<!--', lt)) { const e = src.indexOf('-->', lt + 4); i = e < 0 ? src.length : e + 3; continue }
    if (src.startsWith('<![CDATA[', lt)) {
      const e = src.indexOf(']]>', lt + 9)
      const body = src.slice(lt + 9, e < 0 ? src.length : e)
      const top = stack[stack.length - 1]
      top.children.push(body)
      i = e < 0 ? src.length : e + 3
      continue
    }
    if (src.startsWith('<?', lt)) { const e = src.indexOf('?>', lt + 2); i = e < 0 ? src.length : e + 2; continue }
    if (src.startsWith('<!', lt)) { const e = src.indexOf('>', lt + 2); i = e < 0 ? src.length : e + 1; continue }
    const gt = findTagEnd(src, lt + 1)
    if (gt < 0) break
    const inner = src.slice(lt + 1, gt)
    if (inner.startsWith('/')) {
      const name = inner.slice(1).trim()
      for (let d = stack.length - 1; d > 0; d--) {
        if (stack[d].name === name) { stack.length = d; nsStack.length = d; break }
      }
      i = gt + 1
      continue
    }
    const selfClosing = inner.endsWith('/')
    const body = selfClosing ? inner.slice(0, -1) : inner
    const sp = body.search(/[\s\/]/)
    const name = (sp < 0 ? body : body.slice(0, sp)).trim()
    if (!name) { i = gt + 1; continue }
    const attrs = parseAttrs(sp < 0 ? '' : body.slice(sp))
    const parentNs = nsStack[nsStack.length - 1]
    const own = { ...parentNs }
    for (const key of Object.keys(attrs)) {
      if (key === 'xmlns') own[''] = attrs[key]
      else if (key.startsWith('xmlns:')) own[key.slice(6)] = attrs[key]
    }
    const ci = name.indexOf(':')
    const prefix = ci < 0 ? '' : name.slice(0, ci)
    const node = {
      name,
      local: ci < 0 ? name : name.slice(ci + 1),
      ns: own[prefix] || '',
      attrs,
      children: [],
      _own: own,
    }
    stack[stack.length - 1].children.push(node)
    if (!selfClosing) { stack.push(node); nsStack.push(own) }
    i = gt + 1
  }
  return root
}

function findTagEnd(src, from) {
  let quote = ''
  for (let i = from; i < src.length; i++) {
    const c = src[i]
    if (quote) { if (c === quote) quote = ''; continue }
    if (c === '"' || c === "'") { quote = c; continue }
    if (c === '>') return i
  }
  return -1
}

function pushText(parent, raw) {
  if (raw) parent.children.push(raw)
}

/** Direct child elements. */
export function children(el) {
  return el && el.children ? el.children.filter((c) => typeof c !== 'string') : []
}

/** Recursive search by local name, optionally restricted to a namespace URI. */
export function findAll(el, local, ns) {
  const out = []
  const walk = (node) => {
    for (const c of children(node)) {
      if (c.local === local && (ns === undefined || c.ns === ns)) out.push(c)
      walk(c)
    }
  }
  walk(el)
  return out
}

/** Direct children matching a local name. */
export function findChildren(el, local, ns) {
  return children(el).filter((c) => c.local === local && (ns === undefined || c.ns === ns))
}

/** First descendant by local name. */
export function findFirst(el, local, ns) {
  return findAll(el, local, ns)[0]
}

/** Concatenated text of every descendant text node. */
export function textOf(el) {
  if (!el) return ''
  let out = ''
  const walk = (node) => {
    for (const c of node.children || []) {
      if (typeof c === 'string') out += c
      else walk(c)
    }
  }
  walk(el)
  return out
}

/** Attribute lookup that ignores the namespace prefix (w:val / val / r:id). */
export function attr(el, ...names) {
  if (!el || !el.attrs) return undefined
  for (const want of names) {
    if (el.attrs[want] !== undefined) return el.attrs[want]
    for (const key of Object.keys(el.attrs)) {
      const ci = key.indexOf(':')
      if ((ci < 0 ? key : key.slice(ci + 1)) === want) return el.attrs[key]
    }
  }
  return undefined
}
