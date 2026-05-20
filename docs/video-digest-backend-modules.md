# Video Digest Backend Modules

## 目标

本文档记录第一版后端项目骨架。当前阶段只划分模块边界，并实现一个 `video-records` 模板模块，等模板验收后再继续扩展 MCP endpoint、队列和 worker 业务。

## 模块划分

```txt
packages/job-contracts
  共享输入输出契约。放 zod schema、job payload、actor、枚举等跨层类型。

packages/database
  数据库边界。放表类型、repository interface、后续 Supabase/Postgres 实现。

packages/video-digest-core
  核心业务。放视频任务创建、状态流转、字幕、摘要、投递等业务服务。

packages/mcp-tools
  MCP tool 适配层。只负责 tool 名称、参数 schema、权限声明和调用 core service。

packages/queue
  队列边界。后续封装 BullMQ queue name、payload 和 enqueue/worker 工厂。

apps/worker
  常驻 worker 应用。后续消费队列并调用 core service 更新数据库。
```

## 当前模板

本次只实现 `video-records` 模板：

```txt
packages/job-contracts
  src/video-digest.ts
    createVideoDigestJobInputSchema
    actorSchema

packages/database
  src/repositories/video-records.ts
    VideoRecordsRepository
    CreateVideoRecordInput
    VideoRecordRow

packages/video-digest-core
  src/modules/video-records/create-video-record.ts
    createVideoRecord()

packages/mcp-tools
  src/tools/create-video-digest-job.ts
    createVideoDigestJobTool
```

这个模板暂时不做真实数据库写入，只通过 repository interface 把数据库实现隔离出去。下一步接 Supabase 时，只需要在 `packages/database` 增加具体 repository 实现，不需要改 core service 的业务入口。

## 调用方向

```txt
MCP Tool
  -> video-digest-core
  -> database repository interface
```

禁止反向依赖：

- `packages/database` 不依赖 core。
- `packages/job-contracts` 不依赖任何业务包。
- `packages/video-digest-core` 不依赖 Next.js、MCP server 或 BullMQ。
- `packages/mcp-tools` 不直接写数据库。

## 验收点

当前阶段验收这几件事：

1. 模块边界是否符合文档预期。
2. `video-records` 模板是否足够清楚，可复制到 transcript、summary、delivery。
3. 是否继续沿用 repository interface 方式接 Supabase。
4. 是否需要调整包名或目录层级。
