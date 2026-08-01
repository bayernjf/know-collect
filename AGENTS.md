# AGENTS.md - VideoVault 项目指南

## 项目简介

跨平台视频收藏管理工具（抖音/B站/小红书），支持 AI 智能总结、报告生成、文件夹分组、笔记批注。

## 技术栈

- React 18 + TypeScript + Vite 5
- 状态管理：React Context（`src/store.tsx`）
- 数据库：Supabase（PostgreSQL），本地 fallback 为 localStorage
- 认证：Supabase Auth（邮箱+密码）
- AI：自定义 OpenAI 兼容 API，无配置时 fallback 为 mock

## 常用命令

```bash
npm install       # 安装依赖
npm run dev       # 开发服务器（Vite HMR）
npm run build     # 类型检查 + 生产构建
npm run preview   # 预览生产构建
```

## 项目结构

- `src/lib/` — 基础设施层（Supabase 客户端、Auth、数据库服务、AI 调用、URL 解析、报告导出、数据导入）
- `src/components/` — UI 组件
- `src/store.tsx` — 全局状态 Context，所有 CRUD 操作在此
- `src/types.ts` — 核心类型定义（新增视频字段需同步 `VideoInput` 与 `Video`）
- `supabase-schema.sql` — 数据库建表 SQL
- `supabase/functions/fetch-meta/` — 元数据抓取 Edge Function（生产环境代理，绕过抖音/小红书 CORS）
- `vite.config.ts` — 内置开发期 `/api/meta` 代理（服务端抓取，无需额外部署）

## 开发约定

- 所有写操作双写：localStorage（即时）+ Supabase（异步），Supabase 失败不影响本地体验
- 未配置 Supabase 时进入本地模式，无需登录，功能完整可用
- AI 调用统一走 `/chat/completions` 接口，兼容 OpenAI / DeepSeek / 通义千问 / Ollama
- 数据库 RLS 基于 `auth.uid()` 做用户隔离，所有表含 `user_id` 列
- 样式为单文件 CSS（`src/styles.css`），暗色主题，CSS 变量定义在 `:root`

## 视频元数据与封面

- 粘贴链接后，`src/lib/urlParser.ts` 的 `parseVideoUrl` 识别平台并提取 `videoId`（抖音支持 `v.douyin.com` 短链，小红书支持 `xhslink.com` 等分享链接）
- 标题/作者/描述/封面通过**元数据代理**抓取，避免 CORS：
  - 开发期：`vite.config.ts` 的 `/api/meta` 中间件（服务端 fetch，移动端 UA）
  - 生产期：部署 `supabase/functions/fetch-meta` Edge Function，URL 配置在 `VITE_METADATA_PROXY_URL`（见 `.env.example`）
- 抓取封面来源优先级：`og:image`/`og:image:url`/`twitter:image` → `<link rel="image_src">` → JSON-LD `thumbnailUrl`；作者优先取 JSON-LD，回退 OG
- 封面图存入 `Video.coverUrl`（`VideoInput` 已含该字段，`store.addVideo` 用 `...input` 自动写入）。卡片与详情页渲染 `<img>`，加载失败回退平台图标
- 历史已存视频当初未抓封面，仍显示平台 emoji；新收藏会自动抓取封面

## 修改代码注意事项

1. **新增数据表**：需同时更新 `supabase-schema.sql`、`src/types.ts`、`src/lib/db.ts`、`src/store.tsx`
2. **新增页面**：需更新 `src/types.ts` 的 `Page` 类型、`src/App.tsx` 路由、`src/components/Sidebar.tsx` 导航
3. **新增组件**：样式追加到 `src/styles.css` 末尾，按 `/* ─── 组件名 ─── */` 格式注释分隔
4. **AI 相关**：测试连接逻辑在 `src/lib/ai.ts` 的 `testAIConnection`，所有 AI 调用需支持超时和错误处理
5. **导出/导入**：报告导出在 `src/lib/export.ts`，数据导入解析在 `src/lib/import.ts`
6. **PWA**：`public/manifest.json` 定义应用元数据，`index.html` 包含 PWA meta 标签
7. **元数据代理**：抖音/小红书抓取走代理（开发 `/api/meta`、生产 `fetch-meta`）。改动代理逻辑时两处需同步；抓取用移动端 UA（桌面端常为 SPA 空壳抓不到封面）。新增视频字段需同步 `src/types.ts` 的 `VideoInput` 与 `Video`，并在 `AddVideoModal.tsx` 保存链路与卡片/详情渲染处处理
8. **提交信息**：commit message 必须使用**英文**（简洁祈使句，如 `Add cover image rendering`、`Fix douyin short-link parsing`），便于国际化协作与工具解析
