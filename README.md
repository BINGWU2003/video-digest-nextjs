# Video Digest Next.js

Video Digest 是一个基于 Next.js 的视频摘要产品。用户可以提交 YouTube 或 Bilibili 视频链接，系统异步提取字幕或音频转写，生成结构化摘要，并支持通过已验证邮箱投递结果。

项目采用 MCP-first 架构：网站内部操作和外部 agent 都围绕同一组 MCP tools 工作，长任务通过队列交给 worker 执行，Postgres 保存任务、字幕、摘要、投递和用量记录。

## 技术栈

- Monorepo: Turborepo + pnpm workspace
- Web: Next.js App Router + React + Tailwind CSS
- Auth: Supabase Auth
- Database: Supabase Postgres + SQL migrations + RLS
- Contracts: Zod
- Worker: TypeScript Node.js 模板，后续接 BullMQ/Redis

## 目录结构

```txt
apps/
  web/                 Next.js 网页应用，后续承载 /api/mcp
  worker/              后台 worker 模板，后续消费视频处理队列

packages/
  job-contracts/       跨层 zod schema、actor、job payload 和共享类型
  database/            数据库类型、repository interface 和 Supabase 实现
  video-digest-core/   核心业务服务，不绑定 Next.js、MCP 或 BullMQ
  mcp-tools/           MCP tool 适配层
  queue/               队列名称、payload 和后续 BullMQ helper
  eslint-config/       共享 ESLint 配置
  typescript-config/   共享 TypeScript 配置

docs/                  产品、架构、部署、数据库和后端模块文档
supabase/migrations/   Supabase SQL migrations
```

## 当前状态

已完成：

- Web 静态产品界面和 Supabase 登录骨架。
- 数据库表结构设计文档。
- 后端模块骨架。
- `video-records` 创建链路、记录读取 API，以及任务事件/用量事件写入：

```txt
create_video_digest_job
  -> @repo/video-digest-core createVideoRecord()
  -> @repo/database VideoRecordsRepository
  -> @repo/database JobEventsRepository
  -> @repo/database UsageEventsRepository
```

暂未完成：

- BullMQ/Redis 入队与 worker 消费。
- 视频 provider、ASR、LLM summary 和邮件投递实现。

## 本地开发

安装依赖：

```bash
pnpm install
```

启动 Web：

```bash
pnpm --filter web dev
```

打开：

```txt
http://localhost:3000
```

启动 worker 模板：

```bash
pnpm --filter worker dev
```

## Supabase 配置

复制 Web 环境变量示例：

```bash
cp apps/web/env.local.example apps/web/.env.local
```

填写：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

如果项目仍使用旧版 anon key，也可以填：

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Supabase 控制台建议加入本地回调地址：

```txt
http://localhost:3000/auth/callback
```

## 常用命令

```bash
pnpm dev
pnpm build
pnpm lint
pnpm check-types
pnpm format
```

按 workspace 运行：

```bash
pnpm --filter web dev
pnpm --filter worker build
pnpm --filter @repo/video-digest-core check-types
```

## 文档入口

- [Web 产品设计](docs/video-digest-web-product.md)
- [MCP-first 架构](docs/video-digest-mcp-architecture.md)
- [部署方案](docs/video-digest-deployment.md)
- [数据库表结构](docs/video-digest-database-schema.md)
- [后端模块划分](docs/video-digest-backend-modules.md)

## Workspace README

- [apps/web](apps/web/README.md)
- [apps/worker](apps/worker/README.md)
- [packages/job-contracts](packages/job-contracts/README.md)
- [packages/database](packages/database/README.md)
- [packages/video-digest-core](packages/video-digest-core/README.md)
- [packages/mcp-tools](packages/mcp-tools/README.md)
- [packages/queue](packages/queue/README.md)
- [packages/eslint-config](packages/eslint-config/README.md)
- [packages/typescript-config](packages/typescript-config/README.md)

## 开发原则

- 写操作优先通过 MCP tool 或核心业务层收敛。
- 页面读取可以直接查数据库模型。
- 长任务不在 Next.js request 生命周期内同步执行。
- Core service 不依赖框架、协议、队列或具体数据库客户端。
- 邮件投递只允许发送到当前用户已验证邮箱。
