# Web 应用

`apps/web` 是 Video Digest 的 Next.js App Router 应用，负责用户界面、登录态、站内 API、MCP gateway、邮箱设置、MCP Token 设置、Resend Webhook 和用量展示。

## 职责

- 提供登录、工作台、记录列表、记录详情、邮箱设置、MCP Token 和用量页面。
- 通过 server action 或 API 创建视频摘要任务。
- 暴露 `/api/mcp`，让网站 MCP Token 可以调用 tool。
- 暴露 `/api/webhooks/resend`，接收 Resend 邮件事件并回写投递状态。
- 页面读取用户记录、字幕、摘要、邮箱、投递和用量数据。

## 边界

- 不在请求生命周期内执行 yt-dlp、摘要生成或邮件重试这类长任务。
- 不把 `SUPABASE_SERVICE_ROLE_KEY` 暴露到浏览器。
- 不直接处理后台任务流水；创建记录后交给 `apps/worker`。

## 本地启动

```bash
pnpm --filter web dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 环境变量

复制示例：

```bash
cp apps/web/env.local.example apps/web/.env.local
```

常用配置：

```txt
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
REDIS_URL=redis://localhost:6379
RESEND_WEBHOOK_SECRET=whsec_xxx
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL="Video Digest <digest@example.com>"
WEB_APP_URL=http://localhost:3000
```

`REDIS_URL` 未配置时，Web 会使用 no-op queue：创建链路仍能跑通，但不会写入 Redis。

`OPENAI_API_KEY` 不放在 Web 环境变量里；摘要生成由 worker 执行。

## 路由

- `/login`：邮箱密码登录/注册
- `/auth/callback`：邮箱确认和 PKCE 回调
- `/dashboard`：创建视频摘要任务
- `/records`：记录列表，支持分页和筛选
- `/records/[id]`：记录详情、字幕、摘要、投递状态、重试和取消操作
- `/settings/emails`：邮箱管理和默认邮箱设置
- `/settings/mcp-tokens`：MCP Token 创建、吊销和 scope 设置
- `/settings/usage`：用量事件查看
- `/api/records`：记录创建和列表查询
- `/api/records/[id]`：记录详情查询
- `/api/mcp`：MCP tool HTTP gateway
- `/api/webhooks/resend`：Resend Webhook

Supabase 控制台建议加入本地回调地址：

```txt
http://localhost:3000/auth/callback
```

## API 示例

创建任务：

```txt
POST /api/records
```

```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "platform": "auto",
  "outputMode": "summary",
  "fallbackToAudio": false,
  "sendEmail": false
}
```

查询记录列表：

```txt
GET /api/records?status=queued&platform=youtube&limit=20&offset=0
```

调用 MCP gateway：

```json
{
  "tool": "create_video_digest_job",
  "input": {
    "url": "https://www.youtube.com/watch?v=...",
    "platform": "auto",
    "outputMode": "summary_and_email",
    "fallbackToAudio": false,
    "sendEmail": true
  }
}
```

## Resend Webhook

Resend endpoint 填：

```txt
https://your-domain.com/api/webhooks/resend
```

本地调试可以用 ngrok 或 Cloudflare Tunnel 暴露 `localhost:3000`。Webhook 签名密钥配置到 `RESEND_WEBHOOK_SECRET`。

## 常用命令

```bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web lint
pnpm --filter web check-types
```

## 相关文档

- `docs/video-digest-web-product.md`
- `docs/video-digest-mcp-architecture.md`
- `docs/video-digest-database-schema.md`
