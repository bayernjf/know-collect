# Handoff: know-collect (VideoVault)

## 项目概述

跨平台视频收藏管理工具，支持抖音、B站、小红书三个平台的视频收藏、AI 智能总结、综合分析报告生成。支持 Supabase 云同步 + 用户认证隔离，可配置自定义 AI 模型（OpenAI 兼容协议）。

## 技术栈

- **框架**: React 18 + TypeScript
- **构建**: Vite 5
- **状态管理**: React Context (`StoreProvider`)
- **数据库**: Supabase（PostgreSQL），本地 fallback 为 localStorage
- **认证**: Supabase Auth（邮箱+密码），本地模式无需登录
- **AI**: 支持自定义 OpenAI 兼容 API（含测试连接），无配置时 fallback 为 mock
- **样式**: 单文件 CSS (`src/styles.css`)，暗色主题

## 环境配置

```bash
cp .env.example .env
# 填入 Supabase 项目 URL 和 Anon Key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

数据库初始化：在 Supabase SQL Editor 中执行 `supabase-schema.sql`。

## 项目结构

```
src/
├── main.tsx              # 入口
├── App.tsx               # 页面路由（dashboard / library / reports / settings）
├── types.ts              # 核心类型（Video, Report, AIConfig, Folder, Note, VideoStatus）
├── store.tsx             # 全局状态 Context（所有 CRUD + Supabase 同步）
├── storage.ts            # localStorage 读写（fallback）
├── mockAI.ts             # 模拟 AI 总结（无自定义模型时使用）
├── useAIModals.tsx       # AI 分析进度弹窗 + 报告弹窗共享 Hook
├── utils.ts              # 工具函数
├── styles.css            # 全局样式
├── lib/
│   ├── supabase.ts       # Supabase 客户端初始化
│   ├── auth.tsx          # Auth 上下文（登录/注册/登出/会话管理）
│   ├── db.ts             # 数据库服务层（所有表的 CRUD）
│   ├── ai.ts             # AI API 调用（测试连接 + 总结 + 报告生成）
│   ├── urlParser.ts      # 视频链接解析（平台检测 + 元数据抓取）
│   ├── export.ts         # 报告导出（Markdown / PDF）
│   └── import.ts         # 数据导入（CSV / JSON 备份解析）
└── components/
    ├── AuthPage.tsx          # 登录/注册页
    ├── Sidebar.tsx           # 侧边栏导航（含用户信息 + 登出）
    ├── Dashboard.tsx         # 数据看板
    ├── Library.tsx           # 视频库（筛选/搜索/批量/文件夹/状态）
    ├── Reports.tsx           # AI 报告列表
    ├── Settings.tsx          # 设置页（AI 模型管理 + 文件夹管理）
    ├── VideoCard.tsx         # 视频卡片（含状态徽标）
    ├── VideoDetailModal.tsx  # 视频详情（状态切换/文件夹/笔记）
    ├── AddVideoModal.tsx     # 添加/编辑视频（含链接自动解析）
    ├── Heatmap.tsx           # 学习热力图（91 天贡献图）
    ├── AnalyzerModal.tsx     # AI 分析进度动画
    ├── ReportModal.tsx       # 报告查看
    ├── Modal.tsx             # 通用弹窗
    └── Toast.tsx             # Toast 通知
```

## 核心数据模型

```typescript
type Platform = 'douyin' | 'bilibili' | 'xiaohongshu';
type VideoStatus = 'unread' | 'reading' | 'done' | 'starred';

interface Video {
  id: string; platform: Platform; url: string; title: string;
  author?: string; description?: string; tags: string[];
  transcript?: string; duration?: string; coverUrl?: string;
  dateAdded: string; summary: string | null; keyPoints: string[] | null;
  status: VideoStatus; folderId: string | null;
}

interface AIConfig {
  id: string; name: string; provider: string;
  apiBaseUrl: string; apiKey: string; modelName: string; isDefault: boolean;
}

interface Folder { id: string; name: string; icon: string; sortOrder: number; }
interface Note { id: string; videoId: string; content: string; createdAt: string; updatedAt: string; }
interface Report { id: string; title: string; date: string; videoCount: number; platforms: string[]; tags: string[]; content: string; videoIds: string[]; }
```

## 关键功能

| 功能 | 说明 |
|------|------|
| 用户认证 | Supabase Auth 邮箱+密码登录/注册，RLS 按 user_id 隔离数据 |
| Supabase 云同步 | 所有写操作同时写 localStorage + Supabase，启动时从 Supabase 加载 |
| 自定义 AI 模型 | 设置页添加 OpenAI 兼容 API，支持测试连接（延迟检测） |
| AI 总结 | 有自定义模型走真实 API，无配置走 mock |
| 链接自动解析 | 粘贴 URL 自动识别平台，三平台经元数据代理自动抓取标题/作者/描述/封面图（支持抖音/小红书短链与分享链接） |
| 文件夹分组 | 自建文件夹，视频可归类，Library 支持按文件夹筛选 |
| 笔记批注 | 视频详情内可添加/删除个人笔记 |
| 观看状态 | 待看/在看/已看/精华 四种状态，支持筛选 |
| 全文搜索 | 搜索覆盖标题、作者、标签、总结内容、文稿 |
| 报告导出 | 支持导出为 Markdown (.md) 和 PDF（浏览器打印） |
| 数据导入 | 支持 CSV 和 JSON 备份文件导入 |
| 学习热力图 | Dashboard 展示 91 天 GitHub 风格收藏热力图 |
| PWA | 支持安装为桌面/移动应用，离线可用 |

## 运行命令

```bash
npm install       # 安装依赖
npm run dev       # 开发服务器
npm run build     # 类型检查 + 生产构建
npm run preview   # 预览生产构建
```

## 架构决策

- **双写策略**: 写操作同步写 localStorage（即时可用）+ 异步写 Supabase（云同步），Supabase 失败不影响本地体验
- **AI 降级**: 无自定义模型配置时自动降级为 mock AI，保证功能可用
- **OpenAI 兼容协议**: AI 调用统一走 `/chat/completions` 接口，兼容 OpenAI / DeepSeek / 通义千问 / 本地 Ollama 等
- **Auth 守卫**: 已配置 Supabase 时必须登录才能使用；未配置时进入本地模式，无需登录
- **RLS 用户隔离**: 所有表含 `user_id` 列，RLS 策略基于 `auth.uid()` 确保数据隔离

## 待改进

- [x] 接入 Supabase Auth 实现用户隔离
- [x] 报告导出为 Markdown / PDF
- [x] 学习热力图
- [x] 移动端适配 / PWA
- [x] 数据导入（CSV / JSON 备份）
- [x] 浏览器插件一键收藏（`extension/` 目录：manifest + popup，跳转 `?add=<url>` 预填添加弹窗；需 `chrome://extensions` 加载解压）
- [x] 后端代理解决 CORS（`supabase/functions/fetch-meta` Edge Function + Vite dev 期 `/api/meta` 中间件；生产设 `VITE_METADATA_PROXY_URL`）
- [x] 知识图谱可视化（`KnowledgeGraph.tsx` 力导向图：视频/作者/标签/文件夹节点 + 拖拽/高亮/点击查看详情）
- [x] 数据导入（Notion）（`lib/notion.ts` + 设置页 Notion 导入区，需 Integration Token 与数据库 ID）
- [x] 学习提醒（间隔重复）（`Reminder` 模型 + `ReminderModal` + Dashboard 提醒组件 + 浏览器到期通知）
- [x] 封面图抓取（`VideoInput` 增加 `coverUrl`，解析时保存，卡片与详情页渲染封面图，加载失败回退平台图标）
- [x] 抖音/小红书链接解析补全（`parseVideoUrl` 支持 `v.douyin.com`/`xhslink.com` 等短链与分享链接；元数据代理改用移动端 UA 并以 JSON-LD / `image_src` 增强封面与作者提取）

## 新增文件清单（本轮）

```
extension/                       # 浏览器插件（MV3）
├── manifest.json
├── popup.html
└── popup.js
supabase/functions/fetch-meta/  # 元数据抓取 Edge Function（解决 CORS）
└── index.ts
src/lib/notion.ts               # Notion 数据导入
src/components/KnowledgeGraph.tsx# 知识图谱页面
src/components/ReminderModal.tsx # 学习提醒弹窗
.env.example                    # 新增 VITE_METADATA_PROXY_URL
```

## 使用说明补充

- **浏览器插件**：`cd extension` 无构建步骤，直接在 Chrome `chrome://extensions` → 开发者模式 → 加载已解压的扩展程序，选择 `extension/` 目录。点击弹窗「收藏当前页面」会打开应用并预填链接。
- **元数据代理（生产）**：部署 `supabase/functions/fetch-meta` 后将函数 URL 填入 `.env` 的 `VITE_METADATA_PROXY_URL`；开发期 Vite 自带 `/api/meta` 服务端代理，无需部署即可规避 CORS。
- **Notion 导入**：在 Notion 创建 Integration 并把目标数据库共享给它，复制 Token（`secret_...`）与数据库 ID，在设置页「Notion 数据导入」中填写即可批量导入。
- **学习提醒**：视频详情中「⏰ 设置提醒」创建间隔重复提醒；Dashboad 展示到期项并支持「已复习/稍后」；在设置页或看板可开启浏览器桌面通知。
