# dsh-knowledge-base

**把文件拖进「设置 → 知识库」，它自动变成可检索的 Markdown 笔记。**

262 种格式进得来，其中 181 种直接抽出正文；转换和存储全部在你自己的磁盘上完成——不联网、不上传、不需要任何云端账号。

## 三个理由

- **格式多到不用挑**：Word、Excel、PowerPoint、PDF、EPUB、OpenDocument、压缩包、字幕、邮件、CSV、几十种代码与纯文本……共 **262 种扩展名**都认得，拖进去自动选对解析方式；剩下 81 种（图片 / 音视频 / 二进制）原样存档并生成索引条目，一个文件都不会丢。
- **拖进去就完事**：识别格式 → 抽正文 → 写带 front-matter 的 Markdown 笔记 → 更新全库 `index.md`，一条链路自动跑完。旧版 .doc / .xls / .ppt 走 DSH 自带的 LibreOffice 引擎，不用另装 Python、Node 或解析库。
- **纯本地，不联网**：没有服务端、没有同步、没有统计上报。文件内容只经过本机进程，落在你指定的目录里；卸载插件后知识库依然是一堆能直接打开的 `.md`。

## 快速开始

一条命令（需要 DSH 自带的 `dsh` CLI）：

```powershell
dsh plugin --profile web add github:CHSCN123/dsh-knowledge-base
```

重启 DSH → 打开「设置 → 知识库」→ 把文件拖进卡片即可。

<details>
<summary>手动安装（不用命令行）</summary>

1. 克隆本仓库到任意位置：

   ```powershell
   git clone https://github.com/CHSCN123/dsh-knowledge-base
   ```

2. 链接到 profile 的 `node_modules`：

   ```powershell
   New-Item -ItemType Junction -Path "$env:APPDATA\dsh-desktop\harness\profiles\web\node_modules\dsh-knowledge-base" -Target "<仓库路径>"
   ```

3. 在该 profile 的 `cordis.patch.yml` 注册插件（与仓库内 `cordis.patch.yml` 一致）：

   ```yaml
   - insert:
       - id: dsh-knowledge-base
         name: dsh-knowledge-base
   ```

4. 重启 DSH。

</details>

前置要求：DSH 桌面端；`@deepseek-ai/cordis` 与 `@deepseek-ai/dsh-client-connection` 由 DSH 自带。

## 功能

- **导入即转笔记**：文档、表格、演示、PDF、EPUB、HTML、邮件、字幕、CSV、压缩包、代码与纯文本 → 提取正文，生成带 front-matter 的 Markdown
- **旧版 Office**：.doc / .xls / .ppt / .wps / .et / .dps 经 DSH 自带 LibreOffice 引擎转换（可开关，失败自动降级为附件）
- **压缩包**：zip / tar / gz 解出目录清单与内嵌文本（.jar/.apk/.whl/.vsix 等 zip 家族同样支持）
- **媒体与二进制**：图片 / 音视频 / 二进制存为附件，并生成对应索引条目
- **自动索引**：每次导入或删除后重建全库 `index.md` 总索引
- **双击预览**：双击标题在卡片内直接读笔记正文（超长自动截断 256 KB）
- **系统打开**：一键交给系统默认程序打开对应文件
- **两击确认删除**：先点 ✕ 武装、再点确认，4 秒超时自动复位；也支持批量删除 API

## 它不做什么

说清楚边界，省得踩坑：

- **不做 OCR**：扫描版 PDF、图片里的文字抽不出来，需要先自行 OCR
- **不解析图片/音视频内容**：只存附件和索引条目，不做字幕识别或图片描述
- **不做同步**：知识库就在本机磁盘上，多设备要靠你自己同步那个目录
- **不替你决定分类**：目前一律按导入顺序写入 `notes/`，`references/`、`entities/`、`projects/` 留给手动整理

## 支持的格式

共 **262 种**扩展名，其中 181 种抽取正文：

| 分组 | 扩展名（节选） | 处理方式 |
| --- | --- | --- |
| 文档 | .docx .doc .odt .rtf .pdf .epub .txt .md .html | 抽正文 |
| 表格 | .xlsx .xls .ods .csv .tsv | 转 Markdown 表格 |
| 演示 | .pptx .ppt .odp | 按页抽文字 |
| 字幕 / 邮件 | .srt .vtt .ass .lrc .eml .mht | 去时间轴 / 抽正文 |
| 代码 / 纯文本 | .js .ts .py .go .java .json .yaml .xml .sql … | 原样收录 |
| 压缩包 | .zip .tar .gz .tgz | 目录清单 + 内嵌文本 |
| 图片 / 音视频 | .png .jpg .webp .svg .mp3 .mp4 .mov … | 仅存附件 |

完整路由表（每个扩展名对应哪种解析器）见 [`lib/formats.js`](lib/formats.js)。

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

## License

[MIT](LICENSE)
