window.__ModuleLoader__.load({
  id: 'dsh-knowledge-base',
  factory: require => {
    const React = require('react')
    const { IconChevronDownOutlineRegular } = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement
    const NS = 'settings.knowledgeBase'
    const zh = {
      title: '知识库',
      description: '拖拽文件进本地知识库，自动转成 Markdown 笔记',
      enabled: '启用知识库',
      enabledHint: '关闭后拖拽区停用',
      root: '知识库目录',
      dropHere: '把文件拖到这里',
      dropHint: 'Word / Excel / PPT / PDF / Markdown / 代码 / 图片 —— 自动转成笔记，图片音视频存为附件',
      reload: '刷新',
      empty: '知识库还是空的，拖个文件进来吧',
      importing: '正在导入…',
      failed: '导入失败',
      filesTitle: '已有内容',
      note: '笔记',
      file: '附件',
      keepOriginal: '保留原件到 inbox',
      keepOriginalHint: 'Office / PDF / 压缩包等转换类文件额外留一份原文件',
      engine: '旧版 Office 转换（.doc / .xls / .ppt）',
      engineHint: '使用本机 DSH 自带的 LibreOffice 引擎，失败时只存附件',
      engineReady: '引擎可用',
      engineMissing: '引擎不可用',
      recheck: '重新检测',
      checking: '检测中…',
      formats: '支持的格式',
      notesLabel: '笔记',
      filesLabel: '附件',
      limitHint: '单文件上限',
      showFormats: '展开',
      hideFormats: '收起',
      delConfirm: '确认删除',
      delFailed: '删除失败',
      deleted: '已删除',
      openHint: '双击打开笔记',
      previewLoading: '读取中…',
      previewFailed: '打开失败',
      previewTruncated: '内容过长，仅显示前 256 KB',
      previewBinary: '二进制附件，无法内联预览',
      openWith: '用默认程序打开',
      closePreview: '关闭',
      opened: '已交给默认程序打开：',
    }
    const en = {
      title: 'Knowledge base',
      description: 'Drop files into the local knowledge base; they become Markdown notes',
      enabled: 'Enable knowledge base',
      enabledHint: 'Disables the drop zone',
      root: 'Knowledge base folder',
      dropHere: 'Drop files here',
      dropHint: 'Word / Excel / PPT / PDF / Markdown / code / images all become notes; media is stored as an attachment',
      reload: 'Reload',
      empty: 'Empty. Drop a file to start.',
      importing: 'Importing…',
      failed: 'Import failed',
      filesTitle: 'Contents',
      note: 'Note',
      file: 'Attachment',
      keepOriginal: 'Keep the original in inbox',
      keepOriginalHint: 'Also store the source file for Office / PDF / archive imports',
      engine: 'Legacy Office conversion (.doc / .xls / .ppt)',
      engineHint: 'Uses the LibreOffice engine shipped with DSH; falls back to attachment only',
      engineReady: 'Engine ready',
      engineMissing: 'Engine unavailable',
      recheck: 'Re-check',
      checking: 'Checking…',
      formats: 'Supported formats',
      notesLabel: 'notes',
      filesLabel: 'attachments',
      limitHint: 'Max file size',
      showFormats: 'Show',
      hideFormats: 'Hide',
      delConfirm: 'Confirm delete',
      delFailed: 'Delete failed',
      deleted: 'Deleted',
      openHint: 'Double-click to open',
      previewLoading: 'Loading…',
      previewFailed: 'Failed to open',
      previewTruncated: 'Too long; showing the first 256 KB',
      previewBinary: 'Binary attachment; cannot preview inline',
      openWith: 'Open with default app',
      closePreview: 'Close',
      opened: 'Opened with the default app: ',
    }
    const css =
      '.dshKbCard{list-style:none;border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);border-radius:16px;transition:border-color .16s,background .16s}' +
      '.dshKbCard:hover{border-color:var(--dsw-alias-label-dimmed)}' +
      '.dshKbHeader{appearance:none;display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;background:transparent;border:0;border-radius:12px;text-align:left;color:inherit;font:inherit;cursor:pointer}' +
      '.dshKbHeading{display:flex;flex:1;flex-direction:column;gap:4px;min-width:0}' +
      '.dshKbTitle{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}' +
      '.dshKbDesc{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}' +
      '.dshKbChevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}' +
      '.dshKbHeader[aria-expanded=true] .dshKbChevron{transform:rotate(180deg)}' +
      '.dshKbBody{border-top:.5px solid var(--dsw-alias-border-l2);margin:0 16px;padding:12px 0 16px;display:flex;flex-direction:column;gap:12px}' +
      '.dshKbRow{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary)}' +
      '.dshKbRow input[type=checkbox]{accent-color:var(--dsw-alias-brand-primary);width:16px;height:16px;flex:none}' +
      '.dshKbBlock{display:flex;flex-direction:column;gap:4px}' +
      '.dshKbInput{box-sizing:border-box;flex:1;height:32px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}' +
      '.dshKbDrop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:96px;padding:16px;border:1.5px dashed var(--dsw-alias-border-l4);border-radius:12px;text-align:center;transition:border-color .16s,background .16s}' +
      '.dshKbDropOver{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}' +
      '.dshKbDropTitle{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);margin:0}' +
      '.dshKbHint{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0}' +
      '.dshKbRowBetween{display:flex;align-items:center;justify-content:space-between;gap:8px}' +
      '.dshKbFilesTitle{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}' +
      '.dshKbReload{appearance:none;font:inherit;font-size:12px;line-height:1.5;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:3px 12px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}' +
      '.dshKbList{list-style:none;margin:0;padding:0;max-height:260px;overflow:auto;display:flex;flex-direction:column;gap:2px}' +
      '.dshKbItem{display:flex;align-items:center;gap:8px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);padding:2px 0}' +
      '.dshKbKind{flex:none;font-size:10px;font-weight:600;color:var(--dsw-alias-label-tertiary);border:1px solid var(--dsw-alias-border-l2);border-radius:4px;padding:0 4px}' +
      '.dshKbPath{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}' +
      '.dshKbSize{flex:none;margin-left:auto;font-size:11px;color:var(--dsw-alias-label-tertiary)}' +
      '.dshKbStatus{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--dsw-alias-label-secondary)}' +
      '.dshKbError{color:var(--dsw-alias-state-error-primary)}' +
      '.dshKbEngineRow{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary)}' +
      '.dshKbDot{width:7px;height:7px;border-radius:50%;flex:none}' +
      '.dshKbFormats{display:flex;flex-direction:column;gap:4px;margin-top:2px}' +
      '.dshKbFormatRow{display:flex;gap:8px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}' +
      '.dshKbFormatName{flex:none;width:76px;font-weight:600;color:var(--dsw-alias-label-secondary)}' +
      '.dshKbLink{appearance:none;font:inherit;font-size:12px;border:0;background:transparent;color:var(--dsw-alias-brand-primary);cursor:pointer;padding:0;text-align:left}' +
      '.dshKbDel{appearance:none;font:inherit;font-size:11px;line-height:1.5;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:1px 7px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;flex:none;white-space:nowrap}' +
      '.dshKbDel:hover{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}' +
      '.dshKbDelArmed{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);font-weight:600}' +
      '.dshKbOpen{cursor:pointer}' +
      '.dshKbOpen:hover{color:var(--dsw-alias-brand-primary);text-decoration:underline}' +
      '.dshKbPreview{display:flex;flex-direction:column;gap:6px;margin-top:2px;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}' +
      '.dshKbPreviewHead{display:flex;align-items:center;gap:8px;min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary)}' +
      '.dshKbPreviewName{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-weight:600;color:var(--dsw-alias-label-primary)}' +
      '.dshKbPreviewMeta{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}' +
      '.dshKbPreviewBtns{display:flex;flex:none;gap:8px;margin-left:auto}' +
      '.dshKbPreviewBody{margin:0;max-height:240px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary)}' +
      '.dshKbCard :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}'

    function toBase64(buf) {
      let s = ''
      const bytes = new Uint8Array(buf)
      const chunk = 0x8000
      for (let i = 0; i < bytes.length; i += chunk) {
        s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
      }
      return btoa(s)
    }

    function human(bytes) {
      const n = Number(bytes) || 0
      if (n < 1024) return n + ' B'
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
      return (n / 1024 / 1024).toFixed(1) + ' MB'
    }

    function KnowledgeCard({ t, callApi }) {
      const [expanded, setExpanded] = React.useState(true)
      const [state, setState] = React.useState(null)
      const [rootDraft, setRootDraft] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [checking, setChecking] = React.useState(false)
      const [showFormats, setShowFormats] = React.useState(false)
      const [status, setStatus] = React.useState([])
      const [dragOver, setDragOver] = React.useState(false)
      const [pendingDel, setPendingDel] = React.useState(null)
      const [preview, setPreview] = React.useState(null)
      const delTimer = React.useRef(null)
      React.useEffect(() => () => { if (delTimer.current) clearTimeout(delTimer.current) }, [])

      const load = React.useCallback(async () => {
        try {
          const result = await callApi('state')
          setState(result)
          setRootDraft(result.root)
        } catch (e) {}
      }, [callApi])

      React.useEffect(() => { void load() }, [load])

      const saveConfig = async patch => {
        try {
          const result = await callApi('config', patch)
          setState(result)
          setRootDraft(result.root)
        } catch (e) {}
      }

      const recheck = async () => {
        setChecking(true)
        try {
          const result = await callApi('office', {})
          setState(prev => Object.assign({}, prev || {}, { office: result.office }))
        } catch (e) {}
        setChecking(false)
      }

      const ingest = async files => {
        if (!files || !files.length) return
        setBusy(true)
        setStatus([])
        const msgs = []
        for (const file of files) {
          try {
            const buf = await file.arrayBuffer()
            const result = await callApi('ingest', { name: file.name, contentBase64: toBase64(buf) })
            let text = file.name + ' → ' + (result.label || '') + ' · ' + (result.path || '')
            if (result.reason) text += '（' + result.reason + '）'
            msgs.push({ ok: true, text: text })
          } catch (e) {
            msgs.push({ ok: false, text: file.name + ' · ' + ((e && e.error) || t('failed')) })
          }
        }
        setStatus(msgs)
        setBusy(false)
        await load()
      }

      const onDrop = e => { e.preventDefault(); setDragOver(false); void ingest(Array.from(e.dataTransfer.files)) }
      const onDragOver = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true) }
      const onDragLeave = () => setDragOver(false)

      const doDelete = async path => {
        setBusy(true)
        if (preview && preview.path === path) setPreview(null)
        try {
          const result = await callApi('delete', { path })
          setState(prev => prev ? Object.assign({}, prev, { files: result.files || [], stats: result.stats || prev.stats }) : prev)
          setStatus([{ ok: true, text: t('deleted') + ' ' + path }])
        } catch (e) {
          setStatus([{ ok: false, text: path + ' · ' + ((e && e.error) || t('delFailed')) }])
        }
        setBusy(false)
        await load()
      }

      const removeItem = path => {
        if (busy) return
        if (pendingDel === path) {
          if (delTimer.current) { clearTimeout(delTimer.current); delTimer.current = null }
          setPendingDel(null)
          void doDelete(path)
        } else {
          if (delTimer.current) clearTimeout(delTimer.current)
          setPendingDel(path)
          delTimer.current = setTimeout(() => { delTimer.current = null; setPendingDel(null) }, 4000)
        }
      }

      const openPreview = async f => {
        if (preview && preview.path === f.path) { setPreview(null); return }
        setPreview({ path: f.path, name: f.title || f.path, loading: true })
        try {
          const result = await callApi('read', { path: f.path })
          setPreview(Object.assign({ name: f.title || f.path }, result))
        } catch (e) {
          setPreview({ path: f.path, name: f.title || f.path, error: (e && e.error) || t('previewFailed') })
        }
      }

      const openWithSystem = async path => {
        try {
          await callApi('open', { path })
          setStatus([{ ok: true, text: t('opened') + path }])
        } catch (e) {
          setStatus([{ ok: false, text: path + ' · ' + ((e && e.error) || t('previewFailed')) }])
        }
      }

      const files = (state && state.files) || []
      const stats = (state && state.stats) || null
      const office = (state && state.office) || null
      const groups = (state && state.formats) || []
      const totalBytes = files.reduce((sum, f) => sum + (Number(f.size) || 0), 0)
      const limit = (state && state.maxMegabytes) || 32

      const statsLine = stats
        ? t('notesLabel') + ' ' + stats.notes + ' · ' + t('filesLabel') + ' ' + stats.attachments + ' · ' + human(totalBytes) + ' · ' + t('limitHint') + ' ' + limit + 'MB'
        : t('limitHint') + ' ' + limit + 'MB'

      return h('section', { className: 'dshKbCard' + (expanded ? ' dshKbCardOpen' : '') },
        h('button', { className: 'dshKbHeader', type: 'button', 'aria-expanded': expanded, onClick: () => setExpanded(v => !v) },
          h('span', { className: 'dshKbHeading' },
            h('span', { className: 'dshKbTitle' }, t('title')),
            h('span', { className: 'dshKbDesc' }, t('description'))),
          h(IconChevronDownOutlineRegular, { className: 'dshKbChevron' })),
        expanded && h('div', { className: 'dshKbBody' },
          h('div', { className: 'dshKbBlock' },
            h('label', { className: 'dshKbRow' },
              h('input', { type: 'checkbox', role: 'switch', checked: state ? state.enabled !== false : true, onChange: e => saveConfig({ enabled: e.target.checked }) }),
              h('span', null, t('enabled'))),
            h('p', { className: 'dshKbHint' }, t('enabledHint'))),
          h('label', { className: 'dshKbRow' },
            h('span', null, t('root')),
            h('input', { className: 'dshKbInput', value: rootDraft, spellCheck: false,
              onChange: e => setRootDraft(e.target.value),
              onBlur: () => { if (rootDraft.trim() && state && rootDraft.trim() !== state.root) saveConfig({ root: rootDraft.trim() }) } })),
          h('div', { className: 'dshKbBlock' },
            h('label', { className: 'dshKbRow' },
              h('input', { type: 'checkbox', checked: state ? state.keepOriginal !== false : true, onChange: e => saveConfig({ keepOriginal: e.target.checked }) }),
              h('span', null, t('keepOriginal'))),
            h('p', { className: 'dshKbHint' }, t('keepOriginalHint'))),
          h('div', { className: 'dshKbBlock' },
            h('label', { className: 'dshKbRow' },
              h('input', { type: 'checkbox', checked: state ? state.legacyEngine !== false : true, onChange: e => saveConfig({ legacyEngine: e.target.checked }) }),
              h('span', null, t('engine'))),
            h('p', { className: 'dshKbHint' }, t('engineHint')),
            h('div', { className: 'dshKbEngineRow' },
              h('span', { className: 'dshKbDot', style: { background: office && office.available ? '#3fb950' : '#d1242f' } }),
              h('span', null, (office && office.available ? t('engineReady') : t('engineMissing')) + (office && office.available ? ' · LibreOffice ' + office.version + ' · ' + office.backend : office && office.error ? ' · ' + office.error : '')),
              h('button', { type: 'button', className: 'dshKbLink', onClick: () => void recheck() }, checking ? t('checking') : t('recheck')))),
          h('div', { className: 'dshKbDrop' + (dragOver ? ' dshKbDropOver' : ''), onDrop, onDragOver, onDragLeave },
            h('p', { className: 'dshKbDropTitle' }, t(busy ? 'importing' : 'dropHere')),
            h('p', { className: 'dshKbHint' }, t('dropHint'))),
          status.length > 0 && h('ul', { className: 'dshKbStatus' },
            status.map((m, i) => h('li', { key: i, className: m.ok ? '' : 'dshKbError' }, m.text))),
          h('div', { className: 'dshKbRowBetween' },
            h('span', { className: 'dshKbFilesTitle' }, t('filesTitle') + (files.length ? ' (' + files.length + ')' : '')),
            h('button', { type: 'button', className: 'dshKbReload', onClick: () => void load() }, t('reload'))),
          h('p', { className: 'dshKbHint' }, statsLine),
          files.length === 0
            ? h('p', { className: 'dshKbHint' }, t('empty'))
            : h('ul', { className: 'dshKbList' },
                files.slice(0, 200).map((f, i) => h('li', { key: i, className: 'dshKbItem' },
                  h('span', { className: 'dshKbKind' }, t(f.kind === 'note' ? 'note' : 'file')),
                  h('span', { className: 'dshKbPath dshKbOpen', title: f.path + ' · ' + t('openHint'), onDoubleClick: () => void openPreview(f) }, f.title || f.path),
                  h('span', { className: 'dshKbSize' }, human(f.size)),
                  h('button', { type: 'button', className: 'dshKbDel' + (pendingDel === f.path ? ' dshKbDelArmed' : ''), title: f.path, onClick: () => removeItem(f.path) },
                    pendingDel === f.path ? t('delConfirm') : '✕')))),
          preview && h('div', { className: 'dshKbPreview' },
            h('div', { className: 'dshKbPreviewHead' },
              h('span', { className: 'dshKbPreviewName', title: preview.path }, preview.name || preview.path),
              h('span', { className: 'dshKbPreviewMeta' }, preview.size != null ? human(preview.size) : ''),
              h('div', { className: 'dshKbPreviewBtns' },
                h('button', { type: 'button', className: 'dshKbLink', onClick: () => void openWithSystem(preview.path) }, t('openWith')),
                h('button', { type: 'button', className: 'dshKbLink', onClick: () => setPreview(null) }, t('closePreview')))),
            preview.loading
              ? h('p', { className: 'dshKbHint' }, t('previewLoading'))
              : preview.error
                ? h('p', { className: 'dshKbHint dshKbError' }, preview.error)
                : preview.kind === 'text'
                  ? h('pre', { className: 'dshKbPreviewBody' }, preview.content || '')
                  : h('p', { className: 'dshKbHint' }, t('previewBinary')),
            preview.truncated && h('p', { className: 'dshKbHint' }, t('previewTruncated'))),
          h('div', { className: 'dshKbBlock' },
            h('button', { type: 'button', className: 'dshKbLink', onClick: () => setShowFormats(v => !v) },
              t('formats') + ' ' + (showFormats ? t('hideFormats') : t('showFormats'))),
            showFormats && h('div', { className: 'dshKbFormats' },
              groups.map(g => h('div', { key: g.id, className: 'dshKbFormatRow' },
                h('span', { className: 'dshKbFormatName' }, g.label),
                h('span', null, (g.exts || []).join('  '))))))))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'knowledge-base locale')
        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.pluginCss = 'dsh-knowledge-base'
          style.textContent = css
          document.head.appendChild(style)
          return () => style.remove()
        }, 'knowledge-base styles')
        const t = ctx.locale.bind(NS)
        const callApi = async (endpoint, payload) => {
          const isState = endpoint === 'state'
          const response = await fetch('/api/knowledge-base.' + endpoint, {
            method: isState ? 'GET' : 'POST',
            credentials: 'same-origin',
            cache: 'no-store',
            ...(isState ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) }),
          })
          const text = await response.text()
          let data
          try { data = text ? JSON.parse(text) : {} } catch { data = {} }
          if (!response.ok) throw (data && data.error ? data : { error: endpoint === 'state' ? 'LOAD_FAILED' : 'FAILED' })
          return data
        }
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'knowledge-base',
          order: 40,
          locale: NS,
          label: () => t('title'),
          inject: () => ({ callApi, t }),
        }, KnowledgeCard))
      },
    }
  },
})
