# @video-digest-nextjs/database

数据库边界包，负责业务表类型、repository interface 和 Supabase repository 实现。

## 职责

- 描述 Supabase/Postgres 表的 TypeScript Row 类型。
- 定义 core、worker、Web 和 MCP tools 共用的 repository interface。
- 封装 Supabase 查询、错误映射和用户归属校验。
- 隔离具体数据库客户端，避免 core service 直接依赖 Supabase。

## 边界

- 不依赖 `@video-digest-nextjs/video-digest-core`。
- 不写 MCP tool、worker 流程或 UI 逻辑。
- 不做复杂业务编排，只负责数据访问。

## 当前内容

```txt
src/schema.ts
  共享枚举和字段类型。

src/tables.ts
  业务表 Row 类型。

src/repositories/
  repository interface，覆盖视频记录、任务事件、用量事件、字幕、摘要、
  邮箱、投递记录、MCP Token 和 MCP Token 调用事件。

src/supabase/
  Supabase repository 实现和 DatabaseQueryError。
```

## 主要 repository

- `VideoRecordsRepository`
- `JobEventsRepository`
- `UsageEventsRepository`
- `TranscriptsRepository`
- `SummariesRepository`
- `EmailAddressesRepository`
- `DeliveryRecordsRepository`
- `McpTokensRepository`
- `McpTokenEventsRepository`

## 数据库迁移

当前 migrations：

```txt
supabase/migrations/20260520213500_initial_video_digest_schema.sql
supabase/migrations/20260524073000_resend_delivery_webhook.sql
supabase/migrations/20260526093000_mcp_token_events.sql
```

它们包含业务表、索引、约束、RLS、Resend Webhook 字段和 MCP Token 调用审计字段。

## 构建

包使用 tsup 构建，配置来自 `@video-digest-nextjs/tsup-config`，本包保留 `tsup` devDependency 以提供本包脚本可执行文件。

```bash
pnpm --filter @video-digest-nextjs/database build
```

## 常用命令

```bash
pnpm --filter @video-digest-nextjs/database lint
pnpm --filter @video-digest-nextjs/database check-types
pnpm --filter @video-digest-nextjs/database build
```

## 相关文档

- `docs/video-digest-database-schema.md`
- `docs/video-digest-backend-modules.md`
