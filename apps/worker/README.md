# Video Digest Worker

常驻后台 worker 应用。当前已接入 BullMQ worker 消费入口，先消费视频摘要任务、更新任务状态并写入任务事件，后续再接真实视频处理。

## 职责

- 监听 `video-digest` 队列。
- 消费由 Web 或 MCP tool 创建的任务。
- 调用核心业务服务完成字幕提取、音频转写、摘要生成和邮件投递。
- 将任务状态、字幕、摘要、投递记录和失败原因写回 Postgres。

## 边界

- 不暴露对外 HTTP API。
- 不处理网页登录或 MCP 鉴权。
- 不直接定义业务契约，跨层类型从 `@repo/job-contracts` 和 `@repo/queue` 获取。

## 环境变量

本地运行前需要配置：

```txt
REDIS_URL=redis://localhost:6379
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
```

开发模式会自动读取 `apps/worker/.env.local`。也可以直接通过系统环境变量注入同名配置。

`SUPABASE_SERVICE_ROLE_KEY` 只允许在后台 worker 使用，不能暴露给浏览器。

BullMQ 建议 Redis 版本至少为 6.2.0。Redis 5.x 可用于早期本地验证，但会输出版本提醒。

Node.js 20 没有原生 WebSocket，worker 通过 `ws` 包为 Supabase client 提供 Realtime transport。当前 worker 只使用数据库写入能力，不主动订阅 Realtime。

## 当前状态

当前 worker 会消费 `video-digest` 队列里的 `process-video-digest` job：

```txt
src/index.ts
  -> startWorker()
  -> createBullMqVideoDigestWorker()
  -> 更新 video_records.status = fetching_metadata
  -> 写入 job_events(fetching_metadata)
  -> fetchVideoMetadata()
  -> persistVideoMetadata()
  -> 更新 video_records.status = extracting_transcript
  -> 写入 job_events(extracting_transcript)
  -> fetchTranscript()
  -> persistTranscript()
  -> 失败时更新 video_records.status = failed
  -> 失败时写入 job_events(failed)
```

当前 YouTube provider 使用 oEmbed 读取标题、作者和封面；Bilibili provider 仍是占位实现，因此 Bilibili 任务会在 `fetchVideoMetadata()` 阶段触发失败链路。这用于验证失败状态和失败事件可以完整落库。

当前 YouTube/Bilibili 字幕 provider 仍是占位实现，因此元数据写回成功的任务会推进到 `extracting_transcript`，随后在 `fetchTranscript()` 阶段触发失败链路。后续接入真实字幕 provider 后，`persistTranscript()` 会写入 `transcripts` 和 `transcript_segments`。

## 常用命令

```bash
pnpm --filter worker dev
pnpm --filter worker lint
pnpm --filter worker check-types
pnpm --filter worker build
pnpm --filter worker start
```

## 后续计划

1. 接入真实 YouTube 字幕 provider。
2. 接入 Bilibili 元数据 provider。
3. 接入摘要生成和邮件投递。
4. 增加更细的失败码和恢复策略。
