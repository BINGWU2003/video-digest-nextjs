# Video Digest Next.js

Video Digest 是一个基于 Next.js 的视频摘要产品。用户可以提交 YouTube 或 Bilibili 视频链接，系统异步读取视频元数据、提取字幕、生成结构化摘要，并支持把摘要投递到已验证邮箱。

项目采用 MCP-first 架构：Web 端、MCP Token 调用和后续 npm MCP Server 都复用同一组 tool 契约；长任务交给 BullMQ worker 处理；Supabase Postgres 保存记录、字幕、摘要、邮箱、投递状态、MCP Token 审计和用量事件。

## 技术栈

- Monorepo: pnpm workspace + Turborepo
- Web: Next.js App Router + React + Tailwind CSS
- Auth / Database: Supabase Auth + Supabase Postgres + RLS
- Worker: TypeScript Node.js + BullMQ + Redis
- Video extraction: yt-dlp
- Summary: OpenAI-compatible Chat Completions API，当前本地推荐 DeepSeek
- Email: Resend API + Resend Webhook
- Contracts: Zod
- Tests: Vitest
- Package build: tsup + 共享 tsup 配置包

## 目录结构

```txt
apps/
  web/                 Next.js Web 应用，包含页面、server action、API routes 和 /api/mcp gateway
  worker/              BullMQ 后台 worker，处理视频任务、摘要和邮件投递

packages/
  job-contracts/       跨层 Zod schema、actor、tool input/output 和共享类型
  database/            数据库类型、repository interface 和 Supabase repository 实现
  video-digest-core/   核心业务服务，不绑定 Next.js、MCP 协议、BullMQ 或 Supabase client
  mcp-tools/           MCP tool 适配层
  mcp-server/          可发布到 npm 的 MCP stdio server
  queue/               队列名称、payload、producer、worker helper 和 no-op queue
  eslint-config/       共享 ESLint 配置
  typescript-config/   共享 TypeScript 配置
  tsup-config/         共享 tsup 构建配置

docs/                  产品、架构、部署、数据库和后端模块文档
scripts/               本地检查脚本
supabase/migrations/   Supabase SQL migrations
```

## 当前能力

- 邮箱登录、记录列表、记录详情、邮箱设置、MCP Token 设置和用量页面。
- 通过 Web 表单、`POST /api/records` 或 `POST /api/mcp` 创建视频摘要任务。
- YouTube 元数据和字幕提取使用 `yt-dlp`；没有可用字幕且勾选音频转写时回退到本地 `faster-whisper`。
- Bilibili 元数据、公开字幕和音频下载使用 `yt-dlp`；勾选音频转写时通过本地 `faster-whisper` 生成 ASR 字幕。
- 摘要生成使用 OpenAI-compatible API。
- 邮件投递使用 Resend，并通过 `/api/webhooks/resend` 同步 `sent`、`delivered`、`delivery_delayed`、`bounced`、`complained` 等真实状态。
- MCP Token 支持 scope 校验和调用审计。
- npm MCP Server 包名为 `@video-digest-nextjs/mcp-server`，bin 为 `video-digest-mcp-server`。

## 处理链路

```txt
Web / MCP gateway / MCP Server
  -> @video-digest-nextjs/mcp-tools
  -> @video-digest-nextjs/video-digest-core
  -> @video-digest-nextjs/database repositories
  -> @video-digest-nextjs/queue
  -> apps/worker
  -> yt-dlp metadata
  -> yt-dlp transcript / yt-dlp audio + ASR
  -> OpenAI-compatible summary
  -> Resend email
  -> Resend webhook updates delivery_records
```

## 本地开发

安装依赖：

```bash
pnpm install
```

运行本地环境检查：

```bash
pnpm check:local
```

启动 Web：

```bash
pnpm --filter web dev
```

启动 worker：

```bash
pnpm --filter worker dev
```

打开：

```txt
http://localhost:3000
```

## 环境变量

Web 示例文件：

```txt
apps/web/env.local.example
```

Worker 示例文件：

```txt
apps/worker/env.local.example
```

常见必填项：

```txt
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
REDIS_URL=redis://localhost:6379
YTDLP_PATH=yt-dlp
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_API_KEY=sk_xxx
OPENAI_SUMMARY_MODEL=deepseek-v4-flash
FASTER_WHISPER_PYTHON_PATH=python
FASTER_WHISPER_MODEL=small
FASTER_WHISPER_DEVICE=cpu
FASTER_WHISPER_COMPUTE_TYPE=int8
FASTER_WHISPER_LANGUAGE=zh
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL="Video Digest <digest@example.com>"
RESEND_WEBHOOK_SECRET=whsec_xxx
WEB_APP_URL=http://localhost:3000
```

本地访问 YouTube 如需代理，只在 worker 环境配置：

```txt
LOCAL_PROXY_URL=http://127.0.0.1:10808
```

生产环境不配置 `LOCAL_PROXY_URL` 时会直连。

## 常用命令

```bash
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm check-types
pnpm format
pnpm check:local
```

按 workspace 运行：

```bash
pnpm --filter web dev
pnpm --filter worker test
pnpm --filter @video-digest-nextjs/video-digest-core build
pnpm --filter @video-digest-nextjs/mcp-server build
```

MCP Server 发包相关命令：

```bash
pnpm mcp:build
pnpm mcp:check
pnpm mcp:pack
pnpm mcp:publish
pnpm mcp:version:patch
```

- `pnpm mcp:build`：通过 Turborepo 只构建 `@video-digest-nextjs/mcp-server`。
- `pnpm mcp:check`：通过 Turborepo 对 MCP Server 依次运行类型检查、lint 和构建，建议发布前先跑。
- `pnpm mcp:pack`：预览 npm tarball 内容，不会真正发布。
- `pnpm mcp:publish`：发布 `packages/mcp-server` 到 npm，并使用 public access。
- `pnpm mcp:version:patch`：只提升 MCP Server 包的 patch 版本，不自动创建 Git tag。

如果 npm 发布需要 2FA 验证码，可以这样传入：

```bash
pnpm mcp:publish -- --otp 123456
```

如果当前版本从未成功发布过，不需要先执行 `pnpm mcp:version:patch`，可以直接重新发布当前版本。

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
- [packages/mcp-server](packages/mcp-server/README.md)
- [packages/queue](packages/queue/README.md)
- [packages/eslint-config](packages/eslint-config/README.md)
- [packages/typescript-config](packages/typescript-config/README.md)
- [packages/tsup-config](packages/tsup-config/README.md)

## 开发原则

- 写操作优先通过 MCP tool 或 core service 收敛。
- 页面读取可以直接走 repository/API，但不能绕开用户归属校验。
- 长任务不在 Next.js request 生命周期内同步执行。
- Core service 不依赖框架、协议、队列或具体数据库客户端。
- Worker 使用 service role，Web 浏览器端永远不能暴露 service role key。
- 邮件投递只允许发送到当前用户已验证邮箱。
