# dsh-knowledge-base

DSH（DeepSeek Harness）桌面端的本地知识库插件：把文件拖进「设置 → 知识库」，自动提取内容转成 Markdown 笔记，构建一个纯本地、可检索的知识库。无云端、无外部服务，数据全部留在你自己的磁盘上。

## 功能

- **拖拽导入**：Word / Excel / PowerPoint / PDF / EPUB / HTML / 邮件（.eml/.mht）/ 字幕（.srt/.ass/.vtt）/ CSV / 代码与纯文本 → 提取正文，生成带 front-matter 的 Markdown 笔记
- **旧版 Office**：.doc / .xls / .ppt / .wps 经 DSH 自带的 LibreOffice 引擎转换（可开关，失败时降级为附件）
- **压缩包**：zip / tar / gz 解出目录清单与内嵌文本
- **媒体与二进制**：图片 / 音视频 / 二进制存为附件，并生成对应索引笔记
- **自动索引**：每次导入/删除后自动重建全库 `index.md` 总索引
- **设置页管理卡片**：启用开关、知识库根目录、保留原件选项、LibreOffice 引擎状态检测
- **文件列表**：标题、类型、大小、更新时间，最近更新排前
- **双击预览**：双击标题在面板内预览笔记内容（超长截断 256 KB）
- **系统打开**：一键交给系统默认程序打开原文件
- **两击确认删除**：先点 ✕ 武装、再点确认，4 秒超时自动复位；支持批量删除 API

## 数据布局

```
<root>/                # 默认 ~/knowledge-base，可在设置页修改
  index.md             # 自动生成的总索引（勿手改）
  notes/               # Markdown 笔记
  inbox/               # 保留的原件与附件
  references/          # 预留分类目录
  entities/
  projects/
```

## 安装

前置要求：DSH 桌面端，`@deepseek-ai/cordis ^4.0.2`、`@deepseek-ai/dsh-client-connection`（DSH 自带）。

1. 克隆本仓库到任意位置：

   ```powershell
   git clone https://github.com/CHSCN123/dsh-knowledge-base
   ```

2. 链接（或复制）到你的 DSH profile 的 `node_modules`：

   ```powershell
   New-Item -ItemType Junction -Path "$env:APPDATA\dsh-desktop\harness\profiles\web\node_modules\dsh-knowledge-base" -Target "<仓库路径>"
   ```

3. 在该 profile 的 `cordis.patch.yml` 里注册插件（与仓库内 `cordis.patch.yml` 一致）：

   ```yaml
   - insert:
       - id: dsh-knowledge-base
         name: dsh-knowledge-base
   ```

4. 重启 DSH，「设置 → 知识库」卡片即出现。

## 配置

配置文件位于 `~/.dsh/dsh-knowledge-base/config.json`：

```json
{
  "enabled": true,
  "root": "D:/knowledge-base",
  "keepOriginal": true,
  "legacyEngine": true,
  "libreOfficeKitPath": ""
}
```

| 字段 | 说明 |
| --- | --- |
| `enabled` | 总开关，关闭后拖拽区停用 |
| `root` | 知识库根目录，默认 `~/knowledge-base` |
| `keepOriginal` | 转换类导入是否在 `inbox/` 额外保留一份原文件 |
| `legacyEngine` | 是否启用旧版 Office（LibreOffice）转换 |
| `libreOfficeKitPath` | 手动指定 libreoffice-kit 路径（一般留空自动探测） |

## API

插件通过 DSH 宿主代理暴露以下端点：

| 端点 | 方法 | 请求体 | 说明 |
| --- | --- | --- | --- |
| `/api/knowledge-base.state` | GET | — | 配置、文件列表、统计、引擎状态 |
| `/api/knowledge-base.config` | POST | `{ enabled?, root?, keepOriginal?, legacyEngine?, libreOfficeKitPath? }` | 更新配置并返回新状态 |
| `/api/knowledge-base.ingest` | POST | `{ name, contentBase64 }` | 导入文件（上限 32 MB） |
| `/api/knowledge-base.read` | POST | `{ path }` | 读取条目内容（文本截断 256 KB） |
| `/api/knowledge-base.open` | POST | `{ path }` | 用系统默认程序打开 |
| `/api/knowledge-base.delete` | POST | `{ path }` 或 `{ paths: [...] }` | 删除并重建索引 |
| `/api/knowledge-base.office` | POST | — | 重新检测 LibreOffice 引擎 |

**安全设计**：`read` / `open` / `delete` 只接受形如 `notes/xxx.md` 的白名单相对路径（五个内容目录下的一级文件），拒绝 `..` 穿越、反斜杠与点文件；删除仅作用于单个文件，不隐式级联。

## 支持的格式

| 分组 | 扩展名（节选） |
| --- | --- |
| 文档 | .docx .doc .odt .rtf .pdf .epub .txt .md .html |
| 表格 | .xlsx .xls .ods .csv .tsv |
| 演示 | .pptx .ppt .odp |
| 字幕 / 邮件 | .srt .vtt .ass .lrc .eml .mht |
| 代码 / 纯文本 | .js .ts .py .go .java .json .yaml .xml .sql … |
| 压缩包 | .zip .tar .gz .tgz |
| 图片 / 音视频 | .png .jpg .webp .svg .mp3 .mp4 .mov … |

完整路由表见 [`lib/formats.js`](lib/formats.js)。

## License

[MIT](LICENSE)
