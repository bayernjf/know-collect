# know-collect（VideoVault）

跨平台视频收藏管理工具（抖音 / B站 / 小红书）。收藏视频链接后自动抓取元数据，
支持 AI 智能总结、报告生成、文件夹分组、笔记批注、知识图谱与热力图回顾。

## 技术栈

| 类别 | 方案 |
|------|------|
| 前端 | React 18 + TypeScript + Vite 5 |
| 状态管理 | React Context（`src/store.tsx`） |
| 数据库 | Supabase（PostgreSQL），未配置时降级为 localStorage |
| 认证 | Supabase Auth（邮箱 + 密码） |
| AI | 自定义 OpenAI 兼容 API，未配置时降级为 `src/mockAI.ts` |
| 采集端 | 浏览器扩展（`extension/`） |

## 快速开始

```bash
npm install
cp .env.example .env.local   # 可选：填入 Supabase 与元数据代理配置
npm run dev                  # 开发服务器（Vite HMR）
npm run build                # tsc -b + 生产构建
npm run preview              # 预览构建产物
```

## 环境变量（均可选）

| 变量 | 说明 |
|------|------|
| `VITE_SUPABASE_URL` | Supabase 项目 URL；留空则走本地模式 |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_METADATA_PROXY_URL` | 元数据抓取代理（绕过抖音 / 小红书 CORS）；开发期可留空，Vite dev server 自带 `/api/meta` 代理，生产建议用 `supabase/functions/fetch-meta` |

**不配置任何变量也能跑通全流程**：数据库降级到 localStorage，AI 降级到 mock。

## 目录结构

```
src/
├── App.tsx            # 应用入口
├── store.tsx          # Context 状态管理
├── storage.ts         # 本地 / 云端存储适配
├── lib/               # supabase、auth、ai、db、import/export、notion、urlParser
├── components/        # Dashboard、Library、Reports、Heatmap、KnowledgeGraph、
│                      # VideoCard、各类 Modal、Settings、AuthPage 等
├── mockAI.ts          # 未配置 AI 时的 mock 实现
└── types.ts
extension/             # 浏览器扩展（采集端）
supabase-schema.sql    # 建表 schema
supabase/functions/    # Supabase Edge Functions（如 fetch-meta）
```

## 注意

- 数据库与 AI 都有降级路径，改 `src/lib/` 封装时要保证两条路径都通。
- schema 入口有两处（`supabase-schema.sql` 与 `supabase/`），改表结构前确认该改哪一处。
- 详细技术栈说明见 `docs/TECH_STACK.md`，项目约定见 `AGENTS.md` 与 `handoff.md`。
