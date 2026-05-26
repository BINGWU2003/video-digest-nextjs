# @video-digest-nextjs/queue

队列边界包，封装队列名称、job 名称、payload 类型、入队接口、no-op queue 和 BullMQ/Redis 适配。

## 职责

- 统一 `video-digest` 队列名称。
- 定义 `process-video-digest` job 名称和 payload。
- 让 core service 通过 interface 入队，不直接依赖 BullMQ。
- 提供 no-op queue，方便未配置 Redis 的本地开发。
- 提供 BullMQ producer 和 worker helper。

## 边界

- 不处理具体视频业务。
- 不访问数据库。
- 不做 MCP 鉴权。
- 不把 BullMQ 类型泄漏到 core service。

## 当前内容

```txt
src/index.ts
  videoDigestQueueName
  videoDigestJobName
  VideoDigestQueuePayload
  VideoDigestQueue
  createNoopVideoDigestQueue()
  createBullMqVideoDigestQueue()
  createBullMqVideoDigestWorker()
```

## 行为说明

`createNoopVideoDigestQueue()` 只返回标准 enqueue 结果，不写入 Redis。

`createBullMqVideoDigestQueue()` 使用 BullMQ `Queue.add()` 写入 Redis：

- 默认 `jobId = recordId`
- 重试时可传自定义 `queueJobId`
- `attempts = 1`
- 设置 `removeOnComplete` 和 `removeOnFail` 控制 Redis 历史 job 保留量

`createBullMqVideoDigestWorker()` 使用 BullMQ `Worker` 消费 `process-video-digest` job，并把 `queueJobId` 和 `attemptsMade` 传给 worker 业务处理函数。

BullMQ 建议 Redis 版本至少为 6.2.0。

## 构建

包使用 tsup 构建，配置来自 `@video-digest-nextjs/tsup-config`。

```bash
pnpm --filter @video-digest-nextjs/queue build
```

## 常用命令

```bash
pnpm --filter @video-digest-nextjs/queue lint
pnpm --filter @video-digest-nextjs/queue check-types
pnpm --filter @video-digest-nextjs/queue build
```
