# 技术栈 — know-collect (VideoVault)

更新时间：2026-09-09

## 概览
跨平台视频收藏管理工具（抖音 / B站 / 小红书），支持 AI 智能总结、报告生成、文件夹分组、笔记批注。

## 技术选型
| 层 | 选型 |
|---|---|
| 前端 | React 18 + TypeScript + Vite 5 |
| 状态管理 | React Context（`src/store.tsx`） |
| 数据库 | Supabase（PostgreSQL），无配置时 fallback 到 localStorage |
| 认证 | Supabase Auth（邮箱 + 密码） |
| AI | 自定义 OpenAI 兼容 API，无配置时 fallback 到 `src/mockAI.ts` |
| 浏览器扩展 | `extension/`（`manifest.json` + `popup.html/js`） |

## 常用命令
```bash
npm install     # 安装依赖
npm run dev     # 开发服务器（Vite HMR）
npm run build   # tsc -b + 生产构建
npm run preview # 预览构建产物
```

## 目录结构
```
src/
  App.tsx            # 应用入口
  store.tsx          # Context 状态管理
  storage.ts         # 本地/云端存储适配
  lib/               # Supabase、AI 等外部依赖封装
  components/        # UI 组件
  useAIModals.tsx    # AI 相关弹窗逻辑
  mockAI.ts          # 未配置 AI 时的 mock 实现
  types.ts           # 类型定义
extension/           # 浏览器扩展（采集端）
supabase/            # 数据库相关（functions 等）
supabase-schema.sql  # 建表 schema
```

## 注意点
- 数据库与 AI 都有 **降级路径**（localStorage / mock），本地无环境变量也能跑通全流程；
  改动 `src/lib/` 的封装时要保证两条路径都还通。
- schema 有两份入口：`supabase-schema.sql` 与 `supabase/`，改表结构时确认该改哪一处，避免不同步。
- 项目约定见仓库根目录 `AGENTS.md` 与 `handoff.md`。
