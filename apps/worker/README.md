# Video Digest Worker

常驻后台 worker 应用。当前已接入 BullMQ worker 消费入口，先消费视频摘要任务并写入任务事件，后续再接真实视频处理。

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

## 当前状态

当前 worker 会消费 `video-digest` 队列里的 `process-video-digest` job：

```txt
src/index.ts
  -> startWorker()
  -> createBullMqVideoDigestWorker()
  -> 写入 job_events(fetching_metadata)
```

## 常用命令

```bash
pnpm --filter worker dev
pnpm --filter worker lint
pnpm --filter worker check-types
pnpm --filter worker build
pnpm --filter worker start
```

## 后续计划

1. 更新 video_records.status 状态流转。
2. 调用 `@repo/video-digest-core` 处理任务。
3. 接入视频 provider、字幕提取、摘要生成和邮件投递。
4. 增加失败重试和恢复策略。
