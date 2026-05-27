# @video-digest-nextjs/video-digest-core

视频摘要核心业务包。这里放业务编排和 provider 适配，但不绑定 Next.js、MCP 协议、BullMQ 或具体数据库客户端。

## 职责

- 创建、取消、重试视频摘要任务。
- 读取和持久化视频元数据。
- 读取和持久化字幕。
- 调用摘要 provider 生成结构化摘要。
- 生成摘要邮件内容。
- 通过 repository 和 queue interface 与外部基础设施交互。

## 边界

- 不直接访问 Supabase client。
- 不注册 MCP tools。
- 不启动 worker。
- 不读取 Next.js request、cookies 或 route handler。

## 当前模块

```txt
src/modules/video-records/
  createVideoRecord()
  cancelVideoDigestJob()
  retryVideoDigestJob()

src/modules/video-metadata/
  fetchVideoMetadata()
  persistVideoMetadata()
  createYoutubeVideoMetadataProvider()
  createBilibiliVideoMetadataProvider()

src/modules/transcripts/
  fetchTranscript()
  persistTranscript()
  createYoutubeTranscriptProvider()
  createBilibiliTranscriptProvider()

src/modules/summaries/
  generateSummary()
  persistSummary()
  createOpenAICompatibleSummaryProvider()

src/modules/email-delivery/
  EmailDeliveryProvider
  createSummaryEmailSubject()
  createSummaryEmailText()
  createSummaryEmailHtml()
```

## Provider 状态

- YouTube 元数据 provider 使用 `yt-dlp --dump-single-json --skip-download`。
- YouTube 字幕 provider 使用 `yt-dlp` 下载 `json3` 或 `vtt` 字幕并解析分段。
- Bilibili 元数据 provider 使用 `yt-dlp --dump-single-json --skip-download`。
- Bilibili 字幕 provider 使用 `yt-dlp` 下载公开字幕；`fallbackToAudio` 开启时改为下载 audio-only 文件并调用 OpenAI-compatible Audio Transcriptions API。
- 摘要 provider 使用 OpenAI-compatible Chat Completions API。
- 邮件投递 provider interface 由 worker 侧 Resend 实现注入。

## 调用方向

```txt
Web / MCP tools / worker
  -> @video-digest-nextjs/video-digest-core
  -> repository interface
  -> queue interface
```

## 构建和测试

包使用 tsup 构建，测试使用 Vitest。

```bash
pnpm --filter @video-digest-nextjs/video-digest-core build
pnpm --filter @video-digest-nextjs/video-digest-core test
```

## 常用命令

```bash
pnpm --filter @video-digest-nextjs/video-digest-core lint
pnpm --filter @video-digest-nextjs/video-digest-core check-types
pnpm --filter @video-digest-nextjs/video-digest-core build
pnpm --filter @video-digest-nextjs/video-digest-core test
```

## 当前限制

- 长视频音频转写尚未做分片，可能受 ASR 服务文件大小和超时限制。
- 长字幕分段摘要策略仍可继续增强。
