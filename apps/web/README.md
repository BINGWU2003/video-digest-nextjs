# 视频摘要 Web

这是视频摘要产品的 Next.js Web 应用。

## 职责

- 提供登录、Dashboard、Records、Record Detail 和设置页。
- 承载后续 `/api/mcp` MCP endpoint。
- 网站内部写操作会通过 MCP tool 或服务端 action 进入后端能力层。
- 页面读取用户记录、摘要、字幕、邮箱和用量数据。

## 边界

- 不在请求生命周期内执行视频下载、音频提取、ASR 或长时间摘要任务。
- 不直接绕过业务层写核心任务状态。
- 长任务只创建记录和入队，实际处理交给 `apps/worker`。

## 本地启动

在仓库根目录运行：

```bash
pnpm --filter web dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## Supabase 登录配置

复制环境变量示例：

```bash
cp apps/web/env.local.example apps/web/.env.local
```

然后填入 Supabase 项目配置：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

如果你的 Supabase 项目仍使用旧版 anon key，也可以填：

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

登录相关页面和路由：

- `/login`：邮箱密码登录/注册
- `/auth/callback`：邮箱确认和 PKCE 回调
- `/dashboard`、`/records`、`/settings/*`：需要登录后访问

Supabase 控制台里建议把本地回调地址加入允许列表：

```txt
http://localhost:3000/auth/callback
```

## 常用命令

```bash
pnpm --filter web dev
pnpm --filter web lint
pnpm --filter web check-types
pnpm --filter web build
```

## 相关文档

- `docs/video-digest-web-product.md`
- `docs/video-digest-mcp-architecture.md`
- `docs/video-digest-database-schema.md`
