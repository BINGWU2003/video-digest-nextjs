# @repo/video-digest-core

视频摘要核心业务包。这里放真实业务编排，但不绑定 Next.js、MCP 协议、BullMQ 或具体数据库客户端。

## 职责

- 创建和更新视频处理记录。
- 后续编排字幕提取、音频转写、摘要生成和投递。
- 校验业务输入和 actor 归属。
- 通过 repository interface 读写数据。
- 通过队列 interface 投递后台处理任务。

## 边界

- 不直接访问 Supabase client。
- 不直接注册 MCP tools。
- 不启动 worker。
- 不依赖 Next.js request、cookies 或 route handler。

## 当前内容

```txt
src/modules/video-records/create-video-record.ts
  createVideoRecord()
  平台识别
  URL 归一化
  actor 到 created_by_type 的映射
  创建 video_records 后追加 queued 任务事件和 job_created 用量事件
  调用 VideoDigestQueue 投递后台处理 payload

src/modules/video-metadata/
  VideoMetadata
  VideoMetadataProvider
  fetchVideoMetadata()
  persistVideoMetadata()
  createVideoMetadataProviderRegistry()
  createYoutubeVideoMetadataProvider()
  createBilibiliVideoMetadataProvider()

src/modules/transcripts/
  TranscriptResult
  TranscriptProvider
  fetchTranscript()
  persistTranscript()
  createTranscriptProviderRegistry()
  createYoutubeTranscriptProvider()
  createBilibiliTranscriptProvider()
```

当前 YouTube provider 使用 YouTube oEmbed 读取标题、作者和封面，不需要 API key；oEmbed 不返回视频时长，所以 `durationSeconds` 暂时写入 null。Bilibili provider 仍是占位实现，会抛出 `VideoMetadataProviderUnavailableError`。`persistVideoMetadata()` 已经能把 provider 返回的标题、作者、时长和封面写回 `video_records`。

当前 YouTube 字幕 provider 会从视频页面读取公开字幕轨道，再用字幕轨道地址拉取 `json3` 分段字幕，不需要 API key。`persistTranscript()` 已经能创建 `transcripts` 主记录和 `transcript_segments` 分段记录。Bilibili 字幕 provider 仍是占位实现，会抛出 `TranscriptProviderUnavailableError`。

## 调用方向

```txt
mcp-tools / server action / worker
  -> @repo/video-digest-core
  -> @repo/database repository interface
  -> @repo/queue queue interface
```

## 常用命令

```bash
pnpm --filter @repo/video-digest-core lint
pnpm --filter @repo/video-digest-core check-types
pnpm --filter @repo/video-digest-core build
```

## 后续计划

1. 接入 Bilibili 元数据 provider。
2. 增加 summary 模块。
