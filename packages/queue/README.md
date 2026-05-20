# @repo/queue

队列边界包。用于封装队列名称、job 名称、payload 类型、入队接口和后续 BullMQ/Redis 适配。

## 职责

- 统一队列名称。
- 定义跨 Web 和 worker 共享的 job payload。
- 定义 enqueue interface，让 core service 不直接依赖 BullMQ。
- 提供 no-op 队列实现，方便在真实队列接入前打通创建链路。
- 后续封装 Redis/BullMQ 连接和 worker 工厂。

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
```

当前 `createNoopVideoDigestQueue()` 只返回标准 enqueue 结果，不会真正写入 Redis。它用于先固定调用边界，后续替换为 BullMQ 实现时保持上层 API 不变。

## 常用命令

```bash
pnpm --filter @repo/queue lint
pnpm --filter @repo/queue check-types
pnpm --filter @repo/queue build
```

## 后续计划

1. 增加 Redis connection factory。
2. 增加 BullMQ 版 `VideoDigestQueue`。
3. 增加 `createVideoDigestWorker()`。
