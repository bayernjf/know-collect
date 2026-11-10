# know-collect (VideoVault) 深度代码评审报告

- 评审日期：2026-11-02
- 评审范围：全仓库只读评审（未修改任何源码，未执行 git commit/push）
- 评审基线：HEAD = `b9a3eab docs: add git commit message convention`

---

## 1. 仓库定位与规模概览

跨平台视频收藏管理工具（抖音 / B站 / 小红书）：React 18 + TypeScript + Vite 5 单页应用，
Supabase（Postgres + Auth + RLS）云同步，未配置时降级 localStorage；AI 总结走自定义
OpenAI 兼容 API，未配置时降级 mock；附带 Chrome MV3 采集扩展与 Supabase Edge Function
元数据代理。

| 指标 | 数值（实测） |
|------|------|
| TS/TSX 源码 | 约 4,700 行 / 30 个文件（`src/`、`supabase/functions`、`extension` 合计 6,365 行含样式） |
| 样式 | `src/styles.css` 单文件 1,628 行 |
| SQL | `supabase-schema.sql` 114 行（唯一 schema 入口，无 migrations 目录） |
| 测试 | 0 个测试文件，无 test 脚本，无 CI（无 `.github/`） |
| 依赖 | 运行时 3 个（react、react-dom、@supabase/supabase-js），dev 5 个 |
| 构建产物 | 单 chunk JS 426.72 kB（gzip 124.71 kB）+ CSS 21.12 kB |

## 2. 结论摘要

| 级别 | 数量 |
|------|------|
| P0 | 1 |
| P1 | 3 |
| P2 | 13 |
| P3 | 10 |

**最关键的 3 条：**

1. **P0 — `fetch-meta` Edge Function 是未鉴权的开放代理（SSRF）**：`Access-Control-Allow-Origin: *`、无任何鉴权与目标白名单，互联网上任何人都可让它服务端抓取任意 URL（含内网/云元数据地址）。（`supabase/functions/fetch-meta/index.ts:5-9, 68-95`）
2. **P1 — `supabase-schema.sql` 在全新数据库上执行必然失败**：`videos` 表（第 5-24 行）的外键引用 `folders(id)`，而 `folders` 表在第 27 行才创建，Postgres 会报 `relation "folders" does not exist`，README/handoff 指引的初始化流程是断的。
3. **P1 — 本地模式（未配置 Supabase）下文件夹、笔记、AI 配置刷新即丢**：`storage.ts` 只持久化 videos/reports/reminders，`store.tsx:133-135` 把三者初始化为 `[]` 且全程无本地落盘，与 README「不配置任何变量也能跑通全流程」、AGENTS.md「本地模式功能完整可用」直接矛盾。

## 3. 逐条发现

### 3.1 安全

**[P0] fetch-meta 为未鉴权开放代理，存在 SSRF 与滥用风险**
- 位置：`supabase/functions/fetch-meta/index.ts:5-9`（CORS `*`）、`:68-95`（取 `?url=` 直接服务端 `fetch`，无鉴权、无域名白名单、无协议/内网地址/响应大小限制）。
- 影响：函数一旦部署到公网，任何人可 (a) 借其访问边缘节点内网/云元数据地址（SSRF），(b) 将其当作免费代理转发大流量，产生函数调用费用。
- 修复：校验 Supabase JWT（`Authorization` 头）；仅允许 `douyin.com / bilibili.com / xiaohongshu.com / b23.tv / xhslink.com` 等域名白名单；仅允许 http/https、阻断私网 IP 段；限制响应字节数与超时。

**[P2] AI API Key 明文落库且部分回显**
- 位置：`supabase-schema.sql:57`（`api_key text not null` 明文）、`src/lib/db.ts:242-254`（原样写入）、`src/components/Settings.tsx:260`（前端展示前 8 位）。
- 影响：RLS 限制了只有本人可读（schema 第 112 行策略正确），风险有限；但任何 XSS 或会话劫持都会直接泄露全部第三方 AI 密钥。
- 修复：至少不在 UI 回显密钥片段；可考虑应用层加密或仅存于 localStorage（见 3.3 本地模式问题，二者联动）。

**[P2] localStorage 缓存不按用户隔离**
- 位置：`src/storage.ts:3-5`（固定 key `videovault_data` 等）、`src/lib/auth.tsx:58-61`（登出只清 session，不清本地缓存）。
- 影响：同一浏览器多账号场景下，A 登出后 B 登录可看到 A 留在 localStorage 的视频列表（云端拉取仅在云端非空时才覆盖，见 3.3）。
- 修复：localStorage key 加 user_id 后缀，或登出时清空。

**[P3] 平台识别使用子串匹配**
- 位置：`src/lib/urlParser.ts:18-22`（`u.includes('douyin.com')` 等）。
- 影响：`https://notdouyin.com.evil.tld/...` 会被误判为抖音链接；自用工具场景影响低，仅导致平台识别错误。
- 修复：改用 `new URL(url).hostname` 做后缀匹配。

**[P3] 开发期 `/api/meta` 中间件同样无白名单**
- 位置：`vite.config.ts:11-33`。
- 影响：仅监听 localhost，风险远小于 P0 项；但同机其他进程/网页可借其发起服务端请求。
- 修复：与 fetch-meta 同步加域名白名单。

### 3.2 数据模型与 schema

**[P1] supabase-schema.sql 建表顺序错误，全新库执行失败**
- 位置：`supabase-schema.sql:5-24`（videos 引用 `folders(id)`）早于 `:27-34`（folders 建表）。
- 影响：新用户按 README `handoff.md:26`「在 Supabase SQL Editor 中执行 supabase-schema.sql」初始化必然报错中断。Postgres 不支持前向引用。
- 修复：把 `folders` 建表移到 `videos` 之前（notes/reminders 对 videos 的引用顺序是正确的）。

**[P2] Reminder.videoTitle 无数据库列**
- 位置：`src/types.ts:77`（`videoTitle?: string`）、`supabase-schema.sql:75-85`（reminders 表无该列）、`src/lib/db.ts:115-137, 363-375`（读写均不含）。
- 影响：云端重新加载后提醒标题丢失，Dashboard 显示「未命名视频」（`Dashboard.tsx:103`）。
- 修复：迁移加列，或展示端改为按 videoId join 视频标题。

**[P2] duration 字段链路断裂，永不保存**
- 位置：`src/types.ts:24-35`（`VideoInput` 无 `duration`）、`src/components/AddVideoModal.tsx:50-55`（`fetchVideoMeta` 返回的 `duration` 被丢弃）、`src/lib/db.ts`（映射有 `duration`）。
- 影响：B站 API 返回的时长（`urlParser.ts:94`）无法入库，`VideoCard.tsx:61` 的时长徽标对新视频永远不显示；AGENTS.md「新增视频字段需同步 VideoInput 与 Video」的约定本身被违反。
- 修复：`VideoInput` 增加 `duration`，AddVideoModal 增加对应 state 填充。

**[P3] 报告日期格式不一致**
- 位置：`src/store.tsx:119`（ISO）vs `src/useAIModals.tsx:147`（`toLocaleString('zh-CN')`）。
- 影响：同一列表混排两种格式。
- 修复：统一 ISO 存储、展示层格式化。

### 3.3 状态管理与云同步（正确性核心问题区）

**[P1] 本地模式下 folders / notes / aiConfigs 不持久化**
- 位置：`src/storage.ts`（全文仅 videos/reports/reminders 三个 key）、`src/store.tsx:133-135`（`useState<...>([])`，无 load 调用；对应 mutation `addFolder/addNote/addAIConfig` 等也无 save 调用）。
- 影响：未配置 Supabase 时刷新页面，文件夹、笔记、AI 模型配置全部丢失。README:35 与 AGENTS.md:37 的「本地模式功能完整可用」承诺不成立。
- 修复：storage.ts 补三组 load/save，store 初始化与 mutation 接入。

**[P1] 登录成功后不拉取云端数据**
- 位置：`src/store.tsx:138-161`（`useEffect(..., [])` 仅挂载时拉取一次）；`src/lib/auth.tsx` 的 session 变化与 store 无任何联动（store 不 import useAuth）。
- 影响：配置了 Supabase 的场景下，用户在 AuthPage 登录后看到的仍是 localStorage 旧数据，必须手动刷新页面才出现云端数据。
- 修复：把加载 effect 依赖改为 `user?.id`（登录态变化时重新拉取）。

**[P2] 云端数据无合并地覆盖本地，可致永久丢失**
- 位置：`src/store.tsx:150`（`if (sv.length) setVideos(sv)`）。
- 影响：云端非空即整体替换本地 state；此后任意一次增删改触发 `saveVideos`（如 `:217`）会把 localStorage 也覆写为纯云端集合，离线期间未同步成功的本地视频被静默丢弃。
- 修复：按 id 合并（云端优先/本地补差），或至少在覆盖前把本地独有 id 同步上行。

**[P2] updateVideoRow 不同步 cover_url / duration**
- 位置：`src/lib/db.ts:157-171`（映射白名单无 `coverUrl`/`duration`）。
- 影响：编辑弹窗改了封面（`AddVideoModal.tsx:106`）只写 localStorage，云端不同步，双写承诺（AGENTS.md:36）被打破。
- 修复：映射表补 `cover_url`（以及补了 VideoInput.duration 后的 duration）。

**[P2] 「设为默认」不在数据库清除其他默认**
- 位置：`src/store.tsx:329-332`（setDefaultAI 只把目标行置 true）、`src/components/Settings.tsx:106`（卡片入口走 `updateAIConfig(id, { isDefault: true })`，本地连其他行的 false 都不置）。
- 影响：数据库可同时存在多行 `is_default=true`；刷新后 `getDefaultAIConfig`（`store.tsx:263-265`）按 `created_at` 升序取第一个，默认项不确定。
- 修复：DB 层用事务/RPC 先清后置；或 UI 统一走 `setDefaultAI` 并补全其他行的 `is_default=false` 更新。

**[P2] 提醒到期检测只在 reminders 变化时运行**
- 位置：`src/store.tsx:165-184`（effect 依赖 `[reminders]`，无定时器）。
- 影响：页面静置期间提醒到期不会触发浏览器通知，要等到下一次 reminders 状态变更或刷新页面。
- 修复：加 `setInterval`（如每分钟）轮询到期项。

### 3.4 UI / 功能正确性

**[P2] Dashboard「最近收藏」实际取最旧 6 条**
- 位置：`src/components/Dashboard.tsx:36`（`videos.slice(-6).reverse()`）；store 约定为新插到头部（`store.tsx:216` `[video, ...prev]`），云端拉取按 `date_added desc`（`db.ts:146`）。
- 影响：看板展示的是最早收藏的 6 个视频，与标题「最近收藏」相反。
- 修复：改为 `videos.slice(0, 6)`。

**[P2] Library 状态类标签页计数恒为 0**
- 位置：`src/components/Library.tsx:152-160`：`unread/reading/done/starred` 四个 tab 的 count 走到 `videos.filter(v => v.platform === t.key).length` 分支，platform 永远不等于状态值。
- 影响：待看/在看/已看/精华四个 tab 的计数永远显示 0。
- 修复：计数分支与过滤分支（`:57-63`）对齐。

**[P2] 热力图在 UTC+8 时区整体偏移一天**
- 位置：`src/components/Heatmap.tsx:31-39`：网格游标是本地零点（`setHours(0,0,0,0)`），key 却取 `cursor.toISOString().slice(0,10)`（UTC 日期）；起始对齐又按本地周一（`:19-20`）。
- 影响：UTC+8 下每个格子的 key 比其所代表的本地日期早一天，计数落格右移一天，且周一/周日行对齐错位。
- 修复：key 改用本地格式化（如 `toLocaleDateString('sv')` 或手工拼 `y-m-d`）。

**[P2] 浏览器扩展无法加载：manifest 引用不存在的 icon.png**
- 位置：`extension/manifest.json:9-15` 引用 `icon.png`；实测 `extension/` 目录只有 `manifest.json / popup.html / popup.js` 三个文件。
- 影响：Chrome「加载已解压的扩展程序」会因找不到图标报错，handoff.md:157 的安装指引走不通。
- 修复：补 `icon.png` 或删除 manifest 中的 icons 字段。

**[P2] localStorage 写入无异常兜底**
- 位置：`src/storage.ts:16-18, 29-31, 42-44`（`setItem` 无 try/catch），调用点在 setState updater 内（如 `store.tsx:215-219`）。
- 影响：视频含大段文稿时 5MB 配额容易写满，`QuotaExceededError` 在 updater 内抛出会导致 React 渲染异常。
- 修复：save* 包 try/catch，失败时 toast 提示。

**[P3] 删除视频不清理其本地笔记/提醒**
- 位置：`src/store.tsx:243-250`（deleteVideo 只动 videos）；云端靠 FK cascade（schema `:68, :78`）能级联，本地 state/localStorage 不级联。
- 影响：本地残留孤儿笔记/提醒（提醒标题仍残留显示）。
- 修复：deleteVideo(s) 时同步清理 notes/reminders。

**[P3] 编辑弹窗无法查看/修改封面 URL**
- 位置：`src/components/AddVideoModal.tsx:32, 75`（有 `coverUrl` state）但表单（`:137-205`）无对应输入项。
- 影响：封面只能由解析自动填充，无法人工修正。
- 修复：补一个封面 URL 输入框。

**[P3] mockAI 与 Toast 死代码**
- 位置：`src/mockAI.ts:61, 114`（`generateComprehensiveReport` / `generateWeeklyReportContent` 全仓 grep 无引用）；`src/components/Toast.tsx`（无 import 方，toast 实际由 `store.tsx:186-202` 直接操作 DOM）。
- 影响：死代码误导维护者；`handoff.md:63` 仍把 Toast.tsx 描述为在用组件。
- 修复：删除或接线。

### 3.5 性能

**[P2] 知识图谱力导向模拟每帧 O(N²) + O(E·N)，且 rAF 无限运行**
- 位置：`src/components/KnowledgeGraph.tsx:167-181`（双重循环斥力）、`:183-197`（每条边 `ns.find` 线性查找）、`:209-211`（无停止条件的 requestAnimationFrame 循环）。
- 影响：节点一多（数百）持续占 CPU/耗电；`videos/folders` 任何变化还会重新随机排布（`:158-161`），用户拖拽好的布局被打乱。
- 修复：边迭代改用 id→node Map；速度收敛后停帧（或 `document.hidden` 时暂停）；保留已布局节点坐标。

**[P3] 单 chunk 426.72 kB 无代码分割**
- 实测构建输出：`dist/assets/index-BJ2f-ww9.js 426.72 kB │ gzip: 124.71 kB`（未触发 Vite 500 kB 警告）。
- 影响：当前规模可接受，仅作记录。
- 修复（可选）：按页面 lazy 或 vendor 分包。

### 3.6 测试、CI 与验证门真实性

- **测试：完全没有。** 全仓无 `*.test.*` / `__tests__` 文件，`package.json` 无 test 脚本。不存在「假断言」问题——是零覆盖。
- **CI：没有。** 仓库无 `.github/` 目录，无任何 workflow。`tools/check-migrations.sh` 是唯一校验脚本，但其指向的 `supabase/migrations/` 目录不存在，实测输出 `x No migration directory found (supabase/migrations or db/migrations).`，退出码 1 —— 该检查器在当前仓库结构下永远失败，形同虚设。
- **构建验证门（实测执行）**：
  - 命令：`npm run build`（= `tsc -b && vite build`）
  - 结果：✅ 通过。`tsc -b`（strict + noUnusedLocals）零类型错误；`vite v5.4.21` 构建 101 个模块成功，耗时 27.52s，产物如上。
  - 附带确认：构建后 `git status` 干净（未污染工作区）。
- **依赖健康（实测 `npm audit`）**：
  - 运行时依赖（`--omit=dev`）：0 漏洞。
  - 含 dev：4 个（1 moderate + 3 high），全部来自 devDependencies 链：`vite ≤6.4.3` 依赖的 esbuild（dev server 请求伪造类问题）、`nanoid <3.3.18`（GHSA-2v37-7h3g-55p8）、`source-map-js 1.0.0-1.2.1`（GHSA-68fv-2mgg-jv7q），`npm audit fix` 可修。均为开发期工具链风险，不进产物。
- **无法实测项（标注「未确认」）**：
  - Notion 导入走浏览器直连 `api.notion.com`（`src/lib/notion.ts:18-26`），浏览器 CORS 是否放行未实测（Notion API 历史上不允许浏览器跨域直连，需代理——建议实测确认，若不放行则该功能在浏览器端根本跑不通）。
  - B站 `api.bilibili.com` 浏览器直连 CORS 放行情况未实测（`src/lib/urlParser.ts:83-84`）。
  - fetch-meta 对抖音/小红书真实页面的抓取成功率未实测（需部署环境）。

### 3.7 文档与实现一致性

| 文档声明 | 实际 | 级别 |
|---|---|---|
| `handoff.md:106`「PWA 离线可用」 | 全仓无 Service Worker（`index.html` 无注册、`public/` 仅 manifest.json），不满足可安装/离线条件 | P3 |
| `handoff.md:63` Toast.tsx 为在用组件 | 死代码（见 3.4） | P3 |
| `README.md:35` / `AGENTS.md:37` 本地模式功能完整 | folders/notes/AI 配置刷新即丢（见 3.3 P1） | P1（已列） |
| `MIGRATION_CONVENTION.md` + `tools/check-migrations.sh` | `supabase/migrations/` 目录不存在，检查器实测退出 1 | P3 |
| `AGENTS.md:36` 双写策略 | updateVideoRow 漏 cover_url（见 3.3 P2） | P2（已列） |
| 仓库卫生 | 编译产物 `vite.config.js` / `vite.config.d.ts` 被 git 跟踪（`git ls-files` 实测），`.gitignore` 未排除 | P3 |

## 4. 修复优先级建议

按「先止血、再兑现文档承诺、后清质量债」排序：

1. **立即（P0）**：给 `fetch-meta` 加鉴权 + 域名白名单 + 私网阻断；在修复前如已部署，建议先关闭公网访问或下线。
2. **本周（P1 ×3）**：
   - 调换 `supabase-schema.sql` 中 folders/videos 建表顺序（一次性修复初始化断链）；
   - storage.ts 补 folders/notes/aiConfigs 的本地持久化（兑现本地模式承诺）；
   - store 加载 effect 依赖 `user?.id`，登录即拉云端。
3. **下一轮迭代（P2 精选）**：云端↔本地合并策略（防丢数据）、updateVideoRow 补 cover_url、VideoInput 补 duration、Dashboard slice(0,6)、Library tab 计数、Heatmap 本地日期 key、提醒到期定时器、setDefaultAI 数据库一致性、extension 图标、KnowledgeGraph 停帧/查表优化。
4. **持续（P3）**：删死代码、补 vite.config 编译产物 gitignore、统一日期格式、决定 PWA 真伪（补 SW 或改文档）、让 check-migrations.sh 指向真实目录或建 `supabase/migrations/`。
5. **工程地基**：引入 Vitest 至少覆盖 `urlParser` / `import` / `storage` 纯函数与 store 关键 reducer 逻辑；加一个最小 CI（lint=build 即可）防止回归。

---

*评审方式说明：本报告为静态评审 + 本地构建/审计实测；未启动任何常驻服务，未修改源码，未执行 git 写操作。标注「未确认」的条目需要运行环境或外部服务实测后方可定论。*
