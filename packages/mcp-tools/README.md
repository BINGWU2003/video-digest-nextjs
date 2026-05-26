# @video-digest-nextjs/mcp-tools

MCP tool 适配层。这里声明 tool 名称、描述、权限范围、参数类型和 handler 创建方式。

## 职责

- 声明 Video Digest MCP tools。
- 定义每个 tool 需要的 scopes。
- 把 tool input 和 actor context 转交给 core service 或 repository。
- 把业务结果整理为 tool output。

## 边界

- 不直接处理 token 校验。
- 不直接管理 HTTP request/response。
- 不实现完整 MCP stdio 协议。
- 不把 UI、worker 或 Supabase client 细节泄漏到 tool 契约。

## 当前 tools

```txt
create_video_digest_job
  scope: digest:create
  创建视频摘要任务，写入记录、任务事件、用量事件并入队。

get_video_digest_record
  scope: digest:read
  读取视频记录、字幕、摘要和邮件投递状态。
```

## 当前内容

```txt
src/tool-definition.ts
  ToolDefinition
  ToolHandlerContext

src/tools/create-video-digest-job.ts
  createVideoDigestJobTool

src/tools/get-video-digest-record.ts
  getVideoDigestRecordTool
```

## 调用入口

- Web 的 `/api/mcp` 会使用这些 tool，并负责 MCP Token 鉴权和审计。
- npm MCP Server 会通过网站 `/api/mcp` HTTP gateway 间接调用这些 tool。

## 构建

包使用 tsup 构建，配置来自 `@video-digest-nextjs/tsup-config`。

```bash
pnpm --filter @video-digest-nextjs/mcp-tools build
```

## 常用命令

```bash
pnpm --filter @video-digest-nextjs/mcp-tools lint
pnpm --filter @video-digest-nextjs/mcp-tools check-types
pnpm --filter @video-digest-nextjs/mcp-tools build
```
