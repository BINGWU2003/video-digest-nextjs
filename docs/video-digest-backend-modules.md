# Video Digest Backend Modules

## 目标

本文档记录第一版后端项目骨架。当前阶段先划分模块边界，并围绕 `create_video_digest_job` 逐步补齐创建任务、任务事件、用量事件和队列投递边界。

## 模块划分

```txt
packages/job-contracts
  共享输入输出契约。放 zod schema、job payload、actor、枚举等跨层类型。

packages/database
  数据库边界。放表类型、repository interface、Supabase/Postgres 实现和 SQL 结果映射。

packages/video-digest-core
  核心业务。放视频任务创建、状态流转、字幕、摘要、投递等业务服务。

packages/mcp-tools
  MCP tool 适配层。只负责 tool 名称、参数 schema、权限声明和调用 core service。

packages/queue
  队列边界。封装 queue name、job name、payload、enqueue interface 和 BullMQ/Redis producer adapter。

apps/worker
  常驻 worker 应用。消费 BullMQ 队列，当前先写入任务事件，后续调用 core service 更新数据库。
```

## 当前模板

当前已实现 `video-records` 创建模板，并补充任务事件、用量事件写入和队列投递边界：

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
  src/repositories/job-events.ts
    JobEventsRepository
    CreateJobEventInput
    JobEventRow
  src/repositories/usage-events.ts
    UsageEventsRepository
    CreateUsageEventInput
    UsageEventRow
  src/supabase/*-repository.ts
    Supabase repository 实现

packages/video-digest-core
  src/modules/video-records/create-video-record.ts
    createVideoRecord()
    创建 video_records
    创建 job_events queued 事件
    创建 usage_events job_created 事件
    调用 VideoDigestQueue 投递后台处理 payload

packages/queue
  src/index.ts
    videoDigestQueueName
    videoDigestJobName
    VideoDigestQueuePayload
    VideoDigestQueue
    createNoopVideoDigestQueue()
    createBullMqVideoDigestQueue()
    createBullMqVideoDigestWorker()

apps/worker
  src/index.ts
    startWorker()
    消费 process-video-digest job
    写入 job_events fetching_metadata 事件

packages/mcp-tools
  src/tools/create-video-digest-job.ts
    createVideoDigestJobTool
```

这个模板已经通过 repository interface 接入 Supabase 实现，并通过 queue interface 固定了投递边界。当前 Web 会根据 `REDIS_URL` 自动选择 BullMQ producer 或 no-op 队列；worker 会消费 BullMQ job 并记录 `fetching_metadata` 事件。

## 调用方向

```txt
MCP Tool
  -> video-digest-core
  -> database repository interface
  -> Supabase repository
  -> queue interface
  -> BullMQ worker
```

禁止反向依赖：

- `packages/database` 不依赖 core。
- `packages/job-contracts` 不依赖任何业务包。
- `packages/video-digest-core` 不依赖 Next.js、MCP server 或 BullMQ。
- `packages/mcp-tools` 不直接写数据库。

## 验收点

当前阶段验收这几件事：

1. 模块边界是否符合文档预期。
2. `video-records`、`job-events`、`usage-events` 模板是否足够清楚，可复制到 transcript、summary、delivery。
3. 是否继续沿用 repository interface 方式扩展后续模块。
4. 是否需要在下一步引入 `video_records.status` 更新或数据库事务封装。
