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
  核心业务。放视频任务创建、状态流转、视频元数据、字幕、摘要、投递等业务服务。

packages/mcp-tools
  MCP tool 适配层。只负责 tool 名称、参数 schema、权限声明和调用 core service。

packages/queue
  队列边界。封装 queue name、job name、payload、enqueue interface 和 BullMQ/Redis producer adapter。

apps/worker
  常驻 worker 应用。消费 BullMQ 队列，当前先更新任务状态并写入任务事件，后续调用 core service 处理视频。

apps/web
  Next.js Web 应用。Dashboard 通过 server action 创建真实任务，记录列表和详情页读取 Supabase 数据。
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
  src/repositories/transcripts.ts
    TranscriptsRepository
    CreateTranscriptInput
    findLatestForRecord()
  src/supabase/*-repository.ts
    Supabase repository 实现

packages/video-digest-core
  src/modules/video-records/create-video-record.ts
    createVideoRecord()
    创建 video_records
    创建 job_events queued 事件
    创建 usage_events job_created 事件
    调用 VideoDigestQueue 投递后台处理 payload
  src/modules/video-metadata/
    VideoMetadataProvider
    fetchVideoMetadata()
    persistVideoMetadata()
    createVideoMetadataProviderRegistry()
    YouTube oEmbed provider
    Bilibili provider 占位实现
  src/modules/transcripts/
    TranscriptProvider
    fetchTranscript()
    persistTranscript()
    createTranscriptProviderRegistry()
    YouTube/Bilibili provider 占位实现

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
    更新 video_records fetching_metadata 状态
    写入 job_events fetching_metadata 事件
    调用 fetchVideoMetadata()
    调用 persistVideoMetadata()
    更新 video_records extracting_transcript 状态
    写入 job_events extracting_transcript 事件
    调用 fetchTranscript()
    调用 persistTranscript()
    字幕输出模式更新 video_records completed 状态
    摘要输出模式更新 video_records summarizing 状态
    失败时更新 video_records failed 状态
    失败时写入 job_events failed 事件

apps/web
  app/dashboard/actions.ts
    createVideoDigestJobAction()
    调用 createVideoRecord()
    成功后跳转记录详情页
  app/api/records/route.ts
    GET 读取当前用户记录列表
    POST 创建当前用户视频任务
  app/records/page.tsx
    读取真实 video_records 列表
  app/records/[id]/page.tsx
    读取真实 video_records 详情和最新字幕分段

packages/mcp-tools
  src/tools/create-video-digest-job.ts
    createVideoDigestJobTool
```

这个模板已经通过 repository interface 接入 Supabase 实现，并通过 queue interface 固定了投递边界。当前 Web 会根据 `REDIS_URL` 自动选择 BullMQ producer 或 no-op 队列；Dashboard 能创建真实任务，记录列表和详情页能读取真实记录与字幕分段。worker 会消费 BullMQ job，将记录状态推进到 `fetching_metadata`，调用视频元数据模块，元数据写回成功后推进到 `extracting_transcript`，再调用字幕模块，并在失败时写入 `failed` 状态和失败事件。YouTube 元数据 provider 已通过 oEmbed 接入标题、作者和封面读取，元数据写回边界已接入 `video_records`；Bilibili 元数据 provider 仍为占位实现。字幕模块已接入 worker，YouTube 字幕 provider 已支持读取公开字幕轨道并通过 `persistTranscript()` 写入 `transcripts` 和 `transcript_segments`；Bilibili 字幕 provider 仍为占位实现。worker 失败时会按错误类型写入细分错误码，便于前端展示和后续重试策略。

## Worker 失败码

| 错误码 | 写入场景 |
| --- | --- |
| `metadata_fetch_failed` | 元数据 provider 已接入，但平台元数据请求、解析或校验失败 |
| `provider_unavailable` | 目标平台的元数据或字幕 provider 尚未接入 |
| `transcript_fetch_failed` | 字幕 provider 已接入，但字幕页面、字幕轨道请求或解析失败 |
| `transcript_not_found` | 字幕 provider 已接入，但目标视频没有可用公开字幕 |
| `worker_processing_failed` | 数据库写入、状态推进或其他未分类的 worker 错误 |

这些错误码会同时写入 `video_records.error_code` 和 `job_events.metadata.errorCode`，错误类名会写入 `job_events.metadata.errorName`。

## 调用方向

```txt
MCP Tool
  -> video-digest-core
  -> database repository interface
  -> Supabase repository
  -> queue interface
  -> BullMQ worker

Web Dashboard
  -> server action / POST /api/records
  -> video-digest-core
  -> database repository interface
  -> queue interface
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
4. 是否需要在下一步接入 Bilibili 元数据、增加失败恢复策略或增加数据库事务封装。
