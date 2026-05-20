# @repo/queue

队列边界包。用于封装队列名称、job 名称、payload 类型、入队接口和 BullMQ/Redis 适配。

## 职责

- 统一队列名称。
- 定义跨 Web 和 worker 共享的 job payload。
- 定义 enqueue interface，让 core service 不直接依赖 BullMQ。
- 提供 no-op 队列实现，方便未配置 Redis 的本地开发继续打通创建链路。
- 提供 BullMQ 队列实现，配置 Redis 后可以真实入队。
- 后续封装 BullMQ worker 工厂。

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
  EnqueuedVideoDigestJob
  VideoDigestQueue
  createNoopVideoDigestQueue()
  createBullMqVideoDigestQueue()
```

`createNoopVideoDigestQueue()` 只返回标准 enqueue 结果，不会真正写入 Redis。`createBullMqVideoDigestQueue()` 使用 BullMQ `Queue.add()` 写入 Redis，并设置：

- `jobId = recordId`，避免同一记录重复投递多个 job。
- `attempts = 3`，失败后最多重试 3 次。
- `backoff = exponential`，重试间隔按指数退避。
- `removeOnComplete` / `removeOnFail`，限制 Redis 中历史 job 保留量。

## 常用命令

```bash
pnpm --filter @repo/queue lint
pnpm --filter @repo/queue check-types
pnpm --filter @repo/queue build
```

## 后续计划

1. 增加 `createVideoDigestWorker()`。
2. 增加 worker 侧任务状态流转。
3. 增加失败重试和死信处理策略。
