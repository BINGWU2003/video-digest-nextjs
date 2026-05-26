# @video-digest-nextjs/job-contracts

跨层契约包。这里放输入输出 schema、actor、job payload 和跨包共享类型。

## 职责

- 使用 Zod 定义可运行时校验的输入输出契约。
- 为 MCP tools、core service、queue 和 worker 提供一致类型。
- 保存不依赖具体实现的枚举和 payload 结构。

## 边界

- 不依赖数据库、core、MCP 或 worker。
- 不做业务编排。
- 不访问环境变量和外部服务。

## 当前内容

```txt
src/video-digest.ts
  actorSchema
  createVideoDigestJobInputSchema
  createVideoDigestJobOutputSchema
```

## 常用命令

```bash
pnpm --filter @video-digest-nextjs/job-contracts lint
pnpm --filter @video-digest-nextjs/job-contracts check-types
pnpm --filter @video-digest-nextjs/job-contracts build
```

## 使用示例

```ts
import { createVideoDigestJobInputSchema } from "@video-digest-nextjs/job-contracts";

const input = createVideoDigestJobInputSchema.parse(payload);
```
