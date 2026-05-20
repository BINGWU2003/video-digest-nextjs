# @repo/queue

队列边界包。后续用于封装 BullMQ 队列名称、payload 类型、入队函数和 worker 工厂。

## 职责

- 统一队列名称。
- 定义跨 Web 和 worker 共享的 job payload。
- 后续封装 Redis/BullMQ 连接。
- 后续提供 enqueue 和 createWorker helper。

## 边界

- 不处理具体视频业务。
- 不访问数据库。
- 不做 MCP 鉴权。
- 不把 BullMQ 类型泄漏到 core service。

## 当前内容

```txt
src/index.ts
  videoDigestQueueName
  VideoDigestQueuePayload
```

## 常用命令

```bash
pnpm --filter @repo/queue lint
pnpm --filter @repo/queue check-types
pnpm --filter @repo/queue build
```

## 后续计划

1. 增加 Redis connection factory。
2. 增加 `enqueueVideoDigestJob()`。
3. 增加 `createVideoDigestWorker()`。
