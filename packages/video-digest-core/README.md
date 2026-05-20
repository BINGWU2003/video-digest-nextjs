# @repo/video-digest-core

视频摘要核心业务包。这里放真实业务编排，但不绑定 Next.js、MCP 协议、BullMQ 或具体数据库客户端。

## 职责

- 创建和更新视频处理记录。
- 后续编排字幕提取、音频转写、摘要生成和投递。
- 校验业务输入和 actor 归属。
- 通过 repository interface 读写数据。

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
```

## 调用方向

```txt
mcp-tools / server action / worker
  -> @repo/video-digest-core
  -> @repo/database repository interface
```

## 常用命令

```bash
pnpm --filter @repo/video-digest-core lint
pnpm --filter @repo/video-digest-core check-types
pnpm --filter @repo/video-digest-core build
```

## 后续计划

1. 增加 transcript 模块。
2. 增加 summary 模块。
3. 增加 delivery 模块。
4. 接入 queue enqueue 边界。
