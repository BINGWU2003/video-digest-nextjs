# Video Digest Worker

常驻后台 worker 应用。MVP 阶段先保留启动模板，后续接入 Redis/BullMQ 后消费视频摘要任务。

## 职责

- 监听 `video-digest` 队列。
- 消费由 Web 或 MCP tool 创建的任务。
- 调用核心业务服务完成字幕提取、音频转写、摘要生成和邮件投递。
- 将任务状态、字幕、摘要、投递记录和失败原因写回 Postgres。

## 边界

- 不暴露对外 HTTP API。
- 不处理网页登录或 MCP 鉴权。
- 不直接定义业务契约，跨层类型从 `@repo/job-contracts` 和 `@repo/queue` 获取。

## 当前状态

当前只实现 worker 模板入口：

```txt
src/index.ts
  -> startWorker()
  -> 输出待监听队列名称和 job 名称
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

1. 引入 BullMQ worker 工厂。
2. 接入 `@repo/queue` 的 job payload。
3. 调用 `@repo/video-digest-core` 处理任务。
4. 接入 Supabase/Postgres repository 实现。
