# @video-digest-nextjs/mcp-tools

MCP tool 适配层。这里定义 tool 名称、描述、权限范围、参数类型和 handler 创建方式。

## 职责

- 声明 MCP tools。
- 定义每个 tool 需要的 scopes。
- 把 tool input 和 actor context 转交给 `@video-digest-nextjs/video-digest-core`。
- 把 core service 返回值整理成 tool output。

## 边界

- 不直接写数据库。
- 不实现复杂业务逻辑。
- 不依赖 Next.js route 具体实现。
- 不负责 token 校验，鉴权入口由 `/api/mcp` 或调用方完成。

## 当前内容

```txt
src/tool-definition.ts
  ToolDefinition
  ToolHandlerContext

src/tools/create-video-digest-job.ts
  createVideoDigestJobTool
  调用 core service 创建视频记录、任务事件和用量事件
```

## 常用命令

```bash
pnpm --filter @video-digest-nextjs/mcp-tools lint
pnpm --filter @video-digest-nextjs/mcp-tools check-types
pnpm --filter @video-digest-nextjs/mcp-tools build
```

## 后续计划

1. 增加 tool registry。
2. 接入 Next.js `/api/mcp` route。
3. 增加 transcript、summary、delivery 相关 tools。
