# @repo/database

数据库边界包。这里放数据库表类型、repository interface，以及后续 Supabase/Postgres 的具体实现。

## 职责

- 描述业务表的 TypeScript 类型。
- 定义 repository interface，供 core service 调用。
- 隔离具体数据库客户端和查询实现。
- 后续承载 Supabase service-role client、RLS 相关 helper 和 SQL 结果映射。

## 边界

- 不依赖 `@repo/video-digest-core`。
- 不写 MCP tool 或 worker 逻辑。
- 不做复杂业务编排，只负责数据访问边界。

## 当前内容

```txt
src/schema.ts
  共享枚举和表字段类型。

src/tables.ts
  10 张业务表的 Row 类型和中文字段注释。

src/repositories/video-records.ts
  VideoRecordsRepository 模板。

src/repositories/job-events.ts
  JobEventsRepository，用于记录任务生命周期事件。

src/repositories/usage-events.ts
  UsageEventsRepository，用于记录任务创建、转写、邮件等用量事件。

src/supabase/video-records-repository.ts
  Supabase 版 video_records repository，实现 create、findByIdForUser、listForUser、updateStatusForUser。

src/supabase/job-events-repository.ts
  Supabase 版 job_events repository，实现 create。

src/supabase/usage-events-repository.ts
  Supabase 版 usage_events repository，实现 create。
```

## Migration

当前数据库入口：

```txt
supabase/migrations/20260520213500_initial_video_digest_schema.sql
```

该 migration 包含：

- 10 张业务表。
- check 约束和索引。
- Row Level Security。
- 中文 table/column comment。
- `updated_at` 自动更新时间 trigger。

`mcp_tokens` 含 `token_hash`，暂不开放普通用户直连读取策略。后续设置页应通过服务端接口或安全视图读取 token 列表。

## 常用命令

```bash
pnpm --filter @repo/database lint
pnpm --filter @repo/database check-types
pnpm --filter @repo/database build
```

## 相关文档

- `docs/video-digest-database-schema.md`
- `docs/video-digest-backend-modules.md`
