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

src/repositories/video-records.ts
  VideoRecordsRepository 模板。
```

## 常用命令

```bash
pnpm --filter @repo/database lint
pnpm --filter @repo/database check-types
pnpm --filter @repo/database build
```

## 相关文档

- `docs/video-digest-database-schema.md`
- `docs/video-digest-backend-modules.md`
