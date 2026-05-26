# @video-digest-nextjs/job-contracts

跨层契约包，放运行时可校验的 Zod schema、actor、tool input/output 和共享类型。

## 职责

- 为 Web、MCP gateway、MCP Server、core、queue 和 worker 提供一致契约。
- 使用 Zod 做输入输出校验。
- 保存不依赖具体实现的枚举、状态和 payload 结构。

## 边界

- 不访问数据库。
- 不调用外部服务。
- 不做业务编排。
- 不依赖 Web、worker、MCP SDK 或 Supabase client。

## 当前内容

```txt
src/video-digest.ts
  actorSchema
  createVideoDigestJobInputSchema
  createVideoDigestJobOutputSchema
  getVideoDigestRecordInputSchema
  videoDigestRecordOutputSchema
```

## Tool 输入输出

`create_video_digest_job` 输入：

- `url`
- `platform`: `auto` / `youtube` / `bilibili`
- `outputMode`: `transcript` / `summary` / `summary_and_email`
- `fallbackToAudio`
- `sendEmail`

`get_video_digest_record` 输入：

- `recordId`
- `segmentLimit`

## 使用示例

```ts
import { createVideoDigestJobInputSchema } from "@video-digest-nextjs/job-contracts";

const input = createVideoDigestJobInputSchema.parse(payload);
```

## 构建

包使用 tsup 构建，配置来自 `@video-digest-nextjs/tsup-config`。

```bash
pnpm --filter @video-digest-nextjs/job-contracts build
```

## 常用命令

```bash
pnpm --filter @video-digest-nextjs/job-contracts lint
pnpm --filter @video-digest-nextjs/job-contracts check-types
pnpm --filter @video-digest-nextjs/job-contracts build
```
