# Worker 应用

`apps/worker` 是常驻后台进程，负责消费 BullMQ 中的 `video-digest` 队列任务，并把视频处理结果写回 Supabase。

## 职责

- 监听 `video-digest` 队列中的 `process-video-digest` job。
- 使用 yt-dlp 读取 YouTube/Bilibili 元数据、字幕和 Bilibili audio-only 文件。
- 在 Bilibili 音频 fallback 开启时调用 OpenAI-compatible Audio Transcriptions API 生成 ASR 字幕。
- 调用 OpenAI-compatible API 生成结构化摘要。
- 调用 Resend 投递摘要邮件。
- 写回 `video_records`、`job_events`、`usage_events`、`transcripts`、`summaries` 和 `delivery_records`。

## 边界

- 不暴露 HTTP API。
- 不处理网页登录、MCP Token 校验或 Resend Webhook。
- 不直接定义跨层契约，类型来自 packages。
- 使用 `SUPABASE_SERVICE_ROLE_KEY`，只允许在后台环境运行。

## 环境变量

复制示例：

```bash
cp apps/worker/env.local.example apps/worker/.env.local
```

常用配置：

```txt
REDIS_URL=redis://localhost:6379
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
YTDLP_PATH=yt-dlp
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_API_KEY=sk_xxx
OPENAI_SUMMARY_MODEL=deepseek-v4-flash
OPENAI_SUMMARY_MAX_TOKENS=4000
OPENAI_ASR_BASE_URL=https://api.openai.com/v1
OPENAI_ASR_API_KEY=sk_xxx
OPENAI_ASR_MODEL=whisper-1
OPENAI_ASR_LANGUAGE=zh
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL="Video Digest <digest@example.com>"
WEB_APP_URL=http://localhost:3000
```

本地访问 YouTube 如需代理：

```txt
LOCAL_PROXY_URL=http://127.0.0.1:10808
```

生产环境不配置 `LOCAL_PROXY_URL` 时会直连。

`YTDLP_PATH` 默认可写 `yt-dlp`；Docker/Railway 这类环境可写绝对路径，例如 `/usr/local/bin/yt-dlp`。

Bilibili 勾选“无字幕时转写音频”后会直接走音频转写：worker 先用 yt-dlp 下载 `bestaudio`，再调用 `OPENAI_ASR_BASE_URL` 下的 `/audio/transcriptions`。`OPENAI_ASR_API_KEY` 未配置时会复用 `OPENAI_API_KEY`。

## 处理流程

```txt
startWorker()
  -> createBullMqVideoDigestWorker()
  -> fetching_metadata
  -> fetchVideoMetadata()
  -> persistVideoMetadata()
  -> extracting_transcript
  -> fetchTranscript()
  -> persistTranscript()
  -> transcript 模式 completed
  -> summary / summary_and_email 模式 summarizing
  -> generateSummary()
  -> persistSummary()
  -> delivering
  -> 查询默认已验证邮箱
  -> 创建 delivery_records(queued)
  -> Resend sendEmail()
  -> delivery_records(sent)
  -> video_records(completed)
```

`delivery_records.status = sent` 只表示 Resend API 已接收邮件。真实状态由 Web 的 `/api/webhooks/resend` 回写，例如 `delivered`、`delivery_delayed`、`bounced`、`complained`。

## 错误码

| 错误码                      | 含义                       |
| --------------------------- | -------------------------- |
| `email_delivery_failed`     | Resend 邮件投递失败        |
| `email_recipient_not_found` | 未找到默认已验证收件邮箱   |
| `metadata_fetch_failed`     | 视频元数据读取失败         |
| `provider_unavailable`      | 当前平台 provider 尚未接入 |
| `summary_generation_failed` | 摘要生成失败               |
| `transcript_fetch_failed`   | 字幕读取或音频转写失败     |
| `transcript_not_found`      | 视频没有可用字幕或转写文本 |
| `worker_processing_failed`  | 其他未分类 worker 错误     |

## 当前限制

- YouTube provider 已接 yt-dlp。
- Bilibili provider 已接 yt-dlp 元数据、字幕和音频转写 fallback。
- 长视频音频可能受 ASR 服务文件大小和超时限制，需要后续增加分片转写。

## 常用命令

```bash
pnpm check:local
pnpm --filter worker dev
pnpm --filter worker build
pnpm --filter worker start
pnpm --filter worker lint
pnpm --filter worker check-types
pnpm --filter worker test
```
